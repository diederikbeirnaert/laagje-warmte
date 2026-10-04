// De publieke pagina: uitleg, bestelformulier en betaalgegevens na het bestellen.
import {
  $, $$, esc, money, toast, BRAND, ICON, getConfig, newRef, fmtRef, fmtIban, logoMark, printArt, blockArt,
} from './common.js';
import { configured, createOrder } from './store.js';
import { prepareImage } from './image.js';

const app = $('#app');
const LAST_KEY = 'lw-last-order';
let cfg;
let picked = null; // { dataUrl, type, width, height, thumb, resized, fileName }

const FIELDS = [
  { id: 'name', label: 'Voornaam en naam', auto: 'name', max: 100, cls: 'wide' },
  { id: 'email', label: 'E-mailadres', type: 'email', auto: 'email', max: 150 },
  { id: 'phone', label: 'Telefoon', type: 'tel', auto: 'tel', max: 40, optional: true },
  { id: 'street', label: 'Straat en huisnummer', auto: 'address-line1', max: 150, cls: 'grow' },
  { id: 'box', label: 'Bus', max: 20, optional: true, cls: 'narrow' },
  { id: 'zip', label: 'Postcode', auto: 'postal-code', max: 12, cls: 'narrow' },
  { id: 'city', label: 'Gemeente', auto: 'address-level2', max: 100, cls: 'grow' },
  { id: 'country', label: 'Land', auto: 'country-name', max: 60, value: 'België', cls: 'wide' },
];

init();

async function init() {
  try {
    cfg = await getConfig();
  } catch {
    app.innerHTML = `<div class="page-msg"><h1>Even geduld</h1><p>De site is nu niet bereikbaar. Probeer het straks opnieuw.</p></div>`;
    return;
  }
  cfg.sizes = cfg.sizes.filter((s) => s.active !== false);
  render();
}

function lastOrder() {
  try { return JSON.parse(sessionStorage.getItem(LAST_KEY)); } catch { return null; }
}

function render() {
  const done = lastOrder();
  app.innerHTML = `
    ${configured ? '' : `<p class="testbar">Lokale testmodus: bestellingen blijven enkel in deze browser bewaard.</p>`}
    <header class="site-head">
      <a class="brand" href="#top">${logoMark()}<span>${BRAND}</span></a>
      <nav>
        <a href="#hoe">Hoe werkt het</a>
        <a class="btn small" href="#bestel">Bestellen</a>
      </nav>
    </header>

    <section class="hero" id="top">
      <div class="hero-text">
        <p class="eyebrow">3D-prints voor De Warmste Week</p>
        <h1>Van foto tot beeldje, <em>laagje per laagje.</em></h1>
        <p class="lead">Laad een foto op van je huisdier, je lievelingsknuffeltje of iets anders waar je van houdt.
          Wij maken er een 3D-model van en printen het voor jou. De opbrengst gaat naar De Warmste Week.</p>
        <div class="hero-cta">
          <a class="btn big" href="#bestel">Bestel je print</a>
          <a class="link" href="#hoe">Hoe werkt het?</a>
        </div>
      </div>
      <div class="hero-art">
        ${printArt()}
        <p class="readout"><span>PLA-filament</span><span>laagjes van 0,2 mm</span></p>
      </div>
    </section>

    <section class="steps" id="hoe">
      <h2>Hoe werkt het?</h2>
      <ol>
        <li><span class="num">01</span><h3>Kies en laad op</h3><p>Kies een formaat en laad je foto op. Eén duidelijk onderwerp werkt het best.</p></li>
        <li><span class="num">02</span><h3>Schrijf over</h3><p>Je krijgt meteen de betaalgegevens met jouw persoonlijke mededeling.</p></li>
        <li><span class="num">03</span><h3>Wij printen</h3><p>Van je foto maken we een 3D-model, dat we laagje per laagje printen.</p></li>
        <li><span class="num">04</span><h3>Bij jou thuis</h3><p>We sturen je beeldje op naar het adres dat je opgeeft.</p></li>
      </ol>
    </section>

    <section class="order" id="bestel">
      ${done ? confirmationHtml(done) : cfg.shop.open && cfg.sizes.length ? formHtml() : closedHtml()}
    </section>

    <footer class="site-foot">
      <p>${logoMark()} <strong>${BRAND}</strong> · een actie voor De Warmste Week</p>
      <p>${cfg.shop.contact ? `Vragen? <a href="mailto:${esc(cfg.shop.contact)}">${esc(cfg.shop.contact)}</a> · ` : ''}<a href="admin.html">Beheer</a></p>
    </footer>`;

  if (done) wireConfirmation(done);
  else if ($('#order')) wireForm();
}

/* ---------- Formulier ---------- */
const closedHtml = () => `
  <div class="closed">
    <p class="eyebrow">Bestellingen gesloten</p>
    <h2>${esc(cfg.shop.closedMsg || 'We nemen momenteel geen nieuwe bestellingen aan.')}</h2>
  </div>`;

function fieldHtml(f) {
  return `<div class="field ${f.cls || ''}">
    <label for="f-${f.id}">${f.label}${f.optional ? ' <span class="opt">optioneel</span>' : ''}</label>
    <input id="f-${f.id}" name="${f.id}" type="${f.type || 'text'}" maxlength="${f.max}"
      ${f.auto ? `autocomplete="${f.auto}"` : ''} ${f.optional ? '' : 'required'} value="${esc(f.value || '')}">
    <p class="err" id="e-${f.id}" hidden></p>
  </div>`;
}

function formHtml() {
  const n = cfg.sizes.length;
  return `
  <div class="order-head">
    <p class="eyebrow">Bestellen</p>
    <h2>Stel je print samen</h2>
  </div>
  <form id="order" class="order-grid" novalidate>
    <div class="order-main">
      <fieldset class="block">
        <legend><span class="num">01</span> Kies je formaat</legend>
        <div class="sizes" role="radiogroup" aria-label="Formaat">
          ${cfg.sizes.map((s, i) => `
            <label class="size">
              <input type="radio" name="size" value="${esc(s.id)}" ${i === 0 ? 'checked' : ''}>
              <span class="size-card">
                ${blockArt(n === 1 ? 5 : Math.round(2 + (7 * i) / (n - 1)))}
                <span class="size-name">${esc(s.name)}</span>
                ${s.note ? `<span class="size-note">${esc(s.note)}</span>` : ''}
                <span class="size-price">${money(s.price)}</span>
              </span>
            </label>`).join('')}
        </div>
      </fieldset>

      <fieldset class="block">
        <legend><span class="num">02</span> Laad je afbeelding op</legend>
        <div class="drop" id="drop">
          <input type="file" id="file" accept="image/jpeg,image/png" class="sr-only">
          <div class="drop-empty" id="drop-empty">
            <span class="drop-icon">${ICON.upload}</span>
            <p><label for="file" class="link">Kies een foto</label> of sleep ze hierheen</p>
            <p class="hint">jpg of png</p>
          </div>
          <div class="drop-full" id="drop-full" hidden></div>
        </div>
        <p class="err" id="e-file" hidden></p>
        <p class="tip">Een scherpe foto met één onderwerp en een rustige achtergrond geeft het mooiste beeldje.</p>
      </fieldset>

      <fieldset class="block">
        <legend><span class="num">03</span> Waar mag het naartoe?</legend>
        <div class="fields">
          ${FIELDS.map(fieldHtml).join('')}
          <div class="field wide">
            <label for="f-note">Opmerking <span class="opt">optioneel</span></label>
            <textarea id="f-note" name="note" rows="3" maxlength="1000"></textarea>
          </div>
        </div>
        <div class="hp" aria-hidden="true"><label>Laat dit veld leeg <input name="website" tabindex="-1" autocomplete="off"></label></div>
        <label class="check">
          <input type="checkbox" id="f-consent" required>
          <span>Ik ga ermee akkoord dat mijn gegevens en foto gebruikt worden om deze bestelling te verwerken.</span>
        </label>
        <p class="err" id="e-consent" hidden></p>
      </fieldset>
    </div>

    <aside class="ticket summary">
      <h3>Jouw bestelling</h3>
      <dl>
        <div><dt>Formaat</dt><dd id="s-size"></dd></div>
        <div><dt>Afbeelding</dt><dd id="s-img">nog niet gekozen</dd></div>
      </dl>
      <p class="total"><span>Totaal</span><strong id="s-total"></strong></p>
      <button class="btn big full" id="submit">Bestelling plaatsen</button>
      <p class="hint">Je betaalt daarna via overschrijving. De gegevens krijg je meteen te zien.</p>
    </aside>
  </form>`;
}

const chosenSize = () => cfg.sizes.find((s) => s.id === $('input[name=size]:checked')?.value);

function showErr(id, msg) {
  const el = $(`#e-${id}`);
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
  $(`#f-${id}`)?.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function wireForm() {
  const form = $('#order');
  const updateSummary = () => {
    const s = chosenSize();
    $('#s-size').textContent = s ? s.name : '';
    $('#s-total').textContent = s ? money(s.price) : '';
  };
  $$('input[name=size]').forEach((r) => r.addEventListener('change', updateSummary));
  updateSummary();

  // Afbeelding kiezen of slepen
  const drop = $('#drop');
  const file = $('#file');
  const take = async (f) => {
    if (!f) return;
    showErr('file', '');
    drop.classList.add('busy');
    try {
      picked = { ...(await prepareImage(f)), fileName: f.name };
      $('#drop-empty').hidden = true;
      $('#drop-full').hidden = false;
      $('#drop-full').innerHTML = `
        <img src="${picked.dataUrl}" alt="Voorbeeld van je afbeelding">
        <div>
          <p class="file-name">${esc(f.name)}</p>
          <p class="hint">${picked.width} × ${picked.height} pixels${picked.resized ? ' · verkleind om te versturen' : ''}</p>
          <label for="file" class="link">Andere foto kiezen</label>
        </div>`;
      $('#s-img').textContent = f.name;
    } catch (err) {
      showErr('file', err.message);
    }
    drop.classList.remove('busy');
    file.value = '';
  };
  file.addEventListener('change', () => take(file.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => take(e.dataTransfer.files[0]));

  FIELDS.forEach((f) => $(`#f-${f.id}`).addEventListener('input', () => showErr(f.id, '')));
  $('#f-consent').addEventListener('change', () => showErr('consent', ''));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    let firstBad = null;
    const bad = (id, msg, el = $(`#f-${id}`)) => { showErr(id, msg); firstBad ||= el; };

    if (!picked) bad('file', 'Kies eerst een afbeelding.', drop);
    FIELDS.forEach((f) => {
      const v = (data[f.id] || '').trim();
      if (!f.optional && !v) bad(f.id, 'Vul dit veld in.');
      else if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) bad(f.id, 'Dit e-mailadres lijkt niet te kloppen.');
    });
    if (!$('#f-consent').checked) bad('consent', 'Vink dit aan om te kunnen bestellen.');
    if (firstBad) {
      firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstBad.focus?.({ preventScroll: true });
      return;
    }

    const size = chosenSize();
    const order = {
      ref: newRef(),
      sizeId: size.id,
      sizeName: size.name,
      price: Number(size.price),
      paid: false,
      status: 'nieuw',
      thumb: picked.thumb,
      imgType: picked.type,
      imgW: picked.width,
      imgH: picked.height,
    };
    if (size.note) order.sizeNote = size.note;
    [...FIELDS.map((f) => f.id), 'note'].forEach((id) => {
      const v = (data[id] || '').trim();
      if (v) order[id] = v;
    });

    const btn = $('#submit');
    btn.disabled = true;
    btn.textContent = 'Bezig met versturen…';
    try {
      // Ingevuld lokveld = robot: doe alsof het gelukt is, maar bewaar niets.
      if (!data.website) await createOrder(order, picked.dataUrl);
      const { thumb, ...keep } = order;
      sessionStorage.setItem(LAST_KEY, JSON.stringify({ ...keep, createdAt: Date.now() }));
      picked = null;
      render();
      $('#bestel').scrollIntoView({ block: 'start' });
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = 'Bestelling plaatsen';
      toast('Het versturen lukte niet. Probeer het opnieuw.', 'bad');
    }
  });
}

/* ---------- Bevestiging met betaalgegevens ---------- */
function confirmationHtml(o) {
  const { shop } = cfg;
  const ready = shop.iban && shop.beneficiary;
  const first = esc(String(o.name || '').split(' ')[0]);
  return `
  <div class="done">
    <p class="eyebrow">Bestelling ontvangen</p>
    <h2>Bedankt, ${first}!</h2>
    <p class="lead">We hebben je bestelling goed ontvangen. Schrijf het bedrag over met de mededeling hieronder.
      Zodra je betaling binnen is, starten we met printen.</p>

    <div class="ticket pay">
      <div class="pay-rows">
        <div class="pay-row"><span>Bedrag</span><strong class="amount">${money(o.price)}</strong></div>
        ${ready ? `
        <div class="pay-row"><span>Rekeningnummer</span><strong class="mono">${esc(fmtIban(shop.iban))}</strong>
          <button class="copy" data-copy="${esc(fmtIban(shop.iban))}" aria-label="Rekeningnummer kopiëren">${ICON.copy}</button></div>
        <div class="pay-row"><span>Begunstigde</span><strong>${esc(shop.beneficiary)}</strong></div>` : `
        <div class="pay-row"><span>Rekeningnummer</span><strong>nog niet ingesteld</strong></div>`}
        <div class="pay-row"><span>Mededeling</span><strong class="mono">${fmtRef(o.ref)}</strong>
          <button class="copy" data-copy="${fmtRef(o.ref)}" aria-label="Mededeling kopiëren">${ICON.copy}</button></div>
        <div class="pay-row"><span>Je bestelling</span><strong>${esc(o.sizeName)}${o.sizeNote ? `, ${esc(o.sizeNote)}` : ''}</strong></div>
      </div>
      ${ready ? `<div class="pay-qr"><div id="qr"></div><p>Scan met je bank-app</p></div>` : ''}
    </div>

    <p class="keep">Bewaar deze gegevens goed: je krijgt geen e-mail ter bevestiging.
      ${shop.payDays ? `Betaal binnen de ${Number(shop.payDays)} dagen, anders vervalt je bestelling.` : ''}</p>
    <div class="done-actions">
      <button class="btn" id="print">Afdrukken of bewaren als pdf</button>
      <button class="btn ghost" id="again">Nog een bestelling plaatsen</button>
    </div>
  </div>`;
}

// QR-code voor de bank-app (Europese EPC-standaard, "SEPA-overschrijving").
function epcPayload(o) {
  const { shop } = cfg;
  return [
    'BCD', '002', '1', 'SCT',
    (shop.bic || '').replace(/\s+/g, '').toUpperCase(),
    shop.beneficiary.slice(0, 70),
    shop.iban.replace(/\s+/g, '').toUpperCase(),
    `EUR${Number(o.price).toFixed(2)}`,
    '', '', fmtRef(o.ref),
  ].join('\n');
}

function wireConfirmation(o) {
  const box = $('#qr');
  if (box && window.qrcode) {
    try {
      window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
      const qr = window.qrcode(0, 'M');
      qr.addData(epcPayload(o));
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (err) {
      console.error(err);
      box.closest('.pay-qr').remove();
    }
  }
  $$('.copy').forEach((b) => b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(b.dataset.copy);
      toast('Gekopieerd');
    } catch {
      toast('Kopiëren lukte niet. Selecteer de tekst zelf.', 'bad');
    }
  }));
  $('#print').addEventListener('click', () => window.print());
  $('#again').addEventListener('click', () => {
    if (!confirm('Heb je de betaalgegevens bewaard? Ze verdwijnen van het scherm.')) return;
    sessionStorage.removeItem(LAST_KEY);
    render();
    $('#bestel').scrollIntoView({ block: 'start' });
  });
}
