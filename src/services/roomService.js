import Room from"../models/roomModel.js";
import Player from "../models/playerModel.js";
import generateRoomCode from "../utils/helper.js";
import { assignImposter } from "../utils/assignImposter.js";

//creating new room
export async function createRoom(hostUserId) {
  const code = generateRoomCode();
  const room = await Room.create({
    code,
    host: hostUserId,
    /*maxPlayers: options.maxPlayers || 6,
    imposters: options.imposters || 1,*/
  });
  return room;
}


//join player
export async function getRoomByCode(code) {
  return Room.findOne({ code }).populate("players");
}


//join player
export async function addPlayerToRoom({ room, userId, socketId, role = "crewmate" }) {


  const player = await Player.create({
    roomId: room._id,
    userId,
    socketId,
    role,
  });

  await Room.findByIdAndUpdate(room._id, {
    $addToSet: { players: player._id },
  });

  return player;
}
