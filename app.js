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

// 칭찬 스무고개 점수 설정입니다. 단서가 4개인 카드는 앞 4개 점수만 사용합니다.
const COMPLIMENT_TARGET_POINTS = [1000, 800, 600, 400, 200];
const COMPLIMENT_AUTHOR_BONUS = 300;
const COMPLIMENT_TARGET_BONUS = 200;

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
            <div class="field">
              <span class="label">게임 모드</span>
              <div class="mode-options">
                <label class="mode-tile">
                  <input type="radio" name="teacherMode" value="quiz" checked />
                  <span>
                    <strong>자기소개 퀴즈 배틀</strong>
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

function renderComplimentStudentRoute() {
  const status = state.room.status || "waiting";

  if (status === "waiting" || status === "collecting") {
    const ownCompliment = findComplimentByAuthor(state.studentId);
    if (state.activeView === "compliment-form") {
      const hasTargetOptions = getComplimentTargetOptions(ownCompliment).length > 0;
      const targetSelect = document.querySelector("#complimentTarget");
      if (!targetSelect?.disabled || !hasTargetOptions) {
        return;
      }
    }
    if (!ownCompliment) {
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
  const editingCompliment = existingCompliment || findComplimentByAuthor(state.studentId);
  const targetOptions = getComplimentTargetOptions(editingCompliment);
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
        </aside>

        <form id="complimentForm" class="panel">
          <div class="field">
            <label for="complimentAuthorName">내 이름</label>
            <input id="complimentAuthorName" maxlength="20" value="${escapeAttr(state.studentName)}" required />
          </div>

          <div class="field">
            <label for="complimentTarget">칭찬할 친구 선택</label>
            <select id="complimentTarget" required ${targetOptions.length ? "" : "disabled"}>
              <option value="">친구를 선택하세요</option>
              ${targetOptions.map((student) => `
                <option value="${escapeAttr(student.id)}" ${editingCompliment?.targetStudentId === student.id ? "selected" : ""}>${escapeHtml(student.name)}</option>
              `).join("")}
            </select>
            ${targetOptions.length ? "" : `<p class="muted small">다른 친구가 방에 입장하면 칭찬 대상을 선택할 수 있습니다.</p>`}
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
            <button class="btn primary" type="submit" ${targetOptions.length ? "" : "disabled"}>${editingCompliment ? "칭찬 카드 수정" : "칭찬 카드 제출"}</button>
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
  const ownCompliment = findComplimentByAuthor(state.studentId);

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
        ${ownCompliment ? `
          <div class="question-card">
            <p class="muted small">내가 작성한 칭찬 카드</p>
            <h3>${escapeHtml(ownCompliment.targetName)}에게 보내는 칭찬</h3>
            <ol class="list">
              ${normalizeComplimentClues(ownCompliment.clues).map((clue) => `<li class="list-row">${escapeHtml(clue)}</li>`).join("")}
            </ol>
            <button class="btn ghost" id="editComplimentBtn" type="button">칭찬 카드 수정하기</button>
          </div>
        ` : ""}
      </div>
    </section>
  `, () => {
    document.querySelector("#backHomeBtn").addEventListener("click", renderHome);
    document.querySelector("#editComplimentBtn")?.addEventListener("click", () => renderComplimentForm(ownCompliment));
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

  if (getRoomMode() === "compliment") {
    renderComplimentTeacherDashboard(force);
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
          ${renderTeacherModeControls()}
          <h2>진행 controls</h2>
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
          <h2>진행 controls</h2>
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
        createdAt: serverTimestamp(),
        students: {},
        questions: {},
        compliments: {},
        answers: {}
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

async function submitCompliment(event) {
  event.preventDefault();

  const name = cleanText(document.querySelector("#complimentAuthorName").value);
  const targetStudentId = cleanText(document.querySelector("#complimentTarget").value);
  const targetStudent = getStudents().find((student) => student.id === targetStudentId);
  const clues = [0, 1, 2, 3, 4]
    .map((index) => cleanText(document.querySelector(`#complimentClue${index}`).value))
    .filter(Boolean);

  if (!name) {
    showToast("이름을 입력해 주세요.", "error");
    return;
  }

  if (!targetStudentId || !targetStudent) {
    showToast("칭찬할 친구를 선택해 주세요.", "error");
    return;
  }

  if (targetStudentId === state.studentId) {
    showToast("자기 자신은 칭찬 대상으로 선택할 수 없습니다.", "error");
    return;
  }

  if (clues.length < 4) {
    showToast("칭찬 단서는 최소 4개 이상 입력해 주세요.", "error");
    return;
  }

  try {
    const complimentPath = ref(db, `rooms/${state.roomCode}/compliments/${state.studentId}`);
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
    "restart-current": restartCurrentQuestion,
    reveal: () => revealAnswer(false),
    next: nextQuestion,
    finish: finishGame,
    reset: resetGame,
    "clear-room": clearRoomLists,
    "start-compliment": startComplimentGame,
    "compliment-next-clue": showNextComplimentClue,
    "compliment-reveal-target": revealComplimentTarget,
    "compliment-author-guess": startComplimentAuthorGuess,
    "compliment-reveal-author": revealComplimentAuthor,
    "compliment-next-card": nextComplimentCard
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

async function startComplimentGame() {
  const compliments = getCompliments();
  if (!compliments.length) {
    showToast("시작할 칭찬 카드가 없습니다.", "error");
    return;
  }

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

function getRoomMode() {
  return state.room?.mode || "quiz";
}

function getSelectedTeacherMode() {
  return document.querySelector("input[name='teacherMode']:checked")?.value || "quiz";
}

async function switchRoomMode(nextMode) {
  if (!["quiz", "compliment"].includes(nextMode)) {
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
      answers: null,
      complimentAnswers: null,
      complimentBonuses: null
    });
    showToast(nextMode === "quiz" ? "자기소개 퀴즈 배틀 모드로 바꿨습니다." : "칭찬 스무고개 모드로 바꿨습니다.", "success");
  } catch (error) {
    console.error(error);
    showToast("게임 모드를 바꾸지 못했습니다.", "error");
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
  return getCompliments().find((compliment) => compliment.authorStudentId === studentId || compliment.id === studentId) || null;
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
  const options = getStudents().filter((student) => student.id !== state.studentId);
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

function renderTeacherModeControls() {
  const mode = getRoomMode();
  const canSwitch = (state.room?.status || "waiting") === "waiting";

  return `
    <section class="mode-switcher">
      <p class="label">게임 모드</p>
      <div class="segmented">
        <button class="btn ${mode === "quiz" ? "primary" : "ghost"}" data-switch-mode="quiz" type="button" ${canSwitch ? "" : "disabled"}>자기소개 퀴즈</button>
        <button class="btn ${mode === "compliment" ? "primary" : "ghost"}" data-switch-mode="compliment" type="button" ${canSwitch ? "" : "disabled"}>칭찬 스무고개</button>
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
    playing: "진행 중",
    result: "결과 공개",
    targetReveal: "칭찬 대상 공개",
    authorGuess: "작성자 추리",
    authorReveal: "작성자 공개",
    finished: "최종 결과"
  };
  return labels[status] || "대기 중";
}

function statusPillClass(status) {
  const classes = {
    waiting: "blue",
    playing: "green",
    result: "gold",
    targetReveal: "gold",
    authorGuess: "blue",
    authorReveal: "gold",
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
