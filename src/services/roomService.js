import Room from"../models/roomModel.js";
import Player from "../models/playerModel.js";
import generateRoomCode from "../utils/helper.js";

export async function createRoom(hostUserId, options = {}) {
  const code = generateRoomCode();
  const room = await Room.create({
    code,
    host: hostUserId,
    maxPlayers: options.maxPlayers || 10,
    imposters: options.imposters || 1,
  });
  return room;
}

export async function getRoomByCode(code) {
  return Room.findOne({ code }).populate("players");
}

export async function addPlayerToRoom({ roomId, userId, socketId, role = "crewmate" }) {
  const player = await Player.create({
    roomId,
    userId,
    socketId,
    role,
  });

  await Room.findByIdAndUpdate(roomId, {
    $addToSet: { players: player._id },
  });

  return player;
}
