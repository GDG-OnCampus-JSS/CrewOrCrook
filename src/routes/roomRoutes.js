import express from "express";
const router = express.Router();
import { createRoom, getRoomByCode } from "../services/roomService.js";

//crete a new room by host
router.post("/createNew", async (req, res) => {
  try {
    if (!req.body) {
    return res.status(400).json({ error: "Request body missing" });
    }

    const { hostUserId, maxPlayers, imposters } = req.body;
    if (!hostUserId) {
      console.log("HostId is missing");
      return res.status(400).json({ message: "hostUserId is required" });
    }

    const room = await createRoom(hostUserId, { maxPlayers, imposters });
    res.status(201).json(room);
  } catch (err) {
    console.error("createRoom error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

//join existing room
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
