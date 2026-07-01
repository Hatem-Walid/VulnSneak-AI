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
        public string? RepairedCode { get; set; }
        public double Confidence { get; /*internal*/ set; }
        public string? Explanation { get; /*internal*/ set; }
        public string? ModelUsed { get; /*internal*/ set; }
        public bool RepairSuccess { get; /*internal*/ set; }
        public string? RepairError { get; /*internal*/ set; }
        public double ElapsedSecs { get; /*internal*/ set; }
        public List<int>? VulnLines { get; set; }
    }
}
