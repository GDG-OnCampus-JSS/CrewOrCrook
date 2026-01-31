import express from "express";
const router = express.Router();
import { addPlayerToRoom, createRoom, getRoomByCode } from "../services/roomService.js";
import authMiddleware from "../middleware/authMiddleware.js";

// crete a new room by host
router.post("/createNew", authMiddleware, async (req, res) => {
  try {
    console.log("trying...");
    const hostUserId = req.user.id;

    const room = await createRoom(hostUserId);
    res.status(201).json(room);
  } catch (err) {
    console.error("createRoom error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// lookup for existing room
router.get("/:code/lookup", async (req, res) => {
  try {
    const code = req.params.code;

    if(!code) return res.status(404).json({ message: "Code not found" });

    const room = await getRoomByCode(code);

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

    if (room.gameState !== "lobby") {
      return res.status(400).json({ message: "Game already started" });
    }


    if(room.players.length >= room.maxPlayers) {
      return res.status(409).json({ message: "Room is full" });
    }


    const alreadyJoined = room.players.some(
      (p) => p.userId.toString() === userId
    );

    if(alreadyJoined) {
      return res.status(400).json({ message: "User already in room" });
    }

    const player = await addPlayerToRoom({
      room,
      userId,
      socketId: null
    });

    return res.status(201).json({ room, player });

  } catch (err) {
    res.status(500).json({ message: "Error joining Room"});
  }
})

export default router;
