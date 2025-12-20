import Player from "../models/playerModel.js";
import Room from "../models/roomModel.js";

export async function assignImposter(roomId) {
  const room = await Room.findById(roomId).populate("players");

  if (!room) {
    throw new Error("Modifying Imposter -> Room not found");
  }

  if (!room.players || room.players.length < 2) {
    throw new Error("Not enough players to assign imposter");
  }

  // pick random player
  const randomIndex = Math.floor(Math.random() * room.players.length);
  const imposterPlayer = room.players[randomIndex];

  // update role
  await Player.findByIdAndUpdate(imposterPlayer._id, {
    role: "imposter",
  });

  return imposterPlayer;
}
