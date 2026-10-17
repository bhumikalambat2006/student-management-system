
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();


const studentRoutes = require("./routes/studentRoutes");

// NEW: MCP route
const mcpRoutes = require("./mcp/mcpRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.send("Student Management Backend Running Successfully!");
});

// Student CRUD routes
app.use("/api/students", studentRoutes);

const PORT = process.env.PORT || 5000;

// NEW: MCP endpoint
app.use("/mcp", mcpRoutes);

// MongoDB Atlas Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB Connected Successfully!");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB Connection Error:", error.message);
  });
