import express from "express";
const router = express.Router();
import { addPlayerToRoom, createRoom, getRoomByCode } from "../services/roomService.js";
import authMiddleware from "../middleware/authMiddleware.js";

// crete a new room by host
router.post("/createNew", authMiddleware, async (req, res) => {
  try {
    const hostUserId = req.user.id;

    const { maxPlayers, imposters } = req.body;

    const room = await createRoom(hostUserId, { maxPlayers, imposters });
    res.status(201).json(room);
  } catch (err) {
    console.error("createRoom error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// lookup for existing room
router.get("/:code/lookup", async (req, res) => {
  try {
    const room = await getRoomByCode(req.params.code);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (err) {
    console.error("getRoomByCode error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// joining a room
router.post("/:code/join", authMiddleware, async (req, res) => {
  try{
    const userId = req.user.id;
    const room = await getRoomByCode(req.params.code);

    if(!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if(room.players.length >= room.maxPlayers) {
      return res.status(400).json({ message: "Room is full" });
    }

    const alreadyJoined = room.players.some(
      (p) => p.userId.toString() === userId
    );

    if(alreadyJoined) {
      return res.status(400).json({ message: "User already in room" });
    }

    const player = await addPlayerToRoom({
      roomId: room._id,
      userId,
      socketId: null
    });

    return res.status(201).json({ room, player });

  } catch (err) {
    res.status(500).json({ message: "Error joining Room"});
  }
})

export default router;
