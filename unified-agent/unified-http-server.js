Claude

'use strict';
 
const fs = require('fs');
const path = require('path');
 
require('dotenv').config({
  path: path.join(__dirname, '.env')
});
 
const express = require('express');
 
const {
  Server
} = require('@modelcontextprotocol/sdk/server/index.js');
 
const {
  StreamableHTTPServerTransport
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
 
const {
  ListToolsRequestSchema,
  CallToolRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
 
const MCPClientManager = require('./mcp-client');
 
const app = express();
const manager = new MCPClientManager();
 
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
 
// No sign-in / no OAuth / no API key.
// Access is protected by a secret URL path instead:
//   https://unified-mcp-agent.onrender.com/mcp/<MCP_PATH_SECRET>
const MCP_PATH_SECRET = process.env.MCP_PATH_SECRET || '';
const MCP_ENDPOINT = `/mcp/${MCP_PATH_SECRET}`;
 
let httpServer;
let shuttingDown = false;
 
 
// ----------------------------------------
// CORS CONFIGURATION
// ----------------------------------------
 
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
 
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id'
  );
 
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, DELETE, OPTIONS'
  );
 
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
 
  next();
});
 
app.use(express.json({ limit: '1mb' }));
 
 
// ----------------------------------------
// HEALTH CHECK
// ----------------------------------------
 
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'unified-mcp-agent'
  });
});
 
 
// ----------------------------------------
// CREATE UNIFIED MCP SERVER
// ----------------------------------------
 
function createMCPServer() {
  const server = new Server(
    {
      name: 'unified-mcp-agent',
      version: '1.2.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );
 
  // List all available tools.
 
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
 
  // Execute requested tool.
 
  server.setRequestHandler(
    CallToolRequestSchema,
    async request => {
      const requestedName = request.params.name;
 
      const separator = requestedName.indexOf('__');
 
      if (separator === -1) {
        throw new Error('Invalid unified tool name.');
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
 
  return server;
}
 
 
// ----------------------------------------
// MCP HTTP ENDPOINT (secret path, no sign-in)
// ----------------------------------------
 
app.post(
  MCP_ENDPOINT,
  async (req, res) => {
    const server = createMCPServer();
 
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });
 
    try {
      await server.connect(transport);
 
      res.on('finish', () => {
        server.close().catch(error => {
          console.error(
            'MCP cleanup error:',
            error.message
          );
        });
      });
 
      await transport.handleRequest(
        req,
        res,
        req.body
      );
 
    } catch (error) {
      console.error(
        'MCP HTTP request failed:',
        error.message
      );
 
      if (!res.headersSent) {
        res.status(500).json({
          error: 'MCP request failed.'
        });
      }
 
      await server.close().catch(() => {});
    }
  }
);
 
 
// Stateless mode: GET and DELETE are unsupported.
 
app.get(
  MCP_ENDPOINT,
  (_req, res) => {
    res.status(405).json({
      error: 'GET is not supported in stateless mode.'
    });
  }
);
 
app.delete(
  MCP_ENDPOINT,
  (_req, res) => {
    res.status(405).json({
      error: 'DELETE is not supported in stateless mode.'
    });
  }
);
 
 
// ----------------------------------------
// GMAIL CREDENTIALS
// ----------------------------------------
 
function prepareGmailCredentials() {
  const secretDirectory = '/etc/secrets';
 
  const targetDirectory = path.join(
    __dirname,
    '.gmail-mcp'
  );
 
  const files = [
    'gcp-oauth.keys.json',
    'credentials.json'
  ];
 
  for (const file of files) {
    const source = path.join(secretDirectory, file);
 
    if (!fs.existsSync(source)) {
      throw new Error(
        `Gmail Secret File is missing: ${file}`
      );
    }
  }
 
  fs.mkdirSync(targetDirectory, {
    recursive: true,
    mode: 0o700
  });
 
  for (const file of files) {
    fs.copyFileSync(
      path.join(secretDirectory, file),
      path.join(targetDirectory, file)
    );
  }
 
  return targetDirectory;
}
 
 
// ----------------------------------------
// CONNECT ALL MCP SERVERS
// ----------------------------------------
 
async function connectAllServers() {
 
  if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    throw new Error(
      'GitHub token is missing. Set GITHUB_PERSONAL_ACCESS_TOKEN in Render Environment.'
    );
  }
 
  // Student MCP
 
  console.error('Connecting to Student MCP...');
 
  await manager.connectStdio(
    'student',
    './student-mcp.js'
  );
 
 
  // GitHub MCP
 
  console.error('Connecting to GitHub MCP...');
 
  const githubExecutable =
    process.platform === 'win32'
      ? path.join('github-server', 'github-mcp-server.exe')
      : path.join('github-server', 'github-mcp-server');
 
  await manager.connectCommand(
    'github',
    githubExecutable,
    ['stdio', '--toolsets=all']
  );
 
 
  // Gmail MCP is optional.
 
  const gmailFilesPresent =
    fs.existsSync('/etc/secrets/gcp-oauth.keys.json') &&
    fs.existsSync('/etc/secrets/credentials.json');
 
  if (!gmailFilesPresent) {
    console.error(
      'Gmail Secret Files not found; skipping Gmail MCP.'
    );
 
    return;
  }
 
  console.error('Preparing Gmail credentials...');
 
  const gmailCredentialsDirectory =
    prepareGmailCredentials();
 
  const gmailServerPath = path.join(
    __dirname,
    'node_modules',
    '@gongrzhe',
    'server-gmail-autoauth-mcp',
    'dist',
    'index.js'
  );
 
  console.error('Connecting to Gmail MCP...');
 
  await manager.connectCommand(
    'gmail',
    process.execPath,
    [gmailServerPath],
    {
      GMAIL_OAUTH_PATH: path.join(
        gmailCredentialsDirectory,
        'gcp-oauth.keys.json'
      ),
 
      GMAIL_CREDENTIALS_PATH: path.join(
        gmailCredentialsDirectory,
        'credentials.json'
      )
    }
  );
 
  console.error('Gmail MCP connected.');
}
 
 
// ----------------------------------------
// GRACEFUL SHUTDOWN
// ----------------------------------------
 
async function shutdown() {
  if (shuttingDown) return;
 
  shuttingDown = true;
 
  console.error(
    'Shutting down Unified MCP HTTP Agent...'
  );
 
  if (httpServer) {
    await new Promise(resolve => {
      httpServer.close(resolve);
    });
  }
 
  await manager.disconnectAll();
}
 
 
// ----------------------------------------
// START SERVER
// ----------------------------------------
 
async function main() {
  try {
 
    if (!MCP_PATH_SECRET || MCP_PATH_SECRET.length < 32) {
      throw new Error(
        'Set MCP_PATH_SECRET in the environment to a random value of at least 32 characters.'
      );
    }
 
    await connectAllServers();
 
    httpServer = app.listen(
      PORT,
      HOST,
      () => {
        console.error(
          `Unified MCP HTTP server listening on port ${PORT}`
        );
 
        // The secret path is intentionally not printed to the logs.
        console.error(
          'MCP endpoint is ready (secret path hidden).'
        );
      }
    );
 
  } catch (error) {
 
    console.error(
      'Unified MCP startup failed:',
      error.message
    );
 
    await manager.disconnectAll().catch(() => {});
 
    process.exitCode = 1;
  }
}
 
 
// ----------------------------------------
// PROCESS EVENTS
// ----------------------------------------
 
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
 
main();
 
