import redisClient from "../redis/redisClient.js";

/**
 * Create initial game state in Redis
 * @param {string} roomCode
 * @param {Array<Player>} players - Mongo Player docs (with userId, role)
 */

export async function updatePlayerPosition(roomCode, userId, position) {
  const key = `game:${roomCode}`;

  const raw = await redisClient.get(key);
  if (!raw) {
    throw new Error("Game state not found");
  }

  const state = JSON.parse(raw);

  if (!state.players[userId]) {
    throw new Error("Player not found in game state");
  }

  state.players[userId].position = position;

  await redisClient.set(key, JSON.stringify(state));

  return state.players[userId];
}

export async function killPlayer(roomCode, killerUserId, victimUserId) {
  const key = `game:${roomCode}`;
  const raw = await redisClient.get(key);

  if (!raw) {
    throw new Error("Game state not found");
  }

  const state = JSON.parse(raw);

  const killer = state.players[killerUserId];
  const victim = state.players[victimUserId];

  if (!killer) {
    throw new Error("Killer not found in game state");
  }

  if (!victim) {
    throw new Error("Victim not found in game state");
  }

  if (!victim.alive) {
    throw new Error("Victim already dead");
  }

  // mark victim dead
  victim.alive = false;

  await redisClient.set(key, JSON.stringify(state));

  return {
    killerUserId,
    victimUserId,
  };
}

export async function getGameState(roomCode) {
  const raw = await redisClient.get(`game:${roomCode}`);
  return raw ? JSON.parse(raw) : null;
}

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
