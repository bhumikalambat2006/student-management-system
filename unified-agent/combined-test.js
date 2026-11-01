
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const MCPClientManager = require("./mcp-client");

async function main() {
  const manager = new MCPClientManager();

  try {
    console.log("Connecting to Student MCP...\n");

    const studentTools = await manager.connectStdio(
      "student",
      "./student-mcp.js"
    );

    console.log("\nConnecting to GitHub MCP...\n");

    const githubTools = await manager.connectCommand(
      "github",
      ".\\github-server\\github-mcp-server.exe",
      ["stdio", "--toolsets=all"]
    );

    console.log("\nConnecting to Gmail MCP...\n");

    const gmailServerPath = path.join(
      __dirname,
      "node_modules",
      "@gongrzhe",
      "server-gmail-autoauth-mcp",
      "dist",
      "index.js"
    );

    const gmailTools = await manager.connectCommand(
      "gmail",
      process.execPath,
      [gmailServerPath]
    );

    console.log("\n========== UNIFIED MCP CONNECTION ==========");

    console.log("\nStudent MCP tools:");
    studentTools.forEach(tool => console.log(`- student.${tool.name}`));

    console.log("\nGitHub MCP tools:");
    githubTools.forEach(tool => console.log(`- github.${tool.name}`));

    console.log("\nGmail MCP tools:");
    gmailTools.forEach(tool => console.log(`- gmail.${tool.name}`));

    console.log("\n========== SUMMARY ==========");
    console.log(`Student tools: ${studentTools.length}`);
    console.log(`GitHub tools: ${githubTools.length}`);
    console.log(`Gmail tools: ${gmailTools.length}`);

    console.log(
      `Total tools: ${
        studentTools.length + githubTools.length + gmailTools.length
      }`
    );

    console.log("\nAll three MCP servers are connected!");

  } catch (error) {
    console.error("\nCombined test failed:", error.message);
    process.exitCode = 1;

  } finally {
    await manager.disconnectAll();
  }
}

main();
