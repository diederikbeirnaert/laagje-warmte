// Gedeelde stukjes: helpers, standaardinstellingen, illustraties en iconen.
import { loadConfig } from './store.js';

export const BRAND = 'Laagje Warmte';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const eur = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' });
export const money = (n) => eur.format(Number(n) || 0);

export const fmtDate = (ts, withTime = true) =>
  ts ? new Date(ts).toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }) : '';

// 'Jan Van den Broeck' → 'jan-van-den-broeck' (voor bestandsnamen)
export const slug = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'klant';

/* ---------- Gestructureerde mededeling (Belgische OGM) ---------- */
// 10 willekeurige cijfers + 2 controlecijfers (modulo 97; 0 wordt 97).
export function newRef() {
  const buf = crypto.getRandomValues(new Uint8Array(10));
  const base = [...buf].map((b) => b % 10).join('');
  const check = Number(BigInt(base) % 97n) || 97;
  return base + String(check).padStart(2, '0');
}
export const fmtRef = (ref) => `+++${ref.slice(0, 3)}/${ref.slice(3, 7)}/${ref.slice(7)}+++`;

export const fmtIban = (iban) => String(iban || '').replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();

/* ---------- Instellingen ---------- */
export const DEFAULT_SIZES = {
  klein: { name: 'Klein', note: 'ongeveer 5 cm hoog', price: 5, sort: 0, active: true },
  gemiddeld: { name: 'Gemiddeld', note: 'ongeveer 10 cm hoog', price: 10, sort: 1, active: true },
  groot: { name: 'Groot', note: 'ongeveer 15 cm hoog', price: 15, sort: 2, active: true },
};
export const DEFAULT_SHOP = {
  open: true,
  closedMsg: 'We nemen momenteel geen nieuwe bestellingen aan.',
  iban: '',
  bic: '',
  beneficiary: '',
  payDays: 7,
  contact: '',
  senderName: '',
  senderStreet: '',
  senderZip: '',
  senderCity: '',
};

// Filamentkleuren waaruit de klant kiest. 'hex' is enkel voor het staaltje op het scherm.
export const COLORS = [
  { id: 'rood', name: 'Rood', hex: '#D22B2B' },
  { id: 'oranje', name: 'Oranje', hex: '#F47A1F' },
  { id: 'geel', name: 'Geel', hex: '#F7C917' },
  { id: 'groen', name: 'Groen', hex: '#2E9447' },
  { id: 'blauw', name: 'Blauw', hex: '#2563C9' },
  { id: 'paars', name: 'Paars', hex: '#7B3FA6' },
  { id: 'wit', name: 'Wit', hex: '#FFFFFF' },
  { id: 'zwart', name: 'Zwart', hex: '#1C1C1C' },
];
export const colorName = (id) => COLORS.find((c) => c.id === id)?.name || '';
export const colorHex = (id) => COLORS.find((c) => c.id === id)?.hex || 'transparent';

export const sizeList = (sizes) =>
  Object.entries(sizes || {}).map(([id, s]) => ({ id, ...s })).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

// → { sizes: [{ id, name, note, price, sort, active }], shop, seeded }
export async function getConfig() {
  const cfg = await loadConfig();
  return {
    sizes: sizeList(cfg.sizes || DEFAULT_SIZES),
    shop: { ...DEFAULT_SHOP, ...(cfg.shop || {}) },
    seeded: !!cfg.sizes,
  };
}

/* ---------- Meldingen ---------- */
let toastTimer;
export function toast(msg, kind = '') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

export function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/* ---------- Illustratie: een vlam die laagje per laagje geprint wordt ---------- */
const FLAME = 'M100 6C116 46 170 80 170 152c0 58-32 100-70 100S30 210 30 152c0-34 16-54 30-72 4 24 16 32 26 28-8-38 0-74 14-102z';
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const EMBER = [229, 57, 27];
const AMBER = [255, 197, 61];
let artId = 0;

function flameLayers(pitch, gap, animate) {
  const n = Math.ceil(246 / pitch);
  let out = '';
  for (let i = 0; i < n; i++) {
    const y = 252 - (i + 1) * pitch + gap;
    const [r, g, b] = mix(EMBER, AMBER, i / (n - 1));
    out += `<rect class="${animate ? 'ly' : ''}" x="20" y="${y}" width="160" height="${pitch - gap}" fill="rgb(${r},${g},${b})"${animate ? ` style="animation-delay:${(i * 0.17).toFixed(2)}s"` : ''}/>`;
  }
  return { svg: out, n };
}

export function logoMark() {
  const id = `fl${artId++}`;
  return `<svg class="logo-mark" viewBox="24 0 152 258" aria-hidden="true">
    <clipPath id="${id}"><path d="${FLAME}"/></clipPath>
    <g clip-path="url(#${id})">${flameLayers(31, 5, false).svg}</g></svg>`;
}

export function printArt() {
  const id = `fl${artId++}`;
  const { svg, n } = flameLayers(11, 2, true);
  return `<svg class="print-art" viewBox="0 0 200 276" role="img" aria-label="Een vlam die laagje per laagje geprint wordt" style="--layers:${n};--rise:${n * 11}px;--dur:${(n * 0.17).toFixed(2)}s">
    <clipPath id="${id}"><path d="${FLAME}"/></clipPath>
    <path d="${FLAME}" class="ghost"/>
    <g clip-path="url(#${id})">${svg}</g>
    <g class="nozzle"><g class="nozzle-sway">
      <path d="M100 218V-400" class="filament"/>
      <rect x="85" y="214" width="30" height="20" rx="3" class="block"/>
      <path d="M91 234h18l-6 14h-6z" class="tip"/>
    </g></g>
    <rect x="12" y="254" width="176" height="12" rx="3" class="bed"/>
    <path d="M30 260h8M52 260h8M74 260h8M96 260h8M118 260h8M140 260h8M162 260h8" class="bed-ticks"/>
  </svg>`;
}

// Blokje van n laagjes: toont hoe groot een formaat is tegenover de andere.
export function blockArt(layers) {
  const n = Math.max(1, Math.min(9, layers));
  let out = '';
  for (let i = 0; i < n; i++) {
    const [r, g, b] = mix(EMBER, AMBER, n === 1 ? 0.5 : i / (n - 1));
    out += `<rect x="${7 - Math.min(i, 3)}" y="${58 - (i + 1) * 6}" width="${26 + Math.min(i, 3) * 2}" height="4.4" rx="1.2" fill="rgb(${r},${g},${b})"/>`;
  }
  return `<svg class="block-art" viewBox="0 0 40 60" aria-hidden="true">${out}</svg>`;
}

/* ---------- Iconen (lijntekeningen, 24×24) ---------- */
const ico = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  orders: ico('<path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/>'),
  unpaid: ico('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  paid: ico('<circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.8 2.8L16 9.6"/>'),
  sizes: ico('<path d="M4 20V9M9 20V4M14 20v-8M19 20V7"/><path d="M2.5 20h19"/>'),
  export: ico('<path d="M12 4v11M7.5 11 12 15.5 16.5 11"/><path d="M4.5 16.5v3h15v-3"/>'),
  settings: ico('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  site: ico('<path d="M14 5h5v5M19 5l-8 8"/><path d="M11 6H5.5v12.5H18V13"/>'),
  back: ico('<path d="M14.5 6 8.5 12l6 6"/>'),
  zip: ico('<path d="M6 3.5h8.5L18 7v13.5H6z"/><path d="M11 4v2M11 8v2M11 12v2"/><rect x="9.5" y="15" width="3" height="3.5" rx=".6"/>'),
  label: ico('<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M7.5 9h6M7.5 12h9M7.5 15.5h2M11 15.5h1M14 15.5h2.5"/>'),
  pdf: ico('<path d="M6 3.5h8.5L18 7v13.5H6z"/><path d="M14 3.5V7.5h4M9 12h6M9 15.5h6"/>'),
  image: ico('<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3 3-2.5 5 4"/>'),
  trash: ico('<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10.5 10.5v5.5M13.5 10.5v5.5"/>'),
  plus: ico('<path d="M12 5v14M5 12h14"/>'),
  up: ico('<path d="m6.5 14.5 5.5-5.5 5.5 5.5"/>'),
  down: ico('<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>'),
  copy: ico('<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5v-3a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>'),
  upload: ico('<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5"/><path d="M4.5 16.5v3h15v-3"/>'),
  logout: ico('<path d="M10 4.5H5.5v15H10M14 8l4 4-4 4M18 12H9.5"/>'),
};
