using Agent_Background_temporary.Dtos;
using Agent_Background_temporary.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Agent_Services.Controllers
{
    [Route("api/v1/[controller]")]  // api/v1/Chat
    [ApiController]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private AppDbContext Context;
        private readonly string _basePath;
        public ChatController(AppDbContext _context, IConfiguration configuration)
        {
            Context = _context;
            _basePath = configuration["FileStorage:BasePath"]
                ?? throw new InvalidOperationException("FileStorage:BasePath is not configured.");
        }

        [HttpGet("GetAllChats")]  // GET  api/v1/Chat/GetAllChats
        public IActionResult GetAllChats()
        {
            int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

            var chatDtos = Context.Chats
                .AsNoTracking()
                .Where(C => C.UserId == userId)
                .OrderByDescending(C => C.CreatedAt)
                .Select(chat => new ChatDto
                {
                    ChatId = chat.Id,
                    ChatName = chat.ChatName,
                    CreatedAt = chat.CreatedAt
                }).ToList();

            return Ok(chatDtos);
        }


        [HttpPost]  // POST  api/v1/Chat  
        public async Task<IActionResult> AddChatAsync([FromBody] ChatDto chatDto)
        {
            if (string.IsNullOrWhiteSpace(chatDto?.ChatName))
                return BadRequest(new { message = "Chat name is required." });

            int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

            var user = await Context.Users
                .AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.Id, u.Fname, u.Lname })
                .FirstOrDefaultAsync();

            if (user is null)
                return Unauthorized(new { message = "User not found." });

            string userFolder = $"{user.Id}_{SanitizeForPath(user.Fname)}_{SanitizeForPath(user.Lname)}";

            var chat = new Chat
            {
                UserId = userId,
                ChatName = chatDto.ChatName,
                ChatFolderPath = "",
                CreatedAt = DateTime.UtcNow
            };

            Context.Chats.Add(chat);
            await Context.SaveChangesAsync();

            string chatFolder = $"{chat.Id}_{SanitizeForPath(chat.ChatName)}";
            string chatFolderPath = Path.Combine(_basePath, userFolder, chatFolder);

            try
            {
                Directory.CreateDirectory(chatFolderPath);
                chat.ChatFolderPath = chatFolderPath;
                await Context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Context.Chats.Remove(chat);
                await Context.SaveChangesAsync();

                return StatusCode(500, new { message = "Failed to create chat storage. Please try again later." });
            }

            return Ok(new ChatDto
            {
                ChatId = chat.Id,
                ChatName = chat.ChatName,
                CreatedAt = chat.CreatedAt
            });
        }


        [HttpGet("{chatId:int}")]  // GET  api/v1/Chat/{chatId:int}
        public async Task<IActionResult> GetChatAsync(int chatId)
        {
            if (chatId <= 0)
                return BadRequest(new { message = "Invalid chat ID." });

            int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

            bool chatExists = await Context.Chats
                .AsNoTracking()
                .AnyAsync(c => c.Id == chatId && c.UserId == userId);

            if (!chatExists)
                return NotFound(new { message = "Chat not found." });

            var scanSessions = await Context.ScanSessions
                .AsNoTracking()
                .Where(s => s.ChatId == chatId)
                .Include(s => s.FileReport)
                .Include(s => s.VulnResults)
                    .ThenInclude(v => v.VulnType)
                .OrderBy(s => s.CreatedAt)
                .ToListAsync();

            if (!scanSessions.Any())
                return Ok(Enumerable.Empty<MessageDto>());

            var messageDtos = await Task.WhenAll(scanSessions.Select(MapToMessageDtoAsync));

            return Ok(messageDtos);
        }

        private static async Task<MessageDto> MapToMessageDtoAsync(ScanSession session)
        {
            var messageDto = new MessageDto
            {
                ContentType = session.ContentType,
                FileName = session.FileName,
                File = await TryReadFileAsync(session.FilePath),
                FileReportName = session.FileReport?.FileReportName,
                FileReport = await TryReadFileAsync(session.FileReport?.FileReportPath),
                Status = session.Status ? "Vulnerable" : "Safe",
                CreatedAt = session.CreatedAt,
                VulnDtos = session.VulnResults?
                    .Select(v => new VulnDto
                    {
                        Vulnerability_name = v.VulnType.VulnName,
                        Comment = v.VulnType.Description,
                        Severity = v.VulnType.Severity.ToString(),
                        StartLine = v.StartLine,
                        EndLine = v.EndLine,
                        CodeSnippet = v.CodeSnippet,
                        RepairCodeSnippet = v.RepairCodeSnippet,
                        ExternalApiReport = v.ExternalApiReport
                    })
                    .ToList() ?? new List<VulnDto>()
            };

            return messageDto;
        }

        private static async Task<byte[]?> TryReadFileAsync(string? path)
        {
            if (string.IsNullOrWhiteSpace(path) || !System.IO.File.Exists(path))
                return null;

            return await System.IO.File.ReadAllBytesAsync(path);
        }


        [HttpPut("Rename")]  //  PUT  api/v1/Chat/Rename
        public async Task<IActionResult> RenameChatAsync([FromBody] ChatDto chatDto)
        {
            if (string.IsNullOrWhiteSpace(chatDto.ChatName) || chatDto.ChatId <= 0)
                return BadRequest(new {message = "Try Again"});

            int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            int NumRowEff = await Context.Chats
                .Where(C => C.Id == chatDto.ChatId && C.UserId == userId)
                .ExecuteUpdateAsync(S => 
                    S.SetProperty(C => C.ChatName, chatDto.ChatName));

            if (NumRowEff == 0)
                return BadRequest(new { message = "Chat Not Found" });

            return Ok();
        }


        [HttpDelete("{ChatId:int}")]  // DELETE  api/v1/Chat/{ChatId:int}
        public async Task<IActionResult> DeleteChatAsync(int chatId)
        {
            if (chatId <= 0)
                return BadRequest(new { message = "Invalid chat ID." });

            int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

            var chat = await Context.Chats
                .FirstOrDefaultAsync(c => c.Id == chatId && c.UserId == userId);

            if (chat is null)
                return NotFound(new { message = "Chat not found." });

            string? folderPath = chat.ChatFolderPath;

            Context.Chats.Remove(chat);
            await Context.SaveChangesAsync();

            if (!string.IsNullOrWhiteSpace(folderPath) && Directory.Exists(folderPath))
            {
                try
                {
                    Directory.Delete(folderPath, recursive: true);
                }
                catch (Exception ex)
                {
                    // DB record is already deleted — log the orphaned folder for manual cleanup
                    // _logger.LogWarning(ex, "Failed to delete chat folder at {Path} for chatId {ChatId}", folderPath, chatId);
                }
            }

            return Ok(new { message = "Chat deleted successfully." });
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