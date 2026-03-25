using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Agent_Background_temporary.Migrations
{
    /// <inheritdoc />
    public partial class intial_VulnResult_and_VulnType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VulnTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VulnName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Severity = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VulnTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VulnResults",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VulnTypeId = table.Column<int>(type: "int", nullable: false),
                    ScanId = table.Column<int>(type: "int", nullable: false),
                    StartLine = table.Column<int>(type: "int", nullable: false),
                    EndLine = table.Column<int>(type: "int", nullable: false),
                    CodeSnippet = table.Column<string>(type: "nvarchar(max)", maxLength: 5000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VulnResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VulnResults_ScanSessions_ScanId",
                        column: x => x.ScanId,
                        principalTable: "ScanSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VulnResults_VulnTypes_VulnTypeId",
                        column: x => x.VulnTypeId,
                        principalTable: "VulnTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "VulnTypes",
                columns: new[] { "Id", "Description", "Severity", "VulnName" },
                values: new object[,]
                {
                    { 1, "CSRF (Cross-Site Request Forgery) is a vulnerability where an attacker tricks a victim’s browser into sending unintended requests using the victim’s existing session or credentials.", 3, "CSRF / Client-Side Attacks" },
                    { 2, "Insecure Cryptography means using weak, outdated, or misconfigured cryptographic algorithms, keys, or protocols, which can let attackers read or tamper with sensitive data.", 3, "Insecure Cryptography" },
                    { 3, "Insecure Deserialization happens when the application deserializes untrusted data, allowing attackers to manipulate objects or even execute arbitrary code.", 4, "Insecure Deserialization" },
                    { 4, "OS Command Injection occurs when user input is passed unsafely into system commands, allowing attackers to execute arbitrary OS commands on the server.", 4, "OS Command Injection" },
                    { 5, "Path Traversal (Directory Traversal) lets attackers manipulate file paths (e.g., using ../) to access files outside the intended directory, such as system or configuration files.", 2, "Path Traversal" },
                    { 6, "SQL Injection (SQLi) allows an attacker to inject or modify SQL queries, often leading to unauthorized access, modification, or deletion of data in the database.", 4, "SQL Injection" },
                    { 7, "Safe: The analyzed code does not appear to contain any of the tracked vulnerability types based on the model’s prediction.", 1, "Safe" },
                    { 8, "XML Injection is when attackers inject or modify XML content or structure so that the application processes unexpected data or behavior.", 3, "XML Injection" },
                    { 9, "Cross-Site Scripting (XSS) is an injection flaw where attackers inject malicious scripts (usually JavaScript) into web pages viewed by others, leading to session theft, content tampering, or other client-side attacks.", 3, "XSS Injection" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_VulnResults_ScanId",
                table: "VulnResults",
                column: "ScanId");

            migrationBuilder.CreateIndex(
                name: "IX_VulnResults_VulnTypeId",
                table: "VulnResults",
                column: "VulnTypeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VulnResults");

            migrationBuilder.DropTable(
                name: "VulnTypes");
        }
    }
}
