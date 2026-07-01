namespace Agent_Background_temporary.Dtos
{
    public class UserDto
    {
        public string Fname { get; set; } = null!;
        public string? Lname { get; set; }
        public string Email { get; set; } = null!;
        public byte Age { get; set; }
        public bool? Gender { get; set; }
        public string? Phone { get; set; }
        public string? Address { get; set; }
    }
}
