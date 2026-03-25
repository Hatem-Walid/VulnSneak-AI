namespace Agent_Services.Models;

public partial class User
{

    public int Id { get; set; }
    public string Fname { get; set; } = null!;
    public string? Lname { get; set; }
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;

    public byte Age { get; set; }
    public bool? Gender { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }

    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;
    public ICollection<Chat>  Chats { get; set; } = new List<Chat>();
    public DateTime CreatedAt { get; set; }

}
