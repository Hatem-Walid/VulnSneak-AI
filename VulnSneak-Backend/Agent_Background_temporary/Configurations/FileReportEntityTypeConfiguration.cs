using Agent_Background_temporary.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agent_Background_temporary.Configurations
{
    public class FileReportEntityTypeConfiguration : IEntityTypeConfiguration<FileReport>
    {
        public void Configure(EntityTypeBuilder<FileReport> builder)
        {
            builder.ToTable("FileReports");

            builder
                .HasKey(FR => FR.ScanId);
            builder
                .HasOne(FR => FR.ScanSession)
                .WithOne(S => S.FileReport)
                .HasForeignKey<FileReport>(FR => FR.ScanId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(FR => FR.FileReportName)
                .IsRequired()
                .HasMaxLength(255);

            builder.Property(FR => FR.FileReportPath)
                .IsRequired()
                .HasMaxLength(500);
        }
    }
}
