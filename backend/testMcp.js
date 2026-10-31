
require("dotenv").config();

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");

const {
  StreamableHTTPClientTransport
} = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

async function testMcp() {
  const client = new Client({
    name: "student-test-client",
    version: "1.0.0"
  });

  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:5000/mcp"),
    {
      requestInit: {
        headers: {
          "x-mcp-api-key": process.env.MCP_API_KEY
        }
      }
    }
  );

  try {
    await client.connect(transport);

    console.log("MCP Connected!");

    const tools = await client.listTools();

    console.log(
      "Available Tools:",
      tools.tools.map(t => t.name)
    );

    const result = await client.callTool({
      name: "count_students",
      arguments: {}
    });

    console.log("Result:", result.content);
  } finally {
    await client.close();
  }
}

testMcp().catch(console.error);
