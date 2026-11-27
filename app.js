import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  get,
  onValue,
  onDisconnect,
  remove,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// =========================
// 수업용 기본 설정
// =========================

// Firebase Console > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성 값을 붙여 넣으세요.
// Realtime Database를 사용하므로 databaseURL 값이 꼭 필요합니다.

// BEGIN LEGACY FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyD79qmaq3giK2Rw1Y-AtiMKhOcJ9cv7-KA",
    authDomain: "class-quiz-battle.firebaseapp.com",
    databaseURL: "https://class-quiz-battle-default-rtdb.firebaseio.com",
    projectId: "class-quiz-battle",
    storageBucket: "class-quiz-battle.firebasestorage.app",
    messagingSenderId: "1062951652426",
    appId: "1:1062951652426:web:1a55fd753a95fc60d9eab3"
};

// 교사 화면 입장 비밀번호입니다. 정적 웹앱에서는 완전한 보안 장치가 아니라 수업용 잠금에 가깝습니다.
const TEACHER_ACCOUNT_EMAIL = "dmsg4024@gmail.com";
// END LEGACY FIREBASE CONFIG

// 문제당 제한 시간입니다.
const DEFAULT_TIME_LIMIT_SECONDS = 20;

// 학생 한 명이 제출할 수 있는 기본 최대 문제 수입니다. 교사 화면에서 방마다 바꿀 수 있습니다.
const MAX_QUESTIONS_PER_STUDENT = 3;

// 학생 한 명이 제출할 수 있는 기본 최대 칭찬 카드 수입니다. 교사 화면에서 방마다 바꿀 수 있습니다.
const MAX_COMPLIMENTS_PER_STUDENT = 3;

// 칭찬 스무고개 점수 설정입니다. 단서가 4개인 카드는 앞 4개 점수만 사용합니다.
const COMPLIMENT_TARGET_POINTS = [1000, 800, 600, 400, 200];
const COMPLIMENT_AUTHOR_BONUS = 300;
const COMPLIMENT_TARGET_BONUS = 200;

// false로 바꾸면 학생 본인이 낸 문제는 자동으로 0점 처리됩니다.
const ALLOW_SOLVE_OWN_QUESTION = true;

// 교사 화면이 열려 있을 때 시간이 끝나면 자동으로 정답 공개 상태로 바꿉니다.
const AUTO_REVEAL_WHEN_TIME_UP = true;

// 교실 마피아 게임 기본 설정입니다.
const DEFAULT_MAFIA_COUNT = 2;
const DEFAULT_POLICE_COUNT = 1;
const DEFAULT_DOCTOR_COUNT = 1;
const DEFAULT_DISCUSSION_SECONDS = 180;
const VOTE_TIE_RULE = "revote_then_skip";
const REVEAL_ROLE_ON_ELIMINATION = true;
const MAFIA_SELF_SELECT_ALLOWED = false;
const DEFAULT_LIAR_COUNT = 2;
const DEFAULT_CATCHMIND_ROUND_SECONDS = 60;
const MIN_CATCHMIND_ROUND_SECONDS = 31;
const MAX_CATCHMIND_ROUND_SECONDS = 180;
const DEFAULT_CATCHMIND_ROUNDS = 5;
const CATCHMIND_DRAW_FLUSH_MS = 140;
const DEFAULT_SEAT_ROWS = 5;
const DEFAULT_SEAT_COLUMNS = 3;
const DEFAULT_SEAT_CARD_PHASE_SECONDS = 12;
const MIN_SEAT_CARD_PHASE_SECONDS = 5;
const MAX_SEAT_CARD_PHASE_SECONDS = 60;
const SEAT_FINAL_COUNTDOWN_SECONDS = 5;
const SEAT_REVEAL_INTERVAL_MS = 260;
const MEMORY_BOARD_SIZES = [2, 4, 6];
const DEFAULT_MEMORY_BOARD_SIZE = 4;
const MEMORY_IMAGE_MAX_SIDE = 640;
const MEMORY_IMAGE_QUALITY = 0.72;
const MEMORY_IMAGE_MAX_BYTES = 140 * 1024;
const MEMORY_IMAGE_TOTAL_MAX_BYTES = 3 * 1024 * 1024;
const MEMORY_PREVIEW_MS = 4000;
const MEMORY_MISMATCH_DELAY_MS = 850;
const DEFAULT_BINGO_SIZE = 3;
const MIN_BINGO_SIZE = 3;
const MAX_BINGO_SIZE = 6;
const DEFAULT_WORD_CHALLENGE_SECONDS = 60;
const MIN_WORD_CHALLENGE_SECONDS = 10;
const MAX_WORD_CHALLENGE_SECONDS = 600;
const MAX_WORD_CHALLENGE_LENGTH = 20;
const GHOST_BINGO_REQUIRED_CONDITIONS = 8;
const GHOST_BINGO_FREE_ID = "FREE";
const GHOST_CHAT_MAX_LENGTH = 100;
const GHOST_CHAT_COOLDOWN_MS = 1000;

const GHOST_BINGO_CONDITIONS = [
  {
    id: "vote_tie",
    label: "투표 동점",
    description: "낮 투표에서 공동 최다 득표자가 발생합니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.type === "VOTE_RESULT" && event.tiedStudentIds.length >= 2)
  },
  {
    id: "vote_majority",
    label: "과반 득표",
    description: "한 명이 전체 유효표의 과반수를 얻습니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.type === "VOTE_RESULT" && event.totalVotes > 0 && event.topCount > event.totalVotes / 2)
  },
  {
    id: "vote_one_margin",
    label: "1표 차 승부",
    description: "최다 득표자가 1표 차이로 결정됩니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.type === "VOTE_RESULT" && !event.tiedStudentIds.length && event.topCount - event.secondCount === 1)
  },
  {
    id: "vote_four_candidates",
    label: "표가 넓게 흩어짐",
    description: "한 번의 낮 투표에서 4명 이상이 1표 이상 받습니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.type === "VOTE_RESULT" && event.distinctVotedCount >= 4)
  },
  {
    id: "vote_no_execution",
    label: "처형 없음",
    description: "낮 투표 결과 아무도 처형되지 않습니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.type === "VOTE_RESULT" && !event.eliminatedStudentId && !event.revotedTieRequired)
  },
  {
    id: "consecutive_top",
    label: "연속 최다 득표",
    description: "같은 플레이어가 두 번 연속 최다 득표자가 됩니다.",
    matchAt: getConsecutiveTopVoteMatchTime
  },
  {
    id: "same_target_voted_twice",
    label: "계속 의심받는 사람",
    description: "같은 플레이어가 두 번 연속 낮 투표에서 1표 이상 받습니다.",
    matchAt: getSameTargetVotedTwiceMatchTime
  },
  {
    id: "new_ghost",
    label: "새 유령 등장",
    description: "새로운 탈락자가 한 명 생깁니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => Boolean(event.eliminatedStudentId))
  },
  {
    id: "police_died",
    label: "경찰 사망",
    description: "경찰 역할 플레이어가 탈락합니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.eliminatedRole === "police")
  },
  {
    id: "doctor_died",
    label: "의사 사망",
    description: "의사 역할 플레이어가 탈락합니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.eliminatedRole === "doctor")
  },
  {
    id: "mafia_died",
    label: "마피아 사망",
    description: "마피아 역할 플레이어가 탈락합니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.eliminatedRole === "mafia")
  },
  {
    id: "citizen_team_died",
    label: "시민팀 사망",
    description: "시민팀 플레이어가 탈락합니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => Boolean(event.eliminatedStudentId) && event.eliminatedRole !== "mafia")
  },
  {
    id: "alive_five_or_less",
    label: "생존자 5명 이하",
    description: "탈락 처리 후 생존자가 5명 이하가 됩니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => Boolean(event.eliminatedStudentId) && event.aliveCountAfter <= 5)
  },
  {
    id: "citizen_team_two_deaths",
    label: "시민팀 연속 사망",
    description: "시민팀 플레이어가 두 번 연속 탈락합니다.",
    matchAt: getConsecutiveCitizenTeamDeathsMatchTime
  },
  {
    id: "mafia_executed",
    label: "마피아 처형",
    description: "마피아가 낮 투표 결과로 처형됩니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.type === "VOTE_RESULT" && event.eliminatedRole === "mafia")
  },
  {
    id: "night_death",
    label: "밤의 희생자",
    description: "밤 결과에서 플레이어가 사망합니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.type === "NIGHT_RESULT" && Boolean(event.eliminatedStudentId))
  },
  {
    id: "no_night_death",
    label: "밤의 평화",
    description: "밤 결과에서 아무도 사망하지 않습니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.type === "NIGHT_RESULT" && !event.eliminatedStudentId)
  },
  {
    id: "five_votes",
    label: "5표 집중",
    description: "낮 투표에서 한 명이 5표 이상 받습니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.type === "VOTE_RESULT" && event.topCount >= 5)
  },
  {
    id: "three_single_votes",
    label: "외로운 한 표들",
    description: "한 번의 낮 투표에서 3명 이상이 정확히 1표씩 받습니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.type === "VOTE_RESULT" && event.singleVoteCandidateCount >= 3)
  },
  {
    id: "top_margin_three",
    label: "압도적 지목",
    description: "최다 득표자와 2위의 표 차이가 3표 이상 납니다.",
    matchAt: (events) => getFirstEventTime(events, (event) => event.type === "VOTE_RESULT" && !event.tiedStudentIds.length && event.topCount - event.secondCount >= 3)
  }
];

// =========================
// 앱 상태
// =========================

const PLAYGROUND_AVATARS = [
  "01_dongmyeong", "02_pine", "03_forsythia", "04_eagle", "05_sun", "06_trumpet", "07_flute", "08_beat",
  "09_drum", "10_melody", "11_camera", "12_movie", "13_pixel", "14_video", "15_ai", "16_coding",
  "17_drone", "18_sprout", "19_blue_road", "20_book_otter"
];
const PLAYGROUND_MODE_ART = {
  quiz: { mark: "Q", thumbnail: [484, 322], banner: [696, 316] },
  compliment: { mark: "♥", thumbnail: [490, 322], banner: [699, 319] },
  mafia: { mark: "◒", thumbnail: [485, 322], banner: [696, 320] },
  liar: { mark: "?", thumbnail: [484, 310], banner: [683, 189] },
  catchmind: { mark: "✎", thumbnail: [490, 310], banner: [699, 320] },
  seat: { mark: "↔", thumbnail: [485, 310], banner: [683, 192] },
  memory: { mark: "▣", thumbnail: [484, 321], banner: [696, 327] },
  bingo: { mark: "#", thumbnail: [490, 321], banner: [683, 184] },
  word: { mark: "ㄱ", thumbnail: [485, 321], banner: [699, 327] }
};
const classroomAudio = {
  context: null, gain: null, musicGain: null, interval: null, room: null, phase: "",
  enabled: false, preference: "effects", volume: 0.45
};

let firebaseApp = null;
let db = null;
let teacherAuth = null;
let displayWindow = null;
let displayWindowRoomCode = "";
const studioSubmissions = new Set();
let studioComposingField = null;
let studioDeferredView = null;
let lastPlayPresentation = "";
let activeGhostPanel = "bingo";
let studentPresence = null;
const STUDENT_SESSIONS_KEY = "wbq_student_sessions_v2";

const state = {
  role: null,
  roomCode: "",
  studentName: "",
  studentId: "",
  teacherSigningIn: false,
  room: null,
  unsubscribeRoom: null,
  activeView: "",
  timerId: null,
  toastId: null,
  answering: false,
  quizShortAnswerDraft: "",
  quizShortAnswerQuestionId: "",
  skipWriteKey: "",
  ghostJoinWriteKey: "",
  ghostBingoDraft: null,
  selectedGhostBingoConditionId: "",
  lastGhostChatAt: 0,
  ghostChatDraft: "",
  ghostChatShouldFocus: false,
  ghostChatSending: false,
  liarWordVisible: false,
  liarWordVisibleKey: "",
  selectedLiarVoteTargetId: "",
  catchmindWordVisibleKey: "",
  catchmindTeacherAnswerVisibleKey: "",
  catchmindAnswerDraft: "",
  catchmindWrongMessage: "",
  catchmindGuesserRound: "",
  catchmindPendingAnswer: null,
  catchmindDrawQueue: Promise.resolve(),
  catchmindDrawingWrites: 0,
  catchmindCanvasEditing: false,
  catchmindTool: "pen",
  catchmindColor: "#111827",
  catchmindSize: 5,
  seatSettingsDraft: null,
  seatCardTargetMode: false,
  seatCardTargetSeats: [],
  seatInteractionKey: "",
  serverTimeOffset: 0,
  memorySettingsDraft: null,
  memoryImageDraft: [],
  memoryUploading: false,
  memoryPlayer: null,
  unsubscribeMemoryPlayer: null,
  memoryPlayerSubscriptionKey: "",
  memoryImages: [],
  unsubscribeMemoryImages: null,
  memoryImageSubscriptionKey: "",
  memoryBoardBusy: false,
  memoryOpenCards: [],
  memoryStartWriteKey: "",
  memoryReadyWriteKey: "",
  memoryRecordsCache: {},
  unsubscribeMemoryRecords: null,
  memoryRecordsVisible: false,
  memoryResultBusy: false,
  bingoConceptDraft: "",
  bingoExplanationDraft: "",
  wordChallengeDraft: "",
  wordChallengeSubmitting: false,
  wordChallengeReviewing: false,
  avatarPromptedRoom: "",
  catchmindDrawing: {
    active: false,
    strokeId: "",
    points: [],
    color: "#111827",
    size: 5,
    lastFlushAt: 0
  }
};

const appEl = document.querySelector("#app");
const toastEl = document.querySelector("#toast");
const finalRelease = globalThis.PlaygroundRelease;
const securePilot = globalThis.PlaygroundSecureRuntime?.protocol === 2 ? globalThis.PlaygroundSecureRuntime
  : globalThis.location?.hostname === "127.0.0.1" ? globalThis.PlaygroundSecurePilot : null;

if (!securePilot && isFirebaseConfigured()) {
  firebaseApp = initializeApp(firebaseConfig);
  db = getDatabase(firebaseApp);
  onValue(ref(db, ".info/serverTimeOffset"), (snapshot) => {
    state.serverTimeOffset = Number(snapshot.val() || 0);
  });
  if (finalRelease) onValue(ref(db, ".info/connected"), (snapshot) => finalRelease.noteConnection(snapshot.val()));
}

bootApp();

// =========================
// 화면 렌더링
// =========================

function bootApp() {
  bindPlaygroundAvatarPicker();
  bindStudioComposition();
  if (finalRelease?.isDemo && firebaseApp?.name === "playground-local-demo") {
    window.PlaygroundDemoMount = loadFinalDemoFixture;
    window.addEventListener("playground-demo-role", enterFinalDemoRole);
    window.dispatchEvent(new Event("playground-demo-ready"));
    return;
  }
  finalRelease?.setAppBuild("1.0.0-rc.2-static");
  finalRelease?.checkVersion();
  if (finalRelease) document.addEventListener("click", blockReadOnlyTeacherClick, true);
  document.addEventListener("error", (event) => {
    if (event.target?.classList?.contains("arcade-image")) event.target.hidden = true;
  }, true);
  const params = new URLSearchParams(window.location.search);
  const isDisplay = params.get("display") === "1";
  const displayRoomCode = normalizeRoomCode(params.get("room") || "");

  if (isDisplay && displayRoomCode) {
    enterDisplayMode(displayRoomCode);
    return;
  }

  renderHome();
}

async function loadFinalDemoFixture(fixture, resetTransport) {
  if (!finalRelease?.isDemo || firebaseApp?.name !== "playground-local-demo" || fixture.environment !== "local-demo-only"
    || fixture.allowProductionWrites !== false || fixture.recordResults !== false || !Object.hasOwn(PLAYGROUND_MODE_ART, fixture.mode)) throw new Error("Isolated demo required");
  const { mode, settings, privateFixtureData: data, participants } = fixture;
  if (!Array.isArray(participants) || participants.length < 2 || participants.some(({ id }) => !/^demo-[1-9]\d?$/.test(id))) throw new Error("Invalid demo participants");
  const students = Object.fromEntries(participants.map(({ id, name, avatarOrdinal }, index) => [id, {
    name, avatarId: PLAYGROUND_AVATARS[avatarOrdinal - 1], connected: true, score: 0, joinedAt: index + 1
  }]));
  let draftImages = [];
  if (mode === "memory") {
    draftImages = await Promise.all(data.imageReferences.map(async ({ id, asset }, index) => {
      if (!/^assets\/avatars\/[a-z0-9_-]+\.webp$/.test(asset)) throw new Error("Invalid demo image path");
      const response = await fetch(`./${asset}`, { credentials: "omit" });
      if (!response.ok) throw new Error("Demo image unavailable");
      const blob = await response.blob();
      const dataUrl = await memoryBlobToDataUrl(blob);
      return { signature: id, name: `체험 이미지 ${index + 1}`, previewUrl: dataUrl, dataUrl, bytes: blob.size, contentType: blob.type };
    }));
  }
  clearRoomSubscription();
  clearMemorySubscriptions();
  clearTimer();
  clearMemoryImageDraft();
  resetTransport();
  state.room = null;
  state.roomCode = "DEMO";
  state.studentGeneration = null;
  state.seatSettingsDraft = null;
  state.memorySettingsDraft = { boardSize: settings.boardSize || DEFAULT_MEMORY_BOARD_SIZE };
  state.memoryImageDraft = draftImages;
  state.memoryUploading = false;
  state.memoryRecordsVisible = false;
  teacherAuth = { currentUser: { uid: "demo-host" }, signOut() {} };
  const room = { ...buildHostedRoom(mode, "가상 수업", "demo-host"), students };
  if (mode === "quiz") {
    room.quizOptions = { seconds: settings.timeLimitSeconds, order: settings.shuffleQuestions ? "random" : "submitted", allowOwn: settings.allowSolveOwnQuestion, autoReveal: false };
    room.questions = Object.fromEntries(data.questions.map(({ id, acceptedAnswers, explanation, ...question }, index) => [id, {
      ...question, authorName: students[question.authorStudentId].name, createdAt: index + 1,
      ...(question.type === "short" ? { correctAnswer: acceptedAnswers[0] } : {})
    }]));
  }
  if (mode === "compliment") {
    room.maxComplimentsPerStudent = settings.maxComplimentsPerStudent;
    room.compliments = Object.fromEntries(data.compliments.map(({ id, ...card }, index) => [id, {
      ...card, authorName: students[card.authorStudentId].name, targetName: students[card.targetStudentId].name, createdAt: index + 1
    }]));
  }
  if (mode === "mafia") room.mafia.settings = { ...room.mafia.settings, ...settings };
  if (mode === "liar") room.liar.settings = { ...room.liar.settings, ...settings };
  if (mode === "catchmind") room.catchmind.settings = { wordsText: data.words.join("\n"), wordList: data.words, totalRounds: settings.roundCount, roundDuration: settings.roundSeconds };
  if (mode === "seat") room.seatGame = getInitialSeatGameStateForWrite(settings);
  if (mode === "memory") room.memoryBattle = getInitialMemoryBattleStateForWrite(settings.boardSize);
  if (mode === "bingo") {
    room.bingo = getInitialBingoStateForWrite(settings.size);
    room.bingo.settings.concepts = data.concepts;
    room.bingo.boards = Object.fromEntries(participants.map(({ id }, index) => [id, {
      studentId: id, name: students[id].name, size: settings.size, submittedAt: Date.now(),
      cells: data.boards[id] || [...data.concepts.slice(index), ...data.concepts.slice(0, index)]
    }]));
  }
  if (mode === "word") room.wordChallenge = getInitialWordChallengeStateForWrite({ chosung: settings.chosung, duration: settings.durationSeconds });
  await set(roomRef("DEMO"), room);
}

async function enterFinalDemoRole(event) {
  if (!finalRelease?.isDemo || firebaseApp?.name !== "playground-local-demo") return;
  const { role, id } = event.detail || {};
  if (!["teacher", "student", "display"].includes(role)) return;
  const room = (await get(roomRef("DEMO"))).val();
  if (!room || (role === "student" && !room.students?.[id])) return;
  clearMemorySubscriptions();
  clearTimer();
  closeTeacherQuestionDetail();
  closeSeatConfirmModal();
  document.querySelector("#avatarPicker[open]")?.close();
  document.querySelector("#uxHostDialog[open]")?.close();
  resetFinalDemoStudentInputs();
  state.room = room;
  state.role = role;
  state.studentId = role === "student" ? id : "";
  state.studentName = role === "student" ? room.students[id].name : "";
  state.studentGeneration = role === "student" ? getRoomGeneration(room) : null;
  if (role === "display") bindClassroomSound();
  else {
    updateClassroomSound(null);
    document.querySelector("#classroomSound").hidden = true;
  }
  syncPlaygroundStudentProfile();
  subscribeToRoom("DEMO");
}

function resetFinalDemoStudentInputs() {
  state.quizShortAnswerDraft = "";
  state.wordChallengeDraft = "";
  state.catchmindAnswerDraft = "";
  state.bingoConceptDraft = "";
  state.bingoExplanationDraft = "";
  state.selectedLiarVoteTargetId = "";
  state.memoryPlayer = null;
  state.memoryPlayerSubscriptionKey = "";
  state.memoryOpenCards = [];
  state.memoryInteractionKey = "";
}

async function enterDisplayMode(roomCode) {
  state.role = "display";
  state.roomCode = roomCode;
  state.activeView = "";
  bindClassroomSound();

  if (securePilot) {
    const result = await securePilot.display(roomCode);
    if (result.error) {
      renderPolishRoomMessage("session");
      showToast("교사 화면에서 발급한 교실 화면 링크가 필요합니다.", "error");
      return;
    }
    subscribeToRoom(roomCode);
    return;
  }

  if (!db) {
    setView("display-no-firebase", `
      <section class="screen display-stage">
        <div class="panel">
          <h1>Firebase 설정값이 필요합니다.</h1>
          <p class="lead">교실 화면을 열려면 app.js의 Firebase 설정이 먼저 입력되어 있어야 합니다.</p>
        </div>
      </section>
    `, null, true);
    return;
  }

  setView("display-loading", `
    <section class="screen display-stage">
      <div class="panel">
        <p class="eyebrow">동명중학교 PLAYGROUND</p>
        <h1>교실 화면을 불러오는 중입니다.</h1>
        <p class="lead">방 코드 ${escapeHtml(roomCode)}</p>
      </div>
    </section>
  `, null, true);
  subscribeToRoom(roomCode);
}

function renderHome() {
  securePilot?.leave();
  stopStudentPresence();
  document.querySelector("#uxHostDialog")?.close?.();
  lastPlayPresentation = "";
  activeGhostPanel = "bingo";
  closeTeacherQuestionDetail();
  clearRoomSubscription();
  if (state.role === "teacher") endTeacherAuthentication();
  clearTimer();
  closeSeatConfirmModal();
  state.role = null;
  state.room = null;
  state.activeView = "home";
  state.avatarPromptedRoom = "";
  setPlaygroundTheme();
  syncPlaygroundStudentProfile();
  state.seatSettingsDraft = null;
  state.seatInteractionKey = "";
  clearMemorySubscriptions();
  clearMemoryImageDraft();
  state.memorySettingsDraft = null;
  state.bingoConceptDraft = "";
  state.bingoExplanationDraft = "";

  const recentRoom = readUxStorage("wbq_studentRoomCode") || readUxStorage("wbq_roomCode") || "";
  const recentTeacher = readUxStorage("wbq_teacherRoomCode") || "";
  const requestedRoom = normalizeRoomCode(new URLSearchParams(window.location.search).get("room"));
  const savedRoom = requestedRoom || recentRoom;

  appEl.innerHTML = `
    <section class="screen arcade-home">
      <header class="arcade-brand-row">
        <div class="arcade-wordmark">${renderPlaygroundAvatar("01_dongmyeong")}<span>PLAYGROUND <b>ARCADE</b></span></div>
        <button type="button" class="btn ghost" id="openTeacherEntryBtn">교사로 입장</button>
      </header>
      <div class="arcade-banner">
        <div class="arcade-banner-copy">
          <p class="arcade-school">동명중학교</p>
          <h1>PLAYGROUND</h1>
          <p>퀴즈, 칭찬, 추리, 게임이 모이는 우리 학교 플레이 공간</p>
        </div>
      </div>

      ${db ? "" : `
        <div class="notice danger">
          Firebase 설정값이 아직 입력되지 않았습니다. <strong>app.js 상단의 firebaseConfig</strong>를 먼저 채워 주세요.
        </div>
      `}

      <div class="arcade-home-layout">
        <section class="arcade-student-entry" aria-labelledby="arcadeStudentTitle">
          <div class="arcade-entry-heading">
            <h2 id="arcadeStudentTitle">학생으로 입장</h2>
            ${renderUxArt("access/name-registration", "ux-entry-art")}
          </div>
          <div id="uxStudentResume" class="ux-resume" hidden></div>
          <div class="form-grid">
            <div class="field">
              <label for="studentRoomCode">방 코드</label>
              <input id="studentRoomCode" autocomplete="off" inputmode="latin" maxlength="8" placeholder="예: A7K2Q9" value="${escapeAttr(savedRoom)}" />
            </div>
            <div class="field">
              <div class="studio-field-heading"><label for="studentName">이름</label><span id="uxNameCount" class="studio-counter">0 / 5</span></div>
              <input id="studentName" autocomplete="off" aria-describedby="uxStudentEntryStatus" placeholder="이름 2~5글자" />
            </div>
            <p id="uxStudentEntryStatus" class="ux-inline-status" aria-live="polite"></p>
            <button id="studentEnterBtn" class="btn primary full">학생 입장</button>
          </div>
        </section>

        <section class="arcade-library" aria-labelledby="arcadeLibraryTitle">
          <div class="arcade-library-heading"><h2 id="arcadeLibraryTitle">게임 모음</h2><span>${Object.keys(PLAYGROUND_MODE_ART).length}개</span></div>
          <ul class="arcade-game-grid">
            ${Object.keys(PLAYGROUND_MODE_ART).map((mode) => `<li class="arcade-game-tile" data-mode="${mode}">
              ${renderArcadeModeArt(mode, "thumbnail")}<strong>${modeLabel(mode)}</strong>
            </li>`).join("")}
          </ul>
        </section>
      </div>

      <dialog id="teacherEntryDialog" class="arcade-teacher-dialog" aria-labelledby="teacherEntryTitle">
        <section class="arcade-teacher-entry">
          <header class="arcade-dialog-heading">
            <h2 id="teacherEntryTitle">교사로 입장</h2>
            <button id="closeTeacherEntryBtn" type="button" class="btn ghost arcade-close" aria-label="교사 입장 닫기">&times;</button>
          </header>
          <div class="form-grid">
            <div class="segmented ux-teacher-intents" role="group" aria-label="방 입장 방식">
              <label class="radio-tile"><input name="teacherEntryIntent" type="radio" value="create" ${recentTeacher ? "" : "checked"} /><span>새 방 만들기</span></label>
              <label class="radio-tile"><input name="teacherEntryIntent" type="radio" value="open" ${recentTeacher ? "checked" : ""} /><span>기존 방 열기</span></label>
            </div>
            <div class="field">
              <label for="teacherPassword">관리자 비밀번호</label>
              <input id="teacherPassword" type="password" autocomplete="current-password" placeholder="비밀번호" autofocus />
            </div>
            <div class="field">
              <label for="teacherRoomCode">방 코드</label>
              <input id="teacherRoomCode" autocomplete="off" inputmode="latin" maxlength="8" placeholder="비워 두면 자동 생성" value="${escapeAttr(recentTeacher)}" />
            </div>
            <div class="field" id="uxRecentRoomsField" hidden><label for="uxRecentRooms">이 기기의 최근 방</label><select id="uxRecentRooms"><option value="">방 코드 선택</option>${getRecentTeacherRooms().map((code) => `<option value="${escapeAttr(code)}">${escapeHtml(code)}</option>`).join("")}</select></div>
            <div class="field" id="uxTeacherCreateFields">
              <label for="uxTeacherRoomTitle">수업 이름 (선택)</label><input id="uxTeacherRoomTitle" maxlength="36" />
              <span class="label">게임 모드</span>
              <div class="mode-options">
                ${getFinalTeacherModes().map((mode) => `
                  <label class="mode-tile" data-mode="${mode}">
                    <input type="radio" name="teacherMode" value="${mode}" ${mode === "quiz" ? "checked" : ""} />
                    <span class="playground-mode-body">${renderArcadeModeArt(mode, "thumbnail")}<strong>${modeLabel(mode)}</strong></span>
                  </label>
                `).join("")}
              </div>
            </div>
            <p id="teacherEntryStatus" class="arcade-dialog-status" role="status"></p>
            <div class="button-row">
              <button id="teacherEnterBtn" class="btn dark">교사 입장</button>
              <button id="newRoomCodeBtn" class="btn ghost" type="button">새 코드 넣기</button>
            </div>
          </div>
        </section>
      </dialog>
    </section>
  `;

  document.querySelector("#studentEnterBtn").addEventListener("click", () => enterStudent());
  state.studentNewEntry = false;
  document.querySelector("#studentRoomCode").addEventListener("input", () => {
    state.studentNewEntry = false;
    refreshUxStudentEntry();
  });
  document.querySelector("#studentName").addEventListener("input", (event) => { if (!event.isComposing) syncUxNameInput(); });
  document.querySelector("#studentName").addEventListener("compositionend", syncUxNameInput);
  document.querySelector("#uxStudentResume").addEventListener("click", (event) => {
    if (event.target.closest("[data-ux-resume]")) enterStudent({ resume: true });
    if (event.target.closest("[data-ux-new-student]")) {
      state.studentNewEntry = true;
      const input = document.querySelector("#studentName");
      input.value = "";
      input.focus();
      syncUxNameInput();
    }
  });
  refreshUxStudentEntry();
  ["#studentRoomCode", "#studentName"].forEach((selector) => {
    document.querySelector(selector).addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) enterStudent();
    });
  });
  const teacherDialog = document.querySelector("#teacherEntryDialog");
  const clearTeacherEntry = () => {
    teacherDialog.querySelector("#teacherPassword").value = "";
    teacherDialog.querySelector("#teacherEntryStatus").textContent = "";
  };
  document.querySelector("#openTeacherEntryBtn").addEventListener("click", () => teacherDialog.showModal());
  document.querySelector("#closeTeacherEntryBtn").addEventListener("click", () => {
    if (state.teacherSigningIn) return;
    clearTeacherEntry();
    teacherDialog.close();
  });
  teacherDialog.addEventListener("cancel", (event) => {
    if (state.teacherSigningIn) event.preventDefault();
    else clearTeacherEntry();
  });
  teacherDialog.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("#teacherPassword, #teacherRoomCode") && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      enterTeacher();
    }
  });
  document.querySelector("#teacherEnterBtn").addEventListener("click", enterTeacher);
  const syncTeacherEntry = () => {
    const create = document.querySelector('input[name="teacherEntryIntent"]:checked')?.value === "create";
    document.querySelector("#uxTeacherCreateFields").hidden = !create;
    document.querySelector("#newRoomCodeBtn").hidden = !create;
    document.querySelector("#teacherRoomCode").placeholder = create ? "비워 두면 자동 생성" : "기존 방 코드";
    document.querySelector("#uxRecentRoomsField").hidden = create || !getRecentTeacherRooms().length;
  };
  teacherDialog.querySelectorAll('input[name="teacherEntryIntent"]').forEach((input) => input.addEventListener("change", syncTeacherEntry));
  document.querySelector("#uxRecentRooms").addEventListener("change", (event) => { if (event.target.value) document.querySelector("#teacherRoomCode").value = event.target.value; });
  syncTeacherEntry();
  document.querySelector("#newRoomCodeBtn").addEventListener("click", () => {
    document.querySelector("#teacherRoomCode").value = generateRoomCode();
  });
  finalRelease?.decorate();
  decorateSecurePilot();
}

function renderStudentRoute() {
  if (!state.room) {
    setView("student-loading", `<section class="screen"><div class="panel"><h2>방 정보를 불러오는 중입니다.</h2></div></section>`);
    return;
  }

  if (getRoomMode() === "compliment") {
    renderComplimentStudentRoute();
    return;
  }

  if (getRoomMode() === "mafia") {
    renderMafiaStudentRoute();
    return;
  }

  if (getRoomMode() === "liar") {
    renderLiarStudentRoute();
    return;
  }

  if (getRoomMode() !== "memory" && state.unsubscribeMemoryPlayer) {
    clearMemoryPlayerSubscription();
  }

  if (getRoomMode() === "catchmind") {
    renderCatchmindStudentRoute();
    return;
  }

  if (getRoomMode() === "seat") {
    renderSeatStudentRoute();
    return;
  }

  if (getRoomMode() === "memory") {
    renderMemoryStudentRoute();
    return;
  }

  if (getRoomMode() === "bingo") {
    renderBingoStudentRoute();
    return;
  }

  if (getRoomMode() === "word") {
    renderWordChallengeStudentRoute();
    return;
  }

  const status = state.room.status || "waiting";

  if (status === "waiting") {
    const ownQuestions = findQuestionsByStudent();
    if (state.activeView === "student-question") {
      updateStudioQuestionQuota();
      return;
    }
    if (!ownQuestions.length) {
      renderStudentQuestionForm();
      return;
    }
    renderStudentWaiting(true);
    return;
  }

  if (status === "playing") {
    renderStudentQuiz(false);
    return;
  }

  if (status === "result") {
    renderStudentResult(true);
    return;
  }

  if (status === "finished") {
    renderFinalResult("student-final", false, true);
    return;
  }

  renderStudentWaiting(true);
}

function renderStudentQuestionForm(existingQuestion = null) {
  const editingQuestion = existingQuestion;
  const questionType = getQuestionType(editingQuestion);
  const choices = normalizeChoices(editingQuestion?.choices);
  const correctIndex = Number.isInteger(editingQuestion?.correctIndex) ? editingQuestion.correctIndex : -1;

  setView("student-question", `
    <section class="screen studio-preparation studio-maker">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>
      ${renderStudioHeading("PLAY STUDIO", editingQuestion ? "퀴즈 문제 수정" : "퀴즈 문제 만들기", "creators/quiz-creator", `<div id="studioQuestionQuota"></div>`)}
      <form id="questionForm" class="studio-composer">
        <section class="panel studio-editor" aria-label="문제 작성">
          <input id="editingQuestionId" type="hidden" value="${escapeAttr(editingQuestion?.id || "")}" />
          <div class="field">
            <label for="authorName">이름</label>
            <input id="authorName" value="${escapeAttr(state.studentName)}" readonly />
          </div>

          <div class="field">
            <span class="label">문제 유형</span>
            <div class="segmented question-type-options">
              <label class="radio-tile"><input type="radio" name="questionType" value="choice" ${questionType === "choice" ? "checked" : ""} /><span>4지선다</span></label>
              <label class="radio-tile"><input type="radio" name="questionType" value="short" ${questionType === "short" ? "checked" : ""} /><span>주관식</span></label>
            </div>
          </div>

          <div class="field">
            <div class="studio-field-heading"><label for="questionText">문제</label><span class="studio-counter" data-studio-count-for="questionText"></span></div>
            <textarea id="questionText" maxlength="160" placeholder="예: 내가 가장 좋아하는 음식은 무엇일까요?" required>${escapeHtml(editingQuestion?.question || "")}</textarea>
          </div>

          <div id="choiceQuestionFields" ${questionType === "choice" ? "" : "hidden"}>
            <div class="studio-choice-inputs">
              ${[0, 1, 2, 3].map((index) => `
                <div class="studio-choice-row" data-choice-number="${index}">
                  <div class="field">
                  <div class="studio-field-heading"><label for="choice${index}">선택지 ${index + 1}</label><span class="studio-counter" data-studio-count-for="choice${index}"></span></div>
                  <input id="choice${index}" maxlength="80" value="${escapeAttr(choices[index] || "")}" />
                  </div>
                  <label class="studio-answer-radio"><input type="radio" name="correctIndex" value="${index}" aria-label="선택지 ${index + 1}을 정답으로 지정" ${correctIndex === index ? "checked" : ""} /> 정답</label>
                </div>
              `).join("")}
            </div>
          </div>

          <div id="shortQuestionFields" class="field" ${questionType === "short" ? "" : "hidden"}>
            <div class="studio-field-heading"><label for="correctAnswer">주관식 정답</label><span class="studio-counter" data-studio-count-for="correctAnswer"></span></div>
            <input id="correctAnswer" maxlength="80" value="${escapeAttr(editingQuestion?.correctAnswer || "")}" placeholder="정답을 입력하세요" />
            <p class="muted small">띄어쓰기와 영문 대소문자는 다르게 써도 같은 정답으로 채점합니다.</p>
          </div>
        </section>
        <aside class="studio-composer-aside">
          <details class="panel studio-preview" open>
            <summary>문제 미리보기</summary>
            <div class="studio-preview-body">
              <span id="studioPreviewType" class="pill blue"></span>
              <h3 id="studioPreviewQuestion"></h3>
              <ol id="studioPreviewChoices" class="studio-preview-choices">${[0, 1, 2, 3].map((index) => `<li data-choice-number="${index}"><b>${index + 1}</b><span data-studio-preview-choice="${index}"></span><small hidden>정답</small></li>`).join("")}</ol>
              <p id="studioPreviewAnswer" class="notice success" hidden></p>
            </div>
          </details>
          <details class="panel studio-tips">
            <summary>문제 작성 팁</summary>
            ${renderArcadeArt("studio/states/creator-tips", [512, 512], "studio-tip-art")}
            <p>자기 자신에 대한 가벼운 문제를 만들어 주세요. 좋아하는 음식, 취미, 가고 싶은 나라, 좋아하는 색깔, 쉬는 시간에 자주 하는 일처럼 친구들이 즐겁게 맞힐 수 있는 주제가 좋습니다.</p>
          </details>
          <p class="notice warn">집주소, 전화번호, 가족 사정, 외모, 몸무게, 성적, 돈, 건강, 연애, 특정 친구를 놀리는 내용은 쓰지 않습니다.</p>
        </aside>
          <div class="button-row studio-composer-actions">
            <button class="btn primary" type="submit">${editingQuestion ? "문제 수정 제출" : "새 문제 제출"}</button>
            ${editingQuestion || findQuestionsByStudent().length ? `<button class="btn ghost" id="goWaitingBtn" type="button">대기 화면</button>` : ""}
          </div>
      </form>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
    const form = document.querySelector("#questionForm");
    bindStudioSubmit(form, submitQuestion);
    document.querySelector("#goWaitingBtn")?.addEventListener("click", () => renderStudentWaiting(true));
    setupQuestionTypeFields();
    form.addEventListener("input", updateStudioQuestionPreview);
    form.addEventListener("change", updateStudioQuestionPreview);
    updateStudioQuestionPreview();
  });
}

function renderStudentWaiting(force = false) {
  const questions = getQuestions();
  const students = getStudents();
  const connectedCount = students.filter((student) => student.connected).length;
  const ownQuestions = findQuestionsByStudent();
  const maxQuestions = getMaxQuestionsPerStudent();
  const canAddMoreQuestions = ownQuestions.length < maxQuestions;

  setView("student-waiting", `
    <section class="screen studio-preparation studio-waiting">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>

      ${renderStudioHeading("PLAY STUDIO", "문제가 제출되었습니다", "states/submission-complete", renderStudioSlots(ownQuestions.length, maxQuestions, "내 문제"))}
        <div class="stats">
          <div class="stat">
            <span class="muted">제출된 문제</span>
            <span class="num">${questions.length}</span>
          </div>
          <div class="stat">
            <span class="muted">현재 접속 학생</span>
            <span class="num">${connectedCount}</span>
          </div>
          <div class="stat">
            <span class="muted">내 누적 점수</span>
            <span class="num">${getMyScore()}</span>
          </div>
        </div>
        <div class="notice info">선생님이 게임을 시작하면 자동으로 이동합니다.</div>
        <section class="panel studio-collection">
          <div class="status-bar">
            <div>
              <h3>내가 제출한 문제</h3>
              <p class="muted small">추가 가능 ${Math.max(0, maxQuestions - ownQuestions.length)}개</p>
            </div>
            <button class="btn primary" id="addQuestionBtn" type="button" ${canAddMoreQuestions ? "" : "disabled"}>문제 추가</button>
          </div>
          ${ownQuestions.length ? `
            <ul class="list">
              ${ownQuestions.map((question, index) => `
                <li class="list-row split">
                  <div>
                    <p class="muted small">내 문제 ${index + 1} · ${getQuestionType(question) === "short" ? "주관식" : "4지선다"}</p>
                    <strong>${escapeHtml(question.question)}</strong>
                  </div>
                  <button class="btn ghost" data-edit-own-question="${escapeAttr(question.id)}" type="button">수정</button>
                </li>
              `).join("")}
            </ul>
          ` : `<div class="empty">아직 제출한 문제가 없습니다.</div>`}
        </section>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
    document.querySelector("#addQuestionBtn")?.addEventListener("click", () => renderStudentQuestionForm());
    document.querySelectorAll("[data-edit-own-question]").forEach((button) => {
      button.addEventListener("click", () => {
        const question = ownQuestions.find((item) => item.id === button.dataset.editOwnQuestion);
        if (question) {
          renderStudentQuestionForm(question);
        }
      });
    });
  }, force);
}

function renderComplimentStudentRoute() {
  const status = state.room.status || "waiting";

  if (status === "waiting" || status === "collecting") {
    const ownCompliments = findComplimentsByAuthor(state.studentId);
    if (state.activeView === "compliment-form") {
      refreshComplimentTargetSelect();
      updateStudioComplimentQuota();
      return;
    }
    if (!ownCompliments.length) {
      renderComplimentForm();
      return;
    }
    renderComplimentWaiting(true);
    return;
  }

  if (status === "playing") {
    renderComplimentTargetGuess(true);
    return;
  }

  if (status === "targetReveal") {
    renderComplimentTargetReveal(true);
    return;
  }

  if (status === "authorGuess") {
    renderComplimentAuthorGuess(true);
    return;
  }

  if (status === "authorReveal") {
    renderComplimentCardResult("student-compliment-result", false, true);
    return;
  }

  if (status === "finished") {
    renderFinalResult("student-final", false, true);
    return;
  }

  renderComplimentWaiting(true);
}

function renderComplimentForm(existingCompliment = null) {
  const editingCompliment = existingCompliment;
  const targetOptions = getComplimentTargetOptions(editingCompliment);
  const selectedTargetId = editingCompliment?.targetStudentId || "";
  const clues = normalizeComplimentClues(editingCompliment?.clues);

  setView("compliment-form", `
    <section class="screen compliment-mode studio-preparation studio-maker">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill gold">칭찬 스무고개</span>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>

      ${renderStudioHeading("PLAY STUDIO", editingCompliment ? "칭찬 카드 수정" : "칭찬 카드 만들기", "creators/compliment-creator", `<div id="studioComplimentQuota"></div>`)}
      <div class="studio-composer studio-compliment-composer">
        <aside class="panel tight warm-panel">
          <h2>칭찬 카드 만들기</h2>
          <div class="notice info">
            친구를 놀리거나 평가하는 것이 아니라, 친구의 좋은 점을 찾아 칭찬하는 활동입니다. 칭찬을 듣는 친구가 기분 좋아질 수 있는 내용으로 적어 주세요.
          </div>
          <div class="notice warn">
            외모, 몸무게, 성적, 돈, 집안 사정, 건강, 연애, 비밀, 특정 친구를 놀리는 내용은 쓰지 않습니다.
          </div>
          <div class="notice info">
            친절하다, 말을 잘 들어준다, 맡은 일을 잘한다, 분위기를 밝게 만든다, 노력하는 모습이 좋다, 친구를 잘 챙긴다, 수업에 열심히 참여한다 등
          </div>
          <p class="muted small">한 학생은 최대 ${getMaxComplimentsPerStudent()}개의 칭찬 카드를 제출할 수 있고, 같은 친구를 여러 번 선택하지 않는 것을 권장합니다.</p>
        </aside>

        <form id="complimentForm" class="panel studio-editor">
          <input id="editingComplimentId" type="hidden" value="${escapeAttr(editingCompliment?.id || "")}" />
          <div class="field">
            <label for="complimentAuthorName">내 이름</label>
            <input id="complimentAuthorName" value="${escapeAttr(state.studentName)}" readonly />
          </div>

          <div class="field">
            <label for="complimentTarget">칭찬할 친구 선택</label>
            <select id="complimentTarget" required ${targetOptions.length ? "" : "disabled"}>
              ${renderComplimentTargetOptionHtml(targetOptions, selectedTargetId)}
            </select>
            <p id="complimentTargetHelp" class="muted small" ${targetOptions.length ? "hidden" : ""}>다른 친구가 방에 입장하면 칭찬 대상을 선택할 수 있습니다.</p>
          </div>

          <div class="form-grid">
            ${[0, 1, 2, 3, 4].map((index) => `
              <div class="field studio-letter">
                <div class="studio-field-heading"><label for="complimentClue${index}">칭찬 단서 ${index + 1}${index === 4 ? " · 선택" : ""}</label><span class="studio-counter" data-studio-count-for="complimentClue${index}"></span></div>
                <textarea id="complimentClue${index}" maxlength="120" placeholder="${index === 0 ? "예: 이 친구는 친구 말을 잘 들어준다." : ""}" ${index < 4 ? "required" : ""}>${escapeHtml(clues[index] || "")}</textarea>
              </div>
            `).join("")}
          </div>

          <div class="button-row">
            <button class="btn primary" id="complimentSubmitBtn" type="submit" ${targetOptions.length ? "" : "disabled"}>${editingCompliment ? "칭찬 카드 수정" : "칭찬 카드 제출"}</button>
            ${editingCompliment ? `<button class="btn ghost" id="goComplimentWaitingBtn" type="button">대기 화면</button>` : ""}
          </div>
        </form>
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
    const form = document.querySelector("#complimentForm");
    bindStudioSubmit(form, submitCompliment);
    form.addEventListener("input", () => updateStudioCounters(form));
    updateStudioCounters(form);
    updateStudioComplimentQuota();
    document.querySelector("#goComplimentWaitingBtn")?.addEventListener("click", () => renderComplimentWaiting(true));
  });
}

function renderComplimentWaiting(force = false) {
  const compliments = getCompliments();
  const students = getStudents();
  const connectedCount = state.room.pilotConnectedCount ?? students.filter((student) => student.connected).length;
  const ownCompliments = findComplimentsByAuthor(state.studentId);
  const maxCompliments = getMaxComplimentsPerStudent();
  const canAddMoreCompliments = ownCompliments.length < maxCompliments && getComplimentTargetOptions().length > 0;

  setView("compliment-waiting", `
    <section class="screen compliment-mode studio-preparation studio-waiting">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill gold">칭찬 스무고개</span>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>

      ${renderStudioHeading("PLAY STUDIO", "칭찬 카드가 제출되었습니다", "states/submission-complete", renderStudioSlots(ownCompliments.length, maxCompliments, "내 칭찬 카드"))}
        <div class="stats">
          <div class="stat">
            <span class="muted">제출된 칭찬 카드</span>
            <span class="num">${state.room.pilotComplimentCount ?? compliments.length}</span>
          </div>
          <div class="stat">
            <span class="muted">현재 접속 학생</span>
            <span class="num">${connectedCount}</span>
          </div>
          <div class="stat">
            <span class="muted">내 누적 점수</span>
            <span class="num">${getMyScore()}</span>
          </div>
        </div>
        <div class="notice info">선생님이 게임을 시작하면 자동으로 이동합니다.</div>
        <section class="panel studio-collection">
          <div class="status-bar">
            <div>
              <h3>내가 작성한 칭찬 카드</h3>
              <p class="muted small">${ownCompliments.length} / ${maxCompliments}개 제출</p>
            </div>
            <button class="btn primary" id="addComplimentBtn" type="button" ${canAddMoreCompliments ? "" : "disabled"}>칭찬 카드 추가</button>
          </div>
          ${ownCompliments.length ? `
            <ul class="list">
              ${ownCompliments.map((compliment, index) => `
                <li class="list-row split">
                  <div>
                    <p class="muted small">내 칭찬 ${index + 1} · 대상 ${escapeHtml(compliment.targetName)}</p>
                    <strong>${escapeHtml(normalizeComplimentClues(compliment.clues)[0] || "칭찬 단서")}</strong>
                  </div>
                  <button class="btn ghost" data-edit-own-compliment="${escapeAttr(compliment.id)}" type="button">수정</button>
                </li>
              `).join("")}
            </ul>
          ` : `<div class="empty">아직 제출한 칭찬 카드가 없습니다.</div>`}
        </section>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
    document.querySelector("#addComplimentBtn")?.addEventListener("click", () => renderComplimentForm());
    document.querySelectorAll("[data-edit-own-compliment]").forEach((button) => {
      button.addEventListener("click", () => {
        const compliment = ownCompliments.find((item) => item.id === button.dataset.editOwnCompliment);
        if (compliment) {
          renderComplimentForm(compliment);
        }
      });
    });
  }, force);
}

function renderComplimentTargetGuess(force = false) {
  const compliment = getCurrentCompliment();
  if (!compliment) {
    renderComplimentWaiting(true);
    return;
  }

  const clueIndex = Number(state.room.currentClueIndex || 0);
  const clues = normalizeComplimentClues(compliment.clues);
  const visibleClues = clues.slice(0, clueIndex + 1);
  const answer = getMyComplimentTargetAnswer(compliment.id);
  const guessedThisClue = answer?.guesses?.[clueIndex];
  const alreadyCorrect = Number.isInteger(answer?.firstCorrectClueIndex);
  const authorBlocked = securePilot ? state.room.pilotComplimentAuthorBlocked : compliment.authorStudentId === state.studentId;
  const options = getComplimentGuessOptions(compliment);
  const disabled = authorBlocked || alreadyCorrect || Boolean(guessedThisClue);

  setView(`compliment-target-${compliment.id}-${clueIndex}`, `
    <section class="screen compliment-mode experience-letter">
      <div class="status-bar">
        <span class="pill gold">칭찬 ${Number(state.room.currentComplimentIndex || 0) + 1} / ${state.room.pilotComplimentCount ?? getCompliments().length}</span>
        <span class="pill blue">단서 ${clueIndex + 1} / ${state.room.pilotComplimentClueCount ?? clues.length}</span>
        <span class="pill green">내 점수 ${getMyScore()}점</span>
      </div>

      <section class="panel warm-panel">
        ${renderExperienceHeading("대상 추리", "칭찬 대상은 누구일까요?", visibleClues.length > 1 ? "compliment/opened-letter" : "compliment/sealed-letter")}
        ${renderComplimentClueCards(visibleClues)}
      </section>

      ${authorBlocked ? `<div class="notice warn">내가 작성한 칭찬입니다. 이 문제는 맞힐 수 없습니다.</div>` : ""}
      ${alreadyCorrect ? `<div class="notice info">이미 이 칭찬의 대상을 맞혔습니다. 다음 단계까지 기다려 주세요.</div>` : ""}
      ${guessedThisClue && !alreadyCorrect ? `<div class="notice info">이번 단서에서는 이미 추리했습니다. 다음 단서가 공개되면 다시 도전할 수 있습니다.</div>` : ""}

      <section class="panel">
        <h3>칭찬 대상 선택</h3>
        ${renderStudentChoiceButtons(options, "target-student", disabled, guessedThisClue?.selectedStudentId)}
      </section>
    </section>
  `, () => {
    document.querySelectorAll("[data-target-student]").forEach((button) => {
      button.addEventListener("click", () => submitComplimentTargetGuess(button.dataset.targetStudent));
    });
  }, force);
}

function renderComplimentTargetReveal(force = false) {
  const compliment = getCurrentCompliment();
  if (!compliment) {
    renderComplimentWaiting(true);
    return;
  }

  setView(`compliment-target-reveal-${compliment.id}`, `
    <section class="screen compliment-mode experience-letter">
      <div class="panel warm-panel">
        ${renderExperienceHeading("칭찬 대상 공개", compliment.targetName, "compliment/opened-letter")}
        <p class="lead">이 칭찬의 주인공입니다. 칭찬 대상 보너스 ${COMPLIMENT_TARGET_BONUS}점이 반영됩니다.</p>
        ${renderComplimentClueCards(normalizeComplimentClues(compliment.clues))}
      </div>
      <div class="notice info">선생님이 작성자 추리 라운드를 시작하면 자동으로 이동합니다.</div>
    </section>
  `, null, force);
}

function renderComplimentAuthorGuess(force = false) {
  const compliment = getCurrentCompliment();
  if (!compliment) {
    renderComplimentWaiting(true);
    return;
  }

  const authorBlocked = securePilot ? state.room.pilotComplimentAuthorBlocked : compliment.authorStudentId === state.studentId;
  const answer = getMyComplimentAuthorAnswer(compliment.id);
  const options = getComplimentGuessOptions(compliment);

  setView(`compliment-author-${compliment.id}`, `
    <section class="screen compliment-mode experience-letter">
      <div class="status-bar">
        <span class="pill gold">작성자 추리</span>
        <span class="pill green">내 점수 ${getMyScore()}점</span>
      </div>

      <section class="panel warm-panel">
        ${renderExperienceHeading(`칭찬 대상 ${compliment.targetName}`, "이 칭찬을 쓴 사람은 누구일까요?", "compliment/opened-letter")}
        ${renderComplimentClueCards(normalizeComplimentClues(compliment.clues))}
      </section>

      ${authorBlocked ? `<div class="notice warn">내가 작성한 칭찬입니다. 작성자 추리에 참여할 수 없습니다.</div>` : ""}
      ${answer ? `<div class="notice info">작성자 추리를 제출했습니다. 선생님이 정답을 공개할 때까지 기다려 주세요.</div>` : ""}

      <section class="panel">
        <h3>작성자 선택</h3>
        ${renderStudentChoiceButtons(options, "author-student", authorBlocked || Boolean(answer), answer?.selectedStudentId)}
      </section>
    </section>
  `, () => {
    document.querySelectorAll("[data-author-student]").forEach((button) => {
      button.addEventListener("click", () => submitComplimentAuthorGuess(button.dataset.authorStudent));
    });
  }, force);
}

function renderComplimentCardResult(viewName, showTeacherControls, force = false) {
  const compliment = getCurrentCompliment();
  if (!compliment) {
    renderFinalResult(viewName, showTeacherControls, force);
    return;
  }

  setView(viewName, `
    <section class="screen compliment-mode">
      <div class="status-bar">
        <span class="pill gold">칭찬 카드 결과</span>
        ${showTeacherControls ? `
          <div class="button-row">
            <button class="btn success" data-action="compliment-next-card" type="button">다음 칭찬으로 이동</button>
            <button class="btn ghost" data-action="finish" type="button">최종 랭킹 보기</button>
          </div>
        ` : ""}
      </div>

      <section class="panel warm-panel">
        ${renderExperienceHeading("칭찬 대상", compliment.targetName, "compliment/heart-reveal")}
        <p class="lead">작성자: <strong>${escapeHtml(compliment.authorName)}</strong></p>
        ${renderComplimentClueCards(normalizeComplimentClues(compliment.clues))}
      </section>

      <div class="grid-2">
        <section class="panel">
          <h3>이번 칭찬 점수</h3>
          ${renderComplimentScoreEvents(compliment)}
        </section>
        <section class="panel">
          <h3>현재 누적 랭킹</h3>
          ${renderRanking(getCumulativeRanking().slice(0, 8))}
        </section>
      </div>
    </section>
  `, () => {
    document.querySelector("[data-action='compliment-next-card']")?.addEventListener("click", nextComplimentCard);
    document.querySelector("[data-action='finish']")?.addEventListener("click", finishGame);
  }, force);
}

function renderMafiaStudentRoute() {
  const status = state.room.status || "waiting";

  if (status === "waiting") {
    renderMafiaStudentWaiting(true);
    return;
  }

  if (!getMafiaPlayer(state.studentId)) {
    renderMafiaUnassigned(true);
    return;
  }

  const player = getMafiaPlayer(state.studentId);
  if (status !== "finished" && player && !player.alive) {
    ensureMafiaGhostEntry(player);
    renderMafiaGhostMode(false);
    return;
  }

  if (status === "roleAssigned" || status === "roleReveal") {
    renderMafiaRoleReveal(true);
    return;
  }

  if (status === "nightAction") {
    renderMafiaNightAction(true);
    return;
  }

  if (status === "nightResult") {
    renderMafiaNightResult(true);
    return;
  }

  if (status === "discussion") {
    renderMafiaDiscussion(true);
    return;
  }

  if (status === "voting") {
    renderMafiaVoting(true);
    return;
  }

  if (status === "voteResult") {
    renderMafiaVoteResult(true);
    return;
  }

  if (status === "roleRevealDead") {
    renderMafiaRoleRevealDead(true);
    return;
  }

  if (status === "finished") {
    renderMafiaFinalResult("student-mafia-final", false, true);
    return;
  }

  renderMafiaStudentWaiting(true);
}

function renderMafiaStudentWaiting(force = false) {
  const students = getStudents();
  const connectedCount = state.room.pilotConnectedCount ?? students.filter((student) => student.connected).length;

  setView("mafia-student-waiting", `
    <section class="screen mafia-mode">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill red">교실 마피아 게임</span>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>

      <div class="panel mafia-panel">
        <h2>선생님이 게임을 시작할 때까지 기다려 주세요.</h2>
        <p class="lead">현재 입장한 학생은 ${students.length}명, 접속 중인 학생은 ${connectedCount}명입니다.</p>
        <div class="notice info">
          이 게임은 패드로 진행하는 마피아 게임입니다. 자기 역할은 다른 친구에게 보여 주지 않습니다. 밤 행동과 투표는 패드로 하고, 실제 말하기는 낮 토론 시간에만 합니다.
        </div>
        <div class="notice warn">
          친구를 비난하거나 몰아가는 말은 하지 않습니다. 말과 행동을 근거로 추리하고, 장난이 심해지면 게임을 중단할 수 있습니다.
        </div>
        <div class="notice info">탈락자는 이후 말하거나 투표하지 않고 유령 모드에서 빙고와 유령 채팅에 참여합니다.</div>
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
  }, force);
}

function renderMafiaUnassigned(force = false) {
  setView("mafia-unassigned", `
    <section class="screen mafia-mode">
      <div class="panel mafia-panel">
        <h2>이번 게임의 역할이 아직 배정되지 않았습니다.</h2>
        <p class="lead">선생님이 게임을 초기화하거나 역할을 다시 배정할 때까지 기다려 주세요.</p>
      </div>
    </section>
  `, null, force);
}

function renderMafiaRoleReveal(force = false) {
  const player = getMafiaPlayer(state.studentId);
  const sameMafia = getMafiaPlayers().filter((item) => item.role === "mafia" && item.id !== player.id);

  setView("mafia-role-reveal", `
    <section class="screen mafia-mode">
      <div class="status-bar">
        <span class="pill red">비밀 역할</span>
        <span class="pill ${player.alive ? "green" : "red"}">${player.alive ? "생존" : "탈락"}</span>
      </div>

      <div class="panel mafia-panel role-reveal-card role-${escapeAttr(player.role)}">
        <div class="arcade-role-layout">
          <div><p class="eyebrow">다른 친구에게 보여 주지 마세요</p>
          <h1>당신은 ${roleLabel(player.role)}입니다.</h1>
          <p class="lead">${escapeHtml(roleDescription(player.role))}</p></div>
          ${["mafia", "police", "doctor", "citizen"].includes(player.role) ? renderArcadeArt(`games/mafia/roles/${player.role}`, [443, 520]) : ""}
        </div>
        ${player.role === "mafia" ? `
          <div class="notice warn">
            <strong>같은 마피아</strong>
            <p>${sameMafia.length ? sameMafia.map((item) => escapeHtml(item.name)).join(", ") : "혼자 남은 마피아입니다."}</p>
          </div>
        ` : ""}
      </div>
    </section>
  `, null, force);
}

function renderMafiaNightAction(force = false) {
  const player = getMafiaPlayer(state.studentId);
  if (!player?.alive) {
    renderMafiaSpectator("밤 행동", "당신은 탈락했습니다. 이제부터 관전만 가능합니다.", force);
    return;
  }

  const round = getCurrentMafiaRound();
  const action = getMafiaNightAction(player.id, player.role);
  const canSelectSelf = player.role === "doctor";
  const options = getMafiaSelectablePlayers(player.id, { allowSelf: canSelectSelf });
  const disabled = Boolean(action);

  if (!securePilot && isMafiaNightComplete() && !round.nightResult) {
    calculateMafiaNightResult();
  }

  setView(`mafia-night-${getMafiaRoundNumber()}-${player.id}-${Boolean(action)}`, `
    <section class="screen mafia-mode experience-night">
      <div class="status-bar">
        <span class="pill red">${getMafiaRoundNumber()}번째 밤 행동</span>
        <span class="pill green">내 역할 ${roleLabel(player.role)}</span>
      </div>

      <div class="panel mafia-panel">
        ${renderExperienceHeading("비밀 행동", "밤 행동 시간입니다", ({ mafia: "mafia/mafia-action", police: "mafia/police-action", doctor: "mafia/doctor-action", citizen: "mafia/citizen-night" })[player.role])}
        <p class="lead">한 명을 선택하세요. 선택 후 변경할 수 없습니다.</p>
        ${canSelectSelf ? `<p class="muted">의사는 자기 자신도 보호 대상으로 선택할 수 있습니다.</p>` : ""}
        ${action ? `<div class="notice info">밤 행동을 완료했습니다. 모든 학생의 행동이 끝날 때까지 기다려 주세요.</div>` : ""}
        ${player.role === "police" && action?.result ? `
          <div class="notice ${action.result === "mafia" ? "danger" : "info"}">
            조사 결과: ${escapeHtml(action.selectedName)}은/는 ${action.result === "mafia" ? "마피아입니다." : "마피아가 아닙니다."}
          </div>
        ` : ""}
        ${player.role === "mafia" ? renderMafiaPartnerChoices(round) : ""}
        ${renderStudentChoiceButtons(options, "mafia-night-target", disabled, action?.selectedStudentId)}
      </div>
    </section>
  `, () => {
    document.querySelectorAll("[data-mafia-night-target]").forEach((button) => {
      button.addEventListener("click", () => submitMafiaNightAction(button.dataset.mafiaNightTarget));
    });
  }, force);
}

function renderMafiaNightResult(force = false) {
  const result = getCurrentMafiaRound().nightResult || {};
  const message = result.savedByDoctor
    ? "지난밤 마피아의 공격이 있었지만 아무도 탈락하지 않았습니다."
    : result.eliminatedName
      ? `지난밤 ${escapeHtml(result.eliminatedName)}이/가 탈락했습니다.`
      : "지난밤 아무도 탈락하지 않았습니다.";

  setView("mafia-night-result", `
    <section class="screen mafia-mode">
      <div class="panel mafia-panel result-panel">
        <span class="pill gold">낮 결과 발표</span>
        <h1>${message}</h1>
        ${getMafiaWinner() ? `<div class="notice success">${mafiaWinnerText(getMafiaWinner())}</div>` : `<p class="lead">이제 낮 토론을 준비합니다.</p>`}
      </div>
    </section>
  `, null, force);
}

function renderMafiaDiscussion(force = false) {
  const player = getMafiaPlayer(state.studentId);
  const isAlive = Boolean(player?.alive);

  setView("mafia-discussion", `
    <section class="screen mafia-mode experience-day">
      <div class="panel mafia-panel">
        <span class="pill blue">낮 토론</span>
        <h2>${isAlive ? "낮 토론 시간입니다." : "관전 중입니다."}</h2>
        <p class="lead">${isAlive ? "말과 행동을 바탕으로 마피아를 찾아보세요." : "탈락자는 말하거나 투표할 수 없습니다."}</p>
        <div class="notice warn">친구를 몰아가거나 비난하지 말고, 근거를 들어 말해 주세요.</div>
        <div class="timer-wrap">
          <div class="timer-top">
            <span>토론 남은 시간</span>
            <span id="mafiaDiscussionTimerText">${getMafiaSettings().discussionSeconds}초</span>
          </div>
          <div class="timer-track"><div id="mafiaDiscussionTimerFill" class="timer-fill"></div></div>
        </div>
      </div>
    </section>
  `, () => {
    startTimer({
      startedAt: getMafiaState().discussionStartedAt,
      limit: getMafiaSettings().discussionSeconds,
      textSelector: "#mafiaDiscussionTimerText",
      fillSelector: "#mafiaDiscussionTimerFill"
    });
  }, force);
}

function renderMafiaVoting(force = false) {
  const player = getMafiaPlayer(state.studentId);
  if (!player?.alive) {
    renderMafiaSpectator("투표", "당신은 탈락했습니다. 관전만 가능합니다.", force);
    return;
  }

  const vote = getMafiaVote(player.id);
  const options = getMafiaSelectablePlayers(player.id);

  setView(`mafia-voting-${getMafiaRoundNumber()}-${Boolean(vote)}`, `
    <section class="screen mafia-mode experience-vote">
      <div class="panel mafia-panel">
        <span class="pill blue">비밀 투표</span>
        <h2>최종 지목할 친구를 선택하세요.</h2>
        <p class="lead">생존자 중 한 명에게 투표합니다. 자기 자신에게는 투표할 수 없습니다.</p>
        ${vote ? `<div class="notice info">투표를 완료했습니다. 모두의 투표가 끝날 때까지 기다려 주세요.</div>` : ""}
        ${renderExperienceProgress("투표 완료", securePilot ? getMafiaState().voteCount ?? 0 : Object.keys(getCurrentMafiaRound().votes || {}).length, getMafiaPlayers().filter((item) => item.alive).length)}
        ${renderStudentChoiceButtons(options, "mafia-vote-target", Boolean(vote), vote?.selectedStudentId)}
      </div>
    </section>
  `, () => {
    document.querySelectorAll("[data-mafia-vote-target]").forEach((button) => {
      button.addEventListener("click", () => submitMafiaVote(button.dataset.mafiaVoteTarget));
    });
  }, force);
}

function renderMafiaVoteResult(force = false) {
  const result = getCurrentMafiaRound().voteResult || {};
  const title = result.revotedTieSkipped
    ? "재투표도 동점이라 아무도 탈락하지 않았습니다."
    : result.revotedTieRequired
      ? "동점입니다. 재투표가 필요합니다."
      : result.eliminatedName
        ? `이번 투표에서 ${escapeHtml(result.eliminatedName)}이/가 최종 지목되었습니다.`
        : "이번 투표에서는 아무도 탈락하지 않았습니다.";

  setView("mafia-vote-result", `
    <section class="screen mafia-mode">
      <div class="panel mafia-panel result-panel">
        <span class="pill gold">투표 결과</span>
        <h1>${title}</h1>
        ${result.topVotedName ? `<p class="lead">가장 많은 표를 받은 사람: ${escapeHtml(result.topVotedName)}</p>` : ""}
        ${getMafiaWinner() ? `<div class="notice success">${mafiaWinnerText(getMafiaWinner())}</div>` : ""}
      </div>
    </section>
  `, null, force);
}

function renderMafiaRoleRevealDead(force = false) {
  const elimination = getLastMafiaElimination();
  const roleText = elimination?.role ? publicMafiaRoleLabel(elimination.role) : "알 수 없음";

  setView("mafia-role-dead", `
    <section class="screen mafia-mode">
      <div class="panel mafia-panel result-panel">
        <span class="pill red">정체 공개</span>
        <h1>${elimination?.name ? `${escapeHtml(elimination.name)}의 정체는 ${roleText}${roleText === "시민" ? "이었습니다" : "였습니다"}.` : "공개할 정체가 없습니다."}</h1>
        ${getMafiaWinner() ? `<div class="notice success">${mafiaWinnerText(getMafiaWinner())}</div>` : `<p class="lead">승리 조건이 충족되지 않았다면 다음 밤으로 진행합니다.</p>`}
      </div>
    </section>
  `, null, force);
}

function renderMafiaSpectator(label, message, force = false) {
  setView(`mafia-spectator-${label}`, `
    <section class="screen mafia-mode">
      <div class="panel mafia-panel">
        <span class="pill red">관전</span>
        <h2>${escapeHtml(message)}</h2>
        <p class="lead">탈락자는 이후 말하거나 투표하지 않고 유령 모드로 이동합니다.</p>
      </div>
    </section>
  `, null, force);
}

function renderMafiaGhostMode(force = false) {
  captureGhostChatDraft();
  const player = getMafiaPlayer(state.studentId);
  const ghost = getMafiaGhost(state.studentId);

  if (!player) {
    renderMafiaUnassigned(true);
    return;
  }

  if (!ghost) {
    ensureMafiaGhostEntry(player);
    setView("mafia-ghost-joining", `
      <section class="screen mafia-mode">
        <div class="panel mafia-panel">
          <span class="pill red">유령 모드</span>
          <h2>유령 모드로 이동하는 중입니다.</h2>
          <p class="lead">잠시만 기다려 주세요.</p>
        </div>
      </section>
    `, null, force);
    return;
  }

  if (ghost.bingoConfirmed) {
    syncGhostBingoProgress(ghost);
  }

  const viewKey = [
    "mafia-ghost",
    state.room.status || "waiting",
    Boolean(ghost.bingoConfirmed),
    getMafiaRoundNumber(),
    getGhostBingoRenderKey(ghost)
  ].join("-");

  const previousChat = document.querySelector("#ghostChatList");
  const previousInput = document.querySelector("#ghostChatInput");
  const wasFocused = previousInput && document.activeElement === previousInput;
  const caret = wasFocused ? [previousInput.selectionStart, previousInput.selectionEnd] : null;
  const previousScroll = previousChat?.scrollTop || 0;
  const pinned = !previousChat || previousChat.scrollHeight - previousChat.clientHeight - previousScroll < 32;
  if (!force && state.activeView === viewKey && previousChat) {
    const key = getGhostChatRenderKey({ ghost });
    if (previousChat.dataset.chatKey !== key) {
      previousChat.innerHTML = renderGhostChatMessages({ ghost });
      previousChat.dataset.chatKey = key;
      if (pinned) scrollGhostChatToBottom();
      else previousChat.scrollTop = previousScroll;
    }
    return;
  }

  setView(viewKey, `
    <section class="screen mafia-mode ghost-mode" data-ghost-panel="${activeGhostPanel}">
      <div class="status-bar">
        <div>
          <p class="eyebrow">사망자 전용</p>
          <h1>당신은 유령이 되었습니다.</h1>
        </div>
        <span class="pill ${statusPillClass(state.room.status || "waiting")}">${statusLabel(state.room.status || "waiting")}</span>
        ${renderExperienceArt("ghost/ghost-mascot", "ghost-hero-art")}
      </div>

      <div class="notice warn">
        생존자에게 게임 정보나 역할 정보를 전달해서는 안 됩니다. 유령 채팅은 사망자와 선생님만 보는 공간입니다.
      </div>

      ${renderMafiaGhostPublicStatus()}

      <div class="ghost-mobile-tabs" role="group" aria-label="유령 모드 보기">
        <button class="btn ghost" type="button" data-ghost-panel-tab="bingo" aria-controls="ghostBingoRegion" aria-pressed="${activeGhostPanel === "bingo"}">유령 빙고</button>
        <button class="btn ghost" type="button" data-ghost-panel-tab="chat" aria-controls="ghostChatRegion" aria-pressed="${activeGhostPanel === "chat"}">유령 채팅</button>
      </div>
      <div class="ghost-layout">
        <section class="panel mafia-panel" id="ghostBingoRegion">
          ${renderExperienceArt("ghost/ghost-bingo", "ghost-bingo-art")}
          ${ghost.bingoConfirmed ? renderGhostBingoLive(ghost) : renderGhostBingoBuilder(ghost)}
        </section>
        <section class="panel mafia-panel" id="ghostChatRegion">
          <h2>유령 전용 채팅</h2>
          ${renderGhostChatPanel({ teacher: false, ghost, allowSend: state.room.status !== "finished" })}
        </section>
      </div>
    </section>
  `, () => {
    const ghostScreen = document.querySelector(".ghost-mode");
    const tabs = [...ghostScreen.querySelectorAll("[data-ghost-panel-tab]")];
    for (const tab of tabs) tab.addEventListener("click", () => {
      if (activeGhostPanel === tab.dataset.ghostPanelTab) return;
      activeGhostPanel = tab.dataset.ghostPanelTab;
      ghostScreen.dataset.ghostPanel = activeGhostPanel;
      for (const item of tabs) item.setAttribute("aria-pressed", String(item === tab));
      if (activeGhostPanel === "chat") scrollGhostChatToBottom();
    });
    setupGhostBingoHandlers(ghost);
    setupGhostChatHandlers();
    if (pinned || state.ghostChatShouldFocus) scrollGhostChatToBottom({ focusInput: state.ghostChatShouldFocus });
    else document.querySelector("#ghostChatList").scrollTop = previousScroll;
    if (caret) {
      const input = document.querySelector("#ghostChatInput");
      input?.focus({ preventScroll: true });
      input?.setSelectionRange(...caret);
    }
  }, force);
}

function renderMafiaGhostPublicStatus() {
  const players = getMafiaPlayers();
  const aliveCount = players.filter((player) => player.alive).length;
  const round = getCurrentMafiaRound();
  const nightResult = round.nightResult || null;
  const voteResult = round.voteResult || null;
  const lastEvent = voteResult?.calculatedAt && (!nightResult?.calculatedAt || voteResult.calculatedAt >= nightResult.calculatedAt)
    ? `최근 투표: ${voteResult.eliminatedName ? `${escapeHtml(voteResult.eliminatedName)} 탈락` : voteResult.revotedTieRequired ? "동점 재투표 필요" : "탈락자 없음"}`
    : nightResult?.calculatedAt
      ? `최근 밤: ${nightResult.eliminatedName ? `${escapeHtml(nightResult.eliminatedName)} 탈락` : "탈락자 없음"}`
      : "아직 공개된 결과가 없습니다.";

  return `
    <section class="panel tight ghost-status-panel">
      <div class="stats">
        <div class="stat">
          <span class="muted">현재 라운드</span>
          <span class="num">${getMafiaRoundNumber()}</span>
        </div>
        <div class="stat">
          <span class="muted">생존자</span>
          <span class="num">${aliveCount}</span>
        </div>
        <div class="stat">
          <span class="muted">현재 단계</span>
          <span class="num">${statusLabel(state.room.status || "waiting")}</span>
        </div>
      </div>
      <p class="muted">${lastEvent}</p>
    </section>
  `;
}

function renderLiarStudentRoute() {
  const status = state.room.status || "waiting";

  if (status === "waiting") {
    renderLiarStudentWaiting(true);
    return;
  }

  if (status === "playing") {
    renderLiarStudentWord(true);
    return;
  }

  if (status === "voting") {
    renderLiarStudentVoting(true);
    return;
  }

  if (status === "voteResult") {
    renderLiarVoteResult("student-liar-vote-result", false, true);
    return;
  }

  if (status === "result" || status === "finished") {
    renderLiarRevealResult("student-liar-reveal", false, true);
    return;
  }

  renderLiarStudentWaiting(true);
}

function renderLiarStudentWaiting(force = false) {
  const students = getStudents();
  setView("liar-student-waiting", `
    <section class="screen liar-mode">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill blue">라이어게임</span>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>
      <div class="panel liar-panel">
        <h2>선생님이 라이어게임을 시작할 때까지 기다려 주세요.</h2>
        <p class="lead">현재 입장한 학생은 ${students.length}명입니다.</p>
        <div class="notice info">게임이 시작되면 내 제시어를 조용히 확인합니다. 자신이 라이어인지 아닌지는 표시되지 않습니다.</div>
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
  }, force);
}

function renderLiarStudentWord(force = false) {
  const assignment = getMyLiarAssignment();
  if (!assignment) {
    setView("liar-student-no-assignment", `
      <section class="screen liar-mode">
        <div class="panel liar-panel">
          <h2>이번 라이어게임 참가자로 배정되지 않았습니다.</h2>
          <p class="lead">선생님이 새 게임을 시작할 때까지 기다려 주세요.</p>
        </div>
      </section>
    `, null, force);
    return;
  }

  const confirmed = Boolean(getLiarConfirmation(state.studentId));
  const wordVisibleKey = `${state.room?.liar?.startedAt || "waiting"}:${state.studentId}`;
  const visible = Boolean(state.liarWordVisible && state.liarWordVisibleKey === wordVisibleKey);

  setView(`liar-word-${confirmed}-${visible}`, `
    <section class="screen liar-mode experience-file">
      <div class="status-bar">
        <span class="pill blue">라이어게임</span>
        <span class="pill ${confirmed ? "green" : "gold"}">${confirmed ? "제시어 확인 완료" : "제시어 확인 대기"}</span>
      </div>
      <div class="panel liar-panel word-card">
        ${renderExperienceArt("liar/secret-file", "experience-file-art")}
        <p class="eyebrow">다른 친구에게 화면을 보여 주지 마세요</p>
        ${visible ? `
          <h1>${escapeHtml(assignment.word)}</h1>
          <p class="lead">이 단어만 기억하세요. 자신이 라이어인지 아닌지는 공개되지 않습니다.</p>
          <button class="btn success" id="confirmLiarWordBtn" type="button">확인했어요</button>
        ` : `
          <h2>${confirmed ? "제시어 확인 완료" : "내 제시어 확인하기"}</h2>
          <p class="lead">${confirmed ? "필요하면 다시 확인할 수 있습니다." : "버튼을 누르면 제시어가 크게 표시됩니다."}</p>
          <button class="btn primary" id="showLiarWordBtn" type="button">${confirmed ? "제시어 다시 보기" : "내 제시어 확인하기"}</button>
        `}
      </div>
      <div class="notice info">교실에서 설명과 대화가 끝나면 선생님이 투표를 시작합니다.</div>
    </section>
  `, () => {
    document.querySelector("#showLiarWordBtn")?.addEventListener("click", () => {
      if (confirmed && !window.confirm("주변 친구에게 화면이 보이지 않게 한 뒤 다시 확인할까요?")) {
        return;
      }
      state.liarWordVisible = true;
      state.liarWordVisibleKey = wordVisibleKey;
      renderLiarStudentWord(true);
    });
    document.querySelector("#confirmLiarWordBtn")?.addEventListener("click", confirmLiarWord);
  }, force);
}

function renderLiarStudentVoting(force = false) {
  const assignment = getMyLiarAssignment();
  if (!assignment) {
    renderLiarStudentWaiting(true);
    return;
  }

  const vote = getMyLiarVote();
  const options = getLiarParticipants().filter((participant) => participant.id !== state.studentId);
  const selectedId = state.selectedLiarVoteTargetId;

  setView(`liar-voting-${Boolean(vote)}-${selectedId}`, `
    <section class="screen liar-mode experience-vote">
      <div class="status-bar">
        <span class="pill green">라이어 투표</span>
        <span class="pill blue">내 제시어 ${escapeHtml(assignment.word)}</span>
      </div>
      <div class="panel liar-panel">
        ${renderExperienceHeading("비밀 투표", vote ? "투표 완료" : "라이어라고 생각하는 친구를 선택하세요", "liar/suspect-search")}
        <p class="lead">${vote ? `${escapeHtml(vote.targetName)} 학생에게 투표했습니다. 변경할 수 없습니다.` : "본인에게는 투표할 수 없습니다."}</p>
        ${vote ? `<div class="notice success">선생님이 결과를 공개하면 자동으로 이동합니다.</div>` : renderLiarVoteChoices(options, selectedId)}
        ${!vote ? `<button class="btn primary" id="submitLiarVoteBtn" type="button" ${selectedId ? "" : "disabled"}>투표하기</button>` : ""}
      </div>
    </section>
  `, () => {
    document.querySelectorAll("[data-liar-vote-target]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedLiarVoteTargetId = button.dataset.liarVoteTarget;
        renderLiarStudentVoting(true);
        document.querySelector("[data-liar-vote-target][aria-pressed='true']")?.focus({ preventScroll: true });
      });
    });
    document.querySelector("#submitLiarVoteBtn")?.addEventListener("click", submitLiarVote);
  }, force);
}

function renderStudentQuiz(force = false) {
  const questions = getQuestions();
  const currentIndex = Number(state.room.currentQuestionIndex || 0);
  const question = questions[currentIndex];

  if (!question) {
    renderStudentWaiting(true);
    return;
  }

  const answer = getMyAnswer(question.id);
  const ownBlocked = !getUxQuizOptions().allowOwn && getQuestionOwnerId(state.room, question.id, question) === state.studentId;
  if (!securePilot && ownBlocked && !answer) {
    ensureOwnQuestionSkipped(question);
  }

  const total = state.room.pilotQuestionCount ?? questions.length;
  const number = state.room.pilotNumber ?? currentIndex + 1;
  const questionType = getQuestionType(question);
  const choices = normalizeChoices(question.choices);
  const disabled = Boolean(answer) || ownBlocked;
  if (state.quizShortAnswerQuestionId !== question.id) {
    state.quizShortAnswerQuestionId = question.id;
    state.quizShortAnswerDraft = "";
  }

  setView(`student-quiz-${question.id}-${Boolean(answer)}`, `
    <section class="quiz-stage experience-quiz">
      <div class="status-bar experience-quiz-progress">
        <span class="pill blue">${number} / ${total}</span>
        <span class="pill green">내 점수 ${getMyScore()}점</span>
      </div>

      <div class="timer-wrap experience-timer">
        <div class="timer-top">
          <span>남은 시간</span>
          <span id="studentTimerText">${state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS}초</span>
        </div>
        <div class="timer-track"><div id="studentTimerFill" class="timer-fill"></div></div>
      </div>

      <div class="quiz-question">
        <div class="question-meta">
          <span class="author-badge">출제자 ${escapeHtml(question.authorName || "익명")}</span>
          <span class="pill ${questionType === "short" ? "gold" : "blue"}">${questionType === "short" ? "주관식" : "4지선다"}</span>
        </div>
        <h2>${escapeHtml(question.question)}</h2>
      </div>

      ${ownBlocked ? `<div class="notice warn">내가 낸 문제라서 점수 대상이 아닙니다. 이 문제는 자동으로 0점 처리됩니다.</div>` : ""}
      ${answer && !answer.isSkipped ? `<div class="notice info experience-receipt" role="status"><strong>${renderExperienceIcon("check")} 답변 제출 완료</strong><span>정답 공개를 기다려 주세요.</span></div>` : ""}

      ${questionType === "short" ? `
        <form id="shortAnswerForm" class="panel short-answer-panel">
          <div class="field">
            <label for="shortAnswerInput">정답 입력</label>
            <input id="shortAnswerInput" maxlength="80" autocomplete="off" value="${escapeAttr(answer?.textAnswer || state.quizShortAnswerDraft)}" placeholder="정답을 입력하세요" ${disabled ? "disabled" : ""} />
          </div>
          <button class="btn primary full" type="submit" ${disabled ? "disabled" : ""}>정답 제출</button>
        </form>
      ` : `
        <div class="choices">
          ${choices.map((choice, index) => `
            <button class="choice-btn choice-${index} ${answer?.selectedIndex === index ? "selected" : ""}" data-answer-index="${index}" type="button" ${disabled ? "disabled" : ""}>
              <span class="choice-prefix">${index + 1}</span><span>${escapeHtml(choice)}</span>${answer?.selectedIndex === index ? `<span class="experience-choice-receipt">${renderExperienceIcon("check")} 제출됨</span>` : ""}
            </button>
          `).join("")}
        </div>
      `}
    </section>
  `, () => {
    document.querySelectorAll("[data-answer-index]").forEach((button) => {
      button.addEventListener("click", () => submitAnswer(Number(button.dataset.answerIndex)));
    });
    const shortInput = document.querySelector("#shortAnswerInput");
    shortInput?.addEventListener("input", () => {
      state.quizShortAnswerDraft = shortInput.value;
    });
    document.querySelector("#shortAnswerForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitAnswer(null, cleanText(shortInput?.value || ""));
    });
    startTimer({
      startedAt: state.room.questionStartedAt,
      limit: state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS,
      now: getUxRoomNow,
      textSelector: "#studentTimerText",
      fillSelector: "#studentTimerFill"
    });
  }, force);
}

function renderStudentResult(force = false) {
  const questions = getQuestions();
  const currentIndex = Number(state.room.currentQuestionIndex || 0);
  const question = questions[currentIndex];

  if (!question) {
    renderFinalResult("student-final", false, true);
    return;
  }

  const answer = getMyAnswer(question.id);
  const totalScore = getMyScore();
  const choices = normalizeChoices(question.choices);
  const questionType = getQuestionType(question);
  const correctText = getQuestionCorrectAnswerText(question);

  setView(`student-result-${question.id}`, `
    <section class="screen experience-quiz-result">
      <div class="status-bar">
        <span class="pill gold">문제 ${state.room.pilotNumber ?? currentIndex + 1} 결과</span>
        <span class="pill green">내 누적 ${totalScore}점</span>
      </div>

      <div class="panel">
        <div class="arcade-feedback" data-correct="${Boolean(answer?.isCorrect)}">
          <div><h2>${answerSummaryText(answer)}</h2>
          <p class="lead">정답은 <strong>${questionType === "choice" ? `${question.correctIndex + 1}. ` : ""}${escapeHtml(correctText)}</strong> 입니다.</p></div>
          ${answer?.isCorrect ? renderArcadeArt("mascots/correct", [252, 288]) : renderArcadeArt("mascots/studying", [262, 272])}
        </div>
        ${answer ? `
          <div class="stats">
            <div class="stat">
              <span class="muted">이번 문제 점수</span>
              <span class="num" data-experience-points>${Number(answer.scoreEarned || 0)}</span>
            </div>
            <div class="stat">
              <span class="muted">내 답</span>
              <span class="num answer-value">${questionType === "short" ? escapeHtml(answer.textAnswer || "-") : Number.isInteger(answer.selectedIndex) ? answer.selectedIndex + 1 : "-"}</span>
            </div>
            <div class="stat">
              <span class="muted">응답 시간</span>
              <span class="num">${formatTime(answer.responseTime)}</span>
            </div>
          </div>
        ` : `<div class="notice warn">이 문제에는 응답하지 않았습니다.</div>`}
      </div>

      <div class="grid-2">
        <section class="panel">
          <h3>${questionType === "short" ? "주관식 응답" : "선택지별 응답 수"}</h3>
          ${renderQuestionResponseSummary(question)}
        </section>
        <section class="panel">
          <h3>현재 누적 랭킹</h3>
          ${renderRanking(getCumulativeRanking().slice(0, 5))}
        </section>
      </div>

      <div class="notice info">선생님이 다음 문제로 넘기면 자동으로 이동합니다.</div>
    </section>
  `, null, force);
}

function renderDisplayRoute(force = false) {
  if (!state.room) {
    setView("display-loading-room", `
      <section class="screen display-stage">
        <div class="panel">
          <h1>방 정보를 불러오는 중입니다.</h1>
          <p class="lead">방 코드 ${escapeHtml(state.roomCode)}</p>
        </div>
      </section>
    `, null, force);
    return;
  }

  const soundControls = document.querySelector("#classroomSound");
  if (soundControls?.childElementCount) soundControls.hidden = Boolean(state.room.displayCovered);
  if (state.room.displayCovered || (state.room.displayHideFinalRanking && state.room.status === "finished" && supportsFinalRankingCover(getRoomMode()))) {
    const covered = state.room.displayCovered;
    setView(covered ? "display-covered" : "display-awards", `<section class="screen release-cover">
      ${finalRelease?.icon("screen-cover") || ""}<h1>${covered ? "교실 화면을 잠시 가렸습니다" : "게임이 끝났습니다"}</h1>
      <p>${covered ? "참가 화면과 게임은 계속 진행됩니다." : "자세한 결과는 참가 화면에서 확인하세요."}</p></section>`, null, force);
    return;
  }
  if (getRoomMode() === "compliment") {
    renderComplimentDisplay(force);
    return;
  }

  if (getRoomMode() === "mafia") {
    renderMafiaDisplay(force);
    return;
  }

  if (getRoomMode() === "liar") {
    renderLiarDisplay(force);
    return;
  }

  if (getRoomMode() === "catchmind") {
    renderCatchmindDisplay(force);
    return;
  }

  if (getRoomMode() === "seat") {
    renderSeatDisplay(force);
    return;
  }

  if (getRoomMode() === "memory") {
    renderMemoryDisplay(force);
    return;
  }

  if (getRoomMode() === "bingo") {
    renderBingoDisplay(force);
    return;
  }

  if (getRoomMode() === "word") {
    renderWordChallengeDisplay(force);
    return;
  }

  renderQuizDisplay(force);
}

function renderDisplayShell(viewName, title, subtitle, bodyHtml, afterRender = null, force = false) {
  const stage = state.room?.status || "waiting";
  const showLobby = canChoosePlaygroundAvatar();
  const connected = getStudents().filter((student) => student.connected).length;
  const modeClass = getRoomMode() === "compliment"
    ? "compliment-mode"
    : getRoomMode() === "mafia"
      ? "mafia-mode"
      : getRoomMode() === "liar"
        ? "liar-mode"
        : getRoomMode() === "catchmind"
          ? "catchmind-mode"
          : getRoomMode() === "seat"
            ? "seat-mode"
            : getRoomMode() === "memory"
              ? "memory-mode"
              : getRoomMode() === "bingo"
                ? "bingo-mode"
                : getRoomMode() === "word"
                  ? "word-challenge-mode"
                  : "";
  setView(viewName, `
    <section class="screen display-stage play-stage ${modeClass}" data-stage="${escapeAttr(stage)}" data-stage-mode="${escapeAttr(getRoomMode())}">
      <div class="display-header arcade-display-header">
        <div>
          <p class="stage-kicker">PLAY STAGE · ${escapeHtml(modeLabel(getRoomMode()))}</p>
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="lead">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        <div class="arcade-display-status">
          <span class="pill blue">방 ${escapeHtml(state.roomCode)}</span>
          <span class="pill ${statusPillClass(stage)}">${statusLabel(stage)}</span>
          <span class="stage-connected">${connected}명 접속</span>
        </div>
        ${renderArcadeModeArt(getRoomMode(), "banner", getMafiaArcadeScene())}
      </div>
      ${showLobby ? renderPlaygroundLobby() : ""}
      <div class="stage-body ${showLobby ? "stage-lobby-summary" : ""}">${bodyHtml}</div>
    </section>
  `, afterRender, force);
}

function renderQuizDisplay(force = false) {
  const questions = getQuestions();
  const students = getStudents();
  const status = state.room.status || "waiting";
  const currentIndex = Number(state.room.currentQuestionIndex ?? -1);
  const currentQuestion = questions[currentIndex];
  const viewName = `display-quiz-${status}-${currentQuestion?.id || "none"}`;

  if (status === "finished") {
    renderDisplayShell(viewName, "최종 결과", "전체 누적 랭킹을 확인합니다.", `
      <section class="panel">
        <h2>최종 순위</h2>
        <div class="final-podium">
          ${renderPodium(getCumulativeRanking()[1], 2, "second")}
          ${renderPodium(getCumulativeRanking()[0], 1, "first")}
          ${renderPodium(getCumulativeRanking()[2], 3, "third")}
        </div>
      </section>
      <section class="panel">
        <h2>전체 랭킹</h2>
        ${renderRanking(getCumulativeRanking())}
      </section>
    `, null, force);
    return;
  }

  if ((status === "playing" || status === "result") && currentQuestion) {
    renderDisplayShell(viewName, "퀴즈 배틀", `${state.room.pilotNumber ?? currentIndex + 1} / ${state.room.pilotQuestionCount ?? questions.length}번째 문제`, `
      ${renderQuizStageQuestion(currentQuestion, status)}
    `, () => {
      if (status === "playing") {
        startTimer({
          startedAt: state.room.questionStartedAt,
          limit: state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS,
          now: getUxRoomNow,
          textSelector: "#teacherTimerText",
          fillSelector: "#teacherTimerFill"
        });
      }
    }, force);
    return;
  }

  renderDisplayShell(viewName, "퀴즈 배틀", "학생들이 문제를 제출하는 중입니다.", `
    <div class="panel">
      <div class="stats">
        <div class="stat">
          <span class="muted">제출 문제</span>
          <span class="num">${state.room.pilotQuestionCount ?? questions.length}</span>
        </div>
        <div class="stat">
          <span class="muted">참여 학생</span>
          <span class="num">${state.room.pilotStudentCount ?? students.length}</span>
        </div>
        <div class="stat">
          <span class="muted">접속 학생</span>
          <span class="num">${students.filter((student) => student.connected).length}</span>
        </div>
      </div>
    </div>
  `, null, force);
}

function renderQuizStageQuestion(question, status) {
  const live = status === "playing";
  const short = getQuestionType(question) === "short";
  const responses = state.room.pilotAggregate?.[question.id]?.count ?? getAnswers(question.id).filter((answer) => !answer.isSkipped).length;
  return `<div class="stage-quiz-layout">
    <section class="panel display-main-panel stage-quiz-question">
      <div class="status-bar"><span class="pill blue">${short ? "주관식" : "4지선다"}</span><p class="muted">출제자 ${escapeHtml(question.authorName || "익명")}</p></div>
      <h2>${escapeHtml(question.question)}</h2>
      ${short ? (live ? "" : `<p class="notice success">정답: <strong>${escapeHtml(getQuestionCorrectAnswerText(question))}</strong></p>`) : `<ol class="stage-quiz-choices">${normalizeChoices(question.choices).map((choice, index) => `<li class="stage-quiz-option option-${index}"><b>${index + 1}</b><span>${escapeHtml(choice)}</span>${!live && index === question.correctIndex ? `<strong>${renderExperienceIcon("check")} 정답</strong>` : ""}</li>`).join("")}</ol>`}
    </section>
    <aside class="stage-quiz-sidebar">
      <section class="panel stage-metrics">
        ${live ? `<div class="timer-wrap"><div class="timer-top"><span>남은 시간</span><strong id="teacherTimerText">${state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS}초</strong></div><div class="timer-track"><div id="teacherTimerFill" class="timer-fill"></div></div></div>` : ""}
        ${renderExperienceProgress("응답", responses, state.room.pilotStudentCount ?? getStudents().length)}
      </section>
      ${live ? "" : `<section class="panel"><h3>${short ? "주관식 응답" : "응답 분포"}</h3>${renderQuestionResponseSummary(question)}</section><section class="panel"><h3>이번 문제 랭킹</h3>${renderRanking(getQuestionRanking(question.id).slice(0, 5), "scoreEarned")}</section><section class="panel"><h3>누적 랭킹</h3>${renderRanking(getCumulativeRanking().slice(0, 8))}</section>`}
    </aside>
  </div>`;
}

function renderComplimentDisplay(force = false) {
  const compliments = getCompliments();
  const students = getStudents();
  const status = state.room.status || "waiting";
  const currentIndex = Number(state.room.currentComplimentIndex ?? -1);
  const currentCompliment = getCurrentCompliment();
  const viewName = `display-compliment-${status}-${currentCompliment?.id || "none"}-${state.room.currentClueIndex || 0}`;

  if (status === "finished") {
    const leaders = getCumulativeRanking();
    renderDisplayShell(viewName, "최종 결과", "전체 누적 랭킹을 확인합니다.", `
      ${leaders.length ? `<section class="panel stage-compliment-reveal">${renderExperienceHeading("칭찬 스무고개", "최종 순위", "compliment/heart-reveal")}<div class="final-podium">${renderPodium(leaders[1], 2, "second")}${renderPodium(leaders[0], 1, "first")}${renderPodium(leaders[2], 3, "third")}</div></section>` : ""}
      <section class="panel">
        <h2>전체 랭킹</h2>
        ${renderRanking(getCumulativeRanking())}
      </section>
    `, null, force);
    return;
  }

  if (currentCompliment && ["playing", "targetReveal", "authorGuess", "authorReveal"].includes(status)) {
    const clueIndex = Number(state.room.currentClueIndex || 0);
    const clues = normalizeComplimentClues(currentCompliment.clues);
    const visibleClues = status === "playing" ? clues.slice(0, clueIndex + 1) : clues;
    const targetVisible = ["targetReveal", "authorGuess", "authorReveal"].includes(status);
    const authorVisible = status === "authorReveal";

    renderDisplayShell(viewName, "칭찬 스무고개", `${currentIndex + 1} / ${state.room.pilotComplimentCount ?? compliments.length}번째 칭찬 카드`, `
      <section class="panel warm-panel display-main-panel stage-compliment-reveal">
        ${renderExperienceHeading("칭찬 편지", authorVisible ? "작성자 공개" : targetVisible ? "대상 공개" : `단서 ${clueIndex + 1} / ${state.room.pilotComplimentClueCount ?? clues.length}`, authorVisible ? "compliment/heart-reveal" : targetVisible || clueIndex ? "compliment/opened-letter" : "compliment/sealed-letter")}
        <div class="grid-2">
          <div>
            <p class="muted small">칭찬 대상</p>
            <h2>${targetVisible ? escapeHtml(currentCompliment.targetName) : "아직 비공개"}</h2>
          </div>
          <div>
            <p class="muted small">칭찬 작성자</p>
            <h2>${authorVisible ? escapeHtml(currentCompliment.authorName) : "아직 비공개"}</h2>
          </div>
        </div>
        ${renderComplimentClueCards(visibleClues)}
      </section>
      ${status === "authorReveal" ? `
        <section class="panel">
          <h2>이번 카드 결과</h2>
          ${renderComplimentScoreEvents(currentCompliment)}
        </section>
      ` : `<div class="notice info">학생들은 각자 패드에서 추리합니다.</div>`}
    `, null, force);
    return;
  }

  renderDisplayShell(viewName, "칭찬 스무고개", "학생들이 칭찬 카드를 제출하는 중입니다.", `
    <div class="panel warm-panel">
      <div class="stats">
        <div class="stat">
          <span class="muted">칭찬 카드</span>
          <span class="num">${state.room.pilotComplimentCount ?? compliments.length}</span>
        </div>
        <div class="stat">
          <span class="muted">참여 학생</span>
          <span class="num">${state.room.pilotStudentCount ?? students.length}</span>
        </div>
        ${securePilot ? "" : `<div class="stat">
          <span class="muted">접속 학생</span>
          <span class="num">${students.filter((student) => student.connected).length}</span>
        </div>`}
      </div>
    </div>
  `, null, force);
}

function renderMafiaDisplay(force = false) {
  const status = state.room.status || "waiting";
  const players = getMafiaPlayers();
  const alivePlayers = players.filter((player) => player.alive);
  const round = getCurrentMafiaRound();
  const viewName = `display-mafia-${status}-${getMafiaRoundNumber()}`;
  const winner = getMafiaWinner();
  let bodyHtml = "";

  if (status === "finished") {
    bodyHtml = `
      <section class="panel mafia-panel result-panel">
        <h1>${winner ? mafiaWinnerText(winner) : "게임이 종료되었습니다."}</h1>
      </section>
      <section class="panel">
        <h2>전체 역할표</h2>
        ${renderMafiaRoleTable(players)}
      </section>
    `;
  } else if (status === "nightAction") {
    const completed = securePilot ? getMafiaState().nightCount ?? 0 : alivePlayers.filter((player) => getMafiaNightAction(player.id, player.role)).length;
    bodyHtml = `
      <section class="panel mafia-panel result-panel">
        <span class="pill red">${getMafiaRoundNumber()}번째 밤</span>
        <h1>밤 행동 진행 중</h1>
        <p class="lead">생존자들이 각자 패드에서 선택하고 있습니다.</p>
        <div class="stage-public-progress">${renderExperienceProgress("밤 행동 완료", completed, alivePlayers.length)}</div>
      </section>
    `;
  } else if (status === "nightResult") {
    const result = round.nightResult || {};
    const message = result.savedByDoctor
      ? "지난밤 마피아의 공격이 있었지만 아무도 탈락하지 않았습니다."
      : result.eliminatedName
        ? `지난밤 ${escapeHtml(result.eliminatedName)}이/가 탈락했습니다.`
        : "지난밤 아무도 탈락하지 않았습니다.";
    bodyHtml = `<section class="panel mafia-panel result-panel"><span class="pill gold">낮 결과 발표</span><h1>${message}</h1></section>`;
  } else if (status === "discussion") {
    bodyHtml = `
      <section class="panel mafia-panel result-panel">
        <span class="pill blue">낮 토론</span>
        <h1>낮 토론 시간입니다.</h1>
        <div class="timer-wrap">
          <div class="timer-top">
            <span>토론 남은 시간</span>
            <span id="displayMafiaDiscussionText">${getMafiaSettings().discussionSeconds}초</span>
          </div>
          <div class="timer-track"><div id="displayMafiaDiscussionFill" class="timer-fill"></div></div>
        </div>
      </section>
    `;
  } else if (status === "voting") {
    const voteCount = securePilot ? getMafiaState().voteCount ?? 0 : Object.keys(round.votes || {}).length;
    bodyHtml = `
      <section class="panel mafia-panel result-panel">
        <span class="pill green">비밀 투표</span>
        <h1>투표 진행 중</h1>
        <div class="stage-public-progress">${renderExperienceProgress("투표 완료", voteCount, alivePlayers.length)}</div>
      </section>
    `;
  } else if (status === "voteResult") {
    const result = round.voteResult || {};
    const title = result.revotedTieSkipped
      ? "재투표도 동점이라 아무도 탈락하지 않았습니다."
      : result.revotedTieRequired
        ? "동점입니다. 재투표가 필요합니다."
        : result.eliminatedName
          ? `이번 투표에서 ${escapeHtml(result.eliminatedName)}이/가 최종 지목되었습니다.`
          : "이번 투표에서는 아무도 탈락하지 않았습니다.";
    bodyHtml = `<section class="panel mafia-panel result-panel"><span class="pill gold">투표 결과</span><h1>${title}</h1></section>`;
  } else if (status === "roleRevealDead") {
    const elimination = getLastMafiaElimination();
    const roleText = elimination?.role ? publicMafiaRoleLabel(elimination.role) : "알 수 없음";
    bodyHtml = `<section class="panel mafia-panel result-panel"><span class="pill red">정체 공개</span><h1>${elimination?.name ? `${escapeHtml(elimination.name)}의 정체는 ${roleText}${roleText === "시민" ? "이었습니다" : "였습니다"}.` : "공개할 정체가 없습니다."}</h1></section>`;
  } else {
    bodyHtml = `
      <section class="panel mafia-panel result-panel">
        <span class="pill red">${getMafiaRoundNumber()}라운드</span>
        <h1>${status === "roleAssigned" || status === "roleReveal" ? "역할 확인 시간입니다." : "교실 마피아 게임을 준비 중입니다."}</h1>
        <div class="stats">
          <div class="stat"><span class="muted">전체 학생</span><span class="num">${players.length || getStudents().length}</span></div>
          <div class="stat"><span class="muted">생존자</span><span class="num">${alivePlayers.length || getStudents().length}</span></div>
        </div>
      </section>
    `;
  }

  renderDisplayShell(viewName, "교실 마피아 게임", `${getMafiaRoundNumber()}라운드`, bodyHtml, () => {
    if (status === "discussion") {
      startTimer({
        startedAt: getMafiaState().discussionStartedAt,
        limit: getMafiaSettings().discussionSeconds,
        textSelector: "#displayMafiaDiscussionText",
        fillSelector: "#displayMafiaDiscussionFill"
      });
    }
  }, force);
}

function renderLiarDisplay(force = false) {
  const status = state.room.status || "waiting";
  const participants = getLiarParticipants();
  const confirmations = getLiarConfirmations();
  const votes = getLiarVotes();
  const viewName = `display-liar-${status}`;
  let bodyHtml = "";

  if (status === "playing") {
    bodyHtml = `
      <section class="panel liar-panel result-panel">
        <span class="pill blue">제시어 확인</span>
        <h1>제시어 확인 시간입니다.</h1>
        <p class="lead">각자 패드에서 자기 제시어만 조용히 확인합니다.</p>
        <div class="stats">
          <div class="stat"><span class="muted">확인 완료</span><span class="num">${Object.keys(confirmations).length}/${participants.length}</span></div>
          <div class="stat"><span class="muted">참가 학생</span><span class="num">${participants.length}</span></div>
        </div>
      </section>
    `;
  } else if (status === "voting") {
    bodyHtml = `
      <section class="panel liar-panel result-panel">
        <span class="pill green">라이어 투표</span>
        <h1>투표 진행 중</h1>
        <p class="lead">라이어라고 생각하는 친구를 각자 선택합니다.</p>
        <div class="stats">
          <div class="stat"><span class="muted">투표 완료</span><span class="num">${securePilot ? getLiarState().voteCount ?? 0 : Object.keys(votes).length}/${participants.length}</span></div>
          <div class="stat"><span class="muted">참가 학생</span><span class="num">${participants.length}</span></div>
        </div>
      </section>
    `;
  } else if (status === "voteResult") {
    bodyHtml = `
      <section class="panel">
        <h2>투표 결과</h2>
        ${renderLiarVoteResults()}
      </section>
    `;
  } else if (status === "result") {
    bodyHtml = `
      <section class="panel liar-panel result-panel">
        <h1>실제 라이어 공개</h1>
      </section>
      <section class="panel">
        ${renderLiarAnswerReveal()}
      </section>
    `;
  } else {
    bodyHtml = `
      <section class="panel liar-panel result-panel">
        <span class="pill blue">준비 중</span>
        <h1>라이어게임을 준비 중입니다.</h1>
        <div class="stats">
          <div class="stat"><span class="muted">입장 학생</span><span class="num">${getStudents().length}</span></div>
          <div class="stat"><span class="muted">접속 학생</span><span class="num">${getStudents().filter((student) => student.connected).length}</span></div>
        </div>
      </section>
    `;
  }

  renderDisplayShell(viewName, "라이어게임", "비슷한 제시어 속 숨어 있는 라이어를 찾아라!", bodyHtml, null, force);
}

function renderTeacherDashboard(force = true) {
  if (!state.room) {
    setView("teacher-loading", `<section class="screen"><div class="panel"><h2>방 정보를 불러오는 중입니다.</h2></div></section>`);
    return;
  }

  if (getRoomMode() === "compliment") {
    renderComplimentTeacherDashboard(force);
    return;
  }

  if (getRoomMode() === "mafia") {
    renderMafiaTeacherDashboard(force);
    return;
  }

  if (getRoomMode() === "liar") {
    renderLiarTeacherDashboard(force);
    return;
  }

  if (getRoomMode() === "catchmind") {
    renderCatchmindTeacherDashboard(force);
    return;
  }

  if (getRoomMode() === "seat") {
    renderSeatTeacherDashboard(force);
    return;
  }

  if (getRoomMode() === "memory") {
    renderMemoryTeacherDashboard(force);
    return;
  }

  if (getRoomMode() === "bingo") {
    renderBingoTeacherDashboard(force);
    return;
  }

  if (getRoomMode() === "word") {
    renderWordChallengeTeacherDashboard(force);
    return;
  }

  const questions = getQuestions();
  const students = getStudents();
  const connectedCount = students.filter((student) => student.connected).length;
  const status = state.room.status || "waiting";
  const currentIndex = Number(state.room.currentQuestionIndex ?? -1);
  const currentQuestion = questions[currentIndex];
  const maxQuestions = getMaxQuestionsPerStudent();

  const waiting = status === "waiting";
  setView("teacher-dashboard", waiting ? renderQuizStudioPreparation(questions, students, maxQuestions) : `
    <section class="screen">
      <div class="status-bar">
        <div>
          <p class="eyebrow">교사 화면</p>
          <h1>동명중학교 PLAYGROUND</h1>
        </div>
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
      </div>

      <div class="panel">
        <div class="status-bar">
          <div>
            <p class="muted small">학생들에게 알려 줄 방 코드</p>
            <div class="room-code">${escapeHtml(state.roomCode)}</div>
          </div>
          <div class="button-row">
            <span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span>
            <button class="btn ghost" id="copyRoomCodeBtn" type="button">방 코드 복사</button>
            <button class="btn dark" data-action="open-display" type="button">교실 화면 팝업</button>
          </div>
        </div>

        <div class="stats">
          <div class="stat">
            <span class="muted">제출 문제</span>
            <span class="num">${questions.length}</span>
          </div>
          <div class="stat">
            <span class="muted">접속 학생</span>
            <span class="num">${connectedCount}</span>
          </div>
          <div class="stat">
            <span class="muted">전체 학생</span>
            <span class="num">${students.length}</span>
          </div>
        </div>
      </div>

      <div class="teacher-grid">
        <aside class="panel">
          ${renderTeacherModeControls()}

          <section class="panel tight">
            <h2>제출 설정</h2>
            <div class="field">
              <label for="maxQuestionsInput">학생 1명당 최대 문제 수</label>
              <input id="maxQuestionsInput" type="number" min="1" max="10" value="${maxQuestions}" />
            </div>
            <button class="btn primary" data-action="save-quiz-settings" type="button">설정 저장</button>
            <p class="muted small">이미 제출된 문제는 지우지 않고, 새로 추가할 수 있는 개수만 조정합니다.</p>
          </section>

          <h2>진행 조작</h2>
          <div class="button-row">
            <button class="btn primary" data-action="start" type="button" ${questions.length ? "" : "disabled"}>게임 시작</button>
            <button class="btn dark" data-action="restart-current" type="button" ${currentQuestion ? "" : "disabled"}>현재 문제로 이동</button>
            <button class="btn warn" data-action="reveal" type="button" ${currentQuestion && status === "playing" ? "" : "disabled"}>정답 공개</button>
            <button class="btn success" data-action="next" type="button" ${questions.length ? "" : "disabled"}>다음 문제</button>
            <button class="btn ghost" data-action="finish" type="button" ${questions.length ? "" : "disabled"}>누적 랭킹 보기</button>
            <button class="btn danger" data-action="reset" type="button">게임 초기화</button>
            <button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button>
          </div>

          <div class="notice info">
            학생 문제는 승인 없이 바로 게임에 사용됩니다. 삭제는 게임 시작 전 대기 상태에서만 권장됩니다.
          </div>

          <section class="panel tight">
            <h3>참여 학생</h3>
            ${renderStudentList(students)}
          </section>
        </aside>

        <div class="screen">
          <section class="panel">
            <h2>현재 문제</h2>
            ${renderTeacherCurrentQuestion(currentQuestion, currentIndex, questions.length, status)}
          </section>

          <div class="grid-2">
            <section class="panel">
              <h3>제출된 문제 목록</h3>
              ${renderTeacherQuestionList(questions, status)}
            </section>
            <section class="panel">
              <h3>누적 랭킹</h3>
              ${renderRanking(getCumulativeRanking().slice(0, 8))}
            </section>
          </div>
        </div>
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
    document.querySelector("#copyRoomCodeBtn").addEventListener("click", copyRoomCode);
    document.querySelectorAll("[data-switch-mode]").forEach((button) => {
      button.addEventListener("click", () => switchRoomMode(button.dataset.switchMode));
    });
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleTeacherAction(button.dataset.action));
    });
    const screen = document.querySelector("#app > .screen");
    screen?.addEventListener("click", (event) => {
      const detail = event.target.closest("[data-view-question]");
      const removeQuestion = event.target.closest("[data-delete-question]");
      if (detail) showTeacherQuestionDetail(detail.dataset.viewQuestion);
      if (removeQuestion) deleteQuestion(removeQuestion.dataset.deleteQuestion);
    });
    if (waiting) {
      document.querySelector("#quizLibraryFilters").addEventListener("input", updateQuizStudioLibrary);
      updateQuizStudioLibrary();
    } else closeTeacherQuestionDetail();
    if (currentQuestion && status === "playing") {
      startTimer({
        startedAt: state.room.questionStartedAt,
        limit: state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS,
        now: getUxRoomNow,
        textSelector: "#teacherTimerText",
        fillSelector: "#teacherTimerFill",
        onEnd: () => {
          if (getUxQuizOptions().autoReveal && state.role === "teacher" && state.room?.status === "playing") {
            revealAnswer(true);
          }
        }
      });
    }
  }, force);
}

function renderQuizStudioPreparation(questions, students, maximum) {
  const counts = new Map();
  for (const question of questions) {
    const key = getQuestionOwnerId(state.room, question.id, question);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const submitted = students.filter((student) => counts.has(student.id)).length;
  const connected = students.filter((student) => student.connected).length;
  const authors = [...new Map(questions.map((question) => [nameToKey(question.authorName || ""), question.authorName || "익명"]))]
    .filter(([key]) => key).sort((a, b) => a[1].localeCompare(b[1], "ko"));
  return `<section class="screen studio-preparation studio-control studio-quiz-control">
    <div class="status-bar"><span class="pill green">${statusLabel("waiting")}</span><button class="btn ghost" id="backHomeBtn" type="button">처음으로</button></div>
    ${renderStudioHeading("PLAY CONTROL", "퀴즈 배틀 준비", "hosts/quiz-host", `<div class="studio-room-entry"><div class="studio-room"><span>방 코드</span><strong class="room-code">${escapeHtml(state.roomCode)}</strong></div><div class="button-row studio-room-tools"><button class="btn ghost" id="copyRoomCodeBtn" type="button">방 코드 복사</button><button class="btn dark" data-action="open-display" type="button">교실 화면 팝업</button></div></div>`)}
    <div class="stats studio-quiz-stats">
      ${[["접속 학생", `${connected}명`], ["전체 학생", `${students.length}명`], ["제출 문제", `${questions.length}개`], ["제출 학생", `${submitted} / ${students.length}명`]].map(([label, value]) => `<div class="stat"><span class="muted">${label}</span><span class="num">${value}</span></div>`).join("")}
    </div>
    <section class="panel studio-launch">
      ${renderArcadeArt(`studio/states/${questions.length ? "ready-to-play" : "awaiting-submissions"}`, [512, 512], "studio-launch-art")}
      <strong>${questions.length ? "게임을 시작할 수 있습니다" : "제출된 문제가 아직 없습니다"}</strong>
      <button class="btn primary" data-action="start" type="button" ${questions.length ? "" : "disabled"}>게임 시작</button>
    </section>
    <div class="studio-control-grid">
      <section class="panel studio-library">
        <div class="status-bar"><h2>제출된 문제 목록</h2><span class="pill blue" id="quizLibraryCount" role="status"></span></div>
        <div id="quizLibraryFilters" class="studio-library-filters" role="search" aria-label="제출된 문제 찾기">
          <div class="field"><label for="quizLibrarySearch">검색</label><input id="quizLibrarySearch" type="search" placeholder="출제자 또는 문제" autocomplete="off" /></div>
          <div class="field"><label for="quizLibraryType">문제 유형</label><select id="quizLibraryType"><option value="">모든 유형</option><option value="choice">4지선다</option><option value="short">주관식</option></select></div>
          <div class="field"><label for="quizLibraryAuthor">출제 학생</label><select id="quizLibraryAuthor"><option value="">모든 학생</option>${authors.map(([key, label]) => `<option value="${escapeAttr(key)}">${escapeHtml(label)}</option>`).join("")}</select></div>
        </div>
        ${renderTeacherQuestionList(questions, "waiting")}
        <div class="empty" id="quizLibraryNoMatches" hidden>조건에 맞는 문제가 없습니다.</div>
      </section>
      <aside class="studio-control-aside">
        <section class="panel">
          <h2>제출 설정</h2>
          <div class="field"><label for="maxQuestionsInput">학생 1명당 최대 문제 수</label><input id="maxQuestionsInput" type="number" min="1" max="10" value="${maximum}" /></div>
          ${renderUxQuizSettings()}
          <div class="button-row"><button class="btn ghost" data-action="save-quiz-settings" type="button">설정 저장</button></div>
          <p class="muted small">현재 참가 명단의 학생 ID를 기준으로 집계합니다. 제출한 문제는 승인 없이 게임에 사용됩니다.</p>
        </section>
        <details class="panel studio-fold" id="quizStudioRoster" open>
          <summary>참여 학생 <span>${connected}명 접속</span></summary>
          ${students.length ? `<ul class="list studio-roster" id="quizStudioRosterList" data-studio-scroll>${students.map((student) => `<li class="list-row split"><div>${renderPlaygroundName(student)}<small class="studio-connection ${student.connected ? "is-online" : ""}">${student.connected ? "접속 중" : "연결 끊김"}</small></div><b>${counts.get(student.id) || 0} / ${maximum}</b></li>`).join("")}</ul>` : renderStudioEmpty("awaiting-players", "아직 입장한 학생이 없습니다.")}
        </details>
        <details class="panel studio-fold" id="quizStudioModes"><summary>게임 모드</summary>${renderTeacherModeControls()}</details>
      </aside>
    </div>
    <details class="panel studio-fold studio-management" id="quizStudioManagement"><summary>방 관리 및 누적 랭킹</summary>
      <div class="button-row"><button class="btn ghost" data-action="finish" type="button" ${questions.length ? "" : "disabled"}>누적 랭킹 보기</button><button class="btn danger" data-action="reset" type="button">게임 초기화</button><button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button></div>
      ${renderRanking(getCumulativeRanking().slice(0, 8))}
    </details>
  </section>`;
}

function updateQuizStudioLibrary() {
  const filters = document.querySelector("#quizLibraryFilters");
  if (!filters) return;
  const query = document.querySelector("#quizLibrarySearch").value.trim().toLocaleLowerCase("ko");
  const type = document.querySelector("#quizLibraryType").value;
  const author = document.querySelector("#quizLibraryAuthor").value;
  const rows = [...document.querySelectorAll(".studio-library [data-question-record]")];
  let visible = 0;
  for (const row of rows) {
    row.hidden = Boolean((query && !row.dataset.searchText.toLocaleLowerCase("ko").includes(query))
      || (type && type !== row.dataset.questionType) || (author && author !== row.dataset.questionAuthor));
    if (!row.hidden) visible += 1;
  }
  setPlaygroundText("#quizLibraryCount", `${visible} / ${rows.length}개`);
  document.querySelector("#quizLibraryNoMatches").hidden = !rows.length || visible > 0;
}

function renderComplimentTeacherDashboard(force = true) {
  const compliments = getCompliments();
  const students = getStudents();
  const connectedCount = students.filter((student) => student.connected).length;
  const status = state.room.status || "waiting";
  const currentIndex = Number(state.room.currentComplimentIndex ?? -1);
  const currentCompliment = getCurrentCompliment();
  const maxCompliments = getMaxComplimentsPerStudent();

  setView("teacher-compliment-dashboard", `
    <section class="screen compliment-mode">
      <div class="status-bar">
        <div>
          <p class="eyebrow">교사 화면</p>
          <h1>칭찬 스무고개</h1>
        </div>
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
      </div>

      <div class="panel warm-panel">
        <div class="status-bar">
          <div>
            <p class="muted small">학생들에게 알려 줄 방 코드</p>
            <div class="room-code">${escapeHtml(state.roomCode)}</div>
          </div>
          <div class="button-row">
            <span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span>
            <button class="btn ghost" id="copyRoomCodeBtn" type="button">방 코드 복사</button>
            <button class="btn dark" data-action="open-display" type="button">교실 화면 팝업</button>
          </div>
        </div>

        <div class="stats">
          <div class="stat">
            <span class="muted">칭찬 카드</span>
            <span class="num">${compliments.length}</span>
          </div>
          <div class="stat">
            <span class="muted">접속 학생</span>
            <span class="num">${connectedCount}</span>
          </div>
          <div class="stat">
            <span class="muted">전체 학생</span>
            <span class="num">${students.length}</span>
          </div>
        </div>
      </div>

      <div class="teacher-grid">
        <aside class="panel">
          ${renderTeacherModeControls()}

          <section class="panel tight">
            <h2>제출 설정</h2>
            <div class="field">
              <label for="maxComplimentsInput">학생 1명당 최대 칭찬 카드 수</label>
              <input id="maxComplimentsInput" type="number" min="1" max="10" value="${maxCompliments}" />
            </div>
            <button class="btn primary" data-action="save-compliment-settings" type="button">설정 저장</button>
            <p class="muted small">같은 친구를 여러 번 선택하는 것은 계속 막습니다. 실제 추가 가능 수는 입장한 친구 수의 영향도 받습니다.</p>
          </section>

          <h2>진행 조작</h2>
          <div class="button-row">
            <button class="btn primary" data-action="start-compliment" type="button" ${compliments.length && (!securePilot || status === "waiting") ? "" : "disabled"}>게임 시작</button>
            <button class="btn success" data-action="compliment-next-clue" type="button" ${currentCompliment && status === "playing" && canShowNextComplimentClue(currentCompliment) ? "" : "disabled"}>다음 단서 공개</button>
            <button class="btn warn" data-action="compliment-reveal-target" type="button" ${currentCompliment && status === "playing" ? "" : "disabled"}>칭찬 대상 공개</button>
            <button class="btn primary" data-action="compliment-author-guess" type="button" ${currentCompliment && status === "targetReveal" ? "" : "disabled"}>작성자 추리 시작</button>
            <button class="btn warn" data-action="compliment-reveal-author" type="button" ${currentCompliment && status === "authorGuess" ? "" : "disabled"}>작성자 공개</button>
            <button class="btn success" data-action="compliment-next-card" type="button" ${currentCompliment && status === "authorReveal" ? "" : "disabled"}>다음 칭찬</button>
            <button class="btn ghost" data-action="finish" type="button" ${compliments.length ? "" : "disabled"}>누적 랭킹 보기</button>
            <button class="btn danger" data-action="reset" type="button">게임 초기화</button>
            <button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button>
          </div>

          <div class="notice info">
            칭찬 카드는 승인 없이 바로 게임에 사용됩니다. 문제가 있는 카드는 대기 상태에서 삭제할 수 있습니다.
          </div>

          <section class="panel tight">
            <h3>참여 학생</h3>
            ${renderStudentList(students)}
          </section>
        </aside>

        <div class="screen">
          <section class="panel warm-panel">
            <h2>현재 칭찬 카드</h2>
            ${renderTeacherCurrentCompliment(currentCompliment, currentIndex, compliments.length, status)}
          </section>

          <div class="grid-2">
            <section class="panel">
              <h3>제출된 칭찬 카드</h3>
              ${renderTeacherComplimentList(compliments, status)}
            </section>
            <section class="panel">
              <h3>누적 랭킹</h3>
              ${renderRanking(getCumulativeRanking().slice(0, 8))}
            </section>
          </div>
        </div>
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
    document.querySelector("#copyRoomCodeBtn").addEventListener("click", copyRoomCode);
    document.querySelectorAll("[data-switch-mode]").forEach((button) => {
      button.addEventListener("click", () => switchRoomMode(button.dataset.switchMode));
    });
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleTeacherAction(button.dataset.action));
    });
    document.querySelectorAll("[data-delete-compliment]").forEach((button) => {
      button.addEventListener("click", () => deleteCompliment(button.dataset.deleteCompliment));
    });
  }, force);
}

function renderMafiaTeacherDashboard(force = true) {
  const students = getStudents();
  const connectedCount = students.filter((student) => student.connected).length;
  const players = getMafiaPlayers();
  const alivePlayers = players.filter((player) => player.alive);
  const status = state.room.status || "waiting";
  const mafia = getMafiaState();
  const settings = getMafiaSettings();
  const round = getCurrentMafiaRound();
  const winner = getMafiaWinner();
  const canSwitch = status === "waiting";
  const canStartVote = status === "discussion" || (status === "voteResult" && Boolean(round.voteResult?.revotedTieRequired));
  const canStartNextNight = status === "roleRevealDead" || (status === "voteResult" && !round.voteResult?.eliminatedStudentId && !round.voteResult?.revotedTieRequired);
  syncAllGhostBingoProgress();

  setView("teacher-mafia-dashboard", `
    <section class="screen mafia-mode">
      <div class="status-bar">
        <div>
          <p class="eyebrow">교사 화면</p>
          <h1>교실 마피아 게임</h1>
        </div>
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
      </div>

      <div class="panel mafia-panel">
        <div class="status-bar">
          <div>
            <p class="muted small">학생들에게 알려 줄 방 코드</p>
            <div class="room-code">${escapeHtml(state.roomCode)}</div>
          </div>
          <div class="button-row">
            <span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span>
            <span class="pill red">${mafia.round || 1}라운드</span>
            <button class="btn ghost" id="copyRoomCodeBtn" type="button">방 코드 복사</button>
            <button class="btn dark" data-action="open-display" type="button">교실 화면 팝업</button>
          </div>
        </div>

        <div class="stats">
          <div class="stat">
            <span class="muted">전체 학생</span>
            <span class="num">${students.length}</span>
          </div>
          <div class="stat">
            <span class="muted">접속 학생</span>
            <span class="num">${connectedCount}</span>
          </div>
          <div class="stat">
            <span class="muted">생존자</span>
            <span class="num">${alivePlayers.length || students.length}</span>
          </div>
        </div>
      </div>

      <div class="teacher-grid">
        <aside class="panel">
          ${renderTeacherModeControls()}

          <section class="panel tight">
            <h2>역할 설정</h2>
            <div class="form-grid">
              <div class="field">
                <label for="mafiaCountInput">마피아 수</label>
                <input id="mafiaCountInput" type="number" min="1" max="10" value="${settings.mafiaCount}" ${canSwitch ? "" : "disabled"} />
              </div>
              <div class="field">
                <label for="policeCountInput">경찰 수</label>
                <input id="policeCountInput" type="number" min="0" max="5" value="${settings.policeCount}" ${canSwitch ? "" : "disabled"} />
              </div>
              <div class="field">
                <label for="doctorCountInput">의사 수</label>
                <input id="doctorCountInput" type="number" min="0" max="5" value="${settings.doctorCount}" ${canSwitch ? "" : "disabled"} />
              </div>
              <div class="field">
                <label for="discussionSecondsInput">토론 시간(초)</label>
                <input id="discussionSecondsInput" type="number" min="30" max="900" step="30" value="${settings.discussionSeconds}" />
              </div>
            </div>
            <button class="btn ghost" data-action="ux-mafia-recommend" type="button" ${status === "waiting" && students.length >= 3 ? "" : "disabled"}>${uxIcon("user-round")}인원수에 맞춰 추천</button>
            <button class="btn primary" data-action="mafia-save-settings" type="button">설정 저장</button>
            <p class="muted small">시민은 전체 학생에서 마피아, 경찰, 의사를 뺀 나머지로 자동 배정됩니다.</p>
          </section>

          <h2>진행 조작</h2>
          <div class="button-row">
            <button class="btn primary" data-action="mafia-assign" type="button" ${students.length && status === "waiting" ? "" : "disabled"}>역할 배정</button>
            <button class="btn dark" data-action="mafia-role-reveal" type="button" ${players.length && (status === "roleAssigned" || status === "waiting") ? "" : "disabled"}>역할 확인 시작</button>
            <button class="btn primary" data-action="mafia-start-night" type="button" ${players.length && !winner && ["roleAssigned", "roleReveal"].includes(status) ? "" : "disabled"}>밤 행동 시작</button>
            <button class="btn warn" data-action="mafia-calc-night" type="button" ${players.length && status === "nightAction" ? "" : "disabled"}>밤 결과 계산</button>
            <button class="btn success" data-action="mafia-publish-night" type="button" ${players.length && status === "nightAction" ? "" : "disabled"}>낮 결과 발표</button>
            <button class="btn primary" data-action="mafia-start-discussion" type="button" ${status === "nightResult" && !winner ? "" : "disabled"}>토론 시작</button>
            <button class="btn primary" data-action="mafia-start-voting" type="button" ${canStartVote && !winner ? "" : "disabled"}>투표 시작</button>
            <button class="btn warn" data-action="mafia-reveal-vote" type="button" ${status === "voting" ? "" : "disabled"}>투표 결과 공개</button>
            <button class="btn dark" data-action="mafia-reveal-role" type="button" ${status === "voteResult" ? "" : "disabled"}>정체 공개</button>
            <button class="btn success" data-action="mafia-next-night" type="button" ${canStartNextNight && !winner ? "" : "disabled"}>다음 밤</button>
            <button class="btn ghost" data-action="mafia-finish" type="button" ${winner ? "" : "disabled"}>게임 종료</button>
            <button class="btn danger" data-action="reset" type="button">게임 초기화</button>
            <button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button>
          </div>

          <section class="panel tight">
            <h3>참여 학생</h3>
            ${renderStudentList(students)}
          </section>
        </aside>

        <div class="screen">
          <section class="panel mafia-panel">
            <h2>현재 상태</h2>
            ${winner ? `<div class="notice success">${mafiaWinnerText(winner)}</div>` : renderMafiaWinCheck()}
            ${renderMafiaCompletionPanel()}
          </section>

          <section class="panel">
            <h2>역할표</h2>
            ${renderMafiaRoleTable(players)}
          </section>

          <div class="grid-2">
            <section class="panel">
              <h3>밤 행동 기록</h3>
              ${renderMafiaNightTeacherPanel(round)}
            </section>
            <section class="panel">
              <h3>투표 현황</h3>
              ${renderMafiaVoteTeacherPanel(round)}
            </section>
          </div>

          <div class="grid-2">
            <section class="panel">
              <h3>유령 빙고 현황</h3>
              ${renderGhostBingoLeaderboard()}
            </section>
            <section class="panel">
              <h3>유령 채팅</h3>
              ${renderGhostChatPanel({ teacher: true, allowSend: false })}
            </section>
          </div>
        </div>
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
    document.querySelector("#copyRoomCodeBtn").addEventListener("click", copyRoomCode);
    document.querySelectorAll("[data-switch-mode]").forEach((button) => {
      button.addEventListener("click", () => switchRoomMode(button.dataset.switchMode));
    });
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleTeacherAction(button.dataset.action));
    });
    if (status === "discussion") {
      startTimer({
        startedAt: mafia.discussionStartedAt,
        limit: settings.discussionSeconds,
        textSelector: "#teacherMafiaDiscussionText",
        fillSelector: "#teacherMafiaDiscussionFill"
      });
    }
  }, force);
}

function renderLiarTeacherDashboard(force = true) {
  const students = getStudents();
  const participants = getLiarParticipants();
  const status = state.room.status || "waiting";
  const settings = getLiarSettings();
  const confirmations = getLiarConfirmations();
  const votes = getLiarVotes();
  const maxLiarCount = Math.max(1, Math.max(1, students.length - 1));
  const canStart = students.length >= 2;
  const isRunning = ["playing", "voting", "voteResult", "result"].includes(status);

  setView(`teacher-liar-dashboard-${status}`, `
    <section class="screen liar-mode">
      <div class="status-bar">
        <div>
          <p class="eyebrow">교사 화면</p>
          <h1>라이어게임</h1>
        </div>
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
      </div>

      <div class="panel liar-panel">
        <div class="status-bar">
          <div>
            <p class="muted small">학생들에게 알려 줄 방 코드</p>
            <div class="room-code">${escapeHtml(state.roomCode)}</div>
          </div>
          <div class="button-row">
            <span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span>
            <button class="btn ghost" id="copyRoomCodeBtn" type="button">방 코드 복사</button>
            <button class="btn dark" data-action="open-display" type="button">교실 화면 팝업</button>
          </div>
        </div>
        <div class="stats">
          <div class="stat">
            <span class="muted">참가 학생</span>
            <span class="num">${isRunning ? participants.length : students.length}</span>
          </div>
          <div class="stat">
            <span class="muted">제시어 확인</span>
            <span class="num">${Object.keys(confirmations).length}/${participants.length || students.length}</span>
          </div>
          <div class="stat">
            <span class="muted">투표 완료</span>
            <span class="num">${Object.keys(votes).length}/${participants.length || students.length}</span>
          </div>
        </div>
      </div>

      <div class="teacher-grid">
        <aside class="panel">
          ${renderTeacherModeControls()}
          <section class="panel tight">
            <h2>게임 설정</h2>
            <div class="form-grid">
              <div class="field">
                <label for="liarWordAInput">제시어 1</label>
                <input id="liarWordAInput" maxlength="30" value="${escapeAttr(settings.wordA)}" ${isRunning ? "disabled" : ""} placeholder="예: 수박" />
              </div>
              <div class="field">
                <label for="liarWordBInput">제시어 2</label>
                <input id="liarWordBInput" maxlength="30" value="${escapeAttr(settings.wordB)}" ${isRunning ? "disabled" : ""} placeholder="예: 참외" />
              </div>
            </div>
            <button class="btn ghost" data-action="ux-liar-recommend" type="button" ${isRunning ? "disabled" : ""}>${uxIcon("shuffle")}제시어 추천</button>
            <div class="liar-stepper">
              <button class="btn ghost" data-liar-count-step="-1" type="button" ${isRunning ? "disabled" : ""}>-</button>
              <input id="liarCountInput" type="number" min="1" max="${maxLiarCount}" value="${clampInt(settings.liarCount, 1, maxLiarCount, DEFAULT_LIAR_COUNT)}" ${isRunning ? "disabled" : ""} />
              <button class="btn ghost" data-liar-count-step="1" type="button" ${isRunning ? "disabled" : ""}>+</button>
            </div>
            <p class="muted small">권장: 참가 인원의 약 10~30%. 모든 학생이 라이어가 되는 설정은 막습니다.</p>
            <div class="button-row">
              <button class="btn primary" data-action="liar-save-settings" type="button" ${isRunning ? "disabled" : ""}>설정 저장</button>
              <button class="btn success" data-action="liar-start" type="button" ${canStart && !isRunning ? "" : "disabled"}>게임 시작</button>
            </div>
          </section>

          <h2>진행 조작</h2>
          <div class="button-row">
            <button class="btn primary" data-action="liar-start-voting" type="button" ${status === "playing" ? "" : "disabled"}>투표 시작</button>
            <button class="btn warn" data-action="liar-reveal-vote" type="button" ${status === "voting" && Object.keys(votes).length >= participants.length && participants.length ? "" : "disabled"}>투표 결과 공개</button>
            <button class="btn warn" data-action="liar-force-vote" type="button" ${status === "voting" ? "" : "disabled"}>투표 강제 종료</button>
            <button class="btn dark" data-action="liar-reveal-answer" type="button" ${status === "voteResult" ? "" : "disabled"}>라이어 공개</button>
            <button class="btn success" data-action="liar-restart-same" type="button" ${status === "result" ? "" : "disabled"}>같은 제시어로 다시 하기</button>
            <button class="btn ghost" data-action="liar-configure" type="button" ${isRunning ? "" : "disabled"}>설정 변경하기</button>
            <button class="btn danger" data-action="reset" type="button">게임 초기화</button>
            <button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button>
          </div>
        </aside>

        <div class="screen">
          <section class="panel liar-panel">
            <h2>현재 상태</h2>
            ${renderLiarTeacherStatusPanel()}
          </section>
          <div class="grid-2">
            <section class="panel">
              <h3>제시어 확인 현황</h3>
              ${renderLiarConfirmationList()}
            </section>
            <section class="panel">
              <h3>투표 현황</h3>
              ${renderLiarVoteProgressPanel()}
            </section>
          </div>
          ${status === "voteResult" ? `
            <section class="panel">
              <h2>투표 결과</h2>
              ${renderLiarVoteResults()}
            </section>
          ` : ""}
          ${status === "result" ? `
            <section class="panel liar-panel">
              <h2>실제 라이어 공개</h2>
              ${renderLiarAnswerReveal()}
            </section>
          ` : ""}
        </div>
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
    document.querySelector("#copyRoomCodeBtn").addEventListener("click", copyRoomCode);
    document.querySelectorAll("[data-switch-mode]").forEach((button) => {
      button.addEventListener("click", () => switchRoomMode(button.dataset.switchMode));
    });
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleTeacherAction(button.dataset.action));
    });
    document.querySelectorAll("[data-liar-count-step]").forEach((button) => {
      button.addEventListener("click", () => stepLiarCount(Number(button.dataset.liarCountStep)));
    });
  }, force);
}

function renderCatchmindStudentRoute() {
  const status = state.room.status || "waiting";
  const game = getCatchmindState();
  const round = getCurrentCatchmindRound();

  if (status === "waiting" || !round) {
    renderCatchmindStudentWaiting(true);
    return;
  }

  if (status === "finished") {
    renderCatchmindFinalResult("student-catchmind-final", false, true);
    return;
  }

  if (status === "result") {
    renderCatchmindRoundResult("student-catchmind-result", false, true);
    return;
  }

  if (isCurrentCatchmindDrawer()) {
    if (status === "ready") {
      renderCatchmindDrawerReady(true);
      return;
    }
    if (status === "playing") {
      renderCatchmindDrawerCanvas(true);
      return;
    }
  }

  if (status === "ready") {
    renderCatchmindGuessWaiting(true);
    return;
  }

  if (status === "playing") {
    renderCatchmindGuesser(false);
    return;
  }

  renderCatchmindStudentWaiting(true);
}

function renderCatchmindStudentWaiting(force = false) {
  const students = getStudents();
  setView("catchmind-student-waiting", `
    <section class="screen catchmind-mode">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill blue">캐치마인드</span>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>
      <section class="panel catchmind-panel">
        <h2>선생님이 캐치마인드를 시작할 때까지 기다려 주세요.</h2>
        <p class="lead">현재 입장한 학생은 ${students.length}명입니다.</p>
        <div class="notice info">게임이 시작되면 라운드마다 한 명이 제시어를 보고 그림을 그립니다.</div>
      </section>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome);
  }, force);
}

function renderCatchmindDrawerReady(force = false) {
  const round = getCurrentCatchmindRound();
  const ready = isCatchmindDrawerReady();
  const visibleKey = `${round.roundId}:${state.studentId}`;
  const wordVisible = state.catchmindWordVisibleKey === visibleKey;

  setView(`catchmind-drawer-ready-${round.roundId}-${ready}-${wordVisible}`, `
    <section class="screen catchmind-mode">
      <div class="status-bar">
        <span class="pill green">이번 라운드의 출제자는 당신입니다!</span>
        <span class="pill blue">${round.index + 1} / ${getCatchmindSettings().totalRounds} 라운드</span>
      </div>
      <section class="panel catchmind-panel word-card">
        <p class="eyebrow">제시어 확인</p>
        ${wordVisible ? `
          <h1>${escapeHtml(round.word)}</h1>
          <p class="lead">그림으로만 표현하세요. 글자나 숫자를 직접 쓰지 마세요.</p>
          <button class="btn success" data-action="catchmind-drawer-ready" type="button" ${ready ? "disabled" : ""}>${ready ? "준비 완료" : "그림 그리기 준비 완료"}</button>
        ` : `
          <h2>제시어를 조용히 확인하세요.</h2>
          <button class="btn primary" id="showCatchmindWordBtn" type="button">제시어 확인하기</button>
        `}
      </section>
      <div class="notice info">준비 완료를 누르면 선생님이 라운드를 시작할 수 있습니다.</div>
    </section>
  `, () => {
    document.querySelector("#showCatchmindWordBtn")?.addEventListener("click", () => {
      state.catchmindWordVisibleKey = visibleKey;
      renderCatchmindDrawerReady(true);
    });
    document.querySelector("[data-action='catchmind-drawer-ready']")?.addEventListener("click", confirmCatchmindDrawerReady);
  }, force);
}

function renderCatchmindGuessWaiting(force = false) {
  const round = getCurrentCatchmindRound();
  setView(`catchmind-waiting-round-${round.roundId}`, `
    <section class="screen catchmind-mode">
      <section class="panel catchmind-panel">
        <span class="pill blue">라운드 준비</span>
        <h2>${escapeHtml(round.drawerName)} 학생이 제시어를 확인하고 있습니다.</h2>
        <p class="lead">선생님이 라운드를 시작하면 그림과 정답 입력창이 열립니다.</p>
      </section>
    </section>
  `, null, force);
}

function renderCatchmindDrawerCanvas(force = false) {
  const round = getCurrentCatchmindRound();
  const viewName = `catchmind-drawer-canvas-${round.roundId}-${state.room.status}`;
  if (securePilot && state.catchmindDrawing.roundId !== round.roundId) state.catchmindDrawing.active = false;

  // Firebase에 획을 저장할 때마다 방 구독이 갱신된다. 누르고 있는 동안
  // 캔버스를 교체하면 이전 캔버스의 좌표가 사라져 선이 모서리로 튄다.
  const existingCanvas = document.querySelector("#catchmindCanvas");
  if (state.activeView === viewName && existingCanvas) {
    if (securePilot) {
      const count = document.querySelector("#catchmindDrawerCorrectCount");
      if (count) count.textContent = getCatchmindCorrectCount();
      if (!state.catchmindDrawing.active && !state.catchmindDrawingWrites) refreshCatchmindCanvas(existingCanvas);
      return;
    }
    if (state.catchmindDrawing.active) return;
  }

  setView(viewName, `
    <section class="screen catchmind-mode experience-drawing">
      <div class="status-bar">
        <div>
          <p class="eyebrow">출제자 화면</p>
          <h1>${escapeHtml(round.word)}</h1>
        </div>
        <span class="pill green" id="catchmindTimerText">남은 시간</span>
      </div>
      <div class="catchmind-play-layout">
        <section class="panel catchmind-panel">
          ${renderCatchmindCanvasSurface(true)}
          ${renderCatchmindTools()}
        </section>
        <aside class="panel">
          <h2>그림 규칙</h2>
          <div class="notice warn">글자, 숫자, 정답을 직접 쓰지 말고 그림으로만 표현하세요.</div>
          <p class="muted">정답자 <span id="catchmindDrawerCorrectCount">${getCatchmindCorrectCount()}</span>명</p>
        </aside>
      </div>
    </section>
  `, () => {
    setupCatchmindCanvas({ interactive: true });
    setupCatchmindToolHandlers();
    startCatchmindRoundTimer({
      round,
      textSelector: "#catchmindTimerText",
      onEnd: null
    });
  }, force);
}

function renderCatchmindGuesser(force = false) {
  const round = getCurrentCatchmindRound();
  if (securePilot && state.catchmindGuesserRound !== round.roundId) {
    state.catchmindGuesserRound = round.roundId;
    state.catchmindAnswerDraft = "";
    state.catchmindWrongMessage = "";
  }
  const answer = getMyCatchmindCorrectAnswer();
  const viewName = `catchmind-guesser-${round.roundId}-${Boolean(answer)}`;
  const disabled = Boolean(answer);

  // Firebase updates on every new stroke and answer. Keep the answer form mounted
  // so a student's keyboard, focus, draft, and scroll position do not jump.
  if (state.activeView === viewName && document.querySelector("#catchmindCanvas")) {
    refreshCatchmindGuesserView(round, answer);
    return;
  }

  setView(viewName, `
    <section class="screen catchmind-mode experience-drawing experience-guessing">
      <div class="status-bar">
        <div>
          <p class="eyebrow">${escapeHtml(round.drawerName)} 학생이 그림을 그리고 있습니다</p>
          <h1 id="catchmindTimerText">남은 시간</h1>
        </div>
        <span class="pill blue">${round.index + 1} / ${getCatchmindSettings().totalRounds} 라운드</span>
      </div>
      <div class="catchmind-play-layout">
        <section class="panel catchmind-panel">
          ${renderCatchmindCanvasSurface(false)}
        </section>
        <aside class="panel">
          <div id="catchmindHintBox">${renderCatchmindHint(round, Boolean(answer))}</div>
          ${answer ? `
            <div class="notice success">
              <h2>정답입니다!</h2>
              <p>정답: ${escapeHtml(round.word)}</p>
              <p>${answer.rank}번째 정답 · +${answer.scoreEarned}점</p>
            </div>
          ` : `
            <div class="field">
              <label for="catchmindAnswerInput">정답 입력</label>
              <input id="catchmindAnswerInput" maxlength="40" autocomplete="off" placeholder="정답을 입력하세요" value="${escapeAttr(state.catchmindAnswerDraft)}" ${disabled ? "disabled" : ""} />
            </div>
            <button class="btn primary full" id="catchmindAnswerSubmitBtn" type="button" ${disabled ? "disabled" : ""}>정답 제출</button>
            <div id="catchmindAnswerFeedback" class="notice danger" aria-live="polite" ${state.catchmindWrongMessage ? "" : "hidden"}>${escapeHtml(state.catchmindWrongMessage)}</div>
          `}
        </aside>
      </div>
    </section>
  `, () => {
    setupCatchmindCanvas({ interactive: false });
    setupCatchmindAnswerHandlers();
    startCatchmindRoundTimer({
      round,
      textSelector: "#catchmindTimerText",
      hintSelector: "#catchmindHintBox",
      alreadyCorrect: Boolean(answer),
      onEnd: null
    });
  }, force);
}

function refreshCatchmindGuesserView(round, answer) {
  const canvas = document.querySelector("#catchmindCanvas");
  if (canvas) refreshCatchmindCanvas(canvas);

  const hintBox = document.querySelector("#catchmindHintBox");
  if (hintBox) {
    hintBox.innerHTML = renderCatchmindHint(round, Boolean(answer));
  }

  const feedback = document.querySelector("#catchmindAnswerFeedback");
  if (feedback) {
    feedback.textContent = state.catchmindWrongMessage;
    feedback.hidden = !state.catchmindWrongMessage;
  }
}

function refreshCatchmindCanvas(canvas) {
  const renderKey = getCatchmindStrokeRenderKey();
  if (canvas.dataset.catchmindRenderKey === renderKey) return;
  resizeCatchmindCanvas(canvas);
  drawCatchmindCanvas(canvas);
  canvas.dataset.catchmindRenderKey = renderKey;
}

function renderCatchmindRoundResult(viewName, showTeacherControls, force = false) {
  const round = getCurrentCatchmindRound();
  if (!round) {
    renderCatchmindStudentWaiting(true);
    return;
  }

  setView(viewName, `
    <section class="screen catchmind-mode">
      <div class="status-bar">
        <span class="pill gold">라운드 결과</span>
        ${showTeacherControls ? `
          <div class="button-row">
            <button class="btn success" data-action="catchmind-next-round" type="button">${isLastCatchmindRound() ? "최종 결과 보기" : "다음 라운드"}</button>
            <button class="btn danger" data-action="reset" type="button">게임 초기화</button>
          </div>
        ` : ""}
      </div>
      <section class="panel catchmind-panel result-panel">
        ${renderExperienceHeading("정답", round.word, "catchmind/drawing-reveal")}
        <p class="lead">출제자: ${escapeHtml(round.drawerName)}</p>
      </section>
      <div class="grid-2">
        <section class="panel">
          <h2>정답 순위</h2>
          ${renderCatchmindCorrectRanking()}
        </section>
        <section class="panel">
          <h2>출제자 점수</h2>
          ${renderCatchmindDrawerScore()}
        </section>
      </div>
      <section class="panel">
        <h2>누적 랭킹</h2>
        ${renderRanking(getCumulativeRanking())}
      </section>
    </section>
  `, () => {
    document.querySelector("[data-action='catchmind-next-round']")?.addEventListener("click", nextCatchmindRound);
    document.querySelector("[data-action='reset']")?.addEventListener("click", resetGame);
  }, force);
}

function renderCatchmindDisplay(force = false) {
  const status = state.room?.status || "waiting";
  const round = getCurrentCatchmindRound();
  const viewName = `display-catchmind-${status}-${round?.roundId || "none"}-${getCatchmindStrokeRenderKey()}-${getCatchmindCorrectAnswers().length}`;

  if (status === "finished") {
    renderDisplayShell(viewName, "캐치마인드 최종 결과", "누적 점수를 확인합니다.", `
      <section class="panel">
        ${renderRanking(getCumulativeRanking())}
      </section>
    `, null, force);
    return;
  }

  if (!round || status === "waiting") {
    renderDisplayShell(viewName, "캐치마인드", "그림을 보고 제시어를 가장 빠르게 맞혀라!", `
      <section class="panel catchmind-panel result-panel">
        <h1>게임을 준비 중입니다.</h1>
        <p class="lead">학생들이 입장하면 선생님이 라운드를 시작합니다.</p>
      </section>
    `, null, force);
    return;
  }

  if (status === "result") {
    renderDisplayShell(viewName, "라운드 결과", `${round.index + 1} / ${getCatchmindSettings().totalRounds} 라운드`, `
      <section class="panel catchmind-panel result-panel">
        ${renderExperienceHeading("정답", round.word, "catchmind/drawing-reveal")}
        <p class="lead">출제자: ${escapeHtml(round.drawerName)}</p>
      </section>
      <section class="panel">
        ${renderCatchmindCorrectRanking()}
      </section>
    `, null, force);
    return;
  }

  renderDisplayShell(viewName, "캐치마인드", `${escapeHtml(round.drawerName)} 학생이 그림을 그리고 있습니다`, `
    <section class="panel catchmind-panel">
      <div class="status-bar">
        <span class="pill green" id="catchmindDisplayTimer">남은 시간</span>
        <span class="pill blue">정답 ${getCatchmindCorrectCount()} / ${getCatchmindGuesserCount()}명</span>
      </div>
      ${renderCatchmindCanvasSurface(false)}
    </section>
  `, () => {
    setupCatchmindCanvas({ interactive: false });
    startCatchmindRoundTimer({
      round,
      textSelector: "#catchmindDisplayTimer",
      onEnd: null
    });
  }, force);
}

function renderCatchmindTeacherDashboard(force = true) {
  const students = getStudents();
  const game = getCatchmindState();
  const settings = getCatchmindSettings();
  const round = getCurrentCatchmindRound();
  const status = state.room.status || "waiting";
  const words = parseCatchmindWords(settings.wordsText || "");
  const canStart = students.length >= 2 && words.length > 0;
  const answerVisible = round && state.catchmindTeacherAnswerVisibleKey === round.roundId;

  setView(`teacher-catchmind-${status}-${round?.roundId || "none"}-${getCatchmindStrokeRenderKey()}-${getCatchmindCorrectAnswers().length}-${answerVisible}`, `
    <section class="screen catchmind-mode">
      <div class="status-bar">
        <div>
          <p class="eyebrow">교사 화면</p>
          <h1>캐치마인드</h1>
        </div>
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
      </div>

      <div class="panel catchmind-panel">
        <div class="status-bar">
          <div>
            <p class="muted small">학생들에게 알려 줄 방 코드</p>
            <div class="room-code">${escapeHtml(state.roomCode)}</div>
          </div>
          <div class="button-row">
            <span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span>
            <button class="btn ghost" id="copyRoomCodeBtn" type="button">방 코드 복사</button>
            <button class="btn dark" data-action="open-display" type="button">교실 화면 팝업</button>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><span class="muted">참가 학생</span><span class="num">${students.length}</span></div>
          <div class="stat"><span class="muted">제시어</span><span class="num">${words.length}</span></div>
          <div class="stat"><span class="muted">라운드</span><span class="num">${round ? `${round.index + 1}/${settings.totalRounds}` : settings.totalRounds}</span></div>
        </div>
      </div>

      <div class="teacher-grid">
        <aside class="panel">
          ${renderTeacherModeControls()}
          <section class="panel tight">
            <h2>게임 설정</h2>
            <div class="field">
              <label for="catchmindWordsInput">제시어 목록</label>
              <textarea id="catchmindWordsInput" maxlength="1200" placeholder="한 줄에 제시어 하나씩 입력해 주세요." ${status === "waiting" ? "" : "disabled"}>${escapeHtml(settings.wordsText || "")}</textarea>
              <p class="muted small" id="catchmindWordCount">사용 가능한 제시어 ${words.length}개</p>
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="catchmindDurationInput">라운드 제한 시간</label>
                <input id="catchmindDurationInput" type="number" min="${MIN_CATCHMIND_ROUND_SECONDS}" max="${MAX_CATCHMIND_ROUND_SECONDS}" value="${settings.roundDuration}" ${status === "waiting" ? "" : "disabled"} />
              </div>
              <div class="field">
                <label for="catchmindRoundsInput">게임 라운드 수</label>
                <input id="catchmindRoundsInput" type="number" min="1" max="${Math.max(1, words.length)}" value="${Math.min(settings.totalRounds, Math.max(1, words.length || settings.totalRounds))}" ${status === "waiting" ? "" : "disabled"} />
              </div>
            </div>
            <div class="button-row">
              <button class="btn primary" data-action="catchmind-save-settings" type="button" ${status === "waiting" ? "" : "disabled"}>설정 저장</button>
              <button class="btn success" data-action="catchmind-start-game" type="button" ${canStart && status === "waiting" ? "" : "disabled"}>게임 시작</button>
            </div>
            <p class="muted small">힌트가 정상 작동하도록 제한 시간은 최소 31초 이상입니다.</p>
          </section>

          <h2>진행 조작</h2>
          <div class="button-row">
            <button class="btn primary" data-action="catchmind-start-round" type="button" ${status === "ready" ? "" : "disabled"}>라운드 시작</button>
            <button class="btn warn" data-action="catchmind-end-round" type="button" ${status === "playing" ? "" : "disabled"}>라운드 강제 종료</button>
            <button class="btn ghost" data-action="catchmind-toggle-answer" type="button" ${round ? "" : "disabled"}>${answerVisible ? "정답 숨기기" : "정답 확인"}</button>
            <button class="btn success" data-action="catchmind-next-round" type="button" ${status === "result" ? "" : "disabled"}>${isLastCatchmindRound() ? "최종 결과 보기" : "다음 라운드"}</button>
            <button class="btn success" data-action="catchmind-restart-same" type="button" ${status === "finished" ? "" : "disabled"}>같은 설정으로 다시 하기</button>
            <button class="btn ghost" data-action="catchmind-configure" type="button" ${status !== "waiting" ? "" : "disabled"}>설정 변경하기</button>
            <button class="btn danger" data-action="reset" type="button">게임 초기화</button>
            <button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button>
          </div>
        </aside>

        <div class="screen">
          <section class="panel catchmind-panel">
            <h2>현재 라운드</h2>
            ${renderCatchmindTeacherRoundPanel(answerVisible)}
          </section>
          <div class="grid-2">
            <section class="panel">
              <h3>정답 완료</h3>
              ${renderCatchmindCorrectList()}
            </section>
            <section class="panel">
              <h3>미정답</h3>
              ${renderCatchmindUnansweredList()}
            </section>
          </div>
          <div class="grid-2">
            <section class="panel">
              <h3>최근 오답</h3>
              ${renderCatchmindWrongAnswers()}
            </section>
            <section class="panel">
              <h3>누적 랭킹</h3>
              ${renderRanking(getCumulativeRanking().slice(0, 8))}
            </section>
          </div>
        </div>
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome);
    document.querySelector("#copyRoomCodeBtn")?.addEventListener("click", copyRoomCode);
    document.querySelectorAll("[data-switch-mode]").forEach((button) => {
      button.addEventListener("click", () => switchRoomMode(button.dataset.switchMode));
    });
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleTeacherAction(button.dataset.action));
    });
    setupCatchmindSettingsPreview();
    setupCatchmindCanvas({ interactive: false });
    if (status === "playing" && round) {
      startCatchmindRoundTimer({
        round,
        textSelector: "#catchmindTeacherTimer",
        fillSelector: "#catchmindTeacherTimerFill",
        onEnd: () => endCatchmindRound()
      });
    }
  }, force);
}

function renderCatchmindCanvasSurface(interactive) {
  return `
    <div class="catchmind-canvas-wrap ${interactive ? "drawing" : ""}">
      <canvas id="catchmindCanvas" class="catchmind-canvas" aria-label="캐치마인드 그림판"></canvas>
    </div>
  `;
}

function renderCatchmindTools() {
  const colors = [
    ["#111827", "검정"],
    ["#ef4444", "빨강"],
    ["#2563eb", "파랑"],
    ["#16a34a", "초록"]
  ];
  const sizes = [
    [3, "얇게"],
    [5, "보통"],
    [9, "굵게"]
  ];

  return `
    <div class="catchmind-tools">
      <div class="segmented" role="group" aria-label="펜 색과 지우개">
        ${colors.map(([color, label]) => `
          <button class="tool-btn ${state.catchmindTool === "pen" && state.catchmindColor === color ? "selected" : ""}" data-catchmind-color="${color}" type="button" title="${label}" aria-label="${label} 펜" aria-pressed="${state.catchmindTool === "pen" && state.catchmindColor === color}">
            <span class="color-dot" style="background:${color}"></span>
          </button>
        `).join("")}
        <button class="tool-btn ${state.catchmindTool === "eraser" ? "selected" : ""}" data-catchmind-tool="eraser" type="button" aria-pressed="${state.catchmindTool === "eraser"}">지우개</button>
      </div>
      <div class="segmented">
        ${sizes.map(([size, label]) => `
          <button class="btn ${state.catchmindSize === size ? "primary" : "ghost"}" data-catchmind-size="${size}" type="button" aria-pressed="${state.catchmindSize === size}">${label}</button>
        `).join("")}
      </div>
      <div class="button-row">
        <button class="btn ghost" id="catchmindUndoBtn" type="button">실행 취소</button>
        <button class="btn danger" id="catchmindClearBtn" type="button">전체 지우기</button>
      </div>
    </div>
  `;
}

function renderCatchmindHint(round, alreadyCorrect = false) {
  if (!round || alreadyCorrect) {
    return `<div class="notice info">정답을 맞힌 뒤에는 힌트가 더 이상 강조되지 않습니다.</div>`;
  }

  const remaining = getCatchmindRemainingSeconds(round);
  const lengthHint = securePilot ? Number.isInteger(round.hints?.length) : remaining <= 30;
  const initialHint = securePilot ? typeof round.hints?.initials === "string" : remaining <= 10;

  if (!lengthHint) {
    return `<div class="notice info">남은 시간 30초에 글자 수 힌트가 공개됩니다.</div>`;
  }

  return `
    <div class="notice ${initialHint ? "warn hint-pop" : "info"}">
      <strong>힌트: ${securePilot ? round.hints.length : countCatchmindLetters(round.word)}글자</strong>
      ${initialHint ? `<p>초성: ${escapeHtml(securePilot ? round.hints.initials : getKoreanInitials(round.word))}</p>` : ""}
    </div>
  `;
}

function renderCatchmindTeacherRoundPanel(answerVisible) {
  const round = getCurrentCatchmindRound();
  if (!round) {
    return `<div class="empty">게임을 시작하면 현재 라운드가 표시됩니다.</div>`;
  }

  const correctCount = getCatchmindCorrectAnswers().length;
  const guesserCount = getCatchmindGuesserCount();
  const ready = isCatchmindDrawerReady();
  const status = state.room.status || "waiting";

  return `
    <div class="stack">
      <div class="stats">
        <div class="stat"><span class="muted">현재 라운드</span><span class="num">${round.index + 1} / ${getCatchmindSettings().totalRounds}</span></div>
        <div class="stat"><span class="muted">출제자</span><span class="num">${escapeHtml(round.drawerName)}</span></div>
        <div class="stat"><span class="muted">정답</span><span class="num">${correctCount} / ${guesserCount}</span></div>
      </div>
      ${answerVisible ? `<div class="notice warn"><strong>교사용 정답:</strong> ${escapeHtml(round.word)}</div>` : `<div class="notice info">정답은 필요할 때만 확인하세요.</div>`}
      ${status === "ready" ? `<div class="notice ${ready ? "success" : "info"}">출제자 준비 상태: ${ready ? "준비 완료" : "제시어 확인 중"}</div>` : ""}
      ${status === "playing" ? `
        <div>
          <div class="status-bar">
            <strong id="catchmindTeacherTimer">남은 시간</strong>
            <span class="pill green">진행 중</span>
          </div>
          <div class="timer-track"><div id="catchmindTeacherTimerFill" class="timer-fill"></div></div>
        </div>
        ${renderCatchmindCanvasSurface(false)}
      ` : ""}
      ${status === "result" ? renderCatchmindDrawerScore() : ""}
    </div>
  `;
}

function renderCatchmindCorrectList() {
  const answers = getCatchmindCorrectAnswers();
  if (!answers.length) {
    return `<div class="empty">아직 정답자가 없습니다.</div>`;
  }
  return `
    <ul class="list">
      ${answers.map((answer) => `
        <li class="list-row split">
          <strong>${answer.rank}위 ${escapeHtml(answer.name)}</strong>
          <span class="pill green">+${answer.scoreEarned}점</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderCatchmindUnansweredList() {
  const round = getCurrentCatchmindRound();
  if (!round) {
    return `<div class="empty">라운드가 없습니다.</div>`;
  }
  const correctIds = new Set(getCatchmindCorrectAnswers().map((answer) => answer.studentId));
  const students = getStudents().filter((student) => student.id !== round.drawerId && !correctIds.has(student.id));
  if (!students.length) {
    return `<div class="notice success">모든 추리 참가자가 정답을 맞혔습니다.</div>`;
  }
  return renderStudentList(students);
}

function renderCatchmindWrongAnswers() {
  const wrong = getCatchmindWrongAnswers().slice(-8).reverse();
  if (!wrong.length) {
    return `<div class="empty">최근 오답이 없습니다.</div>`;
  }
  return `
    <ul class="list">
      ${wrong.map((answer) => `
        <li class="list-row split">
          <strong>${escapeHtml(answer.name)}</strong>
          <span>${escapeHtml(answer.text)}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderCatchmindCorrectRanking() {
  const answers = getCatchmindCorrectAnswers();
  if (!answers.length) {
    return `<div class="empty">정답자가 없습니다.</div>`;
  }
  const medals = ["🥇", "🥈", "🥉"];
  return `
    <div class="ranking">
      ${answers.map((answer, index) => `
        <div class="ranking-row rank-${index + 1}">
          <span class="rank-medal">${medals[index] || answer.rank}</span>
          <strong>${renderPlaygroundName(answer)}</strong>
          <span class="score">+${answer.scoreEarned}점</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCatchmindDrawerScore() {
  const round = getCurrentCatchmindRound();
  if (!round) {
    return `<div class="empty">출제자 점수가 없습니다.</div>`;
  }
  const roundData = getCurrentCatchmindRoundData();
  const score = Number(roundData.drawerScoreEarned ?? calculateCatchmindDrawerScore().drawerScore);
  const correct = getCatchmindCorrectCount();
  const total = getCatchmindGuesserCount();
  return `
    <div class="notice ${score ? "success" : "info"}">
      <h2>${escapeHtml(round.drawerName)} +${score}점</h2>
      <p>정답자 ${correct} / ${total}명</p>
    </div>
  `;
}

function renderCatchmindFinalResult(viewName, showTeacherControls, force = false) {
  const ranking = getCumulativeRanking();
  setView(viewName, `
    <section class="screen catchmind-mode">
      <div class="status-bar">
        <span class="pill red">최종 결과</span>
        ${showTeacherControls ? `
          <div class="button-row">
            <button class="btn success" data-action="catchmind-restart-same" type="button">같은 설정으로 다시 하기</button>
            <button class="btn ghost" data-action="catchmind-configure" type="button">설정 변경하기</button>
            <button class="btn dark" id="backHomeBtn" type="button">플레이그라운드로 돌아가기</button>
          </div>
        ` : ""}
      </div>
      <section class="panel catchmind-panel result-panel">
        <h1>캐치마인드 최종 결과</h1>
      </section>
      <section class="panel">
        ${renderRanking(ranking)}
      </section>
    </section>
  `, () => {
    document.querySelector("[data-action='catchmind-restart-same']")?.addEventListener("click", () => startCatchmindGame({ reuseSettings: true }));
    document.querySelector("[data-action='catchmind-configure']")?.addEventListener("click", configureCatchmindGame);
    document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome);
  }, force);
}

async function saveCatchmindSettings() {
  const settings = readCatchmindSettingsFromForm();
  if (!validateCatchmindSettings(settings)) {
    return;
  }
  if (securePilot) return securePilotHostCommand("catchmindSettings", settings);

  try {
    await update(roomRef(state.roomCode), {
      "catchmind/settings": settings
    });
    showToast("캐치마인드 설정을 저장했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("캐치마인드 설정을 저장하지 못했습니다.", "error");
  }
}

async function startCatchmindGame({ reuseSettings = false } = {}) {
  const students = getStudents();
  const settings = reuseSettings ? getCatchmindSettings() : readCatchmindSettingsFromForm();

  if (students.length < 2) {
    showToast("캐치마인드는 학생이 2명 이상 입장해야 시작할 수 있습니다.", "error");
    return;
  }

  if (!validateCatchmindSettings(settings)) {
    return;
  }
  if (securePilot) {
    if (securePilot.isController()) openDisplayWindow({ silent: true });
    return securePilotHostCommand("startCatchmind", reuseSettings ? { reuse: true } : settings);
  }

  const gameId = `catch_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const wordOrder = shuffleArray(settings.wordList).slice(0, settings.totalRounds);
  const drawerOrder = buildCatchmindDrawerOrder(students, settings.totalRounds);
  const firstRound = createCatchmindRound({ gameId, index: 0, wordOrder, drawerOrder, students });
  const updates = {
    mode: "catchmind",
    status: "ready",
    catchmind: {
      settings,
      gameId,
      currentRoundIndex: 0,
      drawerOrder,
      wordOrder,
      currentRound: firstRound,
      rounds: {
        [firstRound.roundId]: getEmptyCatchmindRoundData()
      }
    }
  };

  students.forEach((student) => {
    updates[`students/${student.id}/score`] = 0;
  });

  openDisplayWindow();

  try {
    await update(roomRef(state.roomCode), updates);
    state.catchmindTeacherAnswerVisibleKey = "";
    state.catchmindWordVisibleKey = "";
    showToast("캐치마인드 게임을 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("캐치마인드 게임을 시작하지 못했습니다.", "error");
  }
}

async function confirmCatchmindDrawerReady() {
  const round = getCurrentCatchmindRound();
  if (!round || !isCurrentCatchmindDrawer()) {
    showToast("현재 출제자만 준비 완료를 누를 수 있습니다.", "error");
    return;
  }
  if (securePilot) {
    const result = await securePilot.send("readyCatchmind", { roundId: round.roundId });
    return showToast(result.error ? securePilotError(result.error) : "준비 완료를 선생님께 보냈습니다.", result.error ? "error" : "success");
  }

  try {
    await update(roomRef(state.roomCode), {
      "catchmind/currentRound/drawerReady": true,
      "catchmind/currentRound/drawerReadyAt": Date.now()
    });
    showToast("준비 완료를 선생님께 보냈습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("준비 상태를 저장하지 못했습니다.", "error");
  }
}

async function startCatchmindRound() {
  const round = getCurrentCatchmindRound();
  const settings = getCatchmindSettings();
  if (!round) {
    showToast("시작할 라운드가 없습니다.", "error");
    return;
  }
  if (securePilot) return securePilotHostCommand("openCatchmindRound");

  const now = Date.now();
  const endsAt = now + settings.roundDuration * 1000;
  try {
    await update(roomRef(state.roomCode), {
      status: "playing",
      "catchmind/currentRound/roundStartedAt": now,
      "catchmind/currentRound/roundEndsAt": endsAt,
      [`catchmind/rounds/${round.roundId}/startedAt`]: now,
      [`catchmind/rounds/${round.roundId}/endsAt`]: endsAt,
      [`catchmind/rounds/${round.roundId}/endedAt`]: null
    });
    showToast("라운드를 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("라운드를 시작하지 못했습니다.", "error");
  }
}

async function submitCatchmindAnswer() {
  const round = getCurrentCatchmindRound();
  const input = document.querySelector("#catchmindAnswerInput");
  const text = cleanText(input?.value || state.catchmindAnswerDraft || "");

  if (!round || (state.room?.status || "waiting") !== "playing") {
    showToast("지금은 정답 제출 시간이 아닙니다.", "error");
    return;
  }

  if (round.drawerId === state.studentId) {
    showToast("출제자는 정답을 제출하지 않습니다.", "error");
    return;
  }

  if ((securePilot?.now() ?? Date.now()) > Number(round.roundEndsAt || 0)) {
    showToast("라운드 시간이 끝났습니다.", "error");
    return;
  }

  if (!text) {
    showToast("정답을 입력해 주세요.", "error");
    return;
  }

  if (getMyCatchmindCorrectAnswer()) {
    showToast("이미 정답을 맞혔습니다.", "success");
    return;
  }

  if (securePilot) {
    if (state.catchmindPendingAnswer?.roundId === round.roundId) return;
    const pending = { roomCode: state.roomCode, roundId: round.roundId };
    const selection = input?.value;
    state.catchmindPendingAnswer = pending;
    try {
      const result = await securePilot.send("guessCatchmind", { roundId: round.roundId, text });
      if (state.roomCode !== pending.roomCode || getCurrentCatchmindRound()?.roundId !== round.roundId || state.room?.status !== "playing") return;
      if (result.error) return showToast(securePilotError(result.error), "error");
      if (result.correct) {
        state.catchmindAnswerDraft = "";
        state.catchmindWrongMessage = "";
        return showToast("정답입니다!", "success");
      }
      if (input?.value === selection && input?.isConnected) {
        state.catchmindWrongMessage = "땡! 다시 생각해 보세요.";
        refreshCatchmindGuesserView(getCurrentCatchmindRound(), null);
        input.focus({ preventScroll: true });
        input.select();
      }
    } finally {
      if (state.catchmindPendingAnswer === pending) state.catchmindPendingAnswer = null;
    }
    return;
  }

  if (normalizeCatchmindAnswer(text) !== normalizeCatchmindAnswer(round.word)) {
    const wrongId = `wrong_${Date.now()}_${state.studentId.slice(0, 6)}`;
    state.catchmindWrongMessage = "땡! 다시 생각해 보세요.";
    try {
      await set(ref(db, `rooms/${state.roomCode}/catchmind/rounds/${round.roundId}/wrongAnswers/${wrongId}`), {
        studentId: state.studentId,
        name: state.studentName,
        text,
        submittedAt: Date.now()
      });
    } catch (error) {
      finalRelease?.record("app-error");
    }
    refreshCatchmindGuesserView(round, null);
    input?.focus({ preventScroll: true });
    input?.select();
    return;
  }

  const correctPath = ref(db, `rooms/${state.roomCode}/catchmind/rounds/${round.roundId}/correctAnswers`);
  const submittedAt = Date.now();
  try {
    const result = await runTransaction(correctPath, (current) => {
      const answers = current && typeof current === "object" ? { ...current } : {};
      if (answers[state.studentId]) {
        return answers;
      }
      const rank = Object.keys(answers).length + 1;
      answers[state.studentId] = {
        studentId: state.studentId,
        name: state.studentName,
        answer: text,
        rank,
        scoreEarned: getCatchmindAnswerScore(rank),
        answeredAt: submittedAt
      };
      return answers;
    });
    if (result.committed) {
      state.catchmindAnswerDraft = "";
      state.catchmindWrongMessage = "";
      showToast("정답입니다!", "success");
      renderCatchmindGuesser(false);
    }
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("정답을 저장하지 못했습니다.", "error");
  }
}

async function endCatchmindRound({ forced = false } = {}) {
  const round = getCurrentCatchmindRound();
  if (!round || !["ready", "playing"].includes(state.room?.status || "waiting")) {
    return;
  }

  if (forced && !window.confirm("현재 라운드를 강제 종료할까요?")) {
    return;
  }
  if (securePilot) {
    if (!securePilot.isController() && !forced) return;
    return securePilotHostCommand("publishCatchmindRound", { forced }, !forced);
  }

  const scorePath = ref(db, `rooms/${state.roomCode}/catchmind/rounds/${round.roundId}/scoreApplied`);
  const correctAnswers = getCatchmindCorrectAnswers();
  const { drawerScore } = calculateCatchmindDrawerScore();
  const updates = {
    status: "result",
    "catchmind/currentRound/endedAt": Date.now(),
    [`catchmind/rounds/${round.roundId}/endedAt`]: Date.now(),
    [`catchmind/rounds/${round.roundId}/drawerScoreEarned`]: drawerScore,
    [`catchmind/rounds/${round.roundId}/correctCount`]: correctAnswers.length
  };

  try {
    const scoreResult = await runTransaction(scorePath, (current) => current ? undefined : true);
    await update(roomRef(state.roomCode), updates);
    if (scoreResult.committed) {
      for (const answer of correctAnswers) {
        await incrementStudentScore(answer.studentId, answer.scoreEarned);
      }
      if (drawerScore > 0) {
        await incrementStudentScore(round.drawerId, drawerScore);
      }
    }
    showToast("라운드 결과를 공개했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("라운드를 종료하지 못했습니다.", "error");
  }
}

async function nextCatchmindRound() {
  if (securePilot) return securePilotHostCommand("nextCatchmindRound");
  const game = getCatchmindState();
  const settings = getCatchmindSettings();
  const currentIndex = Number(game.currentRoundIndex || 0);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= settings.totalRounds) {
    try {
      await update(roomRef(state.roomCode), {
        status: "finished",
        "catchmind/finishedAt": Date.now()
      });
    } catch (error) {
      finalRelease?.record("app-error");
      showToast("최종 결과로 이동하지 못했습니다.", "error");
    }
    return;
  }

  const students = getStudents();
  const nextRound = createCatchmindRound({
    gameId: game.gameId,
    index: nextIndex,
    wordOrder: game.wordOrder,
    drawerOrder: game.drawerOrder,
    students
  });

  try {
    await update(roomRef(state.roomCode), {
      status: "ready",
      "catchmind/currentRoundIndex": nextIndex,
      "catchmind/currentRound": nextRound,
      [`catchmind/rounds/${nextRound.roundId}`]: getEmptyCatchmindRoundData()
    });
    state.catchmindTeacherAnswerVisibleKey = "";
    state.catchmindWordVisibleKey = "";
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("다음 라운드로 이동하지 못했습니다.", "error");
  }
}

function toggleCatchmindTeacherAnswer() {
  const round = getCurrentCatchmindRound();
  if (!round) {
    return;
  }
  state.catchmindTeacherAnswerVisibleKey = state.catchmindTeacherAnswerVisibleKey === round.roundId ? "" : round.roundId;
  renderCatchmindTeacherDashboard(true);
}

async function configureCatchmindGame() {
  if (!window.confirm("현재 캐치마인드 진행 기록을 지우고 설정 화면으로 돌아갈까요?")) {
    return;
  }
  if (securePilot) return securePilotHostCommand("resetCatchmind", { confirmed: true });

  try {
    await update(roomRef(state.roomCode), {
      status: "waiting",
      catchmind: {
        settings: getCatchmindSettings()
      }
    });
    showToast("캐치마인드 설정 화면으로 돌아왔습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("설정 화면으로 돌아가지 못했습니다.", "error");
  }
}

function getDefaultCatchmindSettings() {
  return {
    wordsText: "",
    wordList: [],
    roundDuration: DEFAULT_CATCHMIND_ROUND_SECONDS,
    totalRounds: 1
  };
}

function getInitialCatchmindStateForWrite() {
  return {
    settings: getDefaultCatchmindSettings()
  };
}

function getCatchmindState() {
  const raw = {
    settings: getCatchmindSettings(),
    gameId: "",
    currentRoundIndex: 0,
    drawerOrder: [],
    wordOrder: [],
    currentRound: null,
    rounds: {},
    ...(state.room?.catchmind || {})
  };
  return {
    ...raw,
    drawerOrder: normalizeIndexedList(raw.drawerOrder),
    wordOrder: normalizeIndexedList(raw.wordOrder)
  };
}

function getCatchmindSettings() {
  const settings = {
    ...getDefaultCatchmindSettings(),
    ...(state.room?.catchmind?.settings || {})
  };
  const words = parseCatchmindWords(settings.wordsText || "");
  const savedWordList = normalizeIndexedList(settings.wordList);
  return {
    ...settings,
    wordList: savedWordList.length ? savedWordList : words,
    roundDuration: clampInt(settings.roundDuration, MIN_CATCHMIND_ROUND_SECONDS, MAX_CATCHMIND_ROUND_SECONDS, DEFAULT_CATCHMIND_ROUND_SECONDS),
    totalRounds: clampInt(settings.totalRounds, 1, securePilot ? 80 : Math.max(1, words.length || savedWordList.length || 1), Math.min(DEFAULT_CATCHMIND_ROUNDS, Math.max(1, words.length || savedWordList.length || 1)))
  };
}

function readCatchmindSettingsFromForm() {
  const current = getCatchmindSettings();
  const wordsText = document.querySelector("#catchmindWordsInput")?.value ?? current.wordsText;
  const wordList = parseCatchmindWords(wordsText);
  const maxRounds = Math.max(1, wordList.length);
  return {
    wordsText,
    wordList,
    roundDuration: clampInt(document.querySelector("#catchmindDurationInput")?.value, MIN_CATCHMIND_ROUND_SECONDS, MAX_CATCHMIND_ROUND_SECONDS, current.roundDuration),
    totalRounds: clampInt(document.querySelector("#catchmindRoundsInput")?.value, 1, maxRounds, Math.min(DEFAULT_CATCHMIND_ROUNDS, maxRounds))
  };
}

function validateCatchmindSettings(settings) {
  if (!settings.wordList.length) {
    showToast("제시어를 한 개 이상 입력해 주세요.", "error");
    return false;
  }
  if (settings.totalRounds > settings.wordList.length) {
    showToast("라운드 수는 제시어 수를 넘을 수 없습니다.", "error");
    return false;
  }
  if (settings.roundDuration < MIN_CATCHMIND_ROUND_SECONDS) {
    showToast("제한 시간은 최소 31초 이상이어야 합니다.", "error");
    return false;
  }
  return true;
}

function parseCatchmindWords(text) {
  const seen = new Set();
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean)
    .filter((word) => {
      if (seen.has(word)) {
        return false;
      }
      seen.add(word);
      return true;
    })
    .slice(0, 80);
}

function normalizeIndexedList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== null && item !== undefined).map(String);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => value[key])
      .filter((item) => item !== null && item !== undefined)
      .map(String);
  }
  return [];
}

function setupCatchmindSettingsPreview() {
  const textarea = document.querySelector("#catchmindWordsInput");
  const countEl = document.querySelector("#catchmindWordCount");
  const roundsInput = document.querySelector("#catchmindRoundsInput");
  if (!textarea || !countEl) {
    return;
  }
  const updatePreview = () => {
    const words = parseCatchmindWords(textarea.value);
    countEl.textContent = `사용 가능한 제시어 ${words.length}개`;
    if (roundsInput) {
      roundsInput.max = Math.max(1, words.length);
      roundsInput.value = clampInt(roundsInput.value, 1, Math.max(1, words.length), Math.min(DEFAULT_CATCHMIND_ROUNDS, Math.max(1, words.length)));
    }
  };
  textarea.addEventListener("input", updatePreview);
  updatePreview();
}

function buildCatchmindDrawerOrder(students, totalRounds) {
  const order = [];
  while (order.length < totalRounds) {
    order.push(...shuffleArray(students.map((student) => student.id)));
  }
  return order.slice(0, totalRounds);
}

function createCatchmindRound({ gameId, index, wordOrder, drawerOrder, students }) {
  const drawerId = drawerOrder[index] || students[index % students.length]?.id || "";
  return {
    roundId: `${gameId}_r${index + 1}`,
    index,
    drawerId,
    drawerName: getStudentNameById(drawerId),
    word: wordOrder[index] || "",
    drawerReady: false,
    drawerReadyAt: null,
    roundStartedAt: null,
    roundEndsAt: null,
    endedAt: null
  };
}

function getEmptyCatchmindRoundData() {
  return {
    strokes: {},
    correctAnswers: {},
    wrongAnswers: {},
    scoreApplied: false,
    drawerScoreEarned: 0,
    correctCount: 0
  };
}

function getCurrentCatchmindRound() {
  return getCatchmindState().currentRound || null;
}

function getCurrentCatchmindRoundData() {
  const round = getCurrentCatchmindRound();
  if (!round) {
    return getEmptyCatchmindRoundData();
  }
  return {
    ...getEmptyCatchmindRoundData(),
    ...(state.room?.catchmind?.rounds?.[round.roundId] || {})
  };
}

function isCurrentCatchmindDrawer() {
  const round = getCurrentCatchmindRound();
  return Boolean(round && round.drawerId === state.studentId);
}

function isCatchmindDrawerReady() {
  return Boolean(getCurrentCatchmindRound()?.drawerReady);
}

function isLastCatchmindRound() {
  const settings = getCatchmindSettings();
  const round = getCurrentCatchmindRound();
  return Boolean(round && round.index >= settings.totalRounds - 1);
}

function getCatchmindGuesserCount() {
  const round = getCurrentCatchmindRound();
  if (!round) {
    return 0;
  }
  if (securePilot) return Number(getCurrentCatchmindRoundData().guesserCount || 0);
  return getStudents().filter((student) => student.id !== round.drawerId).length;
}

function getCatchmindCorrectCount() {
  return securePilot ? Number(getCurrentCatchmindRoundData().correctCount || 0) : getCatchmindCorrectAnswers().length;
}

function getCatchmindCorrectAnswers() {
  const raw = getCurrentCatchmindRoundData().correctAnswers || {};
  return Object.entries(raw)
    .map(([id, value]) => ({
      studentId: value.studentId || id,
      name: value.name || getStudentNameById(id),
      answer: value.answer || "",
      rank: Number(value.rank || 0),
      scoreEarned: Number(value.scoreEarned || 0),
      answeredAt: Number(value.answeredAt || 0)
    }))
    .sort((a, b) => a.rank - b.rank || a.answeredAt - b.answeredAt);
}

function getMyCatchmindCorrectAnswer() {
  return getCatchmindCorrectAnswers().find((answer) => answer.studentId === state.studentId) || null;
}

function getCatchmindWrongAnswers() {
  const raw = getCurrentCatchmindRoundData().wrongAnswers || {};
  return Object.entries(raw)
    .map(([id, value]) => ({
      id,
      studentId: value.studentId || "",
      name: value.name || "이름 없음",
      text: value.text || "",
      submittedAt: Number(value.submittedAt || 0)
    }))
    .sort((a, b) => a.submittedAt - b.submittedAt);
}

function getCatchmindAnswerScore(rank) {
  if (rank === 1) {
    return 3;
  }
  if (rank === 2) {
    return 2;
  }
  return 1;
}

function calculateCatchmindDrawerScore() {
  const correctCount = getCatchmindCorrectAnswers().length;
  const guesserCount = getCatchmindGuesserCount();
  const ratio = guesserCount > 0 ? correctCount / guesserCount : 0;
  let drawerScore = 0;
  if (ratio >= 0.7) {
    drawerScore = 3;
  } else if (ratio >= 0.3) {
    drawerScore = 2;
  } else if (correctCount > 0) {
    drawerScore = 1;
  }
  return { drawerScore, correctCount, guesserCount, ratio };
}

function normalizeCatchmindAnswer(value) {
  return cleanText(value).normalize("NFKC").toLocaleLowerCase("ko-KR");
}

function countCatchmindLetters(word) {
  return Array.from(String(word || "").replace(/\s/g, "")).length;
}

function getKoreanInitials(word) {
  const initials = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  return Array.from(String(word || "").replace(/\s/g, ""))
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        return initials[Math.floor((code - 0xac00) / 588)] || char;
      }
      return char;
    })
    .join("");
}

function getCatchmindRemainingSeconds(round) {
  if (!round?.roundEndsAt) {
    return getCatchmindSettings().roundDuration;
  }
  return Math.max(0, Math.ceil((Number(round.roundEndsAt) - (securePilot?.now() ?? Date.now())) / 1000));
}

function startCatchmindRoundTimer({ round, textSelector, fillSelector = "", hintSelector = "", alreadyCorrect = false, onEnd = null }) {
  clearTimer();
  const textEl = document.querySelector(textSelector);
  const fillEl = fillSelector ? document.querySelector(fillSelector) : null;
  const hintEl = hintSelector ? document.querySelector(hintSelector) : null;
  if (!round || !textEl) {
    return;
  }
  const totalMs = Math.max(1, Number(getCatchmindSettings().roundDuration || DEFAULT_CATCHMIND_ROUND_SECONDS)) * 1000;
  let didEnd = false;
  const tick = () => {
    const now = securePilot?.now() ?? Date.now();
    const remainingMs = Math.max(0, Number(round.roundEndsAt || now) - now);
    const seconds = Math.ceil(remainingMs / 1000);
    textEl.textContent = `${seconds}초`;
    if (fillEl) {
      fillEl.style.width = `${Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))}%`;
    }
    if (hintEl) {
      hintEl.innerHTML = renderCatchmindHint(securePilot ? getCurrentCatchmindRound() : round, alreadyCorrect);
    }
    if (remainingMs <= 0 && !didEnd) {
      didEnd = true;
      clearTimer();
      if (typeof onEnd === "function") {
        onEnd();
      }
    }
  };
  tick();
  state.timerId = window.setInterval(tick, 250);
}

function setupCatchmindAnswerHandlers() {
  const input = document.querySelector("#catchmindAnswerInput");
  const button = document.querySelector("#catchmindAnswerSubmitBtn");
  if (!input || !button) {
    return;
  }
  input.addEventListener("input", () => {
    state.catchmindAnswerDraft = input.value;
    state.catchmindWrongMessage = "";
    const feedback = document.querySelector("#catchmindAnswerFeedback");
    if (feedback) {
      feedback.textContent = "";
      feedback.hidden = true;
    }
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      submitCatchmindAnswer();
    }
  });
  button.addEventListener("click", submitCatchmindAnswer);
}

function setupCatchmindCanvas({ interactive = false } = {}) {
  const canvas = document.querySelector("#catchmindCanvas");
  if (!canvas) {
    return;
  }
  resizeCatchmindCanvas(canvas);
  drawCatchmindCanvas(canvas);
  canvas.dataset.catchmindRenderKey = getCatchmindStrokeRenderKey();

  if (!interactive) {
    return;
  }

  canvas.addEventListener("pointerdown", (event) => startCatchmindStroke(event, canvas));
  canvas.addEventListener("pointermove", (event) => moveCatchmindStroke(event, canvas));
  canvas.addEventListener("pointerup", (event) => finishCatchmindStroke(event, canvas));
  canvas.addEventListener("pointercancel", (event) => finishCatchmindStroke(event, canvas, { includeEventPoint: false }));
  canvas.addEventListener("pointerleave", (event) => {
    if (state.catchmindDrawing.active && !canvas.hasPointerCapture?.(event.pointerId)) {
      finishCatchmindStroke(event, canvas, { includeEventPoint: false });
    }
  });
}

function resizeCatchmindCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width || canvas.clientWidth || 720));
  const height = Math.max(240, Math.floor(rect.height || canvas.clientHeight || 420));
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawCatchmindCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const width = canvas.clientWidth || 720;
  const height = canvas.clientHeight || 420;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  getCatchmindStrokes().forEach((stroke) => drawCatchmindStroke(ctx, stroke, width, height));
}

function drawCatchmindStroke(ctx, stroke, width, height) {
  const points = normalizeCatchmindPoints(stroke.points);
  if (!points.length) {
    return;
  }
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color || "#111827";
  ctx.lineWidth = Number(stroke.size || 5);
  ctx.beginPath();
  ctx.moveTo(points[0].x * width, points[0].y * height);
  points.slice(1).forEach((point) => ctx.lineTo(point.x * width, point.y * height));
  if (points.length === 1) {
    ctx.lineTo(points[0].x * width + 0.1, points[0].y * height + 0.1);
  }
  ctx.stroke();
  ctx.restore();
}

function startCatchmindStroke(event, canvas) {
  if ((state.room?.status || "waiting") !== "playing" || !isCurrentCatchmindDrawer()) {
    return;
  }
  if (securePilot && (state.catchmindCanvasEditing || state.catchmindDrawing.active)) return;
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  const point = getCatchmindPointerPoint(event, canvas);
  if (!point) {
    return;
  }
  const strokeId = `stroke_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  state.catchmindDrawing = {
    active: true,
    strokeId,
    points: [point],
    color: state.catchmindColor,
    size: state.catchmindTool === "eraser" ? Math.max(16, state.catchmindSize * 3) : state.catchmindSize,
    tool: state.catchmindTool,
    pointerId: event.pointerId,
    roundId: getCurrentCatchmindRound()?.roundId,
    offset: 0,
    epoch: getCurrentCatchmindRoundData().epoch || 0,
    lastFlushAt: 0
  };
  flushCatchmindStroke();
}

function moveCatchmindStroke(event, canvas) {
  if (!state.catchmindDrawing.active) {
    return;
  }
  if (securePilot && event.pointerId !== state.catchmindDrawing.pointerId) return;
  event.preventDefault();
  const point = getCatchmindPointerPoint(event, canvas);
  if (!point) {
    return;
  }
  const points = state.catchmindDrawing.points;
  const previous = points[points.length - 1];
  if (previous && Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y) < 0.003) {
    return;
  }
  points.push(point);
  drawCatchmindLocalSegment(canvas, previous || point, point);
  const now = Date.now();
  if (now - state.catchmindDrawing.lastFlushAt >= CATCHMIND_DRAW_FLUSH_MS) {
    flushCatchmindStroke();
  }
}

function finishCatchmindStroke(event, canvas, { includeEventPoint = true } = {}) {
  if (!state.catchmindDrawing.active) {
    return;
  }
  if (securePilot && event.pointerId !== state.catchmindDrawing.pointerId) return;
  event.preventDefault();
  const point = includeEventPoint ? getCatchmindPointerPoint(event, canvas) : null;
  const points = state.catchmindDrawing.points;
  const previous = points[points.length - 1];
  if (point && (!previous || Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y) >= 0.003)) {
    points.push(point);
    drawCatchmindLocalSegment(canvas, previous || point, point);
  }
  flushCatchmindStroke();
  state.catchmindDrawing.active = false;
  if (canvas.hasPointerCapture?.(event.pointerId)) {
    canvas.releasePointerCapture?.(event.pointerId);
  }
}

function drawCatchmindLocalSegment(canvas, from, to) {
  const ctx = canvas.getContext("2d");
  const width = canvas.clientWidth || 720;
  const height = canvas.clientHeight || 420;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = state.catchmindDrawing.tool === "eraser" ? "#ffffff" : state.catchmindDrawing.color;
  ctx.lineWidth = state.catchmindDrawing.size;
  ctx.beginPath();
  ctx.moveTo(from.x * width, from.y * height);
  ctx.lineTo(to.x * width, to.y * height);
  ctx.stroke();
  ctx.restore();
}

function getCatchmindPointerPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = Number(event.clientX);
  const clientY = Number(event.clientY);
  if (!canvas.isConnected || rect.width < 1 || rect.height < 1 || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }
  return {
    x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
  };
}

function flushCatchmindStroke() {
  const round = getCurrentCatchmindRound();
  const drawing = state.catchmindDrawing;
  if (!round || !drawing.strokeId || !drawing.points.length) {
    return;
  }
  drawing.lastFlushAt = Date.now();
  if (securePilot) {
    if (drawing.roundId !== round.roundId || drawing.failed) return;
    const { roundId, strokeId, epoch, tool, color, size } = drawing;
    while (drawing.offset < drawing.points.length) {
      const offset = drawing.offset;
      const points = drawing.points.slice(offset, offset + 96);
      drawing.offset += points.length;
      queueCatchmindCanvasWrite(roundId, async () => {
        if (drawing.failed) return {};
        const result = await securePilot.send("drawCatchmind", { roundId, strokeId, epoch, offset, points, tool, color, size });
        if (result.error) drawing.failed = true;
        return result;
      });
    }
    return;
  }
  set(ref(db, `rooms/${state.roomCode}/catchmind/rounds/${round.roundId}/strokes/${drawing.strokeId}`), {
    strokeId: drawing.strokeId,
    createdBy: state.studentId,
    color: drawing.color,
    size: drawing.size,
    tool: drawing.tool,
    points: drawing.points,
    createdAt: Number(drawing.strokeId.split("_")[1] || Date.now()),
    updatedAt: Date.now()
  }).catch((error) => {
    finalRelease?.record("app-error");
    showToast("그림 동기화에 실패했습니다.", "error");
  });
}

function queueCatchmindCanvasWrite(roundId, operation) {
  const code = state.roomCode;
  state.catchmindDrawingWrites += 1;
  const isCurrent = () => state.roomCode === code && state.room?.status === "playing" && getCurrentCatchmindRound()?.roundId === roundId;
  // Keep chunks in pointer order even if acknowledgements take longer than the flush interval.
  state.catchmindDrawQueue = state.catchmindDrawQueue.then(async () => {
    if (!isCurrent()) return;
    const result = await operation();
    if (result?.error && isCurrent() && !["phase", "closed"].includes(result.error)) showToast(securePilotError(result.error), "error");
  }).catch(() => {
    if (isCurrent()) showToast(securePilotError("unavailable"), "error");
  }).finally(() => {
    state.catchmindDrawingWrites -= 1;
    if (isCurrent() && !state.catchmindDrawingWrites && !state.catchmindDrawing.active) {
      const canvas = document.querySelector("#catchmindCanvas");
      if (canvas) {
        delete canvas.dataset.catchmindRenderKey;
        refreshCatchmindCanvas(canvas);
      }
    }
  });
  return state.catchmindDrawQueue;
}

function setupCatchmindToolHandlers() {
  const sync = () => {
    document.querySelectorAll("[data-catchmind-color], [data-catchmind-tool], [data-catchmind-size]").forEach((button) => {
      const isSize = Boolean(button.dataset.catchmindSize);
      const selected = isSize ? Number(button.dataset.catchmindSize) === state.catchmindSize
        : button.dataset.catchmindTool ? state.catchmindTool === "eraser"
        : state.catchmindTool === "pen" && button.dataset.catchmindColor === state.catchmindColor;
      button.setAttribute("aria-pressed", String(selected));
      if (isSize) {
        button.classList.toggle("primary", selected);
        button.classList.toggle("ghost", !selected);
      } else button.classList.toggle("selected", selected);
    });
  };
  document.querySelectorAll("[data-catchmind-color]").forEach((button) => {
    button.addEventListener("click", () => {
      state.catchmindTool = "pen";
      state.catchmindColor = button.dataset.catchmindColor || "#111827";
      sync();
    });
  });
  document.querySelectorAll("[data-catchmind-size]").forEach((button) => {
    button.addEventListener("click", () => {
      state.catchmindSize = Number(button.dataset.catchmindSize || 5);
      sync();
    });
  });
  document.querySelector("[data-catchmind-tool='eraser']")?.addEventListener("click", () => {
    state.catchmindTool = "eraser";
    sync();
  });
  document.querySelector("#catchmindUndoBtn")?.addEventListener("click", undoCatchmindStroke);
  document.querySelector("#catchmindClearBtn")?.addEventListener("click", clearCatchmindCanvas);
  appEl.querySelector(":scope > .screen")?.addEventListener("keydown", (event) => {
    if (event.isComposing || event.repeat || event.altKey || event.target.closest("input, textarea, select, [contenteditable]")) return;
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoCatchmindStroke();
    } else if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "e") {
      event.preventDefault();
      state.catchmindTool = state.catchmindTool === "eraser" ? "pen" : "eraser";
      sync();
    }
  });
}

async function undoCatchmindStroke() {
  const round = getCurrentCatchmindRound();
  if (securePilot) return editSecureCatchmindCanvas(round, "undoCatchmind");
  const ownStrokes = getCatchmindStrokes()
    .filter((stroke) => stroke.createdBy === state.studentId)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  if (!round || !ownStrokes.length) {
    return;
  }
  await remove(ref(db, `rooms/${state.roomCode}/catchmind/rounds/${round.roundId}/strokes/${ownStrokes[0].strokeId}`));
}

async function clearCatchmindCanvas() {
  const round = getCurrentCatchmindRound();
  if (!round || !window.confirm("그림을 모두 지울까요?")) {
    return;
  }
  if (securePilot) return editSecureCatchmindCanvas(round, "clearCatchmind");
  await update(roomRef(state.roomCode), {
    [`catchmind/rounds/${round.roundId}/strokes`]: null,
    [`catchmind/rounds/${round.roundId}/clearVersion`]: Date.now()
  });
}

async function editSecureCatchmindCanvas(round, action) {
  if (!round || state.catchmindDrawing.active || state.catchmindCanvasEditing) return;
  state.catchmindCanvasEditing = true;
  try {
    await queueCatchmindCanvasWrite(round.roundId, () => {
      const stroke = action === "undoCatchmind" ? getCatchmindStrokes().at(-1) : null;
      if (action === "undoCatchmind" && !stroke) return;
      return securePilot.send(action, { roundId: round.roundId, epoch: getCurrentCatchmindRoundData().epoch || 0,
        ...(stroke ? { strokeId: stroke.strokeId } : {}) });
    });
  } finally {
    state.catchmindCanvasEditing = false;
  }
}

function getCatchmindStrokes() {
  const raw = getCurrentCatchmindRoundData().strokes || {};
  return Object.entries(raw)
    .map(([id, value]) => ({
      strokeId: value.strokeId || id,
      createdBy: value.createdBy || "",
      color: value.color || "#111827",
      size: Number(value.size || 5),
      tool: value.tool || "pen",
      points: normalizeCatchmindPoints(value.points),
      createdAt: Number(value.createdAt || 0),
      sequence: Number(value.sequence || 0),
      updatedAt: Number(value.updatedAt || 0)
    }))
    .filter((stroke) => stroke.points.length)
    .sort((a, b) => a.sequence - b.sequence || a.createdAt - b.createdAt || String(a.strokeId).localeCompare(String(b.strokeId)));
}

function normalizeCatchmindPoints(points) {
  const source = Array.isArray(points)
    ? points
    : Object.keys(points || {}).sort((a, b) => Number(a) - Number(b)).map((key) => points[key]);
  return source
    .map((point) => ({
      x: Math.max(0, Math.min(1, Number(point?.x || 0))),
      y: Math.max(0, Math.min(1, Number(point?.y || 0)))
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function getCatchmindStrokeRenderKey() {
  if (securePilot) return `${getCurrentCatchmindRound()?.roundId || "none"}:${getCurrentCatchmindRoundData().version || 0}`;
  const strokes = getCatchmindStrokes();
  const last = strokes[strokes.length - 1];
  const round = getCurrentCatchmindRound();
  const clearVersion = getCurrentCatchmindRoundData().clearVersion || 0;
  return `${round?.roundId || "none"}:${strokes.length}:${last?.strokeId || "none"}:${last?.updatedAt || 0}:${clearVersion}`;
}

// =========================
// 자리바꾸기 게임
// =========================

function getDefaultSeatGameSettings() {
  return {
    rows: DEFAULT_SEAT_ROWS,
    columns: DEFAULT_SEAT_COLUMNS,
    disabledSeats: {},
    cardEnabled: true,
    cardPhaseSeconds: DEFAULT_SEAT_CARD_PHASE_SECONDS
  };
}

function getInitialSeatGameStateForWrite(settings = getDefaultSeatGameSettings()) {
  return {
    settings: normalizeSeatGameSettings(settings)
  };
}

function normalizeSeatGameSettings(settings = {}) {
  const defaults = getDefaultSeatGameSettings();
  const rows = clampInt(settings.rows, 1, 10, defaults.rows);
  const columns = clampInt(settings.columns, 1, 10, defaults.columns);
  const total = rows * columns;
  const disabledSeats = Object.fromEntries(
    Object.keys(settings.disabledSeats || {})
      .filter((key) => settings.disabledSeats[key] === true)
      .map(Number)
      .filter((seatNumber) => Number.isInteger(seatNumber) && seatNumber >= 1 && seatNumber <= total)
      .map((seatNumber) => [seatNumber, true])
  );
  return {
    rows,
    columns,
    disabledSeats,
    cardEnabled: settings.cardEnabled !== false,
    cardPhaseSeconds: clampInt(
      settings.cardPhaseSeconds,
      MIN_SEAT_CARD_PHASE_SECONDS,
      MAX_SEAT_CARD_PHASE_SECONDS,
      defaults.cardPhaseSeconds
    )
  };
}

function normalizeSeatGameRecord(raw = {}) {
  const settings = normalizeSeatGameSettings(raw.settings || {});
  return {
    settings,
    gameId: String(raw.gameId || ""),
    selectionOrder: normalizeIndexedList(raw.selectionOrder),
    currentSelectionIndex: Math.max(0, Number(raw.currentSelectionIndex || 0)),
    assignments: { ...(raw.assignments || {}) },
    playerCards: { ...(raw.playerCards || {}) },
    protectedPlayerIds: { ...(raw.protectedPlayerIds || {}) },
    notifications: { ...(raw.notifications || {}) },
    cardActionHistory: { ...(raw.cardActionHistory || {}) },
    cardPhaseStartedAt: Number(raw.cardPhaseStartedAt || 0),
    cardPhaseEndsAt: Number(raw.cardPhaseEndsAt || 0),
    lastPublicEvent: raw.lastPublicEvent || null,
    finalRevealStartedAt: Number(raw.finalRevealStartedAt || 0),
    finalRevealOrder: normalizeIndexedList(raw.finalRevealOrder).map(Number).filter(Number.isFinite)
  };
}

function getSeatGameState() {
  return normalizeSeatGameRecord(state.room?.seatGame || {});
}

function getSeatGameSettings() {
  return getSeatGameState().settings;
}

function getSeatSettingsDraft() {
  if (!state.seatSettingsDraft) {
    state.seatSettingsDraft = normalizeSeatGameSettings(getSeatGameSettings());
  }
  return normalizeSeatGameSettings(state.seatSettingsDraft);
}

function getSeatKey(seatNumber) {
  return `seat_${Number(seatNumber)}`;
}

function getSeatNumberFromKey(seatKey) {
  return Number(String(seatKey || "").replace("seat_", ""));
}

function getSeatActiveNumbers(settings = getSeatGameSettings()) {
  const normalized = normalizeSeatGameSettings(settings);
  return Array.from({ length: normalized.rows * normalized.columns }, (_, index) => index + 1)
    .filter((seatNumber) => !normalized.disabledSeats[seatNumber]);
}

function getSeatForStudent(studentId, assignments = getSeatGameState().assignments) {
  const entry = Object.entries(assignments || {}).find(([, ownerId]) => ownerId === studentId);
  return entry ? getSeatNumberFromKey(entry[0]) : null;
}

function getSeatCurrentPlayerId(game = getSeatGameState()) {
  return game.selectionOrder[game.currentSelectionIndex] || "";
}

function getSeatCurrentPlayer(game = getSeatGameState()) {
  const currentId = getSeatCurrentPlayerId(game);
  return getStudents().find((student) => student.id === currentId) || null;
}

function getMySeatCard(game = getSeatGameState()) {
  return game.playerCards[state.studentId] || null;
}

function getSeatCardDefinition(type) {
  const definitions = {
    swap: {
      icon: "↔",
      name: "자리 교환",
      description: "선택된 두 자리의 주인을 서로 바꿉니다."
    },
    move: {
      icon: "→",
      name: "다시 선택",
      description: "내 현재 자리를 포기하고 남아 있는 자리 중 하나를 새롭게 선택합니다."
    },
    randomSwap: {
      icon: "?",
      name: "운명의 교환",
      description: "선택된 자리 두 곳의 주인을 무작위로 서로 바꿉니다."
    },
    protect: {
      icon: "◆",
      name: "자리 보호",
      description: "내 현재 자리를 게임 종료까지 카드 효과로 이동하지 않게 보호합니다."
    }
  };
  return definitions[type] || definitions.swap;
}

function getSeatCardEligibility(card, studentId = state.studentId, game = getSeatGameState()) {
  if (!card || card.used) {
    return { allowed: false, reason: "이미 사용한 카드입니다.", targetSeats: [] };
  }
  if ((state.room?.status || "waiting") !== "cardPhase") {
    return { allowed: false, reason: "카드 활용 시간에만 사용할 수 있습니다.", targetSeats: [] };
  }

  const protectedIds = game.protectedPlayerIds || {};
  const assignedSeats = getSeatActiveNumbers(game.settings)
    .filter((seatNumber) => Boolean(game.assignments[getSeatKey(seatNumber)]));
  const unprotectedAssignedSeats = assignedSeats.filter((seatNumber) => {
    const ownerId = game.assignments[getSeatKey(seatNumber)];
    return !protectedIds[ownerId];
  });
  const mySeat = getSeatForStudent(studentId, game.assignments);
  const emptySeats = getSeatActiveNumbers(game.settings)
    .filter((seatNumber) => !game.assignments[getSeatKey(seatNumber)]);

  if (card.type === "swap" || card.type === "randomSwap") {
    return unprotectedAssignedSeats.length >= 2
      ? { allowed: true, reason: "", targetSeats: unprotectedAssignedSeats }
      : { allowed: false, reason: "보호되지 않은 선택 완료 자리가 2개 이상 필요합니다.", targetSeats: [] };
  }
  if (card.type === "move") {
    if (!mySeat) {
      return { allowed: false, reason: "먼저 내 자리를 선택해야 사용할 수 있습니다.", targetSeats: [] };
    }
    if (protectedIds[studentId]) {
      return { allowed: false, reason: "보호된 자리는 이동할 수 없습니다.", targetSeats: [] };
    }
    return emptySeats.length
      ? { allowed: true, reason: "", targetSeats: emptySeats }
      : { allowed: false, reason: "현재 선택 가능한 빈자리가 없습니다.", targetSeats: [] };
  }
  if (card.type === "protect") {
    if (!mySeat) {
      return { allowed: false, reason: "먼저 내 자리를 선택해야 사용할 수 있습니다.", targetSeats: [] };
    }
    return protectedIds[studentId]
      ? { allowed: false, reason: "내 자리가 이미 보호되어 있습니다.", targetSeats: [] }
      : { allowed: true, reason: "", targetSeats: [mySeat] };
  }
  return { allowed: false, reason: "사용할 수 없는 카드입니다.", targetSeats: [] };
}

function syncSeatInteractionState(game, status) {
  const card = getMySeatCard(game);
  const key = `${game.gameId}:${status}:${game.cardPhaseStartedAt}:${Boolean(card?.used)}`;
  if (state.seatInteractionKey !== key) {
    state.seatInteractionKey = key;
    state.seatCardTargetMode = false;
    state.seatCardTargetSeats = [];
  }
}

function renderSeatStudentRoute() {
  const status = state.room?.status || "waiting";
  const game = getSeatGameState();
  syncSeatInteractionState(game, status);

  if (status === "waiting" || !game.gameId) {
    renderSeatStudentWaiting(true);
    return;
  }
  if (status === "seatSelection") {
    renderSeatStudentSelection(true);
    return;
  }
  if (status === "cardPhase") {
    renderSeatStudentCardPhase(true);
    return;
  }
  if (status === "finalReady") {
    renderSeatStudentFinalReady(true);
    return;
  }
  if (status === "finalReveal" || status === "finished") {
    renderSeatFinalResult(`student-seat-${status}`, false, true);
    return;
  }
  renderSeatStudentWaiting(true);
}

function renderSeatStudentWaiting(force = false) {
  setView("seat-student-waiting", `
    <section class="screen seat-mode">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill blue">자리바꾸기 게임</span>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>
      <section class="panel seat-panel result-panel">
        <h1>선생님이 게임을 준비하고 있습니다.</h1>
        <p class="lead">자리를 고르고 카드를 사용한 뒤, 마지막에 새로운 자리를 공개합니다.</p>
        <div class="stats">
          <div class="stat"><span class="muted">입장 학생</span><span class="num">${getStudents().length}</span></div>
          <div class="stat"><span class="muted">접속 학생</span><span class="num">${getStudents().filter((student) => student.connected).length}</span></div>
        </div>
      </section>
    </section>
  `, () => document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome), force);
}

function renderSeatStudentSelection(force = false) {
  const game = getSeatGameState();
  const orderIndex = game.selectionOrder.indexOf(state.studentId);
  const currentNumber = game.currentSelectionIndex + 1;
  const isMyTurn = getSeatCurrentPlayerId(game) === state.studentId;
  const mySeat = getSeatForStudent(state.studentId, game.assignments);
  const activeSeats = getSeatActiveNumbers(game.settings);
  const availableSeats = activeSeats.filter((seatNumber) => !game.assignments[getSeatKey(seatNumber)]);

  setView(`seat-student-selection-${game.gameId}-${game.currentSelectionIndex}`, `
    <section class="screen seat-mode">
      <div class="status-bar">
        <div>
          <p class="eyebrow">당신의 자리 선택 순서</p>
          <h1>${orderIndex >= 0 ? `${orderIndex + 1}번째` : "확인 중"}</h1>
        </div>
        <span class="pill ${isMyTurn ? "green" : "blue"}">${currentNumber}/${game.selectionOrder.length}번째 선택</span>
      </div>
      ${renderSeatPrivateNotice(game)}
      ${renderSeatPublicEvent(game.lastPublicEvent)}
      <section class="panel seat-panel result-panel">
        ${isMyTurn && !mySeat ? `
          <span class="pill green">지금 당신의 차례입니다!</span>
          <h1>원하는 자리를 선택하세요.</h1>
          <p class="lead">선택 가능한 자리 ${availableSeats.length}개 중 하나를 눌러 주세요.</p>
        ` : `
          <h1>${currentNumber}번째 자리 선택이 진행 중입니다.</h1>
          <p class="lead">누가 선택 중인지는 마지막까지 비밀입니다.</p>
        `}
      </section>
      ${renderSeatGrid({ game, interactive: isMyTurn && !mySeat })}
      ${renderSeatMySeatPanel(game)}
      ${game.settings.cardEnabled ? `<section class="panel seat-card-panel">${renderSeatStudentCard(game)}</section>` : ""}
    </section>
  `, () => setupSeatStudentSelectionHandlers(isMyTurn && !mySeat), force);
}

function renderSeatStudentCardPhase(force = false) {
  const game = getSeatGameState();
  const card = getMySeatCard(game);
  setView(`seat-student-card-${game.gameId}-${game.cardPhaseStartedAt}-${Boolean(card?.used)}-${state.seatCardTargetMode}-${state.seatCardTargetSeats.join("-")}`, `
    <section class="screen seat-mode">
      <div class="status-bar">
        <div>
          <p class="eyebrow">카드 활용 시간</p>
          <h1 id="seatStudentCardTimer">${game.settings.cardPhaseSeconds}초</h1>
        </div>
        <span class="pill gold">카드를 사용할 학생은 지금 사용하세요.</span>
      </div>
      <div class="timer-wrap">
        <div class="timer-track"><div id="seatStudentCardTimerFill" class="timer-fill"></div></div>
      </div>
      ${renderSeatPrivateNotice(game)}
      ${renderSeatPublicEvent(game.lastPublicEvent)}
      <div class="seat-student-layout">
        <div>
          ${renderSeatGrid({ game })}
          ${renderSeatMySeatPanel(game)}
        </div>
        <aside class="panel seat-card-panel">
          ${renderSeatStudentCard(game)}
        </aside>
      </div>
    </section>
  `, () => {
    setupSeatStudentCardHandlers();
    setupSeatCardPhaseTimer({
      textSelector: "#seatStudentCardTimer",
      fillSelector: "#seatStudentCardTimerFill",
      onEnd: () => endSeatCardPhase({ silent: true })
    });
  }, force);
}

function renderSeatStudentFinalReady(force = false) {
  const game = getSeatGameState();
  setView(`seat-student-final-ready-${game.gameId}`, `
    <section class="screen seat-mode">
      <section class="panel seat-panel result-panel">
        <span class="pill gold">자리 확정</span>
        <h1>모든 자리가 확정되었습니다.</h1>
        <p class="lead">선생님이 최종 자리 공개를 시작할 때까지 기다려 주세요.</p>
      </section>
      ${renderSeatGrid({ game })}
      ${renderSeatMySeatPanel(game)}
      ${renderSeatPrivateNotice(game)}
    </section>
  `, () => setupSeatNoticeDismissHandler(), force);
}

function renderSeatTeacherDashboard(force = true) {
  const status = state.room?.status || "waiting";
  const game = getSeatGameState();
  const settings = status === "waiting" ? getSeatSettingsDraft() : game.settings;
  const students = getStudents();
  const activeSeats = getSeatActiveNumbers(settings);
  const currentPlayer = getSeatCurrentPlayer(game);
  const assignmentCount = Object.keys(game.assignments || {}).length;

  if (status === "finalReveal") {
    renderSeatFinalResult("teacher-seat-final-reveal", true, force);
    return;
  }

  setView(`teacher-seat-${status}-${game.gameId}-${game.currentSelectionIndex}-${game.cardPhaseStartedAt}-${Object.keys(game.cardActionHistory).length}`, `
    <section class="screen seat-mode">
      <div class="status-bar">
        <div><p class="eyebrow">교사 화면</p><h1>자리바꾸기 게임</h1></div>
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
      </div>
      <div class="panel seat-panel">
        <div class="status-bar">
          <div><p class="muted small">학생들에게 알려 줄 방 코드</p><div class="room-code">${escapeHtml(state.roomCode)}</div></div>
          <div class="button-row">
            <span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span>
            <button class="btn ghost" id="copyRoomCodeBtn" type="button">방 코드 복사</button>
            <button class="btn dark" data-action="open-display" type="button">교실 화면 팝업</button>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><span class="muted">참가 학생</span><span class="num">${students.length}</span></div>
          <div class="stat"><span class="muted">사용 자리</span><span class="num">${activeSeats.length}</span></div>
          <div class="stat"><span class="muted">선택 완료</span><span class="num">${assignmentCount}</span></div>
        </div>
      </div>
      <div class="teacher-grid">
        <aside class="panel">
          ${renderTeacherModeControls()}
          ${status === "waiting" ? renderSeatTeacherSettings(settings, students.length) : renderSeatTeacherControls(status)}
          ${status !== "waiting" ? renderSeatTeacherSecrets(game) : ""}
          <div class="button-row">
            <button class="btn danger" data-action="reset" type="button">게임 초기화</button>
            <button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button>
          </div>
        </aside>
        <div class="screen">
          <section class="panel seat-panel">
            ${status === "waiting" ? `
              <h2>교실 자리 미리보기</h2>
              <p class="muted">사용하지 않는 자리는 눌러서 X로 바꿀 수 있습니다.</p>
              ${renderSeatGrid({ settings, setup: true })}
            ` : `
              <div class="status-bar">
                <div>
                  <p class="eyebrow">현재 진행</p>
                  <h2>${status === "seatSelection" ? `${game.currentSelectionIndex + 1}번째 자리 선택` : statusLabel(status)}</h2>
                </div>
                ${status === "seatSelection" && currentPlayer ? `<span class="pill green">교사용 확인: ${escapeHtml(currentPlayer.name)}</span>` : ""}
              </div>
              ${status === "cardPhase" ? `
                <div class="timer-wrap">
                  <div class="timer-top"><span>카드 활용 남은 시간</span><span id="seatTeacherCardTimer">${game.settings.cardPhaseSeconds}초</span></div>
                  <div class="timer-track"><div id="seatTeacherCardTimerFill" class="timer-fill"></div></div>
                </div>
              ` : ""}
              ${renderSeatPublicEvent(game.lastPublicEvent)}
              ${renderSeatGrid({ game })}
            `}
          </section>
          ${status !== "waiting" ? `
            <section class="panel">
              <h2>카드 사용 기록</h2>
              ${renderSeatCardHistory(game)}
            </section>
          ` : `
            <section class="panel"><h2>참여 학생</h2>${renderStudentList(students)}</section>
          `}
        </div>
      </div>
    </section>
  `, () => {
    setupSeatTeacherHandlers(status);
    if (status === "cardPhase") {
      setupSeatCardPhaseTimer({
        textSelector: "#seatTeacherCardTimer",
        fillSelector: "#seatTeacherCardTimerFill",
        onEnd: () => endSeatCardPhase({ silent: true })
      });
    }
  }, force);
}

function renderSeatTeacherSettings(settings, studentCount) {
  const activeCount = getSeatActiveNumbers(settings).length;
  const match = activeCount === studentCount && studentCount > 0;
  return `
    <section class="panel tight">
      <h2>교실 자리 설정</h2>
      <div class="grid-2">
        <div class="field"><label for="seatRowsInput">행</label><input id="seatRowsInput" type="number" min="1" max="10" value="${settings.rows}" /></div>
        <div class="field"><label for="seatColumnsInput">열</label><input id="seatColumnsInput" type="number" min="1" max="10" value="${settings.columns}" /></div>
      </div>
      <div class="field"><label for="uxSeatLayout">교실 배치 프리셋</label><select id="uxSeatLayout"><option value="">직접 설정</option><option value="3x4">3행 × 4열</option><option value="4x5">4행 × 5열</option><option value="5x6">5행 × 6열</option></select></div>
      <button class="btn ghost" data-action="ux-seat-layout" type="button">배치 미리보기</button>
      <label class="check-line"><input id="seatCardEnabledInput" type="checkbox" ${settings.cardEnabled ? "checked" : ""} /> 카드 사용</label>
      <div class="field">
        <label for="seatCardPhaseSecondsInput">카드 활용 시간(초)</label>
        <input id="seatCardPhaseSecondsInput" type="number" min="${MIN_SEAT_CARD_PHASE_SECONDS}" max="${MAX_SEAT_CARD_PHASE_SECONDS}" value="${settings.cardPhaseSeconds}" ${settings.cardEnabled ? "" : "disabled"} />
      </div>
      <div class="notice ${match ? "success" : "warn"}">
        참가 학생 ${studentCount}명 · 사용 가능한 자리 ${activeCount}개
        ${match ? "" : "<br />학생 수와 사용 가능한 자리 수가 같아야 시작할 수 있습니다."}
      </div>
      <div class="button-row">
        <button class="btn primary" data-action="seat-save-settings" type="button">설정 저장</button>
        <button class="btn success" data-action="seat-start" type="button" ${match ? "" : "disabled"}>게임 시작</button>
      </div>
    </section>
  `;
}

function renderSeatTeacherControls(status) {
  return `
    <section class="panel tight">
      <h2>진행 조작</h2>
      <div class="button-row">
        <button class="btn warn" data-action="seat-end-card" type="button" ${status === "cardPhase" ? "" : "disabled"}>카드 활용 턴 종료</button>
        <button class="btn success" data-action="seat-final-reveal" type="button" ${status === "finalReady" ? "" : "disabled"}>최종 자리 공개</button>
        <button class="btn success" data-action="seat-restart-same" type="button" ${status === "finished" ? "" : "disabled"}>같은 교실 구조로 다시 하기</button>
        <button class="btn ghost" data-action="seat-configure" type="button">설정 변경하기</button>
      </div>
    </section>
  `;
}

function renderSeatTeacherSecrets(game) {
  const students = new Map(getStudents().map((student) => [student.id, student]));
  return `
    <details class="teacher-secret-box">
      <summary>전체 선택 순서 확인</summary>
      <ol class="list">
        ${game.selectionOrder.map((studentId, index) => `<li class="list-row"><strong>${index + 1}. ${escapeHtml(students.get(studentId)?.name || "이름 없음")}</strong></li>`).join("")}
      </ol>
    </details>
    ${game.settings.cardEnabled ? `
      <details class="teacher-secret-box">
        <summary>학생별 카드 현황 확인</summary>
        <ul class="list">
          ${game.selectionOrder.map((studentId) => {
            const card = game.playerCards[studentId];
            const definition = getSeatCardDefinition(card?.type);
            return `<li class="list-row split"><strong>${escapeHtml(students.get(studentId)?.name || "이름 없음")}</strong><span class="pill ${card?.used ? "" : "green"}">${escapeHtml(definition.name)} · ${card?.used ? "사용 완료" : "보유 중"}</span></li>`;
          }).join("")}
        </ul>
      </details>
    ` : ""}
  `;
}

function renderSeatDisplay(force = false) {
  const status = state.room?.status || "waiting";
  const game = getSeatGameState();
  const viewName = `display-seat-${status}-${game.gameId}-${game.currentSelectionIndex}-${game.cardPhaseStartedAt}-${Object.keys(game.cardActionHistory).length}`;

  if (status === "finalReveal" || status === "finished") {
    renderDisplayShell(viewName, "최종 자리 공개", status === "finished" ? "새로운 자리를 확인하세요." : "자리 공개가 시작됩니다.", `
      ${status === "finalReveal" ? `<section class="panel seat-countdown-panel"><p class="eyebrow">자리 공개까지</p><h1 id="seatRevealCountdown">${SEAT_FINAL_COUNTDOWN_SECONDS}</h1></section>` : ""}
      ${renderSeatGrid({ game, reveal: true, revealAll: status === "finished" })}
    `, () => {
      if (status === "finalReveal") {
        setupSeatFinalRevealAnimation();
      }
    }, force);
    return;
  }

  let title = "자리바꾸기 게임";
  let subtitle = "자리를 고르고, 카드를 사용하고, 마지막까지 내 자리를 지켜라!";
  let body = `
    <section class="panel seat-panel result-panel">
      <h1>게임을 준비 중입니다.</h1>
      <div class="stats"><div class="stat"><span class="muted">입장 학생</span><span class="num">${state.room.pilotStudentCount ?? getStudents().length}</span></div></div>
    </section>
  `;
  let afterRender = null;

  if (status === "seatSelection") {
    title = `${game.currentSelectionIndex + 1}번째 자리 선택 진행 중`;
    subtitle = "선택 중인 학생의 이름은 비공개입니다.";
    body = `${renderSeatPublicEvent(game.lastPublicEvent)}${renderSeatGrid({ game })}`;
  } else if (status === "cardPhase") {
    title = "카드 활용 시간";
    subtitle = "카드를 사용할 학생은 지금 사용하세요.";
    body = `
      <section class="panel">
        <div class="timer-top"><span>남은 시간</span><strong id="seatDisplayCardTimer">${game.settings.cardPhaseSeconds}초</strong></div>
        <div class="timer-track"><div id="seatDisplayCardTimerFill" class="timer-fill"></div></div>
      </section>
      ${renderSeatPublicEvent(game.lastPublicEvent)}
      ${renderSeatGrid({ game })}
    `;
    afterRender = () => setupSeatCardPhaseTimer({
      textSelector: "#seatDisplayCardTimer",
      fillSelector: "#seatDisplayCardTimerFill",
      onEnd: () => endSeatCardPhase({ silent: true })
    });
  } else if (status === "finalReady") {
    title = "모든 자리가 확정되었습니다.";
    subtitle = "선생님이 최종 자리 공개를 준비하고 있습니다.";
    body = renderSeatGrid({ game });
  }
  renderDisplayShell(viewName, title, subtitle, body, afterRender, force);
}

function renderSeatFinalResult(viewName, showTeacherControls, force = false) {
  const game = getSeatGameState();
  const status = state.room?.status || "finished";
  const revealing = status === "finalReveal";
  const mySeat = getSeatForStudent(state.studentId, game.assignments);
  setView(viewName, `
    <section class="screen seat-mode">
      <div class="status-bar">
        <div><p class="eyebrow">${revealing ? "최종 공개" : "최종 자리"}</p><h1>${revealing ? "자리 공개가 시작됩니다." : "새로운 자리 배치"}</h1></div>
        ${showTeacherControls && !revealing ? `
          <div class="button-row">
            <button class="btn success" data-action="seat-restart-same" type="button">같은 교실 구조로 다시 하기</button>
            <button class="btn ghost" data-action="seat-configure" type="button">설정 변경하기</button>
            <button class="btn dark" id="backHomeBtn" type="button">플레이그라운드로 돌아가기</button>
          </div>
        ` : ""}
      </div>
      ${revealing ? `<section class="panel seat-countdown-panel"><p class="eyebrow">자리 공개까지</p><h1 id="seatRevealCountdown">${SEAT_FINAL_COUNTDOWN_SECONDS}</h1></section>` : ""}
      ${!showTeacherControls && mySeat ? `<section class="panel seat-my-final"><p class="eyebrow">내 최종 자리</p><h1>${mySeat}번</h1></section>` : ""}
      ${renderSeatGrid({ game, reveal: true, revealAll: !revealing, highlightStudentId: showTeacherControls ? "" : state.studentId })}
      ${showTeacherControls && !revealing ? `<section class="panel"><h2>카드 사용 기록</h2>${renderSeatCardHistory(game)}</section>` : ""}
    </section>
  `, () => {
    document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleTeacherAction(button.dataset.action)));
    document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome);
    if (revealing) {
      setupSeatFinalRevealAnimation();
    }
  }, force);
}

function renderSeatGrid({ game = null, settings = null, setup = false, interactive = false, targetSeats = [], reveal = false, revealAll = false, highlightStudentId = "" } = {}) {
  const resolvedGame = game || getSeatGameState();
  const resolvedSettings = normalizeSeatGameSettings(settings || resolvedGame.settings);
  const total = resolvedSettings.rows * resolvedSettings.columns;
  const targetSet = new Set(targetSeats.map(Number));
  const selectedTargetSet = new Set(state.seatCardTargetSeats.map(Number));
  const revealOrder = resolvedGame.finalRevealOrder.length ? resolvedGame.finalRevealOrder : getSeatActiveNumbers(resolvedSettings);
  return `
    <section class="seat-board-wrap">
      <div class="classroom-board">칠판</div>
      <div class="seat-grid" style="--seat-columns:${resolvedSettings.columns}">
        ${Array.from({ length: total }, (_, index) => index + 1).map((seatNumber) => {
          const disabled = Boolean(resolvedSettings.disabledSeats[seatNumber]);
          if (setup) {
            return `<button class="seat-tile setup ${disabled ? "disabled-seat" : ""}" data-seat-toggle-disabled="${seatNumber}" type="button"><strong>${disabled ? "X" : seatNumber}</strong><span>${disabled ? "사용 안 함" : "사용"}</span></button>`;
          }
          if (disabled) {
            return `<div class="seat-tile disabled-seat"><strong>X</strong><span>사용 안 함</span></div>`;
          }
          const seatKey = getSeatKey(seatNumber);
          const ownerId = resolvedGame.assignments[seatKey] || "";
          const assigned = Boolean(ownerId);
          const protectedSeat = Boolean(ownerId && resolvedGame.protectedPlayerIds[ownerId]);
          const canClick = interactive ? !assigned : targetSet.has(seatNumber);
          const isSelectedTarget = selectedTargetSet.has(seatNumber);
          const revealIndex = revealOrder.indexOf(seatNumber);
          const revealedClass = revealAll ? "revealed" : "reveal-pending";
          const ownClass = highlightStudentId && ownerId === highlightStudentId && (!reveal || revealAll) ? "my-final-seat" : "";
          const dataAttribute = interactive ? `data-seat-select="${seatNumber}"` : targetSet.has(seatNumber) ? `data-seat-card-target="${seatNumber}"` : "";
          return `<button class="seat-tile ${assigned ? "assigned" : "available"} ${protectedSeat ? "protected" : ""} ${isSelectedTarget ? "selected-target" : ""} ${reveal ? revealedClass : ""} ${ownClass}" ${dataAttribute} ${canClick ? "" : "disabled"} type="button" ${reveal ? `data-seat-number="${seatNumber}" data-seat-reveal-index="${Math.max(0, revealIndex)}"` : ""} ${targetSet.has(seatNumber) ? `aria-pressed="${isSelectedTarget}"` : ""}>
            <span class="seat-number">${seatNumber}번</span>
            ${reveal ? `<strong class="seat-owner">${revealAll ? renderSeatRevealedOwner(ownerId) : ""}</strong>` : `<strong>${isSelectedTarget ? "대상 선택됨" : assigned ? (protectedSeat ? "보호 · 선택 완료" : "선택 완료") : ownClass ? "내 자리" : "선택 가능"}</strong>`}
          </button>`;
        }).join("")}
      </div>
    </section>
  `;
}

function renderSeatRevealedOwner(ownerId) {
  const owner = getStudents().find((student) => student.id === ownerId);
  return owner ? renderPlaygroundName(owner) : "-";
}

function renderSeatMySeatPanel(game) {
  const mySeat = getSeatForStudent(state.studentId, game.assignments);
  const protectedSeat = Boolean(game.protectedPlayerIds[state.studentId]);
  return `
    <section class="panel seat-my-seat">
      <p class="eyebrow">내 현재 자리</p>
      <h1>${mySeat ? `${mySeat}번` : "아직 선택 전"}</h1>
      ${protectedSeat ? `<span class="pill green">자리 보호 중</span>` : ""}
    </section>
  `;
}

function renderSeatPrivateNotice(game) {
  const notice = game.notifications[state.studentId];
  if (!notice) {
    return "";
  }
  const storageKey = `seat_notice_${state.roomCode}_${game.gameId}_${state.studentId}`;
  if (localStorage.getItem(storageKey) === notice.id) {
    return "";
  }
  return `
    <section class="notice warn seat-private-notice" data-seat-notice-id="${escapeAttr(notice.id)}">
      <strong>내 자리가 변경되었습니다!</strong>
      <p>기존 자리: ${Number(notice.oldSeat)}번 · 현재 자리: ${Number(notice.newSeat)}번</p>
      <button class="btn ghost" id="seatDismissNoticeBtn" type="button">확인</button>
    </section>
  `;
}

function renderSeatPublicEvent(event) {
  if (!event?.message) {
    return "";
  }
  return `<section class="notice info seat-public-event"><strong>${escapeHtml(event.title || "자리 소식")}</strong><p>${escapeHtml(event.message)}</p></section>`;
}

function renderSeatStudentCard(game) {
  if (!game.settings.cardEnabled) {
    return `<h2>카드 없는 게임</h2><p class="muted">이번 게임은 자리 선택만 진행합니다.</p>`;
  }
  const card = getMySeatCard(game);
  if (!card) {
    return `<h2>내 카드</h2><div class="empty">카드 정보를 확인하고 있습니다.</div>`;
  }
  const definition = getSeatCardDefinition(card.type);
  const eligibility = getSeatCardEligibility(card, state.studentId, game);
  return `
    <p class="eyebrow">내 카드</p>
    <div class="seat-card-icon">${["swap", "move", "randomSwap", "protect"].includes(card.type)
      ? renderArcadeArt(`games/seat/cards/${card.type}`, [200, 316], "arcade-seat-art", definition.icon)
      : escapeHtml(definition.icon)}</div>
    <h2>${escapeHtml(definition.name)}</h2>
    <p>${escapeHtml(definition.description)}</p>
    <span class="pill ${card.used ? "" : "green"}">${card.used ? "사용 완료" : "사용 가능"}</span>
    ${!card.used && !eligibility.allowed ? `<div class="notice warn">${escapeHtml(eligibility.reason)}</div>` : ""}
    ${!card.used && eligibility.allowed && !state.seatCardTargetMode ? `<button class="btn primary full" id="seatUseCardBtn" type="button">카드 사용하기</button>` : ""}
    ${!card.used && eligibility.allowed && state.seatCardTargetMode ? renderSeatCardTargetPicker(card, eligibility, game) : ""}
  `;
}

function renderSeatCardTargetPicker(card, eligibility, game) {
  const targetCount = card.type === "swap" ? 2 : card.type === "move" ? 1 : 0;
  if (!targetCount) {
    return `<div class="button-row"><button class="btn ghost" id="seatCancelCardBtn" type="button">취소</button><button class="btn success" id="seatConfirmCardBtn" type="button">카드 사용 확정</button></div>`;
  }
  return `
    <div class="notice info">${card.type === "swap" ? "교환할 자리 두 곳을 선택하세요." : "새롭게 이동할 빈자리를 선택하세요."}</div>
    ${renderSeatGrid({ game, targetSeats: eligibility.targetSeats })}
    <div class="button-row">
      <button class="btn ghost" id="seatCancelCardBtn" type="button">취소</button>
      <button class="btn success" id="seatConfirmCardBtn" type="button" ${state.seatCardTargetSeats.length === targetCount ? "" : "disabled"}>카드 사용 확정</button>
    </div>
  `;
}

function renderSeatCardHistory(game) {
  const history = Object.values(game.cardActionHistory || {}).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  if (!history.length) {
    return `<div class="empty">아직 사용된 카드가 없습니다.</div>`;
  }
  return `<ol class="list">${history.map((action) => `<li class="list-row"><div><strong>${escapeHtml(getSeatCardDefinition(action.type).name)}</strong><p class="muted small">${escapeHtml(action.message || "카드 효과가 적용되었습니다.")}</p></div></li>`).join("")}</ol>`;
}

function setupSeatTeacherHandlers(status) {
  document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome);
  document.querySelector("#copyRoomCodeBtn")?.addEventListener("click", copyRoomCode);
  document.querySelectorAll("[data-switch-mode]").forEach((button) => {
    button.addEventListener("click", () => switchRoomMode(button.dataset.switchMode));
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleTeacherAction(button.dataset.action));
  });
  if (status !== "waiting") {
    return;
  }
  ["#seatRowsInput", "#seatColumnsInput", "#seatCardEnabledInput", "#seatCardPhaseSecondsInput"].forEach((selector) => {
    document.querySelector(selector)?.addEventListener("change", () => {
      state.seatSettingsDraft = readSeatSettingsFromForm();
      renderSeatTeacherDashboard(true);
    });
  });
  document.querySelectorAll("[data-seat-toggle-disabled]").forEach((button) => {
    button.addEventListener("click", () => toggleSeatSetupDisabled(Number(button.dataset.seatToggleDisabled)));
  });
}

function readSeatSettingsFromForm() {
  const current = getSeatSettingsDraft();
  return normalizeSeatGameSettings({
    rows: document.querySelector("#seatRowsInput")?.value ?? current.rows,
    columns: document.querySelector("#seatColumnsInput")?.value ?? current.columns,
    disabledSeats: current.disabledSeats,
    cardEnabled: document.querySelector("#seatCardEnabledInput")?.checked ?? current.cardEnabled,
    cardPhaseSeconds: document.querySelector("#seatCardPhaseSecondsInput")?.value ?? current.cardPhaseSeconds
  });
}

function toggleSeatSetupDisabled(seatNumber) {
  const draft = readSeatSettingsFromForm();
  const disabledSeats = { ...draft.disabledSeats };
  if (disabledSeats[seatNumber]) {
    delete disabledSeats[seatNumber];
  } else {
    disabledSeats[seatNumber] = true;
  }
  state.seatSettingsDraft = normalizeSeatGameSettings({ ...draft, disabledSeats });
  renderSeatTeacherDashboard(true);
}

async function saveSeatGameSettings() {
  if ((state.room?.status || "waiting") !== "waiting") {
    showToast("게임 시작 전 대기 상태에서만 설정을 바꿀 수 있습니다.", "error");
    return;
  }
  const settings = readSeatSettingsFromForm();
  state.seatSettingsDraft = settings;
  if (securePilot) return securePilotHostCommand("seatSettings", settings);
  try {
    await set(ref(db, `rooms/${state.roomCode}/seatGame/settings`), settings);
    showToast("교실 자리 설정을 저장했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("자리 설정을 저장하지 못했습니다.", "error");
  }
}

function buildSeatPlayerCards(studentIds) {
  const types = ["swap", "move", "randomSwap", "protect"];
  const deck = shuffleArray(studentIds.map((_, index) => types[index % types.length]));
  const assignedAt = Date.now();
  return Object.fromEntries(studentIds.map((studentId, index) => [studentId, {
    type: deck[index],
    used: false,
    assignedAt
  }]));
}

async function startSeatGame({ reuseSettings = false } = {}) {
  const students = getStudents();
  const settings = reuseSettings ? getSeatGameSettings() : readSeatSettingsFromForm();
  const activeSeats = getSeatActiveNumbers(settings);
  if (!students.length) {
    showToast("게임에 참여할 학생이 없습니다.", "error");
    return;
  }
  if (activeSeats.length !== students.length) {
    showToast(`참가 학생은 ${students.length}명이지만 사용 가능한 자리는 ${activeSeats.length}개입니다.`, "error");
    return;
  }
  if (securePilot) {
    if (securePilot.isController()) openDisplayWindow({ silent: true });
    return securePilotHostCommand("startSeat", reuseSettings ? { reuse: true } : settings);
  }

  const selectionOrder = shuffleArray(students.map((student) => student.id));
  const gameId = `seat_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const seatGame = {
    settings,
    gameId,
    selectionOrder,
    currentSelectionIndex: 0,
    assignments: {},
    playerCards: settings.cardEnabled ? buildSeatPlayerCards(selectionOrder) : {},
    protectedPlayerIds: {},
    notifications: {},
    cardActionHistory: {},
    cardPhaseStartedAt: 0,
    cardPhaseEndsAt: 0,
    lastPublicEvent: {
      id: `start_${Date.now()}`,
      title: "자리 선택 시작",
      message: "첫 번째 자리 선택이 진행 중입니다.",
      createdAt: Date.now()
    },
    finalRevealStartedAt: 0,
    finalRevealOrder: []
  };

  openDisplayWindow();
  state.seatSettingsDraft = settings;
  state.seatInteractionKey = "";
  try {
    await update(roomRef(state.roomCode), {
      status: "seatSelection",
      finishedAt: null,
      seatGame
    });
    showToast("자리바꾸기 게임을 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("자리바꾸기 게임을 시작하지 못했습니다.", "error");
  }
}

async function configureSeatGame() {
  const ok = window.confirm("현재 자리 결과와 카드 사용 기록을 지우고 설정 화면으로 돌아갈까요?");
  if (!ok) {
    return;
  }
  const settings = getSeatGameSettings();
  state.seatSettingsDraft = settings;
  state.seatInteractionKey = "";
  if (securePilot) return securePilotHostCommand("resetSeat", { confirmed: true });
  try {
    await update(roomRef(state.roomCode), {
      status: "waiting",
      finishedAt: null,
      seatGame: getInitialSeatGameStateForWrite(settings)
    });
    showToast("자리바꾸기 설정 화면으로 돌아왔습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("설정 화면으로 돌아가지 못했습니다.", "error");
  }
}

function setupSeatStudentSelectionHandlers(canSelect) {
  setupSeatNoticeDismissHandler();
  if (!canSelect) {
    return;
  }
  document.querySelectorAll("[data-seat-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const seatNumber = Number(button.dataset.seatSelect);
      showSeatConfirmModal({
        title: `${seatNumber}번 자리를 선택할까요?`,
        detail: "확정한 뒤에는 일반적인 방법으로 변경할 수 없습니다.",
        cancelLabel: "다시 고르기",
        confirmLabel: "자리 선택 확정",
        onConfirm: () => confirmSeatSelection(seatNumber)
      });
    });
  });
}

async function confirmSeatSelection(seatNumber) {
  if (securePilot) {
    const result = await securePilot.send("chooseSeat", { number: seatNumber });
    closeSeatConfirmModal();
    return showToast(result.error ? securePilotError(result.error) : `${seatNumber}번 자리를 선택했습니다.`, result.error ? "error" : "success");
  }
  let failureReason = "자리를 선택하지 못했습니다. 현재 자리 상태를 다시 확인해 주세요.";
  const now = Date.now();
  try {
    const result = await runTransaction(roomRef(state.roomCode), (room) => {
      if (!room || room.mode !== "seat" || room.status !== "seatSelection") {
        failureReason = "현재는 자리 선택 시간이 아닙니다.";
        return;
      }
      const game = normalizeSeatGameRecord(room.seatGame || {});
      const currentPlayerId = getSeatCurrentPlayerId(game);
      if (currentPlayerId !== state.studentId) {
        failureReason = "현재 내 차례가 아닙니다.";
        return;
      }
      if (getSeatForStudent(state.studentId, game.assignments)) {
        failureReason = "이미 자리를 선택했습니다.";
        return;
      }
      const activeSeats = getSeatActiveNumbers(game.settings);
      const seatKey = getSeatKey(seatNumber);
      if (!activeSeats.includes(seatNumber) || game.assignments[seatKey]) {
        failureReason = "방금 다른 학생이 선택한 자리입니다. 다른 자리를 골라 주세요.";
        return;
      }
      if (Object.keys(game.assignments).length !== game.currentSelectionIndex || !validateSeatAssignments(game)) {
        failureReason = "자리 데이터가 갱신 중입니다. 잠시 후 다시 시도해 주세요.";
        return;
      }

      game.assignments[seatKey] = state.studentId;
      game.lastPublicEvent = {
        id: `seat_selected_${now}_${seatNumber}`,
        title: "자리 선택 완료",
        message: `${seatNumber}번 자리가 선택되었습니다.`,
        seatNumbers: [seatNumber],
        createdAt: now
      };
      if (!validateSeatAssignments(game)) {
        failureReason = "자리 배정 검증에 실패했습니다.";
        return;
      }

      const isLast = game.currentSelectionIndex >= game.selectionOrder.length - 1;
      if (game.settings.cardEnabled) {
        room.status = "cardPhase";
        game.cardPhaseStartedAt = now;
        game.cardPhaseEndsAt = now + game.settings.cardPhaseSeconds * 1000;
      } else if (isLast) {
        room.status = "finalReady";
      } else {
        game.currentSelectionIndex += 1;
        room.status = "seatSelection";
      }
      room.seatGame = game;
      return room;
    });
    closeSeatConfirmModal();
    if (!result.committed) {
      showToast(failureReason, "error");
      return;
    }
    showToast(`${seatNumber}번 자리를 선택했습니다.`, "success");
  } catch (error) {
    finalRelease?.record("app-error");
    closeSeatConfirmModal();
    showToast("자리 선택 중 오류가 발생했습니다.", "error");
  }
}

function setupSeatStudentCardHandlers() {
  setupSeatNoticeDismissHandler();
  document.querySelector("#seatUseCardBtn")?.addEventListener("click", () => {
    state.seatCardTargetMode = true;
    state.seatCardTargetSeats = [];
    renderSeatStudentCardPhase(true);
  });
  document.querySelector("#seatCancelCardBtn")?.addEventListener("click", () => {
    state.seatCardTargetMode = false;
    state.seatCardTargetSeats = [];
    renderSeatStudentCardPhase(true);
  });
  document.querySelectorAll("[data-seat-card-target]").forEach((button) => {
    button.addEventListener("click", () => toggleSeatCardTarget(Number(button.dataset.seatCardTarget)));
  });
  document.querySelector("#seatConfirmCardBtn")?.addEventListener("click", confirmSeatCardUse);
}

function toggleSeatCardTarget(seatNumber) {
  const game = getSeatGameState();
  const card = getMySeatCard(game);
  const maxTargets = card?.type === "swap" ? 2 : 1;
  const selected = new Set(state.seatCardTargetSeats.map(Number));
  if (selected.has(seatNumber)) {
    selected.delete(seatNumber);
  } else {
    if (selected.size >= maxTargets) {
      selected.clear();
    }
    selected.add(seatNumber);
  }
  state.seatCardTargetSeats = Array.from(selected);
  renderSeatStudentCardPhase(true);
}

function confirmSeatCardUse() {
  const game = getSeatGameState();
  const card = getMySeatCard(game);
  if (!card || card.used) {
    showToast("사용할 수 있는 카드가 없습니다.", "error");
    return;
  }
  const definition = getSeatCardDefinition(card.type);
  let detail = definition.description;
  if (card.type === "swap") {
    detail = `${state.seatCardTargetSeats[0]}번 자리와 ${state.seatCardTargetSeats[1]}번 자리의 주인을 서로 바꿉니다.`;
  } else if (card.type === "move") {
    detail = `내 현재 자리에서 ${state.seatCardTargetSeats[0]}번 자리로 이동합니다.`;
  } else if (card.type === "randomSwap") {
    detail = "시스템이 보호되지 않은 자리 두 곳을 무작위로 골라 서로 바꿉니다.";
  } else if (card.type === "protect") {
    detail = "내 현재 자리를 게임 종료까지 카드 효과로부터 보호합니다.";
  }
  showSeatConfirmModal({
    title: `${definition.name} 카드를 사용할까요?`,
    detail,
    confirmLabel: "카드 사용 확정",
    onConfirm: applySeatCard
  });
}

async function applySeatCard() {
  const currentGame = getSeatGameState();
  const currentCard = getMySeatCard(currentGame);
  if (!currentCard) {
    closeSeatConfirmModal();
    return;
  }
  const requestedTargets = state.seatCardTargetSeats.map(Number);
  if (securePilot) {
    const result = await securePilot.send("useSeatCard", { numbers: requestedTargets });
    closeSeatConfirmModal();
    if (!result.error) {
      state.seatCardTargetMode = false;
      state.seatCardTargetSeats = [];
    }
    return showToast(result.error ? securePilotError(result.error) : "카드를 사용했습니다.", result.error ? "error" : "success");
  }
  if (currentCard.type === "randomSwap") {
    const eligible = getSeatCardEligibility(currentCard, state.studentId, currentGame).targetSeats;
    requestedTargets.splice(0, requestedTargets.length, ...shuffleArray(eligible).slice(0, 2));
  }

  const actionId = `card_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const createdAt = Date.now();
  let failureReason = "카드를 사용하지 못했습니다. 현재 자리 상태를 다시 확인해 주세요.";
  try {
    const result = await runTransaction(roomRef(state.roomCode), (room) => {
      if (!room || room.mode !== "seat" || room.status !== "cardPhase") {
        failureReason = "현재는 카드 활용 시간이 아닙니다.";
        return;
      }
      const game = normalizeSeatGameRecord(room.seatGame || {});
      const card = { ...(game.playerCards[state.studentId] || {}) };
      if (!card.type || card.used) {
        failureReason = "이미 사용했거나 존재하지 않는 카드입니다.";
        return;
      }
      if (!game.selectionOrder.includes(state.studentId) || !validateSeatAssignments(game)) {
        failureReason = "참가자 또는 자리 정보가 올바르지 않습니다.";
        return;
      }

      const activeSeats = new Set(getSeatActiveNumbers(game.settings));
      const assignments = { ...game.assignments };
      const protectedIds = { ...game.protectedPlayerIds };
      const notifications = { ...game.notifications };
      let publicMessage = "카드 효과가 적용되었습니다.";

      const moveNotice = (studentId, oldSeat, newSeat) => {
        notifications[studentId] = {
          id: `${actionId}_${studentId}`,
          oldSeat,
          newSeat,
          createdAt
        };
      };

      if (card.type === "swap" || card.type === "randomSwap") {
        const [seatA, seatB] = requestedTargets;
        const ownerA = assignments[getSeatKey(seatA)];
        const ownerB = assignments[getSeatKey(seatB)];
        if (!seatA || !seatB || seatA === seatB || !activeSeats.has(seatA) || !activeSeats.has(seatB) || !ownerA || !ownerB) {
          failureReason = "교환할 수 있는 선택 완료 자리 두 곳이 필요합니다.";
          return;
        }
        if (protectedIds[ownerA] || protectedIds[ownerB]) {
          failureReason = "보호된 자리는 교환할 수 없습니다.";
          return;
        }
        assignments[getSeatKey(seatA)] = ownerB;
        assignments[getSeatKey(seatB)] = ownerA;
        moveNotice(ownerA, seatA, seatB);
        moveNotice(ownerB, seatB, seatA);
        publicMessage = `${seatA}번 자리와 ${seatB}번 자리의 주인이 서로 바뀌었습니다.`;
      } else if (card.type === "move") {
        const newSeat = requestedTargets[0];
        const oldSeat = getSeatForStudent(state.studentId, assignments);
        if (!oldSeat || !newSeat || !activeSeats.has(newSeat) || assignments[getSeatKey(newSeat)]) {
          failureReason = "이동할 수 있는 빈자리를 다시 선택해 주세요.";
          return;
        }
        if (protectedIds[state.studentId]) {
          failureReason = "보호된 내 자리는 이동할 수 없습니다.";
          return;
        }
        delete assignments[getSeatKey(oldSeat)];
        assignments[getSeatKey(newSeat)] = state.studentId;
        moveNotice(state.studentId, oldSeat, newSeat);
        publicMessage = `${oldSeat}번 자리가 다시 선택 가능해졌고 ${newSeat}번 자리가 선택되었습니다.`;
      } else if (card.type === "protect") {
        const mySeat = getSeatForStudent(state.studentId, assignments);
        if (!mySeat || protectedIds[state.studentId]) {
          failureReason = "내 자리를 선택한 뒤 한 번만 보호할 수 있습니다.";
          return;
        }
        protectedIds[state.studentId] = true;
        publicMessage = `${mySeat}번 자리가 보호되었습니다.`;
      } else {
        failureReason = "알 수 없는 카드입니다.";
        return;
      }

      game.assignments = assignments;
      game.protectedPlayerIds = protectedIds;
      game.notifications = notifications;
      game.playerCards[state.studentId] = {
        ...card,
        used: true,
        usedAt: createdAt
      };
      game.cardActionHistory[actionId] = {
        id: actionId,
        type: card.type,
        seatNumbers: requestedTargets,
        message: publicMessage,
        createdAt
      };
      game.lastPublicEvent = {
        id: actionId,
        title: "카드 발동!",
        message: publicMessage,
        seatNumbers: requestedTargets,
        createdAt
      };
      if (!validateSeatAssignments(game)) {
        failureReason = "카드 적용 후 자리 배정 검증에 실패했습니다.";
        return;
      }
      room.seatGame = game;
      return room;
    });

    closeSeatConfirmModal();
    if (!result.committed) {
      showToast(failureReason, "error");
      return;
    }
    state.seatCardTargetMode = false;
    state.seatCardTargetSeats = [];
    showToast("카드를 사용했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    closeSeatConfirmModal();
    showToast("카드 사용 중 오류가 발생했습니다.", "error");
  }
}

function validateSeatAssignments(game, requireComplete = false) {
  const activeSeats = new Set(getSeatActiveNumbers(game.settings));
  const participants = new Set(game.selectionOrder);
  const owners = new Set();
  const entries = Object.entries(game.assignments || {});
  for (const [seatKey, ownerId] of entries) {
    const seatNumber = getSeatNumberFromKey(seatKey);
    if (!activeSeats.has(seatNumber) || !participants.has(ownerId) || owners.has(ownerId)) {
      return false;
    }
    owners.add(ownerId);
  }
  if (requireComplete) {
    return entries.length === participants.size && entries.length === activeSeats.size;
  }
  return entries.length <= participants.size;
}

async function endSeatCardPhase({ silent = false } = {}) {
  if (securePilot) return silent ? securePilot.send("advanceSeatTimer") : securePilotHostCommand("endSeatCards");
  let failureReason = "카드 활용 턴을 종료하지 못했습니다.";
  try {
    const result = await runTransaction(roomRef(state.roomCode), (room) => {
      if (!room || room.mode !== "seat" || room.status !== "cardPhase") {
        failureReason = "이미 카드 활용 턴이 종료되었습니다.";
        return;
      }
      const game = normalizeSeatGameRecord(room.seatGame || {});
      if (!validateSeatAssignments(game) || Object.keys(game.assignments).length !== game.currentSelectionIndex + 1) {
        failureReason = "자리 배정 수를 확인할 수 없어 다음 단계로 이동하지 않았습니다.";
        return;
      }
      const isLast = game.currentSelectionIndex >= game.selectionOrder.length - 1;
      game.cardPhaseStartedAt = 0;
      game.cardPhaseEndsAt = 0;
      if (isLast) {
        if (!validateSeatAssignments(game, true)) {
          failureReason = "모든 학생의 자리가 정확히 하나씩 배정되지 않았습니다.";
          return;
        }
        room.status = "finalReady";
      } else {
        game.currentSelectionIndex += 1;
        room.status = "seatSelection";
      }
      room.seatGame = game;
      return room;
    });
    if (!silent && !result.committed && (state.room?.status || "") === "cardPhase") {
      showToast(failureReason, "error");
    }
  } catch (error) {
    finalRelease?.record("app-error");
    if (!silent) {
      showToast("카드 활용 턴 종료 중 오류가 발생했습니다.", "error");
    }
  }
}

async function revealSeatFinal() {
  if (securePilot) return securePilotHostCommand("revealSeat");
  const now = Date.now();
  let failureReason = "최종 자리를 공개할 수 없습니다.";
  try {
    const result = await runTransaction(roomRef(state.roomCode), (room) => {
      if (!room || room.mode !== "seat" || room.status !== "finalReady") {
        failureReason = "모든 자리와 마지막 카드 활용 턴이 먼저 끝나야 합니다.";
        return;
      }
      const game = normalizeSeatGameRecord(room.seatGame || {});
      if (!validateSeatAssignments(game, true)) {
        failureReason = "최종 자리 배정이 완전하지 않아 공개하지 않았습니다.";
        return;
      }
      game.finalRevealStartedAt = now;
      game.finalRevealOrder = getSeatActiveNumbers(game.settings);
      room.status = "finalReveal";
      room.seatGame = game;
      return room;
    });
    if (!result.committed) {
      showToast(failureReason, "error");
    }
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("최종 자리 공개를 시작하지 못했습니다.", "error");
  }
}

async function finishSeatFinalReveal() {
  if (securePilot) return securePilot.send("finishSeatTimer");
  try {
    await runTransaction(roomRef(state.roomCode), (room) => {
      if (!room || room.mode !== "seat" || room.status !== "finalReveal") {
        return;
      }
      room.status = "finished";
      room.finishedAt = Date.now();
      return room;
    });
  } catch (error) {
    finalRelease?.record("app-error");
  }
}

function setupSeatCardPhaseTimer({ textSelector, fillSelector = "", onEnd = null }) {
  clearTimer();
  const game = getSeatGameState();
  const textEl = document.querySelector(textSelector);
  const fillEl = fillSelector ? document.querySelector(fillSelector) : null;
  if (!textEl || !game.cardPhaseEndsAt) {
    return;
  }
  const totalMs = Math.max(1, game.settings.cardPhaseSeconds) * 1000;
  let didEnd = false;
  const tick = () => {
    const remaining = Math.max(0, game.cardPhaseEndsAt - (securePilot?.now() ?? Date.now()));
    textEl.textContent = `${Math.ceil(remaining / 1000)}초`;
    if (fillEl) {
      fillEl.style.width = `${Math.max(0, Math.min(100, remaining / totalMs * 100))}%`;
    }
    if (remaining <= 0 && !didEnd) {
      didEnd = true;
      clearTimer();
      if (typeof onEnd === "function") {
        onEnd();
      }
    }
  };
  tick();
  state.timerId = window.setInterval(tick, 250);
}

function setupSeatFinalRevealAnimation() {
  clearTimer();
  const game = getSeatGameState();
  const countdownEl = document.querySelector("#seatRevealCountdown");
  const tiles = Array.from(document.querySelectorAll("[data-seat-reveal-index]"));
  const countdownMs = SEAT_FINAL_COUNTDOWN_SECONDS * 1000;
  const totalRevealMs = game.finalRevealOrder.length * SEAT_REVEAL_INTERVAL_MS;
  let didFinish = false;
  const tick = () => {
    const elapsed = Math.max(0, (securePilot?.now() ?? Date.now()) - game.finalRevealStartedAt);
    const countdownRemaining = Math.max(0, countdownMs - elapsed);
    if (countdownEl) {
      const value = countdownRemaining > 0 ? Math.ceil(countdownRemaining / 1000) : 0;
      countdownEl.textContent = value ? String(value) : "공개!";
      countdownEl.dataset.countdown = value ? String(value) : "go";
    }
    const revealElapsed = Math.max(0, elapsed - countdownMs);
    const revealedCount = Math.floor(revealElapsed / SEAT_REVEAL_INTERVAL_MS) + (revealElapsed > 0 ? 1 : 0);
    tiles.forEach((tile) => {
      if (Number(tile.dataset.seatRevealIndex) < revealedCount && !tile.classList.contains("revealed")) {
        const ownerId = game.assignments[getSeatKey(Number(tile.dataset.seatNumber))];
        if (securePilot && (!ownerId || ownerId.startsWith("~seat_"))) return;
        const owner = tile.querySelector(".seat-owner");
        if (owner) owner.innerHTML = renderSeatRevealedOwner(ownerId);
        if (state.role === "student" && ownerId === state.studentId) tile.classList.add("my-final-seat");
        tile.classList.add("revealed");
      }
    });
    if (elapsed >= countdownMs + totalRevealMs + 500 && !didFinish) {
      didFinish = true;
      clearTimer();
      finishSeatFinalReveal();
    }
  };
  tick();
  state.timerId = window.setInterval(tick, 100);
}

function setupSeatNoticeDismissHandler() {
  document.querySelector("#seatDismissNoticeBtn")?.addEventListener("click", () => {
    const game = getSeatGameState();
    const notice = game.notifications[state.studentId];
    if (notice) {
      localStorage.setItem(`seat_notice_${state.roomCode}_${game.gameId}_${state.studentId}`, notice.id);
      renderSeatStudentRoute();
    }
  });
}

function showSeatConfirmModal({ title, detail, cancelLabel = "취소", confirmLabel, onConfirm }) {
  closeSeatConfirmModal();
  const opener = document.activeElement;
  const openerKey = opener ? studioElementKey(opener) : "";
  document.body.insertAdjacentHTML("beforeend", `
    <dialog class="polish-confirm-dialog" data-seat-confirm-modal aria-labelledby="seatDialogTitle" aria-describedby="seatDialogDetail">
      <section class="modal-panel">
        <h2 id="seatDialogTitle">${escapeHtml(title)}</h2>
        <p class="lead" id="seatDialogDetail">${escapeHtml(detail)}</p>
        <div class="button-row">
          <button class="btn ghost" data-seat-modal-cancel type="button" autofocus>${escapeHtml(cancelLabel)}</button>
          <button class="btn success" data-seat-modal-confirm type="button">${escapeHtml(confirmLabel)}</button>
        </div>
      </section>
    </dialog>
  `);
  const modal = document.querySelector("[data-seat-confirm-modal]");
  modal?.addEventListener("click", (event) => {
    if (event.target === modal && !modal.dataset.saving) {
      closeSeatConfirmModal();
    }
  });
  modal.addEventListener("cancel", (event) => { if (modal.dataset.saving) event.preventDefault(); });
  modal.addEventListener("close", () => {
    modal.remove();
    const next = opener?.isConnected && !opener.disabled ? opener : (openerKey && [...document.querySelectorAll("#app button:enabled")].find((button) => studioElementKey(button) === openerKey));
    if (next) next.focus({ preventScroll: true });
  }, { once: true });
  document.querySelector("[data-seat-modal-cancel]")?.addEventListener("click", closeSeatConfirmModal);
  document.querySelector("[data-seat-modal-confirm]")?.addEventListener("click", async (event) => {
    const confirm = event.currentTarget;
    const cancel = modal.querySelector("[data-seat-modal-cancel]");
    modal.dataset.saving = "true";
    confirm.disabled = true;
    cancel.disabled = true;
    try {
      await onConfirm();
    } finally {
      delete modal.dataset.saving;
      confirm.disabled = false;
      cancel.disabled = false;
    }
  });
  modal.showModal();
}

function closeSeatConfirmModal() {
  const dialog = document.querySelector("[data-seat-confirm-modal]");
  if (dialog?.open) dialog.close();
  dialog?.remove();
}

// =========================
// 메모리 배틀
// =========================

function getInitialMemoryBattleStateForWrite(boardSize = DEFAULT_MEMORY_BOARD_SIZE) {
  return {
    settings: { boardSize: normalizeMemoryBoardSize(boardSize) },
    gameId: "",
    imageSetId: "",
    imageList: null,
    participants: null,
    players: null,
    gameStartedAt: null,
    endedAt: null,
    resultsPublishedAt: null,
    finalResults: null,
    hallOfFame: null,
    resultInsights: null
  };
}

function getMemoryBattle() {
  return state.room?.memoryBattle || getInitialMemoryBattleStateForWrite();
}

function normalizeMemoryBoardSize(value) {
  const size = Number(value);
  return MEMORY_BOARD_SIZES.includes(size) ? size : DEFAULT_MEMORY_BOARD_SIZE;
}

function getMemoryBoardSize() {
  return normalizeMemoryBoardSize(getMemoryBattle().settings?.boardSize);
}

function getUxMemoryPreviewSeconds(value = getMemoryBattle().settings?.previewSeconds) {
  return clampInt(value, 2, 12, MEMORY_PREVIEW_MS / 1000);
}

function getMemoryRequiredImageCount(boardSize = getMemoryBoardSize()) {
  const size = normalizeMemoryBoardSize(boardSize);
  return (size * size) / 2;
}

function normalizeFirebaseList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== null && item !== undefined);
  }
  return value && typeof value === "object"
    ? Object.keys(value).sort((a, b) => Number(a) - Number(b)).map((key) => value[key]).filter(Boolean)
    : [];
}

function getMemoryImageDefinitions(sourceGame = getMemoryBattle()) {
  return normalizeFirebaseList(sourceGame?.imageList).map((image, index) => ({
    id: String(image.id || `image_${index + 1}`),
    url: String(image.url || "")
  }));
}

function getMemoryImages(sourceGame = getMemoryBattle()) {
  const payloadMap = Object.fromEntries(normalizeFirebaseList(state.memoryImages).map((image) => [String(image.id || ""), image]));
  return getMemoryImageDefinitions(sourceGame).map((image) => ({
    id: image.id,
    url: String(payloadMap[image.id]?.dataUrl || payloadMap[image.id]?.url || image.url || "")
  })).filter((image) => image.url);
}

function getMemoryParticipants() {
  const source = getMemoryBattle().participants || {};
  return Object.entries(source).map(([id, value]) => ({ id, name: cleanText(value?.name || "이름 없음") }));
}

function getMemoryPlayerSummaries() {
  return getMemoryBattle().players || {};
}

function getMemoryTrustedNow() {
  return securePilot?.now() ?? Date.now() + Number(state.serverTimeOffset || 0);
}

function getMemoryParticipantCount() {
  return getMemoryBattle().participantCount ?? getMemoryParticipants().length;
}

function formatMemoryTime(value) {
  const milliseconds = Math.max(0, Number(value || 0));
  return `${(milliseconds / 1000).toFixed(2)}초`;
}

function memoryBoardKey(boardSize = getMemoryBoardSize()) {
  return `${normalizeMemoryBoardSize(boardSize)}x${normalizeMemoryBoardSize(boardSize)}`;
}

function compareMemoryRecords(first, second) {
  const timeDifference = Number(first?.completionTimeMs || Number.MAX_SAFE_INTEGER) - Number(second?.completionTimeMs || Number.MAX_SAFE_INTEGER);
  if (timeDifference !== 0) return timeDifference;
  const attemptDifference = Number(first?.attempts || Number.MAX_SAFE_INTEGER) - Number(second?.attempts || Number.MAX_SAFE_INTEGER);
  if (attemptDifference !== 0) return attemptDifference;
  return Number(first?.achievedAt || first?.completedAt || Number.MAX_SAFE_INTEGER) - Number(second?.achievedAt || second?.completedAt || Number.MAX_SAFE_INTEGER);
}

function sortMemoryRecords(records) {
  const source = Array.isArray(records) ? records : Object.values(records || {});
  return source.filter((record) => Number(record?.completionTimeMs) >= 0).sort(compareMemoryRecords);
}

function mergeMemoryBestRecords(records, currentResults, boardKey, gameId, fallbackAchievedAt) {
  const next = { ...(records || {}) };
  currentResults.forEach((result) => {
    const candidate = {
      playerId: result.playerId,
      playerName: result.playerName,
      boardSize: boardKey,
      completionTimeMs: Number(result.completionTimeMs),
      attempts: Number(result.attempts || 0),
      achievedAt: Number(result.completedAt || fallbackAchievedAt),
      gameId
    };
    if (!next[result.playerId] || compareMemoryRecords(candidate, next[result.playerId]) < 0) {
      next[result.playerId] = candidate;
    }
  });
  return next;
}

function createMemoryDeck(imageList) {
  const cards = imageList.flatMap((image) => [
    { cardId: `${image.id}_a`, imageId: image.id },
    { cardId: `${image.id}_b`, imageId: image.id }
  ]);
  return shuffleArray(cards);
}

function clearMemorySubscriptions() {
  if (typeof state.unsubscribeMemoryPlayer === "function") state.unsubscribeMemoryPlayer();
  if (typeof state.unsubscribeMemoryRecords === "function") state.unsubscribeMemoryRecords();
  if (typeof state.unsubscribeMemoryImages === "function") state.unsubscribeMemoryImages();
  state.unsubscribeMemoryPlayer = null;
  state.unsubscribeMemoryRecords = null;
  state.unsubscribeMemoryImages = null;
  state.memoryPlayerSubscriptionKey = "";
  state.memoryImageSubscriptionKey = "";
  state.memoryPlayer = null;
  state.memoryImages = [];
}

function clearMemoryPlayerSubscription() {
  if (typeof state.unsubscribeMemoryPlayer === "function") state.unsubscribeMemoryPlayer();
  if (typeof state.unsubscribeMemoryImages === "function") state.unsubscribeMemoryImages();
  state.unsubscribeMemoryPlayer = null;
  state.unsubscribeMemoryImages = null;
  state.memoryPlayerSubscriptionKey = "";
  state.memoryImageSubscriptionKey = "";
  state.memoryPlayer = null;
  state.memoryImages = [];
  state.memoryOpenCards = [];
  state.memoryBoardBusy = false;
}

function clearMemoryImageDraft() {
  state.memoryImageDraft.forEach((image) => {
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
  });
  state.memoryImageDraft = [];
}

function getMemoryDraftTotalBytes() {
  return state.memoryImageDraft.reduce((total, image) => total + Number(image.bytes || 0), 0);
}

function formatMemoryBytes(bytes) {
  const kilobytes = Math.max(0, Number(bytes || 0)) / 1024;
  return kilobytes < 1024 ? `${kilobytes.toFixed(0)}KB` : `${(kilobytes / 1024).toFixed(2)}MB`;
}

function ensureMemoryPlayerSubscription() {
  const gameId = String(getMemoryBattle().gameId || "");
  if (securePilot) {
    state.memoryPlayer = getMemoryBattle().board || null;
    return;
  }
  if (!db || state.role !== "student" || !state.studentId || !gameId) return;
  const key = `${state.roomCode}:${gameId}:${state.studentId}`;
  if (state.memoryPlayerSubscriptionKey === key) return;
  if (typeof state.unsubscribeMemoryPlayer === "function") state.unsubscribeMemoryPlayer();
  state.memoryPlayerSubscriptionKey = key;
  state.memoryPlayer = null;
  state.memoryOpenCards = [];
  state.memoryBoardBusy = false;
  state.unsubscribeMemoryPlayer = onValue(ref(db, `memoryPrivate/${state.roomCode}/${gameId}/${state.studentId}`), (snapshot) => {
    state.memoryPlayer = snapshot.val();
    if (getRoomMode() === "memory" && state.role === "student") renderMemoryStudentRoute();
  });
}

function ensureMemoryImagesSubscription() {
  const imageSetId = String(getMemoryBattle().imageSetId || "");
  if (securePilot) {
    if (imageSetId && ["memoryReady", "memoryCountdown", "memoryPlaying"].includes(state.room?.status)) void loadSecureMemoryImages(imageSetId);
    return;
  }
  if (!db || state.role !== "student" || !imageSetId) return;
  const key = `${state.roomCode}:${imageSetId}`;
  if (state.memoryImageSubscriptionKey === key) return;
  if (typeof state.unsubscribeMemoryImages === "function") state.unsubscribeMemoryImages();
  state.memoryImageSubscriptionKey = key;
  state.memoryImages = [];
  state.unsubscribeMemoryImages = onValue(ref(db, `memoryImages/${state.roomCode}/${imageSetId}`), (snapshot) => {
    state.memoryImages = normalizeFirebaseList(snapshot.val());
    if (getRoomMode() === "memory" && state.role === "student") {
      if (state.room?.status === "memoryReady") preloadMemoryImagesForStudent();
      renderMemoryStudentRoute();
    }
  });
}

async function loadSecureMemoryImages(imageSetId) {
  const code = state.roomCode;
  const key = `${code}:${imageSetId}`;
  const stillActive = () => state.role === "student" && state.roomCode === code && getMemoryBattle().imageSetId === imageSetId
    && ["memoryReady", "memoryCountdown", "memoryPlaying"].includes(state.room?.status);
  if (state.memoryImageSubscriptionKey === key) return;
  state.memoryImageSubscriptionKey = key;
  state.memoryImages = [];
  const result = await securePilot.memoryImages(imageSetId);
  if (!stillActive() || state.memoryImageSubscriptionKey !== key) return;
  if (!Array.isArray(result.files)) {
    state.memoryImageSubscriptionKey = "";
    showToast(securePilotError(result.error), "error");
    window.setTimeout(() => { if (stillActive()) void loadSecureMemoryImages(imageSetId); }, 2500);
    return;
  }
  state.memoryImages = result.files;
  renderMemoryStudentRoute();
  if (state.room?.status === "memoryReady") void preloadMemoryImagesForStudent();
}

function ensureMemoryRecordsSubscription() {
  if (securePilot) {
    state.memoryRecordsCache = getMemoryBattle().records || {};
    return;
  }
  if (!db || state.role !== "teacher" || state.unsubscribeMemoryRecords) return;
  state.unsubscribeMemoryRecords = onValue(ref(db, "memoryRecords"), (snapshot) => {
    state.memoryRecordsCache = snapshot.val() || {};
    if (getRoomMode() === "memory" && state.role === "teacher" && state.memoryRecordsVisible) {
      renderMemoryTeacherDashboard(true);
    }
  });
}

function renderMemoryStudentRoute() {
  const status = state.room?.status || "waiting";
  const game = getMemoryBattle();
  if (!game.gameId || status === "waiting") {
    if (securePilot || state.unsubscribeMemoryPlayer || state.unsubscribeMemoryImages) clearMemoryPlayerSubscription();
    renderMemoryStudentWaiting();
    return;
  }
  if (!game.participants?.[state.studentId]) {
    renderMemoryLateJoinWaiting();
    return;
  }
  ensureMemoryImagesSubscription();
  ensureMemoryPlayerSubscription();
  if (status === "memoryReady") {
    renderMemoryStudentReady();
    return;
  }
  if (status === "memoryCountdown") {
    const startsAt = Number(game.gameStartedAt || 0);
    if (startsAt && getMemoryTrustedNow() >= startsAt) {
      ensureMemoryPlayingStarted();
    }
    renderMemoryStudentCountdown();
    return;
  }
  if (status === "memoryPlaying") {
    renderMemoryStudentGame();
    return;
  }
  if (status === "memoryAwaitingResults") {
    renderMemoryStudentResultWaiting();
    return;
  }
  if (status === "finished") {
    renderMemoryFinalResult("student-memory-final", false, true);
    return;
  }
  renderMemoryStudentWaiting();
}

function renderMemoryLateJoinWaiting() {
  setView(`student-memory-late-${getMemoryBattle().gameId}`, `
    <section class="screen memory-mode"><section class="panel memory-panel result-panel"><span class="pill gold">다음 게임 대기</span><h1>이번 메모리 배틀은 이미 참가 명단이 정해졌습니다.</h1><p class="lead">선생님께 게임을 다시 생성해 달라고 알려 주세요. 다음 게임에는 자동으로 참가할 수 있습니다.</p></section></section>
  `);
}

function renderMemoryStudentWaiting() {
  setView("student-memory-waiting", `
    <section class="screen memory-mode">
      <div class="status-bar"><button class="btn ghost" id="backHomeBtn" type="button">처음으로</button><span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span></div>
      <section class="panel memory-panel result-panel">
        <p class="eyebrow">메모리 배틀</p>
        <h1>카드의 위치를 기억하고 모든 이미지 짝을 가장 빠르게 찾아라!</h1>
        <p class="lead">선생님이 게임을 준비하고 있습니다.</p>
      </section>
    </section>
  `, () => document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome));
}

function renderMemoryStudentReady() {
  const size = getMemoryBoardSize();
  const pairs = getMemoryRequiredImageCount(size);
  const ready = Boolean(getMemoryPlayerSummaries()[state.studentId]?.ready);
  setView(`student-memory-ready-${getMemoryBattle().gameId}-${ready}`, `
    <section class="screen memory-mode">
      <div class="status-bar"><span class="pill blue">${size}×${size}</span><span class="pill ${ready ? "green" : "gold"}">${ready ? "준비 완료" : "이미지 준비 중"}</span></div>
      <section class="panel memory-panel result-panel">
        <p class="eyebrow">메모리 배틀</p>
        <h1>카드의 위치를 기억하고 모든 짝을 찾아보세요.</h1>
        <div class="stats"><div class="stat"><span class="muted">카드</span><span class="num">${size * size}장</span></div><div class="stat"><span class="muted">짝</span><span class="num">${pairs}쌍</span></div></div>
        <p class="lead">${ready ? "선생님이 게임을 시작할 때까지 기다려 주세요." : "게임 이미지를 안전하게 불러오는 중입니다."}</p>
      </section>
    </section>
  `, () => preloadMemoryImagesForStudent());
}

async function preloadMemoryImagesForStudent() {
  const game = getMemoryBattle();
  const summary = getMemoryPlayerSummaries()[state.studentId];
  if (!game.gameId || summary?.ready || state.memoryReadyWriteKey === game.gameId) return;
  const images = getMemoryImages();
  if (images.length !== getMemoryRequiredImageCount()) return;
  state.memoryReadyWriteKey = game.gameId;
  const code = state.roomCode;
  try {
    await Promise.all(images.map((image) => new Promise((resolve, reject) => {
      const loader = new Image();
      loader.onload = resolve;
      loader.onerror = reject;
      loader.src = image.url;
    })));
    if (securePilot) {
      if (state.roomCode !== code || getMemoryBattle().gameId !== game.gameId || state.room?.status !== "memoryReady") return;
      const result = await securePilot.send("readyMemory");
      if (result.error && state.room?.status === "memoryReady") throw new Error(result.error);
      return;
    }
    await update(ref(db, `rooms/${state.roomCode}/memoryBattle/players/${state.studentId}`), {
      ready: true,
      readyAt: serverTimestamp()
    });
  } catch (error) {
    if (securePilot && (state.roomCode !== code || getMemoryBattle().gameId !== game.gameId || state.room?.status !== "memoryReady")) return;
    finalRelease?.record("app-error");
    state.memoryReadyWriteKey = "";
    showToast("이미지를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도합니다.", "error");
    window.setTimeout(() => { if (!securePilot || (state.roomCode === code && getMemoryBattle().gameId === game.gameId)) void preloadMemoryImagesForStudent(); }, 2500);
  }
}

function renderMemoryStudentCountdown() {
  const player = state.memoryPlayer;
  if (!player) {
    setView("student-memory-preview-loading", `<section class="screen memory-mode"><div class="panel"><h2>암기할 카드판을 불러오는 중입니다.</h2></div></section>`);
    return;
  }
  const size = getMemoryBoardSize();
  const startsAt = Number(getMemoryBattle().gameStartedAt || getMemoryTrustedNow() + getUxMemoryPreviewSeconds() * 1000);
  const initialSeconds = Math.max(1, Math.ceil((startsAt - getMemoryTrustedNow()) / 1000));
  setView(`student-memory-countdown-${getMemoryBattle().gameId}${securePilot ? `-${state.memoryImages.length}-${normalizeFirebaseList(player.openIndices).length}` : ""}`, `
    <section class="screen memory-mode memory-preview-screen">
      <div class="status-bar">
        <div><p class="eyebrow">카드 위치 공개</p><h1>지금 위치를 기억하세요!</h1></div>
        <span class="pill gold" id="memoryCountdownNumber" data-memory-preview="true">${initialSeconds}초 동안 위치를 기억하세요</span>
      </div>
      ${renderMemoryBoard(player, size, { revealAll: true })}
      <p class="muted memory-progress-note">시간이 끝나면 카드가 자동으로 뒤집히고 게임이 시작됩니다.</p>
    </section>
  `, () => startMemoryCountdownTicker(startsAt));
}

function startMemoryCountdownTicker(startsAt) {
  clearTimer();
  const tick = () => {
    const remaining = startsAt - getMemoryTrustedNow();
    const element = document.querySelector("#memoryCountdownNumber");
    if (element) {
      const seconds = Math.max(1, Math.ceil(remaining / 1000));
      if (element.dataset.memoryPreview !== "true") element.dataset.countdown = remaining <= 0 ? "go" : String(seconds);
      element.textContent = element.dataset.memoryPreview === "true"
        ? (remaining <= 0 ? "카드를 뒤집는 중..." : `${seconds}초 동안 위치를 기억하세요`)
        : (remaining <= 0 ? "START!" : String(seconds));
    }
    if (remaining <= 0) {
      if (securePilot) {
        document.querySelectorAll(".memory-preview-screen .memory-card").forEach((card) => {
          card.classList.remove("is-open");
          card.querySelector("img")?.remove();
        });
      }
      clearTimer();
      ensureMemoryPlayingStarted();
    }
  };
  tick();
  state.timerId = window.setInterval(tick, 100);
}

async function ensureMemoryPlayingStarted() {
  const gameId = String(getMemoryBattle().gameId || "");
  if (!gameId || state.memoryStartWriteKey === gameId) return;
  state.memoryStartWriteKey = gameId;
  try {
    if (securePilot) return await securePilot.send("advanceMemory");
    await runTransaction(roomRef(state.roomCode), (room) => {
      if (!room || room.mode !== "memory" || room.status !== "memoryCountdown" || room.memoryBattle?.gameId !== gameId) return;
      if (Number(room.memoryBattle.gameStartedAt || 0) > getMemoryTrustedNow()) return;
      room.status = "memoryPlaying";
      return room;
    });
  } catch (error) {
    finalRelease?.record("app-error");
  } finally {
    state.memoryStartWriteKey = "";
  }
}

function renderMemoryStudentGame() {
  const player = state.memoryPlayer;
  if (!player) {
    setView("student-memory-board-loading", `<section class="screen memory-mode"><div class="panel"><h2>내 카드판을 불러오는 중입니다.</h2></div></section>`);
    return;
  }
  if (player.completed) {
    renderMemoryStudentCompleted();
    return;
  }
  const game = getMemoryBattle();
  const size = getMemoryBoardSize();
  const matchedPairs = player.matchedPairs || {};
  const found = Object.keys(matchedPairs).filter((key) => matchedPairs[key]).length;
  setView(`student-memory-playing-${game.gameId}`, `
    <section class="screen memory-mode memory-play-screen">
      <div class="memory-game-toolbar">
        <strong>${size}×${size} 메모리 배틀</strong>
        <span>찾은 짝 <b id="memoryFoundCount">${found}</b> / ${getMemoryRequiredImageCount(size)}</span>
        <span id="memoryElapsed">0.00초</span>
        <span>시도 <b id="memoryAttemptCount">${Number(player.attempts || 0)}</b>회</span>
      </div>
      <div class="experience-memory-meter"><progress id="experienceMemoryProgress" value="${found}" max="${getMemoryRequiredImageCount(size)}" aria-label="찾은 카드 짝"></progress><div id="experienceMemoryMatch" class="experience-memory-match" role="status" hidden>${renderExperienceArt("memory/memory-match", "experience-match-art")}<strong>짝을 맞췄어요</strong></div></div>
      ${renderMemoryBoard(player, size)}
      <p class="muted small memory-progress-note">게임 중에는 다른 학생의 기록과 순위를 공개하지 않습니다. 완료 <span id="memoryCompletionSummary">${getMemoryCompletedCount()} / ${getMemoryParticipantCount()}명</span></p>
    </section>
  `, () => {
    bindMemoryCardButtons();
    startMemoryElapsedTicker();
  });
  if (securePilot) syncSecureMemoryBoard(player);
}

function renderMemoryBoard(player, size, { revealAll = false } = {}) {
  const cards = normalizeFirebaseList(player.cards);
  const matched = player.matchedPairs || {};
  const imageMap = Object.fromEntries(getMemoryImages().map((image) => [image.id, image]));
  return `<div class="memory-board-wrap"><div class="memory-board memory-board-${size}" style="--memory-size:${size}">${cards.map((card, index) => {
    const isMatched = Boolean(matched[card.imageId]);
    const isOpen = revealAll || isMatched || (securePilot && normalizeFirebaseList(player.openIndices).includes(index));
    const image = imageMap[card.imageId];
    return `<button class="memory-card ${isOpen ? "is-open" : ""} ${isMatched ? "is-matched" : ""}" type="button" data-memory-card="${index}" ${isMatched || revealAll ? "disabled" : ""} aria-label="${revealAll ? "위치를 기억할 카드" : isMatched ? "찾은 카드" : "뒤집힌 카드"}"><span class="memory-card-inner"><span class="memory-card-back">?</span><span class="memory-card-front">${image ? `<img src="${escapeAttr(image.url)}" alt="" draggable="false" />` : ""}<span class="memory-match-mark">✓</span></span></span></button>`;
  }).join("")}</div></div>`;
}

function bindMemoryCardButtons() {
  document.querySelectorAll("[data-memory-card]").forEach((button) => {
    button.addEventListener("click", () => selectMemoryCard(Number(button.dataset.memoryCard)));
  });
}

function startMemoryElapsedTicker() {
  clearTimer();
  const tick = () => {
    const element = document.querySelector("#memoryElapsed");
    if (!element) return;
    element.textContent = formatMemoryTime(getMemoryTrustedNow() - Number(getMemoryBattle().gameStartedAt || getMemoryTrustedNow()));
    if (securePilot && state.memoryPlayer?.mismatchUntil && state.memoryPlayer.mismatchUntil <= getMemoryTrustedNow()
      && element.dataset.closedMismatch !== String(state.memoryPlayer.mismatchUntil)) {
      element.dataset.closedMismatch = String(state.memoryPlayer.mismatchUntil);
      syncSecureMemoryBoard(state.memoryPlayer);
    }
  };
  tick();
  state.timerId = window.setInterval(tick, 50);
}

async function selectMemoryCard(index) {
  if (securePilot) return selectSecureMemoryCard(index);
  const player = state.memoryPlayer;
  const cards = normalizeFirebaseList(player?.cards);
  const card = cards[index];
  if (!card || state.memoryBoardBusy || player?.completed || state.room?.status !== "memoryPlaying") return;
  if (player?.matchedPairs?.[card.imageId] || state.memoryOpenCards.includes(index)) return;
  const button = document.querySelector(`[data-memory-card="${index}"]`);
  button?.classList.add("is-open", "is-selected");
  state.memoryOpenCards.push(index);
  if (state.memoryOpenCards.length < 2) return;
  state.memoryBoardBusy = true;
  const [firstIndex, secondIndex] = state.memoryOpenCards;
  const firstCard = cards[firstIndex];
  const secondCard = cards[secondIndex];
  const isMatch = firstCard.imageId === secondCard.imageId;
  const requiredPairs = getMemoryRequiredImageCount();
  const gameId = getMemoryBattle().gameId;
  const completedAt = getMemoryTrustedNow();
  try {
    const result = await runTransaction(ref(db, `memoryPrivate/${state.roomCode}/${gameId}/${state.studentId}`), (current) => {
      if (!current || current.completed) return;
      const matchedPairs = current.matchedPairs || {};
      if (isMatch && matchedPairs[firstCard.imageId]) return;
      current.attempts = Number(current.attempts || 0) + 1;
      if (isMatch) {
        current.matchedPairs = { ...matchedPairs, [firstCard.imageId]: true };
        const matchedCount = Object.keys(current.matchedPairs).filter((key) => current.matchedPairs[key]).length;
        if (matchedCount === requiredPairs) {
          current.completed = true;
          current.completedAt = serverTimestamp();
          current.completionTimeMs = Math.max(0, completedAt - Number(getMemoryBattle().gameStartedAt || completedAt));
        }
      }
      current.updatedAt = completedAt;
      return current;
    });
    if (!result.committed) throw new Error("카드 상태가 이미 변경되었습니다.");
    const updatedPlayer = result.snapshot.val();
    state.memoryPlayer = updatedPlayer;
    const matchedCount = Object.keys(updatedPlayer.matchedPairs || {}).filter((key) => updatedPlayer.matchedPairs[key]).length;
    await update(ref(db, `rooms/${state.roomCode}/memoryBattle/players/${state.studentId}`), {
      attempts: Number(updatedPlayer.attempts || 0),
      matchedCount,
      completed: Boolean(updatedPlayer.completed),
      completedAt: updatedPlayer.completedAt || null,
      completionTimeMs: updatedPlayer.completionTimeMs || null
    });
    document.querySelector("#memoryAttemptCount")?.replaceChildren(document.createTextNode(String(updatedPlayer.attempts || 0)));
    document.querySelector("#memoryFoundCount")?.replaceChildren(document.createTextNode(String(matchedCount)));
    if (isMatch) {
      [firstIndex, secondIndex].forEach((cardIndex) => document.querySelector(`[data-memory-card="${cardIndex}"]`)?.classList.add("is-matched"));
      const progress = document.querySelector("#experienceMemoryProgress");
      const feedback = document.querySelector("#experienceMemoryMatch");
      if (progress) progress.value = matchedCount;
      if (feedback?.dataset) {
        feedback.dataset.match = String(matchedCount);
        feedback.hidden = false;
        window.setTimeout(() => { if (feedback.dataset.match === String(matchedCount)) feedback.hidden = true; }, 650);
      }
      state.memoryOpenCards = [];
      state.memoryBoardBusy = false;
      if (updatedPlayer.completed) {
        await maybeMarkMemoryAllComplete();
        state.activeView = "";
        renderMemoryStudentCompleted();
      }
      return;
    }
    window.setTimeout(() => {
      [firstIndex, secondIndex].forEach((cardIndex) => document.querySelector(`[data-memory-card="${cardIndex}"]`)?.classList.remove("is-open", "is-selected"));
      state.memoryOpenCards = [];
      state.memoryBoardBusy = false;
    }, MEMORY_MISMATCH_DELAY_MS);
  } catch (error) {
    finalRelease?.record("app-error");
    state.memoryOpenCards = [];
    state.memoryBoardBusy = false;
    showToast("카드 상태를 저장하지 못했습니다. 잠시 후 다시 눌러 주세요.", "error");
    state.activeView = "";
    renderMemoryStudentRoute();
  }
}

function syncSecureMemoryBoard(player) {
  const cards = normalizeFirebaseList(player.cards);
  const expiredMismatch = player.mismatchUntil && player.mismatchUntil <= getMemoryTrustedNow();
  const open = new Set(expiredMismatch ? [] : normalizeFirebaseList(player.openIndices));
  const images = new Map(getMemoryImages().map((image) => [image.id, image.url]));
  for (const button of document.querySelectorAll("[data-memory-card]")) {
    const index = Number(button.dataset.memoryCard);
    const imageId = cards[index]?.imageId;
    const matched = Boolean(imageId && player.matchedPairs?.[imageId]);
    const faceUp = matched || open.has(index);
    button.classList.toggle("is-matched", matched);
    button.classList.toggle("is-open", faceUp);
    button.classList.toggle("is-selected", faceUp && !matched);
    button.disabled = faceUp;
    button.setAttribute("aria-label", matched ? "찾은 카드" : faceUp ? "공개된 카드" : `${index + 1}번 카드 뒤집기`);
    const front = button.querySelector(".memory-card-front");
    const image = front?.querySelector("img");
    const url = faceUp && images.get(imageId);
    if (!url) image?.remove();
    else if (image?.getAttribute("src") !== url) {
      image?.remove();
      const next = document.createElement("img");
      next.src = url;
      next.alt = "";
      next.draggable = false;
      front.prepend(next);
    }
  }
  const found = Number(player.matchedCount || 0);
  const progress = document.querySelector("#experienceMemoryProgress");
  const feedback = document.querySelector("#experienceMemoryMatch");
  if (progress && feedback && found > progress.value) {
    feedback.hidden = false;
    feedback.dataset.match = String(found);
    window.setTimeout(() => { if (feedback.dataset.match === String(found)) feedback.hidden = true; }, 650);
  }
  if (progress) progress.value = found;
  const count = document.querySelector("#memoryFoundCount");
  if (count) count.textContent = found;
  const attempts = document.querySelector("#memoryAttemptCount");
  if (attempts) attempts.textContent = player.attempts || 0;
  const all = document.querySelector("#memoryCompletionSummary");
  if (all) all.textContent = `${getMemoryCompletedCount()} / ${getMemoryParticipantCount()}명`;
}

async function selectSecureMemoryCard(index) {
  const player = state.memoryPlayer;
  const gameId = getMemoryBattle().gameId;
  if (!player || player.completed || state.memoryBoardBusy || state.room?.status !== "memoryPlaying") return;
  if (player.mismatchUntil > getMemoryTrustedNow()) return;
  state.memoryBoardBusy = true;
  try {
    const result = await securePilot.send("flipMemory", { index });
    if (getMemoryBattle().gameId === gameId && result.error && result.error !== "memory-flip-wait") showToast(securePilotError(result.error), "error");
  } finally {
    state.memoryBoardBusy = false;
  }
}

function renderMemoryStudentCompleted() {
  const player = state.memoryPlayer || {};
  setView(`student-memory-completed-${getMemoryBattle().gameId}`, `
    <section class="screen memory-mode"><section class="panel memory-panel result-panel"><span class="pill green">완료</span><h1>모든 짝을 찾았습니다!</h1><div class="stats"><div class="stat"><span class="muted">내 기록</span><span class="num">${formatMemoryTime(player.completionTimeMs)}</span></div><div class="stat"><span class="muted">시도 횟수</span><span class="num">${Number(player.attempts || 0)}회</span></div></div><p class="lead">다른 학생들이 게임을 진행하고 있습니다.</p><p class="muted">완료 ${getMemoryCompletedCount()} / ${getMemoryParticipantCount()}명 · 결과 공개 전에는 순위가 보이지 않습니다.</p></section></section>
  `);
}

function renderMemoryStudentResultWaiting() {
  const player = state.memoryPlayer || {};
  setView(`student-memory-result-wait-${getMemoryBattle().gameId}-${Boolean(player.completed)}`, `
    <section class="screen memory-mode"><section class="panel memory-panel result-panel"><span class="pill gold">게임 종료</span><h1>${player.completed ? "기록이 저장되었습니다." : "이번 게임이 종료되었습니다."}</h1>${player.completed ? `<div class="stats"><div class="stat"><span class="muted">내 기록</span><span class="num">${formatMemoryTime(player.completionTimeMs)}</span></div><div class="stat"><span class="muted">시도</span><span class="num">${Number(player.attempts || 0)}회</span></div></div>` : `<div class="notice warn">완료하지 못한 기록은 역대 기록에 반영되지 않습니다.</div>`}<p class="lead">선생님의 최종 결과 공개를 기다려 주세요.</p></section></section>
  `);
}

function getMemoryCompletedCount() {
  return getMemoryBattle().completedCount ?? Object.values(getMemoryPlayerSummaries()).filter((player) => player?.completed).length;
}

async function maybeMarkMemoryAllComplete() {
  try {
    await runTransaction(roomRef(state.roomCode), (room) => {
      if (!room || room.mode !== "memory" || room.status !== "memoryPlaying") return;
      const participants = Object.keys(room.memoryBattle?.participants || {});
      const players = room.memoryBattle?.players || {};
      if (!participants.length || !participants.every((id) => players[id]?.completed)) return;
      room.status = "memoryAwaitingResults";
      room.memoryBattle.endedAt = getMemoryTrustedNow();
      return room;
    });
  } catch (error) {
    finalRelease?.record("app-error");
  }
}

function renderMemoryTeacherDashboard(force = true) {
  ensureMemoryRecordsSubscription();
  const game = getMemoryBattle();
  const status = state.room?.status || "waiting";
  if (status === "finished" && game.resultsPublishedAt) {
    renderMemoryFinalResult("teacher-memory-final", true, force);
    return;
  }
  if (!game.gameId || status === "waiting") {
    renderMemoryTeacherSetup(force);
    return;
  }
  renderMemoryTeacherProgress(force);
}

function renderMemoryTeacherSetup(force = true) {
  const storedSize = getMemoryBoardSize();
  if (!state.memorySettingsDraft) state.memorySettingsDraft = { boardSize: storedSize };
  const size = normalizeMemoryBoardSize(state.memorySettingsDraft.boardSize);
  const required = getMemoryRequiredImageCount(size);
  const connectedStudents = getStudents().filter((student) => student.connected);
  setView(`teacher-memory-setup-${size}-${state.memoryImageDraft.length}-${state.memoryUploading}-${state.memoryRecordsVisible}`, `
    <section class="screen memory-mode">
      ${renderMemoryTeacherHeader("게임 설정")}
      ${renderTeacherModeControls()}
      <div class="grid-2 memory-setup-layout">
        <section class="panel memory-panel">
          <p class="eyebrow">1. 보드 크기</p>
          <div class="segmented memory-size-picker">${MEMORY_BOARD_SIZES.map((boardSize) => `<button class="btn ${size === boardSize ? "primary" : "ghost"}" data-memory-size="${boardSize}" type="button">${boardSize}×${boardSize}</button>`).join("")}</div>
          <div class="field"><label for="uxMemoryPreview">카드 암기 시간 (초)</label><input id="uxMemoryPreview" type="number" min="2" max="12" value="${getUxMemoryPreviewSeconds(state.memorySettingsDraft?.previewSeconds)}" /></div>
          <div class="stats"><div class="stat"><span class="muted">필요 이미지</span><span class="num">${required}장</span></div><div class="stat"><span class="muted">생성 카드</span><span class="num">${size * size}장</span></div></div>
          <p class="eyebrow">2. 이미지 직접 업로드</p>
          <label class="btn dark memory-file-button">이미지 추가<input id="memoryImageInput" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple /></label>
          <p class="muted small">JPG, JPEG, PNG, WEBP · 여러 장을 한 번에 선택할 수 있습니다. 이미지는 무료 Realtime Database 사용에 맞게 자동 압축됩니다.</p>
          <div class="notice ${state.memoryImageDraft.length === required ? "success" : state.memoryImageDraft.length > required ? "danger" : "info"}"><strong>등록된 이미지 ${state.memoryImageDraft.length} / ${required}장</strong><br />현재 생성 가능 카드 ${state.memoryImageDraft.length * 2}장 · ${size}×${size}는 총 ${size * size}장이 필요합니다.<br />업로드한 이미지마다 동일한 카드가 2장씩 생성됩니다.</div>
          <p class="muted small">압축 이미지 전체 용량: <strong>${formatMemoryBytes(getMemoryDraftTotalBytes())}</strong> / ${formatMemoryBytes(MEMORY_IMAGE_TOTAL_MAX_BYTES)}</p>
          <div class="button-row"><button class="btn success" data-action="memory-create" type="button" ${state.memoryImageDraft.length === required && connectedStudents.length && !state.memoryUploading ? "" : "disabled"}>${state.memoryUploading ? "업로드 중..." : "게임 생성"}</button><button class="btn ghost" data-action="memory-toggle-records" type="button">${state.memoryRecordsVisible ? "역대 랭킹 닫기" : "역대 랭킹 보기"}</button></div>
        </section>
        <section class="panel">
          <p class="eyebrow">이미지 미리보기</p>
          ${state.memoryImageDraft.length ? `<div class="memory-upload-grid">${state.memoryImageDraft.map((image, index) => `<article class="memory-upload-card"><img src="${escapeAttr(image.previewUrl)}" alt="업로드 이미지 ${index + 1}" /><p title="${escapeAttr(image.name)}">${escapeHtml(image.name)}</p><button class="btn danger small" data-memory-remove-image="${index}" type="button">삭제</button></article>`).join("")}</div>` : `<div class="empty">아직 선택한 이미지가 없습니다.</div>`}
          <p class="eyebrow">현재 참가 학생</p>
          <p><strong>${connectedStudents.length}명</strong> 접속 중</p>
          ${renderStudentList(connectedStudents)}
        </section>
      </div>
      ${state.memoryRecordsVisible ? renderMemoryRecordsManager(size) : ""}
    </section>
  `, bindMemoryTeacherSetup, force);
}

function renderMemoryTeacherHeader(subtitle) {
  return `<div class="status-bar"><div><p class="eyebrow">교사 화면 · 메모리 배틀</p><h1>${escapeHtml(subtitle)}</h1></div><div class="button-row"><button class="btn dark" data-action="open-display" type="button">교실 화면 열기</button><button class="btn ghost" id="backHomeBtn" type="button">처음으로</button></div></div><section class="panel"><div class="status-bar"><div><p class="muted small">학생들에게 알려 줄 방 코드</p><div class="room-code">${escapeHtml(state.roomCode)}</div></div><button class="btn ghost" id="copyRoomCodeBtn" type="button">코드 복사</button></div></section>`;
}

function bindMemoryTeacherCommon() {
  document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome);
  document.querySelector("#copyRoomCodeBtn")?.addEventListener("click", copyRoomCode);
  document.querySelectorAll("[data-switch-mode]").forEach((button) => button.addEventListener("click", () => switchRoomMode(button.dataset.switchMode)));
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleTeacherAction(button.dataset.action)));
}

function bindMemoryTeacherSetup() {
  bindMemoryTeacherCommon();
  document.querySelector("#uxMemoryPreview")?.addEventListener("input", (event) => {
    state.memorySettingsDraft = { ...state.memorySettingsDraft, previewSeconds: getUxMemoryPreviewSeconds(event.target.value || undefined) };
  });
  document.querySelectorAll("[data-memory-size]").forEach((button) => button.addEventListener("click", () => {
    state.memorySettingsDraft = { ...state.memorySettingsDraft, boardSize: Number(button.dataset.memorySize) };
    renderMemoryTeacherSetup(true);
  }));
  document.querySelector("#memoryImageInput")?.addEventListener("change", handleMemoryImageFiles);
  document.querySelectorAll("[data-memory-remove-image]").forEach((button) => button.addEventListener("click", () => removeMemoryDraftImage(Number(button.dataset.memoryRemoveImage))));
  document.querySelectorAll("[data-memory-record-size]").forEach((button) => button.addEventListener("click", () => {
    state.memorySettingsDraft = { ...state.memorySettingsDraft, boardSize: Number(button.dataset.memoryRecordSize) };
    renderMemoryTeacherSetup(true);
  }));
}

async function handleMemoryImageFiles(event) {
  const files = [...(event.target.files || [])];
  if (!files.length) return;
  const existingSignatures = new Set(state.memoryImageDraft.map((image) => image.signature));
  let duplicateCount = 0;
  for (const file of files) {
    const signature = `${file.name}:${file.size}:${file.lastModified}`;
    if (existingSignatures.has(signature)) {
      duplicateCount += 1;
      continue;
    }
    try {
      const optimized = await optimizeMemoryImage(file);
      state.memoryImageDraft.push({ ...optimized, signature, name: file.name });
      existingSignatures.add(signature);
    } catch (error) {
      finalRelease?.record("app-error");
      showToast(`${file.name} 파일을 이미지로 처리하지 못했습니다.`, "error");
    }
  }
  if (duplicateCount) showToast(`같은 파일 ${duplicateCount}개는 중복 추가하지 않았습니다.`);
  renderMemoryTeacherSetup(true);
}

async function optimizeMemoryImage(file) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) throw new Error("지원하지 않는 이미지 형식");
  const bitmap = await loadMemoryImageSource(file);
  const scale = Math.min(1, MEMORY_IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === "function") bitmap.close();
  let blob = null;
  let contentType = "image/webp";
  for (const quality of [MEMORY_IMAGE_QUALITY, 0.58, 0.46]) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (blob && blob.size <= MEMORY_IMAGE_MAX_BYTES) break;
  }
  if (!blob || blob.size > MEMORY_IMAGE_MAX_BYTES) {
    contentType = "image/jpeg";
    for (const quality of [MEMORY_IMAGE_QUALITY, 0.56, 0.44]) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MEMORY_IMAGE_MAX_BYTES) break;
    }
  }
  if (!blob) throw new Error("이미지 압축 실패");
  if (blob.size > MEMORY_IMAGE_MAX_BYTES) throw new Error("압축 후 이미지 용량 초과");
  const dataUrl = await memoryBlobToDataUrl(blob);
  return { blob, dataUrl, contentType, previewUrl: URL.createObjectURL(blob), width, height, bytes: blob.size };
}

function memoryBlobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("이미지 변환 실패"));
    reader.readAsDataURL(blob);
  });
}

async function loadMemoryImageSource(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return createImageBitmap(file);
    }
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지 읽기 실패")); };
    image.src = url;
  });
}

function removeMemoryDraftImage(index) {
  const [removed] = state.memoryImageDraft.splice(index, 1);
  if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  renderMemoryTeacherSetup(true);
}

async function createMemoryGame() {
  const size = normalizeMemoryBoardSize(state.memorySettingsDraft?.boardSize);
  const required = getMemoryRequiredImageCount(size);
  if (state.memoryImageDraft.length !== required) {
    showToast(`${size}×${size} 게임에는 이미지 ${required}장이 필요합니다. 현재 ${state.memoryImageDraft.length}장이 등록되어 있습니다.`, "error");
    return;
  }
  const participants = getStudents().filter((student) => student.connected);
  if (!participants.length) {
    showToast("접속 중인 학생이 한 명 이상 있어야 게임을 생성할 수 있습니다.", "error");
    return;
  }
  if (getMemoryDraftTotalBytes() > MEMORY_IMAGE_TOTAL_MAX_BYTES) {
    showToast(`압축 이미지 전체 용량이 ${formatMemoryBytes(MEMORY_IMAGE_TOTAL_MAX_BYTES)}를 넘습니다. 일부 이미지를 삭제하거나 더 단순한 이미지를 사용해 주세요.`, "error");
    return;
  }
  state.memoryUploading = true;
  renderMemoryTeacherSetup(true);
  if (securePilot) {
    if (securePilot.isController()) openDisplayWindow({ silent: true });
    const result = await securePilot.uploadMemoryImages({ boardSize: size, images: state.memoryImageDraft.map((image) => image.dataUrl),
      previewSeconds: getUxMemoryPreviewSeconds(state.memorySettingsDraft?.previewSeconds) });
    state.memoryUploading = false;
    if (result.error) {
      if (getRoomMode() === "memory" && state.room?.status === "waiting") renderMemoryTeacherSetup(true);
      return showToast(securePilotError(result.error), "error");
    }
    clearMemoryImageDraft();
    return showToast("메모리 배틀을 생성했습니다. 학생 이미지 준비 상태를 확인해 주세요.", "success");
  }
  const gameId = `memory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const imageSetId = `images_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const imageList = state.memoryImageDraft.map((source, index) => ({ id: `image_${index + 1}` }));
  const imagePayload = state.memoryImageDraft.map((source, index) => ({
    id: `image_${index + 1}`,
    dataUrl: source.dataUrl,
    bytes: Number(source.bytes || 0),
    contentType: source.contentType || "image/webp"
  }));
  try {
    await writeNewMemorySession({ gameId, imageSetId, boardSize: size, imageList, imagePayload, participants, previewSeconds: getUxMemoryPreviewSeconds(state.memorySettingsDraft?.previewSeconds) });
    clearMemoryImageDraft();
    state.memoryUploading = false;
    openDisplayWindow({ silent: true });
    showToast("메모리 배틀을 생성했습니다. 학생 이미지 준비 상태를 확인해 주세요.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    state.memoryUploading = false;
    await remove(ref(db, `memoryImages/${state.roomCode}/${imageSetId}`)).catch(() => {});
    showToast("이미지를 저장하지 못했습니다. Realtime Database 규칙과 인터넷 연결을 확인해 주세요.", "error");
    renderMemoryTeacherSetup(true);
  }
}

async function writeNewMemorySession({ gameId, imageSetId, boardSize, imageList, imagePayload = null, participants, previewSeconds = getUxMemoryPreviewSeconds() }) {
  const participantMap = {};
  const playerMap = {};
  const updates = {};
  participants.forEach((student) => {
    participantMap[student.id] = { name: student.name };
    playerMap[student.id] = { name: student.name, ready: false, completed: false, attempts: 0, matchedCount: 0 };
    updates[`memoryPrivate/${state.roomCode}/${gameId}/${student.id}`] = {
      playerId: student.id,
      playerName: student.name,
      gameId,
      boardSize,
      cards: createMemoryDeck(imageList),
      matchedPairs: {},
      attempts: 0,
      completed: false,
      createdAt: getMemoryTrustedNow()
    };
  });
  if (imagePayload) {
    imagePayload.forEach((image) => {
      updates[`memoryImages/${state.roomCode}/${imageSetId}/${image.id}`] = image;
    });
  }
  updates[`rooms/${state.roomCode}/status`] = "memoryReady";
  updates[`rooms/${state.roomCode}/finishedAt`] = null;
  updates[`rooms/${state.roomCode}/memoryBattle`] = {
    settings: { boardSize, previewSeconds },
    gameId,
    imageSetId,
    imageList,
    participants: participantMap,
    players: playerMap,
    createdAt: getMemoryTrustedNow(),
    gameStartedAt: null,
    endedAt: null,
    resultsPublishedAt: null,
    finalResults: null,
    hallOfFame: null,
    resultInsights: null
  };
  await update(ref(db), updates);
}

function renderMemoryTeacherProgress(force = true) {
  const game = getMemoryBattle();
  const status = state.room.status;
  const participants = getMemoryParticipants();
  const summaries = getMemoryPlayerSummaries();
  const readyCount = participants.filter((student) => summaries[student.id]?.ready).length;
  const completed = getCompletedMemoryResults();
  const playing = participants.filter((student) => !summaries[student.id]?.completed);
  setView(`teacher-memory-progress-${game.gameId}-${status}-${readyCount}-${completed.length}`, `
    <section class="screen memory-mode">
      ${renderMemoryTeacherHeader(`${getMemoryBoardSize()}×${getMemoryBoardSize()} 메모리 배틀`)}
      <section class="panel memory-panel">
        <div class="status-bar"><div><span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span><h2>${memoryTeacherStatusTitle(status)}</h2></div>${renderMemoryTeacherActions(status, readyCount, participants.length)}</div>
        <div class="stats"><div class="stat"><span class="muted">참가 학생</span><span class="num">${participants.length}명</span></div><div class="stat"><span class="muted">준비 완료</span><span class="num">${readyCount} / ${participants.length}</span></div><div class="stat"><span class="muted">게임 완료</span><span class="num">${completed.length} / ${participants.length}</span></div><div class="stat"><span class="muted">경과 시간</span><span class="num" id="memoryTeacherElapsed">${game.gameStartedAt ? formatMemoryTime(getMemoryTrustedNow() - game.gameStartedAt) : "-"}</span></div></div>
      </section>
      <div class="grid-2">
        <section class="panel"><h2>학생별 상태</h2><div class="memory-player-list">${participants.map((student) => {
          const summary = summaries[student.id] || {};
          const text = summary.completed ? `${formatMemoryTime(summary.completionTimeMs)} · ${Number(summary.attempts || 0)}회` : summary.ready ? (status === "memoryReady" ? "준비 완료" : "게임 중") : "이미지 불러오는 중";
          return `<div class="memory-player-row"><strong>${escapeHtml(student.name)}</strong><span class="pill ${summary.completed ? "green" : summary.ready ? "blue" : "gold"}">${text}</span></div>`;
        }).join("")}</div></section>
        <section class="panel"><h2>현재 진행 요약</h2>${completed.length ? `<h3>완료</h3>${renderMemoryRanking(completed, "")}` : `<div class="empty">아직 완료한 학생이 없습니다.</div>`}<h3>게임 중</h3>${playing.length ? `<div class="tag-list">${playing.map((student) => `<span class="tag">${escapeHtml(student.name)}</span>`).join("")}</div>` : `<p class="muted">모든 참가 학생이 완료했습니다.</p>`}</section>
      </div>
    </section>
  `, () => {
    bindMemoryTeacherCommon();
    if (status === "memoryCountdown" || status === "memoryPlaying") startMemoryTeacherElapsedTicker();
  }, force);
}

function memoryTeacherStatusTitle(status) {
  return ({ memoryReady: "학생 이미지 준비 상태를 확인하세요.", memoryCountdown: "학생들이 카드 위치를 기억하고 있습니다.", memoryPlaying: "학생들이 각자의 카드판을 풀고 있습니다.", memoryAwaitingResults: "최종 결과 공개를 준비했습니다." })[status] || "메모리 배틀";
}

function renderMemoryTeacherActions(status, readyCount, totalCount) {
  if (status === "memoryReady") return `<div class="button-row"><button class="btn success" data-action="memory-start" type="button">게임 시작${readyCount < totalCount ? ` (${readyCount}/${totalCount} 준비)` : ""}</button><button class="btn ghost" data-action="memory-new-images" type="button">새 이미지로 게임하기</button></div>`;
  if (status === "memoryCountdown" || status === "memoryPlaying") return `<div class="button-row"><button class="btn danger" data-action="memory-end" type="button">게임 종료</button></div>`;
  if (status === "memoryAwaitingResults") return `<div class="button-row"><button class="btn success" data-action="memory-reveal" type="button">최종 결과 공개</button></div>`;
  return "";
}

function startMemoryTeacherElapsedTicker() {
  clearTimer();
  const tick = () => {
    const element = document.querySelector("#memoryTeacherElapsed");
    if (element && getMemoryBattle().gameStartedAt) element.textContent = formatMemoryTime(getMemoryTrustedNow() - getMemoryBattle().gameStartedAt);
    if (state.room?.status === "memoryCountdown" && getMemoryTrustedNow() >= Number(getMemoryBattle().gameStartedAt || Infinity)) ensureMemoryPlayingStarted();
  };
  tick();
  state.timerId = window.setInterval(tick, 100);
}

async function startMemoryGame() {
  const participants = getMemoryParticipants();
  const readyCount = participants.filter((student) => getMemoryPlayerSummaries()[student.id]?.ready).length;
  if (!participants.length) return;
  if (readyCount < participants.length && !window.confirm(`아직 ${participants.length - readyCount}명의 이미지 준비가 완료되지 않았습니다. 그래도 시작할까요?`)) return;
  if (securePilot) {
    if (securePilot.isController()) openDisplayWindow({ silent: true });
    return securePilotHostCommand("startMemory", { force: readyCount < participants.length });
  }
  openDisplayWindow({ silent: true });
  const previewSeconds = getUxMemoryPreviewSeconds();
  const startedAt = getMemoryTrustedNow() + previewSeconds * 1000;
  try {
    await update(roomRef(state.roomCode), {
      status: "memoryCountdown",
      "memoryBattle/countdownStartedAt": serverTimestamp(),
      "memoryBattle/gameStartedAt": startedAt
    });
    showToast(`${previewSeconds}초 동안 카드 위치를 공개한 뒤 게임을 시작합니다.`, "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("게임을 시작하지 못했습니다.", "error");
  }
}

async function endMemoryGame() {
  const incomplete = getMemoryParticipants().length - getMemoryCompletedCount();
  const message = incomplete ? `아직 게임을 완료하지 못한 학생이 ${incomplete}명입니다. 게임을 종료할까요?` : "게임을 종료하고 결과 공개를 준비할까요?";
  if (!window.confirm(message)) return;
  if (securePilot) return securePilotHostCommand("endMemory", { confirmed: true });
  try {
    await update(roomRef(state.roomCode), { status: "memoryAwaitingResults", "memoryBattle/endedAt": serverTimestamp() });
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("게임을 종료하지 못했습니다.", "error");
  }
}

function getCompletedMemoryResults() {
  const participants = getMemoryParticipants();
  const summaries = getMemoryPlayerSummaries();
  return sortMemoryRecords(participants.map((student) => ({
    playerId: student.id,
    playerName: student.name,
    completionTimeMs: Number(summaries[student.id]?.completionTimeMs),
    attempts: Number(summaries[student.id]?.attempts || 0),
    completedAt: Number(summaries[student.id]?.completedAt || 0),
    completed: Boolean(summaries[student.id]?.completed)
  })).filter((record) => record.completed && Number.isFinite(record.completionTimeMs)));
}

async function revealMemoryResults() {
  if (state.memoryResultBusy || getMemoryBattle().resultsPublishedAt) return;
  if (securePilot) return securePilotHostCommand("publishMemory");
  state.memoryResultBusy = true;
  const game = getMemoryBattle();
  const boardKey = memoryBoardKey();
  const currentResults = getCompletedMemoryResults();
  try {
    const recordsPath = ref(db, `memoryRecords/${boardKey}`);
    const beforeSnapshot = await get(recordsPath);
    const beforeMap = beforeSnapshot.val() || {};
    const beforeRanking = sortMemoryRecords(beforeMap);
    const transaction = await runTransaction(recordsPath, (records) => {
      return mergeMemoryBestRecords(records, currentResults, boardKey, game.gameId, getMemoryTrustedNow());
    });
    const afterMap = transaction.snapshot.val() || {};
    const afterRanking = sortMemoryRecords(afterMap);
    const beforeRanks = Object.fromEntries(beforeRanking.map((record, index) => [record.playerId, index + 1]));
    const afterRanks = Object.fromEntries(afterRanking.map((record, index) => [record.playerId, index + 1]));
    const resultInsights = {};
    currentResults.forEach((result) => {
      const previous = beforeMap[result.playerId] || null;
      const savedRecord = afterMap[result.playerId];
      const improved = !previous || compareMemoryRecords(result, previous) < 0;
      resultInsights[result.playerId] = {
        firstRecord: !previous,
        personalBest: Boolean(previous && improved),
        previousTimeMs: previous?.completionTimeMs || null,
        savedTimeMs: improved && previous ? Math.max(0, Number(previous.completionTimeMs) - result.completionTimeMs) : 0,
        beforeRank: beforeRanks[result.playerId] || null,
        afterRank: afterRanks[result.playerId] || null,
        topTenEntry: Number(beforeRanks[result.playerId] || 99) > 10 && Number(afterRanks[result.playerId] || 99) <= 10,
        rankUp: Boolean(beforeRanks[result.playerId] <= 10 && afterRanks[result.playerId] < beforeRanks[result.playerId]),
        allTimeChampion: Boolean(improved && afterRanks[result.playerId] === 1 && savedRecord?.gameId === game.gameId)
      };
    });
    await update(roomRef(state.roomCode), {
      status: "finished",
      finishedAt: serverTimestamp(),
      "memoryBattle/finalResults": currentResults,
      "memoryBattle/hallOfFame": afterRanking.slice(0, 10),
      "memoryBattle/resultInsights": resultInsights,
      "memoryBattle/resultsPublishedAt": serverTimestamp()
    });
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("최종 기록을 반영하지 못했습니다. 다시 시도해 주세요.", "error");
  } finally {
    state.memoryResultBusy = false;
  }
}

function renderMemoryFinalResult(viewName, showTeacherControls, force = false) {
  const game = getMemoryBattle();
  if (securePilot && !state.room.pilotMemoryShowRanking && !showTeacherControls) {
    const result = game.ownResult;
    setView(viewName, `<section class="screen memory-mode"><section class="panel memory-panel result-panel"><h1>메모리 배틀 결과</h1>${result ? `<p>내 기록 <strong>${formatMemoryTime(result.completionTimeMs)}</strong> · ${result.attempts}회</p>` : ""}</section></section>`, null, force);
    return;
  }
  const completed = normalizeFirebaseList(game.finalResults).length ? normalizeFirebaseList(game.finalResults) : getCompletedMemoryResults();
  const hall = normalizeFirebaseList(game.hallOfFame);
  const participants = getMemoryParticipants();
  const completedIds = new Set(completed.map((record) => record.playerId));
  const incomplete = participants.filter((student) => !completedIds.has(student.id));
  const ownInsight = game.resultInsights?.[state.studentId] || {};
  const ownCurrentRank = completed.findIndex((record) => record.playerId === state.studentId) + 1;
  const ownHallRank = hall.findIndex((record) => record.playerId === state.studentId) + 1;
  setView(viewName, `
    <section class="screen memory-mode">
      <div class="status-bar"><div><span class="pill gold">최종 결과</span><h1>${getMemoryBoardSize()}×${getMemoryBoardSize()} 메모리 배틀</h1></div>${showTeacherControls ? `<div class="button-row"><button class="btn success" data-action="memory-restart-same" type="button">같은 이미지로 다시 하기</button><button class="btn ghost" data-action="memory-new-images" type="button">새 이미지로 게임하기</button><button class="btn dark" id="backHomeBtn" type="button">처음으로</button></div>` : ""}</div>
      ${!showTeacherControls && ownCurrentRank ? renderMemoryOwnResult(ownCurrentRank, ownHallRank, completed[ownCurrentRank - 1], ownInsight) : ""}
      <div class="grid-2 memory-results-grid">
        <section class="panel"><p class="eyebrow">이번 게임 결과</p><h2>현재 참가자 순위</h2>${renderMemoryRanking(completed, state.studentId)}${incomplete.length ? `<h3>미완료</h3><div class="tag-list">${incomplete.map((student) => `<span class="tag">${escapeHtml(student.name)}</span>`).join("")}</div>` : ""}${renderMemoryAwards(completed)}</section>
        <section class="panel memory-hall-panel"><p class="eyebrow">장기 기록</p><h2>${getMemoryBoardSize()}×${getMemoryBoardSize()} 역대 TOP 10</h2>${renderMemoryRanking(hall, state.studentId)}</section>
      </div>
    </section>
  `, () => {
    bindMemoryTeacherCommon();
  }, force);
}

function renderMemoryOwnResult(currentRank, hallRank, result, insight) {
  const notices = [];
  if (insight.allTimeChampion) notices.push("새로운 역대 최고 기록!");
  else if (insight.topTenEntry) notices.push(`역대 TOP 10 신규 진입 · ${hallRank}위`);
  if (insight.rankUp) notices.push(`역대 순위 상승 · ${insight.beforeRank}위 → ${insight.afterRank}위`);
  if (insight.personalBest) notices.push(`개인 신기록 · ${formatMemoryTime(insight.savedTimeMs)} 단축`);
  if (insight.firstRecord) notices.push(`첫 ${getMemoryBoardSize()}×${getMemoryBoardSize()} 기록 등록`);
  return `<section class="panel memory-own-result"><p class="eyebrow">내 결과</p><div class="stats"><div class="stat"><span class="muted">이번 게임</span><span class="num">${currentRank}위</span><small>${formatMemoryTime(result.completionTimeMs)}</small></div><div class="stat"><span class="muted">역대 순위</span><span class="num">${hallRank || "TOP 10 밖"}</span></div></div>${notices.length ? `<div class="memory-achievements">${insight.allTimeChampion || insight.personalBest ? renderExperienceArt("memory/memory-record", "experience-record-art") : ""}${notices.map((notice) => `<strong>${escapeHtml(notice)}</strong>`).join("")}</div>` : ""}</section>`;
}

function renderMemoryRanking(records, highlightId = "") {
  if (!records.length) return `<div class="empty">아직 등록된 완료 기록이 없습니다.</div>`;
  return `<div class="ranking-list">${records.map((record, index) => `<div class="ranking-row memory-rank-${index + 1} ${record.playerId === highlightId ? "me" : ""}"><span class="rank-number">${index + 1}위</span><strong>${renderPlaygroundName(record)}</strong><span>${formatMemoryTime(record.completionTimeMs)}${Number.isFinite(Number(record.attempts)) ? ` · ${Number(record.attempts)}회` : ""}</span></div>`).join("")}</div>`;
}

function renderMemoryAwards(records) {
  if (!records.length) return "";
  const fastest = records[0];
  const efficient = records.slice().sort((a, b) => Number(a.attempts) - Number(b.attempts) || compareMemoryRecords(a, b))[0];
  return `<div class="memory-awards"><div class="notice success"><strong>최고 속도</strong><br />${escapeHtml(fastest.playerName)} · ${formatMemoryTime(fastest.completionTimeMs)}</div><div class="notice info"><strong>최소 시도</strong><br />${escapeHtml(efficient.playerName)} · ${Number(efficient.attempts)}회</div></div>`;
}

function renderMemoryRecordsManager(selectedSize) {
  const selectedKey = memoryBoardKey(selectedSize);
  const records = sortMemoryRecords(state.memoryRecordsCache[selectedKey] || {}).slice(0, 10);
  return `<section class="panel memory-record-manager"><div class="status-bar"><div><p class="eyebrow">역대 기록 관리</p><h2>${selectedSize}×${selectedSize} TOP 10</h2></div><button class="btn danger" data-action="memory-clear-records" type="button">${selectedSize}×${selectedSize} 기록 초기화</button></div><div class="segmented">${MEMORY_BOARD_SIZES.map((size) => `<button class="btn ${size === selectedSize ? "primary" : "ghost"}" data-memory-record-size="${size}" type="button">${size}×${size}</button>`).join("")}</div>${renderMemoryRanking(records)}</section>`;
}

function toggleMemoryRecords() {
  state.memoryRecordsVisible = !state.memoryRecordsVisible;
  renderMemoryTeacherDashboard(true);
}

async function clearSelectedMemoryRecords() {
  const size = normalizeMemoryBoardSize(state.memorySettingsDraft?.boardSize);
  if (!window.confirm(`${size}×${size} 역대 기록을 모두 삭제할까요?\n삭제한 기록은 복구할 수 없습니다.`)) return;
  if (!window.confirm("정말 기록을 삭제할까요?")) return;
  if (securePilot) return securePilotHostCommand("clearMemoryHistory", { boardSize: size, confirmed: true });
  try {
    await remove(ref(db, `memoryRecords/${memoryBoardKey(size)}`));
    showToast(`${size}×${size} 역대 기록을 초기화했습니다.`, "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("역대 기록을 삭제하지 못했습니다.", "error");
  }
}

async function restartMemoryGameWithSameImages() {
  if (securePilot) return securePilotHostCommand("restartMemory");
  const game = getMemoryBattle();
  const images = getMemoryImageDefinitions(game);
  const imageSetId = String(game.imageSetId || "");
  const participants = getStudents().filter((student) => student.connected);
  if (!imageSetId || !images.length || !participants.length) {
    showToast("이미지와 접속 학생을 확인해 주세요.", "error");
    return;
  }
  const oldGameId = game.gameId;
  const gameId = `memory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await writeNewMemorySession({ gameId, imageSetId, boardSize: getMemoryBoardSize(), imageList: images, participants });
    if (oldGameId) await remove(ref(db, `memoryPrivate/${state.roomCode}/${oldGameId}`));
    showToast("같은 이미지로 새 게임을 만들었습니다. 카드 위치는 다시 섞였습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("새 게임을 만들지 못했습니다.", "error");
  }
}

async function configureMemoryGameWithNewImages() {
  if (!window.confirm("현재 게임 이미지를 정리하고 새 이미지 설정으로 돌아갈까요? 역대 기록은 유지됩니다.")) return;
  if (securePilot) {
    state.memorySettingsDraft = { boardSize: getMemoryBoardSize() };
    const result = await securePilotHostCommand("resetMemory", { confirmed: true });
    if (!result?.error) clearMemoryImageDraft();
    return;
  }
  const oldGame = getMemoryBattle();
  try {
    await update(roomRef(state.roomCode), { status: "waiting", memoryBattle: getInitialMemoryBattleStateForWrite(getMemoryBoardSize()), finishedAt: null });
    if (oldGame.gameId) await remove(ref(db, `memoryPrivate/${state.roomCode}/${oldGame.gameId}`));
    await cleanupMemoryImageSet(oldGame.imageSetId);
    state.memorySettingsDraft = { boardSize: getMemoryBoardSize() };
    clearMemoryImageDraft();
    showToast("새 이미지 게임 설정으로 돌아왔습니다. 역대 기록은 유지됩니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("새 이미지 설정으로 이동하지 못했습니다.", "error");
  }
}

async function cleanupMemoryImageSet(imageSetId = getMemoryBattle().imageSetId) {
  if (!db || !imageSetId) return;
  await remove(ref(db, `memoryImages/${state.roomCode}/${imageSetId}`));
}

function renderMemoryDisplay(force = false) {
  const status = state.room?.status || "waiting";
  const game = getMemoryBattle();
  const participants = getMemoryParticipants();
  const ready = game.readyCount ?? participants.filter((student) => getMemoryPlayerSummaries()[student.id]?.ready).length;
  const participantCount = getMemoryParticipantCount();
  const completed = getMemoryCompletedCount();
  let body = "";
  let afterRender = null;
  if (status === "finished") {
    body = `<div class="grid-2 memory-results-grid"><section class="panel"><p class="eyebrow">이번 게임 결과</p>${renderMemoryRanking(normalizeFirebaseList(game.finalResults))}</section><section class="panel"><p class="eyebrow">${getMemoryBoardSize()}×${getMemoryBoardSize()} 역대 TOP 10</p>${renderMemoryRanking(normalizeFirebaseList(game.hallOfFame))}</section></div>`;
  } else if (status === "memoryCountdown") {
    body = `<section class="panel memory-panel result-panel"><p class="eyebrow">카드 위치 공개</p><div class="memory-countdown-number" id="memoryCountdownNumber">4</div><h1>각자 카드 위치를 기억하세요!</h1></section>`;
    afterRender = () => startMemoryCountdownTicker(Number(game.gameStartedAt || getMemoryTrustedNow() + getUxMemoryPreviewSeconds() * 1000));
  } else if (status === "memoryPlaying" || status === "memoryAwaitingResults") {
    body = `<section class="panel memory-panel result-panel stage-memory-progress"><span class="pill ${status === "memoryPlaying" ? "green" : "gold"}">${status === "memoryPlaying" ? "게임 진행 중" : "결과 공개 대기"}</span><h1>완료 ${completed} / ${participantCount}명</h1>${renderExperienceProgress("참가자 진행", completed, participantCount)}</section>`;
  } else if (status === "memoryReady") {
    body = `<section class="panel memory-panel result-panel"><span class="pill blue">${getMemoryBoardSize()}×${getMemoryBoardSize()}</span><h1>게임 준비</h1><div class="stats"><div class="stat"><span class="muted">이미지 준비 완료</span><span class="num">${ready} / ${participantCount}</span></div><div class="stat"><span class="muted">카드</span><span class="num">${getMemoryBoardSize() ** 2}장</span></div></div></section>`;
  } else {
    body = `<section class="panel memory-panel result-panel"><h1>메모리 배틀을 준비 중입니다.</h1><p class="lead">방 코드 ${escapeHtml(state.roomCode)}</p></section>`;
  }
  renderDisplayShell(`display-memory-${status}-${game.gameId || "setup"}`, "메모리 배틀", "카드의 위치를 기억하고 모든 이미지 짝을 가장 빠르게 찾아라!", body, afterRender, force);
}

// =========================
// 개념 빙고
// =========================

function getInitialBingoStateForWrite(size = DEFAULT_BINGO_SIZE) {
  return {
    settings: { size: clampInt(size, MIN_BINGO_SIZE, MAX_BINGO_SIZE, DEFAULT_BINGO_SIZE) },
    gameId: "",
    boards: null,
    turnOrder: null,
    currentTurnIndex: 0,
    currentCall: null,
    calls: null,
    claims: null,
    winners: null,
    startedAt: null,
    finishedAt: null
  };
}

function getBingoState() {
  return {
    ...getInitialBingoStateForWrite(),
    ...(state.room?.bingo || {}),
    settings: {
      ...getInitialBingoStateForWrite().settings,
      ...(state.room?.bingo?.settings || {})
    }
  };
}

function getBingoSize() {
  return clampInt(getBingoState().settings?.size, MIN_BINGO_SIZE, MAX_BINGO_SIZE, DEFAULT_BINGO_SIZE);
}

function normalizeBingoCells(value, size = getBingoSize()) {
  const source = Array.isArray(value)
    ? value
    : Object.keys(value || {}).sort((a, b) => Number(a) - Number(b)).map((key) => value[key]);
  return Array.from({ length: size * size }, (_, index) => cleanText(source[index] || ""));
}

function normalizeBingoMarks(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, marked]) => Boolean(marked)).map(([index]) => [String(index), true]));
}

function getBingoBoards() {
  const size = getBingoSize();
  return Object.entries(getBingoState().boards || {})
    .map(([studentId, board]) => ({
      studentId,
      name: cleanText(board?.name || getStudentNameById(studentId)),
      size: clampInt(board?.size, MIN_BINGO_SIZE, MAX_BINGO_SIZE, size),
      cells: normalizeBingoCells(board?.cells, size),
      marks: normalizeBingoMarks(board?.marks),
      submittedAt: Number(board?.submittedAt || 0),
      updatedAt: Number(board?.updatedAt || 0)
    }))
    .filter((board) => board.size === size && board.cells.length === size * size && board.cells.every(Boolean))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
}

function getMyBingoBoard() {
  return getBingoBoards().find((board) => board.studentId === state.studentId) || null;
}

function getBingoTurnOrder() {
  return normalizeIndexedList(getBingoState().turnOrder);
}

function getCurrentBingoTurnStudent() {
  const order = getBingoTurnOrder();
  if (!order.length) return null;
  const index = Math.max(0, Number(getBingoState().currentTurnIndex || 0)) % order.length;
  const studentId = order[index];
  const board = getBingoBoards().find((item) => item.studentId === studentId);
  return board ? { id: studentId, name: board.name } : { id: studentId, name: getStudentNameById(studentId) };
}

function getBingoWinners() {
  return Object.entries(getBingoState().winners || {})
    .map(([studentId, winner]) => ({ studentId, ...winner, rank: Number(winner.rank || 0) }))
    .sort((a, b) => a.rank - b.rank || Number(a.approvedAt || 0) - Number(b.approvedAt || 0));
}

function countBingoLines(board) {
  return getCompletedBingoLines(board).length;
}

function getCompletedBingoLines(board) {
  if (!board) return [];
  const size = board.size || getBingoSize();
  const marked = (index) => Boolean(board.marks?.[String(index)] || board.marks?.[index]);
  const lines = [];
  for (let row = 0; row < size; row += 1) {
    lines.push(Array.from({ length: size }, (_, column) => row * size + column));
  }
  for (let column = 0; column < size; column += 1) {
    lines.push(Array.from({ length: size }, (_, row) => row * size + column));
  }
  lines.push(Array.from({ length: size }, (_, index) => index * size + index));
  lines.push(Array.from({ length: size }, (_, index) => index * size + (size - index - 1)));
  return lines.filter((line) => line.every(marked));
}

function renderBingoStudentRoute() {
  const status = state.room?.status || "waiting";
  if (status === "finished") {
    renderBingoFinalResult("student-bingo-final", false, true);
    return;
  }
  if (status === "bingoPlaying") {
    renderBingoStudentPlay(false);
    return;
  }
  renderBingoStudentForm(false);
}

function renderBingoStudentForm(force = false) {
  const size = getBingoSize();
  const board = getMyBingoBoard();
  const values = board?.cells || Array(size * size).fill("");
  const view = `student-bingo-form-${size}-${Boolean(board)}`;
  const concepts = getUxBingoConcepts();
  if (!force && state.activeView === view) {
    setPlaygroundText("#studioBingoSubmitted", `${getBingoBoards().length}명 제출`);
    const fill = document.querySelector("#uxBingoFill");
    if (fill) {
      fill.parentElement.hidden = !concepts.length;
      fill.disabled = concepts.length < size * size;
    }
    return;
  }
  setView(view, `
    <section class="screen bingo-mode studio-preparation studio-maker" data-studio-variant="bingo-${size}">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
        <span class="pill ${board ? "green" : "gold"}">${board ? "빙고판 제출 완료" : `${size}×${size} 작성 중`}</span>
      </div>
      ${renderStudioHeading("PLAY STUDIO", "빙고판 만들기", "creators/bingo-creator", `<p class="muted">${size}×${size} · 각 칸에 서로 다른 개념을 적으세요.</p>`)}
      <form id="bingoBoardForm" class="panel studio-editor">
        <div class="status-bar"><h2>내 빙고판</h2><span class="pill gold" id="studioBingoFilled"></span></div>
        <div class="button-row" ${concepts.length ? "" : "hidden"}><button class="btn ghost" id="uxBingoFill" type="button" ${concepts.length >= size * size ? "" : "disabled"}>${uxIcon("shuffle")}교사 개념 목록으로 채우기</button></div>
        <div class="bingo-entry-grid" style="--bingo-size:${size}">
          ${values.map((value, index) => `
            <label class="bingo-entry-cell">
              <span>${index + 1}</span>
              <input data-bingo-entry="${index}" maxlength="40" value="${escapeAttr(value)}" aria-label="${index + 1}번 칸 개념" placeholder="개념" required />
            </label>
          `).join("")}
        </div>
        <button class="btn primary full" type="submit">${board ? "빙고판 수정 저장" : "빙고판 제출"}</button>
      </form>
      <div class="notice info"><strong id="studioBingoSubmitted">${getBingoBoards().length}명 제출</strong> · 게임 시작 전까지 수정할 수 있습니다.</div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome);
    const form = document.querySelector("#bingoBoardForm");
    bindStudioSubmit(form, submitBingoBoard);
    document.querySelector("#uxBingoFill")?.addEventListener("click", () => fillUxBingoBoard(form));
    form.addEventListener("input", () => updateStudioBingoProgress(form));
    updateStudioBingoProgress(form);
  }, force);
}

function renderBingoStudentPlay(force = false) {
  const game = getBingoState();
  const board = getMyBingoBoard();
  const currentStudent = getCurrentBingoTurnStudent();
  const call = game.currentCall || null;
  const approved = Boolean(call?.approvedAt);
  const isMyTurn = currentStudent?.id === state.studentId;
  const claim = game.claims?.[state.studentId] || null;
  const winner = game.winners?.[state.studentId] || null;
  if (!board) {
    setView("student-bingo-no-board", `<section class="screen bingo-mode"><div class="panel"><h2>이번 게임에 제출된 내 빙고판이 없습니다.</h2><p class="lead">다음 게임을 기다려 주세요.</p></div></section>`);
    return;
  }
  const marksKey = Object.keys(board.marks).sort((a, b) => Number(a) - Number(b)).join("-");
  const viewName = `student-bingo-play-${game.gameId}-${game.currentTurnIndex}-${call?.callId || "none"}-${approved}-${marksKey}-${Boolean(claim)}-${Boolean(winner)}`;
  setView(viewName, `
    <section class="screen bingo-mode experience-bingo">
      <div class="status-bar">
        <div><p class="eyebrow">현재 차례</p><h1>${escapeHtml(currentStudent?.name || "-")}</h1></div>
        <span class="pill blue">${Number(game.currentTurnIndex || 0) + 1} / ${getBingoTurnOrder().length}</span>
        <span class="pill green">완성 ${countBingoLines(board)}빙고</span>
      </div>
      <div class="experience-bingo-layout"><div class="experience-bingo-turn">
      ${renderBingoCurrentCall(call, currentStudent)}
      ${!call && isMyTurn ? `
        <form id="bingoCallForm" class="panel bingo-call-form">
          <h2>개념을 말하고 설명을 적어 주세요.</h2>
          <div class="field"><label for="bingoConceptInput">개념</label><input id="bingoConceptInput" maxlength="60" value="${escapeAttr(state.bingoConceptDraft)}" placeholder="예: 은유" required /></div>
          <div class="field"><label for="bingoExplanationInput">개념 설명</label><textarea id="bingoExplanationInput" maxlength="300" placeholder="친구들이 이해할 수 있도록 뜻이나 예를 설명하세요." required>${escapeHtml(state.bingoExplanationDraft)}</textarea></div>
          <button class="btn primary" type="submit">설명 제출</button>
        </form>
      ` : ""}
      ${!call && !isMyTurn ? `<div class="notice info">${escapeHtml(currentStudent?.name || "차례 학생")} 학생이 개념과 설명을 제출할 때까지 기다려 주세요.</div>` : ""}
      ${call && !approved ? `<div class="notice warn">선생님이 설명을 확인하고 있습니다. 승인 후 색칠할 수 있습니다.</div>` : ""}
      ${approved ? `<div class="notice success">설명이 승인되었습니다. 같은 개념이나 관련 표현이 적힌 칸을 스스로 색칠하세요.</div>` : ""}
      ${renderFinalApprovedBingoCalls(game)}
      <details class="panel"><summary>차례 순서</summary>${renderBingoTurnOrder()}</details></div>
      <section class="panel bingo-board-panel">
        <div class="status-bar"><h2>내 빙고판</h2><span class="pill ${winner ? "gold" : claim ? "blue" : "green"}">${winner ? `${winner.rank}번째 빙고 인정` : claim ? "빙고 확인 요청 중" : `${countBingoLines(board)}줄 완성`}</span></div>
        ${winner ? `<div class="experience-bingo-award">${renderExperienceArt("bingo/bingo-complete", "experience-stamp")}<strong>빙고가 인정되었습니다</strong></div>` : ""}
        ${renderBingoBoard(board, { interactive: !winner, allowMark: approved })}
        <p class="muted small">색칠된 칸을 다시 누르면 언제든 취소할 수 있습니다.</p>
        ${countBingoLines(board) > 0 && !claim && !winner ? `<button class="btn success" id="claimBingoBtn" type="button">빙고 외치기</button>` : ""}
      </section>
      </div>
    </section>
  `, () => {
    const conceptInput = document.querySelector("#bingoConceptInput");
    const explanationInput = document.querySelector("#bingoExplanationInput");
    conceptInput?.addEventListener("input", () => { state.bingoConceptDraft = conceptInput.value; });
    explanationInput?.addEventListener("input", () => { state.bingoExplanationDraft = explanationInput.value; });
    document.querySelector("#bingoCallForm")?.addEventListener("submit", submitBingoCall);
    document.querySelectorAll("[data-bingo-cell]").forEach((button) => button.addEventListener("click", () => toggleBingoCell(Number(button.dataset.bingoCell))));
    document.querySelector("#claimBingoBtn")?.addEventListener("click", claimBingo);
  }, force);
}

function renderBingoTeacherDashboard(force = true) {
  const status = state.room?.status || "waiting";
  if (status === "finished") {
    renderBingoFinalResult("teacher-bingo-final", true, force);
    return;
  }
  const boards = getBingoBoards();
  const game = getBingoState();
  const currentStudent = getCurrentBingoTurnStudent();
  const call = game.currentCall || null;
  const claims = Object.entries(game.claims || {});
  setView(`teacher-bingo-${status}-${boards.length}-${game.currentTurnIndex}-${call?.callId || "none"}-${Boolean(call?.approvedAt)}-${getBingoWinners().length}-${claims.length}`, `
    <section class="screen bingo-mode">
      <div class="status-bar">
        <div><p class="eyebrow">교사 화면</p><h1>개념 빙고</h1></div>
        <div class="button-row"><span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span><button class="btn ghost" id="copyRoomCodeBtn" type="button">방 코드 ${escapeHtml(state.roomCode)}</button><button class="btn dark" data-action="open-display" type="button">교실 화면 팝업</button><button class="btn ghost" id="backHomeBtn" type="button">처음으로</button></div>
      </div>
      <div class="teacher-grid">
        <aside class="panel">
          ${renderTeacherModeControls()}
          ${status === "waiting" ? `
            <section class="panel tight">
              <h2>빙고 설정</h2>
              <div class="field"><label for="bingoSizeInput">빙고판 크기 N×N</label><input id="bingoSizeInput" type="number" min="${MIN_BINGO_SIZE}" max="${MAX_BINGO_SIZE}" value="${getBingoSize()}" /></div>
              <div class="field"><label for="uxBingoConcepts">자동 채우기에 사용할 개념 (한 줄에 하나)</label><textarea id="uxBingoConcepts" maxlength="3300" rows="5">${escapeHtml(getUxBingoConcepts().join("\n"))}</textarea></div>
              <button class="btn primary" data-action="bingo-save-settings" type="button">설정 저장</button>
              <p class="muted small">크기를 바꾸면 이미 제출된 빙고판은 초기화됩니다.</p>
            </section>
            <button class="btn success full" data-action="bingo-start" type="button" ${boards.length ? "" : "disabled"}>${boards.length}명으로 게임 시작</button>
          ` : `
            <section class="panel tight">
              <p class="eyebrow">현재 차례</p><h2>${escapeHtml(currentStudent?.name || "-")}</h2>
              ${renderBingoCurrentCall(call, currentStudent)}
              ${renderFinalApprovedBingoCalls(game)}
              <div class="button-row">
                <button class="btn success" data-action="bingo-approve-call" type="button" ${call && !call.approvedAt ? "" : "disabled"}>설명 승인</button>
                <button class="btn danger" data-action="bingo-reject-call" type="button" ${call && !call.approvedAt ? "" : "disabled"}>다시 설명</button>
                <button class="btn primary" data-action="bingo-next-turn" type="button" ${call?.approvedAt ? "" : "disabled"}>색칠 완료 · 다음 차례</button>
                <button class="btn ghost" data-action="bingo-skip-turn" type="button">차례 건너뛰기</button>
              </div>
            </section>
            <section class="panel tight"><h3>차례 순서</h3>${renderBingoTurnOrder()}</section>
          `}
          ${claims.length ? `<section class="panel tight"><h3>빙고 확인 요청</h3>${claims.map(([studentId, claim]) => `<div class="list-row split"><strong>${escapeHtml(claim.name || getStudentNameById(studentId))} · ${Number(claim.lineCount || 0)}빙고</strong><div class="button-row"><button class="btn success" data-bingo-approve-claim="${escapeAttr(studentId)}" type="button">인정</button><button class="btn danger" data-bingo-reject-claim="${escapeAttr(studentId)}" type="button">반려</button></div></div>`).join("")}</section>` : ""}
          ${getBingoWinners().length ? `<section class="panel tight"><h3>인정된 빙고</h3>${renderBingoWinners()}</section>` : ""}
          <div class="button-row"><button class="btn danger" data-action="reset" type="button">게임 초기화</button><button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button>${status === "bingoPlaying" ? `<button class="btn dark" data-action="bingo-finish" type="button">게임 종료</button>` : ""}</div>
        </aside>
        <div class="screen">
          <section class="panel"><div class="status-bar"><div><h2>학생 빙고판 실시간 확인</h2><p class="muted">색칠된 칸을 누르면 교사가 색칠을 취소할 수 있습니다.</p></div><span class="pill blue">제출 ${boards.length}명</span></div></section>
          <div class="bingo-board-gallery">${boards.length ? boards.map((board) => renderBingoTeacherBoard(board, status === "bingoPlaying")).join("") : `<div class="empty">학생들이 빙고판을 제출하면 여기에 표시됩니다.</div>`}</div>
        </div>
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome);
    document.querySelector("#copyRoomCodeBtn")?.addEventListener("click", copyRoomCode);
    document.querySelectorAll("[data-switch-mode]").forEach((button) => button.addEventListener("click", () => switchRoomMode(button.dataset.switchMode)));
    document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleTeacherAction(button.dataset.action)));
    document.querySelectorAll("[data-bingo-teacher-unmark]").forEach((button) => button.addEventListener("click", () => teacherUnmarkBingoCell(button.dataset.bingoStudent, Number(button.dataset.bingoTeacherUnmark))));
    document.querySelectorAll("[data-bingo-approve-claim]").forEach((button) => button.addEventListener("click", () => approveBingoClaim(button.dataset.bingoApproveClaim)));
    document.querySelectorAll("[data-bingo-reject-claim]").forEach((button) => button.addEventListener("click", () => rejectBingoClaim(button.dataset.bingoRejectClaim)));
  }, force);
}

function renderBingoBoard(board, { interactive = false, allowMark = false, teacher = false } = {}) {
  const size = board.size || getBingoSize();
  const completedCells = new Set(getCompletedBingoLines(board).flat());
  return `<div class="bingo-board" style="--bingo-size:${size}">${board.cells.map((cell, index) => {
    const marked = Boolean(board.marks?.[String(index)]);
    const enabled = interactive && (allowMark || marked);
    const teacherAction = teacher && marked;
    return `<button class="bingo-cell ${marked ? "is-marked" : ""} ${completedCells.has(index) ? "is-line" : ""}" type="button" aria-pressed="${marked}" ${enabled ? `data-bingo-cell="${index}"` : ""} ${teacherAction ? `data-bingo-teacher-unmark="${index}" data-bingo-student="${escapeAttr(board.studentId)}"` : ""} ${enabled || teacherAction ? "" : "disabled"}><span>${escapeHtml(cell)}</span>${marked ? `<strong aria-hidden="true">✓</strong>` : ""}</button>`;
  }).join("")}</div>`;
}

function renderBingoTeacherBoard(board, canUnmark) {
  return `<article class="bingo-board-card"><div class="status-bar"><h3>${escapeHtml(board.name)}</h3><span class="pill ${countBingoLines(board) ? "green" : "blue"}">${countBingoLines(board)}빙고</span></div>${renderBingoBoard(board, { teacher: canUnmark })}</article>`;
}

function renderBingoCurrentCall(call, currentStudent) {
  if (!call) return `<div class="notice info">${escapeHtml(currentStudent?.name || "차례 학생")} 학생이 설명할 개념을 준비하고 있습니다.</div>`;
  if (securePilot && !call.approvedAt && !call.concept) return '<div class="notice warn">선생님이 설명을 확인하고 있습니다.</div>';
  return `<section class="panel bingo-call-card"><div class="status-bar"><div><p class="eyebrow">${call.approvedAt ? "설명 승인 완료" : "설명 확인 대기"}</p><h2>${escapeHtml(call.concept || "")}</h2></div>${call.approvedAt ? renderExperienceArt("bingo/bingo-stamp", "experience-stamp") : ""}<span class="pill ${call.approvedAt ? "green" : "gold"}">${call.approvedAt ? "색칠 가능" : "교사 확인 중"}</span></div><p class="lead">${escapeHtml(call.explanation || "")}</p><p class="muted small">발표: ${escapeHtml(call.name || currentStudent?.name || "")}</p></section>`;
}

function renderBingoTurnOrder() {
  const order = getBingoTurnOrder();
  const currentIndex = Number(getBingoState().currentTurnIndex || 0);
  if (!order.length) return `<div class="empty">게임을 시작하면 순서가 정해집니다.</div>`;
  return `<div class="tag-list">${order.map((studentId, index) => `<span class="tag ${index === currentIndex ? "active" : ""}">${index + 1}. ${escapeHtml(getBingoBoards().find((board) => board.studentId === studentId)?.name || getStudentNameById(studentId))}</span>`).join("")}</div>`;
}

function renderBingoWinners() {
  const winners = getBingoWinners();
  if (!winners.length) return `<div class="empty">아직 교사가 인정한 빙고가 없습니다.</div>`;
  return `<div class="ranking">${winners.map((winner) => `<div class="ranking-row rank-${winner.rank}"><span class="rank-medal">${winner.rank}</span><strong>${renderPlaygroundName(winner, winner.name || getStudentNameById(winner.studentId))}</strong><span class="score">${Number(winner.lineCount || 0)}빙고</span></div>`).join("")}</div>`;
}

function renderBingoDisplay(force = false) {
  const status = state.room?.status || "waiting";
  const game = getBingoState();
  const currentStudent = getCurrentBingoTurnStudent();
  const call = game.currentCall || null;
  let body = "";
  if (status === "finished") {
    body = `<section class="panel"><h2>빙고 결과</h2>${renderBingoWinners()}</section>`;
  } else if (status === "bingoPlaying") {
    body = `<section class="panel bingo-call-card"><p class="eyebrow">현재 차례</p><h1>${escapeHtml(currentStudent?.name || "-")}</h1>${renderBingoCurrentCall(call, currentStudent)}</section>${getBingoWinners().length ? `<section class="panel"><h2>인정된 빙고</h2>${renderBingoWinners()}</section>` : ""}`;
  } else {
    const submitted = securePilot ? game.boardCount ?? 0 : getBingoBoards().length;
    const participants = state.room.pilotStudentCount ?? getStudents().filter((student) => student.connected).length;
    body = `<section class="panel result-panel"><p class="eyebrow">${getBingoSize()}×${getBingoSize()} 개념 빙고</p><h1>빙고판 작성 중</h1><div class="stats"><div class="stat"><span class="muted">제출 완료</span><span class="num">${submitted}명</span></div><div class="stat"><span class="muted">${securePilot ? "참가 학생" : "접속 학생"}</span><span class="num">${participants}명</span></div></div></section>`;
  }
  renderDisplayShell(`display-bingo-${status}-${game.gameId || "setup"}-${game.currentTurnIndex}-${call?.callId || "none"}-${Boolean(call?.approvedAt)}-${getBingoWinners().length}`, "개념 빙고", "개념을 정확히 설명하고 관련 칸을 색칠하세요.", body, null, force);
}

function renderBingoFinalResult(viewName, showTeacherControls, force = false) {
  setView(viewName, `<section class="screen bingo-mode"><div class="status-bar"><div><p class="eyebrow">개념 빙고 종료</p><h1>최종 결과</h1></div><span class="pill gold">빙고 완료</span></div><section class="panel">${renderBingoWinners()}</section>${showTeacherControls ? `<div class="button-row"><button class="btn success" data-action="reset" type="button">같은 빙고판으로 다시 하기</button><button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button></div>` : `<div class="notice info">선생님이 다음 게임을 준비할 때까지 기다려 주세요.</div>`}</section>`, () => {
    document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleTeacherAction(button.dataset.action)));
  }, force);
}

async function submitBingoBoard(event) {
  event.preventDefault();
  if ((state.room?.status || "waiting") !== "waiting") return showToast("게임 시작 후에는 빙고판을 수정할 수 없습니다.", "error");
  const size = getBingoSize();
  const cells = Array.from(document.querySelectorAll("[data-bingo-entry]")).sort((a, b) => Number(a.dataset.bingoEntry) - Number(b.dataset.bingoEntry)).map((input) => cleanText(input.value));
  if (cells.length !== size * size || cells.some((cell) => !cell)) return showToast(`${size * size}칸을 모두 입력해 주세요.`, "error");
  if (new Set(cells.map((cell) => normalizeShortAnswer(cell))).size !== cells.length) return showToast("같은 개념을 중복해서 쓸 수 없습니다.", "error");
  if (securePilot) {
    const result = await securePilot.send("submitBingoBoard", { size, cells });
    if (result.error) return showToast(securePilotError(result.error), "error");
    showToast("빙고판을 제출했습니다.", "success");
    return true;
  }
  const { roomCode, studentId, studentGeneration: generation } = state;
  try {
    const result = await runAccessCommand(roomCode, (room) => {
      const student = room.students?.[studentId];
      if (!student || student.removedAt || room.accessClosed || getRoomGeneration(room) !== generation) return { error: "session" };
      if ((room.gameVariant || room.mode) !== "bingo" || (room.status || "waiting") !== "waiting"
        || clampInt(room.bingo?.settings?.size, MIN_BINGO_SIZE, MAX_BINGO_SIZE, DEFAULT_BINGO_SIZE) !== size) return { error: "phase" };
      room.bingo ||= getInitialBingoStateForWrite(size);
      room.bingo.boards ||= {};
      room.bingo.boards[studentId] = { studentId, name: student.name, size, cells, marks: null,
        submittedAt: room.bingo.boards[studentId]?.submittedAt || serverTimestamp(), updatedAt: serverTimestamp() };
      return { room };
    });
    if (result.error) return showToast(accessErrorMessage(result.error), "error");
    showToast("빙고판을 제출했습니다.", "success");
    if (state.role === "student" && state.roomCode === roomCode && state.studentId === studentId) renderBingoStudentRoute(true);
    return true;
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("빙고판을 저장하지 못했습니다.", "error");
  }
}

async function saveBingoSettings() {
  if ((state.room?.status || "waiting") !== "waiting") return;
  const size = clampInt(document.querySelector("#bingoSizeInput")?.value, MIN_BINGO_SIZE, MAX_BINGO_SIZE, getBingoSize());
  const beforeSize = getBingoSize();
  const boardCount = getBingoBoards().length;
  if (size !== beforeSize && boardCount && !window.confirm("크기를 바꾸면 학생들이 제출한 빙고판이 모두 지워집니다. 계속할까요?")) return;
  const concepts = parseUxBingoConcepts(document.querySelector("#uxBingoConcepts")?.value || "");
  if (concepts.some((item) => item.length > 40) || concepts.length > 80) return showToast("개념은 한 줄에 40자 이내, 최대 80개까지 입력해 주세요.", "error");
  if (securePilot) return securePilotHostCommand("bingoSettings", { size, concepts, boardCount, confirmed: size !== beforeSize });
  const generation = getRoomGeneration(state.room);
  try {
    const result = await runAccessCommand(state.roomCode, (room) => {
      const currentSize = clampInt(room.bingo?.settings?.size, MIN_BINGO_SIZE, MAX_BINGO_SIZE, DEFAULT_BINGO_SIZE);
      if (!hasRoomHostAccess(room) || getRoomGeneration(room) !== generation || room.accessClosed || (room.gameVariant || room.mode) !== "bingo"
        || (room.status || "waiting") !== "waiting" || currentSize !== beforeSize) return { error: "phase" };
      if (size !== beforeSize && Object.keys(room.bingo?.boards || {}).length !== boardCount) return { error: "conflict" };
      if (!room.bingo || size !== beforeSize) room.bingo = getInitialBingoStateForWrite(size);
      room.bingo.settings = { ...room.bingo.settings, size, concepts: concepts.length ? concepts : null };
      return { room };
    });
    if (result.error) return showToast(accessErrorMessage(result.error), "error");
    showToast(`${size}×${size} 빙고판으로 설정했습니다.`, "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("빙고 설정을 저장하지 못했습니다.", "error");
  }
}

function parseUxBingoConcepts(input) {
  const unique = new Map();
  for (const line of String(input).split(/\r?\n/)) {
    const value = cleanText(line);
    const key = normalizeShortAnswer(value);
    if (key && !unique.has(key)) unique.set(key, value);
  }
  return [...unique.values()];
}

function getUxBingoConcepts() {
  return normalizeFirebaseList(getBingoState().settings.concepts).filter((value) => typeof value === "string").slice(0, 80);
}

function fillUxBingoBoard(form) {
  const fields = [...form.querySelectorAll("[data-bingo-entry]")];
  const concepts = getUxBingoConcepts();
  if (concepts.length < fields.length) return;
  if (fields.some((field) => field.value.trim()) && !window.confirm("현재 작성한 칸을 교사의 개념 목록으로 바꿀까요?")) return;
  const shuffled = shuffleArray(concepts);
  fields.forEach((field, index) => { field.value = shuffled[index]; });
  fields[0]?.dispatchEvent(new Event("input", { bubbles: true }));
}

async function startBingoGame() {
  const boards = getBingoBoards();
  if (!boards.length) return showToast("제출된 빙고판이 없습니다.", "error");
  const gameId = `bingo_${Date.now()}`;
  const turnOrder = shuffleArray(boards.map((board) => board.studentId));
  const updates = { status: "bingoPlaying", "bingo/gameId": gameId, "bingo/turnOrder": turnOrder, "bingo/currentTurnIndex": 0, "bingo/currentCall": null, "bingo/calls": null, "bingo/claims": null, "bingo/winners": null, "bingo/startedAt": serverTimestamp(), "bingo/finishedAt": null };
  boards.forEach((board) => { updates[`bingo/boards/${board.studentId}/marks`] = null; });
  try {
    openDisplayWindow({ silent: true });
    await update(roomRef(state.roomCode), updates);
    showToast("차례를 섞어 개념 빙고를 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("빙고 게임을 시작하지 못했습니다.", "error");
  }
}

async function submitBingoCall(event) {
  event.preventDefault();
  const currentStudent = getCurrentBingoTurnStudent();
  if (state.room?.status !== "bingoPlaying" || currentStudent?.id !== state.studentId || getBingoState().currentCall) return showToast("지금은 설명을 제출할 차례가 아닙니다.", "error");
  const concept = cleanText(document.querySelector("#bingoConceptInput")?.value || state.bingoConceptDraft);
  const explanation = cleanText(document.querySelector("#bingoExplanationInput")?.value || state.bingoExplanationDraft);
  if (!concept || !explanation) return showToast("개념과 설명을 모두 입력해 주세요.", "error");
  if (securePilot) {
    const result = await securePilot.send("submitBingoCall", { concept, explanation });
    if (result.error) return showToast(securePilotError(result.error), "error");
    state.bingoConceptDraft = "";
    state.bingoExplanationDraft = "";
    return;
  }
  const callId = `${getBingoState().gameId}_${Number(getBingoState().currentTurnIndex || 0)}_${Date.now()}`;
  try {
    await set(ref(db, `rooms/${state.roomCode}/bingo/currentCall`), { callId, studentId: state.studentId, name: state.studentName, concept, explanation, submittedAt: serverTimestamp(), approvedAt: null });
    state.bingoConceptDraft = "";
    state.bingoExplanationDraft = "";
    showToast("설명을 제출했습니다. 선생님의 확인을 기다려 주세요.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("설명을 제출하지 못했습니다.", "error");
  }
}

async function approveBingoCall() {
  const call = getBingoState().currentCall;
  if (!call || call.approvedAt) return;
  const approvedAt = Date.now();
  try {
    await update(roomRef(state.roomCode), { "bingo/currentCall/approvedAt": approvedAt, [`bingo/calls/${call.callId}`]: { ...call, approvedAt } });
    showToast("설명을 승인했습니다. 학생들이 색칠할 수 있습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("설명을 승인하지 못했습니다.", "error");
  }
}

async function rejectBingoCall() {
  if (!getBingoState().currentCall) return;
  try {
    await update(roomRef(state.roomCode), { "bingo/currentCall": null });
    showToast("다시 설명하도록 요청했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("설명 요청을 되돌리지 못했습니다.", "error");
  }
}

async function nextBingoTurn({ skip = false } = {}) {
  const game = getBingoState();
  const order = getBingoTurnOrder();
  if (!order.length) return;
  if (!skip && !game.currentCall?.approvedAt) return showToast("설명을 승인한 뒤 다음 차례로 이동해 주세요.", "error");
  if (skip && !window.confirm("현재 차례를 건너뛸까요?")) return;
  if (securePilot) return securePilotHostCommand("bingoNextTurn", { skip });
  try {
    await update(roomRef(state.roomCode), { "bingo/currentTurnIndex": (Number(game.currentTurnIndex || 0) + 1) % order.length, "bingo/currentCall": null });
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("다음 차례로 이동하지 못했습니다.", "error");
  }
}

async function toggleBingoCell(index) {
  const board = getMyBingoBoard();
  if (!board || state.room?.status !== "bingoPlaying" || index < 0 || index >= board.cells.length) return;
  const marked = Boolean(board.marks?.[String(index)]);
  if (!marked && !getBingoState().currentCall?.approvedAt) return showToast("선생님이 설명을 승인한 뒤 색칠할 수 있습니다.", "error");
  if (securePilot) {
    const result = await securePilot.send("setBingoMark", { index, marked: !marked });
    if (result.error) showToast(securePilotError(result.error), "error");
    return;
  }
  try {
    await set(ref(db, `rooms/${state.roomCode}/bingo/boards/${state.studentId}/marks/${index}`), marked ? null : true);
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("색칠 상태를 저장하지 못했습니다.", "error");
  }
}

async function teacherUnmarkBingoCell(studentId, index) {
  if (!window.confirm("이 칸의 색칠을 취소할까요?")) return;
  if (securePilot) return securePilotHostCommand("bingoUnmark", { studentId, index });
  try {
    await Promise.all([
      remove(ref(db, `rooms/${state.roomCode}/bingo/boards/${studentId}/marks/${index}`)),
      remove(ref(db, `rooms/${state.roomCode}/bingo/claims/${studentId}`)),
      remove(ref(db, `rooms/${state.roomCode}/bingo/winners/${studentId}`))
    ]);
    showToast("잘못 색칠한 칸을 취소했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("색칠을 취소하지 못했습니다.", "error");
  }
}

async function claimBingo() {
  const board = getMyBingoBoard();
  const lineCount = countBingoLines(board);
  if (!lineCount) return showToast("완성된 빙고 줄이 없습니다.", "error");
  if (securePilot) {
    const result = await securePilot.send("claimBingo");
    if (result.error) showToast(securePilotError(result.error), "error");
    return;
  }
  try {
    await set(ref(db, `rooms/${state.roomCode}/bingo/claims/${state.studentId}`), { studentId: state.studentId, name: state.studentName, lineCount, claimedAt: serverTimestamp() });
    showToast("빙고를 외쳤습니다! 선생님이 확인합니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("빙고 확인을 요청하지 못했습니다.", "error");
  }
}

async function approveBingoClaim(studentId) {
  if (securePilot) return securePilotHostCommand("reviewBingoClaim", { studentId, approved: true });
  const board = getBingoBoards().find((item) => item.studentId === studentId);
  const lineCount = countBingoLines(board);
  if (!lineCount) return showToast("현재 완성된 빙고 줄이 없어 인정할 수 없습니다.", "error");
  const existing = getBingoState().winners?.[studentId];
  const rank = existing?.rank || getBingoWinners().length + 1;
  try {
    await update(roomRef(state.roomCode), { [`bingo/winners/${studentId}`]: { studentId, name: board.name, rank, lineCount, approvedAt: serverTimestamp() }, [`bingo/claims/${studentId}`]: null });
    showToast(`${board.name} 학생의 빙고를 인정했습니다.`, "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("빙고를 인정하지 못했습니다.", "error");
  }
}

async function rejectBingoClaim(studentId) {
  if (securePilot) return securePilotHostCommand("reviewBingoClaim", { studentId, approved: false });
  try {
    await remove(ref(db, `rooms/${state.roomCode}/bingo/claims/${studentId}`));
    showToast("빙고 요청을 반려했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("빙고 요청을 반려하지 못했습니다.", "error");
  }
}

async function finishBingoGame() {
  if (!window.confirm("개념 빙고를 종료하고 결과를 공개할까요?")) return;
  try {
    await update(roomRef(state.roomCode), { status: "finished", "bingo/finishedAt": serverTimestamp(), finishedAt: serverTimestamp() });
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("빙고 게임을 종료하지 못했습니다.", "error");
  }
}

function getBingoResetStatePreservingBoards() {
  const next = getInitialBingoStateForWrite(getBingoSize());
  const boards = getBingoBoards();
  if (boards.length) {
    next.boards = Object.fromEntries(boards.map((board) => [board.studentId, { studentId: board.studentId, name: board.name, size: board.size, cells: board.cells, marks: null, submittedAt: board.submittedAt, updatedAt: board.updatedAt }]));
  }
  return next;
}

function renderFinalResult(viewName, showTeacherControls, force = false) {
  const ranking = getCumulativeRanking();
  const [first, second, third] = ranking;

  setView(viewName, `
    <section class="screen">
      <div class="status-bar">
        <span class="pill gold">최종 결과</span>
        ${showTeacherControls ? `
          <div class="button-row">
            <button class="btn danger" data-action="reset" type="button">다시 시작 준비</button>
            <button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button>
          </div>
        ` : ""}
      </div>

      <div class="panel">
        <h1>최종 순위</h1>
        <div class="final-podium">
          ${renderPodium(second, 2, "second")}
          ${renderPodium(first, 1, "first")}
          ${renderPodium(third, 3, "third")}
        </div>
      </div>

      <section class="panel">
        <h2>전체 누적 랭킹</h2>
        ${renderRanking(ranking)}
      </section>
      ${!showTeacherControls && state.role === "student" && getRoomMode() === "quiz" ? renderFinalQuizReview() : ""}
    </section>
  `, () => {
    document.querySelector("[data-action='reset']")?.addEventListener("click", resetGame);
    document.querySelector("[data-action='clear-room']")?.addEventListener("click", clearRoomLists);
  }, force);
}

function renderFinalQuizReview() {
  const published = state.room?.quizRevealedQuestionIds || {};
  const items = getQuestions().filter((question) => {
    const answer = state.room?.answers?.[question.id]?.[state.studentId];
    return Boolean(published[question.id] && answer && !answer.isCorrect && !answer.isSkipped);
  });
  if (!items.length) return "";
  return `<details class="panel release-review"><summary>내 오답 다시 보기 · ${items.length}문제</summary><ol class="release-steps">
    ${items.map((question) => {
      const answer = state.room.answers[question.id][state.studentId];
      const selected = getQuestionType(question) === "short" ? answer.textAnswer : question.choices[answer.selectedIndex];
      return `<li><strong>${escapeHtml(question.question)}</strong><p>내 답: ${escapeHtml(selected || "-")}</p><p>공개된 정답: ${escapeHtml(getQuestionCorrectAnswerText(question))}</p></li>`;
    }).join("")}</ol></details>`;
}

function renderFinalApprovedBingoCalls(game) {
  const list = Object.values(game?.calls || {}).filter((call) => call?.approvedAt && call?.concept)
    .sort((a, b) => Number(a.approvedAt) - Number(b.approvedAt));
  return list.length ? `<details class="panel release-review"><summary>이미 승인된 개념 · ${list.length}개</summary>
    <ol class="release-steps">${list.map((call) => `<li>${escapeHtml(call.concept)}</li>`).join("")}</ol></details>` : "";
}

// =========================
// 초성 단어 챌린지
// =========================

const WORD_CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const WORD_MODERN_CHOSEONG = "ᄀᄁᄂᄃᄄᄅᄆᄇᄈᄉᄊᄋᄌᄍᄎᄏᄐᄑᄒ";

function getInitialWordChallengeStateForWrite(settings = {}) {
  return {
    settings: {
      chosung: normalizeWordChallengeChosung(settings.chosung || ""),
      duration: clampInt(settings.duration, MIN_WORD_CHALLENGE_SECONDS, MAX_WORD_CHALLENGE_SECONDS, DEFAULT_WORD_CHALLENGE_SECONDS)
    },
    gameId: "",
    startedAt: null,
    endedAt: null,
    finishedAt: null,
    submissions: null,
    claims: null
  };
}

function getWordChallengeState() {
  const initial = getInitialWordChallengeStateForWrite();
  return {
    ...initial,
    ...(state.room?.wordChallenge || {}),
    settings: {
      ...initial.settings,
      ...(state.room?.wordChallenge?.settings || {})
    }
  };
}

function getWordChallengeResetState(preserveSettings = false) {
  return getInitialWordChallengeStateForWrite(preserveSettings ? getWordChallengeState().settings : {});
}

function normalizeWordChallengeChosung(value) {
  return [...String(value || "").replace(/\s+/g, "")]
    .map((character) => {
      const modernIndex = WORD_MODERN_CHOSEONG.indexOf(character);
      return modernIndex >= 0 ? WORD_CHOSEONG[modernIndex] : character;
    })
    .join("");
}

function isValidWordChallengeChosung(value) {
  const normalized = normalizeWordChallengeChosung(value);
  return Boolean(normalized) && [...normalized].every((character) => WORD_CHOSEONG.includes(character));
}

function normalizeWordChallengeWord(value) {
  return String(value || "").normalize("NFC").trim().replace(/\s+/g, "");
}

function extractWordChosung(value) {
  const word = normalizeWordChallengeWord(value);
  let result = "";
  for (const character of word) {
    const code = character.codePointAt(0);
    if (code < 0xac00 || code > 0xd7a3) return "";
    result += WORD_CHOSEONG[Math.floor((code - 0xac00) / 588)];
  }
  return result;
}

function getWordChallengeNow() {
  if (securePilot) return securePilot.now();
  return Date.now() + Number(state.serverTimeOffset || 0);
}

function getWordChallengeRemainingMs(game = getWordChallengeState()) {
  const startedAt = Number(game.startedAt || 0);
  if (!startedAt) return Number(game.settings?.duration || DEFAULT_WORD_CHALLENGE_SECONDS) * 1000;
  return Math.max(0, startedAt + Number(game.settings?.duration || DEFAULT_WORD_CHALLENGE_SECONDS) * 1000 - getWordChallengeNow());
}

function getWordChallengeSubmissions(game = getWordChallengeState()) {
  return Object.entries(game.submissions || {})
    .map(([id, submission]) => ({ id, ...submission }))
    .sort((a, b) => Number(a.submittedAt || 0) - Number(b.submittedAt || 0));
}

function getMyWordChallengeSubmissions() {
  return getWordChallengeSubmissions().filter((submission) => submission.participantId === state.studentId);
}

function getWordChallengeRanking() {
  const approvedCounts = {};
  getWordChallengeSubmissions().forEach((submission) => {
    if (submission.status === "approved") {
      approvedCounts[submission.participantId] = (approvedCounts[submission.participantId] || 0) + 1;
    }
  });
  return getStudents()
    .map((student) => ({ ...student, wordScore: state.room?.pilotWordScores?.[student.id] ?? approvedCounts[student.id] ?? 0 }))
    .sort((a, b) => b.wordScore - a.wordScore || String(a.name).localeCompare(String(b.name), "ko"));
}

function wordChallengeStatusLabel(status) {
  return status === "approved" ? "승인" : status === "rejected" ? "반려" : "검토 중";
}

function wordChallengeStatusClass(status) {
  return status === "approved" ? "green" : status === "rejected" ? "red" : "gold";
}

function formatWordChallengeTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function startWordChallengeTimer({ textSelector, fillSelector, onEnd }) {
  clearTimer();
  const textElement = document.querySelector(textSelector);
  const fillElement = document.querySelector(fillSelector);
  if (!textElement || !fillElement) return;
  const durationMs = Number(getWordChallengeState().settings.duration || DEFAULT_WORD_CHALLENGE_SECONDS) * 1000;
  let ended = false;
  const tick = () => {
    const remaining = getWordChallengeRemainingMs();
    textElement.textContent = formatWordChallengeTime(remaining);
    fillElement.style.width = `${Math.max(0, Math.min(100, remaining / durationMs * 100))}%`;
    if (remaining <= 0 && !ended) {
      ended = true;
      clearTimer();
      onEnd?.();
    }
  };
  state.timerId = window.setInterval(tick, 200);
  tick();
}

function renderWordChallengeStudentRoute() {
  const status = state.room?.status || "waiting";
  if (status === "finished") {
    renderWordChallengeFinalResult("student-word-final", false, true);
    return;
  }
  if (status === "playing" || status === "result") {
    renderWordChallengeStudentGame();
    return;
  }
  renderWordChallengeStudentWaiting();
}

function renderWordChallengeStudentWaiting(force = false) {
  const game = getWordChallengeState();
  setView(`student-word-waiting-${game.settings.duration}-${getStudents().length}`, `
    <section class="screen word-challenge-mode">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>
      <section class="panel word-hero-panel">
        <p class="eyebrow">초성 단어 챌린지</p>
        <h1>게임 시작을 기다리고 있습니다.</h1>
        <p class="lead">${escapeHtml(state.studentName)} 학생으로 입장했습니다.</p>
      </section>
      <div class="stats">
        <div class="stat"><span class="muted">제한 시간</span><span class="num">${game.settings.duration}초</span></div>
        <div class="stat"><span class="muted">참가 학생</span><span class="num">${getStudents().length}명</span></div>
      </div>
      <div class="notice info">선생님이 게임을 시작하면 자동으로 이동합니다.</div>
    </section>
  `, () => document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome), force);
}

function renderWordChallengeStudentGame(force = false) {
  const game = getWordChallengeState();
  const ownSubmissions = getMyWordChallengeSubmissions();
  const approvedCount = ownSubmissions.filter((submission) => submission.status === "approved").length;
  const timeUp = getWordChallengeRemainingMs(game) <= 0 || state.room.status === "result";
  const view = `student-word-${state.roomCode}-${game.gameId}-${timeUp}`;
  const submissionMarkup = renderMyWordChallengeSubmissions(ownSubmissions);
  if (!force && state.activeView === view) {
    setPlaygroundText("#wordStudentApproved", `인정 단어 ${approvedCount}개`);
    setPlaygroundText("#wordStudentSubmitted", `${ownSubmissions.length}개 제출`);
    updateWordChallengeRegion("#wordStudentSubmissions", submissionMarkup);
    return;
  }
  setView(view, `
    <section class="screen word-challenge-mode experience-word">
      <div class="status-bar">
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
        <span class="pill ${timeUp ? "red" : "green"}">${timeUp ? "시간 종료" : "도전 중"}</span>
        <span class="pill gold" id="wordStudentApproved">인정 단어 ${approvedCount}개</span>
      </div>
      <section class="panel word-hero-panel">
        <p class="eyebrow">제시 초성</p>
        ${renderArcadeJamo(game.settings.chosung)}
        <div class="word-clock" id="wordStudentTimer">${formatWordChallengeTime(getWordChallengeRemainingMs(game))}</div>
        <div class="timer-track"><div class="timer-fill" id="wordStudentTimerFill"></div></div>
      </section>
      ${timeUp ? `<div class="notice warn"><strong>제한 시간이 종료되었습니다.</strong> 제출한 단어를 선생님이 검토하고 있습니다.</div>` : `
        <form id="wordChallengeForm" class="panel word-submit-form">
          <label for="wordChallengeInput">단어 입력</label>
          <div class="word-input-row">
            <input id="wordChallengeInput" maxlength="${MAX_WORD_CHALLENGE_LENGTH}" autocomplete="off" autocapitalize="off" placeholder="단어를 입력하세요" value="${escapeAttr(state.wordChallengeDraft)}" />
            <button class="btn primary" type="submit" ${state.wordChallengeSubmitting ? "disabled" : ""}>제출</button>
          </div>
          <p class="muted small">입력한 단어의 초성이 ${escapeHtml(game.settings.chosung)}와 정확히 같아야 합니다.</p>
        </form>
      `}
      <section class="panel experience-word-ledger">
        <div class="status-bar"><h2>내 제출 현황</h2><span class="pill blue" id="wordStudentSubmitted">${ownSubmissions.length}개 제출</span></div>
        <div id="wordStudentSubmissions" aria-live="polite">${submissionMarkup}</div>
      </section>
    </section>
  `, () => {
    const input = document.querySelector("#wordChallengeInput");
    input?.addEventListener("input", () => { state.wordChallengeDraft = input.value; });
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.isComposing || event.keyCode === 229)) event.preventDefault();
    });
    document.querySelector("#wordChallengeForm")?.addEventListener("submit", submitWordChallengeWord);
    if (!timeUp) {
      input?.focus();
      startWordChallengeTimer({
        textSelector: "#wordStudentTimer",
        fillSelector: "#wordStudentTimerFill",
        onEnd: () => renderWordChallengeStudentGame(true)
      });
    }
  }, force);
}

function renderMyWordChallengeSubmissions(submissions) {
  if (!submissions.length) return `<div class="empty">아직 제출한 단어가 없습니다.</div>`;
  return `<div class="word-submission-list">${[...submissions].reverse().map((submission) => `
    <div class="word-submission-row" data-word-state="${escapeAttr(submission.status)}">
      <strong>${escapeHtml(submission.originalWord)}</strong>
      <span class="pill ${wordChallengeStatusClass(submission.status)}">${renderExperienceIcon(submission.status === "approved" ? "check" : submission.status === "rejected" ? "close" : "clock")}${wordChallengeStatusLabel(submission.status)}</span>
    </div>
  `).join("")}</div>`;
}

function renderWordChallengeTeacherDashboard(force = true) {
  const game = getWordChallengeState();
  const status = state.room?.status || "waiting";
  const submissions = getWordChallengeSubmissions(game);
  const pending = submissions.filter((submission) => submission.status === "pending");
  const approved = submissions.filter((submission) => submission.status === "approved");
  const rejected = submissions.filter((submission) => submission.status === "rejected");
  const canEdit = status === "waiting";
  const students = getStudents();
  const view = `teacher-word-${state.roomCode}-${status}-${game.gameId}-${game.settings.chosung}-${game.settings.duration}`;
  const pendingWarning = status === "result" && pending.length
    ? `<div class="notice warn">아직 검토하지 않은 단어가 ${pending.length}개 있습니다.</div>`
    : "";
  if (state.activeView === view) {
    setPlaygroundText("#wordTeacherSubmissions", String(submissions.length));
    setPlaygroundText("#wordTeacherPending", String(pending.length));
    setPlaygroundText("#wordTeacherConnected", String(students.filter((student) => student.connected).length));
    setPlaygroundText("#wordPendingCount", `${pending.length}개`);
    updateWordChallengePendingRows(pending);
    updateWordChallengeRegion("#wordTeacherWarning", pendingWarning);
    updateWordChallengeRegion("#wordTeacherRanking", renderWordChallengeRanking());
    updateWordChallengeRegion("#wordTeacherStudents", renderStudentList(students));
    updateWordChallengeRegion("#wordTeacherApproved", renderWordChallengeReviewGroup("승인됨", approved, "approved"));
    updateWordChallengeRegion("#wordTeacherRejected", renderWordChallengeReviewGroup("반려됨", rejected, "rejected"));
    const start = document.querySelector('[data-action="word-start"]');
    if (start) start.disabled = !canEdit || !isValidWordChallengeChosung(game.settings.chosung) || !students.length;
    return;
  }
  const reviewScrollState = captureWordChallengeReviewScroll();
  setView(view, `
    <section class="screen word-challenge-mode">
      <div class="status-bar">
        <div><p class="eyebrow">교사 화면</p><h1>초성 단어 챌린지</h1></div>
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
      </div>
      <section class="panel">
        <div class="status-bar">
          <div><p class="muted small">학생들에게 알려 줄 방 코드</p><div class="room-code">${escapeHtml(state.roomCode)}</div></div>
          <div class="button-row"><span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span><button class="btn ghost" id="copyRoomCodeBtn" type="button">방 코드 복사</button><button class="btn dark" data-action="open-display" type="button">교실 화면 팝업</button></div>
        </div>
        <div class="stats">
          <div class="stat"><span class="muted">전체 제출</span><span class="num" id="wordTeacherSubmissions">${submissions.length}</span></div>
          <div class="stat"><span class="muted">검토 대기</span><span class="num" id="wordTeacherPending">${pending.length}</span></div>
          <div class="stat"><span class="muted">접속 학생</span><span class="num" id="wordTeacherConnected">${students.filter((student) => student.connected).length}</span></div>
        </div>
      </section>
      <div class="teacher-grid">
        <aside class="panel">
          <div class="stack">
            <h2>진행 조작</h2>
            <div class="button-row">
              <button class="btn success" data-action="word-start" type="button" ${canEdit && isValidWordChallengeChosung(game.settings.chosung) && getStudents().length ? "" : "disabled"}>게임 시작</button>
              <button class="btn warn" data-action="word-review" type="button" ${status === "playing" ? "" : "disabled"}>제출 마감</button>
              <button class="btn dark" data-action="word-finish" type="button" ${status === "result" ? "" : "disabled"}>최종 결과 보기</button>
              <button class="btn danger" data-action="reset" type="button">게임 초기화</button>
              <button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button>
            </div>
            ${status === "playing" ? `<div class="timer-wrap"><div class="timer-top"><span>남은 시간</span><strong id="wordTeacherTimer">${formatWordChallengeTime(getWordChallengeRemainingMs(game))}</strong></div><div class="timer-track"><div class="timer-fill" id="wordTeacherTimerFill"></div></div></div>` : ""}
            <div id="wordTeacherWarning">${pendingWarning}</div>
          </div>
          <div class="stack">
            <h2>게임 설정</h2>
            <div class="field"><label for="wordChosungInput">제시 초성</label><input id="wordChosungInput" maxlength="8" placeholder="예: ㅅㄱ" value="${escapeAttr(game.settings.chosung)}" ${canEdit ? "" : "disabled"} /></div>
            <button class="btn ghost" data-action="ux-word-recommend" type="button" ${canEdit ? "" : "disabled"}>${uxIcon("shuffle")}초성 추천</button>
            <div class="field"><label for="wordDurationInput">제한 시간(초)</label><input id="wordDurationInput" type="number" min="${MIN_WORD_CHALLENGE_SECONDS}" max="${MAX_WORD_CHALLENGE_SECONDS}" value="${game.settings.duration}" ${canEdit ? "" : "disabled"} /></div>
            <div class="button-row word-duration-presets">${[30, 60, 90, 120].map((seconds) => `<button class="btn ghost" data-word-duration="${seconds}" type="button" ${canEdit ? "" : "disabled"}>${seconds}초</button>`).join("")}</div>
            <button class="btn primary" data-action="word-save-settings" type="button" ${canEdit ? "" : "disabled"}>설정 저장</button>
          </div>
          ${renderTeacherModeControls()}
          <section class="stack"><h2>참가 학생</h2><div id="wordTeacherStudents">${renderStudentList(students)}</div></section>
        </aside>
        <div class="screen">
          ${renderWordChallengeReviewGroup("검토 대기", pending, "pending")}
          <section class="panel"><div class="status-bar"><h2>실시간 순위</h2><span class="pill gold">승인 단어 기준</span></div><div id="wordTeacherRanking">${renderWordChallengeRanking()}</div></section>
          <div id="wordTeacherApproved">${renderWordChallengeReviewGroup("승인됨", approved, "approved")}</div>
          <div id="wordTeacherRejected">${renderWordChallengeReviewGroup("반려됨", rejected, "rejected")}</div>
        </div>
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome);
    document.querySelector("#copyRoomCodeBtn")?.addEventListener("click", copyRoomCode);
    document.querySelectorAll("[data-switch-mode]").forEach((button) => button.addEventListener("click", () => switchRoomMode(button.dataset.switchMode)));
    document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleTeacherAction(button.dataset.action)));
    document.querySelectorAll("[data-word-duration]").forEach((button) => button.addEventListener("click", () => { document.querySelector("#wordDurationInput").value = button.dataset.wordDuration; }));
    document.querySelector('[data-word-review-list="pending"]')?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-word-review]");
      if (!button || button.disabled) return;
      reviewWordChallengeSubmission(button.dataset.wordSubmission, button.dataset.wordReview);
    });
    if (status === "playing") startWordChallengeTimer({ textSelector: "#wordTeacherTimer", fillSelector: "#wordTeacherTimerFill", onEnd: enterWordChallengeReview });
    restoreWordChallengeReviewScroll(reviewScrollState);
  }, force);
}

function renderWordChallengeReviewGroup(title, submissions, groupStatus) {
  const pending = groupStatus === "pending";
  const orderedSubmissions = pending ? submissions : [...submissions].reverse();
  return `<section class="panel word-review-panel ${groupStatus}">
    <div class="status-bar"><h2>${title}</h2><span ${pending ? 'id="wordPendingCount"' : ""} class="pill ${wordChallengeStatusClass(groupStatus)}">${submissions.length}개</span></div>
    <div class="word-review-list" data-word-review-list="${groupStatus}">${orderedSubmissions.map(renderWordChallengeReviewRow).join("")}</div>
    <div class="empty" ${pending ? 'id="wordPendingEmpty"' : ""} ${submissions.length ? "hidden" : ""}>해당 단어가 없습니다.</div>
  </section>`;
}

function renderWordChallengeReviewRow(submission) {
  const id = escapeAttr(submission.id);
  return `<article class="word-review-row" data-word-submission-row="${id}">
    <div><strong>${escapeHtml(submission.originalWord)}</strong><p class="muted small">${renderPlaygroundName(submission, submission.nickname)}</p></div>
    ${submission.status === "pending" ? `<div class="button-row">
      <button class="btn success" data-word-review="approved" data-word-submission="${id}" type="button" ${state.wordChallengeReviewing ? "disabled" : ""}>승인</button>
      <button class="btn danger" data-word-review="rejected" data-word-submission="${id}" type="button" ${state.wordChallengeReviewing ? "disabled" : ""}>반려</button>
    </div>` : `<span class="pill ${wordChallengeStatusClass(submission.status)}">${wordChallengeStatusLabel(submission.status)}</span>`}
  </article>`;
}

function updateWordChallengePendingRows(pending) {
  const list = document.querySelector('[data-word-review-list="pending"]');
  if (!list) return;
  const pendingIds = new Set(pending.map(({ id }) => id));
  const items = Array.from(list.children);
  const existingIds = new Set(items.map((row) => row.dataset.wordSubmissionRow));
  const listTop = list.getBoundingClientRect().top;
  const anchor = items.find((row) => pendingIds.has(row.dataset.wordSubmissionRow) && row.getBoundingClientRect().bottom > listTop);
  const anchorTop = anchor?.getBoundingClientRect().top;
  for (const row of items) {
    if (!pendingIds.has(row.dataset.wordSubmissionRow)) row.remove();
  }
  const additions = pending.filter(({ id }) => !existingIds.has(id));
  if (additions.length) list.insertAdjacentHTML("beforeend", additions.map(renderWordChallengeReviewRow).join(""));
  if (anchor) list.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
  document.querySelector("#wordPendingEmpty").hidden = pending.length > 0;
}

function captureWordChallengeReviewScroll() {
  if (!String(state.activeView || "").startsWith("teacher-word-")) return null;
  const lists = {};
  document.querySelectorAll("[data-word-review-list]").forEach((list) => {
    const key = list.dataset.wordReviewList;
    if (!key) return;
    lists[key] = {
      top: list.scrollTop,
      atEnd: list.scrollHeight - list.clientHeight - list.scrollTop <= 12
    };
  });
  return {
    pageX: Number(window.scrollX || 0),
    pageY: Number(window.scrollY || 0),
    lists
  };
}

function restoreWordChallengeReviewScroll(scrollState) {
  if (!scrollState) return;
  Object.entries(scrollState.lists || {}).forEach(([key, saved]) => {
    const list = document.querySelector(`[data-word-review-list="${key}"]`);
    if (!list) return;
    const maxTop = Math.max(0, list.scrollHeight - list.clientHeight);
    list.scrollTop = saved.atEnd ? maxTop : Math.min(Number(saved.top || 0), maxTop);
  });
  if (typeof window.scrollTo === "function") {
    window.scrollTo(Number(scrollState.pageX || 0), Number(scrollState.pageY || 0));
  }
}

function setWordChallengeReviewButtonsDisabled(disabled) {
  document.querySelectorAll("[data-word-review]").forEach((button) => {
    button.disabled = disabled;
  });
}

function renderWordChallengeRanking(limit = null) {
  const ranking = getWordChallengeRanking();
  const visible = Number.isInteger(limit) ? ranking.slice(0, limit) : ranking;
  if (!visible.length) return `<div class="empty">참가 학생이 없습니다.</div>`;
  let lastScore = null;
  let lastRank = 0;
  return `<div class="ranking">${visible.map((student, index) => {
    if (student.wordScore !== lastScore) lastRank = index + 1;
    lastScore = student.wordScore;
    return `<div class="ranking-row rank-${lastRank}"><span class="rank-medal">${lastRank}</span><strong>${renderPlaygroundName(student)}</strong><span class="score">${student.wordScore}개</span></div>`;
  }).join("")}</div>`;
}

function renderWordChallengeDisplay(force = false) {
  const game = getWordChallengeState();
  const status = state.room?.status || "waiting";
  const submissions = getWordChallengeSubmissions(game);
  const total = state.room.pilotWordCounts?.total ?? submissions.length;
  const pendingCount = state.room.pilotWordCounts?.pending ?? submissions.filter((submission) => submission.status === "pending").length;
  const approvedCount = state.room.pilotWordCounts?.approved ?? submissions.filter((submission) => submission.status === "approved").length;
  if (status === "finished") {
    renderDisplayShell(`display-word-finished-${game.gameId}-${approvedCount}`, "초성 단어 챌린지 최종 결과", `제시 초성 ${game.settings.chosung}`, renderWordChallengeFinalBody(), null, force);
    return;
  }
  if (status === "playing") {
    renderDisplayShell(`display-word-playing-${game.gameId}-${total}-${approvedCount}`, "초성 단어 챌린지", "", `
      <section class="panel word-hero-panel word-display-play">
        <div><p class="eyebrow">제시 초성</p>${renderArcadeJamo(game.settings.chosung)}</div>
        <div class="word-display-time"><div class="word-clock" id="wordDisplayTimer">${formatWordChallengeTime(getWordChallengeRemainingMs(game))}</div><div class="timer-track"><div class="timer-fill" id="wordDisplayTimerFill"></div></div></div>
        <p class="word-display-submit-count">${total}개 제출</p>
      </section>
      <section class="panel"><h2>실시간 순위</h2>${renderWordChallengeRanking(8)}</section>
    `, () => startWordChallengeTimer({ textSelector: "#wordDisplayTimer", fillSelector: "#wordDisplayTimerFill" }), force);
    return;
  }
  if (status === "result") {
    renderDisplayShell(`display-word-reviewing-${game.gameId}-${pendingCount}-${approvedCount}`, "단어 검토 중", `제시 초성 ${game.settings.chosung}`, `<section class="panel result-panel"><h1>선생님이 제출 단어를 확인하고 있습니다.</h1><div class="stats"><div class="stat"><span class="muted">승인</span><span class="num">${approvedCount}</span></div><div class="stat"><span class="muted">검토 대기</span><span class="num">${pendingCount}</span></div><div class="stat"><span class="muted">전체 제출</span><span class="num">${total}</span></div></div></section><section class="panel"><h2>현재 순위</h2>${renderWordChallengeRanking(8)}</section>`, null, force);
    return;
  }
  renderDisplayShell(`display-word-waiting-${game.settings.duration}-${getStudents().length}`, "초성 단어 챌린지", "학생 입장을 기다리고 있습니다.", `<section class="panel result-panel"><h2>게임 시작 대기</h2><div class="stats"><div class="stat"><span class="muted">제한 시간</span><span class="num">${game.settings.duration}초</span></div><div class="stat"><span class="muted">참가 학생</span><span class="num">${getStudents().length}명</span></div><div class="stat"><span class="muted">접속 학생</span><span class="num">${getStudents().filter((student) => student.connected).length}명</span></div></div></section>`, null, force);
}

function renderWordChallengeFinalBody() {
  const approved = getWordChallengeSubmissions().filter((submission) => submission.status === "approved").sort((a, b) => String(a.originalWord).localeCompare(String(b.originalWord), "ko"));
  const leaders = getWordChallengeRanking().filter((student) => student.wordScore > 0).slice(0, 3);
  let rank = 1;
  const podiumRanks = leaders.map((student, index) => {
    if (index > 0 && student.wordScore !== leaders[index - 1].wordScore) rank = index + 1;
    return rank;
  });
  const podiumOrder = leaders.length === 3 ? [1, 0, 2] : leaders.map((_, index) => index);
  const podium = leaders.length ? `<div class="final-podium word-podium">${podiumOrder.map((index) =>
    renderPodium({ ...leaders[index], score: leaders[index].wordScore }, podiumRanks[index], ["first", "second", "third"][index], "개")
  ).join("")}</div>` : "";
  return `
    <section class="panel word-hero-panel result-panel"><p class="eyebrow">제시 초성 ${escapeHtml(getWordChallengeState().settings.chosung)}</p><h1>총 ${approved.length}개의 단어를 찾았습니다.</h1></section>
    ${podium}
    <section class="panel"><h2>최종 순위</h2>${renderWordChallengeRanking()}</section>
    <section class="panel"><h2>승인된 전체 단어</h2>${approved.length ? `<div class="word-approved-grid">${approved.map((submission) => `<div class="word-approved-item"><strong>${escapeHtml(submission.originalWord)}</strong>${renderPlaygroundName(submission, submission.nickname)}</div>`).join("")}</div>` : `<div class="empty">승인된 단어가 없습니다.</div>`}</section>`;
}

function renderWordChallengeFinalResult(viewName, showTeacherControls, force = false) {
  setView(viewName, `<section class="screen word-challenge-mode"><div class="status-bar"><div><p class="eyebrow">초성 단어 챌린지 종료</p><h1>최종 결과</h1></div><span class="pill gold">게임 완료</span></div>${renderWordChallengeFinalBody()}${showTeacherControls ? `<div class="button-row"><button class="btn success" data-action="word-restart" type="button">같은 참가자로 새 초성 게임</button><button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button><button class="btn ghost" id="backHomeBtn" type="button">방 나가기</button></div>` : `<div class="notice info">선생님이 다음 게임을 준비할 때까지 기다려 주세요.</div>`}</section>`, () => {
    document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleTeacherAction(button.dataset.action)));
    document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome);
  }, force);
}

async function saveWordChallengeSettings() {
  if ((state.room?.status || "waiting") !== "waiting") return showToast("게임 시작 전 대기 상태에서만 설정할 수 있습니다.", "error");
  const chosung = normalizeWordChallengeChosung(document.querySelector("#wordChosungInput")?.value || "");
  const durationValue = Number(document.querySelector("#wordDurationInput")?.value);
  if (!isValidWordChallengeChosung(chosung)) return showToast("초성만 입력해 주세요. 예: ㅅㄱ", "error");
  if (!Number.isInteger(durationValue) || durationValue < MIN_WORD_CHALLENGE_SECONDS || durationValue > MAX_WORD_CHALLENGE_SECONDS) return showToast(`제한 시간은 ${MIN_WORD_CHALLENGE_SECONDS}초부터 ${MAX_WORD_CHALLENGE_SECONDS}초까지 입력해 주세요.`, "error");
  try {
    await update(ref(db, `rooms/${state.roomCode}/wordChallenge/settings`), { chosung, duration: durationValue });
    showToast("초성과 제한 시간을 저장했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("설정을 저장하지 못했습니다.", "error");
  }
}

async function startWordChallenge() {
  const settings = getWordChallengeState().settings;
  if (!isValidWordChallengeChosung(settings.chosung)) return showToast("초성을 저장한 뒤 시작해 주세요.", "error");
  if (!getStudents().length) return showToast("참가 학생이 한 명 이상 필요합니다.", "error");
  openDisplayWindow();
  try {
    await update(roomRef(state.roomCode), {
      status: "playing",
      wordChallenge: {
        ...getInitialWordChallengeStateForWrite(settings),
        gameId: `word_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        startedAt: serverTimestamp()
      }
    });
    showToast("초성 단어 챌린지를 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("게임을 시작하지 못했습니다.", "error");
  }
}

async function submitWordChallengeWord(event) {
  event.preventDefault();
  if (state.wordChallengeSubmitting) return;
  const game = getWordChallengeState();
  const input = document.querySelector("#wordChallengeInput");
  const originalDraft = input?.value ?? state.wordChallengeDraft;
  const word = normalizeWordChallengeWord(originalDraft);
  if (!word) return showToast("단어를 입력해 주세요.", "error");
  if (word.length > MAX_WORD_CHALLENGE_LENGTH || !/^[가-힣]+$/.test(word)) return showToast("한글 음절로 된 단어만 입력해 주세요.", "error");
  if (extractWordChosung(word) !== normalizeWordChallengeChosung(game.settings.chosung)) return showToast("제시된 초성과 일치하지 않습니다.", "error");
  if ((state.room?.status || "waiting") !== "playing" || getWordChallengeRemainingMs(game) <= 0) return showToast("제한 시간이 종료되었습니다.", "error");
  const submissionId = `word_${state.studentId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const submittedAt = getWordChallengeNow();
  state.wordChallengeSubmitting = true;
  state.wordChallengeDraft = "";
  const button = document.querySelector("#wordChallengeForm button[type='submit']");
  if (button) button.disabled = true;
  if (input) {
    input.value = "";
    input.focus?.({ preventScroll: true });
  }
  let committed = false;
  try {
    if (securePilot) {
      const result = await securePilot.send("submitWord", { word });
      committed = !result.error;
      showToast(committed ? "제출 완료. 다음 단어를 입력할 수 있습니다." : securePilotError(result.error), committed ? "success" : "error");
      return;
    }
    const result = await runTransaction(ref(db, `rooms/${state.roomCode}/wordChallenge`), (current) => {
      if (!current || current.gameId !== game.gameId || !current.startedAt || current.endedAt) return;
      const endAt = Number(current.startedAt) + Number(current.settings?.duration || DEFAULT_WORD_CHALLENGE_SECONDS) * 1000;
      if (getWordChallengeNow() >= endAt) return;
      current.claims = current.claims || {};
      if (current.claims[word]) return;
      current.submissions = current.submissions || {};
      current.submissions[submissionId] = { participantId: state.studentId, nickname: state.studentName, originalWord: word, normalizedWord: word, status: "pending", submittedAt };
      current.claims[word] = { submissionId, participantId: state.studentId, status: "pending", claimedAt: submittedAt };
      return current;
    });
    if (!result.committed) {
      const latest = result.snapshot.val() || {};
      showToast(latest.claims?.[word] ? "이미 제출한 단어입니다." : "제한 시간이 종료되었습니다.", "error");
      return;
    }
    committed = true;
    showToast("제출 완료. 다음 단어를 입력할 수 있습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("제출하지 못했습니다. 다시 시도해 주세요.", "error");
  } finally {
    state.wordChallengeSubmitting = false;
    const submitButton = document.querySelector("#wordChallengeForm button[type='submit']");
    if (input && input === document.querySelector("#wordChallengeInput") && !committed && !input.value) {
      input.value = originalDraft;
      state.wordChallengeDraft = originalDraft;
    }
    if (submitButton) submitButton.disabled = false;
  }
}

function setPlaygroundText(selector, value) {
  const element = document.querySelector(selector);
  if (element && element.textContent !== value) element.textContent = value;
}

function updateWordChallengeRegion(selector, html) {
  const element = document.querySelector(selector);
  if (!element || element.dataset.markup === html) return;
  element.innerHTML = html;
  element.dataset.markup = html;
}

async function reviewWordChallengeSubmission(submissionId, nextStatus) {
  if (state.role !== "teacher" || !["approved", "rejected"].includes(nextStatus) || state.wordChallengeReviewing) return;
  state.wordChallengeReviewing = true;
  setWordChallengeReviewButtonsDisabled(true);
  try {
    if (securePilot) {
      const result = await securePilotHostCommand("reviewWord", { submissionId, status: nextStatus });
      if (!result?.error) showToast(nextStatus === "approved" ? "단어를 승인했습니다." : "단어를 반려하고 선점을 해제했습니다.", "success");
      return;
    }
    const result = await runTransaction(ref(db, `rooms/${state.roomCode}/wordChallenge`), (current) => {
      const submission = current?.submissions?.[submissionId];
      if (!submission || submission.status !== "pending") return;
      submission.status = nextStatus;
      submission.reviewedAt = getWordChallengeNow();
      current.claims = current.claims || {};
      if (nextStatus === "approved") {
        current.claims[submission.normalizedWord] = { submissionId, participantId: submission.participantId, status: "approved", claimedAt: Number(current.claims[submission.normalizedWord]?.claimedAt || submission.submittedAt) };
      } else if (current.claims[submission.normalizedWord]?.submissionId === submissionId) {
        delete current.claims[submission.normalizedWord];
      }
      return current;
    }, { applyLocally: false });
    showToast(result.committed ? (nextStatus === "approved" ? "단어를 승인했습니다." : "단어를 반려하고 선점을 해제했습니다.") : "이미 처리된 단어입니다.", result.committed ? "success" : "error");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("단어를 처리하지 못했습니다.", "error");
  } finally {
    state.wordChallengeReviewing = false;
    setWordChallengeReviewButtonsDisabled(false);
  }
}

async function enterWordChallengeReview() {
  if (state.role !== "teacher" || (state.room?.status || "waiting") !== "playing") return;
  try {
    await update(roomRef(state.roomCode), { status: "result", "wordChallenge/endedAt": serverTimestamp() });
    showToast("제출을 마감했습니다. 남은 단어를 검토해 주세요.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("제출을 마감하지 못했습니다.", "error");
  }
}

async function finishWordChallenge() {
  const pendingCount = getWordChallengeSubmissions().filter((submission) => submission.status === "pending").length;
  if (pendingCount) return showToast(`아직 검토하지 않은 단어가 ${pendingCount}개 있습니다.`, "error");
  try {
    await update(roomRef(state.roomCode), { status: "finished", finishedAt: serverTimestamp(), "wordChallenge/finishedAt": serverTimestamp() });
    showToast("최종 결과를 공개했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("최종 결과를 열지 못했습니다.", "error");
  }
}

async function resetWordChallengeWithStudents() {
  if (!window.confirm("참가 학생은 유지하고 새 초성 게임을 준비할까요?")) return;
  try {
    await update(roomRef(state.roomCode), { status: "waiting", finishedAt: null, wordChallenge: getWordChallengeResetState(true) });
    showToast("같은 참가자로 새 게임을 준비했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("새 게임을 준비하지 못했습니다.", "error");
  }
}

// =========================
// 입장 및 제출
// =========================

async function enterStudent({ resume = false } = {}) {
  if (state.teacherSigningIn || state.studentJoining) return;
  if (!db && !securePilot) {
    showToast("Firebase 설정값을 먼저 입력해 주세요.", "error");
    return;
  }

  const code = normalizeRoomCode(document.querySelector("#studentRoomCode").value);
  const nameInput = document.querySelector("#studentName");
  const remembered = readStudentSession(code);
  const name = parseStudentName(resume ? remembered?.name : nameInput.value);

  if (!code) {
    setUxStudentStatus("방 코드를 입력해 주세요.", "error");
    document.querySelector("#studentRoomCode").focus();
    return;
  }

  if (!name.valid && !(resume && remembered)) {
    setUxStudentStatus(name.message, "error");
    nameInput.focus();
    return;
  }

  const isResume = Boolean(remembered && (resume || (!state.studentNewEntry && parseStudentName(remembered.name).key === name.key)));
  const studentId = isResume ? remembered.id : createParticipantId();
  state.studentJoining = true;
  setUxStudentBusy(true);
  try {
    if (securePilot) {
      const result = await securePilot.student(code, name.display, { resume: isResume, fresh: state.studentNewEntry });
      if (result.error) {
        setUxStudentStatus(securePilotError(result.error), "error", result.error === "duplicate-name" ? "duplicate-name" : "");
        return;
      }
      state.role = "student";
      state.roomCode = code;
      state.studentId = result.studentId;
      state.studentName = result.name;
      state.studentGeneration = result.generation;
      saveStudentSession();
      subscribeToRoom(code);
      return;
    }
    if (finalRelease && !await finalRelease.canJoin()) {
      setUxStudentStatus("앱 버전이 맞지 않습니다. 현재 수업이 끝난 뒤 페이지를 새로 열어 주세요.", "error");
      return;
    }
    const snapshot = await get(roomRef(code));
    if (!snapshot.exists()) {
      showToast("아직 만들어지지 않은 방입니다. 방 코드를 다시 확인해 주세요.", "error", "room-not-found");
      setUxStudentStatus("아직 만들어지지 않은 방입니다.", "error");
      return;
    }

    const result = await runAccessCommand(code, (room) => registerRoomParticipant(room, {
      studentId, name: name.display, resume: isResume,
      generation: isResume && remembered.generation != null ? remembered.generation : getRoomGeneration(snapshot.val()),
      timestamp: serverTimestamp()
    }));
    if (!result.room?.students?.[studentId] || result.error) {
      setUxStudentStatus(accessErrorMessage(result.error || "missing"), "error", result.error === "duplicate" ? "duplicate-name" : result.error === "locked" ? "room-locked" : "");
      return;
    }
    state.role = "student";
    state.roomCode = code;
    state.studentId = studentId;
    state.studentName = result.room.students[studentId].name;
    state.studentGeneration = getRoomGeneration(result.room);
    saveStudentSession();
    subscribeToRoom(code);
    startStudentPresence(code, studentId, state.studentGeneration);
  } catch (error) {
    finalRelease?.record("app-error");
    setUxStudentStatus("입장하지 못했습니다. 인터넷 연결을 확인해 주세요.", "error");
    showToast("입장 중 오류가 발생했습니다. 인터넷 연결과 방 코드를 확인해 주세요.", "error", "disconnected");
  } finally {
    state.studentJoining = false;
    setUxStudentBusy(false);
  }
}

async function enterTeacher() {
  if (state.teacherSigningIn || state.studentJoining) return;
  if (!db && !securePilot) {
    showToast("Firebase 설정값을 먼저 입력해 주세요.", "error");
    return;
  }

  const passwordInput = document.querySelector("#teacherPassword");
  const password = passwordInput.value;
  const codeInput = normalizeRoomCode(document.querySelector("#teacherRoomCode").value);
  const intent = document.querySelector('input[name="teacherEntryIntent"]:checked')?.value || "create";
  let code = codeInput || generateRoomCode();
  const selectedMode = getSelectedTeacherMode();
  const title = cleanText(document.querySelector("#uxTeacherRoomTitle")?.value).slice(0, 36);

  if (!password) {
    showToast("교사용 비밀번호를 입력해 주세요.", "error");
    passwordInput.focus();
    return;
  }
  if (intent === "open" && !codeInput) {
    showToast("열려는 방의 코드를 입력해 주세요.", "error");
    document.querySelector("#teacherRoomCode").focus();
    return;
  }

  const entryButtons = [document.querySelector("#teacherEnterBtn"), document.querySelector("#studentEnterBtn")];
  state.teacherSigningIn = true;
  entryButtons.forEach((button) => { button.disabled = true; });
  try {
    if (securePilot) {
      const result = await securePilot.teacher(code, intent, password, selectedMode);
      if (result.error) return showToast(securePilotError(result.error), "error");
      passwordInput.value = "";
      teacherAuth = { currentUser: { uid: result.uid }, signOut() {} };
      state.role = "teacher";
      state.roomCode = code;
      writeUxStorage("wbq_teacherRoomCode", code);
      subscribeToRoom(code);
      return;
    }
    if (finalRelease && !await finalRelease.canJoin()) return showToast("앱 버전이 맞지 않습니다. 페이지를 새로 열어 주세요.", "error");
    try {
      await authenticateTeacher(password);
    } catch (error) {
      finalRelease?.record("auth-error");
      showToast(teacherAuthenticationError(error), "error");
      passwordInput.select();
      return;
    }
    passwordInput.value = "";
    if (intent === "create") {
      const room = buildHostedRoom(selectedMode, title, teacherAuth.currentUser?.uid || "");
      let created = false;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const result = await runTransaction(roomRef(code), (existing) => existing == null ? room : undefined, { applyLocally: false });
        if (result.committed) { created = true; break; }
        if (codeInput) break;
        code = generateRoomCode();
      }
      if (!created) {
        showToast("이미 사용 중인 방 코드입니다. 기존 방을 열거나 새 코드를 사용해 주세요.", "error");
        return;
      }
    } else {
      const snapshot = await get(roomRef(code));
      const room = snapshot.val();
      if (!room) { showToast("아직 만들어지지 않은 방입니다.", "error"); return; }
      if (finalRelease && !finalRelease.roomCompatible(room)) return showToast(accessErrorMessage("protocol"), "error");
      if (!hasRoomHostAccess(room)) { showToast("이 방을 운영할 권한이 없습니다.", "error"); return; }
    }

    state.role = "teacher";
    state.roomCode = code;
    finalRelease?.bindHost(code);
    writeUxStorage("wbq_teacherRoomCode", code);
    writeUxStorage("wbq_teacherRecentRooms", JSON.stringify([code, ...getRecentTeacherRooms().filter((item) => item !== code)].slice(0, 8)));
    subscribeToRoom(code);
  } catch (error) {
    endTeacherAuthentication();
    finalRelease?.record("app-error");
    showToast("교사 화면을 여는 중 오류가 발생했습니다.", "error");
  } finally {
    state.teacherSigningIn = false;
    entryButtons.forEach((button) => { button.disabled = false; });
  }
}

function hasRoomHostAccess(room) {
  return Boolean(room && teacherAuth?.currentUser && (!room.hostUid || room.hostUid === teacherAuth.currentUser.uid));
}

function getRecentTeacherRooms() {
  try {
    const items = JSON.parse(readUxStorage("wbq_teacherRecentRooms") || "[]");
    return Array.isArray(items) ? items.map(normalizeRoomCode).filter(Boolean).slice(0, 8) : [];
  } catch { return []; }
}

function buildHostedRoom(mode, title, hostUid) {
  return { mode: mode === "word" ? "quiz" : mode, gameVariant: mode === "word" ? "word" : null,
    protocolVersion: finalRelease?.PROTOCOL || 1, schemaVersion: finalRelease?.SCHEMA || 1,
    status: "waiting", currentQuestionIndex: -1, currentComplimentIndex: -1, currentClueIndex: 0,
    timeLimit: DEFAULT_TIME_LIMIT_SECONDS, maxQuestionsPerStudent: MAX_QUESTIONS_PER_STUDENT, maxComplimentsPerStudent: MAX_COMPLIMENTS_PER_STUDENT,
    createdAt: serverTimestamp(), accessGeneration: createParticipantId(), hostUid: hostUid || null, roomTitle: title || null,
    mafia: mode === "mafia" ? getDefaultMafiaState() : null, liar: mode === "liar" ? getInitialLiarStateForWrite() : null,
    catchmind: mode === "catchmind" ? getInitialCatchmindStateForWrite() : null, seatGame: mode === "seat" ? getInitialSeatGameStateForWrite() : null,
    memoryBattle: mode === "memory" ? getInitialMemoryBattleStateForWrite() : null, bingo: mode === "bingo" ? getInitialBingoStateForWrite() : null,
    wordChallenge: mode === "word" ? getInitialWordChallengeStateForWrite() : null };
}

async function authenticateTeacher(password) {
  const { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword } =
    await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js");
  if (!teacherAuth) teacherAuth = initializeAuth(firebaseApp, { persistence: inMemoryPersistence });
  await signInWithEmailAndPassword(teacherAuth, TEACHER_ACCOUNT_EMAIL, password);
}

function endTeacherAuthentication() {
  if (teacherAuth?.currentUser) teacherAuth.signOut().catch(() => {});
}

function teacherAuthenticationError(error) {
  const code = error?.code || "";
  if (code.startsWith("auth/requests-from-referer-")) {
    return "Firebase 웹 키가 이 사이트의 로그인을 차단했습니다. Google Cloud에서 사이트 주소가 허용되어 있는지 확인해 주세요.";
  }
  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "교사용 비밀번호를 확인해 주세요.";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
      return "Firebase의 이메일/비밀번호 로그인이 설정되어 있는지 확인해 주세요.";
    case "auth/user-disabled":
      return "Firebase에서 교사용 계정이 비활성화되어 있습니다.";
    case "auth/too-many-requests":
      return "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.";
    case "auth/app-not-authorized":
    case "auth/unauthorized-domain":
    case "auth/api-key-service-blocked":
    case "auth/invalid-api-key":
      return "Firebase 인증 요청이 차단되었습니다. 웹 키의 사이트 및 인증 API 제한을 확인해 주세요.";
    case "auth/network-request-failed":
    case "auth/timeout":
      return "Firebase 인증 서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
    default:
      return "교사용 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

async function submitQuestion(event) {
  event.preventDefault();

  const question = cleanText(document.querySelector("#questionText").value);
  const questionType = document.querySelector("input[name='questionType']:checked")?.value === "short" ? "short" : "choice";
  const choices = [0, 1, 2, 3].map((index) => cleanText(document.querySelector(`#choice${index}`)?.value || ""));
  const correctInput = document.querySelector("input[name='correctIndex']:checked");
  const correctIndex = correctInput ? Number(correctInput.value) : -1;
  const correctAnswer = cleanText(document.querySelector("#correctAnswer")?.value || "");
  const editingQuestionId = cleanText(document.querySelector("#editingQuestionId")?.value || "");

  if (!question) {
    showToast("문제를 입력해 주세요.", "error");
    return;
  }

  if (questionType === "choice" && choices.some((choice) => !choice)) {
    showToast("선택지 4개를 모두 입력해 주세요.", "error");
    return;
  }
  if (questionType === "choice" && new Set(choices.map(normalizeShortAnswer)).size !== 4) {
    showToast("같은 선택지가 있습니다. 네 선택지를 서로 다르게 작성해 주세요.", "error");
    document.querySelector("#choice0")?.focus();
    return;
  }

  if (questionType === "choice" && (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3)) {
    showToast("정답 번호를 1~4 중에서 선택해 주세요.", "error");
    return;
  }

  if (questionType === "short" && !correctAnswer) {
    showToast("주관식 정답을 입력해 주세요.", "error");
    return;
  }

  const data = questionType === "short" ? { question, type: "short", correctAnswer } : { question, type: "choice", choices, correctIndex };
  return submitOwnedRoomContent("questions", editingQuestionId, data, renderStudentWaiting);
}

async function submitCompliment(event) {
  event.preventDefault();

  const targetStudentId = cleanText(document.querySelector("#complimentTarget").value);
  const editingComplimentId = cleanText(document.querySelector("#editingComplimentId")?.value || "");
  const allCompliments = getCompliments();
  const editingCompliment = editingComplimentId
    ? allCompliments.find((item) => item.id === editingComplimentId)
    : null;
  const targetStudent = getComplimentTargetOptions(editingCompliment).find((student) => student.id === targetStudentId);
  const clues = [0, 1, 2, 3, 4]
    .map((index) => cleanText(document.querySelector(`#complimentClue${index}`).value))
    .filter(Boolean);

  if (editingComplimentId && (!editingCompliment || editingCompliment.authorStudentId !== state.studentId)) {
    showToast("수정할 칭찬 카드를 찾지 못했습니다. 대기 화면에서 다시 선택해 주세요.", "error");
    return;
  }

  if (!targetStudentId) {
    showToast("칭찬할 친구를 선택해 주세요.", "error");
    return;
  }

  if (targetStudentId === state.studentId) {
    showToast("자기 자신은 칭찬 대상으로 선택할 수 없습니다.", "error");
    return;
  }

  const alreadyComplimentedTarget = findComplimentsByAuthor(state.studentId).some((compliment) => {
    return compliment.id !== editingComplimentId && compliment.targetStudentId === targetStudentId;
  });
  if (alreadyComplimentedTarget) {
    showToast("이미 다른 칭찬 카드에서 선택한 친구입니다. 다른 친구를 선택해 주세요.", "error");
    return;
  }

  if (!targetStudent) {
    showToast("칭찬할 친구를 선택해 주세요.", "error");
    return;
  }

  if (clues.length < 4) {
    showToast("칭찬 단서는 최소 4개 이상 입력해 주세요.", "error");
    return;
  }

  return submitOwnedRoomContent("compliments", editingComplimentId, { targetStudentId, clues }, renderComplimentWaiting);
}

async function submitOwnedRoomContent(collection, editingId, data, showWaiting) {
  if (securePilot) {
    const compliment = collection === "compliments";
    const result = await securePilot.send(compliment ? "submitCompliment" : "submitQuestion", { ...data, ...(editingId ? { id: editingId } : {}) });
    if (result.error) return showToast(securePilotError(result.error), "error");
    showToast(compliment ? "칭찬 카드가 제출되었습니다." : "문제가 제출되었습니다.", "success");
    if (state.role === "student" && state.room?.status === "waiting") showWaiting(true);
    return true;
  }
  if (state.role !== "student") return;
  const { roomCode, studentId, studentGeneration: generation } = state;
  const context = { collection, editingId, data, studentId, generation, contentId: editingId || createParticipantId(), timestamp: serverTimestamp() };
  try {
    const result = await runAccessCommand(roomCode, (room) => writeOwnedRoomContent(room, context));
    if (state.role !== "student" || state.roomCode !== roomCode || state.studentId !== studentId) return;
    if (result.error) return showToast(accessErrorMessage(result.error), "error");
    showToast(collection === "questions" ? "문제가 제출되었습니다." : "칭찬 카드가 제출되었습니다.", "success");
    if (["waiting", "collecting"].includes(state.room?.status || "waiting")) showWaiting(true);
    return true;
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("자료를 저장하지 못했습니다. 작성 내용은 그대로 유지됩니다.", "error");
  }
}

function writeOwnedRoomContent(room, request) {
  const { collection, studentId, editingId, contentId, generation, data, timestamp } = request;
  const quiz = collection === "questions";
  if (!quiz && collection !== "compliments") return { error: "invalid" };
  const student = room?.students?.[studentId];
  if (!student || student.removedAt || room.accessClosed || getRoomGeneration(room) !== generation) return { error: "session" };
  const mode = room.gameVariant || room.mode || "quiz";
  if (mode !== (quiz ? "quiz" : "compliment") || !(quiz ? ["waiting"] : ["waiting", "collecting"]).includes(room.status || "waiting")) return { error: "phase" };
  const records = room[collection] || {};
  const own = (key, item) => (quiz ? getQuestionOwnerId(room, key, item) : item?.authorStudentId) === studentId;
  if (!isParticipantKey(contentId) && !editingId) return { error: "invalid" };
  if (editingId && (!Object.hasOwn(records, editingId) || !own(editingId, records[editingId]))) return { error: "owner" };
  if (!editingId && Object.hasOwn(records, contentId)) return { error: "conflict" };
  const owned = Object.entries(records).filter(([key, item]) => own(key, item));
  const maximum = quiz ? clampInt(room.maxQuestionsPerStudent, 1, 10, MAX_QUESTIONS_PER_STUDENT) : clampInt(room.maxComplimentsPerStudent, 1, 10, MAX_COMPLIMENTS_PER_STUDENT);
  if (!editingId && owned.length >= maximum) return { error: "limit" };

  let validated;
  if (quiz) {
    const question = cleanText(data?.question);
    if (!question || question.length > 160) return { error: "invalid-content" };
    if (data.type === "short") {
      const correctAnswer = cleanText(data.correctAnswer);
      if (!correctAnswer || correctAnswer.length > 80) return { error: "invalid-content" };
      validated = { question, type: "short", correctAnswer };
    } else {
      const choices = normalizeChoices(data.choices).map(cleanText);
      if (choices.some((choice) => !choice || choice.length > 80) || new Set(choices.map(normalizeShortAnswer)).size !== 4 || !Number.isInteger(data.correctIndex) || data.correctIndex < 0 || data.correctIndex > 3) return { error: "invalid-content" };
      validated = { question, type: "choice", choices, correctIndex: data.correctIndex };
    }
  } else {
    const { targetStudentId } = data;
    const target = room.students?.[targetStudentId];
    if (!target?.name || target.removedAt || targetStudentId === studentId) return { error: "target" };
    if (owned.some(([id, item]) => id !== editingId && item.targetStudentId === targetStudentId)) return { error: "targetUsed" };
    const clues = normalizeComplimentClues(data.clues);
    if (clues.length < 4 || clues.some((clue) => clue.length > 120)) return { error: "invalid-content" };
    validated = { targetStudentId, targetName: target.name, clues };
  }
  room[collection] = { ...records, [contentId]: { ...validated, authorStudentId: studentId, authorName: student.name,
    ...(quiz ? { authorKey: nameToKey(student.name) } : {}), createdAt: records[contentId]?.createdAt || timestamp, updatedAt: timestamp } };
  return { room };
}

async function submitMafiaNightAction(selectedStudentId) {
  if (securePilot) {
    const result = await securePilot.send("mafiaNightChoice", { targetStudentId: selectedStudentId });
    return showToast(result.error ? securePilotError(result.error) : "밤 행동을 제출했습니다.", result.error ? "error" : "success");
  }
  if (state.room.status !== "nightAction") {
    showToast("지금은 밤 행동 시간이 아닙니다.", "error");
    return;
  }

  const player = getMafiaPlayer(state.studentId);
  const target = getMafiaPlayer(selectedStudentId);

  if (!player?.alive) {
    showToast("탈락자는 밤 행동에 참여할 수 없습니다.", "error");
    return;
  }

  if (!target?.alive) {
    showToast("생존자 중에서 선택해 주세요.", "error");
    return;
  }

  if (!getMafiaSettings().selfSelectAllowed && player.role !== "doctor" && selectedStudentId === state.studentId) {
    showToast("자기 자신은 선택할 수 없습니다.", "error");
    return;
  }

  if (getMafiaNightAction(player.id, player.role)) {
    showToast("밤 행동은 한 번만 선택할 수 있습니다.", "error");
    return;
  }

  const action = {
    selectedStudentId,
    selectedName: target.name,
    submittedAt: serverTimestamp()
  };

  if (player.role === "police") {
    action.result = target.role === "mafia" ? "mafia" : "not_mafia";
  }

  try {
    await set(ref(db, `rooms/${state.roomCode}/mafia/rounds/${getMafiaRoundNumber()}/nightActions/${player.role}/${player.id}`), action);
    showToast("밤 행동을 제출했습니다.", "success");
    if (isMafiaNightComplete()) {
      await calculateMafiaNightResult();
    }
    renderMafiaNightAction(true);
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("밤 행동을 저장하지 못했습니다.", "error");
  }
}

async function submitMafiaVote(selectedStudentId) {
  if (securePilot) {
    const result = await securePilot.send("mafiaVote", { targetStudentId: selectedStudentId });
    return showToast(result.error ? securePilotError(result.error) : "투표를 제출했습니다.", result.error ? "error" : "success");
  }
  if (state.room.status !== "voting") {
    showToast("지금은 투표 시간이 아닙니다.", "error");
    return;
  }

  const player = getMafiaPlayer(state.studentId);
  const target = getMafiaPlayer(selectedStudentId);

  if (!player?.alive) {
    showToast("탈락자는 투표할 수 없습니다.", "error");
    return;
  }

  if (!target?.alive) {
    showToast("생존자 중에서 투표해 주세요.", "error");
    return;
  }

  if (selectedStudentId === state.studentId) {
    showToast("자기 자신에게는 투표할 수 없습니다.", "error");
    return;
  }

  if (getMafiaVote(player.id)) {
    showToast("투표는 한 번만 할 수 있습니다.", "error");
    return;
  }

  try {
    await set(ref(db, `rooms/${state.roomCode}/mafia/rounds/${getMafiaRoundNumber()}/votes/${player.id}`), {
      selectedStudentId,
      selectedName: target.name,
      submittedAt: serverTimestamp()
    });
    showToast("투표를 제출했습니다.", "success");
    renderMafiaVoting(true);
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("투표를 저장하지 못했습니다.", "error");
  }
}

async function submitAnswer(selectedIndex, textAnswer = "") {
  if (state.answering) {
    return;
  }

  const questions = getQuestions();
  const question = questions[Number(state.room.currentQuestionIndex || 0)];
  if (!question || state.room.status !== "playing") {
    showToast("지금은 답을 제출할 수 없습니다.", "error");
    return;
  }

  const questionType = getQuestionType(question);
  const submittedText = cleanText(textAnswer);
  if (questionType === "short" && !submittedText) {
    showToast("주관식 정답을 입력해 주세요.", "error");
    return;
  }
  if (questionType === "choice" && (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3)) {
    showToast("선택지를 골라 주세요.", "error");
    return;
  }

  if (securePilot) {
    state.answering = true;
    try {
      const result = await securePilot.send("answer", { questionId: question.id, ...(questionType === "short" ? { text: submittedText } : { selectedIndex }) });
      if (result.error) showToast(securePilotError(result.error), "error");
      else { state.quizShortAnswerDraft = ""; showToast("답변이 제출되었습니다.", "success"); }
    } finally { state.answering = false; }
    return;
  }

  const { roomCode, studentId, studentGeneration: generation } = state;
  const request = { studentId, generation, questionId: question.id, index: Number(state.room.currentQuestionIndex || 0),
    startedAt: state.room.questionStartedAt, selectedIndex, submittedText, now: getUxRoomNow(), timestamp: serverTimestamp() };
  state.answering = true;
  try {
    const result = await runAccessCommand(roomCode, (room) => recordUxQuizAnswer(room, request));
    if (state.role !== "student" || state.roomCode !== roomCode || state.studentId !== studentId) return;
    if (result.room) {
      const answer = result.room.answers[question.id][studentId];
      showToast(answer.isCorrect ? `${answer.scoreEarned}점을 얻었습니다!` : "답변이 제출되었습니다.", answer.isCorrect ? "success" : "");
      state.quizShortAnswerDraft = "";
      renderStudentRoute();
    } else {
      showToast(accessErrorMessage(result.error), "error");
    }
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("답변을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
  } finally {
    state.answering = false;
  }
}

function recordUxQuizAnswer(room, request) {
  const { studentId, questionId, generation, index, startedAt, selectedIndex, submittedText, now, timestamp } = request;
  const student = room?.students?.[studentId];
  if (!student || student.removedAt || room.accessClosed || getRoomGeneration(room) !== generation) return { error: "session" };
  if ((room.gameVariant || room.mode || "quiz") !== "quiz" || room.status !== "playing"
    || Number(room.currentQuestionIndex || 0) !== index || room.questionStartedAt !== startedAt) return { error: "phase" };
  const order = normalizeQuestionOrder(room.questionOrder);
  const question = room.questions?.[questionId];
  if (!question || (order.length && order[index] !== questionId)) return { error: "phase" };
  if (room.answers?.[questionId]?.[studentId]) return { error: "already-answered" };
  const timeLimit = Number(room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS);
  const elapsed = Math.max(0, now - Number(startedAt || now)) / 1000;
  if (elapsed >= timeLimit) return { error: "timeout" };
  const answerType = getQuestionType(question);
  if (answerType === "short" ? !submittedText || submittedText.length > 80 : !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) return { error: "invalid-content" };
  const isOwnBlocked = !getUxQuizOptions(room).allowOwn && getQuestionOwnerId(room, questionId, question) === studentId;
  const isCorrect = !isOwnBlocked && (answerType === "short" ? normalizeShortAnswer(submittedText) === normalizeShortAnswer(question.correctAnswer) : selectedIndex === Number(question.correctIndex));
  const scoreEarned = isCorrect ? Math.round(500 + ((timeLimit - elapsed) / timeLimit) * 500) : 0;
  room.answers ||= {};
  room.answers[questionId] ||= {};
  room.answers[questionId][studentId] = { name: student.name, answerType, isCorrect, scoreEarned, responseTime: Math.round(elapsed * 10) / 10,
    answeredAt: timestamp, ...(answerType === "short" ? { textAnswer: submittedText } : { selectedIndex }) };
  student.score = Number(student.score || 0) + scoreEarned;
  return { room };
}

async function submitComplimentTargetGuess(selectedStudentId) {
  const compliment = getCurrentCompliment();
  if (!compliment || state.room.status !== "playing") {
    showToast("지금은 칭찬 대상을 제출할 수 없습니다.", "error");
    return;
  }

  if (securePilot) {
    const result = await securePilot.send("guessComplimentTarget", { cardId: compliment.id, clueIndex: Number(state.room.currentClueIndex || 0), targetStudentId: selectedStudentId });
    if (result.error) return showToast(securePilotError(result.error), "error");
    return showToast(result.correct ? `정답입니다! ${result.points}점을 얻었습니다.` : "아쉽지만 아니에요. 다음 단서에서 다시 도전해 보세요.", result.correct ? "success" : "");
  }
  if (compliment.authorStudentId === state.studentId) {
    showToast("내가 작성한 칭찬은 맞힐 수 없습니다.", "error");
    return;
  }

  const clueIndex = Number(state.room.currentClueIndex || 0);
  const answerPath = ref(db, `rooms/${state.roomCode}/complimentAnswers/${compliment.id}/targetGuesses/${state.studentId}`);
  const existing = (await get(answerPath)).val();

  if (Number.isInteger(existing?.firstCorrectClueIndex)) {
    showToast("이미 이 칭찬의 대상을 맞혔습니다.", "error");
    return;
  }

  if (existing?.guesses?.[clueIndex]) {
    showToast("이번 단서에서는 이미 추리했습니다.", "error");
    return;
  }

  const selectedName = getStudentNameById(selectedStudentId, "선택한 학생");
  const isCorrect = selectedStudentId === compliment.targetStudentId;
  const scoreEarned = isCorrect ? getComplimentTargetPoint(clueIndex) : 0;
  const updates = {
    name: state.studentName,
    [`guesses/${clueIndex}`]: {
      selectedStudentId,
      selectedName,
      isCorrect,
      submittedAt: serverTimestamp()
    }
  };

  if (isCorrect) {
    updates.firstCorrectClueIndex = clueIndex;
    updates.scoreEarned = scoreEarned;
  }

  try {
    await update(answerPath, updates);
    if (scoreEarned > 0) {
      await incrementStudentScore(state.studentId, scoreEarned);
    }
    showToast(isCorrect ? `정답입니다! ${scoreEarned}점을 얻었습니다.` : "아쉽지만 아니에요. 다음 단서에서 다시 도전해 보세요.", isCorrect ? "success" : "");
    renderComplimentTargetGuess(true);
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("추리 답변을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
  }
}

async function submitComplimentAuthorGuess(selectedStudentId) {
  const compliment = getCurrentCompliment();
  if (!compliment || state.room.status !== "authorGuess") {
    showToast("지금은 작성자 추리를 제출할 수 없습니다.", "error");
    return;
  }

  if (securePilot) {
    const result = await securePilot.send("guessComplimentAuthor", { cardId: compliment.id, targetStudentId: selectedStudentId });
    return showToast(result.error ? securePilotError(result.error) : "작성자 추리가 제출되었습니다.", result.error ? "error" : "success");
  }
  if (compliment.authorStudentId === state.studentId) {
    showToast("내가 작성한 칭찬의 작성자 추리는 할 수 없습니다.", "error");
    return;
  }

  const answerPath = ref(db, `rooms/${state.roomCode}/complimentAnswers/${compliment.id}/authorGuesses/${state.studentId}`);
  const existing = await get(answerPath);
  if (existing.exists()) {
    showToast("작성자 추리는 한 번만 제출할 수 있습니다.", "error");
    return;
  }

  const selectedName = getStudentNameById(selectedStudentId, "선택한 학생");
  const isCorrect = selectedStudentId === compliment.authorStudentId;
  const scoreEarned = isCorrect ? COMPLIMENT_AUTHOR_BONUS : 0;

  try {
    await set(answerPath, {
      name: state.studentName,
      selectedStudentId,
      selectedName,
      isCorrect,
      scoreEarned,
      submittedAt: serverTimestamp()
    });
    if (scoreEarned > 0) {
      await incrementStudentScore(state.studentId, scoreEarned);
    }
    showToast(isCorrect ? `작성자 정답! ${scoreEarned}점을 얻었습니다.` : "작성자 추리가 제출되었습니다.", isCorrect ? "success" : "");
    renderComplimentAuthorGuess(true);
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("작성자 추리를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
  }
}

async function ensureOwnQuestionSkipped(question) {
  const key = `${question.id}:${state.studentId}`;
  if (state.skipWriteKey === key) {
    return;
  }

  state.skipWriteKey = key;
  const answerPath = ref(db, `rooms/${state.roomCode}/answers/${question.id}/${state.studentId}`);
  try {
    await runTransaction(answerPath, (current) => current || {
      name: state.studentName,
      isCorrect: false,
      isSkipped: true,
      responseTime: 0,
      scoreEarned: 0,
      answeredAt: serverTimestamp()
    });
  } catch (error) {
    finalRelease?.record("app-error");
  }
}

// =========================
// 교사 액션
// =========================

function supportsFinalRankingCover(mode) {
  return ["quiz", "compliment", "catchmind", "memory", "bingo", "word"].includes(mode);
}

function getFinalReleaseContext() {
  const room = state.room;
  const mode = room ? getRoomMode() : "";
  const status = room?.status || "waiting";
  let guideNote = "";
  if (mode === "quiz") {
    const options = getUxQuizOptions();
    guideNote = `학생당 최대 ${getMaxQuestionsPerStudent()}문제 · 문제당 ${room.timeLimit && status !== "waiting" ? room.timeLimit : options.seconds}초 · 본인 문제 ${options.allowOwn ? "풀이 가능" : "풀이 제외"}`;
  } else if (mode === "memory") guideNote = `${getMemoryBoardSize()}×${getMemoryBoardSize()} · 이미지 ${getMemoryRequiredImageCount()}장 · 암기 ${getUxMemoryPreviewSeconds()}초`;
  else if (mode === "bingo") guideNote = `빙고판 ${getBingoSize()}×${getBingoSize()}`;
  else if (mode === "compliment") guideNote = `학생당 최대 ${getMaxComplimentsPerStudent()}장`;
  return {
    role: state.role, mode, status, view: state.activeView, title: room ? modeLabel(mode) : "동명중학교 PLAYGROUND", label: modeLabel,
    phaseLabel: statusLabel(status), roomCode: state.roomCode, guideNote, auth: Boolean(teacherAuth?.currentUser),
    covered: Boolean(room?.displayCovered), hideFinal: Boolean(room?.displayHideFinalRanking), canHideFinal: !securePilot && supportsFinalRankingCover(mode),
    ghost: state.role === "student" && mode === "mafia" && getMafiaPlayer(state.studentId)?.alive === false,
    genChecks: () => collectFinalPreflight(room), command: setFinalDisplaySetting, notice: (message) => showToast(message, "info")
  };
}

function getFinalTeacherModes() {
  const favorite = finalRelease?.favorites() || [];
  return [...favorite, ...Object.keys(PLAYGROUND_MODE_ART).filter((mode) => !favorite.includes(mode))];
}

function decorateSecurePilot() {
  if (!securePilot) return;
  for (const element of appEl.querySelectorAll('[data-switch-mode], .mode-tile')) {
    if (!securePilot.modes.includes(element.dataset.mode)) element.hidden = true;
  }
  for (const element of appEl.querySelectorAll('[data-action="clear-room"], .release-home-tools')) element.hidden = true;
}

function securePilotError(code) {
  return ({
    credential: "검수용 교사 비밀번호를 확인해 주세요.",
    "duplicate-name": "이 방에서 이미 사용 중인 이름입니다. 다른 이름을 입력해 주세요.",
    name: "이름은 문자와 숫자로 2~5글자만 입력해 주세요.",
    room: "방이 없거나 기존 참가 기록이 이 방과 맞지 않습니다.",
    session: "기존 참가를 복원하지 못했습니다. 새로 참가하려면 다른 학생을 선택해 주세요.",
    "room-exists": "이미 사용 중인 방 코드입니다. 기존 방 열기를 선택해 주세요.",
    "entry-locked": "현재 이 방에 입장할 수 없습니다. 선생님에게 확인해 주세요.",
    "stale-host": "이 창의 제어권이 없습니다. 진행 중인 교사 창으로 돌아가 주세요.",
    "stale-control": "다른 변경이 먼저 적용됐습니다. 새 상태를 확인해 주세요.",
    expired: "교사 제어권이 만료됐습니다. 다시 가져와 주세요.",
    forbidden: "이 정보나 작업을 사용할 권한이 없습니다.",
    phase: "게임 단계가 바뀌었습니다. 새 상태를 확인해 주세요.",
    empty: "시작할 문제가 없습니다.",
    quota: "제출 가능 개수를 모두 사용했습니다.",
    "already-answered": "한 문제에는 한 번만 답할 수 있습니다.",
    closed: "답안 제출 시간이 끝났습니다.",
    "duplicate-word": "이미 제출한 단어입니다.",
    "already-reviewed": "이미 처리된 단어입니다.",
    "word-invalid": "초성과 제한 시간 설정 또는 입력한 단어를 확인해 주세요.",
    "pending-review": "검토하지 않은 단어가 남았습니다.",
    "bingo-approval": "선생님이 설명을 승인한 뒤 진행할 수 있습니다.",
    "bingo-line": "완성된 빙고 줄이 없습니다.",
    "liar-settings": "서로 다른 제시어 두 개와 참가 인원에 맞는 라이어 수를 확인해 주세요.",
    "liar-target": "본인을 제외한 참가 친구에게 투표해 주세요.",
    "already-voted": "이미 투표했습니다.",
    "liar-pending": "아직 투표하지 않은 학생이 있습니다.",
    "mafia-settings": "학생 수에 맞게 역할 인원과 토론 시간을 확인해 주세요. 마피아는 시민팀보다 적어야 합니다.",
    "mafia-target": "생존자 중 선택해 주세요. 자기 자신은 의사의 밤 행동에서만 선택할 수 있습니다.",
    "mafia-chat-rate": "잠시 후 다시 보내 주세요.",
    "compliment-card": "본인이 아닌 친구를 선택하고 120자 이내의 단서 4~5개를 입력해 주세요.",
    "compliment-duplicate-target": "이미 칭찬한 친구입니다. 다른 친구를 선택해 주세요.",
    "catchmind-members": "학생이 2명 이상 입장해야 시작할 수 있습니다.",
    "catchmind-settings": "제시어·라운드 수·제한 시간을 확인해 주세요. 한 제시어는 40자까지 입력할 수 있습니다.",
    "catchmind-guess-rate": "잠시 후 다시 제출해 주세요.",
    "catchmind-canvas-stale": "그림이 변경되었습니다. 새 획을 그려 주세요.",
    "catchmind-canvas-full": "그림이 가득 찼습니다. 일부를 되돌리거나 모두 지워 주세요.",
    "seat-layout": "참가 학생 수와 사용 가능한 자리 수를 확인해 주세요.",
    "seat-target": "이미 선택됐거나 보호된 자리입니다. 선택 가능한 자리를 다시 골라 주세요.",
    "seat-turn": "아직 자신의 차례가 아닙니다.",
    "seat-card-used": "이미 사용했거나 보유하지 않은 카드입니다.",
    "memory-images": "선택한 판 크기에 맞는 이미지를 올려 주세요. 이미지 한 장은 140KB까지 가능합니다.",
    "memory-members": "학생이 한 명 이상 입장해야 게임을 만들 수 있습니다.",
    "memory-unready": "아직 이미지를 불러오는 학생이 있습니다. 준비 상태를 확인해 주세요.",
    "memory-flip-used": "이미 공개했거나 짝을 맞힌 카드입니다."
  })[code] || "검수 서버에서 요청을 처리하지 못했습니다. 연결을 확인해 주세요.";
}

async function securePilotHostCommand(action, payload = {}, silent = false) {
  if (state.role !== "teacher") return;
  const result = await securePilot.send(action, payload, { host: true });
  if (result.error && !silent) showToast(securePilotError(result.error), "error");
  return result;
}

function handleSecurePilotTeacherAction(action) {
  if (action === "open-display") return openDisplayWindow();
  if (getRoomMode() === "memory") {
    const handler = ({ "memory-create": createMemoryGame, "memory-start": startMemoryGame, "memory-end": endMemoryGame,
      "memory-reveal": revealMemoryResults, "memory-restart-same": restartMemoryGameWithSameImages,
      "memory-new-images": configureMemoryGameWithNewImages, "memory-toggle-records": toggleMemoryRecords, "memory-clear-records": clearSelectedMemoryRecords })[action];
    return handler?.();
  }
  if (getRoomMode() === "seat") {
    const handler = ({ "ux-seat-layout": previewUxSeatLayout, "seat-save-settings": saveSeatGameSettings, "seat-start": () => startSeatGame(),
      "seat-end-card": () => endSeatCardPhase(), "seat-final-reveal": revealSeatFinal, "seat-restart-same": () => startSeatGame({ reuseSettings: true }),
      "seat-configure": configureSeatGame })[action];
    return handler?.();
  }
  if (getRoomMode() === "catchmind") {
    const handler = ({ "catchmind-save-settings": saveCatchmindSettings, "catchmind-start-game": () => startCatchmindGame(),
      "catchmind-start-round": startCatchmindRound, "catchmind-end-round": () => endCatchmindRound({ forced: true }),
      "catchmind-next-round": nextCatchmindRound, "catchmind-toggle-answer": toggleCatchmindTeacherAnswer,
      "catchmind-restart-same": () => startCatchmindGame({ reuseSettings: true }), "catchmind-configure": configureCatchmindGame,
      reset: configureCatchmindGame })[action];
    return handler?.();
  }
  if (getRoomMode() === "compliment") {
    if (action === "save-compliment-settings") return securePilotHostCommand("complimentSettings", { quota: Number(document.querySelector("#maxComplimentsInput")?.value) });
    if (action === "start-compliment" && securePilot.isController()) openDisplayWindow({ silent: true });
    if (action === "reset") return resetGame();
    const command = ({ "start-compliment": "startCompliment", "compliment-next-clue": "nextComplimentClue", "compliment-reveal-target": "revealComplimentTarget",
      "compliment-author-guess": "openComplimentAuthor", "compliment-reveal-author": "revealComplimentAuthor", "compliment-next-card": "nextCompliment", finish: "finishCompliment" })[action];
    return command ? securePilotHostCommand(command) : undefined;
  }
  if (getRoomMode() === "mafia") {
    if (action === "ux-mafia-recommend") return recommendUxMafiaRoles();
    if (action === "mafia-save-settings") return securePilotHostCommand("mafiaSettings", readMafiaSettingsFromForm());
    if (action === "mafia-assign") {
      if (securePilot.isController()) openDisplayWindow({ silent: true });
      return securePilotHostCommand("assignMafia", readMafiaSettingsFromForm());
    }
    if (action === "reset" && window.confirm("마피아 진행 기록만 지우고 참가 학생은 유지할까요?")) {
      return securePilotHostCommand("resetMafia", { confirmed: true });
    }
    const command = ({ "mafia-role-reveal": "openMafiaRoles", "mafia-start-night": "openMafiaNight", "mafia-calc-night": "calculateMafiaNight",
      "mafia-publish-night": "publishMafiaNight", "mafia-start-discussion": "openMafiaDiscussion", "mafia-start-voting": "openMafiaVoting",
      "mafia-reveal-vote": "publishMafiaVotes", "mafia-reveal-role": "revealMafiaRole", "mafia-next-night": "nextMafiaNight", "mafia-finish": "finishMafia" })[action];
    return command ? securePilotHostCommand(command) : undefined;
  }
  if (getRoomMode() === "liar") {
    if (action === "ux-liar-recommend") return recommendUxLiarWords();
    if (action === "liar-save-settings") return securePilotHostCommand("liarSettings", readLiarSettingsFromForm());
    if (action === "liar-start" || action === "liar-restart-same") {
      if (securePilot.isController()) openDisplayWindow({ silent: true });
      return securePilotHostCommand("startLiar", action === "liar-start" ? readLiarSettingsFromForm() : { reuse: true });
    }
    if (action === "liar-start-voting") return securePilotHostCommand("openLiarVoting");
    if (action === "liar-reveal-vote") return securePilotHostCommand("revealLiarVotes");
    if (action === "liar-force-vote" && window.confirm("투표를 마감하고 결과를 공개할까요?")) return securePilotHostCommand("revealLiarVotes", { force: true });
    if (action === "liar-reveal-answer" && window.confirm("실제 라이어와 제시어를 공개할까요?")) return securePilotHostCommand("revealLiarRoles");
    if (["liar-configure", "reset"].includes(action) && window.confirm("배정과 투표를 지우고 라이어 설정으로 돌아갈까요?")) {
      return securePilotHostCommand("resetLiar", { confirmed: true });
    }
    return;
  }
  if (getRoomMode() === "bingo") {
    if (action === "bingo-save-settings") return saveBingoSettings();
    if (action === "bingo-next-turn" || action === "bingo-skip-turn") return nextBingoTurn({ skip: action === "bingo-skip-turn" });
    if (action === "bingo-start") {
      if (securePilot.isController()) openDisplayWindow({ silent: true });
      return securePilotHostCommand("startBingo");
    }
    if (action === "bingo-approve-call" || action === "bingo-reject-call") return securePilotHostCommand("reviewBingoCall", {
      callId: getBingoState().currentCall?.callId, approved: action === "bingo-approve-call"
    });
    if (action === "bingo-finish" && window.confirm("개념 빙고를 종료하고 결과를 공개할까요?")) return securePilotHostCommand("finishBingo", { confirmed: true });
    if (action === "reset" && window.confirm("색칠과 결과만 초기화하고 기존 빙고판을 유지할까요?")) return securePilotHostCommand("resetBingo", { confirmed: true });
    return;
  }
  if (getRoomMode() === "word") {
    if (action === "word-save-settings") return securePilotHostCommand("wordSettings", {
      chosung: document.querySelector("#wordChosungInput")?.value || "",
      duration: Number(document.querySelector("#wordDurationInput")?.value)
    });
    if (action === "word-start" && securePilot.isController()) openDisplayWindow({ silent: true });
    if (action === "word-restart" || action === "reset") {
      if (window.confirm("참가 학생은 유지하고 새 초성 게임을 준비할까요?")) return securePilotHostCommand("resetWord", { confirmed: true });
      return;
    }
    const command = ({ "word-start": "startWord", "word-review": "wordReviewPhase", "word-finish": "finishWord" })[action];
    if (command) return securePilotHostCommand(command);
  }
  if (action === "reset") return resetGame();
  if (action === "save-quiz-settings") {
    const opts = getUxQuizOptions();
    return securePilotHostCommand("settings", {
      quota: clampInt(document.querySelector("#maxQuestionsInput")?.value, 1, 10, getMaxQuestionsPerStudent()),
      timeLimit: clampInt(document.querySelector("#uxQuizSeconds")?.value, 5, 120, opts.seconds),
      randomOrder: document.querySelector("#uxQuizOrder")?.value !== "submitted",
      allowOwn: document.querySelector("#uxQuizOwn")?.checked ?? opts.allowOwn,
      autoReveal: document.querySelector("#uxQuizReveal")?.checked ?? opts.autoReveal,
      policy: state.room?.pilotPolicy || "normal"
    });
  }
  if (action === "start" && securePilot.isController()) openDisplayWindow({ silent: true });
  const command = ({ start: "startQuiz", "restart-current": "restartQuestion", reveal: "reveal", next: "next", finish: "finishQuiz" })[action];
  if (command) return securePilotHostCommand(command);
}

function acceptReleaseTeacherAction(silent = false) {
  if (!finalRelease) return true;
  if (!finalRelease.canOperate()) {
    if (!silent) showToast("이 브라우저의 진행 창에서만 변경할 수 있습니다.", "error");
    return false;
  }
  if (!finalRelease.roomCompatible(state.room)) {
    if (!silent) showToast(accessErrorMessage("protocol"), "error");
    return false;
  }
  return true;
}

function blockReadOnlyTeacherClick(event) {
  if (state.role !== "teacher" || (finalRelease.canOperate() && finalRelease.roomCompatible(state.room))) return;
  const button = event.target.closest?.("button");
  if (!button || !button.closest("#app, #uxHostDialog")) return;
  if (button.id === "backHomeBtn" || button.id === "copyRoomCodeBtn" || button.matches("[data-release],[data-ux-open-host],[data-view-question],[data-ux-pane]")) return;
  if (button.dataset.action === "open-display" || ["close", "copy-join", "copy-screen"].includes(button.dataset.uxHost)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  acceptReleaseTeacherAction();
}

async function setFinalDisplaySetting(action) {
  if (securePilot) return action === "cover" && !(await securePilot.send("coverDisplay", { enabled: !state.room?.displayCovered }, { host: true })).error;
  const field = action === "cover" ? "displayCovered" : action === "score" ? "displayHideFinalRanking" : "";
  const roomCode = state.roomCode;
  const generation = getRoomGeneration(state.room);
  const before = Boolean(state.room?.[field]);
  if (!field || state.role !== "teacher" || !hasRoomHostAccess(state.room) || !acceptReleaseTeacherAction()) return false;
  try {
    const result = await runAccessCommand(roomCode, (room) => {
      if (!hasRoomHostAccess(room) || !finalRelease.canOperate() || getRoomGeneration(room) !== generation || Boolean(room[field]) !== before) return { error: "conflict" };
      room[field] = !before;
      return { room };
    });
    if (result.error) finalRelease.record("display-write");
    return Boolean(result.room);
  } catch {
    finalRelease.record("display-write");
    return false;
  }
}

function isFinalStartAction(action) {
  return ["start", "start-compliment", "mafia-assign", "liar-start", "catchmind-start-game", "seat-start", "memory-create", "memory-start", "bingo-start", "word-start"].includes(action);
}

function collectFinalPreflight(room) {
  if (!room) return [{ level: "required", text: "방 정보를 확인하지 못했습니다." }];
  const mode = room.gameVariant || room.mode || "quiz";
  const people = Object.entries(room.students || {}).filter(([, student]) => student?.name && !student.removedAt);
  const number = people.length;
  const connections = room.presence?.[getPresenceKey(getRoomGeneration(room))] || {};
  const connected = people.filter(([id, student]) => student.presenceV2 ? Object.keys(connections[id] || {}).length : student.connected).length;
  const checks = [];
  const add = (valid, text) => checks.push({ level: valid ? "ok" : "required", text });
  if (room.accessClosed) add(false, "수업 도구에서 방을 다시 열어 주세요.");
  if (mode === "quiz") add(Boolean(Object.keys(room.questions || {}).length), "제출된 문제가 한 개 이상 필요합니다.");
  if (mode === "compliment") add(Object.values(room.compliments || {}).some((card) => card.authorStudentId && card.targetStudentId && normalizeComplimentClues(card.clues).length >= 4), "유효한 칭찬 카드가 한 장 이상 필요합니다.");
  if (mode === "liar") {
    const { wordA, wordB } = readLiarSettingsFromForm();
    add(number >= 2, "라이어게임은 두 명 이상 필요합니다.");
    add(Boolean(wordA && wordB && normalizeShortAnswer(wordA) !== normalizeShortAnswer(wordB)), "서로 다른 제시어 두 개가 필요합니다.");
  }
  if (mode === "mafia") {
    const { mafiaCount, policeCount, doctorCount } = readMafiaSettingsFromForm();
    add(number > 0 && mafiaCount + policeCount + doctorCount <= number && mafiaCount < number - mafiaCount, "학생 수와 역할 구성을 확인하세요. 마피아는 시민 팀보다 적어야 합니다.");
  }
  if (mode === "catchmind") {
    const { wordList, totalRounds } = readCatchmindSettingsFromForm();
    add(number >= 2, "캐치마인드는 두 명 이상 필요합니다.");
    add(Boolean(wordList?.length && wordList.length >= totalRounds), "라운드 수만큼 제시어가 필요합니다.");
  }
  if (mode === "seat") add(Boolean(number && getSeatActiveNumbers(readSeatSettingsFromForm()).length === number), "활성 좌석 수가 참가 학생 수와 같아야 합니다.");
  if (mode === "memory" && room.status === "memoryReady") {
    const ids = Object.keys(room.memoryBattle?.participants || {});
    const ready = ids.filter((id) => room.memoryBattle.players?.[id]?.ready).length;
    add(ids.length > 0, "게임에 등록된 참가자가 필요합니다.");
    checks.push({ level: ready === ids.length ? "ok" : "warn", text: `이미지 준비 ${ready}/${ids.length}명` });
  } else if (mode === "memory") {
    const size = normalizeMemoryBoardSize(state.memorySettingsDraft?.boardSize);
    add(state.memoryImageDraft.length === getMemoryRequiredImageCount(size), `${size}×${size} 카드판에 이미지 ${getMemoryRequiredImageCount(size)}장이 필요합니다.`);
    add(connected > 0, "접속 중인 학생이 한 명 이상 필요합니다.");
  }
  if (mode === "bingo") {
    const size = clampInt(room.bingo?.settings?.size, MIN_BINGO_SIZE, MAX_BINGO_SIZE, DEFAULT_BINGO_SIZE);
    add(Object.values(room.bingo?.boards || {}).some((board) => Number(board.size) === size && normalizeBingoCells(board.cells, size).every(Boolean)), "빈칸 없이 제출된 빙고판이 한 개 이상 필요합니다.");
  }
  if (mode === "word") {
    add(number > 0, "참가 학생이 한 명 이상 필요합니다.");
    add(isValidWordChallengeChosung(room.wordChallenge?.settings?.chosung || ""), "초성을 저장한 뒤 시작하세요.");
  }
  if (number && connected < number) checks.push({ level: "warn", text: `참가 ${number}명 중 접속 ${connected}명` });
  return checks;
}

async function runFinalPreflight(action, handler) {
  if (state.finalPreflightPending) return;
  const roomCode = state.roomCode;
  const generation = getRoomGeneration(state.room);
  const status = state.room?.status || "waiting";
  const mode = getRoomMode();
  if (status !== "waiting" && !(mode === "memory" && status === "memoryReady") && !(mode === "compliment" && status === "collecting")) return handler();
  state.finalPreflightPending = true;
  try {
    const latest = (await get(roomRef(roomCode))).val();
    if (state.role !== "teacher" || state.roomCode !== roomCode || getRoomMode() !== mode || !acceptReleaseTeacherAction(true)) return;
    if (!latest || !hasRoomHostAccess(latest) || !finalRelease.roomCompatible(latest) || getRoomGeneration(latest) !== generation
      || (latest.status || "waiting") !== status || (latest.gameVariant || latest.mode || "quiz") !== mode) {
      return showToast("방 상태가 바뀌었습니다. 시작 전 점검을 다시 확인해 주세요.", "error");
    }
    const checks = collectFinalPreflight(latest);
    const failure = checks.find((item) => item.level === "required");
    if (failure) return showToast(failure.text, "error");
    const warnings = checks.filter((item) => item.level === "warn").map((item) => item.text);
    if (warnings.length && action !== "memory-start" && !window.confirm(`${warnings.join("\n")}\n계속 진행할까요?`)) return;
    return await handler();
  } catch {
    finalRelease.record("preflight-read");
    showToast("시작 전 방 상태를 확인하지 못했습니다. 연결을 확인해 주세요.", "error");
  } finally { state.finalPreflightPending = false; }
}

function handleTeacherAction(action) {
  if (securePilot) return handleSecurePilotTeacherAction(action);
  if (action !== "open-display" && !acceptReleaseTeacherAction()) return;
  if (state.room?.accessClosed && action !== "open-display") return showToast("수업 도구에서 방을 다시 열어 주세요.", "error");
  const actions = {
    "ux-mafia-recommend": recommendUxMafiaRoles,
    "ux-liar-recommend": recommendUxLiarWords,
    "ux-seat-layout": previewUxSeatLayout,
    "ux-word-recommend": recommendUxWordChosung,
    start: startGame,
    "save-quiz-settings": saveQuizSettings,
    "restart-current": restartCurrentQuestion,
    reveal: () => revealAnswer(false),
    next: nextQuestion,
    finish: finishGame,
    reset: resetGame,
    "clear-room": clearRoomLists,
    "open-display": () => finalRelease?.isDemo ? window.dispatchEvent(new Event("playground-demo-show-display")) : openDisplayWindow(),
    "start-compliment": startComplimentGame,
    "save-compliment-settings": saveComplimentSettings,
    "compliment-next-clue": showNextComplimentClue,
    "compliment-reveal-target": revealComplimentTarget,
    "compliment-author-guess": startComplimentAuthorGuess,
    "compliment-reveal-author": revealComplimentAuthor,
    "compliment-next-card": nextComplimentCard,
    "mafia-save-settings": saveMafiaSettings,
    "mafia-assign": assignMafiaRoles,
    "mafia-role-reveal": startMafiaRoleReveal,
    "mafia-start-night": startMafiaNight,
    "mafia-calc-night": () => calculateMafiaNightResult({ showToastOnComplete: true }),
    "mafia-publish-night": publishMafiaNightResult,
    "mafia-start-discussion": startMafiaDiscussion,
    "mafia-start-voting": startMafiaVoting,
    "mafia-reveal-vote": revealMafiaVoteResult,
    "mafia-reveal-role": revealMafiaEliminatedRole,
    "mafia-next-night": startNextMafiaNight,
    "mafia-finish": finishMafiaGame,
    "liar-save-settings": saveLiarSettings,
    "liar-start": () => startLiarGame(),
    "liar-start-voting": startLiarVoting,
    "liar-reveal-vote": revealLiarVoteResult,
    "liar-force-vote": forceCloseLiarVoting,
    "liar-reveal-answer": revealLiarAnswer,
    "liar-restart-same": () => startLiarGame({ reuseSettings: true }),
    "liar-configure": configureLiarGame,
    "catchmind-save-settings": saveCatchmindSettings,
    "catchmind-start-game": () => startCatchmindGame(),
    "catchmind-drawer-ready": confirmCatchmindDrawerReady,
    "catchmind-start-round": startCatchmindRound,
    "catchmind-end-round": () => endCatchmindRound({ forced: true }),
    "catchmind-next-round": nextCatchmindRound,
    "catchmind-toggle-answer": toggleCatchmindTeacherAnswer,
    "catchmind-restart-same": () => startCatchmindGame({ reuseSettings: true }),
    "catchmind-configure": configureCatchmindGame,
    "seat-save-settings": saveSeatGameSettings,
    "seat-start": () => startSeatGame(),
    "seat-end-card": endSeatCardPhase,
    "seat-final-reveal": revealSeatFinal,
    "seat-restart-same": () => startSeatGame({ reuseSettings: true }),
    "seat-configure": configureSeatGame,
    "memory-create": createMemoryGame,
    "memory-start": startMemoryGame,
    "memory-end": endMemoryGame,
    "memory-reveal": revealMemoryResults,
    "memory-restart-same": restartMemoryGameWithSameImages,
    "memory-new-images": configureMemoryGameWithNewImages,
    "memory-toggle-records": toggleMemoryRecords,
    "memory-clear-records": clearSelectedMemoryRecords,
    "bingo-save-settings": saveBingoSettings,
    "bingo-start": startBingoGame,
    "bingo-approve-call": approveBingoCall,
    "bingo-reject-call": rejectBingoCall,
    "bingo-next-turn": () => nextBingoTurn(),
    "bingo-skip-turn": () => nextBingoTurn({ skip: true }),
    "bingo-finish": finishBingoGame,
    "word-save-settings": saveWordChallengeSettings,
    "word-start": startWordChallenge,
    "word-review": enterWordChallengeReview,
    "word-finish": finishWordChallenge,
    "word-restart": resetWordChallengeWithStudents
  };
  const handler = actions[action];
  if (handler && finalRelease && isFinalStartAction(action)) return runFinalPreflight(action, handler);
  return handler?.();
}

function uxFillField(selector, value) {
  const field = document.querySelector(selector);
  if (!field || field.disabled) return false;
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function getUxRecommendedMafiaRoles(count) {
  if (count < 3) return null;
  return { mafia: Math.min(10, Math.max(1, Math.floor(count / 5))), police: count >= 5 ? 1 : 0, doctor: count >= 6 ? 1 : 0 };
}

function recommendUxMafiaRoles() {
  const roles = getUxRecommendedMafiaRoles(getStudents().length);
  if ((state.room.status || "waiting") !== "waiting" || !roles) return;
  uxFillField("#mafiaCountInput", roles.mafia);
  uxFillField("#policeCountInput", roles.police);
  uxFillField("#doctorCountInput", roles.doctor);
}

function recommendUxLiarWords() {
  const pairs = [["수박", "참외"], ["기차", "지하철"], ["칠판", "화이트보드"], ["볼펜", "만년필"], ["농구", "배구"], ["도서관", "서점"]];
  const current = document.querySelector("#liarWordAInput")?.value;
  const [first, second] = shuffleArray(pairs.filter(([word]) => word !== current))[0];
  uxFillField("#liarWordAInput", first);
  uxFillField("#liarWordBInput", second);
}

function previewUxSeatLayout() {
  const value = document.querySelector("#uxSeatLayout")?.value;
  if (!value || (state.room.status || "waiting") !== "waiting") return;
  const [rows, columns] = value.split("x").map(Number);
  state.seatSettingsDraft = normalizeSeatGameSettings({ ...readSeatSettingsFromForm(), rows, columns });
  uxFillField("#seatRowsInput", rows);
  uxFillField("#seatColumnsInput", columns);
  renderSeatTeacherDashboard(true);
}

function recommendUxWordChosung() {
  const current = document.querySelector("#wordChosungInput")?.value;
  const suggested = shuffleArray(["ㄱㅅ", "ㅅㄱ", "ㅂㄱ", "ㄷㅁ", "ㅈㅇ", "ㅎㄱ", "ㅁㅈ"].filter((value) => value !== current))[0];
  uxFillField("#wordChosungInput", suggested);
}

async function startGame() {
  if (!getQuestions().length || state.room.accessClosed) {
    showToast(state.room.accessClosed ? "수업 도구에서 방을 다시 열어 주세요." : "시작할 문제가 없습니다.", "error");
    return;
  }

  openDisplayWindow();
  const code = state.roomCode;
  const generation = getRoomGeneration(state.room);
  try {
    const result = await runAccessCommand(code, (room) => startUxQuizRound(room, generation, serverTimestamp()));
    if (result.error) return showToast(accessErrorMessage(result.error), "error");
    showToast("게임을 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("게임을 시작하지 못했습니다.", "error");
  }
}

function startUxQuizRound(room, generation, timestamp) {
  if (!hasRoomHostAccess(room) || getRoomGeneration(room) !== generation || room.accessClosed
    || (room.gameVariant || room.mode || "quiz") !== "quiz" || (room.status || "waiting") !== "waiting") return { error: "phase" };
  const submitted = Object.entries(room.questions || {}).sort(([idA, a], [idB, b]) => Number(a.createdAt || 0) - Number(b.createdAt || 0) || idA.localeCompare(idB)).map(([id]) => id);
  if (!submitted.length) return { error: "empty-quiz" };
  const { order, seconds } = getUxQuizOptions(room);
  Object.assign(room, { status: "playing", currentQuestionIndex: 0, questionOrder: order === "submitted" ? submitted : shuffleArray(submitted),
    timeLimit: seconds, questionStartedAt: timestamp, resultOpenedAt: null, answers: null, quizRevealedQuestionIds: null });
  for (const student of Object.values(room.students || {})) if (!student.removedAt) student.score = 0;
  return { room };
}

async function startComplimentGame() {
  const compliments = getCompliments();
  if (!compliments.length) {
    showToast("시작할 칭찬 카드가 없습니다.", "error");
    return;
  }

  openDisplayWindow();

  const complimentOrder = shuffleArray(compliments.map((compliment) => compliment.id));
  const updates = {
    status: "playing",
    currentComplimentIndex: 0,
    currentClueIndex: 0,
    complimentOrder,
    complimentAnswers: null,
    complimentBonuses: null,
    answers: null
  };

  getStudents().forEach((student) => {
    updates[`students/${student.id}/score`] = 0;
  });

  try {
    await update(roomRef(state.roomCode), updates);
    showToast("칭찬 스무고개를 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("칭찬 스무고개를 시작하지 못했습니다.", "error");
  }
}

async function showNextComplimentClue() {
  const compliment = getCurrentCompliment();
  if (!compliment) {
    return;
  }

  const clueIndex = Number(state.room.currentClueIndex || 0);
  const maxIndex = normalizeComplimentClues(compliment.clues).length - 1;
  if (clueIndex >= maxIndex) {
    showToast("이미 마지막 단서까지 공개되었습니다.", "error");
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      status: "playing",
      currentClueIndex: clueIndex + 1
    });
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("다음 단서를 공개하지 못했습니다.", "error");
  }
}

async function revealComplimentTarget() {
  const compliment = getCurrentCompliment();
  if (!compliment) {
    return;
  }

  try {
    await awardComplimentTargetBonus(compliment);
    await update(roomRef(state.roomCode), {
      status: "targetReveal"
    });
    showToast("칭찬 대상을 공개했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("칭찬 대상을 공개하지 못했습니다.", "error");
  }
}

async function startComplimentAuthorGuess() {
  const compliment = getCurrentCompliment();
  if (!compliment) {
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      status: "authorGuess"
    });
    showToast("작성자 추리 라운드를 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("작성자 추리를 시작하지 못했습니다.", "error");
  }
}

async function revealComplimentAuthor() {
  const compliment = getCurrentCompliment();
  if (!compliment) {
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      status: "authorReveal"
    });
    showToast("작성자를 공개했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("작성자를 공개하지 못했습니다.", "error");
  }
}

async function nextComplimentCard() {
  if (securePilot) return securePilotHostCommand("nextCompliment");
  const compliments = getCompliments();
  if (!compliments.length) {
    return;
  }

  const nextIndex = Number(state.room.currentComplimentIndex || 0) + 1;
  if (nextIndex >= compliments.length) {
    finishGame();
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      status: "playing",
      currentComplimentIndex: nextIndex,
      currentClueIndex: 0
    });
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("다음 칭찬 카드로 이동하지 못했습니다.", "error");
  }
}

async function saveQuizSettings() {
  const value = clampInt(document.querySelector("#maxQuestionsInput")?.value, 1, 10, getMaxQuestionsPerStudent());
  const opts = getUxQuizOptions();
  const seconds = clampInt(document.querySelector("#uxQuizSeconds")?.value, 5, 120, opts.seconds);
  const order = document.querySelector("#uxQuizOrder")?.value === "submitted" ? "submitted" : "random";
  const allowOwn = document.querySelector("#uxQuizOwn")?.checked ?? opts.allowOwn;
  const autoReveal = document.querySelector("#uxQuizReveal")?.checked ?? opts.autoReveal;
  const generation = getRoomGeneration(state.room);
  try {
    const result = await runAccessCommand(state.roomCode, (room) => {
      if (!hasRoomHostAccess(room) || getRoomGeneration(room) !== generation || room.accessClosed
        || (room.gameVariant || room.mode || "quiz") !== "quiz" || (room.status || "waiting") !== "waiting") return { error: "phase" };
      room.maxQuestionsPerStudent = value;
      room.quizOptions = { seconds, order, allowOwn, autoReveal };
      return { room };
    });
    if (result.error) return showToast(accessErrorMessage(result.error), "error");
    showToast("퀴즈 진행 설정을 저장했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("퀴즈 배틀 설정을 저장하지 못했습니다.", "error");
  }
}

function getUxQuizOptions(room = state.room) {
  const settings = room?.quizOptions || {};
  return { seconds: clampInt(settings.seconds, 5, 120, DEFAULT_TIME_LIMIT_SECONDS),
    order: settings.order === "submitted" ? "submitted" : "random",
    allowOwn: settings.allowOwn ?? ALLOW_SOLVE_OWN_QUESTION, autoReveal: settings.autoReveal ?? AUTO_REVEAL_WHEN_TIME_UP };
}

function renderUxQuizSettings() {
  const { seconds, order, allowOwn, autoReveal } = getUxQuizOptions();
  return `<div class="ux-quiz-options"><div class="field"><label for="uxQuizSeconds">문제당 제한 시간 (초)</label>
    <input id="uxQuizSeconds" type="number" min="5" max="120" value="${seconds}" /></div>
    <div class="field"><label for="uxQuizOrder">출제 순서</label><select id="uxQuizOrder"><option value="random">무작위</option>
    <option value="submitted" ${order === "submitted" ? "selected" : ""}>제출순</option></select></div>
    <label class="check-line"><input type="checkbox" id="uxQuizOwn" ${allowOwn ? "checked" : ""} /> 내 문제에 답할 수 있음</label>
    <label class="check-line"><input type="checkbox" id="uxQuizReveal" ${autoReveal ? "checked" : ""} /> 시간이 끝나면 정답 공개</label></div>`;
}

async function saveComplimentSettings() {
  const value = clampInt(document.querySelector("#maxComplimentsInput")?.value, 1, 10, getMaxComplimentsPerStudent());

  try {
    await update(roomRef(state.roomCode), {
      maxComplimentsPerStudent: value
    });
    showToast(`학생 1명당 칭찬 카드 수를 최대 ${value}개로 저장했습니다.`, "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("칭찬 스무고개 설정을 저장하지 못했습니다.", "error");
  }
}

async function saveMafiaSettings() {
  const settings = readMafiaSettingsFromForm();
  const totalSpecialRoles = settings.mafiaCount + settings.policeCount + settings.doctorCount;
  const studentCount = getStudents().length;

  if (studentCount && totalSpecialRoles > studentCount) {
    showToast("역할 수가 현재 학생 수보다 많습니다.", "error");
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      "mafia/settings": settings
    });
    showToast("마피아 게임 설정을 저장했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("설정을 저장하지 못했습니다.", "error");
  }
}

async function saveLiarSettings() {
  const settings = readLiarSettingsFromForm();
  if (!validateLiarSettings(settings)) {
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      "liar/settings": settings
    });
    showToast("라이어게임 설정을 저장했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("라이어게임 설정을 저장하지 못했습니다.", "error");
  }
}

async function startLiarGame({ reuseSettings = false } = {}) {
  const students = getStudents();
  const sourceSettings = reuseSettings ? getLiarSettings() : readLiarSettingsFromForm();
  const settings = {
    ...sourceSettings,
    liarCount: students.length >= 2
      ? clampInt(sourceSettings.liarCount, 1, students.length - 1, DEFAULT_LIAR_COUNT)
      : Number(sourceSettings.liarCount || DEFAULT_LIAR_COUNT)
  };

  if (students.length < 2) {
    showToast("라이어게임은 학생이 2명 이상 입장해야 시작할 수 있습니다.", "error");
    return;
  }

  if (!validateLiarSettings(settings)) {
    return;
  }

  const liarCount = settings.liarCount;
  const shuffledStudents = shuffleArray(students);
  const liarIds = new Set(shuffledStudents.slice(0, liarCount).map((student) => student.id));
  const wordPair = Math.random() < 0.5
    ? { majorityWord: settings.wordA, liarWord: settings.wordB }
    : { majorityWord: settings.wordB, liarWord: settings.wordA };
  const assignments = {};

  students.forEach((student) => {
    const isLiar = liarIds.has(student.id);
    assignments[student.id] = {
      name: student.name,
      word: isLiar ? wordPair.liarWord : wordPair.majorityWord
    };
  });

  openDisplayWindow();

  try {
    await update(roomRef(state.roomCode), {
      status: "playing",
      liar: {
        settings: { ...settings, liarCount },
        majorityWord: wordPair.majorityWord,
        liarWord: wordPair.liarWord,
        liarStudentIds: [...liarIds],
        assignments,
        confirmations: null,
        votes: null,
        startedAt: Date.now(),
        voteOpenedAt: null,
        voteResultOpenedAt: null,
        revealedAt: null
      }
    });
    showToast("라이어게임을 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("라이어게임을 시작하지 못했습니다.", "error");
  }
}

async function confirmLiarWord() {
  const assignment = getMyLiarAssignment();
  if (!assignment) {
    return;
  }
  if (securePilot) {
    const result = await securePilot.send("confirmLiarWord");
    if (result.error) return showToast(securePilotError(result.error), "error");
    state.liarWordVisible = false;
    state.liarWordVisibleKey = "";
    if (state.room?.status === "playing") renderLiarStudentWord(true);
    return;
  }

  try {
    await update(ref(db, `rooms/${state.roomCode}/liar/confirmations/${state.studentId}`), {
      name: state.studentName || assignment.name,
      confirmedAt: serverTimestamp()
    });
    state.liarWordVisible = false;
    state.liarWordVisibleKey = "";
    showToast("제시어 확인을 완료했습니다.", "success");
    renderLiarStudentWord(true);
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("확인 상태를 저장하지 못했습니다.", "error");
  }
}

async function startLiarVoting() {
  if (!getLiarParticipants().length) {
    showToast("먼저 라이어게임을 시작해 주세요.", "error");
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      status: "voting",
      "liar/votes": null,
      "liar/voteOpenedAt": Date.now(),
      "liar/voteResultOpenedAt": null
    });
    showToast("라이어 투표를 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("투표를 시작하지 못했습니다.", "error");
  }
}

async function submitLiarVote() {
  const targetId = state.selectedLiarVoteTargetId;
  const target = getLiarParticipants().find((participant) => participant.id === targetId);

  if ((state.room?.status || "waiting") !== "voting") {
    showToast("지금은 투표 시간이 아닙니다.", "error");
    return;
  }

  if (!target || target.id === state.studentId) {
    showToast("투표할 친구를 선택해 주세요.", "error");
    return;
  }

  if (!window.confirm(`${target.name} 학생에게 투표할까요?`)) {
    return;
  }
  if (securePilot) {
    const result = await securePilot.send("voteLiar", { targetStudentId: target.id });
    if (result.error) return showToast(securePilotError(result.error), "error");
    state.selectedLiarVoteTargetId = "";
    showToast("투표를 완료했습니다.", "success");
    return;
  }

  const votePath = ref(db, `rooms/${state.roomCode}/liar/votes/${state.studentId}`);
  const voteData = {
    voterName: state.studentName,
    targetStudentId: target.id,
    targetName: target.name,
    votedAt: serverTimestamp()
  };

  try {
    const result = await runTransaction(votePath, (current) => current || voteData);
    if (result.committed) {
      state.selectedLiarVoteTargetId = "";
      showToast("투표를 완료했습니다.", "success");
      renderLiarStudentVoting(true);
    } else {
      showToast("이미 투표했습니다.", "error");
    }
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("투표를 저장하지 못했습니다.", "error");
  }
}

async function revealLiarVoteResult() {
  try {
    await update(roomRef(state.roomCode), {
      status: "voteResult",
      "liar/voteResultOpenedAt": Date.now()
    });
    showToast("투표 결과를 공개했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("투표 결과를 공개하지 못했습니다.", "error");
  }
}

async function forceCloseLiarVoting() {
  if (!window.confirm("아직 투표하지 않은 학생이 있을 수 있습니다. 투표를 강제 종료하고 결과를 공개할까요?")) {
    return;
  }
  await revealLiarVoteResult();
}

async function revealLiarAnswer() {
  if (!window.confirm("실제 라이어와 제시어를 공개할까요?")) {
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      status: "result",
      "liar/revealedAt": Date.now()
    });
    showToast("라이어를 공개했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("라이어를 공개하지 못했습니다.", "error");
  }
}

async function configureLiarGame() {
  if (!window.confirm("현재 배정과 투표를 지우고 설정 화면으로 돌아갈까요?")) {
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      status: "waiting",
      "liar/assignments": null,
      "liar/confirmations": null,
      "liar/votes": null,
      "liar/majorityWord": null,
      "liar/liarWord": null,
      "liar/liarStudentIds": null,
      "liar/startedAt": null,
      "liar/voteOpenedAt": null,
      "liar/voteResultOpenedAt": null,
      "liar/revealedAt": null
    });
    showToast("라이어게임 설정 화면으로 돌아왔습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("설정 화면으로 돌아가지 못했습니다.", "error");
  }
}

async function assignMafiaRoles() {
  if ((state.room?.status || "waiting") !== "waiting") {
    showToast("역할 배정은 대기 상태에서만 할 수 있습니다.", "error");
    return;
  }

  const students = getStudents();
  const settings = readMafiaSettingsFromForm();
  const totalSpecialRoles = settings.mafiaCount + settings.policeCount + settings.doctorCount;

  if (!students.length) {
    showToast("학생이 입장한 뒤 역할을 배정해 주세요.", "error");
    return;
  }

  if (totalSpecialRoles > students.length) {
    showToast("역할 수가 학생 수보다 많습니다. 역할 인원을 줄여 주세요.", "error");
    return;
  }

  if (settings.mafiaCount >= students.length - settings.mafiaCount) {
    showToast("마피아 수는 시민팀 수보다 적어야 합니다. 마피아 수를 줄여 주세요.", "error");
    return;
  }

  openDisplayWindow();

  const roleDeck = [
    ...Array(settings.mafiaCount).fill("mafia"),
    ...Array(settings.policeCount).fill("police"),
    ...Array(settings.doctorCount).fill("doctor"),
    ...Array(Math.max(0, students.length - totalSpecialRoles)).fill("citizen")
  ];
  const shuffledRoles = shuffleArray(roleDeck);
  const assigned = {};

  students.forEach((student, index) => {
    const role = shuffledRoles[index] || "citizen";
    assigned[student.id] = {
      name: student.name,
      role,
      team: role === "mafia" ? "mafia" : "citizen",
      alive: true,
      connected: student.connected
    };
  });

  try {
    await update(roomRef(state.roomCode), {
      status: "roleAssigned",
      mafia: {
        round: 1,
        settings,
        students: assigned,
        rounds: null,
        winner: null,
        lastElimination: null,
        ghosts: null,
        ghostChat: null,
        discussionStartedAt: null,
        assignedAt: Date.now()
      }
    });
    showToast("역할을 랜덤 배정했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("역할을 배정하지 못했습니다.", "error");
  }
}

async function startMafiaRoleReveal() {
  if (!getMafiaPlayers().length) {
    showToast("먼저 역할을 배정해 주세요.", "error");
    return;
  }

  openDisplayWindow();

  try {
    await update(roomRef(state.roomCode), { status: "roleReveal" });
    showToast("학생 역할 확인 화면을 열었습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("역할 확인을 시작하지 못했습니다.", "error");
  }
}

async function startMafiaNight() {
  if (!getMafiaPlayers().length) {
    showToast("먼저 역할을 배정해 주세요.", "error");
    return;
  }

  const roundNumber = Math.max(1, getMafiaRoundNumber());
  try {
    await update(roomRef(state.roomCode), {
      status: "nightAction",
      "mafia/round": roundNumber,
      "mafia/discussionStartedAt": null,
      [`mafia/rounds/${roundNumber}/nightActions`]: null,
      [`mafia/rounds/${roundNumber}/nightResult`]: null,
      [`mafia/rounds/${roundNumber}/votes`]: null,
      [`mafia/rounds/${roundNumber}/voteResult`]: null,
      [`mafia/rounds/${roundNumber}/voteAttempt`]: 0
    });
    showToast("밤 행동을 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("밤 행동을 시작하지 못했습니다.", "error");
  }
}

async function calculateMafiaNightResult({ showToastOnComplete = false } = {}) {
  const resultPath = ref(db, `rooms/${state.roomCode}/mafia/rounds/${getMafiaRoundNumber()}/nightResult`);
  const existing = await get(resultPath);
  if (existing.exists()) {
    if (showToastOnComplete) {
      showToast("이미 밤 결과가 계산되어 있습니다.", "success");
    }
    return existing.val();
  }

  const resultData = buildMafiaNightResult();
  try {
    const result = await runTransaction(resultPath, (current) => current || resultData);
    if (showToastOnComplete) {
      showToast("밤 결과를 계산했습니다.", "success");
    }
    return result.snapshot.val();
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("밤 결과를 계산하지 못했습니다.", "error");
    return null;
  }
}

async function publishMafiaNightResult() {
  const nightResult = await calculateMafiaNightResult();
  if (!nightResult) {
    return;
  }

  const updates = {
    status: "nightResult"
  };

  if (nightResult.eliminatedStudentId) {
    const eliminated = getMafiaPlayer(nightResult.eliminatedStudentId);
    updates[`mafia/students/${nightResult.eliminatedStudentId}/alive`] = false;
    updates[`mafia/rounds/${getMafiaRoundNumber()}/nightResult/publishedAt`] = Date.now();
    updates["mafia/lastElimination"] = {
      studentId: nightResult.eliminatedStudentId,
      name: nightResult.eliminatedName,
      role: eliminated?.role || "",
      source: "night",
      round: getMafiaRoundNumber()
    };
    addMafiaGhostJoinUpdates(updates, eliminated, "night");
  } else {
    updates[`mafia/rounds/${getMafiaRoundNumber()}/nightResult/publishedAt`] = Date.now();
    updates["mafia/lastElimination"] = null;
  }

  const projectedPlayers = projectMafiaPlayersAfterElimination(nightResult.eliminatedStudentId);
  const winner = getMafiaWinnerForPlayers(projectedPlayers);
  if (winner) {
    updates["mafia/winner"] = winner;
  }

  try {
    await update(roomRef(state.roomCode), updates);
    showToast("낮 결과를 발표했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("낮 결과를 발표하지 못했습니다.", "error");
  }
}

async function startMafiaDiscussion() {
  try {
    await update(roomRef(state.roomCode), {
      status: "discussion",
      "mafia/discussionStartedAt": serverTimestamp()
    });
    showToast("토론을 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("토론을 시작하지 못했습니다.", "error");
  }
}

async function startMafiaVoting() {
  const round = getCurrentMafiaRound();
  const previousVoteResult = round.voteResult || {};
  const nextAttempt = previousVoteResult.revotedTieRequired ? 2 : 1;

  try {
    await update(roomRef(state.roomCode), {
      status: "voting",
      [`mafia/rounds/${getMafiaRoundNumber()}/votes`]: null,
      [`mafia/rounds/${getMafiaRoundNumber()}/voteResult`]: null,
      [`mafia/rounds/${getMafiaRoundNumber()}/voteAttempt`]: nextAttempt
    });
    showToast(nextAttempt === 2 ? "재투표를 시작했습니다." : "투표를 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("투표를 시작하지 못했습니다.", "error");
  }
}

async function revealMafiaVoteResult() {
  const resultData = buildMafiaVoteResult();
  const updates = {
    status: "voteResult",
    [`mafia/rounds/${getMafiaRoundNumber()}/voteResult`]: resultData
  };

  if (resultData.eliminatedStudentId) {
    const eliminated = getMafiaPlayer(resultData.eliminatedStudentId);
    updates[`mafia/students/${resultData.eliminatedStudentId}/alive`] = false;
    updates["mafia/lastElimination"] = {
      studentId: resultData.eliminatedStudentId,
      name: resultData.eliminatedName,
      role: eliminated?.role || "",
      source: "vote",
      round: getMafiaRoundNumber()
    };
    addMafiaGhostJoinUpdates(updates, eliminated, "vote");
  }

  const projectedPlayers = projectMafiaPlayersAfterElimination(resultData.eliminatedStudentId);
  const winner = getMafiaWinnerForPlayers(projectedPlayers);
  if (winner) {
    updates["mafia/winner"] = winner;
  }

  try {
    await update(roomRef(state.roomCode), updates);
    showToast("투표 결과를 공개했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("투표 결과를 공개하지 못했습니다.", "error");
  }
}

async function revealMafiaEliminatedRole() {
  const voteResult = getCurrentMafiaRound().voteResult || {};
  if (voteResult.revotedTieRequired) {
    showToast("동점 재투표를 먼저 진행해 주세요.", "error");
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      status: "roleRevealDead"
    });
    showToast("정체 공개 화면으로 이동했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("정체 공개를 진행하지 못했습니다.", "error");
  }
}

async function startNextMafiaNight() {
  if (getMafiaWinner()) {
    finishMafiaGame();
    return;
  }

  const nextRound = getMafiaRoundNumber() + 1;
  try {
    await update(roomRef(state.roomCode), {
      status: "nightAction",
      "mafia/round": nextRound,
      "mafia/lastElimination": null,
      "mafia/discussionStartedAt": null,
      [`mafia/rounds/${nextRound}/nightActions`]: null,
      [`mafia/rounds/${nextRound}/nightResult`]: null,
      [`mafia/rounds/${nextRound}/votes`]: null,
      [`mafia/rounds/${nextRound}/voteResult`]: null,
      [`mafia/rounds/${nextRound}/voteAttempt`]: 0
    });
    showToast("다음 밤을 시작했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("다음 밤으로 이동하지 못했습니다.", "error");
  }
}

async function finishMafiaGame() {
  try {
    await update(roomRef(state.roomCode), {
      status: "finished",
      finishedAt: serverTimestamp()
    });
    renderMafiaFinalResult("teacher-mafia-final", true, true);
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("마피아 게임을 종료하지 못했습니다.", "error");
  }
}

async function restartCurrentQuestion() {
  const questions = getQuestions();
  if (!questions.length) {
    return;
  }

  const currentIndex = Math.max(0, Number(state.room.currentQuestionIndex || 0));
  try {
    await update(roomRef(state.roomCode), {
      status: "playing",
      currentQuestionIndex: Math.min(currentIndex, questions.length - 1),
      questionStartedAt: serverTimestamp(),
      resultOpenedAt: null
    });
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("현재 문제로 이동하지 못했습니다.", "error");
  }
}

async function nextQuestion() {
  const code = state.roomCode;
  const generation = getRoomGeneration(state.room);
  const index = Number(state.room.currentQuestionIndex || 0);
  const started = state.room.questionStartedAt;
  try {
    const result = await runAccessCommand(code, (room) => {
      if (!hasRoomHostAccess(room) || getRoomGeneration(room) !== generation || room.accessClosed
        || (room.gameVariant || room.mode || "quiz") !== "quiz" || !["playing", "result"].includes(room.status)
        || room.questionStartedAt !== started || Number(room.currentQuestionIndex || 0) !== index) return { error: "phase" };
      if (index + 1 >= Object.keys(room.questions || {}).length) {
        room.status = "finished";
        room.finishedAt = serverTimestamp();
      } else {
        Object.assign(room, { status: "playing", currentQuestionIndex: index + 1, questionStartedAt: serverTimestamp(), resultOpenedAt: null });
      }
      return { room };
    });
    if (result.error) showToast(accessErrorMessage(result.error), "error");
    else if (result.room?.status === "finished" && state.role === "teacher" && state.roomCode === code) renderFinalResult("teacher-final", true, true);
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("다음 문제로 이동하지 못했습니다.", "error");
  }
}

async function revealAnswer(isAuto) {
  if (securePilot) return securePilotHostCommand("reveal", { automatic: Boolean(isAuto) }, Boolean(isAuto));
  if (!state.room || state.room.status !== "playing" || !acceptReleaseTeacherAction(isAuto)) {
    return;
  }

  const generation = getRoomGeneration(state.room);
  const started = state.room.questionStartedAt;
  const index = Number(state.room.currentQuestionIndex || 0);
  try {
    const result = await runAccessCommand(state.roomCode, (room) => {
      if (!hasRoomHostAccess(room) || getRoomGeneration(room) !== generation || room.accessClosed
        || (room.gameVariant || room.mode || "quiz") !== "quiz" || room.status !== "playing"
        || room.questionStartedAt !== started || Number(room.currentQuestionIndex || 0) !== index) return { error: "phase" };
      room.status = "result";
      room.resultOpenedAt = serverTimestamp();
      const publicId = normalizeQuestionOrder(room.questionOrder)[index] || getQuestions()[index]?.id;
      if (publicId && room.questions?.[publicId]) {
        room.quizRevealedQuestionIds ||= {};
        room.quizRevealedQuestionIds[publicId] = true;
      }
      return { room };
    });
    if (result.error) { if (!isAuto) showToast(accessErrorMessage(result.error), "error"); return; }
    if (!isAuto) {
      showToast("정답을 공개했습니다.", "success");
    }
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("정답 공개에 실패했습니다.", "error");
  }
}

async function finishGame() {
  if (securePilot) return securePilotHostCommand(getRoomMode() === "compliment" ? "finishCompliment" : "finishQuiz");
  try {
    await update(roomRef(state.roomCode), {
      status: "finished",
      finishedAt: serverTimestamp()
    });
    renderFinalResult("teacher-final", true, true);
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("최종 결과로 이동하지 못했습니다.", "error");
  }
}

async function resetGame() {
  const ok = window.confirm("점수와 답변을 지우고 대기 상태로 돌아갈까요? 제출된 문제와 학생 목록은 유지됩니다.");
  if (!ok) {
    return;
  }
  if (securePilot) return securePilotHostCommand(getRoomMode() === "compliment" ? "resetCompliment" : "resetQuiz", { confirmed: true });

  const oldMemoryGame = getMemoryBattle();
  state.seatSettingsDraft = null;
  state.seatInteractionKey = "";
  clearMemorySubscriptions();
  clearMemoryImageDraft();
  state.memorySettingsDraft = null;

  const updates = {
    status: "waiting",
    currentQuestionIndex: -1,
    currentComplimentIndex: -1,
    currentClueIndex: 0,
    questionStartedAt: null,
    resultOpenedAt: null,
    finishedAt: null,
    questionOrder: null,
    complimentOrder: null,
    complimentBonuses: null,
    complimentAnswers: null,
    mafia: getDefaultMafiaState(),
    liar: getDefaultLiarState(),
    catchmind: getInitialCatchmindStateForWrite(),
    seatGame: getInitialSeatGameStateForWrite(),
    memoryBattle: getInitialMemoryBattleStateForWrite(),
    bingo: getBingoResetStatePreservingBoards(),
    wordChallenge: getWordChallengeResetState(true),
    answers: null
  };

  getStudents().forEach((student) => {
    updates[`students/${student.id}/score`] = 0;
  });

  try {
    await update(roomRef(state.roomCode), updates);
    if (oldMemoryGame.gameId) {
      await Promise.allSettled([
        remove(ref(db, `memoryPrivate/${state.roomCode}/${oldMemoryGame.gameId}`)),
        cleanupMemoryImageSet(oldMemoryGame.imageSetId)
      ]);
    }
    showToast("게임이 초기화되었습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("초기화하지 못했습니다.", "error");
  }
}

async function clearRoomLists() {
  if (securePilot) return showToast("검수 환경에서 전체 자료 삭제는 제공하지 않습니다.", "error");
  const ok = window.confirm("학생 목록, 문제/칭찬/빙고 자료, 답변, 점수를 모두 지울까요? 이 작업은 되돌릴 수 없습니다.");
  if (!ok) {
    return;
  }

  const secondOk = window.confirm("정말 전체 초기화할까요? 새 반이나 새 수업을 시작할 때만 사용하세요.");
  if (!secondOk) {
    return;
  }

  const oldMemoryGame = getMemoryBattle();
  state.seatSettingsDraft = null;
  state.seatInteractionKey = "";
  clearMemorySubscriptions();
  clearMemoryImageDraft();
  state.memorySettingsDraft = null;

  try {
    await update(roomRef(state.roomCode), {
      status: "waiting",
      currentQuestionIndex: -1,
      questionStartedAt: null,
      resultOpenedAt: null,
      finishedAt: null,
      questionOrder: null,
      complimentOrder: null,
      complimentBonuses: null,
      currentComplimentIndex: -1,
      currentClueIndex: 0,
      students: null,
      nameClaims: null,
      presence: null,
      accessGeneration: createParticipantId(),
      questions: null,
      compliments: null,
      mafia: getDefaultMafiaState(),
      liar: getDefaultLiarState(),
      catchmind: getInitialCatchmindStateForWrite(),
      seatGame: getInitialSeatGameStateForWrite(),
      memoryBattle: getInitialMemoryBattleStateForWrite(),
      bingo: getInitialBingoStateForWrite(),
      wordChallenge: getInitialWordChallengeStateForWrite(),
      answers: null,
      complimentAnswers: null
    });
    if (oldMemoryGame.gameId) {
      await Promise.allSettled([
        remove(ref(db, `memoryPrivate/${state.roomCode}/${oldMemoryGame.gameId}`)),
        cleanupMemoryImageSet(oldMemoryGame.imageSetId)
      ]);
    }
    showToast("학생 목록과 제출 자료를 모두 초기화했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("학생/자료 목록을 초기화하지 못했습니다.", "error");
  }
}

async function deleteQuestion(questionId) {
  if ((state.room?.status || "waiting") !== "waiting") {
    showToast("문제 삭제는 게임 시작 전 대기 상태에서만 해 주세요.", "error");
    return;
  }

  const ok = window.confirm("이 문제를 삭제할까요?");
  if (!ok) {
    return;
  }
  if (securePilot) return securePilotHostCommand("deleteQuestion", { questionId });

  try {
    await remove(ref(db, `rooms/${state.roomCode}/questions/${questionId}`));
    await remove(ref(db, `rooms/${state.roomCode}/answers/${questionId}`));
    showToast("문제를 삭제했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("문제를 삭제하지 못했습니다.", "error");
  }
}

async function deleteCompliment(complimentId) {
  if ((state.room?.status || "waiting") !== "waiting") {
    showToast("칭찬 카드 삭제는 게임 시작 전 대기 상태에서만 해 주세요.", "error");
    return;
  }

  const ok = window.confirm("이 칭찬 카드를 삭제할까요?");
  if (!ok) {
    return;
  }

  if (securePilot) return securePilotHostCommand("deleteCompliment", { cardId: complimentId });

  try {
    await remove(ref(db, `rooms/${state.roomCode}/compliments/${complimentId}`));
    await remove(ref(db, `rooms/${state.roomCode}/complimentAnswers/${complimentId}`));
    await remove(ref(db, `rooms/${state.roomCode}/complimentBonuses/target/${complimentId}`));
    showToast("칭찬 카드를 삭제했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("칭찬 카드를 삭제하지 못했습니다.", "error");
  }
}

async function copyRoomCode() {
  try {
    await navigator.clipboard.writeText(state.roomCode);
    showToast("방 코드가 복사되었습니다.", "success");
  } catch {
    showToast(`방 코드: ${state.roomCode}`);
  }
}

function openDisplayWindow({ silent = false } = {}) {
  if (finalRelease?.isDemo) return null;
  if (!state.roomCode) {
    if (!silent) {
      showToast("방 코드가 있어야 교실 화면을 열 수 있습니다.", "error");
    }
    return null;
  }

  if (displayWindow && !displayWindow.closed && displayWindowRoomCode === state.roomCode) {
    displayWindow.focus();
    if (!silent) {
      showToast("이미 열린 교실 화면을 앞으로 가져왔습니다.", "success");
    }
    return displayWindow;
  }

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("display", "1");
  url.searchParams.set("room", state.roomCode);
  const target = securePilot ? securePilot.displayLink(state.roomCode) : url.toString();
  if (!target) {
    if (!silent) showToast("교실 화면 링크는 방을 생성한 검수 창에서 열 수 있습니다.", "error");
    return null;
  }

  displayWindow = window.open(
    target,
    `dm_playground_display_${state.roomCode}`,
    "popup=yes,width=1280,height=800,left=80,top=60"
  );

  if (displayWindow) {
    displayWindowRoomCode = state.roomCode;
    displayWindow.focus();
    if (!silent) {
      showToast("교실 화면 팝업을 열었습니다. 확장 모니터로 옮겨 주세요.", "success");
    }
  } else if (!silent) {
    showToast("팝업이 차단되었습니다. 브라우저에서 팝업 허용 후 다시 눌러 주세요.", "error");
  }

  return displayWindow;
}

// =========================
// 구독 및 데이터 도우미
// =========================

function subscribeToRoom(code) {
  clearRoomSubscription();
  state.activeView = "";

  const acceptRoom = (room) => {
    state.room = room;
    finalRelease?.noteSync();
    if (!state.room) {
      if (state.role === "display") updateClassroomSound(null);
      if (state.role === "student") syncPlaygroundStudentProfile();
      renderPolishRoomMessage(securePilot ? "session" : "missing");
      return;
    }
    if (state.role === "student") {
      const student = state.room.students?.[state.studentId];
      if (!student || getRoomGeneration(state.room) !== state.studentGeneration || student.removedAt || state.room.accessClosed) {
        stopStudentPresence();
        clearRoomSubscription();
        document.querySelector("#studentProfile").hidden = true;
        renderPolishRoomMessage("session");
        return;
      }
      if (student.name !== state.studentName) {
        state.studentName = student.name;
        saveStudentSession();
        for (const id of ["#authorName", "#complimentAuthorName"]) {
          const input = document.querySelector(id);
          if (input) input.value = student.name;
        }
        showToast("선생님이 등록 이름을 변경했습니다.", "info");
      }
    }
    if (state.role === "display") {
      updateClassroomSound(state.room);
      renderDisplayRoute(true);
      return;
    }
    if (state.role === "teacher") {
      if (state.room?.status === "finished") {
        if (getRoomMode() === "mafia") {
          renderMafiaFinalResult("teacher-mafia-final", true, true);
        } else if (getRoomMode() === "catchmind") {
          renderCatchmindFinalResult("teacher-catchmind-final", true, true);
        } else if (getRoomMode() === "seat") {
          renderSeatFinalResult("teacher-seat-final", true, true);
        } else if (getRoomMode() === "memory") {
          renderMemoryFinalResult("teacher-memory-final", true, true);
        } else if (getRoomMode() === "bingo") {
          renderBingoFinalResult("teacher-bingo-final", true, true);
        } else if (getRoomMode() === "word") {
          renderWordChallengeFinalResult("teacher-word-final", true, true);
        } else {
          renderFinalResult("teacher-final", true, true);
        }
      } else {
        renderTeacherDashboard(true);
      }
      return;
    }
    renderStudentRoute();
    syncPlaygroundStudentProfile();
  };
  if (securePilot) {
    state.unsubscribeRoom = securePilot.subscribe(acceptRoom);
    return;
  }
  state.unsubscribeRoom = onValue(roomRef(code), (snapshot) => acceptRoom(snapshot.val()), () => {
    finalRelease?.record("room-read");
    finalRelease?.record("app-error");
    if (!state.room) renderPolishRoomMessage("error");
    else showToast("방 정보를 실시간으로 불러오지 못했습니다.", "error", "disconnected");
  });
}

function clearRoomSubscription() {
  if (typeof state.unsubscribeRoom === "function") {
    state.unsubscribeRoom();
  }
  state.unsubscribeRoom = null;
}

function roomRef(code) {
  return ref(db, `rooms/${code}`);
}

function getRoomMode() {
  return state.room?.gameVariant === "word" ? "word" : (state.room?.mode || "quiz");
}

function getSelectedTeacherMode() {
  return document.querySelector("input[name='teacherMode']:checked")?.value || "quiz";
}

async function switchRoomMode(nextMode) {
  if (securePilot) return securePilotHostCommand("switchMode", { mode: nextMode });
  if (!acceptReleaseTeacherAction()) return;
  if (!["quiz", "compliment", "mafia", "liar", "catchmind", "seat", "memory", "bingo", "word"].includes(nextMode)) {
    return;
  }

  if (getRoomMode() === nextMode) {
    return;
  }

  if ((state.room?.status || "waiting") !== "waiting") {
    showToast("게임 모드는 대기 상태에서만 바꿀 수 있습니다.", "error");
    return;
  }

  try {
    state.seatSettingsDraft = null;
    state.seatInteractionKey = "";
    clearMemorySubscriptions();
    clearMemoryImageDraft();
    state.memorySettingsDraft = null;
    await update(roomRef(state.roomCode), {
      mode: nextMode === "word" ? "quiz" : nextMode,
      gameVariant: nextMode === "word" ? "word" : null,
      currentQuestionIndex: -1,
      currentComplimentIndex: -1,
      currentClueIndex: 0,
      questionOrder: null,
      complimentOrder: null,
      mafia: nextMode === "mafia" ? getDefaultMafiaState() : null,
      liar: nextMode === "liar" ? getInitialLiarStateForWrite() : null,
      catchmind: nextMode === "catchmind" ? getInitialCatchmindStateForWrite() : null,
      seatGame: nextMode === "seat" ? getInitialSeatGameStateForWrite() : null,
      memoryBattle: nextMode === "memory" ? getInitialMemoryBattleStateForWrite() : null,
      bingo: nextMode === "bingo" ? getInitialBingoStateForWrite() : null,
      wordChallenge: nextMode === "word" ? getInitialWordChallengeStateForWrite() : null,
      answers: null,
      complimentAnswers: null,
      complimentBonuses: null
    });
    showToast(`${modeLabel(nextMode)} 모드로 바꿨습니다.`, "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("게임 모드를 바꾸지 못했습니다. Firebase Rules에 새 게임 모드가 반영되었는지 확인해 주세요.", "error");
  }
}

function getQuestions() {
  const raw = state.room?.questions || {};
  const questions = Object.entries(raw)
    .map(([id, value]) => ({
      id,
      ...value,
      type: value.type === "short" ? "short" : "choice",
      choices: normalizeChoices(value.choices),
      correctIndex: Number(value.correctIndex),
      correctAnswer: cleanText(value.correctAnswer || "")
    }))
    .sort((a, b) => {
      const createdA = Number(a.createdAt || 0);
      const createdB = Number(b.createdAt || 0);
      if (createdA !== createdB) {
        return createdA - createdB;
      }
      return String(a.authorName || "").localeCompare(String(b.authorName || ""), "ko");
    });

  const questionOrder = normalizeQuestionOrder(state.room?.questionOrder);
  if (!questionOrder.length) {
    return questions;
  }

  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const orderedQuestions = questionOrder
    .map((questionId) => questionMap.get(questionId))
    .filter(Boolean);
  const orderedIds = new Set(orderedQuestions.map((question) => question.id));
  const remainingQuestions = questions.filter((question) => !orderedIds.has(question.id));

  return [...orderedQuestions, ...remainingQuestions];
}

function getCompliments() {
  const raw = state.room?.compliments || {};
  const compliments = Object.entries(raw)
    .map(([id, value]) => ({
      id,
      ...value,
      clues: normalizeComplimentClues(value.clues)
    }))
    .filter((compliment) => compliment.authorStudentId && compliment.targetStudentId && compliment.clues.length >= 4)
    .sort((a, b) => {
      const createdA = Number(a.createdAt || 0);
      const createdB = Number(b.createdAt || 0);
      if (createdA !== createdB) {
        return createdA - createdB;
      }
      return String(a.authorName || "").localeCompare(String(b.authorName || ""), "ko");
    });

  const complimentOrder = normalizeQuestionOrder(state.room?.complimentOrder);
  if (!complimentOrder.length) {
    return compliments;
  }

  const complimentMap = new Map(compliments.map((compliment) => [compliment.id, compliment]));
  const orderedCompliments = complimentOrder
    .map((complimentId) => complimentMap.get(complimentId))
    .filter(Boolean);
  const orderedIds = new Set(orderedCompliments.map((compliment) => compliment.id));
  const remainingCompliments = compliments.filter((compliment) => !orderedIds.has(compliment.id));

  return [...orderedCompliments, ...remainingCompliments];
}

function getStudents() {
  const raw = state.room?.students || {};
  return Object.entries(raw)
    .filter(([, value]) => cleanText(value?.name) && !value.removedAt)
    .map(([id, value]) => ({
      id,
      name: value.name,
      avatarId: value.avatarId,
      score: Number(value.score || 0),
      connected: isStudentConnected(id, value),
      joinedAt: value.joinedAt || 0
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
}

function getAnswers(questionId) {
  const raw = state.room?.answers?.[questionId] || {};
  return Object.entries(raw).map(([studentId, answer]) => ({
    studentId,
    ...answer,
    scoreEarned: Number(answer.scoreEarned || 0)
  }));
}

function getMyAnswer(questionId) {
  return state.room?.answers?.[questionId]?.[state.studentId] || null;
}

function getMyScore() {
  return Number(state.room?.students?.[state.studentId]?.score || 0);
}

function getCurrentCompliment() {
  if (securePilot) return state.room?.pilotCurrentCompliment || null;
  const compliments = getCompliments();
  const index = Number(state.room?.currentComplimentIndex || 0);
  return compliments[index] || null;
}

function findComplimentByAuthor(studentId) {
  return findComplimentsByAuthor(studentId)[0] || null;
}

function findComplimentsByAuthor(studentId) {
  return getCompliments().filter((compliment) => {
    return compliment.authorStudentId === studentId || compliment.id === studentId || compliment.id.startsWith(`${studentId}_`);
  });
}

function getMyComplimentTargetAnswer(complimentId) {
  return state.room?.complimentAnswers?.[complimentId]?.targetGuesses?.[state.studentId] || null;
}

function getMyComplimentAuthorAnswer(complimentId) {
  return state.room?.complimentAnswers?.[complimentId]?.authorGuesses?.[state.studentId] || null;
}

function getComplimentTargetGuesses(complimentId) {
  const raw = state.room?.complimentAnswers?.[complimentId]?.targetGuesses || {};
  return Object.entries(raw).map(([studentId, answer]) => ({ studentId, ...answer }));
}

function getComplimentAuthorGuesses(complimentId) {
  const raw = state.room?.complimentAnswers?.[complimentId]?.authorGuesses || {};
  return Object.entries(raw).map(([studentId, answer]) => ({ studentId, ...answer }));
}

function getComplimentTargetPoint(clueIndex) {
  return Number(COMPLIMENT_TARGET_POINTS[clueIndex] ?? COMPLIMENT_TARGET_POINTS[COMPLIMENT_TARGET_POINTS.length - 1] ?? 0);
}

function canShowNextComplimentClue(compliment) {
  const clueIndex = Number(state.room?.currentClueIndex || 0);
  return clueIndex < normalizeComplimentClues(compliment?.clues).length - 1;
}

function getComplimentTargetOptions(editingCompliment = null) {
  const usedTargetIds = new Set(
    findComplimentsByAuthor(state.studentId)
      .filter((compliment) => compliment.id !== editingCompliment?.id)
      .map((compliment) => compliment.targetStudentId)
      .filter(Boolean)
  );
  const options = getStudents().filter((student) => {
    return student.id !== state.studentId && !usedTargetIds.has(student.id);
  });
  if (editingCompliment?.targetStudentId && !options.some((student) => student.id === editingCompliment.targetStudentId)) {
    options.push({
      id: editingCompliment.targetStudentId,
      name: editingCompliment.targetName || "기존 칭찬 대상",
      score: 0,
      connected: false
    });
  }
  return options;
}

function renderComplimentTargetOptionHtml(options, selectedId = "") {
  return [
    `<option value="">친구를 선택하세요</option>`,
    ...options.map((student) => `
      <option value="${escapeAttr(student.id)}" ${selectedId === student.id ? "selected" : ""}>${escapeHtml(student.name)}</option>
    `)
  ].join("");
}

function refreshComplimentTargetSelect() {
  const targetSelect = document.querySelector("#complimentTarget");
  if (!targetSelect) {
    return;
  }

  const editingComplimentId = cleanText(document.querySelector("#editingComplimentId")?.value || "");
  const editingCompliment = editingComplimentId
    ? getCompliments().find((compliment) => compliment.id === editingComplimentId)
    : null;
  const currentValue = targetSelect.value || editingCompliment?.targetStudentId || "";
  const options = getComplimentTargetOptions(editingCompliment);
  const selectedId = options.some((student) => student.id === currentValue) ? currentValue : "";

  const currentOptions = [...targetSelect.options].slice(1);
  if (currentOptions.length !== options.length || options.some((student, index) =>
    currentOptions[index].value !== student.id || currentOptions[index].textContent !== student.name)) {
    targetSelect.innerHTML = renderComplimentTargetOptionHtml(options, selectedId);
  }
  if (targetSelect.value !== selectedId) targetSelect.value = selectedId;
  targetSelect.disabled = !options.length;

  const submitButton = document.querySelector("#complimentSubmitBtn");
  if (submitButton) {
    submitButton.disabled = !options.length;
  }

  const helpText = document.querySelector("#complimentTargetHelp");
  if (helpText) {
    helpText.hidden = options.length > 0;
  }
}

function getComplimentGuessOptions(compliment) {
  const options = getStudents().slice();
  [
    { id: compliment?.targetStudentId, name: compliment?.targetName },
    { id: compliment?.authorStudentId, name: compliment?.authorName }
  ].forEach((candidate) => {
    if (candidate.id && candidate.name && !options.some((student) => student.id === candidate.id)) {
      options.push({
        id: candidate.id,
        name: candidate.name,
        score: 0,
        connected: false
      });
    }
  });
  return options.sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
}

function getStudentNameById(studentId, fallback = "이름 없음") {
  return getStudents().find((student) => student.id === studentId)?.name || fallback;
}

async function incrementStudentScore(studentId, points) {
  if (!studentId || !points) {
    return;
  }

  await runTransaction(ref(db, `rooms/${state.roomCode}/students/${studentId}/score`), (score) => {
    return Number(score || 0) + Number(points || 0);
  });
}

async function awardComplimentTargetBonus(compliment) {
  if (!compliment?.targetStudentId || !COMPLIMENT_TARGET_BONUS) {
    return;
  }

  const bonusPath = ref(db, `rooms/${state.roomCode}/complimentBonuses/target/${compliment.id}`);
  const existing = await get(bonusPath);
  if (existing.exists()) {
    return;
  }

  await set(bonusPath, {
    targetStudentId: compliment.targetStudentId,
    targetName: compliment.targetName,
    scoreEarned: COMPLIMENT_TARGET_BONUS,
    awardedAt: serverTimestamp()
  });
  await incrementStudentScore(compliment.targetStudentId, COMPLIMENT_TARGET_BONUS);
}

function getQuestionOwnerId(room, id, question) {
  if (question?.authorStudentId) return question.authorStudentId;
  if (!question || question.legacyOwnerUnresolved || question.authorKind === "teacher") return "";
  const authorKey = question.authorKey || (question.authorName ? nameToKey(question.authorName) : "");
  const candidates = Object.entries(room?.students || {}).filter(([, student]) => {
    if (!student?.name) return false;
    const key = nameToKey(student.name);
    return authorKey ? key === authorKey : id === key || (id.startsWith(`${key}_`) && /^\d+$/.test(id.slice(key.length + 1)));
  });
  return candidates.length === 1 ? candidates[0][0] : "";
}

function migrateRoomQuestionOwners(room) {
  for (const [id, question] of Object.entries(room.questions || {})) {
    if (!question || question.authorStudentId || question.authorKind === "teacher" || question.legacyOwnerUnresolved) continue;
    const owner = getQuestionOwnerId(room, id, question);
    if (owner) question.authorStudentId = owner;
    else question.legacyOwnerUnresolved = true;
  }
}

function findQuestionsByStudent(studentId = state.studentId) {
  return getQuestions().filter((question) => getQuestionOwnerId(state.room, question.id, question) === studentId);
}

function getMaxQuestionsPerStudent() {
  return clampInt(state.room?.maxQuestionsPerStudent, 1, 10, MAX_QUESTIONS_PER_STUDENT);
}

function getMaxComplimentsPerStudent() {
  return clampInt(state.room?.maxComplimentsPerStudent, 1, 10, MAX_COMPLIMENTS_PER_STUDENT);
}

function getCumulativeRanking() {
  if (securePilot && getRoomMode() === "compliment" && !state.room?.pilotComplimentRanking) return [];
  if (securePilot && getRoomMode() === "catchmind" && !state.room?.pilotCatchmindRanking) return [];
  return getStudents()
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return String(a.name).localeCompare(String(b.name), "ko");
    });
}

function getQuestionRanking(questionId) {
  return getAnswers(questionId)
    .filter((answer) => !answer.isSkipped)
    .sort((a, b) => {
      if (b.scoreEarned !== a.scoreEarned) {
        return b.scoreEarned - a.scoreEarned;
      }
      return Number(a.responseTime || 999) - Number(b.responseTime || 999);
    });
}

function getAnswerCounts(question) {
  const aggregate = state.room?.pilotAggregate?.[question.id]?.optionCounts;
  if (aggregate) return [0, 1, 2, 3].map((index) => Number(aggregate[index] || 0));
  const counts = [0, 0, 0, 0];
  getAnswers(question.id).forEach((answer) => {
    if (Number.isInteger(answer.selectedIndex) && answer.selectedIndex >= 0 && answer.selectedIndex <= 3) {
      counts[answer.selectedIndex] += 1;
    }
  });
  return counts;
}

function getDefaultMafiaState() {
  return {
    round: 1,
    settings: getDefaultMafiaSettings(),
    students: {},
    rounds: {},
    winner: null,
    lastElimination: null,
    ghosts: {},
    ghostChat: {},
    discussionStartedAt: null
  };
}

function getDefaultMafiaSettings() {
  return {
    mafiaCount: DEFAULT_MAFIA_COUNT,
    policeCount: DEFAULT_POLICE_COUNT,
    doctorCount: DEFAULT_DOCTOR_COUNT,
    discussionSeconds: DEFAULT_DISCUSSION_SECONDS,
    revealRoleOnElimination: REVEAL_ROLE_ON_ELIMINATION,
    voteTieRule: VOTE_TIE_RULE,
    selfSelectAllowed: MAFIA_SELF_SELECT_ALLOWED
  };
}

function getMafiaState() {
  return {
    ...getDefaultMafiaState(),
    ...(state.room?.mafia || {}),
    settings: getMafiaSettings()
  };
}

function getMafiaSettings() {
  return {
    ...getDefaultMafiaSettings(),
    ...(state.room?.mafia?.settings || {})
  };
}

function getDefaultLiarState() {
  return {
    settings: getDefaultLiarSettings(),
    assignments: {},
    confirmations: {},
    votes: {},
    majorityWord: "",
    liarWord: "",
    liarStudentIds: [],
    startedAt: null,
    voteOpenedAt: null,
    voteResultOpenedAt: null,
    revealedAt: null
  };
}

function getInitialLiarStateForWrite() {
  return {
    settings: getDefaultLiarSettings()
  };
}

function getDefaultLiarSettings() {
  return {
    wordA: "",
    wordB: "",
    liarCount: DEFAULT_LIAR_COUNT
  };
}

function getLiarState() {
  return {
    ...getDefaultLiarState(),
    ...(state.room?.liar || {}),
    settings: getLiarSettings()
  };
}

function getLiarSettings() {
  return {
    ...getDefaultLiarSettings(),
    ...(state.room?.liar?.settings || {})
  };
}

function readLiarSettingsFromForm() {
  const students = getStudents();
  const maxLiarCount = Math.max(1, students.length - 1);
  const current = getLiarSettings();
  return {
    wordA: cleanText(document.querySelector("#liarWordAInput")?.value || current.wordA),
    wordB: cleanText(document.querySelector("#liarWordBInput")?.value || current.wordB),
    liarCount: clampInt(document.querySelector("#liarCountInput")?.value, 1, maxLiarCount, current.liarCount)
  };
}

function validateLiarSettings(settings) {
  if (!settings.wordA || !settings.wordB) {
    showToast("제시어 1과 제시어 2를 모두 입력해 주세요.", "error");
    return false;
  }

  if (settings.wordA === settings.wordB) {
    showToast("두 제시어는 서로 달라야 합니다.", "error");
    return false;
  }

  if (getStudents().length >= 2 && settings.liarCount >= getStudents().length) {
    showToast("모든 학생이 라이어가 될 수는 없습니다. 라이어 수를 줄여 주세요.", "error");
    return false;
  }

  return true;
}

function stepLiarCount(delta) {
  const input = document.querySelector("#liarCountInput");
  if (!input) {
    return;
  }
  const max = Number(input.max || Math.max(1, getStudents().length - 1));
  input.value = clampInt(Number(input.value || DEFAULT_LIAR_COUNT) + delta, 1, max, DEFAULT_LIAR_COUNT);
}

function readMafiaSettingsFromForm() {
  const current = getMafiaSettings();
  return {
    mafiaCount: clampInt(document.querySelector("#mafiaCountInput")?.value, 1, 10, current.mafiaCount),
    policeCount: clampInt(document.querySelector("#policeCountInput")?.value, 0, 5, current.policeCount),
    doctorCount: clampInt(document.querySelector("#doctorCountInput")?.value, 0, 5, current.doctorCount),
    discussionSeconds: clampInt(document.querySelector("#discussionSecondsInput")?.value, 30, 900, current.discussionSeconds),
    revealRoleOnElimination: REVEAL_ROLE_ON_ELIMINATION,
    voteTieRule: VOTE_TIE_RULE,
    selfSelectAllowed: MAFIA_SELF_SELECT_ALLOWED
  };
}

function getMafiaPlayers() {
  const raw = state.room?.mafia?.students || {};
  const roomStudents = state.room?.students || {};
  return Object.entries(raw)
    .map(([id, value]) => ({
      id,
      name: value.name || roomStudents[id]?.name || "이름 없음",
      role: value.role || "citizen",
      team: value.team || (value.role === "mafia" ? "mafia" : "citizen"),
      alive: value.alive !== false,
      connected: isStudentConnected(id, roomStudents[id]),
      joinedAt: roomStudents[id]?.joinedAt || 0
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
}

function getMafiaPlayer(studentId) {
  return getMafiaPlayers().find((player) => player.id === studentId) || null;
}

function getLiarParticipants() {
  const assignments = state.room?.liar?.assignments || {};
  const roomStudents = state.room?.students || {};

  if (Object.keys(assignments).length) {
    return Object.entries(assignments)
      .map(([id, assignment]) => ({
        id,
        name: assignment.name || roomStudents[id]?.name || "이름 없음",
        word: assignment.word || "",
        connected: isStudentConnected(id, roomStudents[id])
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  }

  return getStudents();
}

function getLiarStudentIds() {
  const raw = state.room?.liar?.liarStudentIds || [];
  return Array.isArray(raw) ? raw.map(String) : Object.values(raw).map(String);
}

function getMyLiarAssignment() {
  return getLiarParticipants().find((participant) => participant.id === state.studentId) || null;
}

function getLiarConfirmations() {
  return state.room?.liar?.confirmations || {};
}

function getLiarConfirmation(studentId) {
  return getLiarConfirmations()[studentId] || null;
}

function getLiarVotes() {
  return state.room?.liar?.votes || {};
}

function getMyLiarVote() {
  return getLiarVotes()[state.studentId] || null;
}

function getLiarVoteResultRows() {
  const participants = getLiarParticipants();
  const counts = participants.reduce((result, participant) => {
    result[participant.id] = 0;
    return result;
  }, {});

  const publicCounts = securePilot ? getLiarState().counts : null;
  if (publicCounts) for (const id of Object.keys(counts)) counts[id] = Number(publicCounts[id] || 0);
  else Object.values(getLiarVotes()).forEach((vote) => {
    if (vote?.targetStudentId && Object.prototype.hasOwnProperty.call(counts, vote.targetStudentId)) {
      counts[vote.targetStudentId] += 1;
    }
  });

  let previousVotes = null;
  let previousRank = 0;
  return participants
    .map((participant) => ({
      id: participant.id,
      name: participant.name,
      votes: Number(counts[participant.id] || 0)
    }))
    .sort((a, b) => {
      if (b.votes !== a.votes) {
        return b.votes - a.votes;
      }
      return String(a.name).localeCompare(String(b.name), "ko");
    })
    .map((row, index) => {
      const rank = row.votes === previousVotes ? previousRank : index + 1;
      previousVotes = row.votes;
      previousRank = rank;
      return { ...row, rank };
    });
}

function getMafiaRoundNumber() {
  return Math.max(1, Number(state.room?.mafia?.round || 1));
}

function getCurrentMafiaRound() {
  return state.room?.mafia?.rounds?.[getMafiaRoundNumber()] || {};
}

function getMafiaNightAction(studentId, role) {
  return getCurrentMafiaRound().nightActions?.[role]?.[studentId] || null;
}

function getMafiaVote(studentId) {
  return getCurrentMafiaRound().votes?.[studentId] || null;
}

function getMafiaGhosts() {
  const raw = state.room?.mafia?.ghosts || {};
  return Object.entries(raw)
    .map(([id, ghost]) => ({
      id,
      playerId: ghost.playerId || id,
      name: ghost.name || getStudentNameById(id, "이름 없음"),
      role: ghost.role || "citizen",
      joinedAt: Number(ghost.joinedAt || 0),
      source: ghost.source || "",
      round: Number(ghost.round || 1),
      bingoConfirmed: Boolean(ghost.bingoConfirmed),
      confirmedAt: Number(ghost.confirmedAt || 0),
      selectedIds: normalizeGhostSelectedIds(ghost.selectedIds),
      board: normalizeGhostBingoBoard(ghost.board),
      checked: ghost.checked || {},
      bingoLines: Number(ghost.bingoLines || 0),
      checkedCount: Number(ghost.checkedCount || 0),
      firstBingoAt: Number(ghost.firstBingoAt || 0)
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt || String(a.name).localeCompare(String(b.name), "ko"));
}

function getMafiaGhost(studentId) {
  return getMafiaGhosts().find((ghost) => ghost.id === studentId || ghost.playerId === studentId) || null;
}

function addMafiaGhostJoinUpdates(updates, player, source) {
  if (!player || getMafiaGhost(player.id)) {
    return;
  }

  const now = Date.now();
  const messageId = createGhostChatMessageId();
  updates[`mafia/ghosts/${player.id}`] = {
    playerId: player.id,
    name: player.name,
    role: player.role || "citizen",
    joinedAt: now,
    source,
    round: getMafiaRoundNumber(),
    bingoConfirmed: false,
    selectedIds: null,
    board: null,
    checked: null,
    bingoLines: 0,
    checkedCount: 0,
    firstBingoAt: null
  };
  updates[`mafia/ghostChat/${messageId}`] = {
    messageId,
    playerId: player.id,
    playerName: player.name,
    messageType: "system",
    content: `👻 ${player.name}님이 저승에 도착했습니다.`,
    createdAt: now,
    round: getMafiaRoundNumber()
  };
}

async function ensureMafiaGhostEntry(player) {
  if (!db || !player || getMafiaGhost(player.id)) {
    return;
  }

  const key = `${state.roomCode}:${player.id}:${getMafiaRoundNumber()}`;
  if (state.ghostJoinWriteKey === key) {
    return;
  }

  state.ghostJoinWriteKey = key;
  const updates = {};
  addMafiaGhostJoinUpdates(updates, player, "sync");

  try {
    await update(roomRef(state.roomCode), updates);
  } catch (error) {
    finalRelease?.record("app-error");
  } finally {
    state.ghostJoinWriteKey = "";
  }
}

function createGhostChatMessageId() {
  return `ghost_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function getMafiaGhostChatMessages({ teacher = false, ghost = null } = {}) {
  const raw = state.room?.mafia?.ghostChat || {};
  return Object.entries(raw)
    .map(([id, message]) => ({
      id,
      messageId: message.messageId || id,
      playerId: message.playerId || "",
      playerName: message.playerName || "",
      content: message.content || "",
      messageType: message.messageType || "user",
      createdAt: Number(message.createdAt || 0)
    }))
    .filter((message) => {
      if (teacher || !ghost) {
        return true;
      }
      return Number(message.createdAt || 0) >= Number(ghost.joinedAt || 0);
    })
    .sort((a, b) => a.createdAt - b.createdAt || String(a.messageId).localeCompare(String(b.messageId)));
}

function getGhostChatRenderKey({ teacher = false, ghost = null } = {}) {
  const messages = getMafiaGhostChatMessages({ teacher, ghost });
  const last = messages[messages.length - 1];
  return `${messages.length}:${last?.messageId || "none"}:${last?.createdAt || 0}`;
}

function getGhostBingoRenderKey(ghost) {
  if (!ghost) {
    return "none";
  }
  const checked = ghost.checked || {};
  const checkedKey = Object.keys(checked)
    .filter((key) => checked[key])
    .sort()
    .join(".");
  return [
    Number(ghost.checkedCount || 0),
    Number(ghost.bingoLines || 0),
    ghost.firstBingoAt || 0,
    checkedKey
  ].join(":");
}

function captureGhostChatDraft() {
  const input = document.querySelector("#ghostChatInput");
  if (!input) {
    return;
  }
  if (state.ghostChatSending) {
    return;
  }
  state.ghostChatDraft = input.value;
  state.ghostChatShouldFocus = document.activeElement === input;
}

function getGhostBingoCondition(conditionId) {
  return GHOST_BINGO_CONDITIONS.find((condition) => condition.id === conditionId) || null;
}

function normalizeGhostSelectedIds(value) {
  const source = Array.isArray(value)
    ? value
    : Object.keys(value || {}).sort((a, b) => Number(a) - Number(b)).map((key) => value[key]);
  const validIds = new Set(GHOST_BINGO_CONDITIONS.map((condition) => condition.id));
  return source
    .map(String)
    .filter((id, index, items) => validIds.has(id) && items.indexOf(id) === index)
    .slice(0, GHOST_BINGO_REQUIRED_CONDITIONS);
}

function normalizeGhostBingoBoard(value) {
  const source = Array.isArray(value)
    ? value
    : Object.keys(value || {}).sort((a, b) => Number(a) - Number(b)).map((key) => value[key]);
  const validIds = new Set(GHOST_BINGO_CONDITIONS.map((condition) => condition.id));
  const board = Array.from({ length: 9 }, (_, index) => {
    if (index === 4) {
      return GHOST_BINGO_FREE_ID;
    }
    const id = String(source[index] || "");
    return validIds.has(id) ? id : "";
  });
  board[4] = GHOST_BINGO_FREE_ID;
  return board;
}

function getGhostBingoDraft(ghost) {
  if (!state.ghostBingoDraft || state.ghostBingoDraft.studentId !== state.studentId) {
    state.ghostBingoDraft = {
      studentId: state.studentId,
      selectedIds: normalizeGhostSelectedIds(ghost.selectedIds),
      board: normalizeGhostBingoBoard(ghost.board)
    };
    state.selectedGhostBingoConditionId = state.ghostBingoDraft.selectedIds[0] || "";
  }
  state.ghostBingoDraft.board[4] = GHOST_BINGO_FREE_ID;
  return state.ghostBingoDraft;
}

function toggleGhostBingoCondition(conditionId) {
  const condition = getGhostBingoCondition(conditionId);
  const ghost = getMafiaGhost(state.studentId);
  if (!condition || !ghost || ghost.bingoConfirmed) {
    return;
  }

  const draft = getGhostBingoDraft(ghost);
  const selectedIndex = draft.selectedIds.indexOf(conditionId);

  if (selectedIndex >= 0) {
    if (state.selectedGhostBingoConditionId === conditionId) {
      state.selectedGhostBingoConditionId = conditionId;
      renderMafiaGhostMode(true);
      return;
    }
    state.selectedGhostBingoConditionId = conditionId;
    renderMafiaGhostMode(true);
    return;
  }

  if (draft.selectedIds.length >= GHOST_BINGO_REQUIRED_CONDITIONS) {
    showToast("빙고 조건은 8개까지만 선택할 수 있습니다.", "error");
    return;
  }

  draft.selectedIds.push(conditionId);
  state.selectedGhostBingoConditionId = conditionId;
  renderMafiaGhostMode(true);
}

function removeGhostBingoCondition(conditionId) {
  const ghost = getMafiaGhost(state.studentId);
  if (!ghost || ghost.bingoConfirmed) {
    return;
  }
  const draft = getGhostBingoDraft(ghost);
  draft.selectedIds = draft.selectedIds.filter((id) => id !== conditionId);
  draft.board = draft.board.map((id, index) => index === 4 ? GHOST_BINGO_FREE_ID : id === conditionId ? "" : id);
  if (state.selectedGhostBingoConditionId === conditionId) {
    state.selectedGhostBingoConditionId = draft.selectedIds[0] || "";
  }
  renderMafiaGhostMode(true);
}

function placeGhostBingoCondition(cellIndex) {
  const ghost = getMafiaGhost(state.studentId);
  if (!ghost || ghost.bingoConfirmed) {
    return;
  }

  const index = Number(cellIndex);
  if (!Number.isInteger(index) || index < 0 || index > 8 || index === 4) {
    return;
  }

  const draft = getGhostBingoDraft(ghost);
  const selectedId = state.selectedGhostBingoConditionId;

  if (!selectedId || !draft.selectedIds.includes(selectedId)) {
    showToast("먼저 배치할 조건 카드를 눌러 주세요.", "error");
    return;
  }

  const previousIndex = draft.board.indexOf(selectedId);
  if (previousIndex === index) {
    return;
  }

  if (previousIndex >= 0) {
    const targetId = draft.board[index] || "";
    draft.board[index] = selectedId;
    draft.board[previousIndex] = targetId;
    state.selectedGhostBingoConditionId = targetId || selectedId;
  } else {
    const targetId = draft.board[index] || "";
    draft.board[index] = selectedId;
    state.selectedGhostBingoConditionId = targetId || selectedId;
  }

  renderMafiaGhostMode(true);
}

async function confirmGhostBingoBoard() {
  const ghost = getMafiaGhost(state.studentId);
  if (!ghost || ghost.bingoConfirmed) {
    return;
  }

  const draft = getGhostBingoDraft(ghost);
  const selectedIds = normalizeGhostSelectedIds(draft.selectedIds);
  const board = normalizeGhostBingoBoard(draft.board);
  const boardIds = board.filter((id, index) => index !== 4 && id);
  const uniqueBoardIds = new Set(boardIds);

  if (selectedIds.length !== GHOST_BINGO_REQUIRED_CONDITIONS || boardIds.length !== GHOST_BINGO_REQUIRED_CONDITIONS || uniqueBoardIds.size !== GHOST_BINGO_REQUIRED_CONDITIONS) {
    showToast("조건 8개를 고르고 모든 칸에 배치해 주세요.", "error");
    return;
  }

  if (boardIds.some((id) => !selectedIds.includes(id))) {
    showToast("선택하지 않은 조건이 빙고판에 들어 있습니다.", "error");
    return;
  }

  if (securePilot) {
    const result = await securePilot.send("confirmGhostBingo", { board });
    if (result.error) return showToast(securePilotError(result.error), "error");
    state.ghostBingoDraft = null;
    state.selectedGhostBingoConditionId = "";
    return showToast("유령 빙고판을 확정했습니다.", "success");
  }

  try {
    await update(ref(db, `rooms/${state.roomCode}/mafia/ghosts/${state.studentId}`), {
      selectedIds,
      board,
      bingoConfirmed: true,
      confirmedAt: Date.now(),
      checked: null,
      bingoLines: 0,
      checkedCount: 0,
      firstBingoAt: null
    });
    state.ghostBingoDraft = null;
    state.selectedGhostBingoConditionId = "";
    showToast("유령 빙고판을 확정했습니다.", "success");
  } catch (error) {
    finalRelease?.record("app-error");
    showToast("빙고판을 저장하지 못했습니다.", "error");
  }
}

function setupGhostBingoHandlers(ghost) {
  if (!ghost || ghost.bingoConfirmed) {
    return;
  }

  document.querySelectorAll("[data-ghost-condition]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.classList.contains("selected") && state.selectedGhostBingoConditionId === button.dataset.ghostCondition) {
        removeGhostBingoCondition(button.dataset.ghostCondition);
        return;
      }
      toggleGhostBingoCondition(button.dataset.ghostCondition);
    });
  });

  document.querySelectorAll("[data-ghost-cell]").forEach((button) => {
    button.addEventListener("click", () => placeGhostBingoCondition(button.dataset.ghostCell));
  });

  document.querySelector("[data-action='ghost-confirm-bingo']")?.addEventListener("click", confirmGhostBingoBoard);
}

function setupGhostChatHandlers() {
  const input = document.querySelector("#ghostChatInput");
  const button = document.querySelector("#ghostChatSendBtn");
  if (!input || !button) {
    return;
  }

  input.value = state.ghostChatDraft || "";
  button.disabled = state.ghostChatSending;
  input.addEventListener("input", () => {
    state.ghostChatDraft = input.value;
  });
  button.addEventListener("click", sendGhostChatMessage);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendGhostChatMessage();
    }
  });
}

async function sendGhostChatMessage() {
  const input = document.querySelector("#ghostChatInput");
  const button = document.querySelector("#ghostChatSendBtn");
  const player = getMafiaPlayer(state.studentId);
  const ghost = getMafiaGhost(state.studentId);
  const content = cleanText(input?.value || state.ghostChatDraft || "").slice(0, GHOST_CHAT_MAX_LENGTH);

  if (!input || !player || player.alive || !ghost) {
    showToast("유령만 채팅을 보낼 수 있습니다.", "error");
    return;
  }

  if ((state.room?.status || "waiting") === "finished") {
    showToast("게임이 끝난 뒤에는 채팅을 보낼 수 없습니다.", "error");
    return;
  }

  if (!content) {
    showToast("메시지를 입력해 주세요.", "error");
    return;
  }

  if (state.ghostChatSending) {
    return;
  }

  const now = Date.now();
  if (now - state.lastGhostChatAt < GHOST_CHAT_COOLDOWN_MS) {
    showToast("잠시 후 다시 보내 주세요.", "error");
    return;
  }

  const previousDraft = state.ghostChatDraft || input.value || "";
  state.ghostChatSending = true;
  state.lastGhostChatAt = now;
  state.ghostChatDraft = "";
  state.ghostChatShouldFocus = true;
  input.value = "";
  input.disabled = true;
  if (button) {
    button.disabled = true;
  }
  const messageId = createGhostChatMessageId();
  try {
    if (securePilot) {
      const result = await securePilot.send("sendGhostChat", { content });
      if (result.error) throw new Error(securePilotError(result.error));
    } else {
      await set(ref(db, `rooms/${state.roomCode}/mafia/ghostChat/${messageId}`), {
        messageId,
        playerId: state.studentId,
        playerName: player.name || state.studentName,
        messageType: "user",
        content,
        createdAt: now,
        round: getMafiaRoundNumber()
      });
    }
    scrollGhostChatToBottom({ focusInput: true });
  } catch (error) {
    finalRelease?.record("app-error");
    state.ghostChatDraft = previousDraft;
    state.lastGhostChatAt = 0;
    if (document.querySelector("#ghostChatInput")) {
      document.querySelector("#ghostChatInput").value = previousDraft;
    }
    showToast(securePilot && error instanceof Error ? error.message : "유령 채팅을 보내지 못했습니다.", "error");
  } finally {
    state.ghostChatSending = false;
    const nextInput = document.querySelector("#ghostChatInput");
    const nextButton = document.querySelector("#ghostChatSendBtn");
    if (nextInput) {
      nextInput.disabled = false;
    }
    if (nextButton) {
      nextButton.disabled = false;
    }
  }
}

function scrollGhostChatToBottom({ focusInput = false } = {}) {
  const chatList = document.querySelector("#ghostChatList");
  const input = document.querySelector("#ghostChatInput");
  const apply = () => {
    if (chatList) {
      chatList.scrollTop = chatList.scrollHeight;
    }
    if (focusInput && input && !input.disabled) {
      input.focus({ preventScroll: true });
    }
  };
  apply();
  requestAnimationFrame(apply);
  window.setTimeout(apply, 80);
}

function getMafiaSelectablePlayers(selfId, { allowSelf = false } = {}) {
  const settings = getMafiaSettings();
  return getMafiaPlayers().filter((player) => {
    return player.alive && (settings.selfSelectAllowed || allowSelf || player.id !== selfId);
  });
}

function isMafiaNightComplete() {
  const alivePlayers = getMafiaPlayers().filter((player) => player.alive);
  return alivePlayers.length > 0 && alivePlayers.every((player) => {
    return Boolean(getMafiaNightAction(player.id, player.role));
  });
}

function buildMafiaNightResult() {
  const players = getMafiaPlayers();
  const alivePlayers = players.filter((player) => player.alive);
  const round = getCurrentMafiaRound();
  const mafiaActions = Object.entries(round.nightActions?.mafia || {})
    .map(([studentId, action]) => ({ studentId, ...action }))
    .filter((action) => action.selectedStudentId);
  const doctorActions = Object.values(round.nightActions?.doctor || {})
    .filter((action) => action.selectedStudentId);
  const policeActions = Object.values(round.nightActions?.police || {})
    .filter((action) => action.selectedStudentId);
  const citizenActions = Object.values(round.nightActions?.citizen || {})
    .filter((action) => action.selectedStudentId);

  const attackCounts = countSelections(mafiaActions);
  const attackCandidates = getTopSelectionCandidates(attackCounts);
  const attackTargetId = attackCandidates.length
    ? attackCandidates[Math.floor(Math.random() * attackCandidates.length)]
    : "";
  const attackTarget = players.find((player) => player.id === attackTargetId);
  const protectedIds = new Set(doctorActions.map((action) => action.selectedStudentId));
  const protectedNames = doctorActions.map((action) => action.selectedName).filter(Boolean);
  const savedByDoctor = Boolean(attackTargetId && protectedIds.has(attackTargetId));
  const eliminated = attackTargetId && !savedByDoctor ? attackTarget : null;

  return {
    mafiaAttackTargetStudentId: attackTargetId || "",
    mafiaAttackTargetName: attackTarget?.name || "",
    mafiaAttackResolvedBy: attackCandidates.length > 1 ? "random" : attackCandidates.length === 1 ? "majority" : "none",
    mafiaAttackCandidateStudentIds: attackCandidates,
    mafiaAttackCandidates: attackCandidates.map((id) => getMafiaPlayer(id)?.name || "이름 없음"),
    doctorProtectedStudentIds: [...protectedIds],
    doctorProtectedNames: protectedNames,
    doctorProtectedStudentId: doctorActions[0]?.selectedStudentId || "",
    doctorProtectedName: doctorActions[0]?.selectedName || "",
    eliminatedStudentId: eliminated?.id || "",
    eliminatedName: eliminated?.name || "",
    savedByDoctor,
    policeActionCount: policeActions.length,
    citizenActionCount: citizenActions.length,
    aliveCountAtNight: alivePlayers.length,
    calculatedAt: Date.now()
  };
}

function buildMafiaVoteResult() {
  const round = getCurrentMafiaRound();
  const votes = Object.values(round.votes || {}).filter((vote) => vote.selectedStudentId);
  const counts = countSelections(votes);
  const topCandidates = getTopSelectionCandidates(counts);
  const attempt = Number(round.voteAttempt || 1);
  const tied = topCandidates.length > 1;
  const shouldRevote = tied && getMafiaSettings().voteTieRule === "revote_then_skip" && attempt < 2;
  const skippedByTie = tied && !shouldRevote;
  const eliminatedId = !tied && topCandidates[0] ? topCandidates[0] : "";
  const topName = topCandidates[0] ? getMafiaPlayer(topCandidates[0])?.name || "이름 없음" : "";

  return {
    topVotedStudentId: topCandidates[0] || "",
    topVotedName: topName,
    tiedStudentIds: tied ? topCandidates : [],
    tiedNames: tied ? topCandidates.map((id) => getMafiaPlayer(id)?.name || "이름 없음") : [],
    voteCounts: counts,
    voteAttempt: attempt,
    revotedTieRequired: shouldRevote,
    revotedTieSkipped: skippedByTie,
    eliminatedStudentId: eliminatedId,
    eliminatedName: eliminatedId ? getMafiaPlayer(eliminatedId)?.name || "" : "",
    calculatedAt: Date.now()
  };
}

function countSelections(actions) {
  return actions.reduce((counts, action) => {
    const id = action.selectedStudentId;
    if (id) {
      counts[id] = Number(counts[id] || 0) + 1;
    }
    return counts;
  }, {});
}

function getTopSelectionCandidates(counts) {
  const entries = Object.entries(counts);
  if (!entries.length) {
    return [];
  }
  const max = Math.max(...entries.map(([, count]) => Number(count)));
  return entries
    .filter(([, count]) => Number(count) === max)
    .map(([id]) => id);
}

function getMafiaBingoEvents() {
  const players = getMafiaPlayers();
  const playerMap = Object.fromEntries(players.map((player) => [player.id, player]));
  const aliveSet = new Set(players.map((player) => player.id));
  const rounds = state.room?.mafia?.rounds || {};
  const events = [];

  Object.keys(rounds)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((roundKey) => {
      const round = rounds[roundKey] || {};
      const roundNumber = Number(roundKey);
      const nightResult = round.nightResult || null;

      if (nightResult?.calculatedAt || nightResult?.publishedAt) {
        const eliminatedId = nightResult.eliminatedStudentId || "";
        const eliminated = playerMap[eliminatedId] || {};
        if (eliminatedId) {
          aliveSet.delete(eliminatedId);
        }
        events.push({
          type: "NIGHT_RESULT",
          round: roundNumber,
          timestamp: Number(nightResult.publishedAt || nightResult.calculatedAt || Date.now()),
          eliminatedStudentId: eliminatedId,
          eliminatedName: nightResult.eliminatedName || eliminated.name || "",
          eliminatedRole: eliminated.role || "",
          eliminatedTeam: eliminated.role === "mafia" ? "mafia" : "citizen",
          savedByDoctor: Boolean(nightResult.savedByDoctor),
          aliveCountAfter: aliveSet.size
        });
      }

      const voteResult = round.voteResult || null;
      if (voteResult?.calculatedAt) {
        const counts = voteResult.voteCounts || countSelections(Object.values(round.votes || {}));
        const countValues = Object.values(counts).map((count) => Number(count || 0)).sort((a, b) => b - a);
        const topCount = countValues[0] || 0;
        const secondCount = countValues[1] || 0;
        const eliminatedId = voteResult.eliminatedStudentId || "";
        const eliminated = playerMap[eliminatedId] || {};
        if (eliminatedId) {
          aliveSet.delete(eliminatedId);
        }
        events.push({
          type: "VOTE_RESULT",
          round: roundNumber,
          timestamp: Number(voteResult.calculatedAt || Date.now()),
          topVotedStudentId: voteResult.topVotedStudentId || "",
          topVotedName: voteResult.topVotedName || "",
          tiedStudentIds: voteResult.tiedStudentIds || [],
          voteCounts: counts,
          totalVotes: countValues.reduce((sum, count) => sum + count, 0),
          topCount,
          secondCount,
          distinctVotedCount: Object.keys(counts).length,
          singleVoteCandidateCount: countValues.filter((count) => count === 1).length,
          revotedTieRequired: Boolean(voteResult.revotedTieRequired),
          revotedTieSkipped: Boolean(voteResult.revotedTieSkipped),
          eliminatedStudentId: eliminatedId,
          eliminatedName: voteResult.eliminatedName || eliminated.name || "",
          eliminatedRole: eliminated.role || "",
          eliminatedTeam: eliminated.role === "mafia" ? "mafia" : "citizen",
          aliveCountAfter: aliveSet.size
        });
      }
    });

  return events.sort((a, b) => a.timestamp - b.timestamp || a.round - b.round);
}

function getFirstEventTime(events, predicate) {
  const event = events.find(predicate);
  return event ? Number(event.timestamp || 0) : 0;
}

function getConsecutiveTopVoteMatchTime(events) {
  const voteEvents = events.filter((event) => event.type === "VOTE_RESULT" && event.topVotedStudentId);
  for (let index = 1; index < voteEvents.length; index += 1) {
    if (voteEvents[index - 1].topVotedStudentId === voteEvents[index].topVotedStudentId) {
      return Number(voteEvents[index].timestamp || 0);
    }
  }
  return 0;
}

function getSameTargetVotedTwiceMatchTime(events) {
  const voteEvents = events.filter((event) => event.type === "VOTE_RESULT");
  for (let index = 1; index < voteEvents.length; index += 1) {
    const previousIds = new Set(Object.keys(voteEvents[index - 1].voteCounts || {}));
    const currentIds = Object.keys(voteEvents[index].voteCounts || {});
    if (currentIds.some((id) => previousIds.has(id))) {
      return Number(voteEvents[index].timestamp || 0);
    }
  }
  return 0;
}

function getConsecutiveCitizenTeamDeathsMatchTime(events) {
  const deathEvents = events.filter((event) => event.eliminatedStudentId);
  for (let index = 1; index < deathEvents.length; index += 1) {
    const previousCitizenTeamDeath = deathEvents[index - 1].eliminatedRole && deathEvents[index - 1].eliminatedRole !== "mafia";
    const currentCitizenTeamDeath = deathEvents[index].eliminatedRole && deathEvents[index].eliminatedRole !== "mafia";
    if (previousCitizenTeamDeath && currentCitizenTeamDeath) {
      return Number(deathEvents[index].timestamp || 0);
    }
  }
  return 0;
}

function getGhostBingoMatchesSince(confirmedAt) {
  const events = getMafiaBingoEvents().filter((event) => Number(event.timestamp || 0) >= Number(confirmedAt || 0));
  return GHOST_BINGO_CONDITIONS.reduce((matches, condition) => {
    const matchedAt = Number(condition.matchAt(events) || 0);
    if (matchedAt) {
      matches[condition.id] = matchedAt;
    }
    return matches;
  }, {});
}

function getGhostBingoComputedResult(ghost) {
  if (securePilot) return ghost;
  const board = normalizeGhostBingoBoard(ghost.board);
  const matches = getGhostBingoMatchesSince(ghost.confirmedAt);
  const checked = { ...(ghost.checked || {}) };

  board.forEach((conditionId, index) => {
    if (index !== 4 && conditionId && matches[conditionId]) {
      checked[conditionId] = true;
    }
  });

  const lineTimes = getGhostBingoLineTimes(board, matches, ghost.confirmedAt);
  return {
    board,
    checked,
    bingoLines: lineTimes.length,
    checkedCount: board.filter((conditionId, index) => index !== 4 && conditionId && checked[conditionId]).length,
    firstBingoAt: Number(ghost.firstBingoAt || 0) || (lineTimes[0] || 0),
    matches
  };
}

function getGhostBingoLineTimes(board, matches, confirmedAt) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  return lines
    .map((line) => {
      const times = line.map((index) => {
        if (index === 4) {
          return Number(confirmedAt || 0);
        }
        const conditionId = board[index];
        return conditionId && matches[conditionId] ? Number(matches[conditionId]) : 0;
      });
      return times.every(Boolean) ? Math.max(...times) : 0;
    })
    .filter(Boolean)
    .sort((a, b) => a - b);
}

function getGhostBingoRanking() {
  return getMafiaGhosts()
    .filter((ghost) => ghost.bingoConfirmed)
    .map((ghost) => ({
      ...ghost,
      ...getGhostBingoComputedResult(ghost)
    }))
    .sort((a, b) => {
      if (b.bingoLines !== a.bingoLines) {
        return b.bingoLines - a.bingoLines;
      }
      if (b.checkedCount !== a.checkedCount) {
        return b.checkedCount - a.checkedCount;
      }
      const aFirst = a.firstBingoAt || Number.MAX_SAFE_INTEGER;
      const bFirst = b.firstBingoAt || Number.MAX_SAFE_INTEGER;
      if (aFirst !== bFirst) {
        return aFirst - bFirst;
      }
      return String(a.name).localeCompare(String(b.name), "ko");
    });
}

function syncAllGhostBingoProgress() {
  getMafiaGhosts()
    .filter((ghost) => ghost.bingoConfirmed)
    .forEach((ghost) => syncGhostBingoProgress(ghost));
}

async function syncGhostBingoProgress(ghost) {
  if (!db || !ghost?.bingoConfirmed) {
    return;
  }

  const result = getGhostBingoComputedResult(ghost);
  const previousChecked = ghost.checked || {};
  const changed = result.bingoLines !== ghost.bingoLines
    || result.checkedCount !== ghost.checkedCount
    || Object.keys(result.checked).some((id) => Boolean(result.checked[id]) !== Boolean(previousChecked[id]))
    || (result.firstBingoAt && !ghost.firstBingoAt);

  if (!changed) {
    return;
  }

  const updates = {
    checked: result.checked,
    bingoLines: result.bingoLines,
    checkedCount: result.checkedCount
  };

  if (result.firstBingoAt && !ghost.firstBingoAt) {
    updates.firstBingoAt = result.firstBingoAt;
  }

  try {
    await update(ref(db, `rooms/${state.roomCode}/mafia/ghosts/${ghost.id}`), updates);
  } catch (error) {
    finalRelease?.record("app-error");
  }
}

function projectMafiaPlayersAfterElimination(eliminatedStudentId) {
  return getMafiaPlayers().map((player) => ({
    ...player,
    alive: eliminatedStudentId === player.id ? false : player.alive
  }));
}

function getMafiaWinnerForPlayers(players) {
  const alivePlayers = players.filter((player) => player.alive);
  const aliveMafiaCount = alivePlayers.filter((player) => player.role === "mafia").length;
  const aliveCitizenTeamCount = alivePlayers.length - aliveMafiaCount;

  if (aliveMafiaCount === 0 && players.length) {
    return "citizen";
  }
  if (aliveMafiaCount >= aliveCitizenTeamCount && aliveMafiaCount > 0) {
    return "mafia";
  }
  return null;
}

function getMafiaWinner() {
  if (securePilot) return state.room?.mafia?.winner || "";
  return state.room?.mafia?.winner || getMafiaWinnerForPlayers(getMafiaPlayers());
}

function getLastMafiaElimination() {
  return state.room?.mafia?.lastElimination || null;
}

function roleLabel(role) {
  const labels = {
    mafia: "마피아",
    citizen: "시민",
    police: "경찰",
    doctor: "의사"
  };
  return labels[role] || "시민";
}

function publicMafiaRoleLabel(role) {
  return role === "mafia" ? "마피아" : "시민";
}

function roleDescription(role) {
  const descriptions = {
    mafia: "밤마다 한 명을 공격 대상으로 선택하세요. 같은 마피아들의 선택 현황을 보며 대상을 맞출 수 있습니다.",
    citizen: "낮 토론과 투표로 마피아를 찾아내세요. 밤에는 모두와 같이 한 명을 선택합니다.",
    police: "밤마다 한 명을 조사할 수 있습니다. 조사 결과는 본인 화면에만 표시됩니다.",
    doctor: "밤마다 한 명을 보호할 수 있습니다. 보호 대상이 공격 대상과 같으면 탈락자가 발생하지 않습니다."
  };
  return descriptions[role] || descriptions.citizen;
}

function mafiaWinnerText(winner) {
  return winner === "mafia" ? "마피아팀 승리입니다." : "시민팀 승리입니다.";
}

function modeLabel(mode) {
  const labels = {
    quiz: "퀴즈 배틀",
    compliment: "칭찬 스무고개",
    mafia: "교실 마피아 게임",
    liar: "라이어게임",
    catchmind: "캐치마인드",
    seat: "자리바꾸기 게임",
    memory: "메모리 배틀",
    bingo: "개념 빙고",
    word: "초성 단어 챌린지"
  };
  return labels[mode] || "퀴즈 배틀";
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

// =========================
// 렌더 조각
// =========================

function renderMafiaPartnerChoices(round) {
  const mafiaPlayers = getMafiaPlayers().filter((player) => player.role === "mafia" && player.alive);
  const mafiaActions = round.nightActions?.mafia || {};

  return `
    <section class="notice warn">
      <strong>마피아 선택 현황</strong>
      <ul class="compact-list">
        ${mafiaPlayers.map((player) => {
          const action = mafiaActions[player.id];
          return `<li>${escapeHtml(player.name)} → ${action?.selectedName ? escapeHtml(action.selectedName) : "선택 대기 중"}</li>`;
        }).join("")}
      </ul>
    </section>
  `;
}

function renderMafiaWinCheck() {
  const players = getMafiaPlayers();
  if (!players.length) {
    return `<div class="empty">역할을 배정하면 승리 조건을 확인할 수 있습니다.</div>`;
  }

  const alivePlayers = players.filter((player) => player.alive);
  const aliveMafiaCount = alivePlayers.filter((player) => player.role === "mafia").length;
  const aliveCitizenTeamCount = alivePlayers.length - aliveMafiaCount;

  return `
    <div class="stats">
      <div class="stat">
        <span class="muted">생존 마피아</span>
        <span class="num">${aliveMafiaCount}</span>
      </div>
      <div class="stat">
        <span class="muted">생존 시민팀</span>
        <span class="num">${aliveCitizenTeamCount}</span>
      </div>
      <div class="stat">
        <span class="muted">승리 조건</span>
        <span class="num">${getMafiaWinner() ? "충족" : "진행"}</span>
      </div>
    </div>
  `;
}

function renderMafiaCompletionPanel() {
  const status = state.room?.status || "waiting";
  const alivePlayers = getMafiaPlayers().filter((player) => player.alive);
  const round = getCurrentMafiaRound();

  if (status === "discussion") {
    return `
      <div class="timer-wrap">
        <div class="timer-top">
          <span>토론 남은 시간</span>
          <span id="teacherMafiaDiscussionText">${getMafiaSettings().discussionSeconds}초</span>
        </div>
        <div class="timer-track"><div id="teacherMafiaDiscussionFill" class="timer-fill"></div></div>
      </div>
    `;
  }

  if (status === "nightAction") {
    const missing = alivePlayers.filter((player) => !round.nightActions?.[player.role]?.[player.id]);
    return `
      <div class="notice ${missing.length ? "warn" : "success"}">
        밤 행동 ${alivePlayers.length - missing.length} / ${alivePlayers.length} 완료
        ${missing.length ? `<p class="small">미완료: ${missing.map((player) => escapeHtml(player.name)).join(", ")}</p>` : `<p class="small">모든 생존자가 행동을 마쳤습니다.</p>`}
      </div>
    `;
  }

  if (status === "voting") {
    const votes = round.votes || {};
    const missing = alivePlayers.filter((player) => !votes[player.id]);
    return `
      <div class="notice ${missing.length ? "warn" : "success"}">
        투표 ${alivePlayers.length - missing.length} / ${alivePlayers.length} 완료
        ${missing.length ? `<p class="small">미완료: ${missing.map((player) => escapeHtml(player.name)).join(", ")}</p>` : `<p class="small">모든 생존자가 투표를 마쳤습니다.</p>`}
      </div>
    `;
  }

  return `<p class="muted">현재 단계: ${statusLabel(status)}</p>`;
}

function renderMafiaRoleTable(players) {
  if (!players.length) {
    return `<div class="empty">역할 배정을 누르면 학생별 역할표가 표시됩니다.</div>`;
  }

  return `
    <ul class="list">
      ${players.map((player) => `
        <li class="list-row split">
          <div>
            <strong>${escapeHtml(player.name)}</strong>
            <p class="muted small">${player.connected ? "접속 중" : "오프라인"} · ${player.alive ? "생존" : "탈락"}</p>
          </div>
          <span class="pill ${player.role === "mafia" ? "red" : player.role === "police" ? "blue" : player.role === "doctor" ? "green" : "gold"}">${roleLabel(player.role)}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderMafiaNightTeacherPanel(round) {
  const players = getMafiaPlayers();
  if (!players.length) {
    return `<div class="empty">역할 배정 후 밤 행동 기록이 표시됩니다.</div>`;
  }

  const nightActions = round.nightActions || {};
  const result = round.nightResult || null;
  const roleSections = ["mafia", "police", "doctor", "citizen"].map((role) => {
    const actions = Object.entries(nightActions[role] || {});
    return `
      <div class="mini-section">
        <h4>${roleLabel(role)}</h4>
        ${actions.length ? `
          <ul class="compact-list">
            ${actions.map(([studentId, action]) => {
              const actor = players.find((player) => player.id === studentId);
              const resultText = role === "police" && action.result ? ` · ${action.result === "mafia" ? "마피아" : "마피아 아님"}` : "";
              return `<li>${escapeHtml(actor?.name || "이름 없음")} → ${escapeHtml(action.selectedName || "-")}${resultText}</li>`;
            }).join("")}
          </ul>
        ` : `<p class="muted small">아직 기록이 없습니다.</p>`}
      </div>
    `;
  }).join("");

  return `
    <div class="stack">
      ${roleSections}
      ${result ? `
        <div class="notice info">
          <strong>밤 결과</strong>
          <p>공격 대상: ${escapeHtml(result.mafiaAttackTargetName || "없음")} ${result.mafiaAttackResolvedBy === "random" ? "(동점 랜덤 결정)" : ""}</p>
          <p>보호 대상: ${escapeHtml((result.doctorProtectedNames || []).join(", ") || "없음")}</p>
          <p>탈락자: ${escapeHtml(result.eliminatedName || "없음")}</p>
        </div>
      ` : ""}
    </div>
  `;
}

function renderMafiaVoteTeacherPanel(round) {
  const votes = round.votes || {};
  const voteEntries = Object.entries(votes);
  const result = round.voteResult || null;
  const players = getMafiaPlayers();

  return `
    <div class="stack">
      ${voteEntries.length ? `
        <ul class="compact-list">
          ${voteEntries.map(([studentId, vote]) => {
            const voter = players.find((player) => player.id === studentId);
            return `<li>${escapeHtml(voter?.name || "이름 없음")} → ${escapeHtml(vote.selectedName || "-")}</li>`;
          }).join("")}
        </ul>
      ` : `<div class="empty">투표가 시작되면 현황이 표시됩니다.</div>`}
      ${result ? `
        <div class="notice info">
          <strong>투표 결과</strong>
          <p>최다 득표: ${escapeHtml(result.topVotedName || "없음")}</p>
          ${result.tiedNames?.length ? `<p>동점: ${result.tiedNames.map((name) => escapeHtml(name)).join(", ")}</p>` : ""}
          <p>탈락자: ${escapeHtml(result.eliminatedName || "없음")}</p>
        </div>
      ` : ""}
    </div>
  `;
}

function renderGhostBingoBuilder(ghost) {
  const draft = getGhostBingoDraft(ghost);
  const selectedSet = new Set(draft.selectedIds);
  const boardFilledCount = draft.board.filter((id, index) => index !== 4 && id).length;
  const canConfirm = selectedSet.size === GHOST_BINGO_REQUIRED_CONDITIONS && boardFilledCount === GHOST_BINGO_REQUIRED_CONDITIONS;

  return `
    <div class="stack">
      <div>
        <h2>유령 빙고판 만들기</h2>
        <p class="muted">빙고판을 완성한 이후 발생한 사건부터 자동 체크됩니다.</p>
      </div>
      <div class="notice info">
        조건 선택 ${selectedSet.size} / ${GHOST_BINGO_REQUIRED_CONDITIONS} · 배치 ${boardFilledCount} / ${GHOST_BINGO_REQUIRED_CONDITIONS}
      </div>
      <div class="ghost-builder-grid">
        <div class="stack">
          <h3>내 빙고판</h3>
          ${renderGhostBingoBoard(draft.board, null, true)}
          <button class="btn success" data-action="ghost-confirm-bingo" type="button" ${canConfirm ? "" : "disabled"}>이 빙고판으로 시작하기</button>
        </div>
        <div class="stack">
          <h3>조건 후보</h3>
          <div class="ghost-condition-grid">
            ${GHOST_BINGO_CONDITIONS.map((condition) => {
              const isSelected = selectedSet.has(condition.id);
              const isPlacing = state.selectedGhostBingoConditionId === condition.id;
              const disabled = !isSelected && selectedSet.size >= GHOST_BINGO_REQUIRED_CONDITIONS;
              return `
                <button class="ghost-condition-card ${isSelected ? "selected" : ""} ${isPlacing ? "placing" : ""}" data-ghost-condition="${escapeAttr(condition.id)}" type="button" aria-pressed="${isSelected}" ${disabled ? "disabled" : ""}>
                  <strong>${escapeHtml(condition.label)}</strong>
                  <span>${escapeHtml(condition.description)}</span>
                </button>
              `;
            }).join("")}
          </div>
          <div class="notice info small">
            조건을 누른 뒤 빙고 칸을 누르면 들어갑니다. 이미 놓인 조건끼리는 서로 바뀌고, 파란색으로 선택된 조건을 한 번 더 누르면 선택 해제됩니다.
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderGhostBingoLive(ghost) {
  const result = getGhostBingoComputedResult(ghost);
  const firstBingo = result.bingoLines > 0;

  return `
    <div class="stack">
      <div>
        <h2>유령 빙고</h2>
        <p class="muted">확정 이후 실제 게임 기록으로 자동 체크됩니다. ${securePilot ? "공개 전 역할은 빙고에 반영되지 않습니다." : ""}</p>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="muted">현재 빙고</span>
          <span class="num">${result.bingoLines}줄</span>
        </div>
        <div class="stat">
          <span class="muted">완성 칸</span>
          <span class="num">${result.checkedCount}/${GHOST_BINGO_REQUIRED_CONDITIONS}</span>
        </div>
        <div class="stat">
          <span class="muted">첫 빙고</span>
          <span class="num">${firstBingo ? "완성" : "대기"}</span>
        </div>
      </div>
      ${firstBingo ? `<div class="notice success ghost-bingo-pop">👻 유령 빙고 완성! 저승에서도 당신은 살아 있습니다.</div>` : ""}
      ${renderGhostBingoBoard(result.board, result, false)}
      <div class="ghost-checked-list">
        ${result.board.filter((id) => id && id !== GHOST_BINGO_FREE_ID).map((id) => {
          const condition = getGhostBingoCondition(id);
          const isChecked = Boolean(result.checked[id]);
          return `
            <div class="ghost-check-row ${isChecked ? "checked" : ""}">
              <span>${isChecked ? "완료" : "대기"}</span>
              <strong>${escapeHtml(condition?.label || "조건")}</strong>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderGhostBingoBoard(board, result, interactive) {
  const normalizedBoard = normalizeGhostBingoBoard(board);
  return `
    <div class="ghost-bingo-board">
      ${normalizedBoard.map((conditionId, index) => {
        const isFree = index === 4;
        const condition = isFree ? null : getGhostBingoCondition(conditionId);
        const isChecked = isFree || Boolean(result?.checked?.[conditionId]);
        const isActive = state.selectedGhostBingoConditionId && state.selectedGhostBingoConditionId === conditionId;
        const content = isFree
          ? `<strong>👻 FREE</strong>`
          : condition
            ? `<strong>${escapeHtml(condition.label)}</strong><span>${escapeHtml(condition.description)}</span>`
            : `<strong>비어 있음</strong><span>조건을 선택한 뒤 이 칸을 누르세요.</span>`;
        const attrs = interactive && !isFree ? `data-ghost-cell="${index}" type="button"` : `type="button" disabled`;
        return `
          <button class="ghost-bingo-cell ${isFree ? "free" : ""} ${condition ? "filled" : "empty"} ${isChecked ? "checked" : ""} ${isActive ? "active" : ""}" ${attrs}>
            ${content}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderGhostBingoLeaderboard() {
  const ranking = getGhostBingoRanking();
  if (!ranking.length) {
    return `<div class="empty">아직 확정한 유령 빙고판이 없습니다.</div>`;
  }

  return `
    <div class="ranking ghost-ranking">
      ${ranking.slice(0, 5).map((ghost, index) => `
        <div class="ranking-row rank-${index + 1}">
          <span class="rank-medal">${index + 1}</span>
          <strong>${renderPlaygroundName(ghost)}</strong>
          <span class="score">${ghost.bingoLines}빙고 · ${ghost.checkedCount}칸</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderGhostChatMessages({ teacher = false, ghost = null } = {}) {
  const messages = getMafiaGhostChatMessages({ teacher, ghost });
  return messages.length ? messages.map((message) => `
    <article class="ghost-chat-message ${message.messageType === "system" ? "system" : ""}">
      <div class="ghost-chat-meta">
        <strong>${message.messageType === "system" ? "시스템" : escapeHtml(message.playerName || "이름 없음")}</strong>
        <span>${formatClock(message.createdAt)}</span>
      </div>
      <p>${escapeHtml(message.content || "")}</p>
    </article>
  `).join("") : `<div class="empty">${renderExperienceArt("ghost/ghost-chat", "ghost-chat-art")}아직 유령 채팅이 없습니다.</div>`;
}

function renderGhostChatPanel({ teacher = false, ghost = null, allowSend = false } = {}) {
  return `
    <div class="ghost-chat">
      <div class="ghost-chat-list" id="ghostChatList" tabindex="0" aria-label="유령 채팅 기록" data-chat-key="${escapeAttr(getGhostChatRenderKey({ teacher, ghost }))}">
        ${renderGhostChatMessages({ teacher, ghost })}
      </div>
      ${allowSend ? `
        <div class="ghost-chat-form">
          <input id="ghostChatInput" type="text" maxlength="${GHOST_CHAT_MAX_LENGTH}" placeholder="유령 채팅 입력" aria-label="유령 채팅 메시지" autocomplete="off" value="${escapeAttr(state.ghostChatDraft)}" ${state.ghostChatSending ? "disabled" : ""} />
          <button class="btn primary" id="ghostChatSendBtn" type="button" ${state.ghostChatSending ? "disabled" : ""}>전송</button>
        </div>
        <p class="muted small">엔터로 전송할 수 있습니다. 최대 ${GHOST_CHAT_MAX_LENGTH}자입니다.</p>
      ` : teacher ? `<p class="muted small">교사 화면에서는 전체 유령 채팅을 읽기 전용으로 확인합니다.</p>` : ""}
    </div>
  `;
}

function renderMafiaFinalResult(viewName, showTeacherControls, force = false) {
  const winner = getMafiaWinner();
  const players = getMafiaPlayers();
  syncAllGhostBingoProgress();
  const hasGhosts = getMafiaGhosts().length > 0;

  setView(viewName, `
    <section class="screen mafia-mode">
      <div class="status-bar">
        <span class="pill red">최종 결과</span>
        ${showTeacherControls ? `
          <div class="button-row">
            <button class="btn danger" data-action="reset" type="button">다시 시작 준비</button>
            <button class="btn danger" data-action="clear-room" type="button">학생/자료 목록 초기화</button>
          </div>
        ` : ""}
      </div>

      <div class="panel mafia-panel result-panel">
        <h1>${winner ? mafiaWinnerText(winner) : "게임이 종료되었습니다."}</h1>
        <p class="lead">최종 생존자와 역할을 확인합니다.</p>
      </div>

      <section class="panel">
        <h2>전체 역할표</h2>
        ${renderMafiaRoleTable(players)}
      </section>

      ${hasGhosts ? `
        <section class="panel">
          <h2>👻 저승 빙고 결과</h2>
          ${renderGhostBingoLeaderboard()}
        </section>
      ` : ""}

      ${showTeacherControls && hasGhosts ? `
        <section class="panel">
          <h2>유령 채팅 기록</h2>
          ${renderGhostChatPanel({ teacher: true, allowSend: false })}
        </section>
      ` : ""}
    </section>
  `, () => {
    document.querySelector("[data-action='reset']")?.addEventListener("click", resetGame);
    document.querySelector("[data-action='clear-room']")?.addEventListener("click", clearRoomLists);
    scrollGhostChatToBottom();
  }, force);
}

function renderLiarVoteResult(viewName, showTeacherControls, force = false) {
  setView(viewName, `
    <section class="screen liar-mode">
      <div class="status-bar">
        <span class="pill gold">투표 결과</span>
        ${showTeacherControls ? `<button class="btn dark" data-action="liar-reveal-answer" type="button">라이어 공개</button>` : ""}
      </div>
      <section class="panel">
        <h1>라이어 투표 결과</h1>
        ${renderLiarVoteResults()}
      </section>
      <div class="notice info">선생님이 실제 라이어를 공개하면 자동으로 이동합니다.</div>
    </section>
  `, () => {
    document.querySelector("[data-action='liar-reveal-answer']")?.addEventListener("click", () => handleTeacherAction("liar-reveal-answer"));
  }, force);
}

function renderLiarRevealResult(viewName, showTeacherControls, force = false) {
  setView(viewName, `
    <section class="screen liar-mode">
      <div class="status-bar">
        <span class="pill red">라이어 공개</span>
        ${showTeacherControls ? `
          <div class="button-row">
            <button class="btn success" data-action="liar-restart-same" type="button">같은 제시어로 다시 하기</button>
            <button class="btn ghost" data-action="liar-configure" type="button">설정 변경하기</button>
            <button class="btn danger" data-action="reset" type="button">게임 초기화</button>
          </div>
        ` : ""}
      </div>
      <section class="panel liar-panel result-panel">
        ${renderExperienceHeading("정체 공개", "이번 게임의 제시어", "liar/identity-reveal")}
      </section>
      <section class="panel">
        ${renderLiarAnswerReveal()}
      </section>
      <section class="panel">
        <h2>투표 결과</h2>
        ${renderLiarVoteResults()}
      </section>
    </section>
  `, () => {
    document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleTeacherAction(button.dataset.action)));
  }, force);
}

function renderTeacherModeControls() {
  const mode = getRoomMode();
  const canSwitch = (state.room?.status || "waiting") === "waiting";

  return `
    <section class="mode-switcher">
      <p class="label">게임 모드</p>
      <div class="segmented polish-mode-switch-list" role="group" aria-label="게임 모드">
        ${getFinalTeacherModes().map((item) => `<button class="btn ${mode === item ? "primary" : "ghost"}" data-switch-mode="${item}" data-mode="${item}" type="button" aria-pressed="${mode === item}" ${canSwitch ? "" : "disabled"}>${renderArcadeModeArt(item, "thumbnail")}<span>${escapeHtml(modeLabel(item))}</span>${mode === item ? renderExperienceIcon("check") : ""}</button>`).join("")}
      </div>
      ${canSwitch ? "" : `<p class="muted small">게임 진행 중에는 모드를 바꿀 수 없습니다.</p>`}
    </section>
  `;
}

function renderComplimentClueCards(clues) {
  if (!clues.length) {
    return `<div class="empty">공개된 단서가 없습니다.</div>`;
  }

  return `
    <div class="clue-stack">
      ${clues.map((clue, index) => `
        <article class="clue-card">
          <span class="pill gold">단서 ${index + 1}</span>
          <p>${escapeHtml(clue)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderExperienceIcon(name) {
  const paths = {
    check: '<path d="m5 12 4 4L19 6"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>'
  };
  return `<svg class="experience-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
}

function renderExperienceArt(path, className = "") {
  return path ? renderArcadeArt(`experience/${path}`, [512, 512], `experience-art ${className}`) : "";
}

function renderExperienceHeading(label, title, art) {
  return `<div class="experience-heading"><div><p class="eyebrow">${escapeHtml(label)}</p><h2>${escapeHtml(title)}</h2></div>${renderExperienceArt(art)}</div>`;
}

function renderExperienceProgress(label, count, total) {
  return `<div class="experience-progress"><span>${escapeHtml(label)}</span><strong>${count} / ${total}</strong><progress max="${Math.max(total, 1)}" value="${count}" aria-label="${escapeAttr(label)}"></progress></div>`;
}

function renderExperienceCandidate(student, dataName, { disabled = false, selected = false, confirm = false } = {}) {
  const icon = selected ? "check" : disabled ? "lock" : "arrow";
  const label = selected ? (confirm ? "선택됨" : "제출 완료") : disabled ? "선택 불가" : confirm ? "투표 대상" : "선택 가능";
  return `<button class="student-choice-btn experience-candidate ${selected ? "selected" : ""}" data-${dataName}="${escapeAttr(student.id)}" type="button" ${disabled ? "disabled" : ""} ${confirm ? `aria-pressed="${selected}"` : ""}>
    ${renderPlaygroundAvatar(getOwnedPlaygroundAvatarId(student.id), "experience-candidate-avatar")}
    <span class="experience-candidate-copy"><strong>${escapeHtml(student.name)}</strong><small>${student.connected ? "접속 중" : "오프라인"}</small></span>
    <span class="experience-candidate-state">${renderExperienceIcon(icon)}<span>${label}</span></span>
  </button>`;
}

function renderStudentChoiceButtons(students, dataName, disabled = false, selectedId = "") {
  if (!students.length) {
    return `<div class="empty">선택할 학생이 없습니다.</div>`;
  }

  return `
    <div class="student-choice-grid experience-candidates">
      ${students.map((student) => renderExperienceCandidate(student, dataName, { disabled, selected: selectedId === student.id })).join("")}
    </div>
  `;
}

function renderLiarTeacherStatusPanel() {
  const status = state.room?.status || "waiting";
  const participants = getLiarParticipants();
  const confirmations = getLiarConfirmations();
  const votes = getLiarVotes();

  if (status === "waiting") {
    return `<div class="notice info">제시어 2개와 라이어 수를 설정한 뒤 게임을 시작해 주세요.</div>`;
  }

  if (status === "playing") {
    return `
      <div class="notice ${Object.keys(confirmations).length >= participants.length ? "success" : "info"}">
        제시어 확인 ${Object.keys(confirmations).length} / ${participants.length}
        ${Object.keys(confirmations).length >= participants.length ? `<p class="small">모든 학생이 제시어를 확인했습니다. 교실 대화 후 투표를 시작하세요.</p>` : ""}
      </div>
    `;
  }

  if (status === "voting") {
    return `
      <div class="notice ${Object.keys(votes).length >= participants.length ? "success" : "warn"}">
        투표 완료 ${Object.keys(votes).length} / ${participants.length}
        ${Object.keys(votes).length >= participants.length ? `<p class="small">모든 학생이 투표를 완료했습니다.</p>` : `<p class="small">아직 투표하지 않은 학생이 있어도 강제 종료할 수 있습니다.</p>`}
      </div>
    `;
  }

  if (status === "voteResult") {
    return `<div class="notice gold">투표 결과가 공개되었습니다. 실제 라이어는 아직 공개되지 않았습니다.</div>`;
  }

  if (status === "result") {
    return `<div class="notice success">실제 라이어와 제시어가 공개되었습니다.</div>`;
  }

  return `<p class="muted">현재 단계: ${statusLabel(status)}</p>`;
}

function renderLiarConfirmationList() {
  const participants = getLiarParticipants();
  const confirmations = getLiarConfirmations();

  if (!participants.length) {
    return `<div class="empty">게임을 시작하면 확인 현황이 표시됩니다.</div>`;
  }

  return `
    <ul class="list">
      ${participants.map((participant) => {
        const confirmed = Boolean(confirmations[participant.id]);
        return `
          <li class="list-row split">
            <strong>${escapeHtml(participant.name)}</strong>
            <span class="pill ${confirmed ? "green" : "gold"}">${confirmed ? "확인 완료" : "대기"}</span>
          </li>
        `;
      }).join("")}
    </ul>
  `;
}

function renderLiarVoteProgressPanel() {
  const participants = getLiarParticipants();
  const votes = getLiarVotes();
  const status = state.room?.status || "waiting";

  if (!participants.length) {
    return `<div class="empty">투표가 시작되면 현황이 표시됩니다.</div>`;
  }

  if (status === "voteResult" || status === "result") {
    return renderLiarVoteResults();
  }

  return `
    <ul class="list">
      ${participants.map((participant) => {
        const voted = Boolean(votes[participant.id]);
        return `
          <li class="list-row split">
            <strong>${escapeHtml(participant.name)}</strong>
            <span class="pill ${voted ? "green" : "gold"}">${voted ? "투표 완료" : "대기"}</span>
          </li>
        `;
      }).join("")}
    </ul>
  `;
}

function renderLiarVoteChoices(options, selectedId) {
  if (!options.length) {
    return `<div class="empty">투표할 대상이 없습니다.</div>`;
  }

  return `
    <div class="student-choice-grid experience-candidates">
      ${options.map((participant) => renderExperienceCandidate(participant, "liar-vote-target", { selected: selectedId === participant.id, confirm: true })).join("")}
    </div>
  `;
}

function renderLiarVoteResults() {
  const rows = getLiarVoteResultRows();
  const maxVotes = Math.max(1, ...rows.map((row) => row.votes));

  if (!rows.length) {
    return `<div class="empty">아직 투표 결과가 없습니다.</div>`;
  }

  return `
    <div class="answer-bars liar-vote-bars">
      ${rows.map((row) => {
        const width = Math.max(4, Math.round((row.votes / maxVotes) * 100));
        return `
          <div class="bar-row">
            <strong class="playground-ranked-name"><span>${row.rank}위</span>${renderPlaygroundName(row)}</strong>
            <div class="bar-track">
              <div class="bar-fill choice-${(row.rank - 1) % 4}" style="width:${width}%"></div>
            </div>
            <strong>${row.votes}표</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderLiarAnswerReveal() {
  const liar = getLiarState();
  const participants = getLiarParticipants();
  const liarIds = new Set(getLiarStudentIds());
  const liars = participants.filter((participant) => liarIds.has(participant.id));

  return `
    <div class="stack">
      <div class="grid-2">
        <section class="mini-section">
          <p class="muted small">다수 그룹</p>
          <h2>${escapeHtml(liar.majorityWord || "-")}</h2>
        </section>
        <section class="mini-section">
          <p class="muted small">라이어 그룹</p>
          <h2>${escapeHtml(liar.liarWord || "-")}</h2>
        </section>
      </div>
      <section>
        <h3>라이어</h3>
        ${liars.length ? `
          <div class="liar-reveal-grid">
            ${liars.map((participant) => `
              <article class="liar-reveal-card">
                <strong>${escapeHtml(participant.name)}</strong>
                <span>${escapeHtml(liar.liarWord || "")}</span>
              </article>
            `).join("")}
          </div>
        ` : `<div class="empty">라이어 명단이 없습니다.</div>`}
      </section>
    </div>
  `;
}

function renderTeacherCurrentCompliment(compliment, currentIndex, total, status) {
  if (!compliment) {
    return `<div class="empty">아직 진행 중인 칭찬 카드가 없습니다.</div>`;
  }

  const clueIndex = Number(state.room.currentClueIndex || 0);
  const clues = normalizeComplimentClues(compliment.clues);
  const visibleClues = status === "playing" ? clues.slice(0, clueIndex + 1) : clues;

  return `
    <div class="question-card warm-card">
      <div class="status-bar">
        <span class="pill gold">${currentIndex + 1} / ${total}</span>
        <span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span>
      </div>
      <div class="grid-2">
        <div>
          <p class="muted small">칭찬 대상</p>
          <h2>${status === "playing" ? "아직 비공개" : escapeHtml(compliment.targetName)}</h2>
        </div>
        <div>
          <p class="muted small">칭찬 작성자</p>
          <h2>${status === "authorReveal" ? escapeHtml(compliment.authorName) : "아직 비공개"}</h2>
        </div>
      </div>
      <p class="muted">교사용 확인: 대상 ${escapeHtml(compliment.targetName)} / 작성자 ${escapeHtml(compliment.authorName)}</p>
      ${renderComplimentClueCards(visibleClues)}
      ${status === "authorReveal" ? `
        <div>
          <h3>이번 카드 결과</h3>
          ${renderComplimentScoreEvents(compliment)}
        </div>
      ` : ""}
    </div>
  `;
}

function renderTeacherComplimentList(compliments, status) {
  if (!compliments.length) {
    return `<div class="empty">학생들이 칭찬 카드를 제출하면 여기에 표시됩니다.</div>`;
  }

  return `
    <ul class="list">
      ${compliments.map((compliment, index) => `
        <li class="list-row split">
          <div>
            <p class="muted small">${index + 1}. 작성자 ${escapeHtml(compliment.authorName)} → 대상 ${escapeHtml(compliment.targetName)}</p>
            <strong>${escapeHtml(normalizeComplimentClues(compliment.clues)[0] || "칭찬 단서")}</strong>
            <p class="muted small">단서 ${normalizeComplimentClues(compliment.clues).length}개</p>
          </div>
          <button class="btn danger" data-delete-compliment="${escapeAttr(compliment.id)}" type="button" ${status === "waiting" ? "" : "disabled"}>삭제</button>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderComplimentScoreEvents(compliment) {
  const targetSuccesses = getComplimentTargetGuesses(compliment.id)
    .filter((answer) => Number.isInteger(answer.firstCorrectClueIndex))
    .sort((a, b) => Number(a.firstCorrectClueIndex) - Number(b.firstCorrectClueIndex));
  const authorSuccesses = getComplimentAuthorGuesses(compliment.id)
    .filter((answer) => answer.isCorrect)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  const targetBonus = state.room?.complimentBonuses?.target?.[compliment.id];
  const rows = [
    ...targetSuccesses.map((answer) => ({
      name: answer.name,
      detail: `대상 추리 성공, 단서 ${Number(answer.firstCorrectClueIndex) + 1}`,
      score: Number(answer.scoreEarned || 0)
    })),
    ...authorSuccesses.map((answer) => ({
      name: answer.name,
      detail: "작성자 추리 성공",
      score: Number(answer.scoreEarned || 0)
    }))
  ];

  if (targetBonus) {
    rows.push({
      name: targetBonus.targetName || compliment.targetName,
      detail: "칭찬 대상 보너스",
      score: Number(targetBonus.scoreEarned || COMPLIMENT_TARGET_BONUS)
    });
  }

  if (!rows.length) {
    return `<div class="empty">아직 이 카드에서 획득한 점수가 없습니다.</div>`;
  }

  return `
    <ul class="list">
      ${rows.map((row) => `
        <li class="list-row split">
          <div>
            <strong>${escapeHtml(row.name || "이름 없음")}</strong>
            <p class="muted small">${escapeHtml(row.detail)}</p>
          </div>
          <span class="score">+${row.score}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderTeacherCurrentQuestion(question, currentIndex, total, status) {
  if (!question) {
    return `<div class="empty">아직 진행 중인 문제가 없습니다.</div>`;
  }

  const choices = normalizeChoices(question.choices);
  const questionType = getQuestionType(question);
  return `
    <div class="question-card">
      <div class="status-bar">
        <span class="pill blue">${currentIndex + 1} / ${total}</span>
        <span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span>
      </div>
      <h2>${escapeHtml(question.question)}</h2>
      <p class="muted">출제자: ${escapeHtml(question.authorName || "익명")} · ${questionType === "short" ? "주관식" : "4지선다"}</p>
      ${status === "playing" ? `
        <div class="timer-wrap">
          <div class="timer-top">
            <span>남은 시간</span>
            <span id="teacherTimerText">${state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS}초</span>
          </div>
          <div class="timer-track"><div id="teacherTimerFill" class="timer-fill"></div></div>
        </div>
      ` : ""}
      ${questionType === "short" ? `
        <div class="notice ${status === "playing" ? "info" : "success"}">
          ${status === "playing" ? "학생들이 주관식 답을 입력하고 있습니다." : `정답: <strong>${escapeHtml(question.correctAnswer)}</strong>`}
        </div>
      ` : `
        <ol class="list">
          ${choices.map((choice, index) => `
            <li class="list-row">
              <strong>${index + 1}. ${escapeHtml(choice)}</strong>
              ${status !== "playing" && index === question.correctIndex ? `<span class="pill green">정답</span>` : ""}
            </li>
          `).join("")}
        </ol>
      `}
      ${status === "result" ? `
        <div class="grid-2">
          <div>
            <h3>${questionType === "short" ? "주관식 응답" : "선택지별 응답 수"}</h3>
            ${renderQuestionResponseSummary(question)}
          </div>
          <div>
            <h3>이번 문제 랭킹</h3>
            ${renderRanking(getQuestionRanking(question.id).slice(0, 5), "scoreEarned")}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderTeacherQuestionList(questions, status) {
  if (!questions.length) {
    return status === "waiting" ? renderStudioEmpty("awaiting-submissions", "학생들이 문제를 제출하면 여기에 표시됩니다.") : `<div class="empty">학생들이 문제를 제출하면 여기에 표시됩니다.</div>`;
  }

  return `
    <ul class="list" ${status === "waiting" ? 'id="quizStudioQuestionList" data-studio-scroll' : ""}>
      ${questions.map((question, index) => `
        <li class="list-row split" data-question-record data-question-type="${getQuestionType(question)}" data-question-author="${escapeAttr(nameToKey(question.authorName || ""))}" data-search-text="${escapeAttr(`${question.authorName || ""} ${question.question || ""}`)}">
          <button class="question-list-preview" data-view-question="${escapeAttr(question.id)}" type="button">
            <p class="muted small">${index + 1}. ${escapeHtml(question.authorName || "익명")} · ${getQuestionType(question) === "short" ? "주관식" : "4지선다"}</p>
            <strong>${escapeHtml(question.question)}</strong>
            <p class="muted small">정답: ${getQuestionType(question) === "short" ? escapeHtml(question.correctAnswer) : `${question.correctIndex + 1}. ${escapeHtml(normalizeChoices(question.choices)[question.correctIndex] || "")}`}</p>
            <span class="muted small">클릭해서 전체 보기</span>
          </button>
          <button class="btn danger" data-delete-question="${escapeAttr(question.id)}" type="button" ${status === "waiting" ? "" : "disabled"}>삭제</button>
        </li>
      `).join("")}
    </ul>
  `;
}

function showTeacherQuestionDetail(questionId) {
  if (state.role !== "teacher") return;
  const question = getQuestions().find((item) => item.id === questionId);
  if (!question) {
    showToast("문제를 찾지 못했습니다.", "error");
    return;
  }

  closeTeacherQuestionDetail();
  const choices = normalizeChoices(question.choices);
  document.body.insertAdjacentHTML("beforeend", `
    <dialog class="studio-detail-dialog" data-question-modal aria-labelledby="studioDetailTitle">
      <section class="modal-panel">
        <div class="status-bar">
          <div>
            <p class="eyebrow">제출 문제 전체 보기</p>
            <h2 id="studioDetailTitle">${escapeHtml(question.authorName || "익명")}의 문제</h2>
          </div>
          <button class="btn ghost" data-close-question-modal type="button" autofocus>닫기</button>
        </div>

        <div class="question-detail">
          <div class="studio-detail-heading">
            ${renderArcadeArt("studio/states/preview-review", [512, 512], "studio-detail-art")}
            <p class="muted small">문제</p>
            <h3>${escapeHtml(question.question)}</h3>
          </div>
          ${getQuestionType(question) === "short" ? `
            <div class="notice success"><strong>주관식 정답: ${escapeHtml(question.correctAnswer)}</strong></div>
          ` : `
            <ol class="list">
              ${choices.map((choice, index) => `
                <li class="list-row split">
                  <strong>${index + 1}. ${escapeHtml(choice)}</strong>
                  ${index === question.correctIndex ? `<span class="pill green">정답</span>` : ""}
                </li>
              `).join("")}
            </ol>
          `}
        </div>
      </section>
    </dialog>
  `);

  const modal = document.querySelector("[data-question-modal]");
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeTeacherQuestionDetail();
    }
  });
  modal.addEventListener("close", () => {
    modal.remove();
    if (state.role === "teacher") {
      const opener = [...document.querySelectorAll("[data-view-question]")].find((button) => button.dataset.viewQuestion === questionId);
      (opener || document.querySelector("#quizLibrarySearch"))?.focus({ preventScroll: true });
    }
  }, { once: true });
  document.querySelector("[data-close-question-modal]")?.addEventListener("click", closeTeacherQuestionDetail);
  modal.showModal();
}

function closeTeacherQuestionDetail() {
  const modal = document.querySelector("[data-question-modal]");
  if (modal?.open) modal.close();
  modal?.remove();
}

function renderStudentList(students) {
  if (!students.length) {
    return `<div class="empty">학생이 입장하면 목록이 표시됩니다.</div>`;
  }

  return `
    <ul class="list">
      ${students.map((student) => `
        <li class="list-row">
          <div class="student-line">
            <span class="student-connection"><span class="dot ${student.connected ? "on" : ""}" aria-label="${student.connected ? "접속 중" : "연결 끊김"}"></span>${renderPlaygroundName(student)}</span>
            <strong>${student.score}점</strong>
          </div>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderAnswerBars(question) {
  const counts = getAnswerCounts(question);
  const maxCount = Math.max(1, ...counts);
  const choices = normalizeChoices(question.choices);

  return `
    <div class="answer-bars">
      ${counts.map((count, index) => {
        const width = Math.max(2, Math.round((count / maxCount) * 100));
        return `
          <div class="bar-row">
            <strong>${index + 1}. ${escapeHtml(choices[index] || "")}</strong>
            <div class="bar-track">
              <div class="bar-fill choice-${index}" style="width:${width}%"></div>
            </div>
            <strong>${count}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderQuestionResponseSummary(question) {
  if (getQuestionType(question) === "choice") {
    return renderAnswerBars(question);
  }
  const answers = getAnswers(question.id).filter((answer) => !answer.isSkipped && cleanText(answer.textAnswer || ""));
  if (!answers.length) {
    return `<div class="empty">제출된 주관식 응답이 없습니다.</div>`;
  }
  const groups = new Map();
  answers.forEach((answer) => {
    const text = cleanText(answer.textAnswer);
    const key = normalizeShortAnswer(text);
    const current = groups.get(key) || { text, count: 0, isCorrect: false };
    current.count += 1;
    current.isCorrect = current.isCorrect || Boolean(answer.isCorrect);
    groups.set(key, current);
  });
  const rows = [...groups.values()].sort((a, b) => b.count - a.count || String(a.text).localeCompare(String(b.text), "ko"));
  return `<ul class="list">${rows.map((row) => `
    <li class="list-row split">
      <strong>${escapeHtml(row.text)}</strong>
      <span><span class="pill ${row.isCorrect ? "green" : ""}">${row.isCorrect ? "정답" : "응답"}</span> ${row.count}명</span>
    </li>
  `).join("")}</ul>`;
}

function renderRanking(rows, scoreField = "score") {
  if (!rows.length) {
    return `<div class="empty arcade-empty">${renderArcadeArt("states/empty", [185, 179])}아직 랭킹이 없습니다.</div>`;
  }

  return `
    <div class="ranking">
      ${rows.map((row, index) => `
        <div class="ranking-row rank-${index + 1}">
          <span class="rank-medal">${index + 1}</span>
          <strong>${renderPlaygroundName(row)}</strong>
          <span class="score">${Number(row[scoreField] || 0)}점</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPodium(student, place, className, unit = "점") {
  if (!student) return "";
  const medal = ["gold", "silver", "bronze"][place - 1];
  return `
    <div class="podium ${className}" data-place="${place}">
      <div class="podium-place">${student && medal ? renderArcadeArt(`rewards/${medal}`, [67, 96], "arcade-medal") : ""}${place}위</div>
      ${student ? renderPlaygroundAvatar(getOwnedPlaygroundAvatarId(student.id || student.studentId), "podium-avatar") : ""}
      <h2>${student ? escapeHtml(student.name) : "-"}</h2>
      <p class="score">${student ? Number(student.score || 0) : 0}${unit}</p>
    </div>
  `;
}

// =========================
// 일반 유틸
// =========================

function setView(viewName, html, afterRender = null, force = false) {
  if (!force && state.activeView === viewName) {
    return;
  }

  if (deferStudioComposition(viewName, html, afterRender, force)) return;
  const studioDraft = captureStudioPreparation();
  const stageDraft = captureStageControl();
  clearTimer();
  state.activeView = viewName;
  setPlaygroundTheme();
  appEl.innerHTML = html;
  activateStudioPreparation(viewName, studioDraft);
  activateStageControl(stageDraft);
  markPlayPresentation();
  activateUxHostTools();
  finalRelease?.decorate();
  decorateSecurePilot();
  if (viewName.includes("loading")) appEl.firstElementChild?.classList?.add("polish-loading");
  if (typeof afterRender === "function") {
    afterRender();
  }
}

function setPlaygroundTheme() {
  if (!appEl.dataset) return;
  appEl.dataset.playgroundRole = state.role || "home";
  appEl.dataset.playgroundMode = state.room ? getRoomMode() : "";
  appEl.dataset.playgroundStatus = state.room?.status || "";
  if (finalRelease) finalRelease.setContext(getFinalReleaseContext());
}

function markPlayPresentation() {
  const room = state.room;
  const root = appEl.firstElementChild;
  if (!room || !root?.dataset) return;
  const key = [state.role, state.roomCode, getRoomMode(), room.status, room.currentQuestionIndex,
    room.currentComplimentIndex, room.currentClueIndex, room.catchmind?.currentRoundIndex,
    room.mafia?.round].join(":");
  if (key === lastPlayPresentation) return;
  lastPlayPresentation = key;
  root.dataset.playEntry = "true";
}

function getStageControlScope() {
  const phase = state.room?.status || "waiting";
  if (state.role !== "teacher" || !state.room || ["waiting", "collecting"].includes(phase)) return "";
  return `${state.roomCode}:${getRoomMode()}:${phase}`;
}

function captureStageControl() {
  const scope = getStageControlScope();
  const root = scope && appEl.querySelector?.(".stage-console");
  if (!root || root.dataset.consoleScope !== scope) return null;
  const focus = document.activeElement;
  return { scope, open: root.querySelector(".stage-danger-actions")?.open,
    focus: focus && root.contains(focus) ? (focus.matches(".stage-danger-actions > summary") ? "stage-danger" : studioElementKey(focus)) : "" };
}

function activateStageControl(previous) {
  const scope = getStageControlScope();
  const root = scope && appEl.querySelector?.(":scope > .screen");
  if (!root) return;
  const titleBar = root.querySelector(":scope > .status-bar");
  if (!titleBar) return;
  root.classList.add("stage-console");
  root.dataset.consoleScope = scope;
  const priority = {
    quiz: ["reveal", "next", "finish"],
    compliment: ["compliment-next-clue", "compliment-reveal-target", "compliment-author-guess", "compliment-reveal-author", "compliment-next-card", "finish"],
    mafia: ["mafia-finish", "mafia-role-reveal", "mafia-start-night", "mafia-publish-night", "mafia-start-discussion", "mafia-start-voting", "mafia-reveal-vote", "mafia-reveal-role", "mafia-next-night"],
    liar: ["liar-start-voting", "liar-reveal-vote", "liar-reveal-answer", "liar-restart-same"],
    catchmind: ["catchmind-start-round", "catchmind-next-round", "catchmind-restart-same"],
    seat: ["seat-end-card", "seat-final-reveal", "seat-restart-same"],
    memory: ["memory-start", "memory-reveal", "memory-restart-same"],
    bingo: ["bingo-approve-call", "bingo-next-turn"],
    word: ["word-review", "word-finish", "word-restart"]
  }[getRoomMode()] || [];
  const action = priority.map((id) => root.querySelector(`button[data-action="${id}"]:enabled`)).find(Boolean);
  const connected = getStudents().filter((student) => student.connected).length;
  titleBar.insertAdjacentHTML("afterend", `<section class="stage-control-band" aria-label="실시간 진행"><div><p class="stage-console-kicker">PLAY CONTROL · ${escapeHtml(modeLabel(getRoomMode()))}</p><strong>${escapeHtml(statusLabel(state.room.status))}</strong></div><span class="stage-console-connected">${connected}명 접속</span><div class="stage-next-control"></div></section>`);
  const danger = [...root.querySelectorAll('button.btn.danger:is([data-action="reset"], [data-action="clear-room"])')];
  if (danger.length) {
    root.insertAdjacentHTML("beforeend", '<details class="stage-danger-actions"><summary>방 관리</summary><div class="button-row"></div></details>');
    const panel = root.querySelector(".stage-danger-actions");
    panel.open = previous?.scope === scope && Boolean(previous.open);
    panel.querySelector(".button-row").append(...danger);
  }
  if (action) {
    action.classList.add("stage-primary-action");
    root.querySelector(".stage-next-control").append(action);
  }
  if (previous?.scope === scope && previous.focus) {
    const focused = previous.focus === "stage-danger" ? root.querySelector(".stage-danger-actions > summary")
      : [...root.querySelectorAll("button, input, select, textarea")].find((item) => studioElementKey(item) === previous.focus);
    if (!focused?.disabled) focused?.focus({ preventScroll: true });
  }
}

function renderArcadeArt(path, [width, height], className = "", fallback = "") {
  const imagePath = `./assets/redesign/${path}.webp`;
  return `<span class="arcade-art ${className}" aria-hidden="true">${escapeHtml(fallback)}<img class="arcade-image" src="${imagePath}" width="${width}" height="${height}" alt="" loading="lazy" decoding="async" /></span>`;
}

function renderStudioHeading(label, title, artwork, content = "") {
  return `<header class="studio-heading"><div class="studio-heading-copy"><p class="studio-kicker">${label}</p><h1>${escapeHtml(title)}</h1>${content}</div>${renderArcadeArt(`studio/${artwork}`, [512, 512], "studio-heading-art")}</header>`;
}

function renderStudioEmpty(artwork, message) {
  return `<div class="empty studio-empty">${renderArcadeArt(`studio/states/${artwork}`, [512, 512], "studio-empty-art")}<p>${escapeHtml(message)}</p></div>`;
}

function renderStudioSlots(used, maximum, label) {
  return `<div class="studio-quota"><b>${label} ${used} / ${maximum}개</b><span class="studio-slots" aria-hidden="true">${Array.from({ length: maximum }, (_, i) => `<i${i < used ? ' class="is-filled"' : ""}></i>`).join("")}</span></div>`;
}

function updateStudioQuestionQuota() {
  const slot = document.querySelector("#studioQuestionQuota");
  if (slot) slot.innerHTML = renderStudioSlots(findQuestionsByStudent().length, getMaxQuestionsPerStudent(), "내 문제");
}

function updateStudioComplimentQuota() {
  const slot = document.querySelector("#studioComplimentQuota");
  if (slot) slot.innerHTML = renderStudioSlots(findComplimentsByAuthor(state.studentId).length, getMaxComplimentsPerStudent(), "내 칭찬 카드");
}

function updateStudioCounters(form) {
  form.querySelectorAll("[data-studio-count-for]").forEach((counter) => {
    const field = document.getElementById(counter.dataset.studioCountFor);
    if (field) counter.textContent = `${field.value.length} / ${field.maxLength}`;
  });
}

function updateStudioQuestionPreview() {
  const form = document.querySelector("#questionForm");
  if (!form) return;
  const short = form.querySelector("[name='questionType']:checked")?.value === "short";
  const correct = form.querySelector("[name='correctIndex']:checked")?.value;
  setPlaygroundText("#studioPreviewType", short ? "주관식" : "4지선다");
  setPlaygroundText("#studioPreviewQuestion", document.querySelector("#questionText").value.trim() || "문제를 입력해 주세요.");
  const choices = form.querySelector("#studioPreviewChoices");
  choices.hidden = short;
  choices.querySelectorAll("li").forEach((row, i) => {
    row.querySelector("[data-studio-preview-choice]").textContent = form.querySelector(`#choice${i}`).value.trim() || `선택지 ${i + 1}`;
    row.querySelector("small").hidden = correct !== String(i);
  });
  const answer = form.querySelector("#studioPreviewAnswer");
  answer.hidden = !short;
  answer.textContent = `정답: ${form.querySelector("#correctAnswer").value.trim() || "아직 입력하지 않았습니다."}`;
  updateStudioCounters(form);
  updateStudioQuestionQuota();
}

function updateStudioBingoProgress(form) {
  const fields = [...form.querySelectorAll("[data-bingo-entry]")];
  let filled = 0;
  for (const field of fields) {
    const hasValue = Boolean(field.value.trim());
    field.parentElement.classList.toggle("is-filled", hasValue);
    if (hasValue) filled += 1;
  }
  setPlaygroundText("#studioBingoFilled", `${filled} / ${fields.length}칸`);
}

function bindStudioComposition() {
  document.addEventListener("compositionstart", (event) => {
    if (event.target.closest?.(".studio-preparation")) studioComposingField = event.target;
  });
  document.addEventListener("compositionend", (event) => {
    if (studioComposingField !== event.target) return;
    studioComposingField = null;
    const next = studioDeferredView;
    studioDeferredView = null;
    if (next) queueMicrotask(() => {
      if (next.scope === studioPreparationScope() && next.field.isConnected) setView(...next.args);
    });
  });
}

function deferStudioComposition(...args) {
  const field = studioComposingField;
  const scope = studioPreparationScope();
  if (scope && field?.isConnected && document.activeElement === field
    && field.closest(".studio-preparation")?.dataset.studioScope === scope
    && (state.role === "teacher" || state.activeView === args[0])) {
    studioDeferredView = { scope, field, args };
    return true;
  }
  studioDeferredView = null;
  return false;
}

function bindStudioSubmit(form, handler) {
  const draft = bindUxDraft(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const key = `${state.roomCode}:${form.id}`;
    if (studioSubmissions.has(key)) return;
    studioSubmissions.add(key);
    form.setAttribute("aria-busy", "true");
    try {
      if (await handler(event)) draft?.clear();
    } finally {
      studioSubmissions.delete(key);
      form.removeAttribute("aria-busy");
    }
  });
}

const UX_DRAFT_BOOK = "playground.ux.drafts";
const UX_DRAFT_DURATION = 24 * 60 * 60 * 1000;

function readUxDrafts(now = Date.now()) {
  try {
    return Object.fromEntries(Object.entries(JSON.parse(readUxStorage(UX_DRAFT_BOOK) || "{}"))
      .filter(([, draft]) => draft && draft.savedAt > now - UX_DRAFT_DURATION && draft.savedAt <= now && Array.isArray(draft.fields))
      .sort((a, b) => a[1].savedAt - b[1].savedAt).slice(-11));
  } catch { return {}; }
}

function uxDraftScope(formId, roomCode, generation, studentId, subject = "") {
  return JSON.stringify([roomCode, generation, studentId, formId, subject]);
}

function bindUxDraft(form) {
  if (state.role !== "student" || !["questionForm", "complimentForm", "bingoBoardForm"].includes(form.id)) return null;
  const subject = form.querySelector("#editingQuestionId, #editingComplimentId")?.value || (form.id === "bingoBoardForm" ? getBingoSize() : "");
  const scope = uxDraftScope(form.id, state.roomCode, state.studentGeneration, state.studentId, subject);
  const selector = "#questionText, #choice0, #choice1, #choice2, #choice3, [name=questionType], #complimentTarget, [id^=complimentClue], [data-bingo-entry]";
  const fields = [...form.querySelectorAll(selector)];
  const panel = document.createElement("div");
  panel.className = "ux-draft-tool";
  panel.innerHTML = `<label class="check-line"><input type="checkbox" data-ux-draft-enable /> 이 기기에 작성 내용 저장 (24시간)</label>
    <div class="button-row" data-ux-draft-actions hidden>${renderUxArt("flow/draft-restored", "ux-inline-art")}
      <button class="btn ghost" type="button" data-ux-draft-restore>${uxIcon("rotate-ccw")}복원</button>
      <button class="btn ghost" type="button" data-ux-draft-clear>${uxIcon("trash-2")}저장본 지우기</button></div>
    <p class="ux-inline-status" role="status">정답과 정답 번호는 저장하지 않습니다.</p>`;
  form.append(panel);
  const enable = panel.querySelector("[data-ux-draft-enable]");
  const actions = panel.querySelector("[data-ux-draft-actions]");
  const status = panel.querySelector("[role=status]");
  const clear = () => {
    const book = readUxDrafts();
    delete book[scope];
    const saved = writeUxStorage(UX_DRAFT_BOOK, JSON.stringify(book));
    actions.hidden = true;
    return saved;
  };
  const initial = readUxDrafts();
  writeUxStorage(UX_DRAFT_BOOK, JSON.stringify(initial));
  actions.hidden = !initial[scope];
  const save = () => {
    if (!enable.checked) return;
    const book = readUxDrafts();
    book[scope] = { savedAt: Date.now(), fields: fields.map((field) => [studioElementKey(field), field.type === "radio" ? field.checked : field.value]) };
    if (!writeUxStorage(UX_DRAFT_BOOK, JSON.stringify(book))) {
      status.textContent = "이 기기에 저장할 수 없습니다.";
      enable.checked = false;
      return;
    }
    actions.hidden = false;
  };
  form.addEventListener("input", (event) => { if (!event.isComposing && fields.includes(event.target)) save(); });
  form.addEventListener("compositionend", (event) => { if (fields.includes(event.target)) save(); });
  enable.addEventListener("change", () => { if (enable.checked) save(); else clear(); });
  panel.querySelector("[data-ux-draft-restore]").addEventListener("click", () => {
    const draft = readUxDrafts()[scope];
    if (!draft) { actions.hidden = true; status.textContent = "저장본이 만료되었습니다."; return; }
    const values = new Map(draft.fields);
    for (const field of fields) {
      const value = values.get(studioElementKey(field));
      if (field.type === "radio" && typeof value === "boolean") field.checked = value;
      else if (typeof value === "string" && (field.tagName !== "SELECT" || [...field.options].some((option) => option.value === value))) field.value = field.maxLength > 0 ? value.slice(0, field.maxLength) : value;
    }
    for (const field of [form.querySelector("[name=questionType]:checked"), ...fields.filter((item) => item.type !== "radio")].filter(Boolean)) {
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
    enable.checked = true;
    status.textContent = "작성 내용을 복원했습니다. 제출 전에 정답이나 선택 항목을 확인해 주세요.";
  });
  panel.querySelector("[data-ux-draft-clear]").addEventListener("click", () => {
    enable.checked = false;
    status.textContent = clear() ? "이 기기의 저장본을 지웠습니다." : "저장본을 지우지 못했습니다.";
  });
  return { clear };
}

function studioPreparationScope() {
  const status = state.room?.status || "waiting";
  if (!state.room || !["teacher", "student"].includes(state.role)
    || !["waiting", "collecting", "memoryReady"].includes(status)
    || (state.role === "teacher" && status === "memoryReady")) return "";
  return `${state.roomCode}:${state.role}:${getRoomMode()}:${status}`;
}

function studioElementKey(element) {
  if (element.id) return `id:${element.id}`;
  for (const name of ["bingoEntry", "action", "switchMode", "viewQuestion", "deleteQuestion", "editOwnQuestion", "editOwnCompliment", "memorySize", "seatSelect", "seatCardTarget", "seatToggleDisabled"]) {
    if (element.dataset[name] !== undefined) return `${name}:${element.dataset[name]}`;
  }
  return element.type === "radio" && element.name ? `radio:${element.name}:${element.value}` : "";
}

function captureStudioPreparation() {
  const root = appEl.querySelector?.(".studio-preparation[data-studio-scope]");
  if (!root || root.dataset.studioScope !== studioPreparationScope()) return null;
  const inputs = new Map();
  for (const element of root.querySelectorAll("input:not([type=hidden]):not([type=file]), select, textarea")) {
    const key = studioElementKey(element);
    if (!key || element.disabled) continue;
    if (["radio", "checkbox"].includes(element.type)) {
      if (element.checked !== element.defaultChecked) inputs.set(key, { checked: element.checked });
    } else {
      const initial = element.tagName === "SELECT" ? [...element.options].find((option) => option.defaultSelected)?.value ?? element.options[0]?.value : element.defaultValue;
      if (element.value !== initial) inputs.set(key, { value: element.value });
    }
  }
  const folds = new Map([...root.querySelectorAll("details[id]")].map((element) => [element.id, element.open]));
  const scrolls = new Map([...root.querySelectorAll("[data-studio-scroll][id]")].map((element) => [element.id, element.scrollTop]));
  const active = document.activeElement;
  return { scope: root.dataset.studioScope, variant: root.dataset.studioVariant, inputs, folds, scrolls,
    focus: active && root.contains(active) ? studioElementKey(active) : "",
    fieldScroll: active?.scrollTop,
    selection: [active?.selectionStart, active?.selectionEnd, active?.selectionDirection] };
}

function activateStudioPreparation(viewName, saved) {
  const scope = studioPreparationScope();
  const root = scope && appEl.querySelector?.(":scope > .screen");
  if (!root) return;
  const mode = getRoomMode();
  if (!root.classList.contains("studio-preparation")) {
    if (state.role === "teacher" && viewName.startsWith("teacher-")) {
      const titleBar = root.querySelector(":scope > .status-bar:first-child");
      if (!titleBar || !PLAYGROUND_MODE_ART[mode]) return;
      root.classList.add("studio-preparation", "studio-control");
      titleBar.classList.add("studio-host-heading");
      const title = titleBar.querySelector("h1");
      title?.insertAdjacentHTML("beforebegin", '<p class="studio-kicker">PLAY CONTROL</p>');
      titleBar.insertAdjacentHTML("beforeend", renderArcadeArt(`studio/hosts/${mode}-host`, [512, 512], "studio-host-art"));
    } else if (state.role === "student" && (viewName.includes("waiting") || viewName.startsWith("student-memory-ready-"))) {
      root.classList.add("studio-preparation", "studio-waiting");
      const art = viewName.startsWith("student-memory-ready-") ? "ready-to-play" : "awaiting-players";
      root.firstElementChild?.insertAdjacentHTML("afterend", renderStudioHeading("PLAY STUDIO", modeLabel(mode), `states/${art}`));
    } else return;
  }
  root.dataset.studioScope = scope;
  if (!saved || saved.scope !== scope || saved.variant !== root.dataset.studioVariant) return;

  for (const element of root.querySelectorAll("input:not([type=hidden]):not([type=file]), select, textarea, button")) {
    const key = studioElementKey(element);
    const draft = saved.inputs.get(key);
    if (!element.disabled && draft) {
      if ("checked" in draft) element.checked = draft.checked;
      else if (element.tagName !== "SELECT" || [...element.options].some((option) => option.value === draft.value)) element.value = draft.value;
    }
    if (key && key === saved.focus && !element.disabled) {
      element.focus({ preventScroll: true });
      if (typeof saved.selection[0] === "number") element.setSelectionRange?.(...saved.selection);
      element.scrollTop = saved.fieldScroll || 0;
    }
  }
  for (const details of root.querySelectorAll("details[id]")) {
    if (saved.folds.has(details.id)) details.open = saved.folds.get(details.id);
  }
  for (const element of root.querySelectorAll("[data-studio-scroll][id]")) {
    if (saved.scrolls.has(element.id)) element.scrollTop = saved.scrolls.get(element.id);
  }
}

function getMafiaArcadeScene() {
  if (getRoomMode() !== "mafia") return "";
  if (["nightAction", "nightResult"].includes(state.room?.status)) return "night";
  if (["discussion", "voting", "voteResult"].includes(state.room?.status)) return "day";
  return "";
}

function renderArcadeModeArt(mode, variant, scene = "") {
  const art = PLAYGROUND_MODE_ART[mode];
  if (!art) return "";
  return renderArcadeArt(`games/${mode}/${scene || variant}`, scene ? [682, 126] : art[variant], variant === "banner" ? "arcade-banner-art" : "arcade-thumbnail", art.mark);
}

function renderArcadeJamo(chosung) {
  return `<div class="word-chosung arcade-jamo" aria-label="${escapeAttr(chosung)}">${[...chosung].map((letter) => `<span>${escapeHtml(letter)}</span>`).join("")}</div>`;
}

function normalizePlaygroundAvatarId(avatarId) {
  if (avatarId === "20_book_owl") return "20_book_otter";
  return PLAYGROUND_AVATARS.includes(avatarId) ? avatarId : "";
}

function getPlaygroundAvatarOwners(students) {
  const owners = new Map();
  // Resolve selections saved before avatars became exclusive in a stable order.
  const joined = (student) => Number(student?.joinedAt) || Number.MAX_SAFE_INTEGER;
  const roster = Object.entries(students || {})
    .sort(([idA, a], [idB, b]) => joined(a) - joined(b) || idA.localeCompare(idB));
  for (const [studentId, student] of roster) {
    const avatarId = normalizePlaygroundAvatarId(student?.avatarId);
    if (avatarId && !owners.has(avatarId)) owners.set(avatarId, studentId);
  }
  return owners;
}

function getOwnedPlaygroundAvatarId(studentId) {
  if (securePilot) return normalizePlaygroundAvatarId(state.room?.pilotAvatars?.[studentId]);
  const students = state.room?.students;
  const id = normalizePlaygroundAvatarId(students?.[studentId]?.avatarId);
  return id && getPlaygroundAvatarOwners(students).get(id) === studentId ? id : "";
}

function renderPlaygroundAvatar(avatarId, className = "") {
  const id = normalizePlaygroundAvatarId(avatarId);
  if (!id) return `<span class="playground-avatar avatar-placeholder ${className}" aria-hidden="true"></span>`;
  return `<img class="playground-avatar ${className}" src="./assets/avatars/${id}.webp" alt="" width="40" height="40" decoding="async" />`;
}

function renderPlaygroundName(student, name = student.name || student.playerName || "이름 없음") {
  const id = student.studentId || student.playerId || student.participantId || student.id;
  return `<span class="playground-name">${renderPlaygroundAvatar(getOwnedPlaygroundAvatarId(id))}<span>${escapeHtml(name)}</span></span>`;
}

function canChoosePlaygroundAvatar(room = state.room) {
  return Boolean(room && ["waiting", "collecting", "memoryReady"].includes(room.status));
}

function bindPlaygroundAvatarPicker() {
  const profile = document.querySelector("#studentProfile");
  const picker = document.querySelector("#avatarPicker");
  profile?.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-avatar-picker]")) openPlaygroundAvatarPicker();
  });
  picker?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-avatar-choice]");
    if (choice && !choice.disabled && !picker.dataset.saving) {
      picker.dataset.avatarSelection = choice.dataset.avatarChoice;
      picker.querySelector("#avatarPickerStatus").textContent = "";
      syncPlaygroundAvatarChoices(picker);
    }
    if (event.target.closest("[data-cancel-avatar]") && !picker.dataset.saving) picker.close();
    if (event.target.closest("[data-save-avatar]")) savePlaygroundAvatar(picker);
  });
  picker?.addEventListener("cancel", (event) => { if (picker.dataset.saving) event.preventDefault(); });
  picker?.addEventListener("close", () => {
    if (state.role === "student") profile?.querySelector("[data-open-avatar-picker]")?.focus({ preventScroll: true });
  });
}

function syncPlaygroundStudentProfile() {
  const profile = document.querySelector("#studentProfile");
  const picker = document.querySelector("#avatarPicker");
  const student = state.role === "student" ? state.room?.students?.[state.studentId] : null;
  if (!profile) return;
  if (!student) {
    profile.hidden = true;
    profile.replaceChildren();
    delete profile.dataset.signature;
    if (picker?.open) picker.close();
    return;
  }
  const canChoose = canChoosePlaygroundAvatar();
  const ownedAvatarId = getOwnedPlaygroundAvatarId(state.studentId);
  const phase = state.room.status || "waiting";
  const signature = JSON.stringify([state.roomCode, student.name, ownedAvatarId, canChoose, phase, getRoomMode()]);
  profile.hidden = false;
  if (profile.dataset.signature !== signature) {
    profile.dataset.signature = signature;
    profile.innerHTML = `<div class="student-profile-inner">
      <strong>${renderPlaygroundName({ id: state.studentId, ...student })}</strong>
      <span class="student-profile-room">방 ${escapeHtml(state.roomCode)}</span>
      ${canChoose ? "" : `<span class="experience-profile-phase"><b>${escapeHtml(modeLabel(getRoomMode()))}</b><span>${escapeHtml(statusLabel(phase))}</span></span>`}
      ${canChoose ? `<button type="button" class="btn ghost" data-open-avatar-picker>${ownedAvatarId ? "캐릭터 바꾸기" : "캐릭터 고르기"}</button>` : ""}
    </div>`;
  }
  if (!canChoose && picker?.open) picker.close();
  if (canChoose && picker?.open) syncPlaygroundAvatarChoices(picker);
  if (canChoose && !ownedAvatarId && state.avatarPromptedRoom !== state.roomCode && picker?.showModal) {
    state.avatarPromptedRoom = state.roomCode;
    openPlaygroundAvatarPicker();
  }
}

function openPlaygroundAvatarPicker() {
  const picker = document.querySelector("#avatarPicker");
  if (!picker?.showModal || picker.open || state.role !== "student" || !canChoosePlaygroundAvatar()) return;
  picker.dataset.avatarSelection = getOwnedPlaygroundAvatarId(state.studentId);
  picker.innerHTML = `
    <header class="polish-picker-heading"><div><p class="stage-console-kicker">PLAYGROUND</p><h2 id="avatarPickerTitle">내 캐릭터 고르기</h2></div><span class="pill green" id="avatarPickerAvailable"></span></header>
    <div class="polish-picker-body">
    <aside class="polish-picker-preview"><div id="avatarPickerPortrait"></div><span id="avatarPickerPreviewState"></span></aside>
    <div class="avatar-grid" role="group" aria-label="캐릭터 20종" tabindex="0">
      ${PLAYGROUND_AVATARS.map((id, index) => `<button type="button" class="avatar-choice" data-avatar-choice="${id}" aria-label="캐릭터 ${index + 1}" aria-pressed="false">
        ${renderPlaygroundAvatar(id)}<small class="avatar-availability" aria-hidden="true"></small>
      </button>`).join("")}
    </div>
    </div>
    <p id="avatarPickerStatus" class="avatar-picker-status" role="status"></p>
    <footer class="button-row"><button type="button" class="btn ghost" data-cancel-avatar>나중에</button><button type="button" class="btn primary" data-save-avatar>이 캐릭터 선택</button></footer>`;
  syncPlaygroundAvatarChoices(picker);
  picker.showModal();
}

function syncPlaygroundAvatarChoices(picker, room = state.room) {
  const owners = securePilot ? new Map(Object.entries(room?.pilotAvatars || {}).map(([id, avatar]) => [avatar, id])) : getPlaygroundAvatarOwners(room?.students);
  const isTaken = (id) => owners.has(id) && owners.get(id) !== state.studentId;
  if (isTaken(picker.dataset.avatarSelection)) {
    picker.dataset.avatarSelection = "";
    picker.querySelector("#avatarPickerStatus").textContent = "다른 학생이 먼저 골랐어요. 다른 캐릭터를 선택해 주세요.";
  }
  const selectedId = picker.dataset.avatarSelection;
  const savedId = securePilot ? getOwnedPlaygroundAvatarId(state.studentId) : normalizePlaygroundAvatarId(room?.students?.[state.studentId]?.avatarId);
  const saving = Boolean(picker.dataset.saving);
  picker.querySelectorAll("[data-avatar-choice]").forEach((button) => {
    const id = button.dataset.avatarChoice;
    button.disabled = isTaken(id);
    button.setAttribute("aria-pressed", String(id === selectedId));
    const label = isTaken(id) ? "선점됨" : id === savedId ? "내 캐릭터" : id === selectedId ? "선택 중" : "";
    button.dataset.availability = label;
    button.querySelector(".avatar-availability").textContent = label;
    if (label) button.setAttribute("aria-description", label);
    else button.removeAttribute("aria-description");
  });
  const portrait = picker.querySelector("#avatarPickerPortrait");
  if (portrait.dataset.selection !== selectedId) {
    portrait.dataset.selection = selectedId;
    portrait.innerHTML = renderPlaygroundAvatar(selectedId, "polish-preview-avatar");
  }
  picker.querySelector("#avatarPickerPreviewState").textContent = saving ? "저장 중" : selectedId ? (selectedId === savedId ? "내 캐릭터" : "선택 중") : "선택 전";
  picker.querySelector("#avatarPickerAvailable").textContent = `${PLAYGROUND_AVATARS.filter((id) => !isTaken(id)).length}개 선택 가능`;
  const save = picker.querySelector("[data-save-avatar]");
  save.disabled = saving || !selectedId;
  save.textContent = saving ? "저장 중…" : "이 캐릭터 선택";
  picker.querySelector("[data-cancel-avatar]").disabled = saving;
  picker.setAttribute("aria-busy", String(saving));
}

function setPlaygroundAvatarInRoom(room, studentId, selection) {
  const avatarId = normalizePlaygroundAvatarId(selection);
  if (!avatarId || !canChoosePlaygroundAvatar(room) || !room.students?.[studentId]) return;
  const owners = getPlaygroundAvatarOwners(room.students);
  const owner = owners.get(avatarId);
  if (owner && owner !== studentId) return;

  for (const [id, student] of Object.entries(room.students)) {
    const storedId = normalizePlaygroundAvatarId(student?.avatarId);
    if (!storedId) continue;
    if (owners.get(storedId) === id) student.avatarId = storedId;
    else delete student.avatarId;
  }
  room.students[studentId].avatarId = avatarId;
  return room;
}

async function savePlaygroundAvatar(picker) {
  const avatarId = picker.dataset.avatarSelection;
  const save = picker.querySelector("[data-save-avatar]");
  if (save.disabled || state.role !== "student" || !canChoosePlaygroundAvatar()
    || !PLAYGROUND_AVATARS.includes(avatarId)) return;
  const { roomCode, studentId } = state;
  picker.dataset.saving = "true";
  syncPlaygroundAvatarChoices(picker);
  let rejectedRoom;
  try {
    if (securePilot) {
      const result = await securePilot.send("reserveAvatar", { avatarId });
      if (state.roomCode !== roomCode || state.role !== "student" || state.studentId !== studentId) return;
      if (result.avatarId === avatarId) {
        if (picker.open) picker.close();
        return showToast("캐릭터를 선택했습니다.", "success");
      }
      const message = result.error === "avatar-taken" ? "다른 학생이 먼저 골랐어요. 다른 캐릭터를 선택해 주세요." : securePilotError(result.error);
      if (picker.open) picker.querySelector("#avatarPickerStatus").textContent = message;
      else showToast(message, "error");
      return;
    }
    const result = await runTransaction(roomRef(roomCode),
      (room) => setPlaygroundAvatarInRoom(room, studentId, avatarId), { applyLocally: false });
    if (state.roomCode !== roomCode || state.role !== "student") return;
    if (result.committed) {
      if (picker.open) picker.close();
      showToast("캐릭터를 선택했습니다.", "success");
    } else {
      rejectedRoom = result.snapshot.val();
      if (!canChoosePlaygroundAvatar(rejectedRoom)) {
        showToast("게임 진행 중에는 캐릭터를 바꿀 수 없습니다.", "error");
      }
    }
  } catch (error) {
    finalRelease?.record("app-error");
    if (state.roomCode === roomCode) {
      const message = "캐릭터를 저장하지 못했습니다. 다시 시도해 주세요.";
      if (picker.open) picker.querySelector("#avatarPickerStatus").textContent = message;
      else showToast(message, "error");
    }
  } finally {
    delete picker.dataset.saving;
    if (picker.open) syncPlaygroundAvatarChoices(picker, rejectedRoom || state.room);
  }
}

function renderPlaygroundLobby() {
  const students = getStudents().filter((student) => student.connected);
  return `<section class="playground-lobby">
    <div class="playground-lobby-code"><span>방 코드</span><strong>${escapeHtml(state.roomCode)}</strong></div>
    <div class="playground-lobby-players">
      <h2>입장한 학생 <span>${students.length}명</span></h2>
      ${students.length ? `<ul class="playground-roster">${students.map((student) => `<li>${renderPlaygroundName(student)}</li>`).join("")}</ul>` : `<div class="arcade-lobby-empty">${renderArcadeArt("mascots/waiting", [428, 370])}<span>아직 입장한 학생이 없습니다.</span></div>`}
    </div>
  </section>`;
}

function bindClassroomSound() {
  const controls = document.querySelector("#classroomSound");
  if (!controls) return;
  try {
    const savedMode = localStorage.getItem("pgClassroomSoundMode");
    if (savedMode === "music") classroomAudio.preference = savedMode;
    const savedVolume = localStorage.getItem("pgClassroomSoundVolume");
    if (savedVolume !== null && Number.isFinite(Number(savedVolume))) {
      classroomAudio.volume = Math.min(1, Math.max(0, Number(savedVolume)));
    }
  } catch {}
  controls.innerHTML = `
    <button type="button" class="btn ghost" id="classroomSoundToggle" aria-pressed="false">${renderPlaygroundToolIcon("speaker")}<span>소리 켜기</span></button>
    <label><span class="visually-hidden">교실 사운드 방식</span><select id="classroomSoundMode" disabled><option value="effects">효과음만</option><option value="music">음악+효과음</option></select></label>
    <label class="classroom-volume"><span>음량</span><input type="range" id="classroomSoundVolume" min="0" max="100" step="5" aria-label="교실 소리 음량" /></label>
    ${document.fullscreenEnabled ? `<button type="button" class="btn ghost" id="classroomFullscreen">${renderPlaygroundToolIcon("fullscreen")}전체 화면</button>` : ""}`;
  const toggle = controls.querySelector("#classroomSoundToggle");
  const mode = controls.querySelector("#classroomSoundMode");
  const volume = controls.querySelector("#classroomSoundVolume");
  mode.value = classroomAudio.preference;
  volume.value = String(classroomAudio.volume * 100);
  controls.hidden = false;
  toggle.addEventListener("click", async () => {
    toggle.disabled = true;
    try {
      if (!classroomAudio.enabled) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) throw new Error("Web Audio is unavailable");
        if (!classroomAudio.context) {
          const context = new AudioContext();
          classroomAudio.context = context;
          classroomAudio.gain = context.createGain();
          classroomAudio.musicGain = context.createGain();
          classroomAudio.musicGain.connect(classroomAudio.gain);
          classroomAudio.gain.connect(context.destination);
        }
        await classroomAudio.context.resume();
        classroomAudio.enabled = true;
      } else {
        classroomAudio.enabled = false;
      }
      toggle.setAttribute("aria-pressed", String(classroomAudio.enabled));
      toggle.querySelector("span").textContent = classroomAudio.enabled ? "소리 끄기" : "소리 켜기";
      mode.disabled = !classroomAudio.enabled;
      syncClassroomMusic();
    } catch (error) {
      finalRelease?.record("app-error");
      showToast("소리를 켤 수 없습니다. 브라우저의 소리 설정을 확인해 주세요.", "error");
    } finally {
      toggle.disabled = false;
    }
  });
  mode.addEventListener("change", () => {
    classroomAudio.preference = mode.value;
    try { localStorage.setItem("pgClassroomSoundMode", mode.value); } catch {}
    syncClassroomMusic();
  });
  volume.addEventListener("input", () => {
    classroomAudio.volume = Number(volume.value) / 100;
    try { localStorage.setItem("pgClassroomSoundVolume", String(classroomAudio.volume)); } catch {}
    applyClassroomVolume();
  });
  controls.querySelector("#classroomFullscreen")?.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      showToast("현재 창에서 전체 화면을 사용할 수 없습니다.", "error");
    }
  });
}

function renderPlaygroundToolIcon(icon) {
  // Lucide Volume 2 and Maximize.
  const paths = icon === "speaker"
    ? '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.08M19.07 4.93a10 10 0 0 1 0 14.14"/>'
    : '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
  return `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function getClassroomSoundPhase(room, mode) {
  const status = room?.status || "";
  const round = mode === "quiz" ? room?.currentQuestionIndex
    : mode === "compliment" ? room?.currentComplimentIndex
    : mode === "catchmind" ? room?.catchmind?.currentRoundIndex
    : mode === "mafia" ? room?.mafia?.round : "";
  return [mode, status, round ?? ""].join(":");
}

function getClassroomSoundCue(mode, status, previousStatus) {
  if (status === "finished") return "finish";
  if (status === "result" && mode === "word") return "close";
  if (["result", "authorReveal", "roleRevealDead", "finalReveal"].includes(status)) return "reveal";
  if (status === "memoryAwaitingResults") return "close";
  if (["playing", "bingoPlaying", "memoryCountdown", "voting"].includes(status)) return "start";
  if (status === "seatSelection" && previousStatus === "waiting") return "start";
  return "";
}

function updateClassroomSound(room) {
  const previousStatus = classroomAudio.room?.status;
  const wasCovered = Boolean(classroomAudio.room?.displayCovered);
  const mode = room ? getRoomMode() : "";
  const nextPhase = getClassroomSoundPhase(room, mode);
  const changed = classroomAudio.phase && classroomAudio.phase !== nextPhase;
  classroomAudio.phase = nextPhase;
  classroomAudio.room = room;
  syncClassroomMusic();
  if (!room || room.displayCovered || wasCovered || !changed || !classroomAudio.enabled) return;
  const cue = getClassroomSoundCue(mode, room.status, previousStatus);
  const notes = {
    start: [[392, 0, 0.14], [587, 0.11, 0.22]],
    close: [[440, 0, 0.14], [294, 0.13, 0.24]],
    reveal: [[523, 0, 0.18], [659, 0.1, 0.19], [784, 0.19, 0.28]],
    finish: [[392, 0, 0.22], [523, 0.19, 0.24], [659, 0.39, 0.25], [784, 0.59, 0.57], [523, 0.59, 0.48]]
  };
  (notes[cue] || []).forEach(([note, delay, length]) => playClassroomNote(note, delay, length, 0.17));
}

function applyClassroomVolume() {
  const { context, gain, enabled, volume } = classroomAudio;
  if (context && gain) gain.gain.setTargetAtTime(enabled && !classroomAudio.room?.displayCovered ? volume : 0, context.currentTime, 0.03);
}

function syncClassroomMusic() {
  const { context, musicGain, enabled, room, preference, interval } = classroomAudio;
  if (!context) return;
  applyClassroomVolume();
  const shouldPlay = Boolean(room && !room.displayCovered && enabled && preference === "music" && canChoosePlaygroundAvatar(room));
  const musicVolume = shouldPlay ? 1 : 0;
  musicGain.gain.setTargetAtTime(musicVolume, context.currentTime, 0.05);
  if (shouldPlay && interval === null) {
    const playBar = () => {
      [262, 330, 392, 330, 294, 349, 440, 349].forEach((frequency, index) => {
        playClassroomNote(frequency, index * 0.48, 0.44, 0.055, musicGain);
      });
    };
    playBar();
    classroomAudio.interval = window.setInterval(playBar, 3840);
  } else if (!shouldPlay && interval !== null) {
    window.clearInterval(interval);
    classroomAudio.interval = null;
  }
}

function playClassroomNote(frequency, delay, length, level, output = classroomAudio.gain) {
  const context = classroomAudio.context;
  if (!context || !output || context.state !== "running") return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  envelope.gain.setValueAtTime(0.001, start);
  envelope.gain.exponentialRampToValueAtTime(level, start + 0.025);
  envelope.gain.exponentialRampToValueAtTime(0.001, start + length);
  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.start(start);
  oscillator.stop(start + length);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}

function getUxRoomNow() {
  if (securePilot) return securePilot.now();
  return Date.now() + Number(state.serverTimeOffset || 0);
}

function startTimer({ startedAt, limit, textSelector, fillSelector, onEnd, now = Date.now }) {
  clearTimer();

  const textEl = document.querySelector(textSelector);
  const fillEl = document.querySelector(fillSelector);
  if (!textEl || !fillEl) {
    return;
  }

  const started = Number(startedAt || now());
  const totalMs = Number(limit || DEFAULT_TIME_LIMIT_SECONDS) * 1000;
  let didEnd = false;

  const tick = () => {
    const elapsed = Math.max(0, now() - started);
    const remaining = Math.max(0, totalMs - elapsed);
    const seconds = Math.ceil(remaining / 1000);
    const percent = Math.max(0, Math.min(100, (remaining / totalMs) * 100));

    textEl.textContent = `${seconds}초`;
    fillEl.style.width = `${percent}%`;

    if (remaining <= 0 && !didEnd) {
      didEnd = true;
      clearTimer();
      if (typeof onEnd === "function") {
        onEnd();
      }
    }
  };

  tick();
  if (!didEnd) state.timerId = window.setInterval(tick, 250);
}

function clearTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
  }
  state.timerId = null;
}

function showToast(message, type = "", illustration = "") {
  if (type === "error") finalRelease?.record("app-error");
  const dialogStatus = document.querySelector("#teacherEntryDialog[open] #teacherEntryStatus");
  if (dialogStatus) {
    dialogStatus.textContent = message;
    if (dialogStatus.dataset) dialogStatus.dataset.type = type;
    return;
  }
  const label = type === "error" ? "오류" : type === "success" ? "완료" : type === "warn" ? "주의" : "알림";
  if (toastEl.querySelector) {
    toastEl.innerHTML = `<div class="polish-toast-content">${renderExperienceIcon(type === "success" ? "check" : type === "error" ? "close" : "info")}<div><b>${label}</b><span>${escapeHtml(message)}</span></div></div>`;
  } else toastEl.textContent = message;
  if (toastEl.dataset) toastEl.dataset.illustration = illustration;
  toastEl.className = `toast show ${type}`;
  window.clearTimeout(state.toastId);
  state.toastId = window.setTimeout(() => {
    toastEl.className = "toast";
  }, type === "error" ? 6800 : type === "warn" ? 5200 : 3200);
}

function renderPolishRoomMessage(kind) {
  const missing = kind === "missing";
  const display = state.role === "display";
  const ended = kind === "session";
  const title = ended ? "참가가 종료되었습니다" : missing ? "방을 찾을 수 없습니다" : "방 정보를 불러오지 못했습니다";
  const text = ended ? "방이 초기화되었거나 참가가 해제되었습니다. 선생님에게 확인해 주세요." : missing ? "방 코드가 맞는지 확인해 주세요." : "인터넷 연결을 확인한 뒤 다시 입장해 주세요.";
  const art = ended ? renderUxArt("library/session-ended", "polish-room-art") : renderArcadeArt(missing ? "states/room-not-found" : "states/disconnected", missing ? [197, 203] : [183, 166], "polish-room-art");
  setView(`room-${kind}`, `<section class="screen"><div class="panel polish-room-message" role="status">${art}<h2>${title}</h2><p>${text}</p>${display ? '<a class="btn ghost" href="./">처음으로</a>' : '<button id="backHomeBtn" class="btn ghost" type="button">처음으로</button>'}</div></section>`, () => document.querySelector("#backHomeBtn")?.addEventListener("click", renderHome), true);
}

function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.databaseURL &&
    !firebaseConfig.apiKey.includes("YOUR_") &&
    !firebaseConfig.databaseURL.includes("YOUR_")
  );
}

function normalizeRoomCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getQuestionType(question) {
  return question?.type === "short" ? "short" : "choice";
}

function normalizeShortAnswer(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, "")
    .trim();
}

function getQuestionCorrectAnswerText(question) {
  if (getQuestionType(question) === "short") {
    return cleanText(question?.correctAnswer || "");
  }
  return normalizeChoices(question?.choices)[Number(question?.correctIndex)] || "";
}

function setupQuestionTypeFields() {
  const choiceFields = document.querySelector("#choiceQuestionFields");
  const shortFields = document.querySelector("#shortQuestionFields");
  const correctAnswer = document.querySelector("#correctAnswer");
  const choiceInputs = [0, 1, 2, 3].map((index) => document.querySelector(`#choice${index}`)).filter(Boolean);
  const sync = () => {
    const type = document.querySelector("input[name='questionType']:checked")?.value === "short" ? "short" : "choice";
    if (choiceFields) choiceFields.hidden = type !== "choice";
    if (shortFields) shortFields.hidden = type !== "short";
    choiceInputs.forEach((input) => { input.required = type === "choice"; });
    if (correctAnswer) correctAnswer.required = type === "short";
  };
  document.querySelectorAll("input[name='questionType']").forEach((input) => input.addEventListener("change", sync));
  sync();
}

function normalizeChoices(choices = []) {
  return [0, 1, 2, 3].map((index) => String(choices?.[index] || ""));
}

function normalizeComplimentClues(clues = []) {
  const source = Array.isArray(clues) ? clues : Object.values(clues || {});
  return source
    .map((clue) => cleanText(clue))
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeQuestionOrder(order) {
  if (Array.isArray(order)) {
    return order.filter(Boolean).map(String);
  }

  if (order && typeof order === "object") {
    return Object.keys(order)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => order[key])
      .filter(Boolean)
      .map(String);
  }

  return [];
}

function shuffleArray(items) {
  const shuffled = items.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function nameToKey(name) {
  const normalized = String(name || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[.#$\[\]\/]/g, "_")
    .slice(0, 60);
  return normalized || "anonymous";
}

function readUxStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeUxStorage(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function readStudentSessions() {
  try { return JSON.parse(readUxStorage(STUDENT_SESSIONS_KEY) || "{}") || {}; } catch { return {}; }
}

function readStudentSession(roomCode) {
  if (!roomCode) return null;
  const book = readStudentSessions();
  const stored = book[roomCode];
  if (stored && isParticipantKey(stored.id) && typeof stored.name === "string") return stored;
  const legacy = readUxStorage("wbq_studentId");
  return (readUxStorage("wbq_studentRoomCode") || readUxStorage("wbq_roomCode")) === roomCode && isParticipantKey(legacy)
    ? { id: legacy, name: readUxStorage("wbq_studentName") || "", generation: null }
    : null;
}

function saveStudentSession() {
  const book = readStudentSessions();
  book[state.roomCode] = { id: state.studentId, name: state.studentName, generation: state.studentGeneration };
  const recent = Object.fromEntries(Object.entries(book).slice(-20));
  writeUxStorage(STUDENT_SESSIONS_KEY, JSON.stringify(recent));
  writeUxStorage("wbq_studentRoomCode", state.roomCode);
  writeUxStorage("wbq_roomCode", state.roomCode);
  writeUxStorage("wbq_studentName", state.studentName);
  writeUxStorage("wbq_studentId", state.studentId);
}

function createParticipantId() {
  return crypto.randomUUID ? crypto.randomUUID() : `student_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isParticipantKey(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id) && !["__proto__", "prototype", "constructor"].includes(id);
}

function parseStudentName(value) {
  const display = String(value ?? "").normalize("NFKC").trim();
  const length = [...display].length;
  const key = `n_${Array.from(display.toLowerCase(), (character) => character.codePointAt(0).toString(16)).join("_")}`;
  const message = length < 2 || length > 5 ? "이름은 2~5글자로 입력해 주세요."
    : !/^[\p{L}\p{N}]+$/u.test(display) ? "문자와 숫자만 쓸 수 있고, 이름 안에는 공백을 넣을 수 없습니다." : "";
  return { display, length, key, message, valid: !message };
}

function getRoomGeneration(room) {
  return String(room?.accessGeneration ?? room?.createdAt ?? "legacy");
}

function getRoomNameMatches(room, key, exceptId = "") {
  return Object.entries(room?.students || {}).filter(([id, student]) => id !== exceptId && student?.name && parseStudentName(student.name).key === key);
}

function registerRoomParticipant(room, request) {
  if (!room) return { error: "missing" };
  if (finalRelease && !finalRelease.roomCompatible(room)) return { error: "protocol" };
  const { studentId, resume, generation, timestamp } = request;
  if (!isParticipantKey(studentId) || getRoomGeneration(room) !== generation || room.accessClosed) return { error: "session" };
  const existing = room.students?.[studentId];
  if ((resume && !existing) || existing?.removedAt || (!resume && existing && parseStudentName(existing.name).key !== parseStudentName(request.name).key)) return { error: "session" };
  if (!existing && room.accessLocked) return { error: "locked" };
  const name = parseStudentName(existing?.name ?? request.name);
  if (!name.valid) return { error: resume ? "legacy-name" : "invalid" };
  const claim = room.nameClaims?.[name.key];
  if ((claim && claim !== studentId) || getRoomNameMatches(room, name.key, studentId).length) return { error: "duplicate" };
  migrateRoomQuestionOwners(room);
  room.students ||= {};
  room.nameClaims ||= {};
  room.nameClaims[name.key] = studentId;
  room.students[studentId] = { ...(existing || { score: 0, joinedAt: timestamp }), name: name.display, nameKey: name.key, presenceV2: true, connected: true, lastSeen: timestamp };
  return { room };
}

async function runAccessCommand(code, command) {
  let outcome;
  const result = await runTransaction(roomRef(code), (room) => {
    // RTDB may deliver a null local value on the first optimistic attempt.
    outcome = room === null ? { error: "missing" } : finalRelease && !finalRelease.roomCompatible(room) ? { error: "protocol" } : command(room);
    return room === null ? null : outcome.room;
  }, { applyLocally: false });
  const committed = result.committed && result.snapshot.val();
  return committed ? { room: committed } : { error: outcome?.error || "conflict" };
}

function accessErrorMessage(code) {
  return ({ missing: "방을 찾을 수 없습니다.", invalid: "이름은 문자와 숫자로 2~5글자만 입력해 주세요.",
    duplicate: "이 방에서 이미 사용 중인 이름입니다. 다른 이름을 입력해 주세요.",
    locked: "새 학생 입장이 잠겨 있습니다. 이전에 입장한 학생은 이어할 수 있습니다.",
    session: "이 기기의 참가 기록을 이어갈 수 없습니다. 선생님에게 확인해 주세요.",
    "legacy-name": "기존 이름을 이어서 쓰려면 선생님이 2~5글자로 수정해야 합니다.",
    phase: "현재 단계에서는 이 작업을 할 수 없습니다.", owner: "본인이 제출한 자료만 수정할 수 있습니다.",
    target: "선택할 수 있는 친구를 다시 확인해 주세요.", targetUsed: "이미 다른 칭찬 카드에서 고른 친구입니다.",
    "invalid-content": "자료의 글자 수와 입력 내용을 확인해 주세요.", limit: "제출 가능 개수를 모두 사용했습니다.", conflict: "변경을 저장하지 못했습니다. 다시 시도해 주세요.",
    "empty-quiz": "시작할 문제가 없습니다.", "already-answered": "한 문제에는 한 번만 답할 수 있습니다.",
    timeout: "시간이 끝났습니다. 선생님이 결과를 공개할 때까지 기다려 주세요.",
    protocol: "이 방의 앱 버전이 맞지 않습니다. 선생님에게 문의해 주세요." })[code] || "변경을 저장하지 못했습니다.";
}

function setUxStudentStatus(message, type = "", art = "") {
  const status = document.querySelector("#uxStudentEntryStatus");
  if (status) {
    status.dataset.type = type;
    status.innerHTML = `${art ? renderUxArt(`access/${art}`, "ux-inline-art") : ""}<span>${escapeHtml(message)}</span>`;
  }
  document.querySelector("#studentName")?.setAttribute("aria-invalid", String(type === "error"));
}

function syncUxNameInput() {
  const name = parseStudentName(document.querySelector("#studentName")?.value);
  setPlaygroundText("#uxNameCount", `${name.length} / 5`);
  setUxStudentStatus(name.length && !name.valid ? name.message : "", name.length && !name.valid ? "error" : "");
}

function refreshUxStudentEntry() {
  const code = normalizeRoomCode(document.querySelector("#studentRoomCode")?.value);
  const session = readStudentSession(code);
  const card = document.querySelector("#uxStudentResume");
  card.hidden = !session;
  card.innerHTML = session ? `${renderUxArt("access/resume-game", "ux-resume-art")}<div><strong>${escapeHtml(session.name || "이전 참가자")}</strong><div class="button-row"><button type="button" class="btn ghost" data-ux-resume>이어서 참여</button><button type="button" class="btn ghost" data-ux-new-student>다른 학생</button></div></div>` : "";
  syncUxNameInput();
}

function setUxStudentBusy(busy) {
  const enter = document.querySelector("#studentEnterBtn");
  if (!enter) return;
  enter.textContent = busy ? "입장 확인 중…" : "학생 입장";
  enter.disabled = busy;
  for (const selector of ["#studentName", "#studentRoomCode", "[data-ux-resume]", "[data-ux-new-student]", "#openTeacherEntryBtn"]) {
    const element = document.querySelector(selector);
    if (element) element.disabled = busy;
  }
}

function getPresenceKey(generation) {
  return `g_${Array.from(generation, (character) => character.codePointAt(0).toString(16)).join("_")}`;
}

function isStudentConnected(id, student) {
  if (!student || student.removedAt) return false;
  if (!student.presenceV2) return Boolean(student.connected);
  return Boolean(Object.keys(state.room?.presence?.[getPresenceKey(getRoomGeneration(state.room))]?.[id] || {}).length);
}

function startStudentPresence(roomCode, studentId, generation) {
  stopStudentPresence();
  const path = ref(db, `rooms/${roomCode}/presence/${getPresenceKey(generation)}/${studentId}/${createParticipantId()}`);
  const connection = { path };
  studentPresence = connection;
  connection.unsubscribe = onValue(ref(db, ".info/connected"), async (snapshot) => {
    if (snapshot.val() !== true) { connection.online = false; return; }
    if (studentPresence !== connection || connection.online) return;
    connection.online = true;
    try {
      await onDisconnect(path).remove();
      if (studentPresence === connection) await set(path, serverTimestamp());
    } catch (error) { connection.online = false; finalRelease?.record("app-error"); }
  });
}

function stopStudentPresence() {
  const connection = studentPresence;
  if (!connection) return;
  studentPresence = null;
  connection.unsubscribe?.();
  remove(connection.path).catch(() => {});
}

function renderUxArt(path, className = "") {
  return renderArcadeArt(`ux/${path}`, [512, 512], className);
}

function uxIcon(name) {
  return `<img class="ux-icon" src="./assets/redesign/ux/icons/${name}.svg" alt="" width="20" height="20" aria-hidden="true" />`;
}

function makeRoomLink(code, display = false) {
  if (securePilot && display) return securePilot.displayLink(code);
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  if (display) url.searchParams.set("display", "1");
  url.searchParams.set("room", code);
  return url.href;
}

function activateUxHostTools() {
  if (state.role !== "teacher" || !state.room || !hasRoomHostAccess(state.room)) return;
  const root = appEl.querySelector?.(":scope > .screen");
  if (!root) return;
  const markup = `<div class="ux-host-strip"><strong>${escapeHtml(state.room.roomTitle || state.roomCode)}</strong><span>${state.room.accessClosed ? "방 종료" : state.room.accessLocked ? "신규 입장 잠김" : "입장 가능"}</span><button class="btn ghost" type="button" data-ux-open-host>${uxIcon("settings")}수업 도구</button></div>`;
  const title = root.querySelector(":scope > .status-bar:first-child");
  if (title) title.insertAdjacentHTML("afterend", markup);
  else root.insertAdjacentHTML("afterbegin", markup);
  root.querySelector("[data-ux-open-host]").addEventListener("click", openUxHostDialog);
  const dialog = document.querySelector("#uxHostDialog[open]");
  if (dialog) syncUxHostDialog(dialog);
}

function openUxHostDialog() {
  const dialog = document.querySelector("#uxHostDialog");
  if (!dialog?.showModal || dialog.open || !hasRoomHostAccess(state.room)) return;
  const code = state.roomCode;
  const studentLink = makeRoomLink(code);
  const screenLink = makeRoomLink(code, true);
  dialog.innerHTML = `<header class="ux-dialog-heading"><div><p class="stage-console-kicker">PLAY HOST</p><h2 id="uxHostDialogTitle">수업 도구</h2></div><button class="btn ghost" type="button" data-ux-host="close">닫기</button></header>
    <div class="ux-dialog-body">
      <div class="segmented ux-host-tabs" role="group" aria-label="수업 도구">
        <button class="btn ghost" type="button" data-ux-pane="access" aria-pressed="true">${uxIcon("qr-code")}입장</button>
        <button class="btn ghost" type="button" data-ux-pane="roster" aria-pressed="false">${uxIcon("user-round")}참가자</button>
        <button class="btn ghost" type="button" data-ux-pane="library" aria-pressed="false">${uxIcon("library")}자료·기록</button>
      </div>
      <div class="ux-host-pane" data-ux-host-pane="access">
        <div class="ux-qr-row"><canvas id="uxJoinQr" width="192" height="192" role="img" aria-label="학생 입장 링크 QR 코드" hidden></canvas><div><p class="label">방 코드</p><strong class="room-code">${escapeHtml(code)}</strong><a class="ux-link" href="${escapeAttr(studentLink)}" target="_blank" rel="noopener">${escapeHtml(studentLink)}</a></div></div>
        <div class="button-row"><button class="btn ghost" type="button" data-ux-host="copy-join">${uxIcon("copy")}학생 입장 링크 복사</button><button class="btn ghost" type="button" data-ux-host="copy-screen">${uxIcon("link")}전광판 링크 복사</button><a class="btn ghost" href="${escapeAttr(screenLink)}" target="_blank" rel="noopener">${uxIcon("monitor")}전광판 새 탭</a></div>
        <div class="button-row"><button class="btn ghost" type="button" data-ux-host="lock"></button><button class="btn danger" type="button" data-ux-host="close-room"></button></div>
      </div>
      <div class="ux-host-pane" data-ux-host-pane="roster" hidden>
        <div class="ux-roster-filters"><div class="field"><label for="uxRosterSearch">이름 검색</label><input id="uxRosterSearch" type="search" /></div><div class="field"><label for="uxRosterSort">정렬</label><select id="uxRosterSort"><option value="name">이름순</option><option value="joined">입장순</option><option value="presence">접속 상태순</option></select></div></div>
        <ul id="uxRosterList" class="list ux-roster-list" tabindex="0" aria-label="참가 학생"></ul>
        <div id="uxRenamePanel" class="ux-rename-panel" hidden><label for="uxRenameName">새 이름 (2~5글자)</label><input id="uxRenameName" autocomplete="off" /><button class="btn primary" type="button" data-ux-host="rename">${uxIcon("save")}이름 저장</button></div>
      </div>
      <div class="ux-host-pane" data-ux-host-pane="library" hidden id="uxLibraryPane"></div>
      <p class="ux-inline-status" id="uxHostStatus" role="status"></p>
    </div>`;
  dialog.onclick = (event) => handleUxHostClick(event, dialog);
  dialog.oninput = (event) => {
    if (event.target.matches("#uxRosterSearch, #uxRosterSort")) syncUxRoster(dialog);
    if (event.target.matches("#uxLibrarySearch, #uxLibraryFilter")) renderUxLibraryRows(dialog);
  };
  dialog.onclose = () => { dialog.onclick = null; dialog.oninput = null; document.querySelector("[data-ux-open-host]")?.focus({ preventScroll: true }); };
  syncUxHostDialog(dialog);
  dialog.showModal();
  drawUxJoinQr(dialog.querySelector("#uxJoinQr"), studentLink);
}

async function drawUxJoinQr(canvas, url) {
  try {
    const { default: createQR } = await import("./vendor/qrcode.mjs");
    const code = createQR(0, "M");
    code.addData(url, "Byte");
    code.make();
    const count = code.getModuleCount();
    const unit = Math.floor(canvas.width / (count + 8));
    const offset = Math.floor((canvas.width - count * unit) / 2);
    const ctx = canvas.getContext("2d");
    if (!unit || !ctx || !canvas.isConnected) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) if (code.isDark(row, col)) ctx.fillRect(offset + col * unit, offset + row * unit, unit, unit);
    }
    canvas.hidden = false;
  } catch { /* The student link and room code remain usable. */ }
}

function syncUxHostDialog(dialog) {
  const lock = dialog.querySelector('[data-ux-host="lock"]');
  const close = dialog.querySelector('[data-ux-host="close-room"]');
  const editable = ["waiting", "collecting", "finished"].includes(state.room.status || "waiting");
  lock.innerHTML = `${uxIcon(state.room.accessLocked ? "unlock" : "lock")}${state.room.accessLocked ? "입장 잠금 해제" : "새 학생 입장 잠금"}`;
  lock.disabled = Boolean(state.room.accessClosed);
  close.textContent = state.room.accessClosed ? "방 다시 열기" : "방 종료";
  close.disabled = !editable;
  syncUxRoster(dialog);
  if (!dialog.querySelector("#uxLibraryPane").hidden) syncUxLibrarySummary(dialog);
}

function syncUxRoster(dialog) {
  const list = dialog.querySelector("#uxRosterList");
  const query = (dialog.querySelector("#uxRosterSearch").value || "").normalize("NFKC").toLowerCase();
  const sort = dialog.querySelector("#uxRosterSort").value;
  const editable = ["waiting", "collecting"].includes(state.room.status || "waiting") && !state.room.accessClosed;
  const students = Object.entries(state.room.students || {}).filter(([, student]) => student?.name && String(student.name).toLowerCase().includes(query));
  students.sort(([a, x], [b, y]) => (sort === "joined" ? (x.joinedAt || 0) - (y.joinedAt || 0) : sort === "presence" ? Number(isStudentConnected(b, y)) - Number(isStudentConnected(a, x)) : 0) || String(x.name).localeCompare(String(y.name), "ko"));
  const scroll = list.scrollTop;
  const focused = list.contains(document.activeElement) ? document.activeElement : null;
  const markup = students.map(([id, student]) => `<li class="list-row ux-roster-row"><div>${renderPlaygroundName({ id, name: student.name })}<small>${student.removedAt ? "내보냄" : isStudentConnected(id, student) ? "접속 중" : "연결 끊김"} · 문제 ${findQuestionsByStudent(id).length} · 칭찬 ${findComplimentsByAuthor(id).length}</small></div><div class="button-row"><button class="btn ghost" type="button" data-ux-host="edit-name" data-student="${escapeAttr(id)}" ${editable ? "" : "disabled"}>이름 수정</button><button class="btn ${student.removedAt ? "ghost" : "danger"}" type="button" data-ux-host="${student.removedAt ? "allow" : "remove"}" data-student="${escapeAttr(id)}" ${editable ? "" : "disabled"}>${student.removedAt ? "재입장 허용" : "내보내기"}</button></div></li>`).join("") || `<li class="empty">해당 참가자가 없습니다.</li>`;
  if (list._uxMarkup !== markup) {
    list._uxMarkup = markup;
    list.innerHTML = markup;
    list.scrollTop = scroll;
    if (focused) [...list.querySelectorAll("button")].find((button) => button.dataset.uxHost === focused.dataset.uxHost && button.dataset.student === focused.dataset.student)?.focus({ preventScroll: true });
  }
  dialog.querySelector('[data-ux-host="rename"]').disabled = !editable;
}

async function handleUxHostClick(event, dialog) {
  const tab = event.target.closest("[data-ux-pane]");
  if (tab) {
    dialog.querySelectorAll("[data-ux-pane]").forEach((button) => button.setAttribute("aria-pressed", String(button === tab)));
    dialog.querySelectorAll("[data-ux-host-pane]").forEach((pane) => { pane.hidden = pane.dataset.uxHostPane !== tab.dataset.uxPane; });
    if (tab.dataset.uxPane === "library") renderUxLibrary(dialog);
    finalRelease?.refreshWallpaper();
    return;
  }
  const button = event.target.closest("[data-ux-host]");
  if (!button) return;
  const action = button.dataset.uxHost;
  const status = dialog.querySelector("#uxHostStatus");
  if (action === "close") { dialog.close(); return; }
  if (!hasRoomHostAccess(state.room)) return;
  if (action.startsWith("library-")) { handleUxLibraryAction(dialog, action, button.dataset.record); return; }
  if (action === "copy-join" || action === "copy-screen") {
    try { await navigator.clipboard.writeText(makeRoomLink(state.roomCode, action === "copy-screen")); status.textContent = "링크를 복사했습니다."; }
    catch { status.textContent = "복사하지 못했습니다. 표시된 링크를 사용해 주세요."; }
    return;
  }
  if (action === "edit-name") {
    const editor = dialog.querySelector("#uxRenamePanel");
    editor.hidden = false;
    editor.dataset.student = button.dataset.student;
    const input = editor.querySelector("input");
    input.value = state.room.students?.[button.dataset.student]?.name || "";
    input.focus();
    return;
  }
  if (securePilot) {
    const command = ({ rename: "renameStudent", remove: "removeStudent", allow: "allowStudent", lock: "lockEntry" })[action];
    if (!command || dialog.dataset.pending) return;
    if (action === "remove" && !window.confirm("이 학생의 참가를 해제할까요? 이름과 제출 기록은 방에 남습니다.")) return;
    const editor = dialog.querySelector("#uxRenamePanel");
    dialog.dataset.pending = "true";
    try {
      const result = await securePilot.send(command, {
        studentId: action === "rename" ? editor.dataset.student : button.dataset.student,
        name: dialog.querySelector("#uxRenameName").value, enabled: !state.room.accessLocked
      }, { host: true });
      status.textContent = result.error ? securePilotError(result.error) : "저장했습니다.";
      if (!result.error && action === "rename") editor.hidden = true;
    } finally { delete dialog.dataset.pending; }
    return;
  }
  if (!acceptReleaseTeacherAction()) return;
  const roomCode = state.roomCode;
  const generation = getRoomGeneration(state.room);
  const hostUid = teacherAuth.currentUser.uid;
  const request = { action, generation, hostUid, studentId: action === "rename" ? dialog.querySelector("#uxRenamePanel").dataset.student : button.dataset.student,
    name: dialog.querySelector("#uxRenameName").value, timestamp: serverTimestamp(), locked: !state.room.accessLocked, closed: !state.room.accessClosed };
  if (action === "remove" && !window.confirm("이 학생의 참가를 해제할까요? 이름과 제출 기록은 방에 남습니다.")) return;
  if (action === "close-room" && !state.room.accessClosed && !window.confirm("방을 종료할까요? 기존 자료와 결과는 그대로 남습니다.")) return;
  if (dialog.dataset.pending) return;
  dialog.dataset.pending = "true";
  status.textContent = "저장 중…";
  try {
    const result = await runAccessCommand(roomCode, (room) => applyHostRoomAction(room, request));
    status.textContent = result.error ? accessErrorMessage(result.error) : "저장했습니다.";
    if (!result.error && action === "rename") dialog.querySelector("#uxRenamePanel").hidden = true;
  } catch { status.textContent = "저장하지 못했습니다. 인터넷 연결을 확인해 주세요."; }
  finally { delete dialog.dataset.pending; }
}

const UX_LIBRARY_TYPES = { liar: "라이어 제시어", catchmind: "캐치마인드 제시어", seat: "교실 배치", bingo: "빙고 개념" };
const UX_LIBRARY_RETENTION = 30 * 24 * 60 * 60 * 1000;

function uxLibraryKey() {
  return `playground.ux.library.${teacherAuth?.currentUser?.uid || "unavailable"}`;
}

function readUxLibrary(now = Date.now()) {
  try {
    const items = JSON.parse(readUxStorage(uxLibraryKey()) || "[]");
    return items.filter((item) => item?.updatedAt > now - UX_LIBRARY_RETENTION && item.updatedAt <= now && isParticipantKey(item.id))
      .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);
  } catch { return []; }
}

function renderUxLibrary(dialog) {
  dialog.querySelector("#uxLibraryPane").innerHTML = `
    <section class="ux-library-layout">
      <div class="ux-library-summary">${renderUxArt("library/game-history", "ux-library-art")}<div><h3>수업 기록</h3><p id="uxLibraryCurrent"></p></div></div>
      <div class="button-row">
        <button class="btn ghost" type="button" data-ux-host="library-snapshot">${uxIcon("history")}현재 수업 요약 저장</button>
        <button class="btn ghost" type="button" data-ux-host="library-download">${uxIcon("file-spreadsheet")}이름 없는 결과 CSV</button>
      </div>
      <details class="ux-library-analysis"><summary>${uxIcon("chart-column")}현재 수업 분석</summary><div id="uxLibraryAnalysis"></div></details>
      <div class="ux-library-summary">${renderUxArt("library/game-library", "ux-library-art")}<div><h3>이 기기의 자료함</h3><p class="muted small">이 교사 계정과 브라우저에 최대 40개, 30일간 보관됩니다.</p></div></div>
      <div class="ux-roster-filters"><div class="field"><label for="uxLibrarySearch">자료·기록 검색</label><input id="uxLibrarySearch" type="search" /></div>
      <div class="field"><label for="uxLibraryFilter">유형</label><select id="uxLibraryFilter"><option value="">전체</option><option value="history">수업 기록</option>${Object.entries(UX_LIBRARY_TYPES).map(([id, name]) => `<option value="${id}">${name}</option>`).join("")}</select></div></div>
      <div class="button-row"><button class="btn ghost" type="button" data-ux-host="library-new">${uxIcon("file-plus")}새 자료</button></div>
      <div id="uxLibraryEditor" class="ux-rename-panel" hidden>
        <div class="field"><label for="uxLibraryType">자료 유형</label><select id="uxLibraryType">${Object.entries(UX_LIBRARY_TYPES).map(([id, name]) => `<option value="${id}">${name}</option>`).join("")}</select></div>
        <div class="field"><label for="uxLibraryTitle">자료 제목</label><input id="uxLibraryTitle" maxlength="40" /></div>
        <div class="field"><label for="uxLibraryText">내용</label><textarea id="uxLibraryText" rows="4" maxlength="3300" placeholder="제시어·개념은 한 줄에 하나 · 교실 배치는 행×열(예: 4x5)"></textarea></div>
        <div class="button-row"><button class="btn primary" type="button" data-ux-host="library-save">자료 저장</button><button class="btn ghost" type="button" data-ux-host="library-cancel">취소</button></div>
      </div>
      <ul class="list ux-roster-list" id="uxLibraryRows" tabindex="0" aria-label="이 기기의 자료와 기록"></ul>
    </section>`;
  renderUxLibraryRows(dialog);
  syncUxLibrarySummary(dialog);
}

function getUxLessonMetrics() {
  const mode = getRoomMode();
  if (mode === "quiz") {
    const eligible = getStudents().length;
    return getQuestions().map((question, index) => {
      const answers = getAnswers(question.id).filter((answer) => !answer.isSkipped);
      const correct = answers.filter((answer) => answer.isCorrect).length;
      return [`${index + 1}번 문항`, `응답 ${answers.length} · 정답 ${correct} · 현재 명단 기준 미응답 ${Math.max(0, eligible - answers.length)} · 응답자 정답률 ${answers.length ? Math.round(100 * correct / answers.length) + "%" : "—"}`];
    });
  }
  if (mode === "compliment") {
    const cards = getCompliments();
    return [["제출 카드", cards.length], ["칭찬을 받은 학생", new Set(cards.map((card) => card.targetStudentId)).size]];
  }
  if (mode === "bingo") return [["제출 빙고판", getBingoBoards().length], ["인정된 빙고", getBingoWinners().length]];
  if (mode === "word") {
    const submissions = getWordChallengeSubmissions();
    return [["제출", submissions.length], ...[["pending", "대기"], ["approved", "승인"], ["rejected", "반려"]].map(([key, label]) => [label, submissions.filter((item) => item.status === key).length])];
  }
  if (mode === "memory") {
    const results = getCompletedMemoryResults();
    return [["참가", getMemoryParticipants().length], ["완료", results.length], ["최고 기록 (초)", results.length ? (results[0].completionTimeMs / 1000).toFixed(2) : ""]];
  }
  if (mode === "seat") return [["배정된 자리", Object.keys(getSeatGameState().assignments || {}).length]];
  if (mode === "mafia" && state.room.status === "finished") {
    const winner = getMafiaWinner();
    return [["결과", winner ? mafiaWinnerText(winner) : "게임 종료"]];
  }
  if (mode === "liar") return [["참가", getLiarParticipants().length], ["투표", Object.keys(getLiarVotes()).length]];
  if (mode === "catchmind") return [["진행 라운드", Object.keys(state.room.catchmind?.rounds || {}).length]];
  return [];
}

function syncUxLibrarySummary(dialog) {
  const current = dialog.querySelector("#uxLibraryCurrent");
  if (!current) return;
  const metrics = getUxLessonMetrics();
  current.textContent = `${modeLabel(getRoomMode())} · 참가 ${getStudents().length}명 · ${statusLabel(state.room.status || "waiting")}`;
  const analysis = dialog.querySelector("#uxLibraryAnalysis");
  let html = metrics.length ? `<dl>${metrics.map(([label, value]) => `<dt>${escapeHtml(String(label))}</dt><dd>${escapeHtml(String(value))}</dd>`).join("")}</dl>` : '<p class="muted">이 게임의 별도 집계 항목은 없습니다.</p>';
  if (getRoomMode() === "compliment") {
    const cards = getCompliments();
    html += `<ul class="list">${getStudents().map((student) => `<li class="list-row split"><strong>${escapeHtml(student.name)}</strong><span>${cards.filter((card) => card.targetStudentId === student.id).length}장</span></li>`).join("")}</ul>`;
  }
  if (html !== analysis._uxMarkup) { analysis._uxMarkup = html; analysis.innerHTML = html; }
}

function renderUxLibraryRows(dialog) {
  const search = dialog.querySelector("#uxLibrarySearch")?.value.trim().toLowerCase() || "";
  const type = dialog.querySelector("#uxLibraryFilter")?.value || "";
  const rows = dialog.querySelector("#uxLibraryRows");
  if (!rows) return;
  const items = readUxLibrary().filter((item) => (!type || item.type === type) && String(item.title).toLowerCase().includes(search));
  rows.innerHTML = items.map((item) => `<li class="list-row ux-roster-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.type === "history" ? "수업 기록" : UX_LIBRARY_TYPES[item.type] || "")} · ${new Date(item.updatedAt).toLocaleDateString("ko-KR")}</small>${item.type === "history" ? `<small>${escapeHtml(item.text)}</small>` : ""}</div>
    <div class="button-row">${item.type !== "history" ? `<button class="btn ghost" data-ux-host="library-edit" data-record="${item.id}" type="button">수정</button><button class="btn ghost" data-ux-host="library-clone" data-record="${item.id}" type="button">복제</button><button class="btn ghost" data-ux-host="library-use" data-record="${item.id}" type="button">준비 화면에 넣기</button>` : ""}<button class="btn ghost" data-ux-host="library-delete" data-record="${item.id}" type="button">삭제</button></div></li>`).join("") || '<li class="empty">해당 자료나 기록이 없습니다.</li>';
}

function validateUxLibraryText(type, text) {
  const lines = text.split(/\r?\n/).map(cleanText).filter(Boolean);
  if (type === "liar" && lines.length === 2 && lines.every((value) => value.length <= 30) && normalizeShortAnswer(lines[0]) !== normalizeShortAnswer(lines[1])) return lines.join("\n");
  if (type === "catchmind" && lines.length && text.length <= 1200 && lines.every((value) => value.length <= 40)) return lines.join("\n");
  if (type === "bingo" && lines.length && lines.length <= 80 && lines.every((value) => value.length <= 40)) return parseUxBingoConcepts(text).join("\n");
  if (type === "seat" && /^(10|[1-9])\s*[x×]\s*(10|[1-9])$/i.test(text)) return text.toLowerCase().replace(/\s+/g, "").replace("×", "x");
  return "";
}

function formatUxCsv(rows) {
  return "\uFEFF" + rows.map((row) => row.map((cell) => {
    let text = String(cell ?? "");
    if (typeof cell !== "number" && (/^[\x00-\x1f\x7f]/.test(text) || /^[\p{Z}\p{C}\s]*[=+\-@＝＋－＠]/u.test(text))) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(",")).join("\r\n") + "\r\n";
}

function handleUxLibraryAction(dialog, action, id) {
  const status = dialog.querySelector("#uxHostStatus");
  const items = readUxLibrary();
  const item = items.find((record) => record.id === id);
  const editor = dialog.querySelector("#uxLibraryEditor");
  const title = dialog.querySelector("#uxLibraryTitle");
  const type = dialog.querySelector("#uxLibraryType");
  const content = dialog.querySelector("#uxLibraryText");
  const persist = (next) => writeUxStorage(uxLibraryKey(), JSON.stringify(next.slice(0, 40)));
  if (action === "library-download") {
    let url;
    try {
      const csv = formatUxCsv([["항목", "값"], ["게임", modeLabel(getRoomMode())], ["단계", statusLabel(state.room.status || "waiting")],
        ["참가자", getStudents().length], ...getUxLessonMetrics()]);
      url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `playground-${getRoomMode()}-${new Date().toISOString().slice(0, 10)}.csv`;
      dialog.append(link);
      link.click();
      link.remove();
      status.textContent = "이름 없는 집계 CSV를 준비했습니다.";
    } catch { status.textContent = "다운로드를 준비하지 못했습니다."; }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 3000); }
    return;
  }
  if (action === "library-cancel") { editor.hidden = true; return; }
  if (action === "library-new" || ((action === "library-edit" || action === "library-clone") && item && Object.hasOwn(UX_LIBRARY_TYPES, item.type))) {
    editor.dataset.record = action === "library-edit" ? item.id : "";
    title.value = action === "library-clone" ? `${item.title.slice(0, 34)} (복제)` : item?.title || "";
    type.value = item?.type || (Object.hasOwn(UX_LIBRARY_TYPES, getRoomMode()) ? getRoomMode() : "liar");
    content.value = item?.text || "";
    editor.hidden = false;
    title.focus();
    return;
  }
  let ok;
  if (action === "library-snapshot") {
    const snapshot = { id: createParticipantId(), type: "history", title: modeLabel(getRoomMode()),
      text: `참가 ${getStudents().length}명 · ${statusLabel(state.room.status || "waiting")} · 방 ${state.roomCode}`,
      mode: getRoomMode(), metrics: getUxLessonMetrics(), updatedAt: Date.now() };
    ok = persist([snapshot, ...items]);
  } else if (action === "library-save") {
    const name = cleanText(title.value).slice(0, 40);
    const text = validateUxLibraryText(type.value, content.value.trim());
    if (!name || !text) { status.textContent = "제목과 자료 형식을 확인해 주세요."; return; }
    const record = editor.dataset.record || createParticipantId();
    ok = persist([{ id: record, type: type.value, title: name, text, updatedAt: Date.now() }, ...items.filter((existing) => existing.id !== record)]);
    if (ok) editor.hidden = true;
  } else if (action === "library-delete" && item) {
    if (!window.confirm("이 기기의 자료 또는 기록을 삭제할까요? 현재 방의 데이터에는 영향이 없습니다.")) return;
    ok = persist(items.filter((existing) => existing.id !== id));
  } else if (action === "library-use" && item) {
    if (item.type !== getRoomMode() || (state.room.status || "waiting") !== "waiting" || state.room.accessClosed) {
      status.textContent = "자료에 맞는 게임의 대기 화면에서 가져올 수 있습니다.";
      return;
    }
    const text = validateUxLibraryText(item.type, item.text);
    const lines = text.split("\n");
    if (!text) return;
    const fields = item.type === "liar" ? [["#liarWordAInput", lines[0]], ["#liarWordBInput", lines[1]]]
      : item.type === "seat" ? text.split("x").map((value, index) => [index ? "#seatColumnsInput" : "#seatRowsInput", value])
      : [[item.type === "catchmind" ? "#catchmindWordsInput" : "#uxBingoConcepts", text]];
    if (!fields.every(([selector]) => document.querySelector(selector) && !document.querySelector(selector).disabled)) {
      status.textContent = "게임의 준비 화면을 먼저 열어 주세요.";
      return;
    }
    for (const [selector, value] of fields) uxFillField(selector, value);
    dialog.close();
    document.querySelector(fields[0][0])?.focus();
    showToast("준비 화면에 넣었습니다. 내용을 확인하고 설정을 저장해 주세요.", "success");
    return;
  } else return;
  status.textContent = ok ? "이 기기에 변경을 반영했습니다." : "이 기기에 저장하지 못했습니다.";
  if (ok) renderUxLibraryRows(dialog);
}

function applyHostRoomAction(room, request) {
  const { action, generation, hostUid, studentId, timestamp } = request;
  if (!room || getRoomGeneration(room) !== generation || (room.hostUid && room.hostUid !== hostUid)) return { error: "session" };
  const phase = room.status || "waiting";
  if (action === "lock") {
    if (room.accessClosed) return { error: "phase" };
    room.accessLocked = request.locked;
  } else if (action === "close-room") {
    if (!["waiting", "collecting", "finished"].includes(phase)) return { error: "phase" };
    room.accessClosed = request.closed;
  } else {
    const student = room.students?.[studentId];
    if (!student || room.accessClosed || !["waiting", "collecting"].includes(phase)) return { error: "phase" };
    if (action === "rename") {
      const name = parseStudentName(request.name);
      if (!name.valid) return { error: "invalid" };
      const owner = room.nameClaims?.[name.key];
      if ((owner && owner !== studentId) || getRoomNameMatches(room, name.key, studentId).length) return { error: "duplicate" };
      migrateRoomQuestionOwners(room);
      room.nameClaims ||= {};
      const oldKey = parseStudentName(student.name).key;
      if (oldKey !== name.key && room.nameClaims[oldKey] === studentId) delete room.nameClaims[oldKey];
      room.nameClaims[name.key] = studentId;
      student.name = name.display;
      student.nameKey = name.key;
    } else if (action === "remove" || action === "allow") {
      student.removedAt = action === "remove" ? timestamp : null;
      if (action === "remove") {
        student.connected = false;
        const active = room.presence?.[getPresenceKey(generation)];
        if (active) delete active[studentId];
      }
    } else return { error: "invalid" };
  }
  return { room };
}

function statusLabel(status) {
  if (status === "result" && getRoomMode() === "word") {
    return "단어 검토 중";
  }
  const labels = {
    waiting: "대기 중",
    ready: "라운드 준비",
    seatSelection: "자리 선택",
    cardPhase: "카드 활용",
    finalReady: "최종 공개 준비",
    finalReveal: "자리 공개",
    memoryReady: "이미지 준비",
    memoryCountdown: "카드 위치 공개",
    memoryPlaying: "메모리 배틀 진행",
    memoryAwaitingResults: "결과 공개 준비",
    bingoPlaying: "개념 빙고 진행",
    reviewing: "단어 검토 중",
    playing: "진행 중",
    result: "결과 공개",
    targetReveal: "칭찬 대상 공개",
    authorGuess: "작성자 추리",
    authorReveal: "작성자 공개",
    roleAssigned: "역할 배정",
    roleReveal: "역할 확인",
    nightAction: "밤 행동",
    nightResult: "낮 결과",
    discussion: "낮 토론",
    voting: "투표",
    voteResult: "투표 결과",
    roleRevealDead: "정체 공개",
    finished: "최종 결과"
  };
  return labels[status] || "대기 중";
}

function statusPillClass(status) {
  const classes = {
    waiting: "blue",
    ready: "blue",
    seatSelection: "green",
    cardPhase: "gold",
    finalReady: "blue",
    finalReveal: "gold",
    memoryReady: "blue",
    memoryCountdown: "gold",
    memoryPlaying: "green",
    memoryAwaitingResults: "gold",
    bingoPlaying: "green",
    reviewing: "gold",
    playing: "green",
    result: "gold",
    targetReveal: "gold",
    authorGuess: "blue",
    authorReveal: "gold",
    roleAssigned: "gold",
    roleReveal: "blue",
    nightAction: "red",
    nightResult: "gold",
    discussion: "blue",
    voting: "green",
    voteResult: "gold",
    roleRevealDead: "red",
    finished: "red"
  };
  return classes[status] || "blue";
}

function answerSummaryText(answer) {
  if (!answer) {
    return "응답하지 않았어요";
  }
  if (answer.isSkipped) {
    return "내 문제라서 점수 대상이 아니에요";
  }
  return answer.isCorrect ? "정답입니다!" : "아쉽지만 오답입니다";
}

function formatTime(value) {
  if (!Number.isFinite(Number(value))) {
    return "-";
  }
  return `${Number(value).toFixed(1)}초`;
}

function formatClock(value) {
  const timestamp = Number(value || 0);
  if (!timestamp) {
    return "-";
  }
  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
