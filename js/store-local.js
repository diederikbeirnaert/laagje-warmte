// Lokale testmodus: bestellingen en instellingen in IndexedDB van deze browser.
// Zelfde functies als store-firebase.js, zodat de rest van de site niets merkt.

export const LOCAL_PASSWORD = 'admin';
const SESSION_KEY = 'lw-local-admin';

const open = () =>
  new Promise((res, rej) => {
    const req = indexedDB.open('laagje-warmte', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('kv', mode);
    const out = fn(t.objectStore('kv'));
    t.oncomplete = () => { db.close(); res(out?.result); };
    t.onerror = t.onabort = () => { db.close(); rej(t.error); };
  });
}
const kvGet = (key) => tx('readonly', (s) => s.get(key));
const kvSet = (key, val) => tx('readwrite', (s) => s.put(val, key));
const kvDel = (key) => tx('readwrite', (s) => s.delete(key));

// Wijzigingen ook doorgeven aan andere tabbladen (bv. shop in tab 1, admin in tab 2).
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('laagje-warmte') : null;
const watchers = new Set();
async function listOrders() {
  const all = await tx('readonly', (s) => s.getAll(IDBKeyRange.bound('order:', 'order:￿')));
  return (all || []).sort((a, b) => b.createdAt - a.createdAt);
}
async function notify(broadcast = true) {
  const list = await listOrders();
  watchers.forEach((cb) => cb(list));
  if (broadcast) channel?.postMessage('orders');
}
channel?.addEventListener('message', () => notify(false));

export async function loadConfig() {
  return { sizes: (await kvGet('config:sizes')) || null, shop: (await kvGet('config:shop')) || null };
}
export const saveSizes = (sizes) => kvSet('config:sizes', sizes);
export const saveShop = (shop) => kvSet('config:shop', shop);

export async function createOrder(order, image) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await kvSet(`image:${id}`, image);
  await kvSet(`order:${id}`, { ...order, id, createdAt: Date.now() });
  await notify();
  return id;
}

export function watchOrders(cb) {
  watchers.add(cb);
  listOrders().then(cb);
  return () => watchers.delete(cb);
}

export async function updateOrder(id, patch) {
  const cur = await kvGet(`order:${id}`);
  if (!cur) throw new Error('Bestelling niet gevonden');
  const next = { ...cur, ...patch };
  Object.keys(next).forEach((k) => next[k] == null && delete next[k]);
  await kvSet(`order:${id}`, next);
  await notify();
}

export async function deleteOrder(id) {
  await kvDel(`order:${id}`);
  await kvDel(`image:${id}`);
  await notify();
}

export const getImage = (id) => kvGet(`image:${id}`);

export async function login(email, password) {
  if (password !== LOCAL_PASSWORD) throw new Error('Wachtwoord klopt niet');
  localStorage.setItem(SESSION_KEY, email || 'admin@lokaal');
}
export async function logout() {
  localStorage.removeItem(SESSION_KEY);
}
export async function currentAdmin() {
  const email = localStorage.getItem(SESSION_KEY);
  return email ? { email, uid: 'lokaal', admin: true } : null;
}
