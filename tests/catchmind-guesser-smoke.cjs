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

let renderCount = 0;
let catchmindMounted = false;
let canvasDrawCount = 0;
const listeners = {};

const context2d = {
  setTransform() {},
  clearRect() { canvasDrawCount += 1; },
  fillRect() {},
  save() {},
  restore() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {}
};

const canvas = {
  dataset: {},
  width: 0,
  height: 0,
  clientWidth: 720,
  clientHeight: 420,
  getBoundingClientRect: () => ({ width: 720, height: 420 }),
  getContext: () => context2d,
  addEventListener() {}
};
const answerInput = {
  value: "입력 중인 답",
  addEventListener(type, handler) { listeners[`input:${type}`] = handler; },
  focus() {},
  select() {}
};
const submitButton = {
  addEventListener(type, handler) { listeners[`button:${type}`] = handler; }
};
const hintBox = { innerHTML: "" };
const timerText = { textContent: "" };
const feedback = { textContent: "", hidden: true };
const toast = { textContent: "", className: "" };
const app = {};
Object.defineProperty(app, "innerHTML", {
  get: () => "",
  set(html) {
    renderCount += 1;
    catchmindMounted = html.includes('id="catchmindCanvas"');
  }
});

const sandbox = {
  console,
  structuredClone,
  URL,
  URLSearchParams,
  crypto: { randomUUID: () => "student-b" },
  localStorage: { getItem: () => null, setItem() {} },
  document: {
    querySelector(selector) {
      if (selector === "#app") return app;
      if (selector === "#toast") return toast;
      if (!catchmindMounted) return null;
      if (selector === "#catchmindCanvas") return canvas;
      if (selector === "#catchmindAnswerInput") return answerInput;
      if (selector === "#catchmindAnswerSubmitBtn") return submitButton;
      if (selector === "#catchmindHintBox") return hintBox;
      if (selector === "#catchmindTimerText") return timerText;
      if (selector === "#catchmindAnswerFeedback") return feedback;
      return null;
    },
    querySelectorAll: () => [],
    body: { insertAdjacentHTML() {} }
  },
  window: {
    devicePixelRatio: 1,
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
  ref: (_db, refPath) => refPath,
  set: async () => {},
  update: async () => {},
  get: async () => ({ exists: () => false, val: () => null }),
  onValue: () => () => {},
  onDisconnect: () => ({ set: async () => {} }),
  remove: async () => {},
  runTransaction: async () => ({ committed: true }),
  serverTimestamp: () => Date.now()
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: appPath });

const roundEndsAt = Date.now() + 60000;
vm.runInContext(`
  state.role = "student";
  state.roomCode = "ROOM";
  state.studentId = "student-b";
  state.studentName = "학생 B";
  state.catchmindAnswerDraft = "입력 중인 답";
  state.room = {
    mode: "catchmind",
    status: "playing",
    students: {
      "student-a": { name: "학생 A", connected: true },
      "student-b": { name: "학생 B", connected: true }
    },
    catchmind: {
      settings: { wordsText: "사과", wordList: ["사과"], totalRounds: 1, roundDuration: 60 },
      currentRound: {
        roundId: "game-r1",
        index: 0,
        drawerId: "student-a",
        drawerName: "학생 A",
        word: "사과",
        roundEndsAt: ${roundEndsAt}
      },
      rounds: {
        "game-r1": { strokes: {}, correctAnswers: {}, wrongAnswers: {} }
      }
    }
  };
  renderCatchmindStudentRoute();
`, sandbox);

assert.equal(renderCount, 1, "the guesser screen should mount once");
assert.equal(answerInput.value, "입력 중인 답");
const firstDrawCount = canvasDrawCount;

vm.runInContext(`
  state.room.catchmind.rounds["game-r1"].strokes.stroke_1 = {
    strokeId: "stroke_1",
    createdBy: "student-a",
    color: "#111827",
    size: 5,
    tool: "pen",
    points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.5 }],
    createdAt: 1,
    updatedAt: 2
  };
  state.room.catchmind.rounds["game-r1"].correctAnswers["student-c"] = {
    studentId: "student-c",
    name: "학생 C",
    rank: 1,
    scoreEarned: 3,
    answeredAt: 3
  };
  renderCatchmindStudentRoute();
`, sandbox);

assert.equal(renderCount, 1, "stroke and other-answer updates must not remount the answer form");
assert.equal(answerInput.value, "입력 중인 답", "the in-progress answer must remain in the same input");
assert.ok(canvasDrawCount > firstDrawCount, "new strokes should still redraw the existing canvas");

console.log("catchmind guesser smoke tests passed");
