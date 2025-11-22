import express from "express";
const router = express.Router();
import { createRoom, getRoomByCode } from "../services/roomService.js";

// POST /api/rooms
router.post("/", async (req, res) => {
  try {
    const { hostUserId, maxPlayers, imposters } = req.body;
    if (!hostUserId) {
      return res.status(400).json({ message: "hostUserId is required" });
    }

    const room = await createRoom(hostUserId, { maxPlayers, imposters });
    res.status(201).json(room);
  } catch (err) {
    console.error("createRoom error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/rooms/:code
router.get("/:code", async (req, res) => {
  try {
    const room = await getRoomByCode(req.params.code);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (err) {
    console.error("getRoomByCode error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
