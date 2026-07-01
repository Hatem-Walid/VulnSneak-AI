using Agent_Services.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace Agent_Background_temporary.Configurations
{
    public class UserEntityTypeConfiguration : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> builder)
        {
            builder.ToTable("Users");

            builder
                .HasKey(U => U.Id);

            builder.Property(U => U.Id)
                .UseIdentityColumn();

            builder.Property(U => U.Fname)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(U => U.Lname)
                .HasMaxLength(50);

            builder
                .HasIndex(U => U.Email)
                .IsUnique();
            builder.Property(U => U.Email)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(U => U.Password)
                .IsRequired()
                .HasMaxLength(256);

            builder.Property(U => U.Age)
                .IsRequired();

            builder.Property(U => U.Phone)
                .HasMaxLength(20);

            builder.Property(U => U.Address)
                .HasMaxLength(200);

            builder.Property(U => U.RoleId)
                .IsRequired();

            builder
                .HasOne(U => U.Role)
                .WithMany(R => R.Users)
                .HasForeignKey(U => U.RoleId)
                .OnDelete(DeleteBehavior.Restrict);
                
            builder
                .HasMany(U => U.Chats)
                .WithOne(C =>  C.User)
                .HasForeignKey(C => C.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(U => U.CreatedAt)
                .HasDefaultValueSql("GETDATE()");

        }
    }
}
