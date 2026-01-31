import redisClient from "../redis/redisClient.js";

const gameKey = (roomCode) => `game:${roomCode}`;

export async function getPhase(roomCode) {
  const raw = await redisClient.get(gameKey(roomCode));
  if (!raw) throw new Error("Game state not found");
  return JSON.parse(raw).phase;
}

export async function setPhase(roomCode, nextPhase) {
  const raw = await redisClient.get(gameKey(roomCode));
  if (!raw) throw new Error("Game state not found");

  const state = JSON.parse(raw);
  state.phase = nextPhase;

  await redisClient.set(gameKey(roomCode), JSON.stringify(state));
  return state.phase;
}


//Update player position (GUARDED)
export async function updatePlayerPosition(roomCode, userId, position) {
  const key = `game:${roomCode}`;

  const raw = await redisClient.get(key);
  if (!raw) {
    throw new Error("Game state not found");
  }

  const state = JSON.parse(raw);

  if (state.phase !== "freeplay") {
    throw new Error("Movement not allowed in current phase");
  }

  const player = state.players[userId];
  if (!player) {
    throw new Error("Player not found in game state");
  }

  if (!player.alive) {
    throw new Error("Dead player cannot move");
  }

  player.position = position;

  await redisClient.set(key, JSON.stringify(state));

  return player;
}

// Kill player (GUARDED)
export async function killPlayer(roomCode, killerUserId, victimUserId) {
  const key = `game:${roomCode}`;
  const raw = await redisClient.get(key);

  if (!raw) {
    throw new Error("Game state not found");
  }

  const state = JSON.parse(raw);

  if (state.phase !== "freeplay") {
    throw new Error("Kill not allowed in current phase");
  }

  const killer = state.players[killerUserId];
  const victim = state.players[victimUserId];

  if (!killer) {
    throw new Error("Killer not found in game state");
  }

  if (!victim) {
    throw new Error("Victim not found in game state");
  }

  if (!killer.alive) {
    throw new Error("Dead player cannot kill");
  }

  if (killer.role !== "imposter") {
    throw new Error("Only imposter can kill");
  }

  if (!victim.alive) {
    throw new Error("Victim already dead");
  }

  // mark victim dead
  victim.alive = false;

  const result = evaluateWinCondition(state);

  if (result.ended) {
    state.phase = "ended";
    state.winner = result.winner;

    await redisClient.set(key, JSON.stringify(state));

    return {
      ended: true,
      winner: result.winner,
    };
  }


  await redisClient.set(key, JSON.stringify(state));

  return {
    killerUserId,
    victimUserId,
  };
}

//Initialize game state 
export async function initGameState(roomCode, players) {
  const state = {
    status: "started",
    phase: "freeplay",
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
    JSON.stringify(state),
    { EX: 60 * 60 } // 1 hour
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

export function evaluateWinCondition(state) {
  let aliveCrew = 0;
  let aliveImposters = 0;

  for (const player of Object.values(state.players)) {
    if (!player.alive) continue;

    if (player.role === "imposter") {
      aliveImposters++;
    } else {
      aliveCrew++;
    }
  }

  if (aliveImposters === 0) {
    return { ended: true, winner: "crewmates" };
  }

  if (aliveImposters >= aliveCrew) {
    return { ended: true, winner: "imposters" };
  }

  return { ended: false };
}

export async function endGame(roomCode, winner) {
  const key = `game:${roomCode}`;
  const raw = await redisClient.get(key);

  if (!raw) throw new Error("Game state not found");

  const state = JSON.parse(raw);

  state.phase = "ended";
  state.winner = winner;

  await redisClient.set(key, JSON.stringify(state));
  return state;
}
