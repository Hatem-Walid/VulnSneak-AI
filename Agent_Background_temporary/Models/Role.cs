using Agent_Services.Models;


public class Role
{
    public int Id { get; set; }
    public string RoleName { get; set; } = null!;
    public ICollection<User> Users { get; set; } = new List<User>();
}
