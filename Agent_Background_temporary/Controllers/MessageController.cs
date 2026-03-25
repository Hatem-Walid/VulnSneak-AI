using Agent_Background_temporary.Dtos;
using Agent_Background_temporary.Models;
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

        [HttpPost("{chatId:int}")] // POST api/v1/Message/{chatId:int}
        public async Task<IActionResult> AddMessageAsync(
            [FromForm] IFormFile formFile,
            [FromServices] IHttpClientFactory httpClientFactory,
            int chatId)
        {
            if (chatId <= 0 || formFile == null)
                return BadRequest(new { message = "Invalid request." });

            int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            bool chatExists = await Context.Chats
                .AsNoTracking()
                .AnyAsync(c => c.Id == chatId && c.UserId == userId);

            if (!chatExists)
                return Unauthorized(new { message = "Chat not found or access denied." });

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

            string filePath = Path.Combine(originFolder, $"{scanSession.Id}_{SanitizeForPath(scanSession.FileName)}");
            scanSession.FilePath = filePath;
            await Context.SaveChangesAsync();

            try
            {
                await using var fs = new FileStream(filePath, FileMode.Create, FileAccess.Write);
                await formFile.CopyToAsync(fs);

                // ─── Step 1: Scan ────────────────────────────────────────────────
                var aiResponse = await SendFileToAgentAsync(httpClientFactory, filePath, formFile);
                var jsonData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(aiResponse)
                               ?? new Dictionary<string, JsonElement>();

                string? status = jsonData.TryGetValue("Status", out var statusEl) ? statusEl.GetString() : null;

                if (status == "Safe")
                {
                    scanSession.Status = false;
                    await Context.SaveChangesAsync();
                    return Ok(new { Status = status, scanSession.CreatedAt });
                }

                if (status == "Vulnerable")
                {
                    scanSession.Status = true;
                    var scanSessionDto = new ScanSessionDto { Status = status, CreatedAt = scanSession.CreatedAt };

                    // Track saved VulnResults by VulnName+StartLine so we can update them after repair
                    var savedVulnResults = new List<(VulnResult Entity, string? VulnName)>();

                    if (jsonData.TryGetValue("Vulnerabilities", out var vulnsElement)
                        && vulnsElement.ValueKind == JsonValueKind.Array)
                    {
                        var vulnTypes = await Context.VulnTypes.AsNoTracking().ToListAsync();

                        foreach (var vuln in vulnsElement.EnumerateArray())
                        {
                            string? vulnName = vuln.GetProperty("VulnName").GetString();
                            int startLine = vuln.GetProperty("StartLine").GetInt32();
                            int endLine = vuln.GetProperty("EndLine").GetInt32();
                            string? codeSnippet = vuln.GetProperty("CodeSnippet").GetString();

                            var vulnType = vulnTypes.FirstOrDefault(v => v.VulnName == vulnName);
                            if (vulnType == null) continue;

                            scanSessionDto.VulnDtos.Add(new VulnDto
                            {
                                Vulnerability_name = vulnName,
                                Comment = vulnType.Description,
                                Severity = vulnType.Severity.ToString(),
                                StartLine = startLine,
                                EndLine = endLine,
                                CodeSnippet = codeSnippet
                            });

                            var vulnResult = new VulnResult
                            {
                                ScanId = scanSession.Id,
                                VulnTypeId = vulnType.Id,
                                StartLine = startLine,
                                EndLine = endLine,
                                CodeSnippet = codeSnippet
                            };

                            Context.VulnResults.Add(vulnResult);
                            savedVulnResults.Add((vulnResult, vulnName));
                        }
                    }

                    await Context.SaveChangesAsync();

                    // ─── Step 2: Repair ──────────────────────────────────────────
                    //var repairResponse = await SendFileAndVulnsToRepairAsync(httpClientFactory, filePath, formFile, scanSessionDto.VulnDtos);
                    //var repairJson = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(repairResponse)
                    //                 ?? new Dictionary<string, JsonElement>();

                    //// 2a. Update each VulnResult with RepairCodeSnippet + ExternalApiReport
                    //if (repairJson.TryGetValue("Vulnerabilities", out var repairVulnsEl)
                    //    && repairVulnsEl.ValueKind == JsonValueKind.Array)
                    //{
                    //    foreach (var repairVuln in repairVulnsEl.EnumerateArray())
                    //    {
                    //        string? vulnName = repairVuln.GetProperty("VulnName").GetString();
                    //        int startLine = repairVuln.GetProperty("StartLine").GetInt32();
                    //        string? repairSnippet = repairVuln.GetProperty("RepairCodeSnippet").GetString();
                    //        string? externalReport = repairVuln.GetProperty("ExternalApiReport").GetString();

                    //        // Match back to saved entity and DTO
                    //        var matched = savedVulnResults
                    //            .FirstOrDefault(x => x.VulnName == vulnName && x.Entity.StartLine == startLine);

                    //        if (matched.Entity != null)
                    //        {
                    //            matched.Entity.RepairCodeSnippet = repairSnippet;
                    //            matched.Entity.ExternalApiReport = externalReport;
                    //        }

                    //        var matchedDto = scanSessionDto.VulnDtos
                    //            .FirstOrDefault(d => d.Vulnerability_name == vulnName && d.StartLine == startLine);

                    //        if (matchedDto != null)
                    //        {
                    //            matchedDto.RepairCodeSnippet = repairSnippet;
                    //            matchedDto.ExternalApiReport = externalReport;
                    //        }
                    //    }

                    //    await Context.SaveChangesAsync();
                    //}

                    //// 2b. Save the repaired file
                    //if (repairJson.TryGetValue("RepairedFile", out var repairedFileEl))
                    //{
                    //    string? base64File = repairedFileEl.GetString();
                    //    if (!string.IsNullOrWhiteSpace(base64File))
                    //    {
                    //        byte[] repairedBytes = Convert.FromBase64String(base64File);

                    //        string repairFolder = Path.Combine(chatFolderPath, "Repaired");
                    //        Directory.CreateDirectory(repairFolder);

                    //        string repairedFileName = $"{scanSession.Id}_repaired_{SanitizeForPath(scanSession.FileName)}";
                    //        string repairedFilePath = Path.Combine(repairFolder, repairedFileName);

                    //        await System.IO.File.WriteAllBytesAsync(repairedFilePath, repairedBytes);

                    //        Context.FileReports.Add(new FileReport
                    //        {
                    //            ScanId = scanSession.Id,
                    //            FileReportName = repairedFileName,
                    //            FileReportPath = repairedFilePath
                    //        });

                    //        await Context.SaveChangesAsync();

                    //        // Return the repaired file bytes to the client inside the DTO
                    //        scanSessionDto.FileReport = repairedBytes;
                    //    }
                    //}

                    return Ok(scanSessionDto);
                }

                return BadRequest(new { message = "Unexpected status from AI agent." });
            }
            catch (Exception ex)
            {
                if (System.IO.File.Exists(filePath))
                    System.IO.File.Delete(filePath);

                return StatusCode(500, new { message = "An error occurred while processing the file.", detail = ex.Message });
            }
        }

        // ─── Helper: Send file to /process-file ──────────────────────────────────────
        private async Task<string> SendFileToAgentAsync(IHttpClientFactory factory, string filePath, IFormFile formFile)
        {
            var client = factory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(120);

            using var stream = formFile.OpenReadStream();
            using var multipart = new MultipartFormDataContent();

            var fileContent = new StreamContent(stream);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(formFile.ContentType);
            multipart.Add(fileContent, "file", formFile.FileName);

            var response = await client.PostAsync("http://localhost:8001/detect", multipart);
            response.EnsureSuccessStatusCode();

            string json = await response.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(json))
                throw new Exception("AI agent returned an empty response.");

            return json;
        }

        // ─── Helper: Send file + vuln list to /repair ────────────────────────────────
        private async Task<string> SendFileAndVulnsToRepairAsync(
            IHttpClientFactory factory,
            string filePath,
            IFormFile formFile,
            List<VulnDto> vulnDtos)
        {
            var client = factory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(180);

            using var stream = formFile.OpenReadStream();
            using var multipart = new MultipartFormDataContent();

            // Attach the original file
            var fileContent = new StreamContent(stream);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(formFile.ContentType);
            multipart.Add(fileContent, "file", formFile.FileName);

            // Attach the vulnerabilities as a JSON string field
            var vulnsJson = JsonSerializer.Serialize(vulnDtos.Select(v => new
            {
                v.Vulnerability_name,
                v.StartLine,
                v.EndLine,
                v.CodeSnippet
            }));
            multipart.Add(new StringContent(vulnsJson, Encoding.UTF8, "application/json"), "vulnerabilities");

            var response = await client.PostAsync("http://localhost:8002/repair", multipart);
            response.EnsureSuccessStatusCode();

            string json = await response.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(json))
                throw new Exception("Repair agent returned an empty response.");

            return json;
        }


        private static string SanitizeForPath(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return String.Empty;
            var invalid = Path.GetInvalidFileNameChars().Concat(Path.GetInvalidPathChars()).Distinct().ToArray();
            var cleaned = new string(s.Where(ch => !invalid.Contains(ch)).ToArray());
            return cleaned.Replace(' ', '_');
        }

    }
}
