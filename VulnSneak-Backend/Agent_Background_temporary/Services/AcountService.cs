using Microsoft.AspNetCore.Identity;
using Agent_Services.Models;

namespace Agent_Background_temporary.Services
{
    public static class AccountService
    {
        public static string HashPassword(User user, string plainPassword)
        {
            PasswordHasher<User> hasher = new PasswordHasher<User>();
            return hasher.HashPassword(user, plainPassword);
        }

        public static bool VerifyPassword(User user, string hashedPassword, string providedPassword)
        {
            PasswordHasher<User> hasher = new PasswordHasher<User>();
            return hasher.VerifyHashedPassword(user, hashedPassword, providedPassword)
                    is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;

        }
    }
}
