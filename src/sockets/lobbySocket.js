const Room = require("../models/roomModel");
const { addPlayerToRoom, getRoomByCode } = require("../services/roomService");

// lobby event handling
module.exports = function lobbySocket(io, socket) {
  console.log("Lobby socket ready for:", socket.id);

  // room creation
  socket.on("lobby:create-room", async (payload, callback) => {
    try {
      const { hostUserId, maxPlayers, imposters } = payload || {};
      if (!hostUserId) return callback?.({ ok: false, message: "hostUserId required" });

      const room = await require("../services/roomService").createRoom(
        hostUserId,
        { maxPlayers, imposters }
      );

      callback?.({ ok: true, room });

    } catch (err) {
      console.error("lobby:create-room error", err);
      callback?.({ ok: false, message: "server error" });
    }
  });

  // adding in room
  socket.on("lobby:join-room", async (payload, callback) => {
    try {
      const { roomCode, userId } = payload || {};
      if (!roomCode || !userId) {
        return callback?.({ ok: false, message: "roomCode and userId required" });
      }

      const room = await getRoomByCode(roomCode);
      if (!room) return callback?.({ ok: false, message: "Room not found" });

      if (room.players.length >= room.maxPlayers) {
        return callback?.({ ok: false, message: "Room full" });
      }

      const player = await addPlayerToRoom({
        roomId: room._id,
        userId,
        socketId: socket.id,
      });

      socket.join(room.code);

      io.to(room.code).emit("room:player-joined", {
        roomCode: room.code,
        playerId: player._id,
        userId: player.userId,
      });

      callback?.({ ok: true, roomCode: room.code, player });

    } catch (err) {
      console.error("lobby:join-room error", err);
      callback?.({ ok: false, message: "server error" });
    }
  });

  // more logic will be added later or you can contribute too sir
};
