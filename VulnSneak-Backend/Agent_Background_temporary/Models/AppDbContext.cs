using Agent_Background_temporary.Configurations;
using Agent_Services.Models;
using Microsoft.EntityFrameworkCore;

namespace Agent_Background_temporary.Models
{
    public class AppDbContext : DbContext
    {
        public AppDbContext() { }
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public virtual DbSet<User> Users { get; set; }
        public virtual DbSet<Role> Roles { get; set; }
        public virtual DbSet<Chat> Chats { get; set; }
        public virtual DbSet<ScanSession> ScanSessions { get; set; }
        public virtual DbSet<VulnResult> VulnResults { get; set; }
        public virtual DbSet<VulnType> VulnTypes { get; set; }
        public virtual DbSet<FileReport> FileReports { get; set; }




        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            //new UserEntityTypeConfiguration().Configure(modelBuilder.Entity<User>());

            //new RoleEntityTypeConfiguration().Configure(modelBuilder.Entity<Role>());

            //new ChatEntityTypeConfiguration().Configure(modelBuilder.Entity<Chat>());

            //new ScanSessionEntityTypeConfiguration().Configure(modelBuilder.Entity<ScanSession>());

            //new VulnResultEntityTypeConfiguration().Configure(modelBuilder.Entity<VulnResult>());

            //new VulnTypeEntityTypeConfiguration().Configure(modelBuilder.Entity<VulnType>());

            //new FileReportEntityTypeConfiguration().Configure(modelBuilder.Entity<FileReport>());

            modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        }

    }
}
