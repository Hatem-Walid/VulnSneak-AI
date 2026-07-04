using Agent_Background_temporary.Models;
using Agent_Background_temporary.Dtos;
using Agent_Background_temporary.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Agent_Services.Models;

namespace Agent_Services.Controllers
{
    [Route("api/v1/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private AppDbContext Context;
        private IConfiguration Configuration;
        public AuthController(AppDbContext _context, IConfiguration _configuration)
        {
            Context = _context;
            Configuration = _configuration;
        }

        [HttpPost("register")]
        public async Task<IActionResult> RegisterAsync([FromBody]RegisterDto RegUser)
        {
            if (RegUser is null)
                return BadRequest("Registration fail, User Invalid");
            User? FoundUser = await Context.Users.FirstOrDefaultAsync(U => U.Email == RegUser.Email);
            if (FoundUser is not null)
                return BadRequest(new { message = $"Email {RegUser.Email} Already Exists " });
            User user = new User()
            {
                Fname = RegUser.Fname,
                Lname = RegUser.Lname,
                Email = RegUser.Email,
                Gender = RegUser.Gender,
                Age = RegUser.Age,
                Address = RegUser.Address,
                Phone = RegUser.Phone,
                RoleId = 2
            };
            user.Password = AccountService.HashPassword(user, RegUser.Password);

            Context.Users.Add(user);
            await Context.SaveChangesAsync();
            return Ok(new { message = "Registration successful" });
        }

        [HttpPost("login")]
        public async Task<IActionResult> LoginAsync(LoginDto LogUser)
        {
            if (LogUser is null)
                return BadRequest(new { message = "Login Failed, Invalid Data" });
            User? FoundUser = await Context.Users.FirstOrDefaultAsync(U => U.Email == LogUser.Email);
            if (FoundUser is null)
                return BadRequest(new { message = "Login Failed, Not Found User" });
            var isHashed = AccountService.VerifyPassword(FoundUser, FoundUser.Password, LogUser.Password);
            if (!isHashed)
                return BadRequest(new { message = "Login Failed, Wrong Password" });

            List<Claim> UserClaims = new List<Claim>();
            UserClaims.Add(new Claim(ClaimTypes.Name, $"{FoundUser.Fname} {FoundUser.Lname}"));
            UserClaims.Add(new Claim(ClaimTypes.NameIdentifier, FoundUser.Id.ToString()));
            UserClaims.Add(new Claim(ClaimTypes.Email, FoundUser.Email));
            UserClaims.Add(new Claim(ClaimTypes.Role, Context.Roles.Where(R => R.Id == FoundUser.RoleId).Select(R => R.RoleName).ToString()));
            UserClaims.Add(new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()));

            var SignInKey =
                new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(Configuration["Jwt:Key"])
                    );

            var signingCredentials =
                new SigningCredentials(
                    SignInKey, SecurityAlgorithms.HmacSha256
                    );

            JwtSecurityToken userToken = new JwtSecurityToken(
                issuer: Configuration["Jwt:Issuer"],
                audience: Configuration["Jwt:Audience"],
                expires: DateTime.Now.AddHours(1),
                claims: UserClaims,
                signingCredentials: signingCredentials
                );

            return Ok(new
            {
                token = new JwtSecurityTokenHandler().WriteToken(userToken),
                expiration = DateTime.Now.AddHours(1),
                Name = $"{FoundUser.Fname} {FoundUser.Lname}",
                Email = FoundUser.Email
            });
        }
    }
}