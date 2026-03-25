using Agent_Background_temporary.Dtos;
using Agent_Background_temporary.Models;
using Agent_Background_temporary.Services;
using Agent_Services.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly AppDbContext Context;
    private readonly string _basePath;

    public UserController(AppDbContext _context, IConfiguration configuration)
    {
        Context = _context;
        _basePath = configuration["FileStorage:BasePath"]
                ?? throw new InvalidOperationException("FileStorage:BasePath is not configured.");
    }

    // GET api/v1/User
    [HttpGet]
    public async Task<IActionResult> GetUserAsync()
    {
        int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

        var user = await Context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new UserDto
            {
                Fname = u.Fname,
                Lname = u.Lname,
                Email = u.Email,
                Age = u.Age,
                Gender = u.Gender,
                Phone = u.Phone,
                Address = u.Address
            })
            .FirstOrDefaultAsync();

        if (user is null)
            return NotFound(new { message = "User not found." });

        return Ok(user);
    }

    // PUT api/v1/User
    [HttpPut]
    public async Task<IActionResult> UpdateUserAsync([FromBody] UpdateUserDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

        var user = await Context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null)
            return NotFound(new { message = "User not found." });

        user.Fname = dto.Fname ?? user.Fname;
        user.Lname = dto.Lname ?? user.Lname;
        user.Age = dto.Age ?? user.Age;
        user.Gender = dto.Gender ?? user.Gender;
        user.Phone = dto.Phone ?? user.Phone;
        user.Address = dto.Address ?? user.Address;

        await Context.SaveChangesAsync();

        return Ok(new { message = "User updated successfully." });
    }

    // PUT api/v1/User/change-password
    [HttpPut("change-password")]
    public async Task<IActionResult> ChangePasswordAsync([FromBody] ChangePasswordDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

        var user = await Context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null)
            return NotFound(new { message = "User not found." });

        if (!AccountService.VerifyPassword(user, user.Password, dto.CurrentPassword))
            return BadRequest(new { message = "Current password is incorrect." });

        user.Password = AccountService.HashPassword(user, dto.NewPassword);
        await Context.SaveChangesAsync();

        return Ok(new { message = "Password changed successfully." });
    }

    // DELETE api/v1/User
    [HttpDelete]
    public async Task<IActionResult> DeleteUserAsync()
    {
        int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

        var user = await Context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null)
            return NotFound(new { message = "User not found." });

        string userFolder = $"{user.Id}_{SanitizeForPath(user.Fname)}_{SanitizeForPath(user.Lname)}";
        string filePath = Path.Combine(_basePath, userFolder);

        Context.Users.Remove(user);
        await Context.SaveChangesAsync();

        if (!string.IsNullOrWhiteSpace(filePath) && Directory.Exists(filePath))
        {
            try
            {
                Directory.Delete(filePath, recursive: true);
            }
            catch (Exception ex)
            {
                // DB record is already deleted — log the orphaned folder for manual cleanup
                // _logger.LogWarning(ex, "Failed to delete chat folder at {Path} for chatId {ChatId}", folderPath, chatId);
            }
        }

        return Ok(new { message = "User deleted successfully." });
    }

    private static string SanitizeForPath(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return String.Empty;
        var invalid = Path.GetInvalidFileNameChars().Concat(Path.GetInvalidPathChars()).Distinct().ToArray();
        var cleaned = new string(s.Where(ch => !invalid.Contains(ch)).ToArray());
        return cleaned.Replace(' ', '_');
    }
}