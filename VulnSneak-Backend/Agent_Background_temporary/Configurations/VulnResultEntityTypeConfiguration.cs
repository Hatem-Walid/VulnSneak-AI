using Agent_Background_temporary.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agent_Background_temporary.Configurations
{
    public class VulnResultEntityTypeConfiguration : IEntityTypeConfiguration<VulnResult>
    {
        public void Configure(EntityTypeBuilder<VulnResult> builder)
        {
            builder.ToTable("VulnResults");

            builder
                .HasKey(VR => VR.Id);

            builder.Property(VR => VR.Id)
                .UseIdentityColumn();

            builder
                .HasIndex(VR => VR.VulnTypeId);
            builder
                .HasOne(VR => VR.VulnType)
                .WithMany(VT => VT.VulnResults)
                .HasForeignKey(VR => VR.VulnTypeId)
                .OnDelete(DeleteBehavior.Cascade);

            builder
                .HasIndex(VR => VR.ScanId);
            builder
                .HasOne(VR => VR.ScanSession)
                .WithMany(S => S.VulnResults)
                .HasForeignKey(VR => VR.ScanId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(VR => VR.CodeSnippet)
                .HasMaxLength(5000);


        }
    }
}
