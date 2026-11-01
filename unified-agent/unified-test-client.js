
require("dotenv").config({
  path: require("path").join(__dirname, ".env")
});

const path = require("path");

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport
} = require("@modelcontextprotocol/sdk/client/stdio.js");

async function main() {
  const client = new Client({
    name: "unified-agent-test",
    version: "1.0.0"
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, "unified-server.js")],
    env: {
      ...process.env,
      PATH: process.env.PATH || ""
    }
  });

  try {
    console.log("Starting Unified MCP Agent test...\n");

    await client.connect(transport);

    console.log("Connected to Unified MCP Agent!");

    const result = await client.listTools();

    console.log(`\nTotal exposed tools: ${result.tools.length}`);

    for (const prefix of ["student__", "github__", "gmail__"]) {
      const count = result.tools.filter(
        tool => tool.name.startsWith(prefix)
      ).length;

      console.log(`${prefix}: ${count} tools`);
    }

    const tests = [
      "student__list_students",
      "github__get_me",
      "gmail__list_email_labels"
    ];

    console.log("\nTesting tool routing...\n");

    for (const toolName of tests) {
      const tool = result.tools.find(
        item => item.name === toolName
      );

      if (!tool) {
        throw new Error(`Tool not exposed: ${toolName}`);
      }

      const response = await client.callTool({
        name: toolName,
        arguments: {}
      });

      if (response.isError) {
        throw new Error(`Tool failed: ${toolName}`);
      }

      console.log(`SUCCESS: ${toolName}`);
    }

    console.log("\nAll unified MCP tests passed!");

  } catch (error) {
    console.error("\nTest failed:", error.message);
    process.exitCode = 1;

  } finally {
    await client.close();
    await transport.close().catch(() => {});
  }
}

main();
