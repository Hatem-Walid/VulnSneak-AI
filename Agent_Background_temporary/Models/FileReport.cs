namespace Agent_Background_temporary.Models
{
    public class FileReport
    {
        public int ScanId { get; set; }
        public ScanSession? ScanSession { get; set; }
        public required string FileReportName { get; set; }
        public required string FileReportPath { get; set; }
    }
}
