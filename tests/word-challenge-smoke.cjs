const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");
const sourceRoot = fs.existsSync(path.join(projectRoot, "outputs", "app.js")) ? path.join(projectRoot, "outputs") : projectRoot;
const appPath = path.join(sourceRoot, "app.js");
const rulesPath = path.join(sourceRoot, "firebase-rules.json");
let source = fs.readFileSync(appPath, "utf8").replace(/^\uFEFF/, "");
source = source.replace(/^import[\s\S]*?firebase-database\.js";\s*/, "").replace("bootApp();", "");

const database = { rooms: { ROOM: null } };
const appElement = { innerHTML: "" };
const toastElement = { textContent: "", className: "" };
const formElements = { "#wordChallengeInput": { value: "" } };

function parts(refPath) {
  return String(refPath || "").split("/").filter(Boolean);
}

function getAt(refPath) {
  return parts(refPath).reduce((value, key) => value?.[key], database);
}

function setAt(refPath, value) {
  const keys = parts(refPath);
  let parent = database;
  keys.slice(0, -1).forEach((key) => {
    if (!parent[key] || typeof parent[key] !== "object") parent[key] = {};
    parent = parent[key];
  });
  if (value === null || value === undefined) delete parent[keys.at(-1)];
  else parent[keys.at(-1)] = structuredClone(value);
}

const sandbox = {
  console,
  structuredClone,
  URL,
  URLSearchParams,
  crypto: { randomUUID: () => "student-a" },
  localStorage: { getItem: () => null, setItem() {} },
  document: {
    querySelector: (selector) => selector === "#app" ? appElement : selector === "#toast" ? toastElement : formElements[selector] || null,
    querySelectorAll: () => [],
    body: { insertAdjacentHTML() {} }
  },
  window: {
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    confirm: () => true,
    open: () => null,
    location: { href: "http://localhost/", search: "" }
  },
  initializeApp: () => ({}),
  getDatabase: () => ({}),
  ref: (_db, refPath = "") => refPath,
  serverTimestamp: () => Date.now(),
  onValue: () => () => {},
  onDisconnect: () => ({ set: async () => {} }),
  get: async (refPath) => {
    const value = getAt(refPath);
    return { exists: () => value !== undefined && value !== null, val: () => structuredClone(value) };
  },
  set: async (refPath, value) => setAt(refPath, value),
  remove: async (refPath) => setAt(refPath, null),
  update: async (refPath, values) => Object.entries(values || {}).forEach(([key, value]) => setAt([refPath, key].filter(Boolean).join("/"), value)),
  runTransaction: async (refPath, updater) => {
    const current = structuredClone(getAt(refPath));
    const next = updater(current);
    if (next === undefined) return { committed: false, snapshot: { val: () => current } };
    setAt(refPath, next);
    return { committed: true, snapshot: { val: () => structuredClone(next) } };
  }
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: appPath });
sandbox.__event = { preventDefault() {} };

function syncState(studentId, studentName, role = "student") {
  sandbox.__room = database.rooms.ROOM;
  sandbox.__studentId = studentId;
  sandbox.__studentName = studentName;
  sandbox.__role = role;
  vm.runInContext(`
    state.room = __room;
    state.roomCode = "ROOM";
    state.role = __role;
    state.studentId = __studentId;
    state.studentName = __studentName;
    state.serverTimeOffset = 0;
    state.wordChallengeSubmitting = false;
    state.wordChallengeReviewing = false;
  `, sandbox);
}

(async () => {
  assert.equal(vm.runInContext(`extractWordChosung("사과")`, sandbox), "ㅅㄱ");
  assert.equal(vm.runInContext(`extractWordChosung("수건")`, sandbox), "ㅅㄱ");
  assert.equal(vm.runInContext(`extractWordChosung("학교")`, sandbox), "ㅎㄱ");
  assert.equal(vm.runInContext(`normalizeWordChallengeWord(" 사 과 ")`, sandbox), "사과");

  database.rooms.ROOM = {
    mode: "word",
    status: "playing",
    students: {
      a: { name: "학생 A", connected: true, score: 0 },
      b: { name: "학생 B", connected: true, score: 0 }
    },
    wordChallenge: {
      settings: { chosung: "ㅅㄱ", duration: 60 },
      gameId: "word-test",
      startedAt: Date.now(),
      submissions: {},
      claims: {}
    }
  };

  formElements["#wordChallengeInput"].value = "사과";
  syncState("a", "학생 A");
  await vm.runInContext("submitWordChallengeWord(__event)", sandbox);
  assert.equal(Object.keys(database.rooms.ROOM.wordChallenge.submissions).length, 1);
  const firstSubmissionId = Object.keys(database.rooms.ROOM.wordChallenge.submissions)[0];

  syncState("b", "학생 B");
  formElements["#wordChallengeInput"].value = " 사과 ";
  await vm.runInContext("submitWordChallengeWord(__event)", sandbox);
  assert.equal(Object.keys(database.rooms.ROOM.wordChallenge.submissions).length, 1, "a room-wide claim must block duplicate words");

  syncState("teacher", "선생님", "teacher");
  await vm.runInContext(`reviewWordChallengeSubmission("${firstSubmissionId}", "rejected")`, sandbox);
  assert.equal(database.rooms.ROOM.wordChallenge.claims?.["사과"], undefined, "rejection must release the word claim");

  syncState("b", "학생 B");
  formElements["#wordChallengeInput"].value = "사과";
  await vm.runInContext("submitWordChallengeWord(__event)", sandbox);
  assert.equal(Object.keys(database.rooms.ROOM.wordChallenge.submissions).length, 2, "a rejected word must be available again");
  const secondSubmissionId = Object.keys(database.rooms.ROOM.wordChallenge.submissions).find((id) => id !== firstSubmissionId);

  syncState("teacher", "선생님", "teacher");
  await vm.runInContext(`reviewWordChallengeSubmission("${secondSubmissionId}", "approved")`, sandbox);
  syncState("b", "학생 B");
  assert.equal(vm.runInContext(`getWordChallengeRanking().find((student) => student.id === "b").wordScore`, sandbox), 1, "ranking must be derived from approved submissions");

  const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  assert.match(rules.rules.rooms.$roomCode.mode[".validate"], /word/);
  assert.match(rules.rules.rooms.$roomCode.status[".validate"], /reviewing/);
  assert.ok(rules.rules.rooms.$roomCode.wordChallenge.submissions);
  assert.match(source, /runTransaction\(ref\(db, `rooms\/\$\{state\.roomCode\}\/wordChallenge`\)/, "word claims must use one atomic transaction");

  console.log("word-challenge smoke tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
