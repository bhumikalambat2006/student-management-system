
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const Student = require("../models/Student");

function createMcpServer() {
  const server = new McpServer({
    name: "student-management-mcp",
    version: "1.0.0"
  });

  // Tool 1: Count all students
  server.registerTool(
    "count_students",
    {
      description: "Count total students",
      inputSchema: {}
    },
    async () => {
      const count = await Student.countDocuments();

      return {
        content: [{
          type: "text",
          text: `Total Students: ${count}`
        }]
      };
    }
  );

  // Tool 2: Search students
  server.registerTool(
    "search_students",
    {
      description: "Search students by name or student ID",
      inputSchema: {
        query: z.string()
      }
    },
    async ({ query }) => {
      const students = await Student.find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { studentId: { $regex: query, $options: "i" } }
        ]
      })
        .select("studentId name department semester -_id")
        .limit(20)
        .lean();

      return {
        content: [{
          type: "text",
          text: JSON.stringify(students)
        }]
      };
    }
  );

  // Tool 3: Department statistics
  server.registerTool(
    "department_statistics",
    {
      description: "Get student count by department",
      inputSchema: {}
    },
    async () => {
      const stats = await Student.aggregate([
        {
          $group: {
            _id: "$department",
            total: { $sum: 1 }
          }
        }
      ]);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(stats)
        }]
      };
    }
  );

  return server;
}

module.exports = { createMcpServer };
