namespace Agent_Background_temporary.Models
{
    public class VulnType
    {
        public int Id { get; set; }
        public required string VulnName { get; set; }
        public required string Description { get; set; }
        public SeverityEnum Severity { get; set; }
        public ICollection<VulnResult> VulnResults { get; set; } = new List<VulnResult>();

    }
}
