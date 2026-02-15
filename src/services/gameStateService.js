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

    tasks: {
      total: 0,
      completed: 0,
      perPlayer: {}
    },

    votes: {},

    timers: {
      meetingEndAt: 0,
      voteEndAt: 0
    },

    winner: null
  };

  for (const p of players) {
    const uid = p.userId.toString();

    state.players[uid] = {
      role: p.role,
      alive: true,
      position: { x: 0, y: 0 },

      disconnected: false,
      meetingsLeft: 1,

      cooldowns: {
        killUntil: 0,
        meetingUntil: 0
      }
    };

    state.tasks.perPlayer[uid] = 0;
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

 export async function getGameStateSafe(roomCode) {
  const raw = await redisClient.get(`game:${roomCode}`);
  if (!raw) throw new Error("Game state missing");
  return JSON.parse(raw);
}

export async function saveGameState(roomCode, state) {
  await redisClient.set(`game:${roomCode}`, JSON.stringify(state));
}

export function setTimer(state, type, durationMs) {
  const now = Date.now();
  if (!state.timers) state.timers = {};

  state.timers[type] = now + durationMs;
}

export function isTimerExpired(state, type) {
  if (!state.timers || !state.timers[type]) return false;
  return Date.now() >= state.timers[type];
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

export async function registerVote(roomCode, voterId, targetId) {
  const state = await getGameStateSafe(roomCode);

  if (state.phase !== "meeting") {
    throw new Error("Voting not allowed outside meeting");
  }

  if (!state.players[voterId]?.alive) {
    throw new Error("Dead players cannot vote");
  }

  state.votes[voterId] = targetId || "skip";

  await saveGameState(roomCode, state);
  return state.votes;
}

export function haveAllVoted(state) {
  const alivePlayers = Object.entries(state.players)
    .filter(([_, p]) => p.alive)
    .map(([id]) => id);

  return alivePlayers.every(id => state.votes[id]);
}

export function countVotes(votes) {
  const tally = {};

  for (const target of Object.values(votes)) {
    tally[target] = (tally[target] || 0) + 1;
  }

  return tally;
}

export function getVoteResult(tally) {
  let max = 0;
  let selected = null;
  let tie = false;

  for (const [playerId, count] of Object.entries(tally)) {
    if (count > max) {
      max = count;
      selected = playerId;
      tie = false;
    } else if (count === max) {
      tie = true;
    }
  }

  if (tie || selected === "skip") {
    return { type: "tie" };
  }

  return { type: "eject", playerId: selected };
}

export async function resolveVoting(roomCode) {
  const state = await getGameStateSafe(roomCode);

  const tally = countVotes(state.votes);
  const result = getVoteResult(tally);

  if (result.type === "eject") {
    const player = state.players[result.playerId];
    if (player) player.alive = false;
  }

  state.votes = {};
  state.phase = "freeplay";

  const winCheck = evaluateWinCondition(state);
  if (winCheck.ended) {
    state.phase = "ended";
    state.winner = winCheck.winner;
  }

  state.chat = [];

  await saveGameState(roomCode, state);

  return {
    result,
    winner: state.winner || null
  };
}

export async function addMeetingMessage(roomCode, userId, message) {
  const state = await getGameStateSafe(roomCode);

  if (state.phase !== "meeting") {
    throw new Error("Chat allowed only during meeting");
  }

  if (!state.players[userId] || !state.players[userId].alive) {
    throw new Error("Only alive players can chat");
  }

  const clean = String(message || "").trim();
  if (!clean) throw new Error("Empty message");
  if (clean.length > 200) throw new Error("Message too long");

  if (!state.chat) state.chat = [];

  const msg = {
    userId,
    message: clean,
    ts: Date.now()
  };

  state.chat.push(msg);

  // keep last 50 messages only
  if (state.chat.length > 50) {
    state.chat = state.chat.slice(-50);
  }

  await saveGameState(roomCode, state);
  return msg;
}

export async function getMeetingMessages(roomCode) {
  const state = await getGameStateSafe(roomCode);
  return state.chat || [];
}

export function clearMeetingChat(state) {
  state.chat = [];
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

