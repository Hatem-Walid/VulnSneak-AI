using Agent_Background_temporary.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agent_Background_temporary.Configurations
{
    public class ScanSessionEntityTypeConfiguration : IEntityTypeConfiguration<ScanSession>
    {
        public void Configure(EntityTypeBuilder<ScanSession> builder)
        {
            builder.ToTable("ScanSessions");

            builder
                .HasKey(S => S.Id);

            builder.Property(S => S.Id)
                .UseIdentityColumn();

            builder
                .HasIndex(S => S.ChatId);

            builder.Property(S => S.FileName)
                .IsRequired()
                .HasMaxLength(255);

            builder.Property(S => S.ContentType)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(S => S.FilePath)
                .HasMaxLength(500);

            builder.Property(S => S.CreatedAt)
                .HasDefaultValueSql("GETDATE()");

            builder
                .HasOne(S => S.Chat)
                .WithMany(C => C.ScanSessions)
                .HasForeignKey(S => S.ChatId)
                .OnDelete(DeleteBehavior.Cascade);

            builder
                .HasMany(S => S.VulnResults)
                .WithOne(VR => VR.ScanSession)
                .HasForeignKey(VR => VR.ScanId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
