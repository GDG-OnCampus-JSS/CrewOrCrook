export default function gameSocketHandler(io, socket) {
  console.log("Game socket ready:", socket.id);

  // Player movement
  socket.on("game:move", (payload) => {
    try {
      const { roomCode, playerId, position } = payload || {};

      if (!roomCode || !playerId || !position) {
        console.error("some fields are missing while socket: move action")
        return;
      }

      io.to(roomCode).emit("game:player-moved", {
        playerId,
        position,
      });
    } catch (err) {
      console.error("game:move error:", err);
    }
  });

  
  // kill logic
  socket.on("game:kill", (payload) => {
    try {
      const { roomCode, killerId, victimId } = payload || {};

      if (!roomCode || !killerId || !victimId) {
        console.error("some fields are missing while socket kill event")
        return;
      };

      io.to(roomCode).emit("game:kill-event", {
        killerId,
        victimId,
      });
    } catch (err) {
      console.error("game:kill error:", err);
    }
  });

  // meetings, votes, tasks will follow same pattern, i will do it later
}
