
const path = require("path");
const fs = require("fs");
const MCPClientManager = require("./mcp-client");

async function main() {
  const manager = new MCPClientManager();

  try {
    const gmailServerPath = path.join(
      __dirname,
      "node_modules",
      "@gongrzhe",
      "server-gmail-autoauth-mcp",
      "dist",
      "index.js"
    );

    if (!fs.existsSync(gmailServerPath)) {
      throw new Error("Gmail MCP server file was not found.");
    }

    console.log("Connecting to Gmail MCP...\n");

    const tools = await manager.connectCommand(
      "gmail",
      process.execPath,
      [gmailServerPath]
    );

    console.log("\nGmail MCP tools discovered:");

    for (const tool of tools) {
      console.log(`- gmail.${tool.name}`);
    }

    console.log(`\nTotal Gmail tools: ${tools.length}`);
    console.log("\nGmail MCP connection successful!");

  } catch (error) {
    console.error("\nGmail MCP test failed:", error.message);
    process.exitCode = 1;

  } finally {
    await manager.disconnectAll();
  }
}

main();
