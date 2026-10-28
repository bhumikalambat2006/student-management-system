
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
    new URL("https://student-management-system-1-bdv2.onrender.com/mcp"),
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

   
    // Test 1: Count students
    const count = await client.callTool({
      name: "count_students",
      arguments: {}
    });

    console.log("\nTEST 1: Count Students");
    console.log(count.content);

    // Test 2: Search students
const search = await client.callTool({
  name: "search_students",
  arguments: {
    query: "402"
  }
});

console.log("Search Result:", search.content);

    // Test 3: Department statistics
    const stats = await client.callTool({
      name: "department_statistics",
      arguments: {}
    });

    console.log("\nTEST 3: Department Statistics");
    console.log(stats.content);

  } finally {
    await client.close();
  }
}

testMcp().catch(console.error);
