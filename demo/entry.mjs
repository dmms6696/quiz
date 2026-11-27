import { memoryStorage, resetDemo } from "./runtime.mjs";

const labels = { quiz: "퀴즈 배틀", compliment: "칭찬 스무고개", mafia: "교실 마피아", liar: "라이어게임", catchmind: "캐치마인드", seat: "자리바꾸기", memory: "메모리 배틀", bingo: "개념 빙고", word: "초성 단어 챌린지" };
const picker = document.querySelector("#demoMode");
const role = document.querySelector("#demoRole");
const actor = document.querySelector("#demoActor");
const restart = document.querySelector("#demoRestart");
const status = document.querySelector("#demoStatus");
let current = "";
let busy = false;

function applyRole() {
  document.querySelector("#demoActorField").hidden = role.value !== "student";
  window.dispatchEvent(new CustomEvent("playground-demo-role", { detail: { role: role.value, id: actor.value } }));
}
async function load(mode) {
  if (!Object.hasOwn(labels, mode) || busy) return;
  busy = true;
  picker.disabled = role.disabled = actor.disabled = restart.disabled = true;
  status.hidden = false;
  status.textContent = "체험을 준비하고 있어요.";
  try {
    const response = await fetch(`./demo/fixtures/${mode}.json`, { credentials: "omit" });
    if (!response.ok) throw new Error("fixture");
    const fixture = await response.json();
    if (fixture.fixtureVersion !== 1 || fixture.mode !== mode || fixture.environment !== "local-demo-only" || fixture.allowProductionWrites !== false || fixture.recordResults !== false) throw new Error("fixture");
    await window.PlaygroundDemoMount(fixture, resetDemo);
    actor.replaceChildren(...fixture.participants.map(({ id, name }) => new Option(name, id)));
    role.value = "teacher";
    picker.value = mode;
    current = mode;
    applyRole();
    const url = new URL(location.href);
    url.searchParams.set("game", mode);
    history.replaceState(null, "", url);
    status.hidden = true;
  } catch {
    if (current) picker.value = current;
    status.textContent = "체험 자료를 불러오지 못했습니다. 다시 시도해 주세요.";
  } finally {
    picker.disabled = role.disabled = actor.disabled = restart.disabled = false;
    busy = false;
  }
}
try {
  for (const name of ["localStorage", "sessionStorage"]) Object.defineProperty(window, name, { value: memoryStorage(), configurable: false });
  await import("../app.js?v=1.0.0-rc.2-static");
  if (typeof window.PlaygroundDemoMount !== "function") throw new Error("local module");
  picker.replaceChildren(...Object.entries(labels).map(([mode, label]) => new Option(label, mode)));
  picker.addEventListener("change", () => load(picker.value));
  restart.addEventListener("click", () => { if (confirm("이 체험의 가상 진행 기록을 초기화할까요?")) load(picker.value); });
  role.addEventListener("change", applyRole);
  actor.addEventListener("change", applyRole);
  window.addEventListener("playground-demo-show-display", () => { role.value = "display"; applyRole(); });
  document.addEventListener("click", (event) => {
    if (event.target.closest("#backHomeBtn")) { event.preventDefault(); event.stopImmediatePropagation(); role.value = "teacher"; applyRole(); }
  }, true);
  const requested = new URLSearchParams(location.search).get("game");
  await load(Object.hasOwn(labels, requested) ? requested : "quiz");
} catch {
  picker.disabled = role.disabled = actor.disabled = restart.disabled = true;
  status.hidden = false;
  status.textContent = "격리 체험을 시작하지 못했습니다. 실제 방은 변경하지 않았습니다.";
}
