// Adminpaneel: startscherm met grote app-knoppen, bestellingen, formaten, export en instellingen.
import {
  $, $$, esc, uid, money, fmtDate, fmtRef, fmtIban, toast, BRAND, ICON, logoMark, getConfig, sizeList, DEFAULT_SIZES,
} from './common.js';
import {
  configured, currentAdmin, login, logout, watchOrders, updateOrder, deleteOrder, getImage, saveSizes, saveShop,
} from './store.js';
import {
  downloadZip, downloadImage, orderPdf, labelPdf, openPdf, exportOrders, statusLabel, STATUSES,
} from './docs.js';

const app = $('#app');
let me;
let cfg;
let orders = null; // null = nog aan het laden
let query = '';
const images = new Map();

const FILTERS = {
  alle: { label: 'Alle', test: () => true },
  onbetaald: { label: 'Onbetaald', test: (o) => !o.paid },
  betaald: { label: 'Betaald', test: (o) => !!o.paid },
};
const count = (f) => (orders || []).filter(FILTERS[f].test).length;
const sum = (list) => list.reduce((t, o) => t + (Number(o.price) || 0), 0);

init();

async function init() {
  try {
    me = await currentAdmin();
  } catch {
    me = null;
  }
  if (!me) return renderLogin();
  if (!me.admin) return renderNoAccess();

  cfg = await getConfig();
  // Eerste keer met Firebase: zet de standaardformaten in de database,
  // want de databaseregels controleren de prijs van elke bestelling daartegen.
  if (configured && !cfg.seeded) await saveSizes(DEFAULT_SIZES).catch(() => {});

  watchOrders((list) => {
    orders = list;
    onOrdersChanged();
  });
  window.addEventListener('hashchange', route);
  route();
}

/* ---------- Inloggen ---------- */
function renderLogin() {
  app.innerHTML = `
    <div class="login">
      <a class="brand" href="index.html">${logoMark()}<span>${BRAND}</span></a>
      <form class="panel" id="lf">
        <h1>Beheer</h1>
        <div class="field"><label for="em">E-mailadres</label>
          <input id="em" type="email" autocomplete="username" ${configured ? 'required' : ''}></div>
        <div class="field"><label for="pw">Wachtwoord</label>
          <input id="pw" type="password" autocomplete="current-password" required></div>
        <p class="err" id="lerr" hidden></p>
        <button class="btn big full">Inloggen</button>
        ${configured ? '' : `<p class="hint">Lokale testmodus: het wachtwoord is <code>admin</code>. Het e-mailadres mag je leeg laten.</p>`}
      </form>
    </div>`;
  $(configured ? '#em' : '#pw').focus();
  $('#lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#lf button');
    btn.disabled = true;
    try {
      await login($('#em').value.trim(), $('#pw').value);
      location.reload();
    } catch {
      btn.disabled = false;
      $('#lerr').hidden = false;
      $('#lerr').textContent = 'E-mailadres of wachtwoord klopt niet.';
    }
  });
}

function renderNoAccess() {
  app.innerHTML = `
    <div class="login">
      <div class="panel">
        <h1>Nog geen toegang</h1>
        <p>Je bent ingelogd als <strong>${esc(me.email)}</strong>, maar dit account is nog geen beheerder.</p>
        <p>Voeg in Firebase onder <em>Realtime Database → Data</em> dit toe en herlaad de pagina:</p>
        <p><code>admins → ${esc(me.uid)} : true</code></p>
        <button class="btn ghost full" id="out">Uitloggen</button>
      </div>
    </div>`;
  $('#out').addEventListener('click', async () => { await logout(); location.reload(); });
}

/* ---------- Kader en routes ---------- */
function shell(title, body, { wide = false } = {}) {
  app.innerHTML = `
    <header class="adm-bar">
      <a class="brand" href="#/">${logoMark()}<span>${BRAND}</span></a>
      ${title ? `<a class="adm-home" href="#/">${ICON.back}<span>Alle apps</span></a>` : ''}
      <span class="adm-user">${esc(me.email)}</span>
      <button class="iconbtn light" id="logout" title="Uitloggen" aria-label="Uitloggen">${ICON.logout}</button>
    </header>
    ${configured ? '' : `<p class="testbar">Lokale testmodus: alles blijft enkel in deze browser bewaard. Vul <code>js/firebase-config.js</code> in om online te gaan.</p>`}
    <div class="adm-body ${wide ? 'wide' : ''}">
      ${title ? `<h1 class="adm-title">${title}</h1>` : ''}
      ${body}
    </div>`;
  $('#logout').addEventListener('click', async () => { await logout(); location.reload(); });
}

let current = { path: '/', params: new URLSearchParams() };
function route() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  current = { path, params: new URLSearchParams(qs || '') };
  window.scrollTo(0, 0);
  if (path === '/') return renderHome();
  if (path === '/bestellingen') return renderOrders();
  if (path.startsWith('/bestelling/')) return renderDetail(path.split('/')[2]);
  if (path === '/formaten') return renderSizes();
  if (path === '/export') return renderExport();
  if (path === '/instellingen') return renderSettings();
  location.hash = '#/';
}

// Nieuwe gegevens binnen: alleen schermen bijwerken die bestellingen tonen
// (formulieren met niet-bewaarde invoer blijven ongemoeid).
function onOrdersChanged() {
  const { path } = current;
  if (path === '/') renderHome();
  else if (path === '/bestellingen') paintOrders();
  else if (path.startsWith('/bestelling/')) renderDetail(path.split('/')[2]);
  else if (path === '/export') renderExport();
}

/* ---------- Startscherm ---------- */
function renderHome() {
  const list = orders || [];
  const unpaid = list.filter((o) => !o.paid);
  const paid = list.filter((o) => o.paid);
  const tile = (href, icon, label, tone, badge, ext) => `
    <a class="app" href="${href}" ${ext ? 'target="_blank" rel="noopener"' : ''}>
      <span class="app-icon ${tone}">${icon}${badge ? `<b class="badge">${badge}</b>` : ''}</span>
      <span class="app-label">${label}</span>
    </a>`;
  shell('', `
    <section class="stats">
      <div><span>Bestellingen</span><strong>${orders ? list.length : '…'}</strong></div>
      <div><span>Nog te betalen</span><strong>${orders ? money(sum(unpaid)) : '…'}</strong><em>${unpaid.length} ${unpaid.length === 1 ? 'bestelling' : 'bestellingen'}</em></div>
      <div><span>Ontvangen</span><strong>${orders ? money(sum(paid)) : '…'}</strong><em>${paid.length} ${paid.length === 1 ? 'bestelling' : 'bestellingen'}</em></div>
    </section>
    <nav class="apps" aria-label="Onderdelen">
      ${tile('#/bestellingen', ICON.orders, 'Bestellingen', 't-ember', list.length || '')}
      ${tile('#/bestellingen?f=onbetaald', ICON.unpaid, 'Onbetaald', 't-amber', unpaid.length || '')}
      ${tile('#/bestellingen?f=betaald', ICON.paid, 'Betaald', 't-green', paid.length || '')}
      ${tile('#/formaten', ICON.sizes, 'Formaten en prijzen', 't-teal')}
      ${tile('#/export', ICON.export, 'Exporteren', 't-cream')}
      ${tile('#/instellingen', ICON.settings, 'Instellingen', 't-ink')}
      ${tile('index.html', ICON.site, 'Website bekijken', 't-paper', '', true)}
    </nav>`);
}

/* ---------- Bestellingen ---------- */
const activeFilter = () => (FILTERS[current.params.get('f')] ? current.params.get('f') : 'alle');

function visibleOrders() {
  const f = activeFilter();
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  return (orders || []).filter(FILTERS[f].test).filter((o) =>
    !q || [o.name, o.email, o.city, o.zip].some((v) => String(v || '').toLowerCase().includes(q)) || (digits.length >= 3 && o.ref.includes(digits)));
}

function renderOrders() {
  shell('Bestellingen', `
    <div class="toolbar">
      <div class="seg" id="seg"></div>
      <input type="search" id="q" placeholder="Zoek op naam, mededeling, e-mail of gemeente" value="${esc(query)}" aria-label="Zoeken">
      <button class="btn" id="exp">${ICON.export} Exporteer deze lijst</button>
    </div>
    <div class="olist" id="olist"></div>`, { wide: true });

  $('#q').addEventListener('input', (e) => { query = e.target.value; paintOrders(); });
  $('#exp').addEventListener('click', () => {
    const list = visibleOrders();
    if (!list.length) return toast('Er is niets om te exporteren.', 'bad');
    exportOrders(list, activeFilter());
  });

  $('#olist').addEventListener('change', async (e) => {
    const id = e.target.dataset.paid;
    if (id) await setPaid(id, e.target.checked);
  });
  $('#olist').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-zip]');
    if (btn) await zipFor(btn.dataset.zip, btn);
  });
  paintOrders();
}

function paintOrders() {
  if (!$('#olist')) return;
  const f = activeFilter();
  $('#seg').innerHTML = Object.entries(FILTERS).map(([key, { label }]) =>
    `<a href="#/bestellingen${key === 'alle' ? '' : `?f=${key}`}" class="${key === f ? 'on' : ''}">${label} <b>${count(key)}</b></a>`).join('');

  const list = visibleOrders();
  if (!orders) return void ($('#olist').innerHTML = `<p class="empty">Bestellingen laden…</p>`);
  if (!list.length) {
    return void ($('#olist').innerHTML = `<p class="empty">${query ? 'Geen bestellingen gevonden voor deze zoekopdracht.' : f === 'alle' ? 'Er zijn nog geen bestellingen.' : `Geen ${FILTERS[f].label.toLowerCase()}e bestellingen.`}</p>`);
  }
  $('#olist').innerHTML = list.map((o) => `
    <div class="orow ${o.paid ? 'is-paid' : ''}">
      <a class="orow-main" href="#/bestelling/${esc(o.id)}">
        <img class="thumb" src="${esc(o.thumb || '')}" alt="" loading="lazy">
        <span class="o-who"><strong>${esc(o.name)}</strong><small>${esc(o.zip || '')} ${esc(o.city || '')}</small></span>
        <span class="o-ref"><span class="mono">${fmtRef(o.ref)}</span><small>${fmtDate(o.createdAt)}</small></span>
        <span class="o-size">${esc(o.sizeName)}${o.status && o.status !== 'nieuw' ? `<small>${statusLabel(o.status)}</small>` : ''}</span>
        <span class="o-price">${money(o.price)}</span>
      </a>
      <label class="switch" title="Betaald aan- of uitzetten">
        <input type="checkbox" data-paid="${esc(o.id)}" ${o.paid ? 'checked' : ''}>
        <span class="track"></span><span class="switch-text">${o.paid ? 'Betaald' : 'Onbetaald'}</span>
      </label>
      <button class="iconbtn" data-zip="${esc(o.id)}" title="Zip downloaden" aria-label="Zip downloaden van ${esc(o.name)}">${ICON.zip}</button>
    </div>`).join('');
}

async function setPaid(id, paid) {
  try {
    await updateOrder(id, { paid, paidAt: paid ? Date.now() : null });
    toast(paid ? 'Aangeduid als betaald' : 'Terug op onbetaald gezet');
  } catch (err) {
    console.error(err);
    toast('Bewaren lukte niet. Probeer het opnieuw.', 'bad');
    onOrdersChanged();
  }
}

async function imageFor(id) {
  if (!images.has(id)) images.set(id, await getImage(id));
  return images.get(id);
}

async function zipFor(id, btn) {
  const order = orders.find((o) => o.id === id);
  if (!order) return;
  btn.disabled = true;
  try {
    const image = await imageFor(id);
    if (!image) toast('De afbeelding van deze bestelling ontbreekt; de zip bevat enkel de pdf’s.', 'bad');
    await downloadZip(order, image, cfg.shop);
  } catch (err) {
    console.error(err);
    toast('De zip maken lukte niet.', 'bad');
  }
  btn.disabled = false;
}

/* ---------- Eén bestelling ---------- */
function renderDetail(id) {
  if (!orders) return shell('Bestelling', `<p class="empty">Laden…</p>`);
  const o = orders.find((x) => x.id === id);
  if (!o) return shell('Bestelling', `<p class="empty">Deze bestelling bestaat niet (meer). <a href="#/bestellingen">Terug naar de lijst</a></p>`);

  const row = (label, value) => (value ? `<div><dt>${label}</dt><dd>${value}</dd></div>` : '');
  shell(esc(o.name), `
    <a class="crumb" href="#/bestellingen">${ICON.back} Bestellingen</a>
    <div class="detail">
      <div class="detail-img">
        <div class="frame" id="frame"><p class="empty">Afbeelding laden…</p></div>
        <button class="btn ghost full" id="dl-img" disabled>${ICON.image} Afbeelding downloaden</button>
      </div>
      <div class="detail-info">
        <div class="paybox ${o.paid ? 'is-paid' : ''}">
          <div>
            <span class="mono">${fmtRef(o.ref)}</span>
            <strong>${money(o.price)}</strong>
            <small>${o.paid ? `Betaald${o.paidAt ? ` op ${fmtDate(o.paidAt, false)}` : ''}` : 'Nog niet betaald'}</small>
          </div>
          <label class="switch big">
            <input type="checkbox" id="paid" ${o.paid ? 'checked' : ''}>
            <span class="track"></span><span class="switch-text">Betaald</span>
          </label>
        </div>

        <dl class="info">
          ${row('Besteld op', fmtDate(o.createdAt))}
          ${row('Formaat', `${esc(o.sizeName)}${o.sizeNote ? ` <small>(${esc(o.sizeNote)})</small>` : ''}`)}
          ${row('E-mail', `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>`)}
          ${row('Telefoon', esc(o.phone))}
          ${row('Adres', `${esc(o.street)}${o.box ? ` bus ${esc(o.box)}` : ''}<br>${esc(o.zip)} ${esc(o.city)}${o.country ? `<br>${esc(o.country)}` : ''}`)}
          ${row('Opmerking', esc(o.note).replace(/\n/g, '<br>'))}
        </dl>

        <div class="field">
          <label for="status">Status</label>
          <div class="seg" id="status">
            ${STATUSES.map((s) => `<button type="button" data-status="${s}" class="${(o.status || 'nieuw') === s ? 'on' : ''}">${statusLabel(s)}</button>`).join('')}
          </div>
        </div>

        <div class="detail-actions">
          <button class="btn big" id="zip">${ICON.zip} Zip downloaden</button>
          <button class="btn ghost" id="label">${ICON.label} Verzendlabel</button>
          <button class="btn ghost" id="sheet">${ICON.pdf} Bestelbon</button>
        </div>
        <button class="link danger" id="del">${ICON.trash} Bestelling verwijderen</button>
      </div>
    </div>`);

  imageFor(id).then((image) => {
    if (current.path !== `/bestelling/${id}` || !$('#frame')) return;
    if (!image) return void ($('#frame').innerHTML = `<p class="empty">De afbeelding ontbreekt.</p>`);
    $('#frame').innerHTML = `<img src="${image}" alt="Afbeelding van ${esc(o.name)}">`;
    $('#dl-img').disabled = false;
  }).catch(() => { if ($('#frame')) $('#frame').innerHTML = `<p class="empty">De afbeelding laden lukte niet.</p>`; });

  $('#paid').addEventListener('change', (e) => setPaid(id, e.target.checked));
  $('#status').addEventListener('click', async (e) => {
    const s = e.target.dataset.status;
    if (!s || s === (o.status || 'nieuw')) return;
    try { await updateOrder(id, { status: s }); } catch { toast('Bewaren lukte niet.', 'bad'); }
  });
  $('#dl-img').addEventListener('click', async () => downloadImage(o, await imageFor(id)));
  $('#zip').addEventListener('click', (e) => zipFor(id, e.currentTarget));
  $('#label').addEventListener('click', () => openPdf(labelPdf(o, cfg.shop)));
  $('#sheet').addEventListener('click', async () => openPdf(orderPdf(o, await imageFor(id).catch(() => null))));
  $('#del').addEventListener('click', async () => {
    if (!confirm(`De bestelling van ${o.name} definitief verwijderen? De afbeelding wordt ook gewist.`)) return;
    try {
      await deleteOrder(id);
      images.delete(id);
      toast('Bestelling verwijderd');
      location.hash = '#/bestellingen';
    } catch {
      toast('Verwijderen lukte niet.', 'bad');
    }
  });
}

/* ---------- Formaten en prijzen ---------- */
function renderSizes() {
  let rows = cfg.sizes.map((s) => ({ ...s }));

  shell('Formaten en prijzen', `
    <p class="intro">Deze formaten ziet de klant in het bestelformulier, in deze volgorde. Een wijziging geldt enkel voor nieuwe bestellingen.</p>
    <form id="sf" class="panel sizes-edit" novalidate>
      <div class="srow shead"><span></span><span>Naam</span><span>Omschrijving</span><span>Prijs</span><span>Zichtbaar</span><span></span></div>
      <div id="srows"></div>
      <button type="button" class="btn ghost" id="add">${ICON.plus} Formaat toevoegen</button>
      <div class="form-foot">
        <p class="err" id="serr" hidden></p>
        <button class="btn big" id="save">Bewaren</button>
      </div>
    </form>`);

  const read = () => {
    $$('#srows .srow').forEach((el, i) => {
      rows[i].name = $('[data-k=name]', el).value.trim();
      rows[i].note = $('[data-k=note]', el).value.trim();
      rows[i].price = $('[data-k=price]', el).value;
      rows[i].active = $('[data-k=active]', el).checked;
    });
  };
  const paint = () => {
    $('#srows').innerHTML = rows.map((s, i) => `
      <div class="srow" data-i="${i}">
        <span class="move">
          <button type="button" class="iconbtn" data-up ${i === 0 ? 'disabled' : ''} aria-label="Omhoog">${ICON.up}</button>
          <button type="button" class="iconbtn" data-down ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Omlaag">${ICON.down}</button>
        </span>
        <input data-k="name" value="${esc(s.name)}" maxlength="60" placeholder="bv. Mini" aria-label="Naam">
        <input data-k="note" value="${esc(s.note || '')}" maxlength="120" placeholder="bv. ongeveer 3 cm hoog" aria-label="Omschrijving">
        <span class="price-in"><i>€</i><input data-k="price" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(s.price)}" aria-label="Prijs in euro"></span>
        <label class="switch"><input type="checkbox" data-k="active" ${s.active !== false ? 'checked' : ''}><span class="track"></span><span class="sr-only">Zichtbaar</span></label>
        <button type="button" class="iconbtn danger" data-del aria-label="Formaat verwijderen">${ICON.trash}</button>
      </div>`).join('') || `<p class="empty">Nog geen formaten. Voeg er een toe.</p>`;
  };
  paint();

  $('#add').addEventListener('click', () => {
    read();
    rows.push({ id: uid(), name: '', note: '', price: '', active: true });
    paint();
    $$('#srows [data-k=name]').at(-1).focus();
  });
  $('#srows').addEventListener('click', (e) => {
    const el = e.target.closest('.srow');
    if (!el) return;
    const i = +el.dataset.i;
    const swap = (j) => { read(); [rows[i], rows[j]] = [rows[j], rows[i]]; paint(); };
    if (e.target.closest('[data-up]')) swap(i - 1);
    else if (e.target.closest('[data-down]')) swap(i + 1);
    else if (e.target.closest('[data-del]')) {
      read();
      if (rows[i].name && !confirm(`Formaat "${rows[i].name}" verwijderen?`)) return;
      rows.splice(i, 1);
      paint();
    }
  });
  $('#sf').addEventListener('submit', async (e) => {
    e.preventDefault();
    read();
    const err = (msg) => { $('#serr').textContent = msg; $('#serr').hidden = !msg; };
    if (!rows.length) return err('Voeg minstens één formaat toe.');
    if (rows.some((s) => !s.name)) return err('Geef elk formaat een naam.');
    if (rows.some((s) => s.price === '' || !(Number(s.price) >= 0))) return err('Vul bij elk formaat een prijs in (0 of meer).');
    err('');
    const out = {};
    rows.forEach((s, i) => {
      out[s.id] = { name: s.name, note: s.note, price: Math.round(Number(s.price) * 100) / 100, sort: i, active: s.active };
    });
    try {
      await saveSizes(out);
      cfg.sizes = sizeList(out);
      rows = cfg.sizes.map((s) => ({ ...s }));
      paint();
      toast('Formaten bewaard');
    } catch (ex) {
      console.error(ex);
      toast('Bewaren lukte niet. Probeer het opnieuw.', 'bad');
    }
  });
}

/* ---------- Exporteren ---------- */
function renderExport() {
  const card = (key, title, text) => `
    <div class="panel exp">
      <div><h2>${title} <b>${orders ? count(key) : '…'}</b></h2><p>${text}</p></div>
      <div class="exp-btns">
        <button class="btn" data-exp="${key}" data-fmt="xlsx">${ICON.export} Excel</button>
        <button class="btn ghost" data-exp="${key}" data-fmt="csv">CSV</button>
      </div>
    </div>`;
  shell('Exporteren', `
    <p class="intro">Download de bestellingen als lijst. Per bestelling een zip met afbeelding, bestelbon en label vind je bij <a href="#/bestellingen">Bestellingen</a>.</p>
    <div class="exp-list" id="exps">
      ${card('alle', 'Alle bestellingen', 'Elke bestelling, betaald of niet.')}
      ${card('onbetaald', 'Onbetaalde bestellingen', 'Handig om betalingen na te kijken naast je rekeninguittreksel.')}
      ${card('betaald', 'Betaalde bestellingen', 'Wat geprint en verstuurd mag worden.')}
    </div>`);
  $('#exps').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-exp]');
    if (!btn) return;
    const list = (orders || []).filter(FILTERS[btn.dataset.exp].test);
    if (!list.length) return toast('Er is niets om te exporteren.', 'bad');
    exportOrders(list, btn.dataset.exp, btn.dataset.fmt);
  });
}

/* ---------- Instellingen ---------- */
function ibanOk(iban) {
  const s = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const num = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 55);
  return BigInt(num) % 97n === 1n;
}

function renderSettings() {
  const s = cfg.shop;
  const field = (id, label, opts = {}) => `
    <div class="field ${opts.cls || ''}">
      <label for="s-${id}">${label}${opts.optional ? ' <span class="opt">optioneel</span>' : ''}</label>
      <input id="s-${id}" name="${id}" type="${opts.type || 'text'}" value="${esc(s[id] ?? '')}" maxlength="${opts.max || 120}" ${opts.attrs || ''}>
      ${opts.hint ? `<p class="hint">${opts.hint}</p>` : ''}
    </div>`;
  shell('Instellingen', `
    <form id="stf" class="settings" novalidate>
      <section class="panel">
        <h2>Bestellingen</h2>
        <label class="switch big">
          <input type="checkbox" name="open" ${s.open ? 'checked' : ''}>
          <span class="track"></span><span class="switch-text">Het bestelformulier staat open</span>
        </label>
        ${field('closedMsg', 'Boodschap als het formulier gesloten is', { max: 200, cls: 'wide' })}
      </section>

      <section class="panel">
        <h2>Betaalgegevens</h2>
        <p class="intro">Dit krijgt de klant te zien na het bestellen, samen met de mededeling en een QR-code voor de bank-app.</p>
        <div class="fields">
          ${field('beneficiary', 'Naam van de begunstigde', { max: 70, cls: 'wide' })}
          ${field('iban', 'Rekeningnummer (IBAN)', { max: 42, cls: 'grow', attrs: 'placeholder="BE00 0000 0000 0000" autocapitalize="characters"' })}
          ${field('bic', 'BIC', { max: 11, optional: true, cls: 'narrow' })}
          ${field('payDays', 'Betaaltermijn in dagen', { type: 'number', cls: 'narrow', attrs: 'min="0" max="60"', hint: '0 = geen termijn tonen' })}
        </div>
      </section>

      <section class="panel">
        <h2>Afzender op het verzendlabel</h2>
        <div class="fields">
          ${field('senderName', 'Naam', { cls: 'wide' })}
          ${field('senderStreet', 'Straat en huisnummer', { cls: 'wide' })}
          ${field('senderZip', 'Postcode', { max: 12, cls: 'narrow' })}
          ${field('senderCity', 'Gemeente', { cls: 'grow' })}
        </div>
      </section>

      <section class="panel">
        <h2>Contact</h2>
        ${field('contact', 'E-mailadres voor vragen', { type: 'email', max: 150, optional: true, cls: 'wide', hint: 'Staat onderaan de website.' })}
      </section>

      <div class="form-foot">
        <p class="err" id="sterr" hidden></p>
        <button class="btn big">Bewaren</button>
      </div>
    </form>`);

  $('#stf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const err = (msg) => { $('#sterr').textContent = msg; $('#sterr').hidden = !msg; };
    const iban = (data.iban || '').trim();
    if (iban && !ibanOk(iban)) return err('Dit rekeningnummer klopt niet. Kijk het IBAN-nummer na.');
    err('');
    const shop = {
      open: !!data.open,
      closedMsg: data.closedMsg.trim(),
      beneficiary: data.beneficiary.trim(),
      iban: fmtIban(iban),
      bic: data.bic.replace(/\s+/g, '').toUpperCase(),
      payDays: Math.max(0, Math.round(Number(data.payDays) || 0)),
      senderName: data.senderName.trim(),
      senderStreet: data.senderStreet.trim(),
      senderZip: data.senderZip.trim(),
      senderCity: data.senderCity.trim(),
      contact: data.contact.trim(),
    };
    try {
      await saveShop(shop);
      cfg.shop = shop;
      toast('Instellingen bewaard');
    } catch (ex) {
      console.error(ex);
      toast('Bewaren lukte niet. Probeer het opnieuw.', 'bad');
    }
  });
}
