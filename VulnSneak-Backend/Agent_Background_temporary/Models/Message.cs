using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Agent_Services.Models
{
    [Table("Messages")]
    public class Message
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int MessageID { get; set; }

        [MaxLength(30)]
        public string? Status { get; set; }

        [Column("VulnerabilityName")]
        [MaxLength(100)]
        public string? Vulnerability_name { get; set; }

        [MaxLength(50)]
        public string? Label { get; set; }

        [MaxLength(500)]
        public string? Comment { get; set; }

        [Required]
        [MaxLength(255)]
        public string FileName { get; set; } = null!;

        [Required]
        [MaxLength(100)]
        public string ContentType { get; set; } = null!;

        [MaxLength(500)]
        public string? FilePath { get; set; }

        // Foreign Key
        [Required]
        public int UserID { get; set; }

        // Navigation Property
        [ForeignKey(nameof(UserID))]
        public User User { get; set; } = null!;
    }
}
