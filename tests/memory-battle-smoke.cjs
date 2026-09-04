const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");
const sourceRoot = fs.existsSync(path.join(projectRoot, "outputs", "app.js")) ? path.join(projectRoot, "outputs") : projectRoot;
const appPath = path.join(sourceRoot, "app.js");
const stylePath = path.join(sourceRoot, "style.css");
const styleSource = fs.readFileSync(stylePath, "utf8");
assert.match(styleSource, /grid-template-rows:\s*repeat\(var\(--memory-size\),\s*minmax\(0,\s*1fr\)\)/, "memory rows must stay fixed");
assert.match(styleSource, /\.memory-card\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;/s, "memory cards must fill their fixed cells");
assert.match(styleSource, /\.memory-card-front img\s*\{[^}]*object-fit:\s*contain;/s, "memory images must stay inside the card frame");
let source = fs.readFileSync(appPath, "utf8");
source = source.replace(/^\uFEFF/, "");
source = source.replace(/^import[\s\S]*?firebase-database\.js";\s*/, "");
source = source.replace("bootApp();", "");

const elements = new Map();
function makeElement() {
  const classes = new Set();
  return {
    disabled: false,
    textContent: "",
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name)
    },
    replaceChildren(node) { this.textContent = String(node?.textContent || ""); },
    addEventListener() {}
  };
}

const appElement = makeElement();
appElement.innerHTML = "";
const toastElement = makeElement();
const localValues = new Map();
const sandbox = {
  console,
  structuredClone,
  URL,
  URLSearchParams,
  crypto: { randomUUID: () => "student-a" },
  __room: null,
  __private: null,
  localStorage: {
    getItem: (key) => localValues.get(key) || null,
    setItem: (key, value) => localValues.set(key, String(value))
  },
  document: {
    querySelector(selector) {
      if (selector === "#app") return appElement;
      if (selector === "#toast") return toastElement;
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
    querySelectorAll: () => [],
    createTextNode: (value) => ({ textContent: String(value) }),
    body: { insertAdjacentHTML() {} }
  },
  window: {
    setTimeout: (callback) => { callback(); return 1; },
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    confirm: () => true,
    open: () => null,
    location: { href: "http://localhost/" }
  },
  initializeApp: () => ({}),
  getDatabase: () => ({}),
  getStorage: () => ({}),
  ref: (_db, refPath) => refPath,
  storageRef: (_storage, refPath) => refPath,
  set: async () => {},
  get: async () => ({ exists: () => false, val: () => null }),
  onValue: () => () => {},
  onDisconnect: () => ({ set: async () => {} }),
  remove: async () => {},
  uploadBytes: async () => {},
  getDownloadURL: async () => "https://example.test/image.webp",
  deleteObject: async () => {},
  serverTimestamp: () => Date.now()
};

sandbox.update = async (target, values) => {
  if (target === undefined) {
    sandbox.__rootUpdates = structuredClone(values);
    return;
  }
  const playerMatch = String(target).match(/^rooms\/ROOM\/memoryBattle\/players\/([^/]+)$/);
  if (playerMatch) {
    const id = playerMatch[1];
    sandbox.__room.memoryBattle.players[id] = { ...sandbox.__room.memoryBattle.players[id], ...structuredClone(values) };
  }
};

sandbox.runTransaction = async (target, updater) => {
  const isPrivate = String(target).startsWith("memoryPrivate/");
  const current = structuredClone(isPrivate ? sandbox.__private : sandbox.__room);
  const next = updater(current);
  if (next === undefined) return { committed: false, snapshot: { val: () => current } };
  if (isPrivate) sandbox.__private = structuredClone(next);
  else sandbox.__room = structuredClone(next);
  return { committed: true, snapshot: { val: () => structuredClone(next) } };
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: appPath });

function evaluate(expression) {
  return vm.runInContext(expression, sandbox);
}

function syncGame(cards) {
  const now = Date.now();
  sandbox.__room = {
    mode: "memory",
    status: "memoryPlaying",
    memoryBattle: {
      settings: { boardSize: 2 },
      gameId: "memory-test",
      gameStartedAt: now - 5000,
      imageList: [
        { id: "a" },
        { id: "b" }
      ],
      participants: { "student-a": { name: "가람" } },
      players: { "student-a": { name: "가람", ready: true, completed: false, attempts: 0, matchedCount: 0 } }
    }
  };
  sandbox.__private = {
    playerId: "student-a",
    playerName: "가람",
    gameId: "memory-test",
    boardSize: 2,
    cards,
    matchedPairs: {},
    attempts: 0,
    completed: false
  };
  sandbox.__imagePayload = [
    { id: "a", dataUrl: "data:image/webp;base64,AAAA", bytes: 4, contentType: "image/webp" },
    { id: "b", dataUrl: "data:image/webp;base64,BBBB", bytes: 4, contentType: "image/webp" }
  ];
  evaluate(`
    state.room = structuredClone(__room);
    state.roomCode = "ROOM";
    state.role = "student";
    state.studentId = "student-a";
    state.studentName = "가람";
    state.memoryPlayer = structuredClone(__private);
    state.memoryImages = structuredClone(__imagePayload);
    state.memoryOpenCards = [];
    state.memoryBoardBusy = false;
    state.serverTimeOffset = 0;
  `);
}

(async () => {
for (const size of [2, 4, 6]) {
  const imageCount = evaluate(`getMemoryRequiredImageCount(${size})`);
  assert.equal(imageCount, (size * size) / 2);
  sandbox.__images = Array.from({ length: imageCount }, (_, index) => ({ id: `image_${index + 1}` }));
  const deck = JSON.parse(JSON.stringify(evaluate("createMemoryDeck(__images)")));
  assert.equal(deck.length, size * size);
  const counts = deck.reduce((result, card) => ({ ...result, [card.imageId]: (result[card.imageId] || 0) + 1 }), {});
  assert.ok(Object.values(counts).every((count) => count === 2));
  sandbox.__renderImages = Array.from({ length: imageCount }, (_, index) => ({ id: `image_${index + 1}`, url: `https://example.test/${index}.webp` }));
  sandbox.__renderPlayer = { cards: deck, matchedPairs: {} };
  evaluate(`state.room = { mode: "memory", status: "memoryPlaying", memoryBattle: { settings: { boardSize: ${size} }, imageList: __renderImages } }`);
  const boardHtml = evaluate(`renderMemoryBoard(__renderPlayer, ${size})`);
  assert.match(boardHtml, new RegExp(`memory-board-${size}`));
  assert.equal((boardHtml.match(/data-memory-card=/g) || []).length, size * size);
  const previewHtml = evaluate(`renderMemoryBoard(__renderPlayer, ${size}, { revealAll: true })`);
  assert.equal((previewHtml.match(/is-open/g) || []).length, size * size, "every preview card must show its front");
  assert.equal((previewHtml.match(/disabled/g) || []).length, size * size, "preview cards must not accept clicks");
}

sandbox.__images = Array.from({ length: 8 }, (_, index) => ({ id: `image_${index + 1}`, url: `https://example.test/${index}.webp` }));
const firstDeck = JSON.stringify(evaluate("createMemoryDeck(__images)"));
const secondDeck = JSON.stringify(evaluate("createMemoryDeck(__images)"));
assert.notEqual(firstDeck, secondDeck, "student decks should be independently shuffled");

syncGame([
  { cardId: "a1", imageId: "a" },
  { cardId: "a2", imageId: "a" },
  { cardId: "b1", imageId: "b" },
  { cardId: "b2", imageId: "b" }
]);
await evaluate("selectMemoryCard(0)");
await evaluate("selectMemoryCard(0)");
assert.equal(sandbox.__private.attempts, 0, "same card cannot be selected twice");
await evaluate("selectMemoryCard(1)");
assert.equal(sandbox.__private.attempts, 1);
assert.equal(sandbox.__private.matchedPairs.a, true);
await evaluate("selectMemoryCard(2)");
await evaluate("selectMemoryCard(3)");
assert.equal(sandbox.__private.attempts, 2);
assert.equal(sandbox.__private.completed, true);
assert.ok(sandbox.__private.completionTimeMs >= 5000);
const completedAt = sandbox.__private.completedAt;
await evaluate("selectMemoryCard(3)");
assert.equal(sandbox.__private.completedAt, completedAt, "completion is recorded once");

syncGame([
  { cardId: "a1", imageId: "a" },
  { cardId: "b1", imageId: "b" },
  { cardId: "a2", imageId: "a" },
  { cardId: "b2", imageId: "b" }
]);
sandbox.__timeouts = [];
sandbox.window.setTimeout = (callback) => { sandbox.__timeouts.push(callback); return sandbox.__timeouts.length; };
await evaluate("selectMemoryCard(0)");
await evaluate("selectMemoryCard(1)");
assert.equal(sandbox.__private.attempts, 1, "one comparison increments attempts once");
assert.deepEqual(sandbox.__private.matchedPairs, {});
await evaluate("selectMemoryCard(2)");
assert.equal(sandbox.__private.attempts, 1, "a third card is blocked while checking a pair");
sandbox.__timeouts.splice(0).forEach((callback) => callback());

sandbox.__records = {
  a: { playerId: "a", playerName: "가람", completionTimeMs: 30000, attempts: 18, achievedAt: 1, gameId: "old" }
};
sandbox.__slow = [{ playerId: "a", playerName: "가람", completionTimeMs: 32000, attempts: 10, completedAt: 2 }];
sandbox.__fast = [{ playerId: "a", playerName: "가람", completionTimeMs: 28000, attempts: 20, completedAt: 3 }];
assert.equal(evaluate("mergeMemoryBestRecords(__records, __slow, '4x4', 'slow', 2).a.completionTimeMs"), 30000);
assert.equal(evaluate("mergeMemoryBestRecords(__records, __fast, '4x4', 'fast', 3).a.completionTimeMs"), 28000);
assert.equal(evaluate("Object.keys(mergeMemoryBestRecords(__records, __fast, '4x4', 'fast', 3)).length"), 1);

evaluate(`
  state.role = "teacher";
  state.roomCode = "ROOM";
  state.room = { mode: "memory", status: "waiting", students: { "student-a": { name: "가람", connected: true, score: 0 } }, memoryBattle: getInitialMemoryBattleStateForWrite(4) };
  state.activeView = "";
  state.memorySettingsDraft = { boardSize: 4 };
  state.memoryImageDraft = [];
  renderMemoryTeacherDashboard(true);
`);
assert.match(appElement.innerHTML, /메모리 배틀/);
assert.match(appElement.innerHTML, /필요 이미지/);

syncGame([
  { cardId: "a1", imageId: "a" },
  { cardId: "a2", imageId: "a" },
  { cardId: "b1", imageId: "b" },
  { cardId: "b2", imageId: "b" }
]);
evaluate("state.activeView = ''; renderMemoryStudentGame();");
assert.equal((appElement.innerHTML.match(/data-memory-card=/g) || []).length, 4);
assert.doesNotMatch(appElement.innerHTML, /현재 1위|역대 1위/);

sandbox.__rootUpdates = null;
sandbox.__sessionImages = [{ id: "image_1" }, { id: "image_2" }];
sandbox.__sessionPayload = [
  { id: "image_1", dataUrl: "data:image/webp;base64,AAAA", bytes: 4, contentType: "image/webp" },
  { id: "image_2", dataUrl: "data:image/webp;base64,BBBB", bytes: 4, contentType: "image/webp" }
];
sandbox.__sessionStudents = [{ id: "student-a", name: "가람" }];
await evaluate("writeNewMemorySession({ gameId: 'new-game', imageSetId: 'new-images', boardSize: 2, imageList: __sessionImages, imagePayload: __sessionPayload, participants: __sessionStudents })");
assert.equal(sandbox.__rootUpdates["rooms/ROOM/memoryBattle"].imageSetId, "new-images");
assert.equal(sandbox.__rootUpdates["memoryImages/ROOM/new-images/image_1"].dataUrl, "data:image/webp;base64,AAAA");
assert.equal(sandbox.__rootUpdates["memoryPrivate/ROOM/new-game/student-a"].cards.length, 4);

console.log("memory-battle smoke tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
