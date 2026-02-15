import Room from "../models/roomModel.js";
import Player from "../models/playerModel.js";
import { assignImposter } from "../utils/assignImposter.js";
import {
  deleteGameState,
  setPhase,
  getPhase,
  initGameState,
  updatePlayerPosition,
  killPlayer,
  registerVote,
  resolveVoting,
  getGameStateSafe,
  haveAllVoted,
  addMeetingMessage,
  getMeetingMessages
} from "../services/gameStateService.js";


export default function gameSocketHandler(io, socket) {
  console.log("Game socket ready:", socket.id);

  // Player movement
  socket.on("game:move", async (payload) => {
    try {
      const { roomCode, position } = payload || {};
      const userId = socket.user.id;

      if (!roomCode || !position) {
        console.error("some fields are missing while socket: move action");
        return;
      }

      await updatePlayerPosition(roomCode, userId, position);

      io.to(roomCode).emit("game:player-moved", {
        userId,
        position,
      });
    } catch (err) {
      console.error("game:move error:", err.message);
    }
  });

  // kill logic
  socket.on("game:kill", async (payload) => {
    try {
      const { roomCode, victimId } = payload || {};
      const killerId = socket.user.id;

      if (!roomCode || !victimId) {
        console.error("some fields are missing while socket kill event");
        return;
      }

      const result = await killPlayer(roomCode, killerId, victimId);

      io.to(roomCode).emit("game:kill-event", {
        killerId,
        victimId,
      });

      if (result?.ended) {
        io.to(roomCode).emit("game:ended", {
          winner: result.winner,
        });

        // CLEANUP
        await deleteGameState(roomCode);
        await Room.findOneAndUpdate(
          { code: roomCode },
          { status: "ended" }
        );
      }


    } catch (err) {
      console.error("game:kill error:", err.message);
    }
  });

  // meetings, votes, tasks will follow same pattern, i will do it later

  // HOST STARTS GAME
  socket.on("game:start", async ({ roomCode }, callback) => {
    try {
      const userId = socket.user.id;

      if (!roomCode) {
        return callback?.({ ok: false, message: "roomCode required" });
      }

      const room = await Room.findOne({ code: roomCode });
      if (!room) {
        return callback?.({ ok: false, message: "Room not found" });
      }

      if (room.gameState !== "lobby") {
        return callback?.({ ok: false, message: "Game already started" });
      }

      if (room.host.toString() !== userId) {
        return callback?.({ ok: false, message: "Only host can start the game" });
      }

      const players = await Player.find({ roomId: room._id });
      if (players.length < 2) {
        return callback?.({ ok: false, message: "Not enough players" });
      }

      await assignImposter(room._id);

      room.gameState = "started";
      await room.save();

      const updatedPlayers = await Player.find({ roomId: room._id });
      await initGameState(roomCode, updatedPlayers);

      io.to(roomCode).emit("game:started");

      for (const p of updatedPlayers) {
        if (p.socketId) {
          io.to(p.socketId).emit("game:role", {
            role: p.role,
          });
        }
      }

      callback?.({ ok: true });
    } catch (err) {
      console.error("game:start error", err);
      callback?.({ ok: false, message: "Server error" });
    }
  });

  // REPORT BODY
  socket.on("game:report-body", async ({ roomCode }, callback) => {
    try {
      if (!roomCode) return callback?.({ ok: false, message: "roomCode required" });

      const phase = await getPhase(roomCode);
      if (phase !== "freeplay") {
        return callback?.({ ok: false, message: "Meeting not allowed now" });
      }

      await setPhase(roomCode, "meeting");

      io.to(roomCode).emit("game:meeting-started");
      callback?.({ ok: true });
    } catch (err) {
      console.error("game:report-body error", err);
      callback?.({ ok: false, message: "Server error" });
    }
  });

  // EMERGENCY MEETING
  socket.on("game:emergency-meeting", async ({ roomCode }, callback) => {
    try {
      if (!roomCode) return callback?.({ ok: false, message: "roomCode required" });

      const phase = await getPhase(roomCode);
      if (phase !== "freeplay") {
        return callback?.({ ok: false, message: "Meeting not allowed now" });
      }

      await setPhase(roomCode, "meeting");

      io.to(roomCode).emit("game:meeting-started");
      callback?.({ ok: true });
    } catch (err) {
      console.error("game:emergency-meeting error", err);
      callback?.({ ok: false, message: "Server error" });
    }
  });

// VOTE
socket.on("game:vote", async ({ roomCode, targetId }, callback) => {
  try {
    const voterId = socket.user.id;

    if (!roomCode) {
      return callback?.({ ok: false, message: "roomCode required" });
    }

    await registerVote(roomCode, voterId, targetId);

    const state = await getGameStateSafe(roomCode);

    io.to(roomCode).emit("game:vote-update", {
      voterId,
      targetId
    });

    // Auto resolve if all voted
    if (haveAllVoted(state)) {
      const result = await resolveVoting(roomCode);

      io.to(roomCode).emit("game:vote-result", result);

      if (result.winner) {
        io.to(roomCode).emit("game:ended", {
          winner: result.winner
        });
      } else {
        io.to(roomCode).emit("game:freeplay-resumed");
      }
    }

    callback?.({ ok: true });
  } catch (err) {
    console.error("game:vote error", err);
    callback?.({ ok: false, message: err.message });
  }
});

// HOST FORCE RESOLVE VOTES
socket.on("game:resolve-votes", async ({ roomCode }, callback) => {
  try {
    if (!roomCode) {
      return callback?.({ ok: false, message: "roomCode required" });
    }

    const result = await resolveVoting(roomCode);

    io.to(roomCode).emit("game:vote-result", result);

    if (result.winner) {
      io.to(roomCode).emit("game:ended", {
        winner: result.winner
      });
    } else {
      io.to(roomCode).emit("game:freeplay-resumed");
    }

    callback?.({ ok: true });
  } catch (err) {
    console.error("resolve-votes error", err);
    callback?.({ ok: false, message: err.message });
  }
});

// MEETING CHAT
socket.on("game:chat", async ({ roomCode, message }, callback) => {
  try {
    const userId = socket.user.id;

    if (!roomCode) {
      return callback?.({ ok: false, message: "roomCode required" });
    }

    // ensure socket is actually in the room
    if (!socket.rooms.has(roomCode)) {
      return callback?.({ ok: false, message: "Not in this room" });
    }

    const msg = await addMeetingMessage(roomCode, userId, message);

    io.to(roomCode).emit("game:chat-message", msg);

    callback?.({ ok: true });
  } catch (err) {
    console.error("game:chat error", err.message);
    callback?.({ ok: false, message: err.message });
  }
});

socket.on("game:chat-history", async ({ roomCode }, callback) => {
  try {
    if (!roomCode) {
      return callback?.({ ok: false, message: "roomCode required" });
    }

    const history = await getMeetingMessages(roomCode);
    callback?.({ ok: true, history });
  } catch (err) {
    console.error("chat-history error", err.message);
    callback?.({ ok: false, message: err.message });
  }
});

}