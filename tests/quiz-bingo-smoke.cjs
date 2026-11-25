const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");
const sourceRoot = fs.existsSync(path.join(projectRoot, "outputs", "app.js")) ? path.join(projectRoot, "outputs") : projectRoot;
const appPath = path.join(sourceRoot, "app.js");
const stylePath = path.join(sourceRoot, "style.css");
const rulesPath = path.join(sourceRoot, "firebase-rules.json");
let source = fs.readFileSync(appPath, "utf8").replace(/^\uFEFF/, "");
source = source.replace(/^import[\s\S]*?firebase-database\.js";\s*/, "").replace("bootApp();", "");

const database = { rooms: { ROOM: null } };
const storage = new Map();
const appElement = { innerHTML: "" };
const toastElement = { textContent: "", className: "" };
const formElements = {};

function parts(refPath) {
  return String(refPath || "").split("/").filter(Boolean);
}

function getAt(refPath) {
  return parts(refPath).reduce((value, key) => value?.[key], database);
}

function setAt(refPath, value) {
  const keys = parts(refPath);
  if (!keys.length) return;
  let parent = database;
  keys.slice(0, -1).forEach((key) => {
    if (!parent[key] || typeof parent[key] !== "object") parent[key] = {};
    parent = parent[key];
  });
  const key = keys[keys.length - 1];
  if (value === null || value === undefined) delete parent[key];
  else parent[key] = structuredClone(value);
}

const sandbox = {
  console,
  structuredClone,
  URL,
  URLSearchParams,
  crypto: { randomUUID: () => "student-a" },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value))
  },
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
  update: async (refPath, values) => {
    Object.entries(values || {}).forEach(([key, value]) => setAt([refPath, key].filter(Boolean).join("/"), value));
  },
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
vm.runInContext("renderStudentQuiz = () => {}; renderStudentWaiting = () => {}; openDisplayWindow = () => null;", sandbox);

function useRoom(room) {
  database.rooms.ROOM = room;
  sandbox.__room = room;
  vm.runInContext(`
    state.room = __room;
    state.roomCode = "ROOM";
    state.role = "student";
    state.studentId = "student-a";
    state.studentName = "학생 A";
    state.answering = false;
  `, sandbox);
}

(async () => {
  const now = Date.now();
  useRoom({
    mode: "quiz",
    status: "playing",
    currentQuestionIndex: 0,
    questionStartedAt: now - 2000,
    timeLimit: 20,
    students: { "student-a": { name: "학생 A", score: 0, connected: true } },
    questions: {
      q1: { type: "short", authorName: "학생 B", authorKey: "student_b", question: "비유 표현은?", correctAnswer: "은유 법", createdAt: 1 }
    },
    answers: {}
  });

  assert.equal(vm.runInContext(`normalizeShortAnswer(" 은유법 ") === normalizeShortAnswer("은유 법")`, sandbox), true);
  await vm.runInContext(`submitAnswer(null, "은유법")`, sandbox);
  assert.equal(database.rooms.ROOM.answers.q1["student-a"].isCorrect, true);
  assert.equal(database.rooms.ROOM.answers.q1["student-a"].textAnswer, "은유법");
  assert.ok(database.rooms.ROOM.students["student-a"].score >= 500);

  database.rooms.ROOM.status = "waiting";
  formElements["#authorName"] = { value: "학생 A" };
  formElements["#questionText"] = { value: "내가 좋아하는 표현은?" };
  formElements["input[name='questionType']:checked"] = { value: "short" };
  formElements["input[name='correctIndex']:checked"] = null;
  formElements["#correctAnswer"] = { value: "직유법" };
  formElements["#editingQuestionId"] = { value: "" };
  for (let index = 0; index < 4; index += 1) formElements[`#choice${index}`] = { value: "" };
  sandbox.__submitEvent = { preventDefault() {} };
  await vm.runInContext("submitQuestion(__submitEvent)", sandbox);
  const submittedQuestion = Object.values(database.rooms.ROOM.questions).find((question) => question.question === "내가 좋아하는 표현은?");
  assert.equal(submittedQuestion.type, "short");
  assert.equal(submittedQuestion.correctAnswer, "직유법");
  assert.equal(submittedQuestion.choices, undefined, "short-answer questions must not require four choices");

  const cells = Array.from({ length: 9 }, (_, index) => `개념 ${index + 1}`);
  useRoom({
    mode: "bingo",
    status: "waiting",
    students: {
      "student-a": { name: "학생 A", score: 0, connected: true },
      "student-b": { name: "학생 B", score: 0, connected: true }
    },
    bingo: {
      settings: { size: 3 },
      boards: {
        "student-a": { studentId: "student-a", name: "학생 A", size: 3, cells, marks: {} },
        "student-b": { studentId: "student-b", name: "학생 B", size: 3, cells: cells.map((cell) => `${cell}B`), marks: {} }
      }
    }
  });

  await vm.runInContext("startBingoGame()", sandbox);
  assert.equal(database.rooms.ROOM.status, "bingoPlaying");
  assert.equal(database.rooms.ROOM.bingo.turnOrder.length, 2);

  database.rooms.ROOM.bingo.boards["student-a"].marks = { 0: true, 1: true, 2: true, 3: true, 6: true };
  assert.equal(vm.runInContext(`countBingoLines(getMyBingoBoard())`, sandbox), 2, "one row and one column should count as two bingo lines");
  database.rooms.ROOM.bingo.currentCall = { callId: "call-1", studentId: "student-b", name: "학생 B", concept: "은유", explanation: "대상을 다른 대상에 빗대어 표현합니다.", approvedAt: Date.now() };
  await vm.runInContext("toggleBingoCell(4)", sandbox);
  assert.equal(database.rooms.ROOM.bingo.boards["student-a"].marks[4], true, "students can freely mark after teacher approval");
  database.rooms.ROOM.bingo.winners = { "student-a": { name: "학생 A", rank: 1, lineCount: 2 } };
  await vm.runInContext(`teacherUnmarkBingoCell("student-a", 4)`, sandbox);
  assert.equal(database.rooms.ROOM.bingo.boards["student-a"].marks[4], undefined, "teachers can cancel an incorrect mark");
  assert.equal(database.rooms.ROOM.bingo.winners["student-a"], undefined, "teacher correction must revoke an earlier bingo approval");

  const resetBingo = vm.runInContext("getBingoResetStatePreservingBoards()", sandbox);
  assert.equal(resetBingo.boards["student-a"].cells.length, 9, "game reset must preserve submitted bingo boards");
  assert.equal(resetBingo.boards["student-a"].marks, null, "game reset must clear coloring");

  const preview = vm.runInContext(`renderBingoBoard(getMyBingoBoard(), { teacher: true })`, sandbox);
  assert.match(preview, /개념 1/);
  assert.match(preview, /data-bingo-teacher-unmark/);

  const css = fs.readFileSync(stylePath, "utf8");
  assert.match(css, /\.mode-options\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s, "home game modes must use three columns for nine games");
  assert.equal(vm.runInContext("PLAYGROUND_MODE_MARKS.length", sandbox), 9, "the home screen must expose nine game modes");
  const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  assert.match(rules.rules.rooms.$roomCode.mode[".validate"], /bingo/);
  assert.match(rules.rules.rooms.$roomCode.status[".validate"], /bingoPlaying/);
  assert.match(rules.rules.rooms.$roomCode.mode[".validate"], /word/);

  console.log("quiz and bingo smoke tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
