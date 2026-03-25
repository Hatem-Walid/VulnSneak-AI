namespace Agent_Background_temporary.Dtos
{
    public class VulnDto
    {
        public string? Vulnerability_name {  get; set; }
        public string?  Comment { get; set; }
        public string? Severity { get; set; }
        public int StartLine { get; set; }
        public int EndLine { get; set; }
        public string? CodeSnippet{ get; set; }
        public string? RepairCodeSnippet { get; set; }
        public string? ExternalApiReport { get; set; }
    }
}
