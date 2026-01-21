import redisClient from "../redis/redisClient.js";

/**
 * Create initial game state in Redis
 * @param {string} roomCode
 * @param {Array<Player>} players - Mongo Player docs (with userId, role)
 */
export async function initGameState(roomCode, players) {
  const state = {
    status: "started",
    players: {},
  };

  for (const p of players) {
    state.players[p.userId.toString()] = {
      role: p.role,
      alive: true,
      position: { x: 0, y: 0 },
    };
  }

  await redisClient.set(
    `game:${roomCode}`,
    JSON.stringify(state)
  );

  return state;
}

export async function getGameState(roomCode) {
  const raw = await redisClient.get(`game:${roomCode}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteGameState(roomCode) {
  await redisClient.del(`game:${roomCode}`);
}
