
require("dotenv").config({ quiet: true });

const express = require("express");
const crypto = require("crypto");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BACKEND_API_URL = (process.env.BACKEND_API_URL || "").replace(/\/+$/, "");
const MCP_API_KEY = process.env.MCP_API_KEY;

if (!BACKEND_API_URL || !MCP_API_KEY) {
  console.error("Missing BACKEND_API_URL or MCP_API_KEY");
  process.exit(1);
}

async function backendRequest(endpoint) {
  const response = await fetch(`${BACKEND_API_URL}${endpoint}`, {
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}`);
  }

  return response.json();
}

function toolResult(data) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(data, null, 2)
    }]
  };
}

function createMcpServer() {
  const server = new McpServer({
    name: "student-management-remote-mcp",
    version: "1.0.0"
  });

  server.registerTool("check_backend", {
    description: "Check whether the Student Management backend is running",
    inputSchema: {}
  }, async () => {
    try {
      const response = await fetch(BACKEND_API_URL, {
        signal: AbortSignal.timeout(30000)
      });

      return toolResult({
        reachable: response.ok,
        httpStatus: response.status
      });
    } catch (error) {
      return toolResult({
        reachable: false,
        error: error.message
      });
    }
  });

  server.registerTool("list_students", {
    description: "List all students from the Student Management API",
    inputSchema: {}
  }, async () => {
    try {
      const students = await backendRequest("/api/students");
      return toolResult(students);
    } catch (error) {
      return {
        ...toolResult({ error: error.message }),
        isError: true
      };
    }
  });

  server.registerTool("check_mongodb_connection", {
    description: "Check whether the backend can retrieve student data from MongoDB",
    inputSchema: {}
  }, async () => {
    try {
      const students = await backendRequest("/api/students");

      return toolResult({
        studentApiWorking: true,
        databaseReadWorking: true,
        studentCount: Array.isArray(students)
          ? students.length
          : null
      });
    } catch (error) {
      return {
        ...toolResult({
          databaseReadWorking: false,
          error: error.message
        }),
        isError: true
      };
    }
  });

  return server;
}

function authenticate(req, res, next) {
  const authorization = req.headers.authorization || "";
  const expected = `Bearer ${MCP_API_KEY}`;

  const providedBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}

app.get("/", (req, res) => {
  res.json({
    service: "Student Management Remote MCP",
    status: "running"
  });
});

app.post("/mcp", authenticate, async (req, res) => {
  const server = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error.message);

    if (!res.headersSent) {
      res.status(500).json({
        error: "MCP request failed"
      });
    }
  } finally {
    res.on("close", () => {
      server.close().catch(console.error);
    });
  }
});

app.get("/mcp", authenticate, (req, res) => {
  res.status(405).set("Allow", "POST").end();
});

app.delete("/mcp", authenticate, (req, res) => {
  res.status(405).set("Allow", "POST").end();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Remote MCP server running on port ${PORT}`);
});
