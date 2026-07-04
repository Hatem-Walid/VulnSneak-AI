using System.Text;

namespace Agent_Background_temporary.Dtos
{
    public class MessageDto
    {
        public required string FileName { get; set; }
        public byte[]? File { get; set; }
        public required string ContentType { get; set; }
        public required string Status { get; set; }
        public List<VulnDto> VulnDtos { get; set; } = new List<VulnDto>();
        public string? FileReportName { get; set; }
        public byte[]? FileReport { get; set; }
        public DateTime CreatedAt { get; set; }

        public override string ToString()
        {
            var sb = new StringBuilder();
            sb.AppendLine($"File: {FileName} | Status: {Status} | Scanned: {CreatedAt:yyyy-MM-dd HH:mm}");

            // ── File content ──────────────────────────────────────────────────
            if (File != null)
            {
                string fileContent = Encoding.UTF8.GetString(File);
                sb.AppendLine("  Original file:");
                sb.AppendLine(fileContent);
            }

            // ── Vulnerabilities ───────────────────────────────────────────────
            if (Status == "Safe" || !VulnDtos.Any())
            {
                sb.AppendLine("  Result: No vulnerabilities found.");
            }
            else
            {
                sb.AppendLine($"  Vulnerabilities found: {VulnDtos.Count}");
                foreach (var v in VulnDtos)
                {
                    sb.AppendLine($"  - [{v.Severity}] {v.Vulnerability_name} (lines {v.StartLine}-{v.EndLine}, confidence: {v.Confidence:P0})");
                    sb.AppendLine($"    Description: {v.Comment}");

                    if (!string.IsNullOrEmpty(v.CodeSnippet))
                        sb.AppendLine($"    Vulnerable code:\n{v.CodeSnippet}");

                    if (v.VulnLines?.Any() == true)
                        sb.AppendLine($"    Vulnerable lines: {string.Join(", ", v.VulnLines)}");

                    if (v.RepairSuccess)
                    {
                        sb.AppendLine($"    Fix: {v.Explanation}");
                        sb.AppendLine($"    Fixed by: {v.ModelUsed}");
                        if (!string.IsNullOrEmpty(v.RepairedCode))
                            sb.AppendLine($"    Repaired code:\n{v.RepairedCode}");
                    }
                    else
                    {
                        sb.AppendLine($"    Repair failed: {v.RepairError}");
                    }
                }
            }

            // ── Repaired file ─────────────────────────────────────────────────
            if (FileReport != null && !string.IsNullOrEmpty(FileReportName))
            {
                string reportContent = Encoding.UTF8.GetString(FileReport);
                sb.AppendLine($"  Repaired file ({FileReportName}):");
                sb.AppendLine(reportContent);
            }

            sb.AppendLine(new string('─', 60));

            return sb.ToString();
        }
    }
}

