const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const lobbySocketHandler = require("./sockets/lobbySocket");
const gameSocketHandler = require("./sockets/gameSocket");

const userRoutes = require("./routes/userRoutes");
const roomRoutes = require("./routes/roomRoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// milldleware
app.use(cors());
app.use(express.json());

// routes fofr user and room
app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);

app.get("/", (req, res) => {
  res.send("CrewOrCrook backend is running");
});

// socket logics
io.on("connection", (socket) => {
  console.log("🔌 New socket connected:", socket.id);

  lobbySocketHandler(io, socket);
  gameSocketHandler(io, socket);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// server and database starting
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/creworcrook";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
  });
