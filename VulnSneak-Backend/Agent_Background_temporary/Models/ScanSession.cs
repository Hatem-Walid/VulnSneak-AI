namespace Agent_Background_temporary.Models
{
    public class ScanSession
    {
        public int Id { get; set; }
        public int ChatId { get; set; }
        public Chat Chat { get; set; } = null!;
        public string FileName { get; set; } = null!;
        public string ContentType { get; set; } = null!;
        public string? FilePath { get; set; }
        public required bool Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public ICollection<VulnResult> VulnResults { get; set; } = new List<VulnResult>();
        public FileReport? FileReport { get; set; }

    }
}
