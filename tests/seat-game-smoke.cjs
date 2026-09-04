const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");
const sourceRoot = fs.existsSync(path.join(projectRoot, "outputs", "app.js")) ? path.join(projectRoot, "outputs") : projectRoot;
const appPath = path.join(sourceRoot, "app.js");
let source = fs.readFileSync(appPath, "utf8");
source = source.replace(/^\uFEFF/, "");
source = source.replace(/^import[\s\S]*?firebase-database\.js";\s*/, "");
source = source.replace("bootApp();", "");

const appElement = { innerHTML: "" };
const toastElement = { textContent: "", className: "" };
const storage = new Map();
const sandbox = {
  console,
  structuredClone,
  URL,
  URLSearchParams,
  __room: null,
  crypto: { randomUUID: () => "test-student-id" },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  document: {
    querySelector: (selector) => selector === "#app" ? appElement : selector === "#toast" ? toastElement : null,
    querySelectorAll: () => [],
    body: { insertAdjacentHTML: () => {} }
  },
  window: {
    devicePixelRatio: 1,
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    confirm: () => true,
    open: () => null,
    location: { href: "http://localhost/" }
  },
  initializeApp: () => ({}),
  getDatabase: () => ({}),
  getStorage: () => ({}),
  ref: (_db, refPath) => refPath,
  set: async () => {},
  update: async () => {},
  get: async () => ({ exists: () => false, val: () => null }),
  onValue: () => () => {},
  onDisconnect: () => ({ set: async () => {} }),
  remove: async () => {},
  serverTimestamp: () => Date.now()
};

sandbox.runTransaction = async (_ref, updater) => {
  const next = updater(structuredClone(sandbox.__room));
  if (next === undefined) {
    return { committed: false };
  }
  sandbox.__room = structuredClone(next);
  return { committed: true };
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: appPath });

function makeRoom({ cards, assignments = {}, status = "seatSelection", currentSelectionIndex = 0 }) {
  return {
    mode: "seat",
    status,
    students: {
      a: { name: "가람", score: 0, connected: true },
      b: { name: "나래", score: 0, connected: true },
      c: { name: "다온", score: 0, connected: true }
    },
    seatGame: {
      settings: { rows: 1, columns: 3, disabledSeats: {}, cardEnabled: true, cardPhaseSeconds: 12 },
      gameId: "seat_test",
      selectionOrder: ["a", "b", "c"],
      currentSelectionIndex,
      assignments,
      playerCards: cards,
      protectedPlayerIds: {},
      notifications: {},
      cardActionHistory: {},
      cardPhaseStartedAt: status === "cardPhase" ? Date.now() : 0,
      cardPhaseEndsAt: status === "cardPhase" ? Date.now() + 12000 : 0,
      finalRevealOrder: []
    }
  };
}

function syncState(studentId) {
  sandbox.__studentId = studentId;
  vm.runInContext(`
    state.room = structuredClone(__room);
    state.roomCode = "TEST";
    state.studentId = __studentId;
    state.studentName = state.room.students[__studentId]?.name || "";
    state.seatCardTargetMode = false;
    state.seatCardTargetSeats = [];
  `, sandbox);
}

async function call(expression) {
  await vm.runInContext(`(async () => { ${expression} })()`, sandbox);
}

function read(expression) {
  return vm.runInContext(expression, sandbox);
}

(async () => {
  sandbox.__room = makeRoom({
    cards: {
      a: { type: "protect", used: false },
      b: { type: "swap", used: false },
      c: { type: "randomSwap", used: false }
    }
  });

  syncState("a");
  await call("await confirmSeatSelection(1);");
  assert.equal(sandbox.__room.status, "cardPhase");
  assert.equal(sandbox.__room.seatGame.assignments.seat_1, "a");

  syncState("a");
  await call("await applySeatCard();");
  assert.equal(sandbox.__room.seatGame.protectedPlayerIds.a, true);
  assert.equal(sandbox.__room.seatGame.playerCards.a.used, true);

  syncState("a");
  await call("await endSeatCardPhase();");
  assert.equal(sandbox.__room.status, "seatSelection");
  assert.equal(sandbox.__room.seatGame.currentSelectionIndex, 1);

  syncState("b");
  await call("await confirmSeatSelection(2);");
  const privateGrid = read("renderSeatGrid({ game: getSeatGameState() })");
  assert.equal(privateGrid.includes("가람"), false, "owners must stay out of the seat grid before reveal");
  assert.equal(privateGrid.includes("나래"), false, "owners must stay out of the seat grid before reveal");
  syncState("b");
  vm.runInContext("state.seatCardTargetSeats = [1, 2];", sandbox);
  await call("await applySeatCard();");
  assert.equal(sandbox.__room.seatGame.playerCards.b.used, false, "protected seat must block swaps");
  assert.equal(sandbox.__room.seatGame.assignments.seat_1, "a");

  syncState("b");
  await call("await endSeatCardPhase();");
  syncState("c");
  await call("await confirmSeatSelection(3);");
  assert.equal(sandbox.__room.status, "cardPhase", "the last selection must still open one last card phase");
  syncState("c");
  await call("await applySeatCard();");
  assert.equal(sandbox.__room.seatGame.playerCards.c.used, true);
  assert.equal(sandbox.__room.seatGame.assignments.seat_1, "a", "protected owner must not move");

  syncState("c");
  await call("await applySeatCard();");
  assert.equal(Object.keys(sandbox.__room.seatGame.cardActionHistory).length, 2, "a used card cannot run twice");
  syncState("c");
  await call("await endSeatCardPhase();");
  assert.equal(sandbox.__room.status, "finalReady");
  assert.equal(sandbox.__room.seatGame.playerCards.b.used, false, "an unused card must stay unused through later phases");
  assert.equal(new Set(Object.values(sandbox.__room.seatGame.assignments)).size, 3);
  syncState("a");
  const revealedGrid = read("renderSeatGrid({ game: getSeatGameState(), reveal: true, revealAll: true })");
  assert.equal(revealedGrid.includes("가람"), true, "owners must appear in the final grid");
  assert.equal(revealedGrid.includes("나래"), true, "owners must appear in the final grid");

  await call("await revealSeatFinal();");
  assert.equal(sandbox.__room.status, "finalReveal");
  syncState("a");
  await call("await finishSeatFinalReveal();");
  assert.equal(sandbox.__room.status, "finished");
  syncState("a");
  vm.runInContext("state.role = 'student'; renderSeatStudentRoute();", sandbox);
  assert.equal(appElement.innerHTML.includes("내 최종 자리"), true);
  vm.runInContext("state.role = 'teacher'; renderSeatFinalResult('test-teacher-final', true, true);", sandbox);
  assert.equal(appElement.innerHTML.includes("같은 교실 구조로 다시 하기"), true);

  sandbox.__room = makeRoom({
    status: "cardPhase",
    assignments: { seat_1: "a" },
    cards: { a: { type: "move", used: false } }
  });
  syncState("a");
  vm.runInContext("state.seatCardTargetSeats = [2];", sandbox);
  await call("await applySeatCard();");
  assert.equal(sandbox.__room.seatGame.assignments.seat_2, "a");
  assert.equal(sandbox.__room.seatGame.assignments.seat_1, undefined);

  sandbox.__room = makeRoom({
    status: "cardPhase",
    currentSelectionIndex: 1,
    assignments: { seat_1: "a", seat_2: "b" },
    cards: { c: { type: "swap", used: false } }
  });
  syncState("c");
  vm.runInContext("state.seatCardTargetSeats = [1, 2];", sandbox);
  await call("await applySeatCard();");
  assert.equal(sandbox.__room.seatGame.assignments.seat_1, "b");
  assert.equal(sandbox.__room.seatGame.assignments.seat_2, "a");
  assert.equal(read("validateSeatAssignments(normalizeSeatGameRecord(__room.seatGame), false)"), true);

  sandbox.__room = makeRoom({ cards: {} });
  sandbox.__room.status = "waiting";
  sandbox.__room.seatGame = { settings: sandbox.__room.seatGame.settings };
  syncState("a");
  vm.runInContext("state.role = 'teacher'; state.seatSettingsDraft = null; renderSeatTeacherDashboard(true);", sandbox);
  assert.equal(appElement.innerHTML.includes("교실 자리 설정"), true);
  assert.equal(appElement.innerHTML.includes("학생으로 입장"), false);

  sandbox.__room = makeRoom({ cards: {} });
  sandbox.__room.seatGame.settings.cardEnabled = false;
  for (const [studentId, seatNumber] of [["a", 1], ["b", 2], ["c", 3]]) {
    syncState(studentId);
    await call(`await confirmSeatSelection(${seatNumber});`);
  }
  assert.equal(sandbox.__room.status, "finalReady", "card-free mode must advance directly to final ready");
  assert.equal(new Set(Object.values(sandbox.__room.seatGame.assignments)).size, 3);

  console.log("seat-game smoke tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
