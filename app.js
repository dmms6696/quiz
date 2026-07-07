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

// 학생 한 명이 제출할 수 있는 최대 문제 수입니다.
const MAX_QUESTIONS_PER_STUDENT = 3;

// false로 바꾸면 학생 본인이 낸 문제는 자동으로 0점 처리됩니다.
const ALLOW_SOLVE_OWN_QUESTION = true;

// 교사 화면이 열려 있을 때 시간이 끝나면 자동으로 정답 공개 상태로 바꿉니다.
const AUTO_REVEAL_WHEN_TIME_UP = true;

// =========================
// 앱 상태
// =========================

let firebaseApp = null;
let db = null;

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
  skipWriteKey: ""
};

const appEl = document.querySelector("#app");
const toastEl = document.querySelector("#toast");

if (isFirebaseConfigured()) {
  firebaseApp = initializeApp(firebaseConfig);
  db = getDatabase(firebaseApp);
}

renderHome();

// =========================
// 화면 렌더링
// =========================

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
        <p class="eyebrow">실시간 학급 참여 퀴즈</p>
        <h1>우리 반 퀴즈 배틀</h1>
        <p class="lead">학생들이 직접 낸 자기소개형 4지선다 문제를 모아, 교실에서 바로 진행하는 실시간 퀴즈 게임입니다.</p>
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
            <p class="muted">방 코드와 이름을 입력한 뒤 자기 문제를 제출합니다.</p>
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
  const canAddMoreQuestions = ownQuestions.length < MAX_QUESTIONS_PER_STUDENT;

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
              <p class="muted small">${ownQuestions.length} / ${MAX_QUESTIONS_PER_STUDENT}개 제출</p>
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

function renderTeacherDashboard(force = true) {
  if (!state.room) {
    setView("teacher-loading", `<section class="screen"><div class="panel"><h2>방 정보를 불러오는 중입니다.</h2></div></section>`);
    return;
  }

  const questions = getQuestions();
  const students = getStudents();
  const connectedCount = students.filter((student) => student.connected).length;
  const status = state.room.status || "waiting";
  const currentIndex = Number(state.room.currentQuestionIndex ?? -1);
  const currentQuestion = questions[currentIndex];

  setView("teacher-dashboard", `
    <section class="screen">
      <div class="status-bar">
        <div>
          <p class="eyebrow">교사 화면</p>
          <h1>우리 반 퀴즈 배틀</h1>
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
          <h2>진행 controls</h2>
          <div class="button-row">
            <button class="btn primary" data-action="start" type="button" ${questions.length ? "" : "disabled"}>게임 시작</button>
            <button class="btn dark" data-action="restart-current" type="button" ${currentQuestion ? "" : "disabled"}>현재 문제로 이동</button>
            <button class="btn warn" data-action="reveal" type="button" ${currentQuestion && status === "playing" ? "" : "disabled"}>정답 공개</button>
            <button class="btn success" data-action="next" type="button" ${questions.length ? "" : "disabled"}>다음 문제</button>
            <button class="btn ghost" data-action="finish" type="button" ${questions.length ? "" : "disabled"}>누적 랭킹 보기</button>
            <button class="btn danger" data-action="reset" type="button">게임 초기화</button>
            <button class="btn danger" data-action="clear-room" type="button">학생/문제 목록 초기화</button>
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
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleTeacherAction(button.dataset.action));
    });
    document.querySelectorAll("[data-delete-question]").forEach((button) => {
      button.addEventListener("click", () => deleteQuestion(button.dataset.deleteQuestion));
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
            <button class="btn danger" data-action="clear-room" type="button">학생/문제 목록 초기화</button>
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

  if (password !== TEACHER_PASSWORD) {
    showToast("관리자 비밀번호가 맞지 않습니다.", "error");
    return;
  }

  try {
    const snapshot = await get(roomRef(code));
    if (!snapshot.exists()) {
      await set(roomRef(code), {
        status: "waiting",
        currentQuestionIndex: -1,
        timeLimit: DEFAULT_TIME_LIMIT_SECONDS,
        createdAt: serverTimestamp(),
        students: {},
        questions: {},
        answers: {}
      });
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

    if (editingQuestionId && !editingQuestion) {
      showToast("수정할 문제를 찾지 못했습니다. 대기 화면에서 다시 선택해 주세요.", "error");
      return;
    }

    if (ownQuestionsExcludingCurrent.length >= MAX_QUESTIONS_PER_STUDENT) {
      showToast(`한 학생은 문제를 최대 ${MAX_QUESTIONS_PER_STUDENT}개까지 제출할 수 있습니다.`, "error");
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
    "restart-current": restartCurrentQuestion,
    reveal: () => revealAnswer(false),
    next: nextQuestion,
    finish: finishGame,
    reset: resetGame,
    "clear-room": clearRoomLists
  };
  actions[action]?.();
}

async function startGame() {
  const questions = getQuestions();
  if (!questions.length) {
    showToast("시작할 문제가 없습니다.", "error");
    return;
  }

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
    questionStartedAt: null,
    resultOpenedAt: null,
    finishedAt: null,
    questionOrder: null,
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
  const ok = window.confirm("학생 목록, 문제 목록, 답변, 점수를 모두 지울까요? 이 작업은 되돌릴 수 없습니다.");
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
      students: null,
      questions: null,
      answers: null
    });
    showToast("학생 목록과 문제 목록을 모두 초기화했습니다.", "success");
  } catch (error) {
    console.error(error);
    showToast("학생/문제 목록을 초기화하지 못했습니다.", "error");
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

async function copyRoomCode() {
  try {
    await navigator.clipboard.writeText(state.roomCode);
    showToast("방 코드가 복사되었습니다.", "success");
  } catch {
    showToast(`방 코드: ${state.roomCode}`);
  }
}

// =========================
// 구독 및 데이터 도우미
// =========================

function subscribeToRoom(code) {
  clearRoomSubscription();
  state.activeView = "";

  state.unsubscribeRoom = onValue(roomRef(code), (snapshot) => {
    state.room = snapshot.val();
    if (state.role === "teacher") {
      if (state.room?.status === "finished") {
        renderFinalResult("teacher-final", true, true);
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

function findQuestionByAuthor(name) {
  return findQuestionsByAuthor(name)[0] || null;
}

function findQuestionsByAuthor(name) {
  const key = nameToKey(name);
  return getQuestions().filter((question) => {
    return question.authorKey === key || question.id === key || question.id.startsWith(`${key}_`);
  });
}

function getNextQuestionId(authorKey) {
  const existingIds = new Set(getQuestions().map((question) => question.id));
  for (let index = 1; index <= MAX_QUESTIONS_PER_STUDENT; index += 1) {
    const questionId = `${authorKey}_${index}`;
    if (!existingIds.has(questionId)) {
      return questionId;
    }
  }
  return `${authorKey}_${Date.now()}`;
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

// =========================
// 렌더 조각
// =========================

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
          <div>
            <p class="muted small">${index + 1}. ${escapeHtml(question.authorName || "익명")}</p>
            <strong>${escapeHtml(question.question)}</strong>
            <p class="muted small">정답: ${question.correctIndex + 1}. ${escapeHtml(normalizeChoices(question.choices)[question.correctIndex] || "")}</p>
          </div>
          <button class="btn danger" data-delete-question="${escapeAttr(question.id)}" type="button" ${status === "waiting" ? "" : "disabled"}>삭제</button>
        </li>
      `).join("")}
    </ul>
  `;
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
    playing: "문제 진행 중",
    result: "결과 공개",
    finished: "최종 결과"
  };
  return labels[status] || "대기 중";
}

function statusPillClass(status) {
  const classes = {
    waiting: "blue",
    playing: "green",
    result: "gold",
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
