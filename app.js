import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
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
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// =========================
// 수업용 기본 설정
// =========================

// Firebase Console > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성 값을 붙여 넣으세요.
// Realtime Database를 사용하므로 databaseURL 값이 꼭 필요합니다.

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
const TEACHER_PASSWORD = "0221";

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

let firebaseApp = null;
let db = null;
let displayWindow = null;

const state = {
  role: null,
  roomCode: "",
  studentName: "",
  studentId: "",
  room: null,
  unsubscribeRoom: null,
  activeView: "",
  timerId: null,
  toastId: null,
  answering: false,
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
  catchmindTool: "pen",
  catchmindColor: "#111827",
  catchmindSize: 5,
  seatSettingsDraft: null,
  seatCardTargetMode: false,
  seatCardTargetSeats: [],
  seatInteractionKey: "",
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

if (isFirebaseConfigured()) {
  firebaseApp = initializeApp(firebaseConfig);
  db = getDatabase(firebaseApp);
}

bootApp();

// =========================
// 화면 렌더링
// =========================

function bootApp() {
  const params = new URLSearchParams(window.location.search);
  const isDisplay = params.get("display") === "1";
  const displayRoomCode = normalizeRoomCode(params.get("room") || "");

  if (isDisplay && displayRoomCode) {
    enterDisplayMode(displayRoomCode);
    return;
  }

  renderHome();
}

function enterDisplayMode(roomCode) {
  state.role = "display";
  state.roomCode = roomCode;
  state.activeView = "";

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
  clearRoomSubscription();
  clearTimer();
  state.role = null;
  state.room = null;
  state.activeView = "home";

  const savedRoom = localStorage.getItem("wbq_roomCode") || "";
  const savedName = localStorage.getItem("wbq_studentName") || "";

  appEl.innerHTML = `
    <section class="screen">
      <div class="hero">
        <p class="eyebrow">동명중학교</p>
        <h1>동명중학교 PLAYGROUND</h1>
        <p class="lead">퀴즈, 칭찬, 추리, 게임이 모이는 우리 학교 플레이 공간</p>
      </div>

      ${db ? "" : `
        <div class="notice danger">
          Firebase 설정값이 아직 입력되지 않았습니다. <strong>app.js 상단의 firebaseConfig</strong>를 먼저 채워 주세요.
        </div>
      `}

      <div class="grid-2">
        <section class="panel">
          <div>
            <h2>학생으로 입장</h2>
            <p class="muted">방 코드와 이름을 입력하면 현재 모드에 맞는 학생 화면으로 이동합니다.</p>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="studentRoomCode">방 코드</label>
              <input id="studentRoomCode" autocomplete="off" inputmode="latin" maxlength="8" placeholder="예: A7K2Q9" value="${escapeAttr(savedRoom)}" />
            </div>
            <div class="field">
              <label for="studentName">이름</label>
              <input id="studentName" autocomplete="name" maxlength="20" placeholder="이름을 입력하세요" value="${escapeAttr(savedName)}" />
            </div>
            <button id="studentEnterBtn" class="btn primary full">학생 입장</button>
          </div>
        </section>

        <section class="panel">
          <div>
            <h2>교사로 입장</h2>
            <p class="muted">방을 만들거나 기존 방 코드로 다시 들어갑니다.</p>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="teacherPassword">관리자 비밀번호</label>
              <input id="teacherPassword" type="password" autocomplete="current-password" placeholder="비밀번호" />
            </div>
            <div class="field">
              <label for="teacherRoomCode">방 코드</label>
              <input id="teacherRoomCode" autocomplete="off" inputmode="latin" maxlength="8" placeholder="비워 두면 자동 생성" value="${escapeAttr(savedRoom)}" />
            </div>
            <div class="field">
              <span class="label">게임 모드</span>
              <div class="mode-options">
                <label class="mode-tile">
                  <input type="radio" name="teacherMode" value="quiz" checked />
                  <span>
                    <strong>퀴즈 배틀</strong>
                    <small>학생들이 낸 4지선다 문제를 풉니다.</small>
                  </span>
                </label>
                <label class="mode-tile">
                  <input type="radio" name="teacherMode" value="compliment" />
                  <span>
                    <strong>칭찬 스무고개</strong>
                    <small>익명 칭찬 단서로 친구를 추리합니다.</small>
                  </span>
                </label>
                <label class="mode-tile">
                  <input type="radio" name="teacherMode" value="mafia" />
                  <span>
                    <strong>교실 마피아 게임</strong>
                    <small>역할 확인, 밤 행동, 토론, 투표를 패드로 진행합니다.</small>
                  </span>
                </label>
                <label class="mode-tile">
                  <input type="radio" name="teacherMode" value="liar" />
                  <span>
                    <strong>라이어게임</strong>
                    <small>비슷한 제시어 속 숨어 있는 라이어를 찾아라!</small>
                  </span>
                </label>
                <label class="mode-tile">
                  <input type="radio" name="teacherMode" value="catchmind" />
                  <span>
                    <strong>캐치마인드</strong>
                    <small>그림을 보고 제시어를 가장 빠르게 맞혀라!</small>
                  </span>
                </label>
                <label class="mode-tile">
                  <input type="radio" name="teacherMode" value="seat" />
                  <span>
                    <strong>자리바꾸기 게임</strong>
                    <small>자리를 고르고, 카드를 사용하고, 마지막까지 내 자리를 지켜라!</small>
                  </span>
                </label>
              </div>
            </div>
            <div class="button-row">
              <button id="teacherEnterBtn" class="btn dark">교사 입장</button>
              <button id="newRoomCodeBtn" class="btn ghost" type="button">새 코드 넣기</button>
            </div>
          </div>
        </section>
      </div>
    </section>
  `;

  document.querySelector("#studentEnterBtn").addEventListener("click", enterStudent);
  document.querySelector("#teacherEnterBtn").addEventListener("click", enterTeacher);
  document.querySelector("#newRoomCodeBtn").addEventListener("click", () => {
    document.querySelector("#teacherRoomCode").value = generateRoomCode();
  });
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

  if (getRoomMode() === "catchmind") {
    renderCatchmindStudentRoute();
    return;
  }

  if (getRoomMode() === "seat") {
    renderSeatStudentRoute();
    return;
  }

  const status = state.room.status || "waiting";

  if (status === "waiting") {
    const ownQuestions = findQuestionsByAuthor(state.studentName);
    if (state.activeView === "student-question") {
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
    renderStudentQuiz(true);
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
  const choices = normalizeChoices(editingQuestion?.choices);
  const correctIndex = Number.isInteger(editingQuestion?.correctIndex) ? editingQuestion.correctIndex : -1;

  setView("student-question", `
    <section class="screen">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>

      <div class="question-form-layout">
        <aside class="panel tight">
          <h2>문제 만들기</h2>
          <div class="notice info">
            자기 자신에 대한 가벼운 4지선다 문제를 만들어 주세요. 좋아하는 음식, 취미, 가고 싶은 나라, 좋아하는 색깔, 쉬는 시간에 자주 하는 일처럼 친구들이 즐겁게 맞힐 수 있는 주제가 좋습니다.
          </div>
          <div class="notice warn">
            집주소, 전화번호, 가족 사정, 외모, 몸무게, 성적, 돈, 건강, 연애, 특정 친구를 놀리는 내용은 쓰지 않습니다.
          </div>
          <p class="muted small">한 학생은 최대 3문제까지 제출할 수 있고, 대기 화면에서 제출한 문제를 각각 수정할 수 있습니다.</p>
        </aside>

        <form id="questionForm" class="panel">
          <input id="editingQuestionId" type="hidden" value="${escapeAttr(editingQuestion?.id || "")}" />
          <div class="field">
            <label for="authorName">이름</label>
            <input id="authorName" maxlength="20" value="${escapeAttr(state.studentName)}" required />
          </div>

          <div class="field">
            <label for="questionText">문제</label>
            <textarea id="questionText" maxlength="160" placeholder="예: 내가 가장 좋아하는 음식은 무엇일까요?" required>${escapeHtml(editingQuestion?.question || "")}</textarea>
          </div>

          <div class="choice-input-grid">
            ${[0, 1, 2, 3].map((index) => `
              <div class="field">
                <label for="choice${index}">선택지 ${index + 1}</label>
                <input id="choice${index}" maxlength="80" value="${escapeAttr(choices[index] || "")}" required />
              </div>
            `).join("")}
          </div>

          <div class="field">
            <span class="label">정답 번호</span>
            <div class="answer-options">
              ${[0, 1, 2, 3].map((index) => `
                <label class="radio-tile">
                  <input type="radio" name="correctIndex" value="${index}" ${correctIndex === index ? "checked" : ""} />
                  <span>${index + 1}</span>
                </label>
              `).join("")}
            </div>
          </div>

          <div class="button-row">
            <button class="btn primary" type="submit">${editingQuestion ? "문제 수정 제출" : "새 문제 제출"}</button>
            ${editingQuestion ? `<button class="btn ghost" id="goWaitingBtn" type="button">대기 화면</button>` : ""}
          </div>
        </form>
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
    document.querySelector("#questionForm").addEventListener("submit", submitQuestion);
    document.querySelector("#goWaitingBtn")?.addEventListener("click", () => renderStudentWaiting(true));
  });
}

function renderStudentWaiting(force = false) {
  const questions = getQuestions();
  const students = getStudents();
  const connectedCount = students.filter((student) => student.connected).length;
  const ownQuestions = findQuestionsByAuthor(state.studentName);
  const maxQuestions = getMaxQuestionsPerStudent();
  const canAddMoreQuestions = ownQuestions.length < maxQuestions;

  setView("student-waiting", `
    <section class="screen">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>

      <div class="panel">
        <h2>문제가 제출되었습니다.</h2>
        <p class="lead">선생님이 게임을 시작하면 퀴즈가 시작됩니다.</p>
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
        <section class="question-card">
          <div class="status-bar">
            <div>
              <h3>내가 제출한 문제</h3>
              <p class="muted small">${ownQuestions.length} / ${maxQuestions}개 제출</p>
            </div>
            <button class="btn primary" id="addQuestionBtn" type="button" ${canAddMoreQuestions ? "" : "disabled"}>문제 추가</button>
          </div>
          ${ownQuestions.length ? `
            <ul class="list">
              ${ownQuestions.map((question, index) => `
                <li class="list-row split">
                  <div>
                    <p class="muted small">내 문제 ${index + 1}</p>
                    <strong>${escapeHtml(question.question)}</strong>
                  </div>
                  <button class="btn ghost" data-edit-own-question="${escapeAttr(question.id)}" type="button">수정</button>
                </li>
              `).join("")}
            </ul>
          ` : `<div class="empty">아직 제출한 문제가 없습니다.</div>`}
        </section>
      </div>
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
    <section class="screen compliment-mode">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill gold">칭찬 스무고개</span>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>

      <div class="question-form-layout">
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

        <form id="complimentForm" class="panel">
          <input id="editingComplimentId" type="hidden" value="${escapeAttr(editingCompliment?.id || "")}" />
          <div class="field">
            <label for="complimentAuthorName">내 이름</label>
            <input id="complimentAuthorName" maxlength="20" value="${escapeAttr(state.studentName)}" required />
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
              <div class="field">
                <label for="complimentClue${index}">칭찬 단서 ${index + 1}${index === 4 ? " 선택" : ""}</label>
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
    document.querySelector("#complimentForm").addEventListener("submit", submitCompliment);
    document.querySelector("#goComplimentWaitingBtn")?.addEventListener("click", () => renderComplimentWaiting(true));
  });
}

function renderComplimentWaiting(force = false) {
  const compliments = getCompliments();
  const students = getStudents();
  const connectedCount = students.filter((student) => student.connected).length;
  const ownCompliments = findComplimentsByAuthor(state.studentId);
  const maxCompliments = getMaxComplimentsPerStudent();
  const canAddMoreCompliments = ownCompliments.length < maxCompliments && getComplimentTargetOptions().length > 0;

  setView("compliment-waiting", `
    <section class="screen compliment-mode">
      <div class="status-bar">
        <button class="btn ghost" id="backHomeBtn" type="button">처음으로</button>
        <span class="pill gold">칭찬 스무고개</span>
        <span class="pill blue">방 코드 ${escapeHtml(state.roomCode)}</span>
      </div>

      <div class="panel warm-panel">
        <h2>칭찬 카드가 제출되었습니다.</h2>
        <p class="lead">선생님이 게임을 시작하면 칭찬 스무고개가 시작됩니다.</p>
        <div class="stats">
          <div class="stat">
            <span class="muted">제출된 칭찬 카드</span>
            <span class="num">${compliments.length}</span>
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
        <section class="question-card">
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
      </div>
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
  const authorBlocked = compliment.authorStudentId === state.studentId;
  const options = getComplimentGuessOptions(compliment);
  const disabled = authorBlocked || alreadyCorrect || Boolean(guessedThisClue);

  setView(`compliment-target-${compliment.id}-${clueIndex}`, `
    <section class="screen compliment-mode">
      <div class="status-bar">
        <span class="pill gold">칭찬 ${Number(state.room.currentComplimentIndex || 0) + 1} / ${getCompliments().length}</span>
        <span class="pill blue">단서 ${clueIndex + 1} / ${clues.length}</span>
        <span class="pill green">내 점수 ${getMyScore()}점</span>
      </div>

      <section class="panel warm-panel">
        <p class="eyebrow">칭찬 대상은 누구일까요?</p>
        <h2>공개된 칭찬 단서</h2>
        ${renderComplimentClueCards(visibleClues)}
      </section>

      ${authorBlocked ? `<div class="notice warn">내가 작성한 칭찬입니다. 이 문제는 맞힐 수 없습니다.</div>` : ""}
      ${alreadyCorrect ? `<div class="notice info">이미 이 칭찬의 대상을 맞혔습니다. 다음 단계까지 기다려 주세요.</div>` : ""}
      ${guessedThisClue && !alreadyCorrect ? `<div class="notice info">이번 단서에서는 이미 추리했습니다. 다음 단서가 공개되면 다시 도전할 수 있습니다.</div>` : ""}

      <section class="panel">
        <h3>칭찬 대상 선택</h3>
        ${renderStudentChoiceButtons(options, "target-student", disabled)}
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
    <section class="screen compliment-mode">
      <div class="panel warm-panel">
        <p class="eyebrow">칭찬 대상 공개</p>
        <h1>${escapeHtml(compliment.targetName)}</h1>
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

  const authorBlocked = compliment.authorStudentId === state.studentId;
  const answer = getMyComplimentAuthorAnswer(compliment.id);
  const options = getComplimentGuessOptions(compliment);

  setView(`compliment-author-${compliment.id}`, `
    <section class="screen compliment-mode">
      <div class="status-bar">
        <span class="pill gold">작성자 추리</span>
        <span class="pill green">내 점수 ${getMyScore()}점</span>
      </div>

      <section class="panel warm-panel">
        <p class="eyebrow">이 칭찬을 쓴 사람은 누구일까요?</p>
        <h2>칭찬 대상: ${escapeHtml(compliment.targetName)}</h2>
        ${renderComplimentClueCards(normalizeComplimentClues(compliment.clues))}
      </section>

      ${authorBlocked ? `<div class="notice warn">내가 작성한 칭찬입니다. 작성자 추리에 참여할 수 없습니다.</div>` : ""}
      ${answer ? `<div class="notice info">작성자 추리를 제출했습니다. 선생님이 정답을 공개할 때까지 기다려 주세요.</div>` : ""}

      <section class="panel">
        <h3>작성자 선택</h3>
        ${renderStudentChoiceButtons(options, "author-student", authorBlocked || Boolean(answer))}
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
        <p class="eyebrow">칭찬 대상</p>
        <h1>${escapeHtml(compliment.targetName)}</h1>
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
  const connectedCount = students.filter((student) => student.connected).length;

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
        <p class="eyebrow">다른 친구에게 보여 주지 마세요</p>
        <h1>당신은 ${roleLabel(player.role)}입니다.</h1>
        <p class="lead">${escapeHtml(roleDescription(player.role))}</p>
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

  if (isMafiaNightComplete() && !round.nightResult) {
    calculateMafiaNightResult();
  }

  setView(`mafia-night-${getMafiaRoundNumber()}-${player.id}-${Boolean(action)}`, `
    <section class="screen mafia-mode">
      <div class="status-bar">
        <span class="pill red">${getMafiaRoundNumber()}번째 밤 행동</span>
        <span class="pill green">내 역할 ${roleLabel(player.role)}</span>
      </div>

      <div class="panel mafia-panel">
        <h2>밤 행동 시간입니다.</h2>
        <p class="lead">한 명을 선택하세요. 선택 후 변경할 수 없습니다.</p>
        ${canSelectSelf ? `<p class="muted">의사는 자기 자신도 보호 대상으로 선택할 수 있습니다.</p>` : ""}
        ${action ? `<div class="notice info">밤 행동을 완료했습니다. 모든 학생의 행동이 끝날 때까지 기다려 주세요.</div>` : ""}
        ${player.role === "police" && action?.result ? `
          <div class="notice ${action.result === "mafia" ? "danger" : "info"}">
            조사 결과: ${escapeHtml(action.selectedName)}은/는 ${action.result === "mafia" ? "마피아입니다." : "마피아가 아닙니다."}
          </div>
        ` : ""}
        ${player.role === "mafia" ? renderMafiaPartnerChoices(round) : ""}
        ${renderStudentChoiceButtons(options, "mafia-night-target", disabled)}
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
    <section class="screen mafia-mode">
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
    <section class="screen mafia-mode">
      <div class="panel mafia-panel">
        <span class="pill blue">비밀 투표</span>
        <h2>최종 지목할 친구를 선택하세요.</h2>
        <p class="lead">생존자 중 한 명에게 투표합니다. 자기 자신에게는 투표할 수 없습니다.</p>
        ${vote ? `<div class="notice info">투표를 완료했습니다. 모두의 투표가 끝날 때까지 기다려 주세요.</div>` : ""}
        ${renderStudentChoiceButtons(options, "mafia-vote-target", Boolean(vote))}
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
        <h1>${elimination?.name ? `${escapeHtml(elimination.name)}의 정체는 ${roleText}였습니다.` : "공개할 정체가 없습니다."}</h1>
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
    getGhostBingoRenderKey(ghost),
    getGhostChatRenderKey({ teacher: false, ghost })
  ].join("-");

  setView(viewKey, `
    <section class="screen mafia-mode ghost-mode">
      <div class="status-bar">
        <div>
          <p class="eyebrow">사망자 전용</p>
          <h1>👻 당신은 유령이 되었습니다.</h1>
        </div>
        <span class="pill ${statusPillClass(state.room.status || "waiting")}">${statusLabel(state.room.status || "waiting")}</span>
      </div>

      <div class="notice warn">
        생존자에게 게임 정보나 역할 정보를 전달해서는 안 됩니다. 유령 채팅은 사망자와 선생님만 보는 공간입니다.
      </div>

      ${renderMafiaGhostPublicStatus()}

      <div class="ghost-layout">
        <section class="panel mafia-panel">
          ${ghost.bingoConfirmed ? renderGhostBingoLive(ghost) : renderGhostBingoBuilder(ghost)}
        </section>
        <section class="panel mafia-panel">
          <h2>유령 전용 채팅</h2>
          ${renderGhostChatPanel({ teacher: false, ghost, allowSend: state.room.status !== "finished" })}
        </section>
      </div>
    </section>
  `, () => {
    setupGhostBingoHandlers(ghost);
    setupGhostChatHandlers();
    scrollGhostChatToBottom({ focusInput: state.ghostChatShouldFocus });
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
    <section class="screen liar-mode">
      <div class="status-bar">
        <span class="pill blue">라이어게임</span>
        <span class="pill ${confirmed ? "green" : "gold"}">${confirmed ? "제시어 확인 완료" : "제시어 확인 대기"}</span>
      </div>
      <div class="panel liar-panel word-card">
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
    <section class="screen liar-mode">
      <div class="status-bar">
        <span class="pill green">라이어 투표</span>
        <span class="pill blue">내 제시어 ${escapeHtml(assignment.word)}</span>
      </div>
      <div class="panel liar-panel">
        <h2>${vote ? "투표 완료" : "라이어라고 생각하는 친구를 선택하세요."}</h2>
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
  const ownBlocked = !ALLOW_SOLVE_OWN_QUESTION && question.authorKey === nameToKey(state.studentName);
  if (ownBlocked && !answer) {
    ensureOwnQuestionSkipped(question);
  }

  const total = questions.length;
  const choices = normalizeChoices(question.choices);
  const disabled = Boolean(answer) || ownBlocked;

  setView(`student-quiz-${question.id}`, `
    <section class="quiz-stage">
      <div class="status-bar">
        <span class="pill blue">${currentIndex + 1} / ${total}</span>
        <span class="pill green">내 점수 ${getMyScore()}점</span>
      </div>

      <div class="timer-wrap">
        <div class="timer-top">
          <span>남은 시간</span>
          <span id="studentTimerText">${state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS}초</span>
        </div>
        <div class="timer-track"><div id="studentTimerFill" class="timer-fill"></div></div>
      </div>

      <div class="quiz-question">
        <div class="question-meta">
          <span class="author-badge">출제자 ${escapeHtml(question.authorName || "익명")}</span>
        </div>
        <h2>${escapeHtml(question.question)}</h2>
      </div>

      ${ownBlocked ? `<div class="notice warn">내가 낸 문제라서 점수 대상이 아닙니다. 이 문제는 자동으로 0점 처리됩니다.</div>` : ""}
      ${answer && !answer.isSkipped ? `<div class="notice info">답변이 제출되었습니다. 선생님이 정답을 공개할 때까지 기다려 주세요.</div>` : ""}

      <div class="choices">
        ${choices.map((choice, index) => `
          <button class="choice-btn choice-${index} ${answer?.selectedIndex === index ? "selected" : ""}" data-answer-index="${index}" type="button" ${disabled ? "disabled" : ""}>
            <span class="choice-prefix">${index + 1}</span>${escapeHtml(choice)}
          </button>
        `).join("")}
      </div>
    </section>
  `, () => {
    document.querySelectorAll("[data-answer-index]").forEach((button) => {
      button.addEventListener("click", () => submitAnswer(Number(button.dataset.answerIndex)));
    });
    startTimer({
      startedAt: state.room.questionStartedAt,
      limit: state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS,
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
  const correctText = choices[question.correctIndex] || "";

  setView(`student-result-${question.id}`, `
    <section class="screen">
      <div class="status-bar">
        <span class="pill gold">문제 ${currentIndex + 1} 결과</span>
        <span class="pill green">내 누적 ${totalScore}점</span>
      </div>

      <div class="panel">
        <h2>${answerSummaryText(answer)}</h2>
        <p class="lead">정답은 <strong>${question.correctIndex + 1}. ${escapeHtml(correctText)}</strong> 입니다.</p>
        ${answer ? `
          <div class="stats">
            <div class="stat">
              <span class="muted">이번 문제 점수</span>
              <span class="num">${Number(answer.scoreEarned || 0)}</span>
            </div>
            <div class="stat">
              <span class="muted">선택한 답</span>
              <span class="num">${Number.isInteger(answer.selectedIndex) ? answer.selectedIndex + 1 : "-"}</span>
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
          <h3>선택지별 응답 수</h3>
          ${renderAnswerBars(question)}
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

  renderQuizDisplay(force);
}

function renderDisplayShell(viewName, title, subtitle, bodyHtml, afterRender = null, force = false) {
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
            : "";
  setView(viewName, `
    <section class="screen display-stage ${modeClass}">
      <div class="display-header">
        <div>
          <p class="eyebrow">동명중학교 PLAYGROUND · 방 코드 ${escapeHtml(state.roomCode)}</p>
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="lead">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        <span class="pill ${statusPillClass(state.room?.status || "waiting")}">${statusLabel(state.room?.status || "waiting")}</span>
      </div>
      ${bodyHtml}
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
    renderDisplayShell(viewName, "퀴즈 배틀", `${currentIndex + 1} / ${questions.length}번째 문제`, `
      <section class="panel display-main-panel">
        ${renderTeacherCurrentQuestion(currentQuestion, currentIndex, questions.length, status)}
      </section>
      ${status === "result" ? `
        <section class="panel">
          <h2>현재 누적 랭킹</h2>
          ${renderRanking(getCumulativeRanking().slice(0, 8))}
        </section>
      ` : `<div class="notice info">학생들은 각자 패드에서 답을 선택합니다.</div>`}
    `, () => {
      if (status === "playing") {
        startTimer({
          startedAt: state.room.questionStartedAt,
          limit: state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS,
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
          <span class="num">${questions.length}</span>
        </div>
        <div class="stat">
          <span class="muted">참여 학생</span>
          <span class="num">${students.length}</span>
        </div>
        <div class="stat">
          <span class="muted">접속 학생</span>
          <span class="num">${students.filter((student) => student.connected).length}</span>
        </div>
      </div>
    </div>
  `, null, force);
}

function renderComplimentDisplay(force = false) {
  const compliments = getCompliments();
  const students = getStudents();
  const status = state.room.status || "waiting";
  const currentIndex = Number(state.room.currentComplimentIndex ?? -1);
  const currentCompliment = compliments[currentIndex];
  const viewName = `display-compliment-${status}-${currentCompliment?.id || "none"}-${state.room.currentClueIndex || 0}`;

  if (status === "finished") {
    renderDisplayShell(viewName, "최종 결과", "전체 누적 랭킹을 확인합니다.", `
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

    renderDisplayShell(viewName, "칭찬 스무고개", `${currentIndex + 1} / ${compliments.length}번째 칭찬 카드`, `
      <section class="panel warm-panel display-main-panel">
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
          <span class="num">${compliments.length}</span>
        </div>
        <div class="stat">
          <span class="muted">참여 학생</span>
          <span class="num">${students.length}</span>
        </div>
        <div class="stat">
          <span class="muted">접속 학생</span>
          <span class="num">${students.filter((student) => student.connected).length}</span>
        </div>
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
    const completed = alivePlayers.filter((player) => getMafiaNightAction(player.id, player.role)).length;
    bodyHtml = `
      <section class="panel mafia-panel result-panel">
        <span class="pill red">${getMafiaRoundNumber()}번째 밤</span>
        <h1>밤 행동 진행 중</h1>
        <p class="lead">생존자들이 각자 패드에서 선택하고 있습니다.</p>
        <div class="stats">
          <div class="stat"><span class="muted">밤 행동 완료</span><span class="num">${completed}/${alivePlayers.length}</span></div>
          <div class="stat"><span class="muted">생존자</span><span class="num">${alivePlayers.length}</span></div>
        </div>
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
    const voteCount = Object.keys(round.votes || {}).length;
    bodyHtml = `
      <section class="panel mafia-panel result-panel">
        <span class="pill green">비밀 투표</span>
        <h1>투표 진행 중</h1>
        <div class="stats">
          <div class="stat"><span class="muted">투표 완료</span><span class="num">${voteCount}/${alivePlayers.length}</span></div>
          <div class="stat"><span class="muted">생존자</span><span class="num">${alivePlayers.length}</span></div>
        </div>
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
    bodyHtml = `<section class="panel mafia-panel result-panel"><span class="pill red">정체 공개</span><h1>${elimination?.name ? `${escapeHtml(elimination.name)}의 정체는 ${roleText}였습니다.` : "공개할 정체가 없습니다."}</h1></section>`;
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
          <div class="stat"><span class="muted">투표 완료</span><span class="num">${Object.keys(votes).length}/${participants.length}</span></div>
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

  const questions = getQuestions();
  const students = getStudents();
  const connectedCount = students.filter((student) => student.connected).length;
  const status = state.room.status || "waiting";
  const currentIndex = Number(state.room.currentQuestionIndex ?? -1);
  const currentQuestion = questions[currentIndex];
  const maxQuestions = getMaxQuestionsPerStudent();

  setView("teacher-dashboard", `
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
    document.querySelectorAll("[data-delete-question]").forEach((button) => {
      button.addEventListener("click", () => deleteQuestion(button.dataset.deleteQuestion));
    });
    document.querySelectorAll("[data-view-question]").forEach((button) => {
      button.addEventListener("click", () => showTeacherQuestionDetail(button.dataset.viewQuestion));
    });
    if (currentQuestion && status === "playing") {
      startTimer({
        startedAt: state.room.questionStartedAt,
        limit: state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS,
        textSelector: "#teacherTimerText",
        fillSelector: "#teacherTimerFill",
        onEnd: () => {
          if (AUTO_REVEAL_WHEN_TIME_UP && state.role === "teacher" && state.room?.status === "playing") {
            revealAnswer(true);
          }
        }
      });
    }
  }, force);
}

function renderComplimentTeacherDashboard(force = true) {
  const compliments = getCompliments();
  const students = getStudents();
  const connectedCount = students.filter((student) => student.connected).length;
  const status = state.room.status || "waiting";
  const currentIndex = Number(state.room.currentComplimentIndex ?? -1);
  const currentCompliment = compliments[currentIndex];
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
            <button class="btn primary" data-action="start-compliment" type="button" ${compliments.length ? "" : "disabled"}>게임 시작</button>
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
    renderCatchmindGuesser(true);
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

  // Firebase에 획을 저장할 때마다 방 구독이 갱신된다. 누르고 있는 동안
  // 캔버스를 교체하면 이전 캔버스의 좌표가 사라져 선이 모서리로 튄다.
  if (state.catchmindDrawing.active && state.activeView === viewName && document.querySelector("#catchmindCanvas")) {
    return;
  }

  setView(viewName, `
    <section class="screen catchmind-mode">
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
          <p class="muted">정답자 ${getCatchmindCorrectAnswers().length}명</p>
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
  const answer = getMyCatchmindCorrectAnswer();
  const viewName = `catchmind-guesser-${round.roundId}-${Boolean(answer)}-${getCatchmindStrokeRenderKey()}-${getCatchmindCorrectAnswers().length}`;
  const disabled = Boolean(answer);

  setView(viewName, `
    <section class="screen catchmind-mode">
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
            ${state.catchmindWrongMessage ? `<div class="notice danger">${escapeHtml(state.catchmindWrongMessage)}</div>` : ""}
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
        <p class="eyebrow">정답</p>
        <h1>${escapeHtml(round.word)}</h1>
        <p class="lead">출제자: ${escapeHtml(round.drawerName)}</p>
      </section>
      <div class="grid-2 home-entry-grid">
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
        <p class="eyebrow">정답</p>
        <h1>${escapeHtml(round.word)}</h1>
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
        <span class="pill blue">정답 ${getCatchmindCorrectAnswers().length} / ${getCatchmindGuesserCount()}명</span>
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
      <div class="segmented">
        ${colors.map(([color, label]) => `
          <button class="tool-btn ${state.catchmindTool === "pen" && state.catchmindColor === color ? "selected" : ""}" data-catchmind-color="${color}" type="button" title="${label}">
            <span class="color-dot" style="background:${color}"></span>
          </button>
        `).join("")}
        <button class="tool-btn ${state.catchmindTool === "eraser" ? "selected" : ""}" data-catchmind-tool="eraser" type="button">지우개</button>
      </div>
      <div class="segmented">
        ${sizes.map(([size, label]) => `
          <button class="btn ${state.catchmindSize === size ? "primary" : "ghost"}" data-catchmind-size="${size}" type="button">${label}</button>
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
  const lengthHint = remaining <= 30;
  const initialHint = remaining <= 10;

  if (!lengthHint) {
    return `<div class="notice info">남은 시간 30초에 글자 수 힌트가 공개됩니다.</div>`;
  }

  return `
    <div class="notice ${initialHint ? "warn hint-pop" : "info"}">
      <strong>힌트: ${countCatchmindLetters(round.word)}글자</strong>
      ${initialHint ? `<p>초성: ${escapeHtml(getKoreanInitials(round.word))}</p>` : ""}
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
          <strong>${escapeHtml(answer.name)}</strong>
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
  const correct = getCatchmindCorrectAnswers().length;
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

  try {
    await update(roomRef(state.roomCode), {
      "catchmind/settings": settings
    });
    showToast("캐치마인드 설정을 저장했습니다.", "success");
  } catch (error) {
    console.error(error);
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
    console.error(error);
    showToast("캐치마인드 게임을 시작하지 못했습니다.", "error");
  }
}

async function confirmCatchmindDrawerReady() {
  const round = getCurrentCatchmindRound();
  if (!round || !isCurrentCatchmindDrawer()) {
    showToast("현재 출제자만 준비 완료를 누를 수 있습니다.", "error");
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      "catchmind/currentRound/drawerReady": true,
      "catchmind/currentRound/drawerReadyAt": Date.now()
    });
    showToast("준비 완료를 선생님께 보냈습니다.", "success");
  } catch (error) {
    console.error(error);
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
    console.error(error);
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

  if (Date.now() > Number(round.roundEndsAt || 0)) {
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
      console.error(error);
    }
    renderCatchmindGuesser(true);
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
      renderCatchmindGuesser(true);
    }
  } catch (error) {
    console.error(error);
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
    console.error(error);
    showToast("라운드를 종료하지 못했습니다.", "error");
  }
}

async function nextCatchmindRound() {
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
      console.error(error);
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
    console.error(error);
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

  try {
    await update(roomRef(state.roomCode), {
      status: "waiting",
      catchmind: {
        settings: getCatchmindSettings()
      }
    });
    showToast("캐치마인드 설정 화면으로 돌아왔습니다.", "success");
  } catch (error) {
    console.error(error);
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
    totalRounds: clampInt(settings.totalRounds, 1, Math.max(1, words.length || savedWordList.length || 1), Math.min(DEFAULT_CATCHMIND_ROUNDS, Math.max(1, words.length || savedWordList.length || 1)))
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
  return getStudents().filter((student) => student.id !== round.drawerId).length;
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
  return Math.max(0, Math.ceil((Number(round.roundEndsAt) - Date.now()) / 1000));
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
    const remainingMs = Math.max(0, Number(round.roundEndsAt || Date.now()) - Date.now());
    const seconds = Math.ceil(remainingMs / 1000);
    textEl.textContent = `${seconds}초`;
    if (fillEl) {
      fillEl.style.width = `${Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))}%`;
    }
    if (hintEl) {
      hintEl.innerHTML = renderCatchmindHint(round, alreadyCorrect);
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
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
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
    lastFlushAt: 0
  };
  flushCatchmindStroke();
}

function moveCatchmindStroke(event, canvas) {
  if (!state.catchmindDrawing.active) {
    return;
  }
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
    console.error(error);
    showToast("그림 동기화에 실패했습니다.", "error");
  });
}

function setupCatchmindToolHandlers() {
  document.querySelectorAll("[data-catchmind-color]").forEach((button) => {
    button.addEventListener("click", () => {
      state.catchmindTool = "pen";
      state.catchmindColor = button.dataset.catchmindColor || "#111827";
      renderCatchmindDrawerCanvas(true);
    });
  });
  document.querySelectorAll("[data-catchmind-size]").forEach((button) => {
    button.addEventListener("click", () => {
      state.catchmindSize = Number(button.dataset.catchmindSize || 5);
      renderCatchmindDrawerCanvas(true);
    });
  });
  document.querySelector("[data-catchmind-tool='eraser']")?.addEventListener("click", () => {
    state.catchmindTool = "eraser";
    renderCatchmindDrawerCanvas(true);
  });
  document.querySelector("#catchmindUndoBtn")?.addEventListener("click", undoCatchmindStroke);
  document.querySelector("#catchmindClearBtn")?.addEventListener("click", clearCatchmindCanvas);
}

async function undoCatchmindStroke() {
  const round = getCurrentCatchmindRound();
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
  await update(roomRef(state.roomCode), {
    [`catchmind/rounds/${round.roundId}/strokes`]: null,
    [`catchmind/rounds/${round.roundId}/clearVersion`]: Date.now()
  });
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
      updatedAt: Number(value.updatedAt || 0)
    }))
    .filter((stroke) => stroke.points.length)
    .sort((a, b) => a.createdAt - b.createdAt || String(a.strokeId).localeCompare(String(b.strokeId)));
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

function getSeatOwnerStudent(seatNumber, game = getSeatGameState()) {
  const ownerId = game.assignments[getSeatKey(seatNumber)];
  return getStudents().find((student) => student.id === ownerId) || null;
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
      fillSelector: "#seatStudentCardTimerFill"
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
        onEnd: endSeatCardPhase
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
        setupSeatFinalRevealAnimation({ teacher: false });
      }
    }, force);
    return;
  }

  let title = "자리바꾸기 게임";
  let subtitle = "자리를 고르고, 카드를 사용하고, 마지막까지 내 자리를 지켜라!";
  let body = `
    <section class="panel seat-panel result-panel">
      <h1>게임을 준비 중입니다.</h1>
      <div class="stats"><div class="stat"><span class="muted">입장 학생</span><span class="num">${getStudents().length}</span></div></div>
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
    afterRender = () => setupSeatCardPhaseTimer({ textSelector: "#seatDisplayCardTimer", fillSelector: "#seatDisplayCardTimerFill" });
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
      setupSeatFinalRevealAnimation({ teacher: showTeacherControls });
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
          const owner = getStudents().find((student) => student.id === ownerId);
          const canClick = interactive ? !assigned : targetSet.has(seatNumber);
          const isSelectedTarget = selectedTargetSet.has(seatNumber);
          const revealIndex = revealOrder.indexOf(seatNumber);
          const revealedClass = revealAll ? "revealed" : "reveal-pending";
          const ownClass = highlightStudentId && ownerId === highlightStudentId ? "my-final-seat" : "";
          const dataAttribute = interactive ? `data-seat-select="${seatNumber}"` : targetSet.has(seatNumber) ? `data-seat-card-target="${seatNumber}"` : "";
          return `<button class="seat-tile ${assigned ? "assigned" : "available"} ${protectedSeat ? "protected" : ""} ${isSelectedTarget ? "selected-target" : ""} ${reveal ? revealedClass : ""} ${ownClass}" ${dataAttribute} ${canClick ? "" : "disabled"} type="button" ${reveal ? `data-seat-reveal-index="${Math.max(0, revealIndex)}"` : ""}>
            <span class="seat-number">${seatNumber}번</span>
            ${reveal ? `<strong class="seat-owner">${escapeHtml(owner?.name || "-")}</strong>` : `<strong>${assigned ? (protectedSeat ? "보호 · 선택 완료" : "선택 완료") : "선택 가능"}</strong>`}
          </button>`;
        }).join("")}
      </div>
    </section>
  `;
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
    <div class="seat-card-icon">${escapeHtml(definition.icon)}</div>
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
    </section>
  `, () => {
    document.querySelector("[data-action='reset']")?.addEventListener("click", resetGame);
    document.querySelector("[data-action='clear-room']")?.addEventListener("click", clearRoomLists);
  }, force);
}

// =========================
// 입장 및 제출
// =========================

async function enterStudent() {
  if (!db) {
    showToast("Firebase 설정값을 먼저 입력해 주세요.", "error");
    return;
  }

  const code = normalizeRoomCode(document.querySelector("#studentRoomCode").value);
  const name = cleanText(document.querySelector("#studentName").value);

  if (!code) {
    showToast("방 코드를 입력해 주세요.", "error");
    return;
  }

  if (!name) {
    showToast("이름을 입력해 주세요.", "error");
    return;
  }

  try {
    const snapshot = await get(roomRef(code));
    if (!snapshot.exists()) {
      showToast("아직 만들어지지 않은 방입니다. 방 코드를 다시 확인해 주세요.", "error");
      return;
    }

    state.role = "student";
    state.roomCode = code;
    state.studentName = name;
    state.studentId = getOrCreateStudentId();
    saveStudentSession();

    const roomData = snapshot.val() || {};
    const duplicateName = Object.entries(roomData.students || {}).some(([studentId, student]) => {
      return studentId !== state.studentId && cleanText(student?.name) === name;
    });
    const studentPath = ref(db, `rooms/${code}/students/${state.studentId}`);
    const existingStudent = (await get(studentPath)).val();

    await update(studentPath, {
      name,
      score: Number(existingStudent?.score || 0),
      connected: true,
      joinedAt: existingStudent?.joinedAt || serverTimestamp(),
      lastSeen: serverTimestamp()
    });

    onDisconnect(ref(db, `rooms/${code}/students/${state.studentId}/connected`)).set(false);
    onDisconnect(ref(db, `rooms/${code}/students/${state.studentId}/lastSeen`)).set(serverTimestamp());

    subscribeToRoom(code);
    if (duplicateName) {
      showToast("같은 이름으로 이미 입장한 학생이 있습니다. 필요하면 이름을 구분해서 입력해 주세요.", "error");
    }
  } catch (error) {
    console.error(error);
    showToast("입장 중 오류가 발생했습니다. 인터넷 연결과 방 코드를 확인해 주세요.", "error");
  }
}

async function enterTeacher() {
  if (!db) {
    showToast("Firebase 설정값을 먼저 입력해 주세요.", "error");
    return;
  }

  const password = document.querySelector("#teacherPassword").value;
  const codeInput = normalizeRoomCode(document.querySelector("#teacherRoomCode").value);
  const code = codeInput || generateRoomCode();
  const selectedMode = getSelectedTeacherMode();

  if (password !== TEACHER_PASSWORD) {
    showToast("관리자 비밀번호가 맞지 않습니다.", "error");
    return;
  }

  try {
    const snapshot = await get(roomRef(code));
    if (!snapshot.exists()) {
      await set(roomRef(code), {
        mode: selectedMode,
        status: "waiting",
        currentQuestionIndex: -1,
        currentComplimentIndex: -1,
        currentClueIndex: 0,
        timeLimit: DEFAULT_TIME_LIMIT_SECONDS,
        maxQuestionsPerStudent: MAX_QUESTIONS_PER_STUDENT,
        maxComplimentsPerStudent: MAX_COMPLIMENTS_PER_STUDENT,
        createdAt: serverTimestamp(),
        students: {},
        questions: {},
        compliments: {},
        answers: {},
        mafia: selectedMode === "mafia" ? getDefaultMafiaState() : null,
        liar: selectedMode === "liar" ? getInitialLiarStateForWrite() : null,
        catchmind: selectedMode === "catchmind" ? getInitialCatchmindStateForWrite() : null
      });
    } else {
      const room = snapshot.val();
      const roomMode = room.mode || "quiz";
      if ((room.status || "waiting") === "waiting" && roomMode !== selectedMode) {
        await update(roomRef(code), {
          mode: selectedMode,
          currentQuestionIndex: -1,
          currentComplimentIndex: -1,
          currentClueIndex: 0,
          questionOrder: null,
          complimentOrder: null,
          mafia: selectedMode === "mafia" ? getDefaultMafiaState() : null,
          liar: selectedMode === "liar" ? getInitialLiarStateForWrite() : null,
          catchmind: selectedMode === "catchmind" ? getInitialCatchmindStateForWrite() : null,
          answers: null,
          complimentAnswers: null,
          complimentBonuses: null
        });
      } else if (!room.mode) {
        await update(roomRef(code), { mode: "quiz" });
      }
    }

    state.role = "teacher";
    state.roomCode = code;
    localStorage.setItem("wbq_roomCode", code);
    subscribeToRoom(code);
  } catch (error) {
    console.error(error);
    showToast("교사 화면을 여는 중 오류가 발생했습니다.", "error");
  }
}

async function submitQuestion(event) {
  event.preventDefault();

  const name = cleanText(document.querySelector("#authorName").value);
  const question = cleanText(document.querySelector("#questionText").value);
  const choices = [0, 1, 2, 3].map((index) => cleanText(document.querySelector(`#choice${index}`).value));
  const correctInput = document.querySelector("input[name='correctIndex']:checked");
  const correctIndex = correctInput ? Number(correctInput.value) : -1;
  const editingQuestionId = cleanText(document.querySelector("#editingQuestionId")?.value || "");

  if (!name) {
    showToast("이름을 입력해 주세요.", "error");
    return;
  }

  if (!question) {
    showToast("문제를 입력해 주세요.", "error");
    return;
  }

  if (choices.some((choice) => !choice)) {
    showToast("선택지 4개를 모두 입력해 주세요.", "error");
    return;
  }

  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    showToast("정답 번호를 1~4 중에서 선택해 주세요.", "error");
    return;
  }

  try {
    const authorKey = nameToKey(name);
    const allQuestions = getQuestions();
    const editingQuestion = editingQuestionId
      ? allQuestions.find((item) => item.id === editingQuestionId)
      : null;
    const ownQuestionsForName = findQuestionsByAuthor(name);
    const ownQuestionsExcludingCurrent = ownQuestionsForName.filter((item) => item.id !== editingQuestionId);
    const maxQuestions = getMaxQuestionsPerStudent();

    if (editingQuestionId && !editingQuestion) {
      showToast("수정할 문제를 찾지 못했습니다. 대기 화면에서 다시 선택해 주세요.", "error");
      return;
    }

    if (!editingQuestionId && ownQuestionsExcludingCurrent.length >= maxQuestions) {
      showToast(`한 학생은 문제를 최대 ${maxQuestions}개까지 제출할 수 있습니다.`, "error");
      return;
    }

    const questionId = editingQuestionId || getNextQuestionId(authorKey);
    const questionPath = ref(db, `rooms/${state.roomCode}/questions/${questionId}`);
    const existing = (await get(questionPath)).val();

    state.studentName = name;
    saveStudentSession();

    await update(ref(db, `rooms/${state.roomCode}/students/${state.studentId}`), {
      name,
      connected: true,
      lastSeen: serverTimestamp()
    });

    await set(questionPath, {
      authorName: name,
      authorKey,
      question,
      choices,
      correctIndex,
      createdAt: existing?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    showToast("문제가 제출되었습니다.", "success");
    renderStudentWaiting(true);
  } catch (error) {
    console.error(error);
    showToast("문제를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
  }
}

async function submitCompliment(event) {
  event.preventDefault();

  const name = cleanText(document.querySelector("#complimentAuthorName").value);
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

  if (!name) {
    showToast("이름을 입력해 주세요.", "error");
    return;
  }

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

  try {
    const ownCompliments = findComplimentsByAuthor(state.studentId);
    const ownComplimentsExcludingCurrent = ownCompliments.filter((item) => item.id !== editingComplimentId);
    const maxCompliments = getMaxComplimentsPerStudent();

    if (!editingComplimentId && ownComplimentsExcludingCurrent.length >= maxCompliments) {
      showToast(`한 학생은 칭찬 카드를 최대 ${maxCompliments}개까지 제출할 수 있습니다.`, "error");
      return;
    }

    const complimentId = editingComplimentId || getNextComplimentId(state.studentId);
    const complimentPath = ref(db, `rooms/${state.roomCode}/compliments/${complimentId}`);
    const existing = (await get(complimentPath)).val();

    state.studentName = name;
    saveStudentSession();

    await update(ref(db, `rooms/${state.roomCode}/students/${state.studentId}`), {
      name,
      connected: true,
      lastSeen: serverTimestamp()
    });

    await set(complimentPath, {
      authorStudentId: state.studentId,
      authorName: name,
      targetStudentId,
      targetName: targetStudent.name,
      clues,
      createdAt: existing?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    showToast("칭찬 카드가 제출되었습니다.", "success");
    renderComplimentWaiting(true);
  } catch (error) {
    console.error(error);
    showToast("칭찬 카드를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
  }
}

async function submitMafiaNightAction(selectedStudentId) {
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
    console.error(error);
    showToast("밤 행동을 저장하지 못했습니다.", "error");
  }
}

async function submitMafiaVote(selectedStudentId) {
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
    console.error(error);
    showToast("투표를 저장하지 못했습니다.", "error");
  }
}

async function submitAnswer(selectedIndex) {
  if (state.answering) {
    return;
  }

  const questions = getQuestions();
  const question = questions[Number(state.room.currentQuestionIndex || 0)];
  if (!question || state.room.status !== "playing") {
    showToast("지금은 답을 제출할 수 없습니다.", "error");
    return;
  }

  const answerPath = ref(db, `rooms/${state.roomCode}/answers/${question.id}/${state.studentId}`);
  const existing = await get(answerPath);
  if (existing.exists()) {
    showToast("한 문제에는 한 번만 답할 수 있습니다.", "error");
    return;
  }

  const timeLimit = Number(state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS);
  const startedAt = Number(state.room.questionStartedAt || Date.now());
  const elapsedMs = Math.max(0, Date.now() - startedAt);
  const remainingSeconds = Math.max(0, timeLimit - elapsedMs / 1000);

  if (remainingSeconds <= 0) {
    showToast("시간이 끝났습니다. 선생님이 결과를 공개할 때까지 기다려 주세요.", "error");
    return;
  }

  const isOwnBlocked = !ALLOW_SOLVE_OWN_QUESTION && question.authorKey === nameToKey(state.studentName);
  const isCorrect = !isOwnBlocked && selectedIndex === question.correctIndex;
  const scoreEarned = isCorrect
    ? Math.round(500 + (remainingSeconds / timeLimit) * 500)
    : 0;

  const answerData = {
    name: state.studentName,
    selectedIndex,
    isCorrect,
    responseTime: Math.round((elapsedMs / 1000) * 10) / 10,
    scoreEarned,
    answeredAt: serverTimestamp()
  };

  state.answering = true;
  try {
    const result = await runTransaction(answerPath, (current) => current || answerData);
    if (result.committed) {
      if (scoreEarned > 0) {
        await runTransaction(ref(db, `rooms/${state.roomCode}/students/${state.studentId}/score`), (score) => {
          return Number(score || 0) + scoreEarned;
        });
      }
      showToast(isCorrect ? `${scoreEarned}점을 얻었습니다!` : "답변이 제출되었습니다.", isCorrect ? "success" : "");
      renderStudentQuiz(true);
    } else {
      showToast("이미 제출한 문제입니다.", "error");
    }
  } catch (error) {
    console.error(error);
    showToast("답변을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
  } finally {
    state.answering = false;
  }
}

async function submitComplimentTargetGuess(selectedStudentId) {
  const compliment = getCurrentCompliment();
  if (!compliment || state.room.status !== "playing") {
    showToast("지금은 칭찬 대상을 제출할 수 없습니다.", "error");
    return;
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
    console.error(error);
    showToast("추리 답변을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
  }
}

async function submitComplimentAuthorGuess(selectedStudentId) {
  const compliment = getCurrentCompliment();
  if (!compliment || state.room.status !== "authorGuess") {
    showToast("지금은 작성자 추리를 제출할 수 없습니다.", "error");
    return;
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
    console.error(error);
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
    console.error(error);
  }
}

// =========================
// 교사 액션
// =========================

function handleTeacherAction(action) {
  const actions = {
    start: startGame,
    "save-quiz-settings": saveQuizSettings,
    "restart-current": restartCurrentQuestion,
    reveal: () => revealAnswer(false),
    next: nextQuestion,
    finish: finishGame,
    reset: resetGame,
    "clear-room": clearRoomLists,
    "open-display": () => openDisplayWindow(),
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
    "catchmind-configure": configureCatchmindGame
  };
  actions[action]?.();
}

async function startGame() {
  const questions = getQuestions();
  if (!questions.length) {
    showToast("시작할 문제가 없습니다.", "error");
    return;
  }

  openDisplayWindow();

  const questionOrder = shuffleArray(questions.map((question) => question.id));
  const updates = {
    status: "playing",
    currentQuestionIndex: 0,
    questionOrder,
    timeLimit: DEFAULT_TIME_LIMIT_SECONDS,
    questionStartedAt: serverTimestamp(),
    resultOpenedAt: null,
    answers: null
  };

  getStudents().forEach((student) => {
    updates[`students/${student.id}/score`] = 0;
  });

  try {
    await update(roomRef(state.roomCode), updates);
    showToast("게임을 시작했습니다.", "success");
  } catch (error) {
    console.error(error);
    showToast("게임을 시작하지 못했습니다.", "error");
  }
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
    showToast("작성자를 공개하지 못했습니다.", "error");
  }
}

async function nextComplimentCard() {
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
    console.error(error);
    showToast("다음 칭찬 카드로 이동하지 못했습니다.", "error");
  }
}

async function saveQuizSettings() {
  const value = clampInt(document.querySelector("#maxQuestionsInput")?.value, 1, 10, getMaxQuestionsPerStudent());

  try {
    await update(roomRef(state.roomCode), {
      maxQuestionsPerStudent: value
    });
    showToast(`학생 1명당 문제 수를 최대 ${value}개로 저장했습니다.`, "success");
  } catch (error) {
    console.error(error);
    showToast("퀴즈 배틀 설정을 저장하지 못했습니다.", "error");
  }
}

async function saveComplimentSettings() {
  const value = clampInt(document.querySelector("#maxComplimentsInput")?.value, 1, 10, getMaxComplimentsPerStudent());

  try {
    await update(roomRef(state.roomCode), {
      maxComplimentsPerStudent: value
    });
    showToast(`학생 1명당 칭찬 카드 수를 최대 ${value}개로 저장했습니다.`, "success");
  } catch (error) {
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
    showToast("라이어게임을 시작하지 못했습니다.", "error");
  }
}

async function confirmLiarWord() {
  const assignment = getMyLiarAssignment();
  if (!assignment) {
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
    showToast("현재 문제로 이동하지 못했습니다.", "error");
  }
}

async function nextQuestion() {
  const questions = getQuestions();
  if (!questions.length) {
    return;
  }

  const nextIndex = Number(state.room.currentQuestionIndex || 0) + 1;
  if (nextIndex >= questions.length) {
    finishGame();
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      status: "playing",
      currentQuestionIndex: nextIndex,
      questionStartedAt: serverTimestamp(),
      resultOpenedAt: null
    });
  } catch (error) {
    console.error(error);
    showToast("다음 문제로 이동하지 못했습니다.", "error");
  }
}

async function revealAnswer(isAuto) {
  if (!state.room || state.room.status !== "playing") {
    return;
  }

  try {
    await update(roomRef(state.roomCode), {
      status: "result",
      resultOpenedAt: serverTimestamp()
    });
    if (!isAuto) {
      showToast("정답을 공개했습니다.", "success");
    }
  } catch (error) {
    console.error(error);
    showToast("정답 공개에 실패했습니다.", "error");
  }
}

async function finishGame() {
  try {
    await update(roomRef(state.roomCode), {
      status: "finished",
      finishedAt: serverTimestamp()
    });
    renderFinalResult("teacher-final", true, true);
  } catch (error) {
    console.error(error);
    showToast("최종 결과로 이동하지 못했습니다.", "error");
  }
}

async function resetGame() {
  const ok = window.confirm("점수와 답변을 지우고 대기 상태로 돌아갈까요? 제출된 문제와 학생 목록은 유지됩니다.");
  if (!ok) {
    return;
  }

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
    answers: null
  };

  getStudents().forEach((student) => {
    updates[`students/${student.id}/score`] = 0;
  });

  try {
    await update(roomRef(state.roomCode), updates);
    showToast("게임이 초기화되었습니다.", "success");
  } catch (error) {
    console.error(error);
    showToast("초기화하지 못했습니다.", "error");
  }
}

async function clearRoomLists() {
  const ok = window.confirm("학생 목록, 문제/칭찬 자료, 답변, 점수를 모두 지울까요? 이 작업은 되돌릴 수 없습니다.");
  if (!ok) {
    return;
  }

  const secondOk = window.confirm("정말 전체 초기화할까요? 새 반이나 새 수업을 시작할 때만 사용하세요.");
  if (!secondOk) {
    return;
  }

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
      questions: null,
      compliments: null,
      mafia: getDefaultMafiaState(),
      liar: getDefaultLiarState(),
      catchmind: getInitialCatchmindStateForWrite(),
      answers: null,
      complimentAnswers: null
    });
    showToast("학생 목록과 제출 자료를 모두 초기화했습니다.", "success");
  } catch (error) {
    console.error(error);
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

  try {
    await remove(ref(db, `rooms/${state.roomCode}/questions/${questionId}`));
    await remove(ref(db, `rooms/${state.roomCode}/answers/${questionId}`));
    showToast("문제를 삭제했습니다.", "success");
  } catch (error) {
    console.error(error);
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

  try {
    await remove(ref(db, `rooms/${state.roomCode}/compliments/${complimentId}`));
    await remove(ref(db, `rooms/${state.roomCode}/complimentAnswers/${complimentId}`));
    await remove(ref(db, `rooms/${state.roomCode}/complimentBonuses/target/${complimentId}`));
    showToast("칭찬 카드를 삭제했습니다.", "success");
  } catch (error) {
    console.error(error);
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
  if (!state.roomCode) {
    if (!silent) {
      showToast("방 코드가 있어야 교실 화면을 열 수 있습니다.", "error");
    }
    return null;
  }

  if (displayWindow && !displayWindow.closed) {
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

  displayWindow = window.open(
    url.toString(),
    `dm_playground_display_${state.roomCode}`,
    "popup=yes,width=1280,height=800,left=80,top=60"
  );

  if (displayWindow) {
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

  state.unsubscribeRoom = onValue(roomRef(code), (snapshot) => {
    state.room = snapshot.val();
    if (state.role === "display") {
      renderDisplayRoute(true);
      return;
    }
    if (state.role === "teacher") {
      if (state.room?.status === "finished") {
        if (getRoomMode() === "mafia") {
          renderMafiaFinalResult("teacher-mafia-final", true, true);
        } else if (getRoomMode() === "catchmind") {
          renderCatchmindFinalResult("teacher-catchmind-final", true, true);
        } else {
          renderFinalResult("teacher-final", true, true);
        }
      } else {
        renderTeacherDashboard(true);
      }
      return;
    }
    renderStudentRoute();
  }, (error) => {
    console.error(error);
    showToast("방 정보를 실시간으로 불러오지 못했습니다.", "error");
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
  return state.room?.mode || "quiz";
}

function getSelectedTeacherMode() {
  return document.querySelector("input[name='teacherMode']:checked")?.value || "quiz";
}

async function switchRoomMode(nextMode) {
  if (!["quiz", "compliment", "mafia", "liar", "catchmind"].includes(nextMode)) {
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
    await update(roomRef(state.roomCode), {
      mode: nextMode,
      currentQuestionIndex: -1,
      currentComplimentIndex: -1,
      currentClueIndex: 0,
      questionOrder: null,
      complimentOrder: null,
      mafia: nextMode === "mafia" ? getDefaultMafiaState() : null,
      liar: nextMode === "liar" ? getInitialLiarStateForWrite() : null,
      catchmind: nextMode === "catchmind" ? getInitialCatchmindStateForWrite() : null,
      answers: null,
      complimentAnswers: null,
      complimentBonuses: null
    });
    showToast(`${modeLabel(nextMode)} 모드로 바꿨습니다.`, "success");
  } catch (error) {
    console.error(error);
    showToast("게임 모드를 바꾸지 못했습니다. Firebase Rules에 새 게임 모드가 반영되었는지 확인해 주세요.", "error");
  }
}

function getQuestions() {
  const raw = state.room?.questions || {};
  const questions = Object.entries(raw)
    .map(([id, value]) => ({
      id,
      ...value,
      choices: normalizeChoices(value.choices),
      correctIndex: Number(value.correctIndex)
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
    .filter(([, value]) => cleanText(value?.name))
    .map(([id, value]) => ({
      id,
      name: value.name,
      score: Number(value.score || 0),
      connected: Boolean(value.connected),
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

  targetSelect.innerHTML = renderComplimentTargetOptionHtml(options, selectedId);
  targetSelect.value = selectedId;
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

function findQuestionByAuthor(name) {
  return findQuestionsByAuthor(name)[0] || null;
}

function findQuestionsByAuthor(name) {
  const key = nameToKey(name);
  return getQuestions().filter((question) => {
    return question.authorKey === key || question.id === key || question.id.startsWith(`${key}_`);
  });
}

function getMaxQuestionsPerStudent() {
  return clampInt(state.room?.maxQuestionsPerStudent, 1, 10, MAX_QUESTIONS_PER_STUDENT);
}

function getMaxComplimentsPerStudent() {
  return clampInt(state.room?.maxComplimentsPerStudent, 1, 10, MAX_COMPLIMENTS_PER_STUDENT);
}

function getNextQuestionId(authorKey) {
  const existingIds = new Set(getQuestions().map((question) => question.id));
  for (let index = 1; index <= getMaxQuestionsPerStudent(); index += 1) {
    const questionId = `${authorKey}_${index}`;
    if (!existingIds.has(questionId)) {
      return questionId;
    }
  }
  return `${authorKey}_${Date.now()}`;
}

function getNextComplimentId(studentId) {
  const existingIds = new Set(getCompliments().map((compliment) => compliment.id));
  for (let index = 1; index <= getMaxComplimentsPerStudent(); index += 1) {
    const complimentId = `${studentId}_${index}`;
    if (!existingIds.has(complimentId)) {
      return complimentId;
    }
  }
  return `${studentId}_${Date.now()}`;
}

function getCumulativeRanking() {
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
      connected: Boolean(roomStudents[id]?.connected),
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
        connected: Boolean(roomStudents[id]?.connected)
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

  Object.values(getLiarVotes()).forEach((vote) => {
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
    console.error(error);
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
    console.error(error);
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
    await set(ref(db, `rooms/${state.roomCode}/mafia/ghostChat/${messageId}`), {
      messageId,
      playerId: state.studentId,
      playerName: player.name || state.studentName,
      messageType: "user",
      content,
      createdAt: now,
      round: getMafiaRoundNumber()
    });
    scrollGhostChatToBottom({ focusInput: true });
  } catch (error) {
    console.error(error);
    state.ghostChatDraft = previousDraft;
    state.lastGhostChatAt = 0;
    if (document.querySelector("#ghostChatInput")) {
      document.querySelector("#ghostChatInput").value = previousDraft;
    }
    showToast("유령 채팅을 보내지 못했습니다.", "error");
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
    console.error(error);
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
    catchmind: "캐치마인드"
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
          <button class="btn success" data-action="ghost-confirm-bingo" type="button" ${canConfirm ? "" : "disabled"}>👻 이 빙고판으로 시작하기</button>
        </div>
        <div class="stack">
          <h3>조건 후보</h3>
          <div class="ghost-condition-grid">
            ${GHOST_BINGO_CONDITIONS.map((condition) => {
              const isSelected = selectedSet.has(condition.id);
              const isPlacing = state.selectedGhostBingoConditionId === condition.id;
              const disabled = !isSelected && selectedSet.size >= GHOST_BINGO_REQUIRED_CONDITIONS;
              return `
                <button class="ghost-condition-card ${isSelected ? "selected" : ""} ${isPlacing ? "placing" : ""}" data-ghost-condition="${escapeAttr(condition.id)}" type="button" ${disabled ? "disabled" : ""}>
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
        <p class="muted">확정 이후 실제 게임 기록으로 자동 체크됩니다.</p>
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
          <strong>${escapeHtml(ghost.name)}</strong>
          <span class="score">${ghost.bingoLines}빙고 · ${ghost.checkedCount}칸</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderGhostChatPanel({ teacher = false, ghost = null, allowSend = false } = {}) {
  const messages = getMafiaGhostChatMessages({ teacher, ghost });

  return `
    <div class="ghost-chat">
      <div class="ghost-chat-list" id="ghostChatList">
        ${messages.length ? messages.map((message) => `
          <article class="ghost-chat-message ${message.messageType === "system" ? "system" : ""}">
            <div class="ghost-chat-meta">
              <strong>${message.messageType === "system" ? "시스템" : `${escapeHtml(message.playerName || "이름 없음")} 👻`}</strong>
              <span>${formatClock(message.createdAt)}</span>
            </div>
            <p>${escapeHtml(message.content || "")}</p>
          </article>
        `).join("") : `<div class="empty">아직 유령 채팅이 없습니다.</div>`}
      </div>
      ${allowSend ? `
        <div class="ghost-chat-form">
          <input id="ghostChatInput" type="text" maxlength="${GHOST_CHAT_MAX_LENGTH}" placeholder="유령 채팅 입력" autocomplete="off" value="${escapeAttr(state.ghostChatDraft)}" ${state.ghostChatSending ? "disabled" : ""} />
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
    document.querySelector("[data-action='liar-reveal-answer']")?.addEventListener("click", revealLiarAnswer);
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
        <h1>이번 게임의 제시어</h1>
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
    document.querySelector("[data-action='liar-restart-same']")?.addEventListener("click", () => startLiarGame({ reuseSettings: true }));
    document.querySelector("[data-action='liar-configure']")?.addEventListener("click", configureLiarGame);
    document.querySelector("[data-action='reset']")?.addEventListener("click", resetGame);
  }, force);
}

function renderTeacherModeControls() {
  const mode = getRoomMode();
  const canSwitch = (state.room?.status || "waiting") === "waiting";

  return `
    <section class="mode-switcher">
      <p class="label">게임 모드</p>
      <div class="segmented">
        <button class="btn ${mode === "quiz" ? "primary" : "ghost"}" data-switch-mode="quiz" type="button" ${canSwitch ? "" : "disabled"}>퀴즈 배틀</button>
        <button class="btn ${mode === "compliment" ? "primary" : "ghost"}" data-switch-mode="compliment" type="button" ${canSwitch ? "" : "disabled"}>칭찬 스무고개</button>
        <button class="btn ${mode === "mafia" ? "primary" : "ghost"}" data-switch-mode="mafia" type="button" ${canSwitch ? "" : "disabled"}>교실 마피아</button>
        <button class="btn ${mode === "liar" ? "primary" : "ghost"}" data-switch-mode="liar" type="button" ${canSwitch ? "" : "disabled"}>라이어게임</button>
        <button class="btn ${mode === "catchmind" ? "primary" : "ghost"}" data-switch-mode="catchmind" type="button" ${canSwitch ? "" : "disabled"}>캐치마인드</button>
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

function renderStudentChoiceButtons(students, dataName, disabled = false) {
  if (!students.length) {
    return `<div class="empty">선택할 학생이 없습니다.</div>`;
  }

  return `
    <div class="student-choice-grid">
      ${students.map((student) => `
        <button class="student-choice-btn" data-${dataName}="${escapeAttr(student.id)}" type="button" ${disabled ? "disabled" : ""}>
          <strong>${escapeHtml(student.name)}</strong>
          ${student.connected ? `<span class="pill green">접속 중</span>` : `<span class="pill">대상 가능</span>`}
        </button>
      `).join("")}
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
    <div class="student-choice-grid">
      ${options.map((participant) => `
        <button class="student-choice-btn ${selectedId === participant.id ? "selected" : ""}" data-liar-vote-target="${escapeAttr(participant.id)}" type="button">
          <strong>${escapeHtml(participant.name)}</strong>
          <span class="pill ${selectedId === participant.id ? "green" : "blue"}">${selectedId === participant.id ? "선택됨" : "투표 대상"}</span>
        </button>
      `).join("")}
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
            <strong>${row.rank}위 ${escapeHtml(row.name)}</strong>
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
  return `
    <div class="question-card">
      <div class="status-bar">
        <span class="pill blue">${currentIndex + 1} / ${total}</span>
        <span class="pill ${statusPillClass(status)}">${statusLabel(status)}</span>
      </div>
      <h2>${escapeHtml(question.question)}</h2>
      <p class="muted">출제자: ${escapeHtml(question.authorName || "익명")}</p>
      ${status === "playing" ? `
        <div class="timer-wrap">
          <div class="timer-top">
            <span>남은 시간</span>
            <span id="teacherTimerText">${state.room.timeLimit || DEFAULT_TIME_LIMIT_SECONDS}초</span>
          </div>
          <div class="timer-track"><div id="teacherTimerFill" class="timer-fill"></div></div>
        </div>
      ` : ""}
      <ol class="list">
        ${choices.map((choice, index) => `
          <li class="list-row">
            <strong>${index + 1}. ${escapeHtml(choice)}</strong>
            ${status !== "playing" && index === question.correctIndex ? `<span class="pill green">정답</span>` : ""}
          </li>
        `).join("")}
      </ol>
      ${status === "result" ? `
        <div class="grid-2">
          <div>
            <h3>선택지별 응답 수</h3>
            ${renderAnswerBars(question)}
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
    return `<div class="empty">학생들이 문제를 제출하면 여기에 표시됩니다.</div>`;
  }

  return `
    <ul class="list">
      ${questions.map((question, index) => `
        <li class="list-row split">
          <button class="question-list-preview" data-view-question="${escapeAttr(question.id)}" type="button">
            <p class="muted small">${index + 1}. ${escapeHtml(question.authorName || "익명")}</p>
            <strong>${escapeHtml(question.question)}</strong>
            <p class="muted small">정답: ${question.correctIndex + 1}. ${escapeHtml(normalizeChoices(question.choices)[question.correctIndex] || "")}</p>
            <span class="muted small">클릭해서 전체 보기</span>
          </button>
          <button class="btn danger" data-delete-question="${escapeAttr(question.id)}" type="button" ${status === "waiting" ? "" : "disabled"}>삭제</button>
        </li>
      `).join("")}
    </ul>
  `;
}

function showTeacherQuestionDetail(questionId) {
  const question = getQuestions().find((item) => item.id === questionId);
  if (!question) {
    showToast("문제를 찾지 못했습니다.", "error");
    return;
  }

  closeTeacherQuestionDetail();
  const choices = normalizeChoices(question.choices);
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" data-question-modal>
      <section class="modal-panel">
        <div class="status-bar">
          <div>
            <p class="eyebrow">제출 문제 전체 보기</p>
            <h2>${escapeHtml(question.authorName || "익명")}의 문제</h2>
          </div>
          <button class="btn ghost" data-close-question-modal type="button">닫기</button>
        </div>

        <div class="question-detail">
          <div>
            <p class="muted small">문제</p>
            <h3>${escapeHtml(question.question)}</h3>
          </div>
          <ol class="list">
            ${choices.map((choice, index) => `
              <li class="list-row split">
                <strong>${index + 1}. ${escapeHtml(choice)}</strong>
                ${index === question.correctIndex ? `<span class="pill green">정답</span>` : ""}
              </li>
            `).join("")}
          </ol>
        </div>
      </section>
    </div>
  `);

  const modal = document.querySelector("[data-question-modal]");
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeTeacherQuestionDetail();
    }
  });
  document.querySelector("[data-close-question-modal]")?.addEventListener("click", closeTeacherQuestionDetail);
}

function closeTeacherQuestionDetail() {
  document.querySelector("[data-question-modal]")?.remove();
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
            <span><span class="dot ${student.connected ? "on" : ""}"></span> ${escapeHtml(student.name)}</span>
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

function renderRanking(rows, scoreField = "score") {
  if (!rows.length) {
    return `<div class="empty">아직 랭킹이 없습니다.</div>`;
  }

  return `
    <div class="ranking">
      ${rows.map((row, index) => `
        <div class="ranking-row rank-${index + 1}">
          <span class="rank-medal">${index + 1}</span>
          <strong>${escapeHtml(row.name || "이름 없음")}</strong>
          <span class="score">${Number(row[scoreField] || 0)}점</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPodium(student, place, className) {
  return `
    <div class="podium ${className}">
      <div class="podium-place">${place}위</div>
      <h2>${student ? escapeHtml(student.name) : "-"}</h2>
      <p class="score">${student ? Number(student.score || 0) : 0}점</p>
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

  clearTimer();
  state.activeView = viewName;
  appEl.innerHTML = html;
  if (typeof afterRender === "function") {
    afterRender();
  }
}

function startTimer({ startedAt, limit, textSelector, fillSelector, onEnd }) {
  clearTimer();

  const textEl = document.querySelector(textSelector);
  const fillEl = document.querySelector(fillSelector);
  if (!textEl || !fillEl) {
    return;
  }

  const started = Number(startedAt || Date.now());
  const totalMs = Number(limit || DEFAULT_TIME_LIMIT_SECONDS) * 1000;
  let didEnd = false;

  const tick = () => {
    const elapsed = Math.max(0, Date.now() - started);
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
  state.timerId = window.setInterval(tick, 250);
}

function clearTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
  }
  state.timerId = null;
}

function showToast(message, type = "") {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type}`;
  window.clearTimeout(state.toastId);
  state.toastId = window.setTimeout(() => {
    toastEl.className = "toast";
  }, 2600);
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

function getOrCreateStudentId() {
  const saved = localStorage.getItem("wbq_studentId");
  if (saved) {
    return saved;
  }
  const id = crypto.randomUUID ? crypto.randomUUID() : `student_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  localStorage.setItem("wbq_studentId", id);
  return id;
}

function saveStudentSession() {
  localStorage.setItem("wbq_roomCode", state.roomCode);
  localStorage.setItem("wbq_studentName", state.studentName);
  localStorage.setItem("wbq_studentId", state.studentId);
}

function statusLabel(status) {
  const labels = {
    waiting: "대기 중",
    ready: "라운드 준비",
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
