const Room = require("../models/roomModel");
const Player = require("../models/playerModel");
const { generateRoomCode } = require("../utils/helper");

async function createRoom(hostUserId, options = {}) {
  const code = generateRoomCode();
  const room = await Room.create({
    code,
    host: hostUserId,
    maxPlayers: options.maxPlayers || 10,
    imposters: options.imposters || 1,
  });
  return room;
}

async function getRoomByCode(code) {
  return Room.findOne({ code }).populate("players");
}

async function addPlayerToRoom({ roomId, userId, socketId, role = "crewmate" }) {
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

module.exports = {
  createRoom,
  getRoomByCode,
  addPlayerToRoom,
};
