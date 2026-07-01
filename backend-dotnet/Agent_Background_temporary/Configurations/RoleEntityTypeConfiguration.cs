using Agent_Services.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace Agent_Background_temporary.Configurations
{
    public class RoleEntityTypeConfiguration : IEntityTypeConfiguration<Role>
    {
        public void Configure(EntityTypeBuilder<Role> builder)
        {
            builder.ToTable("Roles");

            builder
                .HasKey(R => R.Id);

            builder.Property(R => R.Id)
                .UseIdentityColumn();

            builder.Property(R => R.RoleName)
                    .HasMaxLength(15);

            // Concept Data Seeding
            builder
                .HasData(
                new Role { Id = 1, RoleName = "Admin" },
                new Role { Id = 2, RoleName = "Manager"},
                new Role { Id = 3, RoleName = "User"}
                );

            builder
                .HasMany(R => R.Users)
                .WithOne(U => U.Role)
                .HasForeignKey(U => U.RoleId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
