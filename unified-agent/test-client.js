
const MCPClientManager = require("./mcp-client");

async function main() {
  const manager = new MCPClientManager();

  try {
    console.log("Connecting to Student MCP...\n");

    const tools = await manager.connectStdio(
      "student",
      "./student-mcp.js"
    );

    console.log("\nDiscovered Student MCP tools:");

    for (const tool of tools) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }

    console.log("\nTesting count_students equivalent...");

    const result = await manager.callTool(
      "student",
      "list_students",
      {}
    );

    console.log("\nStudent MCP response:");
    console.log(JSON.stringify(result.content, null, 2));
  } catch (error) {
    console.error("\nTest failed:", error.message);
    process.exitCode = 1;
  } finally {
    await manager.disconnectAll();
  }
}

main();
