using System.ComponentModel.DataAnnotations;

namespace Agent_Background_temporary.Dtos
{
    public class ChangePasswordDto
    {
        [Required] public string CurrentPassword { get; set; } = null!;
        [Required, MinLength(8)] public string NewPassword { get; set; } = null!;
        [Required, Compare(nameof(NewPassword))] public string ConfirmPassword { get; set; } = null!;
    }
}
