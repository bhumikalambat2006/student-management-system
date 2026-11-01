require("dotenv").config({
  path: require("path").join(__dirname, ".env")
});

const MCPClientManager = require("./mcp-client");

async function main() {
  const manager = new MCPClientManager();

  try {
    if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
      throw new Error("GitHub token was not found in the .env file.");
    }

    console.log("GitHub token found in .env.");
    console.log("Connecting to GitHub MCP...\n");

    const tools = await manager.connectCommand(
      "github",
      ".\\github-server\\github-mcp-server.exe",
      [
        "stdio",
        "--toolsets=repos,issues,pull_requests,users"
      ]
    );

    console.log("\nGitHub MCP tools discovered:");

    for (const tool of tools) {
      console.log(`- ${tool.name}: ${tool.description || "No description"}`);
    }

    console.log(`\nTotal GitHub tools discovered: ${tools.length}`);
  } catch (error) {
    console.error("\nGitHub MCP test failed:", error.message);
    process.exitCode = 1;
  } finally {
    await manager.disconnectAll();
  }
}

main();