// Firebase-compatible memory transport. This module cannot open network connections.
const app = Object.freeze({ name: "playground-local-demo" });
const listeners = new Set();
let tree = Object.create(null);
let serial = 0;

export function memoryStorage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(String(key)) ?? null,
    setItem: (key, value) => data.set(String(key), String(value)),
    removeItem: (key) => data.delete(String(key)),
    clear: () => data.clear()
  };
}

const clone = (value) => value == null ? null : structuredClone(value);
const snap = (value) => ({ val: () => clone(value), exists: () => value != null });
function segments(path) {
  const keys = String(path ?? "").split("/").filter(Boolean);
  if (keys.some((key) => ["__proto__", "prototype", "constructor"].includes(key))) throw new TypeError("Invalid demo path");
  return keys;
}
function read(path) {
  return segments(path).reduce((value, key) => value?.[key], tree) ?? null;
}
function write(path, value) {
  const keys = segments(path);
  if (!keys.length) { tree = clone(value) || Object.create(null); return; }
  const key = keys.pop();
  const parent = keys.reduce((node, child) => node[child] ||= Object.create(null), tree);
  if (value == null) delete parent[key];
  else parent[key] = clone(value);
}
function notify() {
  for (const subscription of listeners) {
    const value = read(subscription.path);
    const signature = JSON.stringify(value);
    if (signature === subscription.signature) continue;
    subscription.signature = signature;
    queueMicrotask(() => { if (listeners.has(subscription)) subscription.callback(snap(value)); });
  }
}
export function resetDemo() {
  tree = { ".info": { connected: true, serverTimeOffset: 0 } };
  serial = 0;
}
resetDemo();

export const initializeApp = () => app;
export const getDatabase = () => app;
export const ref = (instance, path = "") => {
  if (instance !== app) throw new TypeError("Invalid demo database");
  return segments(path).join("/");
};
export async function get(path) { return snap(read(path)); }
export async function set(path, value) { write(path, value); notify(); }
export async function update(path, changes) {
  for (const [key, value] of Object.entries(changes)) write(`${path}/${key}`, value);
  notify();
}
export async function remove(path) { return set(path, null); }
export async function runTransaction(path, updater) {
  const value = updater(clone(read(path)));
  if (value === undefined) return { committed: false, snapshot: snap(read(path)) };
  await set(path, value);
  return { committed: true, snapshot: snap(value) };
}
export function onValue(path, callback) {
  const subscription = { path, callback };
  listeners.add(subscription);
  notify();
  return () => listeners.delete(subscription);
}
export function onDisconnect() { return { set: async () => {}, remove: async () => {}, cancel: async () => {} }; }
export const serverTimestamp = () => Date.now();
export const inMemoryPersistence = Object.freeze({});
export const initializeAuth = () => { throw new Error("Authentication is disabled in demo"); };
export const signInWithEmailAndPassword = initializeAuth;
export function demoKey() { return `demo-${++serial}`; }
