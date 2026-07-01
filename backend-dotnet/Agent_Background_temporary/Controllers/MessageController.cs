using Agent_Background_temporary.Dtos;
using Agent_Background_temporary.Models;
using Agent_Services.Controllers;
using Agent_Services.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace Agent_Background_temporary.Controllers
{
    [Route("api/v1/[controller]")] //  api/v1/message
    [ApiController]
    [Authorize]

    public class MessageController : ControllerBase
    {
        private AppDbContext Context;

        public MessageController(AppDbContext _context)
        {
            Context = _context;
        }

        [HttpPost("{chatId:int}")]
        public async Task<IActionResult> AddMessageAsync(
    [FromForm] IFormFile? formFile,
    [FromForm] string? message,
    [FromServices] IHttpClientFactory httpClientFactory,
    int chatId)
        {
            // ─── Validate request ────────────────────────────────────────────────────
            if (chatId <= 0 || formFile == null && string.IsNullOrWhiteSpace(message))
                return BadRequest(new { message = "Invalid request." });

            // ─── Auth check ──────────────────────────────────────────────────────────
            int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

            bool chatExists = await Context.Chats
                .AsNoTracking()
                .AnyAsync(c => c.Id == chatId && c.UserId == userId);

            if (!chatExists)
                return Unauthorized(new { message = "Chat not found or access denied." });

            if (!string.IsNullOrWhiteSpace(message))
            {
                var client = httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(120);

                //var scanSessions = await Context.ScanSessions
                //.AsNoTracking()
                //.Where(s => s.ChatId == chatId)
                //.Include(s => s.VulnResults)
                //    .ThenInclude(v => v.VulnType)
                //.OrderBy(s => s.CreatedAt)
                //.ToListAsync();

                //if (!scanSessions.Any())
                //    return Ok(Enumerable.Empty<MessageDto>());

                //var messageDtos = await Task.WhenAll(scanSessions.Select(ChatController.MapToMessageDtoAsync));
                //var str = string.Join("\n", messageDtos.Select(m => m.ToString()));
                var payload = JsonSerializer.Serialize(new
                {
                    message,
                    history = new[] { new { role = "user", content = "" } }
                });
                //return Ok(payload);
                var content = new StringContent(payload, Encoding.UTF8, "application/json");

                var response = await client.PostAsync("http://localhost:8000/chat", content);
                if (!response.IsSuccessStatusCode)
                    return StatusCode((int)response.StatusCode);

                var result = await response.Content.ReadAsStringAsync();
                return Ok(result);
            }

            // ─── Validate file type ──────────────────────────────────────────────────
            var allowedExtensions = new HashSet<string>
                { ".py", ".java", ".js", ".php", ".cs", ".cpp", ".c", ".html", ".xml", 
                ".ts", ".jsx", ".tsx", ".jsp", ".aspx", ".rb", ".go", ".cshtml", ".txt", ".css" };

            string fileExtension = Path.GetExtension(formFile.FileName)?.ToLowerInvariant() ?? "";

            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest(new
                {
                    message = $"Unsupported file type: '{fileExtension}'.",
                    detail = $"Allowed types: {string.Join(", ", allowedExtensions)}"
                });

            // ─── Validate file not empty ─────────────────────────────────────────────
            if (formFile.Length == 0)
                return BadRequest(new { message = "Uploaded file is empty." });

            

            string chatFolderPath = await Context.Chats
                .AsNoTracking()
                .Where(c => c.Id == chatId)
                .Select(c => c.ChatFolderPath)
                .FirstAsync();

            string originFolder = Path.Combine(chatFolderPath, "Origin");
            Directory.CreateDirectory(originFolder);

            var scanSession = new ScanSession
            {
                FileName = Path.GetFileName(formFile.FileName),
                ContentType = formFile.ContentType,
                ChatId = chatId,
                Status = false
            };

            Context.ScanSessions.Add(scanSession);
            await Context.SaveChangesAsync();

            string filePath = Path.Combine(
                originFolder,
                $"{scanSession.Id}_{SanitizeForPath(scanSession.FileName)}"
            );
            scanSession.FilePath = filePath;
            await Context.SaveChangesAsync();

            try
            {
                // ─── Save file to disk ───────────────────────────────────────────────
                await using var fs = new FileStream(filePath, FileMode.Create, FileAccess.Write);
                await formFile.CopyToAsync(fs);

                // ─── Call FastAPI /analyze ───────────────────────────────────────────
                string aiResponse;
                try
                {
                    aiResponse = await SendFileToAgentAsync(httpClientFactory, filePath, formFile);
                }
                catch (HttpRequestException ex)
                {
                    return StatusCode(503, new
                    {
                        message = "AI agent is unreachable. Please try again later.",
                        detail = ex.Message
                    });
                }
                catch (TaskCanceledException)
                {
                    return StatusCode(504, new
                    {
                        message = "AI agent timed out. The repair models may be overloaded.",
                        detail = "Request to FastAPI exceeded the timeout limit."
                    });
                }

                // ─── Deserialize response ────────────────────────────────────────────
                Dictionary<string, JsonElement> jsonData;
                try
                {
                    var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    jsonData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(aiResponse, jsonOptions)
                               ?? new Dictionary<string, JsonElement>();
                }
                catch (JsonException ex)
                {
                    return StatusCode(502, new
                    {
                        message = "AI agent returned an invalid response.",
                        detail = ex.Message
                    });
                }

                // ─── FastAPI HTTPException errors ────────────────────────────────────
                if (jsonData.TryGetValue("detail", out var detailEl))
                {
                    string? detail = detailEl.GetString();

                    if (detail != null && detail.Contains("Unsupported file type"))
                        return BadRequest(new { message = "Unsupported file type.", detail });

                    if (detail != null && detail.Contains("empty"))
                        return BadRequest(new { message = "Uploaded file is empty.", detail });

                    if (detail != null && detail.Contains("Failed to read file"))
                        return UnprocessableEntity(new { message = "File could not be decoded as UTF-8.", detail });

                    if (detail != null && detail.Contains("Message cannot be empty"))
                        return BadRequest(new { message = "Chat message cannot be empty.", detail });

                    return BadRequest(new { message = "AI agent rejected the request.", detail });
                }

                // ─── Read Status (PascalCase now) ────────────────────────────────────
                string? status = jsonData.TryGetValue("Status", out var statusEl)
                    ? statusEl.GetString()
                    : null;

                if (status == null)
                    return StatusCode(502, new
                    {
                        message = "AI agent response missing 'Status' field.",
                        detail = aiResponse
                    });

                // ─── Safe ────────────────────────────────────────────────────────────
                if (status == "Safe")
                {
                    scanSession.Status = false;
                    await Context.SaveChangesAsync();
                    return Ok(new { Status = "Safe", scanSession.CreatedAt });
                }

                // ─── Vulnerable ──────────────────────────────────────────────────────
                if (status == "Vulnerable")
                {
                    scanSession.Status = true;
                    var scanSessionDto = new ScanSessionDto
                    {
                        Status = status,
                        CreatedAt = scanSession.CreatedAt
                    };

                    // ─── Save repaired file to disk ───────────────────────────────────
                    if (jsonData.TryGetValue("RepairedFile", out var repairedFileEl)
                        && jsonData.TryGetValue("RepairedFilename", out var repairedFilenameEl))
                    {
                        string? repairedContent = repairedFileEl.GetString();
                        string? repairedFilename = repairedFilenameEl.GetString();

                        if (!string.IsNullOrEmpty(repairedContent) && !string.IsNullOrEmpty(repairedFilename))
                        {
                            string repairedFolder = Path.Combine(chatFolderPath, "Repaired");
                            Directory.CreateDirectory(repairedFolder);

                            string repairedFilePath = Path.Combine(
                                repairedFolder,
                                $"{scanSession.Id}_{SanitizeForPath(repairedFilename)}"
                            );

                            await System.IO.File.WriteAllTextAsync(repairedFilePath, repairedContent);

                            var fileReport = new FileReport()
                            {
                                ScanId = scanSession.Id,
                                FileReportName = repairedFilename,
                                FileReportPath = repairedFilePath
                            };
                            Context.FileReports.Add(fileReport);


                            scanSessionDto.RepairedFileName = repairedFilename;
                            scanSessionDto.RepairedFile = await TryReadFileAsync(repairedFilePath);
                        }
                    }

                    // ─── Parse Findings (PascalCase) ─────────────────────────────────
                    if (jsonData.TryGetValue("Findings", out var findingsElement)
                        && findingsElement.ValueKind == JsonValueKind.Array)
                    {
                        var vulnTypes = await Context.VulnTypes.AsNoTracking().ToListAsync();

                        foreach (var finding in findingsElement.EnumerateArray())
                        {
                            // PascalCase field names matching new FastAPI schema
                            string? vulnName = finding.GetProperty("VulnName").GetString();
                            int startLine = finding.GetProperty("StartLine").GetInt32();
                            int endLine = finding.GetProperty("EndLine").GetInt32();
                            string? codeSnippet = finding.GetProperty("CodeSnippet").GetString();
                            double confidence = finding.GetProperty("Confidence").GetDouble();
                            List<int> vulnLines = new List<int>();
                            if (finding.TryGetProperty("VulnLines", out var vulnLinesEl)
                                && vulnLinesEl.ValueKind == JsonValueKind.Array)
                            {
                                vulnLines = vulnLinesEl.EnumerateArray()
                                    .Select(x => x.GetInt32())
                                    .ToList();
                            }

                            // ─── Repair block ─────────────────────────────────────────
                            string? repairedCode = null;
                            string? explanation = null;
                            string? modelUsed = null;
                            bool repairSuccess = false;
                            string? repairError = null;
                            double elapsedSecs = 0;

                            if (finding.TryGetProperty("Repair", out var repairEl))
                            {
                                repairSuccess = repairEl.GetProperty("Success").GetBoolean();
                                repairedCode = repairEl.GetProperty("RepairedCode").GetString();
                                explanation = repairEl.GetProperty("Explanation").GetString();
                                modelUsed = repairEl.GetProperty("ModelUsed").GetString();
                                elapsedSecs = repairEl.GetProperty("ElapsedSecs").GetDouble();

                                repairError = repairEl.TryGetProperty("Error", out var errEl)
                                    ? errEl.GetString()
                                    : null;
                            }

                            var vulnType = vulnTypes.FirstOrDefault(v => v.VulnName == vulnName);
                            if (vulnType == null) continue;

                            scanSessionDto.VulnDtos.Add(new VulnDto
                            {
                                Vulnerability_name = vulnName,
                                Comment = vulnType.Description,
                                Severity = vulnType.Severity.ToString(),
                                StartLine = startLine,
                                EndLine = endLine,
                                CodeSnippet = codeSnippet,
                                Confidence = confidence,
                                RepairedCode = repairedCode,
                                Explanation = explanation,
                                ModelUsed = modelUsed,
                                RepairSuccess = repairSuccess,
                                RepairError = repairError,
                                ElapsedSecs = elapsedSecs,
                                VulnLines = vulnLines,
                            });

                            Context.VulnResults.Add(new VulnResult
                            {
                                ScanId = scanSession.Id,
                                VulnTypeId = vulnType.Id,
                                StartLine = startLine,
                                EndLine = endLine,
                                CodeSnippet = codeSnippet,
                                Confidence = confidence,
                                RepairedCode = repairedCode,
                                Explanation = explanation,
                                ModelUsed = modelUsed,
                                RepairSuccess = repairSuccess,
                                ElapsedSecs = elapsedSecs,
                                VulnLines = vulnLines,
                            });
                        }
                    }

                    await Context.SaveChangesAsync();
                    return Ok(scanSessionDto);
                }

                // ─── Unexpected status ───────────────────────────────────────────────
                return BadRequest(new
                {
                    message = "Unexpected status from AI agent.",
                    detail = $"Received status: '{status}'"
                });
            }
            catch (Exception ex)
            {
                if (System.IO.File.Exists(filePath))
                    System.IO.File.Delete(filePath);

                // ✅ مشكلة 2 — FirstOrDefaultAsync بدل ToString
                var repairedFilePath = await Context.FileReports
                    .Where(FR => FR.ScanId == scanSession.Id)
                    .Select(FR => FR.FileReportPath)
                    .FirstOrDefaultAsync();

                if (!string.IsNullOrEmpty(repairedFilePath) && System.IO.File.Exists(repairedFilePath))
                    System.IO.File.Delete(repairedFilePath);

                // ✅ مشكلة 3 — امسح VulnResults الأول
                var vulnResults = Context.VulnResults.Where(v => v.ScanId == scanSession.Id);
                Context.VulnResults.RemoveRange(vulnResults);

                Context.FileReports.RemoveRange(
                    Context.FileReports.Where(fr => fr.ScanId == scanSession.Id)
                );

                Context.Remove(scanSession);
                await Context.SaveChangesAsync();

                return StatusCode(500, new
                {
                    message = "An error occurred while processing the file.",
                    detail = ex.Message
                });
            }
        }

        // ─── Helper: Send file to /process-file ──────────────────────────────────────
        private async Task<string> SendFileToAgentAsync(IHttpClientFactory factory, string filePath, IFormFile formFile)
        {
            var client = factory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(15);

            using var stream = formFile.OpenReadStream();
            using var multipart = new MultipartFormDataContent();

            var fileContent = new StreamContent(stream);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(formFile.ContentType);
            multipart.Add(fileContent, "file", formFile.FileName);

            var response = await client.PostAsync("http://localhost:8000/analyze", multipart);
            response.EnsureSuccessStatusCode();

            string json = await response.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(json))
                throw new Exception("AI agent returned an empty response.");

            return json;
        }

        private static string SanitizeForPath(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return String.Empty;
            var invalid = Path.GetInvalidFileNameChars().Concat(Path.GetInvalidPathChars()).Distinct().ToArray();
            var cleaned = new string(s.Where(ch => !invalid.Contains(ch)).ToArray());
            return cleaned.Replace(' ', '_');
        }

        private static async Task<byte[]?> TryReadFileAsync(string? path)
        {
            if (string.IsNullOrWhiteSpace(path) || !System.IO.File.Exists(path))
                return null;

            return await System.IO.File.ReadAllBytesAsync(path);
        }

    }
}
