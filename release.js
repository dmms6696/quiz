(() => {
  "use strict";
  const BUILD = "1.0.0-rc.2-static";
  const PROTOCOL = 1;
  const SCHEMA = 1;
  const MODES = ["quiz", "compliment", "mafia", "liar", "catchmind", "seat", "memory", "bingo", "word"];
  const PREFS_KEY = "playground.release.preferences.v1";
  const LOG_KEY = "playground.release.errors.v1";
  const EVENTS = {
    "app-error": "작업 실패", "room-read": "방 정보 동기화 실패", "asset-load": "리소스 로딩 실패",
    "browser-error": "화면 실행 오류", "version-check": "버전 조회 실패", "version-mismatch": "호환되지 않는 버전",
    "storage-unavailable": "브라우저 저장 공간 사용 불가", "display-write": "교실 화면 설정 저장 실패", "preflight-read": "시작 전 방 조회 실패",
    "auth-error": "교사 인증 실패", "host-lock": "교사 제어 상태 확인 실패"
  };
  const GUIDES = {
    quiz: [
      ["정해진 개수만큼 4지선다 또는 주관식 문제를 제출해요.", "제한 시간 안에 문제마다 답을 한 번 제출해요. 빠른 정답일수록 점수가 높아요.", "정답이 공개되면 내 답과 획득 점수를 확인해요."],
      ["문제 개수·시간·본인 문제 풀이와 출제 순서를 저장하세요.", "제출 목록에서 문항과 정답을 확인하고 적절하지 않은 문항은 삭제할 수 있습니다.", "시작 후 정답 공개와 다음 문제를 진행하고 결과를 확인하세요."]
    ],
    compliment: [
      ["서로 다른 친구를 골라 칭찬 단서를 4개 이상 작성해요. 자신에게는 보낼 수 없어요.", "개인정보나 외모 평가 대신 친구의 친절한 행동이나 노력에 대해 써요.", "공개된 단서마다 칭찬 대상을 한 번 추리하고, 대상 공개 뒤 작성자를 맞혀요.", "내가 쓴 카드의 대상이나 작성자는 추리할 수 없어요."],
      ["제출된 단서를 확인하세요. 수업 도구의 자료·기록에서 친구별 카드 수를 확인할 수 있습니다.", "단서를 차례로 공개하고 대상을 밝힌 뒤 작성자 추리를 시작하세요.", "작성자 공개 후 다음 카드로 이동하고 최종 결과를 확인하세요."]
    ],
    mafia: [
      ["비밀 역할을 확인하고 다른 친구에게 보여 주지 않아요.", "밤에는 내 역할의 행동을 해요. 의사는 자기 자신도 보호할 수 있어요.", "낮에는 토론하고 살아 있는 친구에게 비밀 투표해요.", "탈락하면 유령 빙고와 유령 채팅에 참여해요. 생존자에게 비밀을 전하지 않아요."],
      ["인원에 맞춰 역할 수와 토론 시간을 저장하고 역할을 배정하세요.", "역할 확인 뒤 밤 행동을 열고 결과를 계산합니다. 발표하고 토론·투표를 진행하세요.", "탈락한 학생의 공개 정체는 마피아 또는 시민입니다. 경찰과 의사의 세부 역할은 공유하지 마세요.", "승리 조건을 확인한 뒤 종료하거나 다음 밤을 시작하세요."]
    ],
    liar: [
      ["내 제시어를 조용히 확인해요. 화면에서 라이어 여부를 알려 주지 않아요.", "제시어는 말하지 않고 특징을 설명해요.", "투표가 열리면 나를 제외한 친구 한 명을 선택해요.", "선생님이 투표 결과와 실제 제시어·정체를 공개해요."],
      ["서로 다른 제시어 두 개와 라이어 수를 설정하세요.", "학생들의 제시어 확인 여부를 보고 발언과 토론을 진행하세요.", "투표가 끝나면 결과를 먼저 보고, 필요한 시점에 정체와 제시어를 공개하세요."]
    ],
    catchmind: [
      ["그리는 학생은 받은 제시어를 문자 대신 그림으로 표현해요.", "맞히는 학생은 그림을 보고 정답을 입력해요. 그림이 바뀌어도 계속 입력할 수 있어요.", "공개되는 힌트를 활용하고 라운드 결과를 확인해요."],
      ["제시어 목록과 라운드 수, 시간을 설정하세요.", "출제자를 확인하고 라운드를 시작하세요. 그림과 정답 현황을 확인할 수 있습니다.", "결과 공개 후 다음 라운드로 넘어갑니다. 제시어를 미리 읽어 주지 마세요."]
    ],
    seat: [
      ["내 차례에 빈 자리 하나를 선택하고 확정해요.", "카드가 활성화된 경우 안내에 따라 받는 카드의 효과를 사용할 수 있어요.", "다른 학생의 자리는 최종 공개 때 함께 확인해요."],
      ["행·열과 사용하지 않을 자리를 설정하세요. 활성 좌석 수는 학생 수와 같아야 합니다.", "차례를 확인하고 학생이 자리를 선택하도록 안내하세요. 카드가 활성화되어 있으면 카드 턴도 진행합니다.", "모두 선택을 마치면 최종 배치를 공개하세요."]
    ],
    memory: [
      ["이미지가 준비되면 시작을 기다려요.", "공개되는 짧은 시간 동안 카드 위치를 기억해요.", "두 장씩 눌러 같은 그림을 찾아요. 서로 다르면 다시 뒤집혀요.", "모든 짝을 맞춘 뒤 선생님이 결과를 공개하면 시간을 확인해요."],
      ["보드 크기를 고르고 화면에 표시된 수만큼 사진을 추가하세요.", "카드 암기 시간을 설정하고 게임을 생성하세요. 시작 전 학생의 이미지 준비 상태를 확인하세요.", "완료 현황을 보고 종료·결과 공개를 진행하세요. 같은 이미지로 다시 열 수 있습니다."]
    ],
    bingo: [
      ["빈칸 없이 서로 다른 개념을 적어요. 교사 개념 목록이 충분하면 자동으로 채울 수 있어요.", "내 차례에는 개념을 말하고 뜻이나 예를 설명해요.", "설명이 승인되면 관련된 칸을 색칠해요. 잘못 칠한 칸은 다시 눌러 취소해요.", "한 줄 이상 완성하면 선생님에게 빙고 확인을 요청해요."],
      ["보드 크기와 필요한 경우 개념 목록을 설정하고, 제출된 보드를 확인하세요.", "학생의 개념 설명을 승인하거나 다시 설명하도록 요청하세요.", "학생의 색칠과 빙고 요청을 확인하세요. 잘못 칠한 칸은 교사 화면에서 취소할 수 있습니다."]
    ],
    word: [
      ["공개된 초성에 정확히 맞는 단어를 입력해요.", "검토 중에도 다음 단어를 계속 제출할 수 있어요. 이미 선점된 단어는 제출할 수 없어요.", "승인된 단어만 점수에 들어가요. 제출 목록에서 승인·반려 여부를 확인해요."],
      ["초성과 제한 시간을 저장하고 시작하세요.", "검토 목록에서 단어의 실제 의미와 초성 일치를 확인한 뒤 승인하거나 반려하세요.", "마감 후 남은 검토를 끝내고 결과를 공개하세요."]
    ]
  };
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const icon = (name) => `<img class="release-icon" src="./assets/redesign/final/icons/${name}.svg" alt="" width="20" height="20" />`;
  const control = (id, label, art, extra = "") => `<button class="btn ghost" type="button" data-release="${id}" ${extra}>${icon(art)}${label}</button>`;
  const root = document.documentElement;
  const demo = document.body?.dataset.demo === "true";
  let ctx = {};
  let manifest = null;
  let manifestStatus = "unchecked";
  let checking = null;
  let appBuild = "";
  let checkedAt = 0;
  let connection = null;
  let lastSync = 0;
  let assetFailures = 0;
  let storageOk = null;
  let errors = [];
  let host = null;
  let activityUpdate = null;
  let activeDialog;

  function stored(key, fallback) {
    if (demo) return fallback;
    try { const value = JSON.parse(localStorage.getItem(key)); storageOk = true; return value ?? fallback; }
    catch { storageOk = false; return fallback; }
  }
  function store(key, value) {
    if (demo) return false;
    try { localStorage.setItem(key, JSON.stringify(value)); storageOk = true; return true; }
    catch { storageOk = false; return false; }
  }
  function prefs() {
    const value = stored(PREFS_KEY, {});
    return {
      favorites: MODES.filter((id) => Array.isArray(value.favorites) && value.favorites.includes(id)),
      reduceMotion: value.reduceMotion === true, hideIntro: value.hideIntro === true
    };
  }
  function savePrefs(values) {
    const ok = store(PREFS_KEY, values);
    root.dataset.releaseMotion = values.reduceMotion ? "reduced" : "system";
    return ok;
  }
  function eventEntries(input, now = Date.now()) {
    if (!Array.isArray(input)) return [];
    return input.filter((line) => line && Object.hasOwn(EVENTS, line.code) && Number.isFinite(line.time) && line.time <= now && line.time >= now - 604800000)
      .slice(-100).map((line) => ({ time: line.time, code: line.code, mode: MODES.includes(line.mode) ? line.mode : "", build: BUILD, protocol: PROTOCOL }));
  }
  function record(code) {
    if (demo || !Object.hasOwn(EVENTS, code)) return;
    const time = Date.now();
    const last = errors.at(-1);
    if (last?.code === code && time - last.time < 1500) return;
    errors = eventEntries([...errors, { code, time, mode: ctx.mode }], time);
    store(LOG_KEY, errors);
  }
  function wallpaper({ role, mode, view = "", status = "", covered, ghost, overlay }) {
    if (overlay === "library") return "library";
    if (overlay === "control") return "control";
    if (view.includes("error") || view.includes("missing") || view.startsWith("room-")) return null;
    if (!role || role === "home") return "home";
    if (role === "teacher") return "control";
    if (role === "display" && (covered || status === "finished")) return "stage";
    if (role === "student" && (view.startsWith("student-question") || view.startsWith("compliment-form") || view.startsWith("student-bingo-form"))) return "studio";
    if (view === "display-awards") return "stage";
    if (view.includes("waiting") || view.includes("loading") || view.includes("reconnecting") || ["waiting", "collecting", "memoryReady"].includes(status)) return "lobby";
    if (mode === "mafia") return role === "student" && ghost ? "mafia-ghost" : status === "night" || status === "nightAction" ? "mafia-night" : "mafia-day";
    return MODES.includes(mode) ? mode : role === "display" ? "stage" : "home";
  }
  function refreshWallpaper() {
    const pane = document.querySelector("#uxLibraryPane");
    const overlay = activeDialog?.open && ["guide", "launch"].includes(activeDialog.dataset.kind) ? "library"
      : pane && !pane.hidden && document.querySelector("#uxHostDialog[open]") ? "library"
        : document.querySelector("#teacherEntryDialog[open]") ? "control"
          : document.querySelector("#avatarPicker[open]") ? "lobby" : "";
    const next = overlay === "lobby" ? "lobby" : wallpaper({ ...ctx, overlay });
    if (next) root.dataset.wallpaper = next;
  }
  function setContext(next) {
    ctx = next;
    refreshWallpaper();
    const role = { teacher: "교사", student: "학생", display: "교실 화면" }[ctx.role];
    document.title = role ? `${ctx.title} · ${role} · ${ctx.phaseLabel || ""} | PLAYGROUND` : "동명중학교 PLAYGROUND";
    if (ctx.role !== "teacher" || demo) releaseHost();
  }
  function roomCompatible(room) {
    const protocol = Number(room?.protocolVersion ?? PROTOCOL);
    const schema = Number(room?.schemaVersion ?? SCHEMA);
    return protocol === PROTOCOL && schema === SCHEMA;
  }
  function clientMismatch() {
    const htmlBuild = document.querySelector('meta[name="playground-build"]')?.content;
    const cssBuild = getComputedStyle(root).getPropertyValue("--pg-release-build").trim();
    return Boolean((htmlBuild && htmlBuild !== BUILD) || (cssBuild && cssBuild !== BUILD) || (appBuild && appBuild !== BUILD)
      || (manifest && (!manifest.compatibleProtocols.includes(PROTOCOL) || !manifest.compatibleSchemas.includes(SCHEMA) || manifest.minimumProtocol > PROTOCOL)));
  }
  async function checkVersion(force = false) {
    if (demo) return "current";
    if (checking) return checking;
    if (!force && checkedAt && Date.now() - checkedAt < 60000) return manifestStatus;
    checking = (async () => {
      const timeout = new AbortController();
      const id = setTimeout(() => timeout.abort(), 2200);
      try {
        const response = await fetch("./release.json", { cache: "no-store", signal: timeout.signal });
        if (!response.ok) throw new Error("manifest");
        const data = await response.json();
        if (!data || typeof data.buildId !== "string" || !Array.isArray(data.compatibleProtocols) || !Array.isArray(data.compatibleSchemas)) throw new Error("manifest");
        manifest = data;
        manifestStatus = clientMismatch() ? "incompatible" : data.buildId === BUILD ? "current" : "update";
        if (manifestStatus === "incompatible") record("version-mismatch");
      } catch {
        manifestStatus = clientMismatch() ? "incompatible" : "unknown";
        record("version-check");
      } finally { checkedAt = Date.now(); clearTimeout(id); }
      updateHostBadge();
      return manifestStatus;
    })();
    try { return await checking; }
    finally { checking = null; }
  }
  async function canJoin() {
    return (await checkVersion()) !== "incompatible" && !clientMismatch();
  }
  function bindHost(roomCode) {
    if (demo || host?.roomCode === roomCode) return;
    releaseHost();
    host = { roomCode, state: navigator.locks?.request ? "checking" : "unavailable", release: null };
    if (host.state === "checking") attemptHost();
  }
  function attemptHost() {
    const lease = host;
    if (!lease || !navigator.locks?.request || lease.state === "owner" || lease.pending) return;
    lease.pending = true;
    lease.state = "checking";
    updateHostBadge();
    navigator.locks.request(`playground.classroom.host.${lease.roomCode}`, { ifAvailable: true }, (lock) => {
      if (host !== lease) return;
      lease.pending = false;
      lease.state = lock ? "owner" : "readonly";
      updateHostBadge();
      if (lock) return new Promise((resolve) => { lease.release = resolve; });
    }).catch(() => {
      if (host === lease) { lease.state = "unavailable"; lease.pending = false; updateHostBadge(); }
      record("host-lock");
    });
  }
  function releaseHost() {
    if (!host) return;
    const old = host;
    host = null;
    old.release?.();
  }
  function canOperate() {
    return demo || !host || !["checking", "readonly"].includes(host.state);
  }
  function updateHostBadge() {
    const badge = document.querySelector("[data-release-host]");
    if (!badge) return;
    const label = ({ checking: "창 확인 중", owner: "이 브라우저의 진행 창", readonly: "다른 탭이 진행 중 · 보기 전용", unavailable: "창 제어 상태 미확인" })[host?.state] || "";
    badge.hidden = !label && manifestStatus !== "update";
    badge.querySelector("span").textContent = [label, manifestStatus === "update" ? "수업 후 새 버전 확인" : ""].filter(Boolean).join(" · ");
    badge.querySelector("button").hidden = host?.state !== "readonly";
  }
  function renderPreflight(start) {
    const details = ctx.genChecks?.();
    if (!details || !start) return;
    const count = (level) => details.filter((check) => check.level === level).length;
    const label = count("required") ? `필수 ${count("required")}건 확인` : count("warn") ? `권장 ${count("warn")}건 확인` : "준비 완료";
    const anchor = start.parentElement?.classList.contains("button-row") ? start.parentElement : start;
    anchor.insertAdjacentHTML("afterend", `<details class="release-preflight" data-level="${count("required") ? "required" : count("warn") ? "warn" : "ok"}">
      <summary>${icon("preflight")}시작 전 점검 · ${label}</summary>
      <ul>${details.map((item) => `<li>${{ required: "필수", warn: "권장", ok: "확인" }[item.level]}: ${escape(item.text)}</li>`).join("")}</ul></details>`);
  }
  const startSelector = ['start','start-compliment','mafia-assign','liar-start','catchmind-start-game','seat-start','memory-create','memory-start','bingo-start','word-start'].map((name) => `[data-action="${name}"]`).join(",");
  function decorate() {
    const content = document.querySelector("#app > .screen");
    if (!content) return;
    if (!ctx.role && !demo) {
      content.insertAdjacentHTML("afterbegin", `<nav class="release-home-tools" aria-label="게임 안내">${control("launch","교사용 체험","demo")}</nav>`);
    } else if (ctx.role === "student" || ctx.role === "teacher") {
      const anchor = content.querySelector(":scope > .ux-host-strip, :scope > .status-bar:first-child");
      const guide = control("guide", ctx.role === "teacher" ? "운영 가이드" : "도움말", "guide");
      const tools = `<nav class="release-controls" aria-label="수업 보조 도구">${ctx.role === "student" && ctx.status === "waiting" && !prefs().hideIntro ? guide.replace("btn ghost", "btn release-guide-entry") : guide}
        ${ctx.role === "teacher" && !demo ? control("support","운영 설정","diagnostics") : ""}
        ${ctx.role === "teacher" && !demo ? control("activity","수업 타이머","class-timer") : ""}
        <output data-release-activity hidden></output></nav>`;
      if (anchor) anchor.insertAdjacentHTML("afterend", tools);
      else content.insertAdjacentHTML("afterbegin", tools);
      if (ctx.role === "teacher") {
        content.querySelector(".release-controls").insertAdjacentHTML("afterend", `<div class="release-controls release-badge" data-release-host hidden><span></span>${control("acquire","진행 창 확인","host-control","hidden")}</div>`);
        if (["waiting", "memoryReady"].includes(ctx.status)) renderPreflight(content.querySelector(startSelector));
        updateHostBadge();
      }
    }
    tickActivity();
  }
  function activityKey() { return ctx.roomCode && ctx.role === "teacher" ? `playground.activity.${ctx.roomCode}` : ""; }
  function getActivity() {
    const key = activityKey();
    const value = key && stored(key, null);
    return Number.isFinite(value?.ends) && value.ends > Date.now() - 43200000 && value.ends <= Date.now() + 43200000 ? value : null;
  }
  function tickActivity() {
    const value = getActivity();
    const seconds = value ? Math.max(0, Math.ceil((value.ends - Date.now()) / 1000)) : 0;
    const remaining = value ? seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "수업 타이머 종료" : "";
    const chip = document.querySelector("[data-release-activity]");
    if (chip) { chip.hidden = !value; if (chip.textContent !== remaining) chip.textContent = remaining; }
    const count = activeDialog?.querySelector("#releaseTimerRemaining");
    if (count && count.textContent !== remaining) count.textContent = remaining;
    if (value && value.warnFive && !value.warningSent && seconds > 0 && seconds <= 300 && store(activityKey(), { ...value, warningSent: true })) ctx.notice?.("수업 활동 시간이 5분 남았습니다.");
    if (value && !value.notified && !seconds && store(activityKey(), { ...value, notified: true })) ctx.notice?.("수업 타이머가 끝났습니다. 게임은 계속 진행됩니다.");
    if (value && !activityUpdate) activityUpdate = window.setInterval(tickActivity, 1000);
    if (!value && activityUpdate) { window.clearInterval(activityUpdate); activityUpdate = null; }
  }
  function dialog() {
    if (activeDialog) return activeDialog;
    activeDialog = document.createElement("dialog");
    activeDialog.className = "release-dialog";
    activeDialog.setAttribute("aria-labelledby", "releaseDialogTitle");
    document.body.append(activeDialog);
    activeDialog.addEventListener("close", () => {
      refreshWallpaper();
      if (!activeDialog.opener?.isConnected) document.querySelector(`[data-release="${activeDialog.dataset.kind}"]`)?.focus({ preventScroll: true });
    });
    return activeDialog;
  }
  function open(kind, origin) {
    const panel = dialog();
    if (!panel.open) panel.opener = origin;
    const title = ({ guide: ctx.role === "teacher" ? "교사용 운영 가이드" : "게임 도움말", launch: "교사용 체험", support: "운영 설정", activity: "수업 타이머", diagnostics: "시스템 진단" })[kind];
    if (!title) return;
    panel.dataset.kind = kind;
    panel.innerHTML = `<header><h2 id="releaseDialogTitle">${title}</h2><button class="btn ghost" data-release="close" type="button">닫기</button></header><div class="release-body">${bodyFor(kind)}</div>`;
    if (!panel.open) panel.showModal();
    refreshWallpaper();
    tickActivity();
  }
  function phaseText() {
    return connection === true ? "연결됨" : connection === false ? "연결 끊김" : "미확인";
  }
  function diagnostics() {
    return {
      build: BUILD, protocol: PROTOCOL, schema: SCHEMA, version: manifestStatus,
      assetBundle: clientMismatch() ? "mismatch" : "local",
      connection: connection === true ? "connected" : connection === false ? "disconnected" : "unknown",
      auth: ctx.auth ? "signed-in" : "unknown", hostWindow: host?.state || "unknown",
      lastSyncSeconds: lastSync ? Math.max(0, Math.round((Date.now() - lastSync) / 1000)) : null,
      assetFailures, storage: storageOk === true ? "available" : storageOk === false ? "unavailable" : "unknown",
      errors: eventEntries(errors).map((line) => ({ ...line, timestamp: new Date(line.time).toISOString() }))
    };
  }
  function bodyFor(kind) {
    const p = prefs();
    if (kind === "guide") {
      const details = GUIDES[ctx.mode]?.[ctx.role === "teacher" ? 1 : 0] || [];
      return `<h3>${escape(ctx.title)}</h3>${ctx.guideNote ? `<p>${escape(ctx.guideNote)}</p>` : ""}<ol class="release-steps">${details.map((step) => `<li>${step}</li>`).join("")}</ol>
        ${ctx.role === "student" ? `<p>연결이 끊겼다면 같은 기기에서 이어서 참여하세요.</p>
          ${demo ? "" : `<label class="check-line"><input type="checkbox" data-release-pref="hideIntro" ${p.hideIntro ? "checked" : ""} /> 대기 화면에서 도움말 강조 끄기</label>`}`
          : '<p>수업 중 학생 화면의 비밀 정보는 전광판에 공유하지 마세요.</p>'}`;
    }
    if (kind === "launch") return `<div class="release-favorites">${[...p.favorites, ...MODES.filter((mode) => !p.favorites.includes(mode))].map((mode) => `<a class="btn ghost" href="./demo.html?game=${mode}" target="_blank" rel="noopener">${escape(ctx.label(mode))}</a>`).join("")}</div><p>체험은 새 탭에서 열리며, 방과 수업 기록은 바뀌지 않습니다.</p>`;
    if (kind === "activity") return `<p>게임 시간과 별개이며, 시간이 끝나도 게임은 계속됩니다.</p>
      <div class="field"><label for="releaseActivityMinutes">활동 시간 (분)</label><input id="releaseActivityMinutes" type="number" min="1" max="120" value="10" /></div>
      <label class="check-line"><input type="checkbox" id="releaseWarnFive" /> 5분 전에 한 번 알림</label>
      <p><strong id="releaseTimerRemaining"></strong></p><div class="button-row">${control("timer-start","타이머 시작","class-timer")}${control("timer-reset","타이머 지우기","class-timer")}</div><p data-release-message role="status"></p>`;
    if (kind === "diagnostics") {
      const data = diagnostics();
      const version = ({ current: "최신 확인", update: "새 버전 있음", incompatible: "호환되지 않음", unknown: "조회 실패", unchecked: "미확인" })[data.version];
      return `<dl class="release-data"><dt>Firebase 연결</dt><dd>${phaseText()}</dd><dt>브라우저 네트워크</dt><dd>${navigator.onLine ? "온라인 신호" : "오프라인 신호"}</dd>
        <dt>교사 인증</dt><dd>${ctx.auth ? "로그인됨" : "미확인"}</dd><dt>동기화</dt><dd>${data.lastSyncSeconds == null ? "응답 미확인" : `${data.lastSyncSeconds}초 전 방 응답`}</dd>
        <dt>버전</dt><dd>${BUILD} · 프로토콜 ${PROTOCOL} · ${version}</dd><dt>리소스 실패</dt><dd>${assetFailures}건</dd>
        <dt>저장 공간</dt><dd>${data.storage === "available" ? "사용 가능" : data.storage === "unavailable" ? "사용 불가" : "미확인"}</dd></dl>
        <details><summary>최근 오류 (${data.errors.length}건)</summary><ul class="release-steps">${data.errors.length ? [...data.errors].reverse().slice(0, 15).map((line) => `<li>${escape(new Date(line.time).toLocaleTimeString("ko-KR"))} · ${EVENTS[line.code]}</li>`).join("") : "<li>기록 없음</li>"}</ul></details>
        <div class="button-row">${control("diagnostic-refresh","다시 확인","diagnostics")}${control("diagnostic-copy","진단 복사","diagnostics")}${control("diagnostic-clear","오류 기록 지우기","diagnostics")}</div><p data-release-message role="status"></p>`;
    }
    return `<div class="button-row">${control("cover",ctx.covered ? "교실 화면 다시 표시" : "교실 화면 가리기","screen-cover")}
      ${ctx.canHideFinal ? control("score",ctx.hideFinal ? "교실 화면 최종 순위 표시" : "교실 화면 최종 순위 숨기기","screen-cover") : ""}
      ${control("diagnostics","시스템 진단","diagnostics")}${control("launch","교사용 체험","demo")}</div>
      <p class="muted small">교실 화면 설정은 학생 화면과 채점을 바꾸지 않습니다.</p>
      <label class="check-line"><input type="checkbox" data-release-pref="reduceMotion" ${p.reduceMotion ? "checked" : ""} /> 이 기기에서 움직임 줄이기</label>
      <div><strong>즐겨찾는 게임</strong><div class="release-favorites">${MODES.map((mode) => `<button class="btn ${p.favorites.includes(mode) ? "primary" : "ghost"}" type="button" data-release="favorite" data-mode="${mode}" aria-pressed="${p.favorites.includes(mode)}">${icon("favorite")}${escape(ctx.label(mode))}</button>`).join("")}</div></div>
      <div class="button-row">${control("pref-reset","이 기기의 환경설정 초기화","diagnostics")}</div><p data-release-message role="status"></p>`;
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-release]");
    const id = button?.dataset.release;
    if (!id) { queueMicrotask(refreshWallpaper); return; }
    if (["guide","launch","support","activity","diagnostics"].includes(id)) { open(id, button); return; }
    if (id === "close") { activeDialog?.close(); return; }
    if (id === "acquire") { attemptHost(); return; }
    if (ctx.role !== "teacher" || demo || !activeDialog?.open) return;
    const announce = (message) => { const element = activeDialog.querySelector("[data-release-message]"); if (element) element.textContent = message; };
    if (id === "cover" || id === "score") {
      if (!canOperate()) { announce("진행 중인 창에서 교실 화면 설정을 바꿔 주세요."); return; }
      button.disabled = true;
      const ok = await ctx.command?.(id);
      if (activeDialog.open && activeDialog.dataset.kind === "support") {
        if (ok) { open("support"); activeDialog.querySelector(`[data-release="${id}"]`)?.focus(); }
        else { button.disabled = false; announce("설정을 저장하지 못했습니다. 연결과 진행 창을 확인해 주세요."); }
      }
    }
    if (id === "favorite" && MODES.includes(button.dataset.mode)) {
      const settings = prefs();
      const mode = button.dataset.mode;
      settings.favorites = settings.favorites.includes(mode) ? settings.favorites.filter((item) => item !== mode) : [...settings.favorites, mode];
      if (savePrefs(settings)) {
        const selected = settings.favorites.includes(mode);
        button.setAttribute("aria-pressed", String(selected));
        button.classList.toggle("primary", selected); button.classList.toggle("ghost", !selected);
      } else announce("환경설정을 저장할 수 없습니다.");
    }
    if (id === "pref-reset") { savePrefs({}); open("support"); announce("이 기기의 환경설정을 초기화했습니다."); }
    if (id === "timer-start") {
      const minutes = Number(activeDialog.querySelector("#releaseActivityMinutes")?.value);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) { announce("1~120분을 입력해 주세요."); return; }
      const warnFive = minutes > 5 && activeDialog.querySelector("#releaseWarnFive").checked;
      if (!store(activityKey(), { ends: Date.now() + minutes * 60000, warnFive })) announce("타이머를 저장할 수 없습니다.");
      tickActivity();
    }
    if (id === "timer-reset") { store(activityKey(), null); tickActivity(); }
    if (id === "diagnostic-refresh") { await checkVersion(true); if (activeDialog.open && activeDialog.dataset.kind === "diagnostics") open("diagnostics"); }
    if (id === "diagnostic-copy") {
      try { await navigator.clipboard.writeText(JSON.stringify(diagnostics(), null, 2)); announce("진단 정보를 복사했습니다."); }
      catch { announce("복사 권한을 확인해 주세요."); }
    }
    if (id === "diagnostic-clear") { errors = []; store(LOG_KEY, []); open("diagnostics"); announce("오류 기록을 지웠습니다."); }
  });
  document.addEventListener("change", (event) => {
    if (ctx.role === "teacher" && event.target.matches("[data-release-pref=reduceMotion]")) savePrefs({ ...prefs(), reduceMotion: event.target.checked });
    if (ctx.role === "student" && event.target.matches("[data-release-pref=hideIntro]")) {
      savePrefs({ ...prefs(), hideIntro: event.target.checked });
      const button = document.querySelector(".release-controls [data-release=guide]");
      const highlighted = ctx.status === "waiting" && !event.target.checked;
      button?.classList.toggle("release-guide-entry", highlighted);
      button?.classList.toggle("ghost", !highlighted);
    }
  });
  document.addEventListener("close", refreshWallpaper, true);
  document.addEventListener("error", (event) => {
    if (event.target?.tagName === "IMG" || event.target?.tagName === "LINK") { assetFailures += 1; record("asset-load"); }
  }, true);
  window.addEventListener("error", (event) => { if (event.target === window) record("browser-error"); });
  window.addEventListener("unhandledrejection", () => record("browser-error"));
  window.addEventListener("pagehide", releaseHost);
  window.addEventListener("pageshow", (event) => { if (event.persisted && ctx.role === "teacher") bindHost(ctx.roomCode); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkVersion(); });

  const previousErrors = stored(LOG_KEY, []);
  errors = eventEntries(previousErrors);
  if (Array.isArray(previousErrors) && previousErrors.length) store(LOG_KEY, errors);
  root.dataset.releaseMotion = prefs().reduceMotion ? "reduced" : "system";
  window.PlaygroundRelease = {
    BUILD, PROTOCOL, SCHEMA, icon, wallpaper, setContext, decorate, refreshWallpaper, roomCompatible, canJoin, checkVersion,
    record, bindHost, canOperate, favorites: () => prefs().favorites, noteSync: () => { lastSync = Date.now(); },
    setAppBuild: (value) => { appBuild = value; },
    noteConnection: (value) => { connection = typeof value === "boolean" ? value : null; },
    isDemo: demo
  };
})();
