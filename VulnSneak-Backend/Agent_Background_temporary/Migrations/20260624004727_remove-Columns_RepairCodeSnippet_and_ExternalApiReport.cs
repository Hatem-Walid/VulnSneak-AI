using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Agent_Background_temporary.Migrations
{
    /// <inheritdoc />
    public partial class removeColumns_RepairCodeSnippet_and_ExternalApiReport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExternalApiReport",
                table: "VulnResults");

            migrationBuilder.DropColumn(
                name: "RepairCodeSnippet",
                table: "VulnResults");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalApiReport",
                table: "VulnResults",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RepairCodeSnippet",
                table: "VulnResults",
                type: "nvarchar(max)",
                nullable: true);
        }
    }
}
