using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Agent_Background_temporary.Migrations
{
    /// <inheritdoc />
    public partial class AddColumn_ChatFolder_in_Chat_Table : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ChatFolderPath",
                table: "Chats",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ChatFolderPath",
                table: "Chats");
        }
    }
}
