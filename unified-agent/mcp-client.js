const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport
} = require("@modelcontextprotocol/sdk/client/stdio.js");

const path = require("path");

class MCPClientManager {
  constructor() {
    this.clients = new Map();
    this.tools = new Map();
  }

  async connectCommand(name, command, args = [], extraEnv = {}) {
    if (this.clients.has(name)) {
      throw new Error(`MCP server "${name}" is already connected`);
    }

    const client = new Client({
      name: "unified-mcp-agent",
      version: "1.0.0"
    });

    const transport = new StdioClientTransport({
      command: path.resolve(__dirname, command),
      args,
      env: {
        ...process.env,
        ...extraEnv,
        PATH: process.env.PATH || ""
      }
    });

    try {
      await client.connect(transport);

      const result = await client.listTools();

      this.clients.set(name, { client, transport });

      for (const tool of result.tools) {
        this.tools.set(`${name}.${tool.name}`, {
          server: name,
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema
        });
      }
console.error(
  `Connected to ${name}: ${result.tools.length} tools discovered`
);
      return result.tools;
    } catch (error) {
      await transport.close().catch(() => {});
      throw error;
    }
  }

  async connectStdio(name, serverFile) {
    return this.connectCommand(
      name,
      process.execPath,
      [path.resolve(__dirname, serverFile)]
    );
  }

  async callTool(serverName, toolName, args = {}) {
    const connection = this.clients.get(serverName);

    if (!connection) {
      throw new Error(`MCP server "${serverName}" is not connected`);
    }

    const result = await connection.client.callTool({
      name: toolName,
      arguments: args
    });

    if (result.isError) {
      throw new Error(
        result.content?.map(item => item.text || "").join("\n")
        || "MCP tool execution failed"
      );
    }

    return result;
  }

  getAvailableTools() {
    return Array.from(this.tools.values());
  }

  async disconnectAll() {
    for (const [name, connection] of this.clients) {
      try {
        await connection.client.close();
     console.error(`Disconnected from ${name}`);
      } catch (error) {
        console.error(`Error disconnecting from ${name}:`, error.message);
      }
    }

    this.clients.clear();
    this.tools.clear();
  }
}

module.exports = MCPClientManager;