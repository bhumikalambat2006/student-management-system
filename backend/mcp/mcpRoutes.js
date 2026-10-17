
const express = require("express");
const crypto = require("node:crypto");

const {
  StreamableHTTPServerTransport
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

const { createMcpServer } = require("./mcpServer");

const router = express.Router();

router.post("/", async (req, res) => {
  // Protect MCP tools with a secret API key
  const expectedKey = process.env.MCP_API_KEY;
  const suppliedKey = req.get("x-mcp-api-key");

  if (!expectedKey || !suppliedKey) {
    return res.status(401).json({
      error: "MCP authentication required"
    });
  }

  const a = Buffer.from(suppliedKey);
  const b = Buffer.from(expectedKey);

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  const mcpServer = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.once("finish", () => {
    transport.close().catch(console.error);
    mcpServer.close().catch(console.error);
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP Error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "MCP request failed"
      });
    }
  }
});

router.get("/", (req, res) => {
  res.status(405).json({
    error: "Use MCP POST requests"
  });
});

router.delete("/", (req, res) => {
  res.status(405).json({
    error: "Stateless MCP endpoint"
  });
});

module.exports = router;
