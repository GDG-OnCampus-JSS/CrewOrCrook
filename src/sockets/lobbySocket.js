import { getRoomByCode } from "../services/roomService.js";
import Player from "../models/playerModel.js";

export default function lobbySocketHandler(io, socket) {
  console.log("Lobby socket ready:", socket.id);

  //Join lobby socket room
  socket.on("lobby:join-room", async ({ roomCode }, callback) => {
    try {
      const userId = socket.user.id;

      if (!roomCode) {
        return callback?.({ ok: false, message: "roomCode required" });
      }

      const room = await getRoomByCode(roomCode);
      if (!room) {
        return callback?.({ ok: false, message: "Room not found" });
      }

      if (room.status !== "lobby") {
        return callback?.({ ok: false, message: "Game already started" });
      }

      const player = await Player.findOne({
        roomId: room._id,
        userId,
      });

      if (!player) {
        return callback?.({
          ok: false,
          message: "Player not registered for this room",
        });
      }

      player.socketId = socket.id;
      await player.save();

      socket.join(roomCode);

      socket.to(roomCode).emit("lobby:player-joined", {
        user: userId,
        playerId: player._id
      });

      console.log(
        `User ${userId} joined lobby ${roomCode} via socket ${socket.id}`
      );

      callback?.({ ok: true, roomCode });
    } catch (err) {
      console.error("lobby:join-room error", err);
      callback?.({ ok: false, message: "Server error" });
    }
  });

  //Handle disconnect for lobby
  socket.on("disconnect", async () => {
    try {
      await Player.findOneAndUpdate(
        { socketId: socket.id },
        { socketId: null }
      );
    } catch (err) {
      console.error("Lobby disconnect cleanup error", err);
    }
  });
}
