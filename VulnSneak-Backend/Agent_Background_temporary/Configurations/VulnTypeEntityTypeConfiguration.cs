using Agent_Background_temporary.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agent_Background_temporary.Configurations
{
    public class VulnTypeEntityTypeConfiguration : IEntityTypeConfiguration<VulnType>
    {
        public void Configure(EntityTypeBuilder<VulnType> builder)
        {
            builder.ToTable("VulnTypes");

            builder
                .HasKey(VT => VT.Id);

            builder.Property(VT => VT.Id)
                .UseIdentityColumn();

            builder.Property(VT => VT.VulnName)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(VT => VT.Description)
                .IsRequired()
                .HasMaxLength(500);

            builder
                .HasMany(VT => VT.VulnResults)
                .WithOne(VR => VR.VulnType)
                .HasForeignKey(VR => VR.VulnTypeId)
                .OnDelete(DeleteBehavior.Cascade);

            builder
                .HasData(
                new VulnType
                {
                    Id = 1,
                    VulnName = "CSRF",
                    Description = "CSRF (Cross-Site Request Forgery) is a vulnerability where an attacker tricks a victim’s browser into sending unintended requests using the victim’s existing session or credentials.",
                    Severity = SeverityEnum.High
                },
                new VulnType
                {
                    Id = 2,
                    VulnName = "Insecure Cryptography",
                    Description = "Insecure Cryptography means using weak, outdated, or misconfigured cryptographic algorithms, keys, or protocols, which can let attackers read or tamper with sensitive data.",
                    Severity = SeverityEnum.High
                },
                new VulnType
                {
                    Id = 3,
                    VulnName = "Insecure Deserialization",
                    Description = "Insecure Deserialization happens when the application deserializes untrusted data, allowing attackers to manipulate objects or even execute arbitrary code.",
                    Severity = SeverityEnum.Critical
                },
                new VulnType
                {
                    Id = 4,
                    VulnName = "OS Command Injection",
                    Description = "OS Command Injection occurs when user input is passed unsafely into system commands, allowing attackers to execute arbitrary OS commands on the server.",
                    Severity = SeverityEnum.Critical
                },
                new VulnType
                {
                    Id = 5,
                    VulnName = "Path Traversal",
                    Description = "Path Traversal (Directory Traversal) lets attackers manipulate file paths (e.g., using ../) to access files outside the intended directory, such as system or configuration files.",
                    Severity = SeverityEnum.Medium
                },
                new VulnType
                {
                    Id = 6,
                    VulnName = "SQL Injection",
                    Description = "SQL Injection (SQLi) allows an attacker to inject or modify SQL queries, often leading to unauthorized access, modification, or deletion of data in the database.",
                    Severity = SeverityEnum.Critical
                },
                new VulnType
                {
                    Id = 7,
                    VulnName = "Safe",
                    Description = "Safe: The analyzed code does not appear to contain any of the tracked vulnerability types based on the model’s prediction.",
                    Severity = SeverityEnum.Low
                },
                new VulnType
                {
                    Id = 8,
                    VulnName = "XML Injection",
                    Description = "XML Injection is when attackers inject or modify XML content or structure so that the application processes unexpected data or behavior.",
                    Severity = SeverityEnum.High
                },
                new VulnType
                {
                    Id = 9,
                    VulnName = "XSS",
                    Description = "Cross-Site Scripting (XSS) is an injection flaw where attackers inject malicious scripts (usually JavaScript) into web pages viewed by others, leading to session theft, content tampering, or other client-side attacks.",
                    Severity = SeverityEnum.High
                });

        }
    }
}
