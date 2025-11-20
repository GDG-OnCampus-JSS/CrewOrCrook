const { handlePlayerMove, handleKillEvent } = require("../services/gameService");

//in-game events 
module.exports = function gameSocket(io, socket) {
  console.log("Game socket ready for:", socket.id);

  socket.on("game:move", async (payload) => {
    try {
      await handlePlayerMove(payload);
      if (!payload?.roomCode) return;
      io.to(payload.roomCode).emit("game:player-moved", {
        playerId: payload.playerId,
        position: payload.position,
      });
    } catch (err) {
      console.error("game:move error", err);
    }
  });

  socket.on("game:kill", async (payload) => {
    try {
      await handleKillEvent(payload);
      if (!payload?.roomCode) return;
      io.to(payload.roomCode).emit("game:kill-event", payload);
    } catch (err) {
      console.error("game:kill error", err);
    }
  });

  // report body, meetings, vote, tasks
};
