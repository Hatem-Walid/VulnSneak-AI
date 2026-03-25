namespace Agent_Background_temporary.Dtos
{
    public class ScanSessionDto
    {
        public required string Status { get; set; }
        public List<VulnDto> VulnDtos { get; set; } = new List<VulnDto>();
        public byte[]? FileReport { get; set; } = null!;
        public DateTime CreatedAt { get; set; }

    }
}
