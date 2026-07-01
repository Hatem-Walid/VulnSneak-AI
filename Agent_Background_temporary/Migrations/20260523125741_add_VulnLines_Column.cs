using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Agent_Background_temporary.Migrations
{
    /// <inheritdoc />
    public partial class add_VulnLines_Column : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "VulnLinesJson",
                table: "VulnResults",
                type: "nvarchar(50)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "VulnLinesJson",
                table: "VulnResults");
        }
    }
}
