import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import lobbySocketHandler from "./sockets/lobbySocket.js";
import gameSocketHandler from "./sockets/gameSocket.js";

import userRoutes from "./routes/userRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import authRoutes from './routes/authRoutes.js';
import refreshRoutes from './routes/refreshRoute.js';
import cookieParser from "cookie-parser";
import authMiddleware from "./middleware/authMiddleware.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// routes for user and room
app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/auth", authRoutes);
app.use("/auth", refreshRoutes);

app.get("/", (req, res) => {
  res.send("CrewOrCrook backend is running");
});

app.get("/protected", authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user});
});

// socket logic
io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  lobbySocketHandler(io, socket);
  gameSocketHandler(io, socket);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// server + database start
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/creworcrook";

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
