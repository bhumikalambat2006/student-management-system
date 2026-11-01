
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const express = require("express");

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");

const {
  StreamableHTTPServerTransport
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

const {
  ListToolsRequestSchema,
  CallToolRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");

const MCPClientManager = require("./mcp-client");

const app = express();
const manager = new MCPClientManager();

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const API_KEY = process.env.UNIFIED_MCP_API_KEY;

let httpServer;
let shuttingDown = false;

app.use(express.json({ limit: "1mb" }));

// Create the unified MCP server.
function createMCPServer() {
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

  // Discover tools from all connected MCP servers.
  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => {
      const tools = manager.getAvailableTools();

      return {
        tools: tools.map(tool => ({
          name: `${tool.server}__${tool.name}`,
          description: `[${tool.server}] ${tool.description}`,
          inputSchema: tool.inputSchema
        }))
      };
    }
  );

  // Route tool calls to the correct MCP server.
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

      const availableTool = manager.getAvailableTools().find(
        tool =>
          tool.server === serverName &&
          tool.name === toolName
      );

      if (!availableTool) {
        throw new Error(
          `Tool "${requestedName}" is not available.`
        );
      }

      console.error(`Executing ${serverName}.${toolName}`);

      return manager.callTool(
        serverName,
        toolName,
        request.params.arguments || {}
      );
    }
  );

  return server;
}

// Protect the MCP endpoint with a private API key.
function authenticate(req, res, next) {
  const authorization = req.headers.authorization || "";

  const suppliedKey = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  const expected = Buffer.from(API_KEY || "");
  const supplied = Buffer.from(suppliedKey);

  if (
    expected.length !== supplied.length ||
    !crypto.timingSafeEqual(expected, supplied)
  ) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}

// Health-check endpoint.
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "unified-mcp-agent"
  });
});

// MCP endpoint: stateless Streamable HTTP.
app.post("/mcp", authenticate, async (req, res) => {
  const server = createMCPServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  try {
    await server.connect(transport);

    res.on("finish", () => {
      server.close().catch(error => {
        console.error("MCP cleanup error:", error.message);
      });
    });

    await transport.handleRequest(req, res, req.body);

  } catch (error) {
    console.error("MCP HTTP request failed:", error.message);

    if (!res.headersSent) {
      res.status(500).json({
        error: "MCP request failed"
      });
    }

    await server.close().catch(() => {});
  }
});

// Stateless mode does not support GET or DELETE.
app.get("/mcp", authenticate, (req, res) => {
  res.status(405).json({
    error: "GET is not supported in stateless mode."
  });
});

app.delete("/mcp", authenticate, (req, res) => {
  res.status(405).json({
    error: "DELETE is not supported in stateless mode."
  });
});

// Copy and verify Gmail OAuth files.
function prepareGmailCredentials() {
  const secretDirectory = "/etc/secrets";
  const targetDirectory = path.join(__dirname, ".gmail-mcp");

  const files = [
    "gcp-oauth.keys.json",
    "credentials.json"
  ];

  // Check that Render Secret Files exist.
  for (const file of files) {
    const source = path.join(secretDirectory, file);

    if (!fs.existsSync(source)) {
      throw new Error(
        `Gmail Secret File is missing: ${file}`
      );
    }
  }

  // Create a writable directory for Gmail credentials.
  fs.mkdirSync(targetDirectory, {
    recursive: true,
    mode: 0o700
  });

  // Copy files into the writable directory.
  for (const file of files) {
    const source = path.join(secretDirectory, file);
    const destination = path.join(targetDirectory, file);

    fs.copyFileSync(source, destination);

    if (!fs.existsSync(destination)) {
      throw new Error(
        `Gmail credential copy failed: ${file}`
      );
    }

    console.error(`Gmail file copied successfully: ${file}`);
  }

  return targetDirectory;
}

// Connect all three internal MCP servers.
async function connectAllServers() {
  if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    throw new Error("GitHub token is missing.");
  }

  console.error("Connecting to Student MCP...");

  await manager.connectStdio(
    "student",
    "./student-mcp.js"
  );

  console.error("Connecting to GitHub MCP...");

  const githubExecutable =
    process.platform === "win32"
      ? path.join("github-server", "github-mcp-server.exe")
      : path.join("github-server", "github-mcp-server");

  await manager.connectCommand(
    "github",
    githubExecutable,
    ["stdio", "--toolsets=all"]
  );

  console.error("Preparing Gmail OAuth files...");

  const gmailCredentialsDirectory = prepareGmailCredentials();

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
    [gmailServerPath],
    {
      GMAIL_OAUTH_PATH: path.join(
        gmailCredentialsDirectory,
        "gcp-oauth.keys.json"
      ),
      GMAIL_CREDENTIALS_PATH: path.join(
        gmailCredentialsDirectory,
        "credentials.json"
      )
    }
  );

  console.error("All three MCP servers connected.");
}

// Graceful shutdown.
async function shutdown() {
  if (shuttingDown) return;

  shuttingDown = true;

  console.error("Shutting down Unified MCP HTTP Agent...");

  if (httpServer) {
    await new Promise(resolve => {
      httpServer.close(resolve);
    });
  }

  await manager.disconnectAll();
}

// Start the HTTP server.
async function main() {
  try {
    if (!API_KEY || API_KEY.length < 32) {
      throw new Error(
        "UNIFIED_MCP_API_KEY must contain at least 32 characters."
      );
    }

    await connectAllServers();

    httpServer = app.listen(PORT, HOST, () => {
      console.error(
        `Unified MCP HTTP server listening on port ${PORT}`
      );

      console.error(
        `MCP endpoint: http://localhost:${PORT}/mcp`
      );
    });

  } catch (error) {
    console.error(
      "Unified MCP startup failed:",
      error.message
    );

    await manager.disconnectAll();

    process.exitCode = 1;
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main();
