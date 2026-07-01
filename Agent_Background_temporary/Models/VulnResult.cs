using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

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
        public double Confidence { get; /*internal*/ set; }
        public string? RepairedCode { get; /*internal*/ set; }
        public string? Explanation { get; /*internal*/ set; }
        public string? ModelUsed { get; /*internal*/ set; }
        public bool RepairSuccess { get; /*internal*/ set; }
        public string? RepairError { get; set; }
        public double ElapsedSecs { get; /*internal*/ set; }

        public string? VulnLinesJson { get; set; } // "[37, 45, 52, 61]"

        [NotMapped]
        public List<int> VulnLines
        {
            get => string.IsNullOrEmpty(VulnLinesJson)
                ? new List<int>()
                : JsonSerializer.Deserialize<List<int>>(VulnLinesJson) ?? new List<int>();
            set => VulnLinesJson = JsonSerializer.Serialize(value);
        }
    }
}
