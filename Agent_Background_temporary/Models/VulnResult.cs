namespace Agent_Background_temporary.Models
{
    public class VulnResult
    {
        public int Id { get; set; }

        public int VulnTypeId { get; set; }
        public VulnType VulnType { get; set; } = null!;

        public int ScanId { get; set; }
        public ScanSession ScanSession { get; set; } = null!;

        public int StartLine { get; set; }
        public int EndLine { get; set; }

        public string? CodeSnippet { get; set; }
        public string? RepairCodeSnippet { get; set; }
        public string? ExternalApiReport {  get; set; }

    }
}
