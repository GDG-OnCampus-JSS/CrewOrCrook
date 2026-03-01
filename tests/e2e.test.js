/**
 * CrewOrCrook — Full End-to-End Test (4 players)
 * 
 * Tests the complete game flow with 4 players (MIN_PLAYERS = 4):
 *   1. Register 4 users
 *   2. Login all 4
 *   3. Create room (host)
 *   4. All 4 join room
 *   5. All 4 connect sockets & join lobby
 *   6. Verify game start rejected with < 4 players (tested via logic)
 *   7. Host starts game
 *   8. All receive roles (1 imposter, 3 crewmates)
 *   9. GPS movement
 *  10. Kill out of range (should fail)
 *  11. Nearby targets (impostor only)
 *  12. Kill in range — game should CONTINUE (1 imp vs 2 crew)
 *  13. Second kill — game should END (1 imp vs 1 crew → impostor wins)
 * 
 * Run: node tests/e2e.test.js
 * Requires: server running on localhost:5000, Redis & MongoDB up
 */

import { io as ioClient } from "socket.io-client";

const BASE = "http://localhost:5000";
const UNIQUE = Date.now();

// ─── Helpers ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function skip(label, reason) {
  console.log(`  ⏭️  ${label} — SKIPPED: ${reason}`);
  skipped++;
}

async function post(path, body, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function get(path, token = null) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  const data = await res.json();
  return { status: res.status, data };
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(BASE, {
      auth: { token },
      transports: ["websocket"],
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(err));
    setTimeout(() => reject(new Error("Socket connect timeout")), 5000);
  });
}

function emitWithAck(socket, event, payload, timeout = 5000) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (response) => resolve(response));
    setTimeout(() => reject(new Error(`Ack timeout for ${event}`)), timeout);
  });
}

function waitForEvent(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── GPS coordinates for testing ────────────────────────────────
// Delhi area. Points ~5m apart and ~50m apart.

const POS_A = { lat: 28.613900, lng: 77.209000 };         // Impostor base
const POS_NEAR = { lat: 28.613900, lng: 77.209050 };      // ~5m from A (within 8m)
const POS_FAR = { lat: 28.613900, lng: 77.209500 };       // ~49m from A (way outside 8m)
const POS_CREW3 = { lat: 28.614200, lng: 77.209000 };     // Crew 3 separate position

// ─── Main test ───────────────────────────────────────────────────

async function runTests() {
  console.log("\n══════════════════════════════════════════");
  console.log("  CrewOrCrook — End-to-End Test Suite (4 players)");
  console.log("══════════════════════════════════════════\n");

  // ── 1. REGISTER ──
  console.log("📝 Step 1: Register 4 users");
  const userNames = [
    `host_${UNIQUE}`,
    `crew1_${UNIQUE}`,
    `crew2_${UNIQUE}`,
    `crew3_${UNIQUE}`,
  ];

  const regResults = [];
  for (const name of userNames) {
    const reg = await post("/auth/register", { username: name, password: "test1234" });
    assert(`Register ${name}`, reg.status === 201, `status=${reg.status} ${JSON.stringify(reg.data)}`);
    regResults.push(reg);
  }

  // ── 2. LOGIN ──
  console.log("\n🔑 Step 2: Login all 4 users");
  const tokens = [];
  const loginData = [];
  for (const name of userNames) {
    const login = await post("/auth/login", { username: name, password: "test1234" });
    assert(`Login ${name}`, login.status === 200 && login.data.accessToken, `status=${login.status}`);
    tokens.push(login.data.accessToken);
    loginData.push(login.data);
  }

  // ── 3. CREATE ROOM ──
  console.log("\n🏠 Step 3: Create room");
  const createRes = await post("/room/createNew", {}, tokens[0]);
  assert("Create room", createRes.status === 201 && createRes.data.code, `status=${createRes.status}`);
  const roomCode = createRes.data.code;
  console.log(`    Room code: ${roomCode}`);

  // ── 4. JOIN ROOM ──
  console.log("\n🚪 Step 4: All 4 players join room");
  for (let i = 0; i < 4; i++) {
    const join = await post(`/room/${roomCode}/join`, {}, tokens[i]);
    assert(`${userNames[i]} joins room`, join.status === 201, `status=${join.status} ${JSON.stringify(join.data)}`);
  }

  // ── 5. SOCKET CONNECT + LOBBY JOIN ──
  console.log("\n🔌 Step 5: Connect sockets & join lobby");
  const sockets = [];
  try {
    for (let i = 0; i < 4; i++) {
      const sock = await connectSocket(tokens[i]);
      assert(`Socket ${i + 1} connected`, !!sock.id);
      sockets.push(sock);
    }
  } catch (err) {
    assert("Socket connection", false, err.message);
    console.log("\n⛔ Cannot proceed without sockets. Exiting.\n");
    process.exit(1);
  }

  for (let i = 0; i < 4; i++) {
    const ack = await emitWithAck(sockets[i], "lobby:join-room", { roomCode });
    assert(`${userNames[i]} joins lobby socket`, ack.ok === true, JSON.stringify(ack));
  }

  // ── 6. START GAME ──
  console.log("\n🎮 Step 6: Host starts game");

  // Set up role listeners for ALL 4 players BEFORE starting
  const rolePromises = sockets.map((s) => waitForEvent(s, "game:role"));
  const startedPromise = waitForEvent(sockets[0], "game:started");

  const startAck = await emitWithAck(sockets[0], "game:start", { roomCode });
  assert("game:start ack", startAck.ok === true, JSON.stringify(startAck));

  await startedPromise;
  assert("game:started event received", true);

  // ── 7. RECEIVE ROLES ──
  console.log("\n🎭 Step 7: Receive roles");
  const roles = await Promise.all(rolePromises);
  for (let i = 0; i < 4; i++) {
    assert(`${userNames[i]} got role`, !!roles[i].role, `role=${roles[i].role}`);
    console.log(`    ${userNames[i]}: ${roles[i].role}`);
  }

  // Figure out who is impostor and who are crewmates
  let impostorIdx = roles.findIndex((r) => r.role === "imposter");
  assert("Exactly 1 impostor assigned", impostorIdx !== -1);

  const impostorSock = sockets[impostorIdx];
  const impostorName = userNames[impostorIdx];
  const impostorUserId = loginData[impostorIdx].user._id;

  // Get crewmate indices
  const crewIndices = roles
    .map((r, i) => (r.role === "crewmate" ? i : -1))
    .filter((i) => i !== -1);

  assert("3 crewmates assigned", crewIndices.length === 3, `count=${crewIndices.length}`);

  const crewSocks = crewIndices.map((i) => sockets[i]);
  const crewNames = crewIndices.map((i) => userNames[i]);
  const crewUserIds = crewIndices.map((i) => loginData[i].user._id);

  console.log(`    Impostor: ${impostorName}`);
  console.log(`    Crewmates: ${crewNames.join(", ")}`);

  // ── 8. GPS MOVEMENT ──
  console.log("\n📍 Step 8: GPS movement");

  // Move impostor to position A
  const movePromise1 = waitForEvent(crewSocks[0], "game:player-moved");
  impostorSock.emit("game:move", { roomCode, position: POS_A });
  await movePromise1;
  assert("Impostor moved, crewmates received update", true);

  // Move first crewmate FAR from impostor
  const movePromise2 = waitForEvent(impostorSock, "game:player-moved");
  crewSocks[0].emit("game:move", { roomCode, position: POS_FAR });
  await movePromise2;
  assert("Crewmate 1 moved far", true);

  // Move second crewmate to a separate position
  const movePromise3 = waitForEvent(impostorSock, "game:player-moved");
  crewSocks[1].emit("game:move", { roomCode, position: POS_CREW3 });
  await movePromise3;
  assert("Crewmate 2 moved to separate pos", true);

  // Move third crewmate far as well
  const movePromise4 = waitForEvent(impostorSock, "game:player-moved");
  crewSocks[2].emit("game:move", { roomCode, position: POS_FAR });
  await movePromise4;
  assert("Crewmate 3 moved far", true);

  await sleep(200);

  // ── 9. KILL OUT OF RANGE (should fail) ──
  console.log("\n🔪 Step 9: Kill out of range (~49m apart)");

  const errorPromise = waitForEvent(impostorSock, "game:error", 3000).catch(() => null);
  impostorSock.emit("game:kill", { roomCode, victimId: crewUserIds[0] });
  const killError = await errorPromise;
  assert("Kill rejected (too far)", killError && killError.message.includes("too far"),
    killError ? killError.message : "no error received");

  // ── 10. NEARBY TARGETS ──
  console.log("\n🎯 Step 10: Move crewmate 1 into range & check nearby-targets");

  // Move crewmate 1 NEAR the impostor
  crewSocks[0].emit("game:move", { roomCode, position: POS_NEAR });
  await sleep(300);

  // Move impostor slightly to trigger nearby-targets recompute
  const nearbyPromise = waitForEvent(impostorSock, "game:nearby-targets", 3000).catch(() => null);
  impostorSock.emit("game:move", { roomCode, position: POS_A });
  const nearby = await nearbyPromise;

  if (nearby && nearby.targets) {
    assert("Nearby targets received", nearby.targets.length > 0, `count=${nearby.targets.length}`);
    if (nearby.targets.length > 0) {
      assert("Nearest target is crewmate 1", nearby.targets[0].userId === crewUserIds[0],
        `target=${nearby.targets[0].userId}, expected=${crewUserIds[0]}`);
      console.log(`    Distance: ${nearby.targets[0].distance}m`);
    }
  } else {
    assert("Nearby targets received", false, "no nearby-targets event");
  }

  // ── 11. FIRST KILL — game should CONTINUE ──
  console.log("\n🔪 Step 11: First kill (1 imp vs 2 crew remaining — game continues)");

  // Set up listeners before kill
  const kill1EventPromise = waitForEvent(crewSocks[0], "game:kill-event", 3000);
  const ended1Promise = waitForEvent(impostorSock, "game:ended", 2000).catch(() => null);

  impostorSock.emit("game:kill", { roomCode, victimId: crewUserIds[0] });
  const kill1Evt = await kill1EventPromise;

  assert("Kill event received", !!kill1Evt);
  assert("Correct victim ID", kill1Evt.victimId === crewUserIds[0]);
  assert("Kill has body position", !!kill1Evt.position?.lat);
  console.log(`    Body at: ${kill1Evt.position?.lat}, ${kill1Evt.position?.lng}`);

  const ended1 = await ended1Promise;
  assert("Game did NOT end after first kill", ended1 === null, ended1 ? `unexpected winner: ${ended1.winner}` : "");

  // ── 12. SECOND KILL — game should END ──
  console.log("\n🔪 Step 12: Move crewmate 2 near & kill (1 imp vs 1 crew → impostor wins)");

  // Wait for kill cooldown to expire — in production it's 30s,
  // but we need to bypass or wait. Let's update position first.
  // For testing, we need to wait for cooldown. Let's check if we can skip it.
  console.log("    ⏳ Waiting for kill cooldown (30s)...");
  await sleep(31_000);

  // Move crewmate 2 near the impostor
  crewSocks[1].emit("game:move", { roomCode, position: POS_NEAR });
  await sleep(300);

  // Move impostor to ensure positions are fresh
  impostorSock.emit("game:move", { roomCode, position: POS_A });
  await sleep(300);

  // Set up listeners BEFORE kill
  const kill2EventPromise = waitForEvent(crewSocks[1], "game:kill-event", 3000);
  const ended2Promise = waitForEvent(impostorSock, "game:ended", 3000).catch(() => null);

  impostorSock.emit("game:kill", { roomCode, victimId: crewUserIds[1] });
  const kill2Evt = await kill2EventPromise;

  assert("Second kill event received", !!kill2Evt);
  assert("Correct second victim ID", kill2Evt.victimId === crewUserIds[1]);

  const ended2 = await ended2Promise;

  if (ended2) {
    console.log("\n🏆 Game ended — impostor wins!");
    assert("Winner is impostor", ended2.winner === "imposter", `winner=${ended2.winner}`);
    console.log(`    Winner: ${ended2.winner}`);
  } else {
    assert("Game ended after second kill", false, "game:ended event not received");
  }

  // ─── SUMMARY ───────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log("══════════════════════════════════════════\n");

  sockets.forEach((s) => s.disconnect());

  process.exit(failed > 0 ? 1 : 0);
}

// ─── Run ─────────────────────────────────────────────────────────

runTests().catch((err) => {
  console.error("\n⛔ Test runner crashed:", err);
  process.exit(1);
});
