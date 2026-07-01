using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agent_Background_temporary.Configurations
{
    public class ChatEntityTypeConfiguration: IEntityTypeConfiguration<Chat>
    {
        public void Configure(EntityTypeBuilder<Chat> builder)
        {
            builder.ToTable("Chats");

            builder
                .HasKey(C => C.Id);

            builder.Property(C => C.Id)
                .UseIdentityColumn();

            builder.Property(C => C.ChatName)
                .IsRequired()
                .HasMaxLength(150);

            builder.Property(C => C.ChatFolderPath)
                .IsRequired()
                .HasMaxLength(500);
            
            builder
                .HasIndex(C => C.UserId);

            builder
                .HasOne(C => C.User)
                .WithMany(U => U.Chats)
                .HasForeignKey(C => C.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder
                .HasMany(C => C.ScanSessions)
                .WithOne(S => S.Chat)
                .HasForeignKey(S => S.ChatId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(C => C.CreatedAt)
                   .HasDefaultValueSql("GETDATE()");
        }
    }
}
