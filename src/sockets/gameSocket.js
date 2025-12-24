
export default function gameSocketHandler(io, socket) {
  console.log("Game socket ready:", socket.id);

  // Player movement
  socket.on("game:move", ({ roomCode, playerId, position }) => {
    if (!roomCode || !playerId || !position) return;


    io.to(roomCode).emit("game:player-moved", {
      playerId,
      position,
    });
  });

  
  // kill logic
  socket.on("game:kill", ({ roomCode, killerId, victimId }) => {
    if (!roomCode || !killerId || !victimId) return;

   
    io.to(roomCode).emit("game:kill-event", {
      killerId,
      victimId,
    });
  });

  // meetings, votes, tasks will follow same pattern, i will do it later
}
