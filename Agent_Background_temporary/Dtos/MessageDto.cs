namespace Agent_Background_temporary.Dtos
{
    public class MessageDto
    {
        public required string FileName { get; set; }
        public byte[]? File { get; set; } = null!;
        public required string ContentType { get; set; }
        public required string Status { get; set; }
        public List<VulnDto> VulnDtos { get; set; } = new List<VulnDto>();
        public string? FileReportName { get; set; }
        public byte[]? FileReport { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
    }
}
