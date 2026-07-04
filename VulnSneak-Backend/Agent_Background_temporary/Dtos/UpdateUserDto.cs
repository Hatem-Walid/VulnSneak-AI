using System.ComponentModel.DataAnnotations;

namespace Agent_Background_temporary.Dtos
{
    public class UpdateUserDto
    {
        [MinLength(2)] public string? Fname { get; set; }
        [MinLength(2)] public string? Lname { get; set; }
        [Range(1, 120)] public byte? Age { get; set; }
        public bool? Gender { get; set; }
        [Phone] public string? Phone { get; set; }
        public string? Address { get; set; }
    }
}
