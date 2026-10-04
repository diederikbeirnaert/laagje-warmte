// Datalaag. Kiest zelf de juiste opslag:
//  - Firebase (Realtime Database + Auth) zodra js/firebase-config.js is ingevuld
//  - anders lokale testmodus: alles blijft in deze browser (IndexedDB)
import { firebaseConfig } from './firebase-config.js';

export const configured = !String(firebaseConfig.apiKey || '').startsWith('VUL');

const impl = await import(configured ? './store-firebase.js' : './store-local.js');

export const {
  loadConfig, // () → { sizes, shop } (of null-waarden als er nog niets is ingesteld)
  saveSizes, // (sizes: { id: { name, note, price, sort, active } })
  saveShop, // (shop)
  createOrder, // (order, imageDataUrl) → id
  watchOrders, // (cb(list)) → stop()
  updateOrder, // (id, patch)
  deleteOrder, // (id)
  getImage, // (id) → dataUrl
  login, // (email, wachtwoord)
  logout,
  currentAdmin, // () → { email, uid, admin } of null
} = impl;
