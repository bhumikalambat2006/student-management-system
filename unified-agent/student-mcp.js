
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
  quiet: true
});

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const server = new McpServer({
  name: "student-management-mcp",
  version: "1.0.0"
});

const API_URL = process.env.STUDENT_API_URL;

async function apiRequest(endpoint = "", method = "GET", body) {
  if (!API_URL) {
    throw new Error("STUDENT_API_URL missing in .env");
  }

  const response = await fetch(
    `${API_URL.replace(/\/$/, "")}${endpoint}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {})
    }
  );

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Backend returned invalid JSON");
  }

  if (!response.ok) {
    throw new Error(`Backend error ${response.status}: ${text}`);
  }

  return data;
}

function output(data) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(data, null, 2)
    }]
  };
}

server.registerTool(
  "list_students",
  {
    description: "List all students from MongoDB through the backend API",
    inputSchema: {}
  },
  async () => output(await apiRequest())
);

server.registerTool(
  "find_student",
  {
    description: "Find a student by custom student ID",
    inputSchema: {
      studentId: z.string()
    }
  },
  async ({ studentId }) => {
    const students = await apiRequest();

    return output(
      students.find(s => String(s.studentId) === studentId)
      || { error: "Student not found" }
    );
  }
);

server.registerTool(
  "update_student",
  {
    description: "Update a student's semester using their custom student ID",
    inputSchema: {
      studentId: z.string(),
      semester: z.number().int().min(1)
    }
  },
  async ({ studentId, semester }) => {
    const students = await apiRequest();
    const student = students.find(
      s => String(s.studentId) === studentId
    );

    if (!student) {
      return output({ error: "Student not found" });
    }

    const updated = await apiRequest(
      `/${encodeURIComponent(student._id)}`,
      "PUT",
      { semester }
    );

    return output(updated);
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
