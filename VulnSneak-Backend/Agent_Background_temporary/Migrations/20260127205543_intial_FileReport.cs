using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Agent_Background_temporary.Migrations
{
    /// <inheritdoc />
    public partial class intial_FileReport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FileReports",
                columns: table => new
                {
                    ScanId = table.Column<int>(type: "int", nullable: false),
                    FileReportName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    FileReportPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FileReports", x => x.ScanId);
                    table.ForeignKey(
                        name: "FK_FileReports_ScanSessions_ScanId",
                        column: x => x.ScanId,
                        principalTable: "ScanSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FileReports");
        }
    }
}
