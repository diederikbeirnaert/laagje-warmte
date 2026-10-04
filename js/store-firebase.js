// Firebase-opslag (Realtime Database + Auth), geladen via de officiële CDN.
// Afbeeldingen staan apart onder /images, zodat de bestellijst licht blijft.
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {
  getDatabase, ref, get, set, update, remove, push, onValue, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export async function loadConfig() {
  const cfg = (await get(ref(db, 'config'))).val() || {};
  return { sizes: cfg.sizes || null, shop: cfg.shop || null };
}
export const saveSizes = (sizes) => set(ref(db, 'config/sizes'), sizes);
export const saveShop = (shop) => set(ref(db, 'config/shop'), shop);

export async function createOrder(order, image) {
  const id = push(ref(db, 'orders')).key;
  // Eerst de afbeelding: zo bestaat er nooit een bestelling zonder foto.
  await set(ref(db, `images/${id}`), image);
  await set(ref(db, `orders/${id}`), { ...order, createdAt: serverTimestamp() });
  return id;
}

export function watchOrders(cb) {
  return onValue(ref(db, 'orders'), (snap) => {
    const val = snap.val() || {};
    cb(Object.entries(val).map(([id, o]) => ({ ...o, id })).sort((a, b) => b.createdAt - a.createdAt));
  });
}

export const updateOrder = (id, patch) => update(ref(db, `orders/${id}`), patch);

export async function deleteOrder(id) {
  await remove(ref(db, `orders/${id}`));
  await remove(ref(db, `images/${id}`));
}

export const getImage = async (id) => (await get(ref(db, `images/${id}`))).val();

export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);

export async function currentAdmin() {
  const user = await new Promise((res) => { const stop = onAuthStateChanged(auth, (u) => { stop(); res(u); }); });
  if (!user) return null;
  let admin = false;
  try { admin = (await get(ref(db, `admins/${user.uid}`))).val() === true; } catch {}
  return { email: user.email, uid: user.uid, admin };
}
