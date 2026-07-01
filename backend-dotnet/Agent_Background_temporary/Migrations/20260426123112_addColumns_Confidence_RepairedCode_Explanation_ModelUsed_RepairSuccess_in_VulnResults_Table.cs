using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Agent_Background_temporary.Migrations
{
    /// <inheritdoc />
    public partial class addColumns_Confidence_RepairedCode_Explanation_ModelUsed_RepairSuccess_in_VulnResults_Table : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Confidence",
                table: "VulnResults",
                type: "float",
                nullable: true,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "Explanation",
                table: "VulnResults",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModelUsed",
                table: "VulnResults",
                type: "nvarchar(100)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RepairSuccess",
                table: "VulnResults",
                type: "bit",
                nullable: true,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "RepairedCode",
                table: "VulnResults",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ElapsedSecs",
                table: "VulnResults",
                type: "float",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "VulnTypes",
                keyColumn: "Id",
                keyValue: 1,
                column: "VulnName",
                value: "CSRF");

            migrationBuilder.UpdateData(
                table: "VulnTypes",
                keyColumn: "Id",
                keyValue: 9,
                column: "VulnName",
                value: "XSS");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Confidence",
                table: "VulnResults");

            migrationBuilder.DropColumn(
                name: "Explanation",
                table: "VulnResults");

            migrationBuilder.DropColumn(
                name: "ModelUsed",
                table: "VulnResults");

            migrationBuilder.DropColumn(
                name: "RepairSuccess",
                table: "VulnResults");

            migrationBuilder.DropColumn(
                name: "RepairedCode",
                table: "VulnResults");

            migrationBuilder.DropColumn(
                name: "ElapsedSecs",
                table: "VulnResults");

            migrationBuilder.UpdateData(
                table: "VulnTypes",
                keyColumn: "Id",
                keyValue: 1,
                column: "VulnName",
                value: "CSRF / Client-Side Attacks");

            migrationBuilder.UpdateData(
                table: "VulnTypes",
                keyColumn: "Id",
                keyValue: 9,
                column: "VulnName",
                value: "XSS Injection");

        }
    }
}
