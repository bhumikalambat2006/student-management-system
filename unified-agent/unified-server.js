
require("dotenv").config({
  path: require("path").join(__dirname, ".env")
});

const path = require("path");
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport
} = require("@modelcontextprotocol/sdk/server/stdio.js");

const {
  ListToolsRequestSchema,
  CallToolRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");

const MCPClientManager = require("./mcp-client");

const server = new Server(
  {
    name: "unified-mcp-agent",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const manager = new MCPClientManager();

let isShuttingDown = false;

async function connectAllServers() {
  if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    throw new Error("GitHub token is missing from the .env file.");
  }

  console.error("Connecting to Student MCP...");

  await manager.connectStdio(
    "student",
    "./student-mcp.js"
  );

  console.error("Connecting to GitHub MCP...");

  await manager.connectCommand(
    "github",
    path.join("github-server", "github-mcp-server.exe"),
    ["stdio", "--toolsets=all"]
  );

  console.error("Connecting to Gmail MCP...");

  const gmailServerPath = path.join(
    __dirname,
    "node_modules",
    "@gongrzhe",
    "server-gmail-autoauth-mcp",
    "dist",
    "index.js"
  );

  await manager.connectCommand(
    "gmail",
    process.execPath,
    [gmailServerPath]
  );

  console.error("All three MCP servers connected.");
}

server.setRequestHandler(
  ListToolsRequestSchema,
  async () => {
    const tools = manager.getAvailableTools();

    return {
      tools: tools.map(tool => ({
        name: `${tool.server}__${tool.name}`,
        description:
          `[${tool.server}] ${tool.description}`,
        inputSchema: tool.inputSchema
      }))
    };
  }
);

server.setRequestHandler(
  CallToolRequestSchema,
  async request => {
    const requestedName = request.params.name;
    const separator = requestedName.indexOf("__");

    if (separator === -1) {
      throw new Error("Invalid unified tool name.");
    }

    const serverName = requestedName.slice(0, separator);
    const toolName = requestedName.slice(separator + 2);

    const availableTool = manager
      .getAvailableTools()
      .find(
        tool =>
          tool.server === serverName &&
          tool.name === toolName
      );

    if (!availableTool) {
      throw new Error(
        `Tool "${requestedName}" is not available.`
      );
    }

    console.error(
      `Executing ${serverName}.${toolName}`
    );

    return manager.callTool(
      serverName,
      toolName,
      request.params.arguments || {}
    );
  }
);

async function shutdown() {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.error("Shutting down Unified MCP Agent...");

  await manager.disconnectAll();

  await server.close();
}

async function main() {
  try {
    await connectAllServers();

    const transport = new StdioServerTransport();

    await server.connect(transport);

    console.error("Unified MCP Agent is ready for Claude.");
  } catch (error) {
    console.error(
      "Unified MCP Agent startup failed:",
      error.message
    );

    await manager.disconnectAll();
    process.exitCode = 1;
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main();
