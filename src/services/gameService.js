// This is where i will add game logic
// kill, report, task completion, meeting, voting

async function handlePlayerMove({ playerId, position }) {
  //update player position in database
  console.log("handlePlayerMove called", playerId, position);
}

async function handleKillEvent({ killerId, victimId, roomId }) {
  // victim dead, emit update
  console.log("handleKillEvent", killerId, victimId, roomId);
}

export default {
  handlePlayerMove,
  handleKillEvent,
};
