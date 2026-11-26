const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { chromium } = require(process.env.PLAYGROUND_PLAYWRIGHT || "playwright");
const root = path.join(__dirname, "..");
const source = fs.existsSync(path.join(root, "outputs", "app.js")) ? path.join(root, "outputs") : root;
const site = "https://playground.test";
const testTeacherInput = randomUUID();
const mockAuth = `
  export const inMemoryPersistence = {};
  export const initializeAuth = (_, options) => {
    if (options.persistence !== inMemoryPersistence) throw Error("Expected an in-memory teacher session");
    return { currentUser: null, async signOut() { this.currentUser = null; window.__teacherSignedIn = false; } };
  };
  export const signInWithEmailAndPassword = async (auth, email, input) => {
    window.__teacherAttempts++;
    if (input !== window.__teacherFixture) throw Object.assign(new Error("Invalid test credential"), { code: "auth/invalid-credential" });
    auth.currentUser = { email };
    window.__teacherSignedIn = true;
  };
`;
const mockDatabase = `
  const listeners = new Map();
  const snapshot = (value) => ({ val: () => structuredClone(value), exists: () => value != null });
  const read = (key) => key.split("/").reduce((value, part) => value?.[part], window.__database);
  const write = (key, value) => {
    const parts = key.split("/");
    const leaf = parts.pop();
    const parent = parts.reduce((node, part) => node[part] ||= {}, window.__database);
    if (value == null) delete parent[leaf]; else parent[leaf] = value;
  };
  const publish = () => listeners.forEach((callback, key) => callback(snapshot(read(key))));
  window.__deliverRoom = (room) => { window.__database.rooms.ROOM42 = room; publish(); };
  export const getDatabase = () => ({});
  export const ref = (_, key) => key;
  export const get = async (key) => snapshot(read(key));
  export const onValue = (key, callback) => {
    listeners.set(key, callback);
    queueMicrotask(publish);
    return () => listeners.delete(key);
  };
  export const set = async (key, value) => { write(key, value); publish(); };
  export const update = async (key, changes) => {
    Object.entries(changes).forEach(([child, value]) => write(key + "/" + child, value));
    publish();
  };
  export const remove = (key) => set(key, null);
  export const runTransaction = async (key, updater) => {
    const initial = structuredClone(read(key));
    let next = updater(structuredClone(initial));
    if (next === undefined) return { committed: false, snapshot: snapshot(initial) };
    await new Promise((resolve) => setTimeout(resolve, 60));
    const beforeCommit = window.__beforeTransactionCommit;
    delete window.__beforeTransactionCommit;
    beforeCommit?.();
    const current = read(key);
    if (JSON.stringify(initial) !== JSON.stringify(current)) {
      next = updater(structuredClone(current));
      if (next === undefined) return { committed: false, snapshot: snapshot(current) };
    }
    write(key, next);
    publish();
    return { committed: true, snapshot: snapshot(next) };
  };
  export const serverTimestamp = () => Date.now();
  export const onDisconnect = () => ({ set() {} });
`;

const lobby = {
  mode: "quiz", gameVariant: "word", status: "waiting",
  students: Object.fromEntries(Array.from({ length: 16 }, (_, index) => [
    `student-${index}`, { name: `학생 ${index + 1}`, connected: true, avatarId: index < 2 ? "03_forsythia" : undefined, joinedAt: index + 1, score: 0 }
  ])),
  wordChallenge: { settings: { chosung: "ㅅㄱ", duration: 120 }, gameId: "" }
};
const round = { settings: lobby.wordChallenge.settings, gameId: "test-round", startedAt: Date.now(), submissions: {}, claims: {} };
const imageIsLoaded = (image) => image.complete && image.naturalWidth > 0;
const screenshotDir = process.env.PLAYGROUND_SCREENSHOTS;

async function capture(page, name) {
  if (!screenshotDir) return;
  fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, name + ".png"), animations: "disabled" });
}

async function configurePage(context) {
  await context.addInitScript(({ room, teacherFixture }) => {
    if (location.hostname !== "playground.test") return;
    window.__database = { rooms: { ROOM42: room } };
    window.__teacherAttempts = 0;
    window.__teacherFixture = teacherFixture;
    window.__playedNotes = 0;
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      window.__playedNotes++;
      return createOscillator.call(this);
    };
  }, { room: lobby, teacherFixture: testTeacherInput });
  await context.route("https://www.gstatic.com/firebasejs/**", (route) => {
    const module = route.request().url().split("/").at(-1);
    const body = module === "firebase-app.js" ? "export const initializeApp = () => ({});"
      : module === "firebase-auth.js" ? mockAuth : mockDatabase;
    return route.fulfill({ contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body });
  });
  await context.route(`${site}/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({ path: path.join(source, pathname === "/" ? "index.html" : pathname.slice(1)) });
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYGROUND_CHROME || undefined });
  try {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await Promise.all([configurePage(phone), configurePage(desktop)]);
    const student = await phone.newPage();
    const teacher = await desktop.newPage();
    const display = await desktop.newPage();
    const errors = [];
    [student, teacher, display].forEach((page) => page.on("pageerror", (error) => errors.push(error.message)));
    await Promise.all([student.goto(site), teacher.goto(site), display.goto(`${site}/?display=1&room=ROOM42`)]);
    await student.locator("#studentEnterBtn").waitFor();
    assert.equal(await student.locator('[name="teacherMode"]').count(), 9);
    assert.equal(await student.evaluate(() => document.documentElement.scrollWidth), 390);
    await capture(teacher, "desktop-home");
    await student.locator("#studentRoomCode").fill("ROOM42");
    await student.locator("#studentName").fill("자동 테스트");
    await student.locator("#studentEnterBtn").click();
    const picker = student.locator("#avatarPicker[open]");
    await picker.waitFor();
    assert.equal(await picker.locator("[data-avatar-choice]").count(), 20);
    assert.equal(await picker.getByRole("button", { name: "개나리", exact: true }).isEnabled(), false);
    assert.equal(await picker.getByRole("button", { name: "이 캐릭터 선택" }).isEnabled(), false);
    await student.waitForFunction(() => [...document.querySelectorAll(".avatar-choice img")].every((img) => img.complete && img.naturalWidth > 0));
    await capture(student, "mobile-avatars");
    await picker.getByRole("button", { name: "동명이", exact: true }).click();
    await student.evaluate(() => {
      window.__beforeTransactionCommit = () => {
        const room = structuredClone(window.__database.rooms.ROOM42);
        room.students["student-2"].avatarId = "01_dongmyeong";
        window.__deliverRoom(room);
      };
    });
    await picker.getByRole("button", { name: "이 캐릭터 선택" }).click();
    await picker.getByText("다른 학생이 먼저 골랐어요. 다른 캐릭터를 선택해 주세요.").waitFor();
    assert.equal(await picker.getByRole("button", { name: "동명이", exact: true }).isEnabled(), false);
    assert.equal(await student.evaluate(() => Object.values(window.__database.rooms.ROOM42.students).filter((player) => player.avatarId === "01_dongmyeong").length), 1);
    await picker.getByRole("button", { name: "책 읽는 수달", exact: true }).click();
    await picker.getByRole("button", { name: "이 캐릭터 선택" }).click();
    await picker.waitFor({ state: "hidden" });
    const currentRoom = await student.evaluate(() => window.__database.rooms.ROOM42);
    const studentId = Object.keys(currentRoom.students).find((id) => currentRoom.students[id].name === "자동 테스트");
    assert.equal(currentRoom.students[studentId].avatarId, "20_book_otter");
    assert.equal(currentRoom.students["student-0"].avatarId, "03_forsythia");
    assert.equal(currentRoom.students["student-1"].avatarId, undefined);
    await student.getByRole("button", { name: "캐릭터 바꾸기" }).click();
    assert.equal(await picker.getByRole("button", { name: "책 읽는 수달", exact: true }).getAttribute("aria-pressed"), "true");
    await picker.getByRole("button", { name: "나중에" }).click();
    assert.match(await student.locator("#studentProfile img").getAttribute("src"), /20_book_otter/);
    await student.locator("#backHomeBtn").click();
    await student.locator("#studentEnterBtn").click();
    await student.locator("#studentProfile img").waitFor();
    assert.equal(await picker.count(), 0);
    assert.match(await student.locator("#studentProfile img").getAttribute("src"), /20_book_otter/);

    const legacyRoom = structuredClone(currentRoom);
    legacyRoom.students[studentId].avatarId = "20_book_owl";
    await display.evaluate((room) => window.__deliverRoom(room), legacyRoom);
    assert.equal(await display.locator(".playground-roster li").count(), 17);
    await display.waitForFunction(() => [...document.querySelectorAll(".playground-roster img")].every((img) => img.complete && img.naturalWidth > 0));
    assert.equal(await display.locator(".playground-roster li").filter({ hasText: "자동 테스트" }).locator("img").evaluate(imageIsLoaded), true);
    assert.match(await display.locator(".playground-roster li").filter({ hasText: "자동 테스트" }).locator("img").getAttribute("src"), /20_book_otter/);
    await capture(display, "classroom-lobby");
    await display.getByRole("button", { name: "소리 켜기" }).click();
    await display.getByRole("button", { name: "소리 끄기" }).waitFor();
    await display.locator("#classroomSoundMode").selectOption("music");
    await display.waitForFunction(() => window.__playedNotes >= 8);
    const lobbyNotes = await display.evaluate(() => window.__playedNotes);

    const playingRoom = { ...currentRoom, status: "playing", wordChallenge: round };
    await student.evaluate((room) => window.__deliverRoom(room), playingRoom);
    await display.evaluate((room) => window.__deliverRoom(room), playingRoom);
    await display.locator(".word-display-play").waitFor();
    assert.equal(await display.locator(".word-display-play .word-chosung").innerText(), "ㅅㄱ");
    assert.equal(await display.evaluate(() => window.__playedNotes), lobbyNotes + 2);
    await display.evaluate((room) => window.__deliverRoom(room), playingRoom);
    assert.equal(await display.evaluate(() => window.__playedNotes), lobbyNotes + 2, "same-phase updates must not replay audio");
    assert.equal(await student.evaluate(() => window.__playedNotes), 0, "student playback is muted");
    await capture(display, "classroom-playing");
    const input = student.locator("#wordChallengeInput");
    await input.fill("사과");
    await input.press("Enter");
    await input.fill("수건");
    await student.waitForFunction(() => !document.querySelector("#wordChallengeForm button").disabled);
    assert.equal(await input.inputValue(), "수건");
    await input.press("Enter");
    await student.waitForFunction(() => Object.keys(window.__database.rooms.ROOM42.wordChallenge.submissions).length === 2);
    const studentRoom = await student.evaluate(() => window.__database.rooms.ROOM42);
    assert.equal(Object.values(studentRoom.wordChallenge.submissions).every((word) => word.status === "pending"), true);

    await teacher.locator("#teacherPassword").fill(randomUUID());
    await teacher.locator("#teacherRoomCode").fill("ROOM42");
    await teacher.locator('[data-mode="word"]').click();
    await teacher.locator("#teacherEnterBtn").click();
    await teacher.getByText("교사용 비밀번호를 확인해 주세요.", { exact: true }).waitFor();
    assert.equal(await teacher.locator("#wordChosungInput").count(), 0);
    assert.equal(await teacher.evaluate(() => window.__teacherAttempts), 1);
    await teacher.locator("#teacherPassword").fill(testTeacherInput);
    await teacher.locator("#teacherEnterBtn").click();
    await teacher.locator("#wordChosungInput").waitFor();
    assert.equal(await teacher.evaluate(() => window.__teacherSignedIn), true);
    const pendingWords = Object.fromEntries(Array.from({ length: 15 }, (_, index) => [
      `word-${index}`, { originalWord: `단어${index}`, nickname: "자동 테스트", participantId: studentId, status: "pending", submittedAt: Date.now() + index }
    ]));
    const reviewRoom = { ...studentRoom, wordChallenge: { ...round, submissions: pendingWords } };
    await teacher.evaluate((room) => window.__deliverRoom(room), reviewRoom);
    const pending = teacher.locator('[data-word-review-list="pending"]');
    await pending.locator("article").nth(14).waitFor();
    const target = pending.locator("article").nth(8);
    const original = await target.elementHandle();
    await pending.evaluate((element) => { element.scrollTop = 290; });
    const top = await pending.evaluate((element) => element.scrollTop);
    reviewRoom.wordChallenge.submissions.new = { ...pendingWords["word-0"], originalWord: "새 단어", submittedAt: 1 };
    await teacher.evaluate((room) => window.__deliverRoom(room), reviewRoom);
    assert.equal(await original.evaluate((element) => element.isConnected), true);
    assert.equal(await pending.evaluate((element) => element.scrollTop), top);
    assert.match(await pending.locator("article").last().innerText(), /새 단어/);
    await capture(teacher, "teacher-review");
    await target.getByRole("button", { name: "승인", exact: true }).click();
    await teacher.waitForFunction(() => window.__database.rooms.ROOM42.wordChallenge.submissions["word-8"].status === "approved");
    assert.equal(await teacher.locator("#wordTeacherApproved article").count(), 1);

    const [entry] = Object.values(studentRoom.wordChallenge.submissions);
    entry.status = "approved";
    await display.evaluate((room) => window.__deliverRoom(room), { ...studentRoom, status: "finished" });
    const sorted = display.locator(".ranking-row").filter({ hasText: "자동 테스트" });
    await sorted.waitFor();
    assert.match(await sorted.locator("img").getAttribute("src"), /20_book_otter/);
    assert.match(await display.locator(".podium.first img").getAttribute("src"), /20_book_otter/);
    await capture(display, "classroom-result");
    await display.getByRole("button", { name: "소리 끄기" }).click();
    await display.getByRole("button", { name: "소리 켜기" }).waitFor();
    await teacher.locator("#backHomeBtn").click();
    await teacher.waitForFunction(() => window.__teacherSignedIn === false);
    assert.equal(await student.evaluate(() => window.__teacherAttempts), 0);
    assert.deepEqual(errors, []);
    console.log("Playground browser tests passed (teacher authentication, 20 avatars, 17-person lobby, word review, sound, final results)");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
