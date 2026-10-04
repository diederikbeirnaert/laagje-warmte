// Bestanden die de admin downloadt: bestelbon (pdf), verzendlabel (pdf), zip per bestelling, export.
// Alles wordt in de browser gemaakt met jsPDF en JSZip (zie vendor/).
import { BRAND, slug, fmtDate, fmtRef, download } from './common.js';

const STATUS = { nieuw: 'Nieuw', geprint: 'Geprint', verzonden: 'Verzonden' };
export const statusLabel = (s) => STATUS[s] || STATUS.nieuw;
export const STATUSES = Object.keys(STATUS);

// De standaardlettertypes van jsPDF kennen het euroteken niet.
const pdfMoney = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} EUR`;
const imgExt = (order) => (order.imgType === 'image/png' ? 'png' : 'jpg');
const addressLines = (o) => [
  `${o.street || ''}${o.box ? ` bus ${o.box}` : ''}`,
  `${o.zip || ''} ${o.city || ''}`.trim(),
  o.country || '',
].filter(Boolean);

/* ---------- Bestelbon (A4) ---------- */
export function orderPdf(order, image) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 18;
  let y = M;

  doc.setFont('courier', 'bold').setFontSize(9).setTextColor(120);
  doc.text(BRAND.toUpperCase(), M, y);
  doc.text(fmtDate(order.createdAt), W - M, y, { align: 'right' });
  y += 12;
  doc.setFont('helvetica', 'bold').setFontSize(24).setTextColor(20);
  doc.text('Bestelling', M, y);
  doc.setFont('courier', 'bold').setFontSize(13);
  doc.text(fmtRef(order.ref), W - M, y, { align: 'right' });
  y += 5;
  doc.setDrawColor(20).setLineWidth(0.6).line(M, y, W - M, y);
  y += 10;

  const block = (title, rows, x, top) => {
    let yy = top;
    doc.setFont('courier', 'bold').setFontSize(8.5).setTextColor(120);
    doc.text(title.toUpperCase(), x, yy);
    yy += 6;
    doc.setFontSize(11).setTextColor(20);
    rows.filter(Boolean).forEach(([text, bold]) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.splitTextToSize(String(text), 80).forEach((line) => { doc.text(line, x, yy); yy += 5.4; });
    });
    return yy;
  };

  const left = block('Klant', [
    [order.name, true],
    ...addressLines(order).map((l) => [l]),
    [order.email],
    order.phone && [order.phone],
  ], M, y);
  const right = block('Bestelling', [
    [`${order.sizeName}${order.sizeNote ? ` (${order.sizeNote})` : ''}`, true],
    [`Prijs: ${pdfMoney(order.price)}`],
    [order.paid ? `Betaald${order.paidAt ? ` op ${fmtDate(order.paidAt, false)}` : ''}` : 'Nog niet betaald', true],
    [`Status: ${statusLabel(order.status)}`],
  ], W / 2 + 6, y);
  y = Math.max(left, right) + 5;

  if (order.note) y = block('Opmerking van de klant', [[order.note]], M, y) + 5;

  if (image && order.imgW && order.imgH) {
    doc.setFont('courier', 'bold').setFontSize(8.5).setTextColor(120);
    doc.text('AFBEELDING', M, y);
    y += 4;
    const maxW = W - 2 * M;
    const maxH = 297 - M - y;
    const scale = Math.min(maxW / order.imgW, maxH / order.imgH);
    try {
      doc.addImage(image, order.imgType === 'image/png' ? 'PNG' : 'JPEG', M, y, order.imgW * scale, order.imgH * scale);
    } catch (err) {
      console.error(err);
      doc.setFont('helvetica', 'normal').setFontSize(10).text('(De afbeelding kon niet in de pdf gezet worden.)', M, y + 6);
    }
  }
  return doc;
}

/* ---------- Verzendlabel (100 × 150 mm) ---------- */
export function labelPdf(order, shop) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: [100, 150] });
  const M = 8;
  let y = 12;

  doc.setFont('courier', 'bold').setFontSize(7.5).setTextColor(110);
  doc.text('AFZENDER', M, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(20);
  const sender = [shop.senderName || BRAND, shop.senderStreet, `${shop.senderZip || ''} ${shop.senderCity || ''}`.trim()].filter(Boolean);
  sender.forEach((l) => { doc.text(l, M, y); y += 4.2; });

  y += 3;
  doc.setDrawColor(20).setLineWidth(0.8).line(M, y, 100 - M, y);
  y += 12;

  doc.setFont('courier', 'bold').setFontSize(7.5).setTextColor(110);
  doc.text('AAN', M, y);
  y += 10;
  doc.setTextColor(20).setFont('helvetica', 'bold').setFontSize(19);
  doc.splitTextToSize(order.name || '', 100 - 2 * M).forEach((l) => { doc.text(l, M, y); y += 8.5; });
  y += 2;
  doc.setFont('helvetica', 'normal').setFontSize(15);
  const lines = addressLines(order);
  lines.forEach((l, i) => {
    const last = i === lines.length - 1 && order.country;
    if (last) doc.setFont('helvetica', 'bold');
    doc.splitTextToSize(last ? l.toUpperCase() : l, 100 - 2 * M).forEach((part) => { doc.text(part, M, y); y += 7; });
  });

  // Onderaan: referentie en formaat, zodat het juiste beeldje in de juiste doos belandt
  doc.setLineWidth(0.3).line(M, 132, 100 - M, 132);
  doc.setFont('courier', 'bold').setFontSize(10);
  doc.text(fmtRef(order.ref), M, 139);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90);
  doc.text(`${BRAND} · ${order.sizeName || ''}`, M, 144);
  return doc;
}

/* ---------- Zip per bestelling ---------- */
// bestelling-<naam>.zip met afbeelding-<naam>.jpg|png, bestand-<naam>.pdf en label-<naam>.pdf
export async function downloadZip(order, image, shop) {
  const name = slug(order.name);
  const zip = new window.JSZip();
  if (image) zip.file(`afbeelding-${name}.${imgExt(order)}`, image.slice(image.indexOf(',') + 1), { base64: true });
  zip.file(`bestand-${name}.pdf`, orderPdf(order, image).output('arraybuffer'));
  zip.file(`label-${name}.pdf`, labelPdf(order, shop).output('arraybuffer'));
  download(await zip.generateAsync({ type: 'blob' }), `bestelling-${name}.zip`);
}

export async function downloadImage(order, image) {
  download(await (await fetch(image)).blob(), `afbeelding-${slug(order.name)}.${imgExt(order)}`);
}

export const openPdf = (doc) => window.open(doc.output('bloburl'), '_blank');

/* ---------- Export van de bestellijst ---------- */
const COLUMNS = [
  ['Mededeling', (o) => fmtRef(o.ref).replace(/\+/g, ''), 18],
  ['Besteld op', (o) => fmtDate(o.createdAt), 18],
  ['Naam', (o) => o.name, 26],
  ['E-mail', (o) => o.email, 30],
  ['Telefoon', (o) => o.phone, 16],
  ['Straat en nummer', (o) => o.street, 30],
  ['Bus', (o) => o.box, 6],
  ['Postcode', (o) => o.zip, 10],
  ['Gemeente', (o) => o.city, 20],
  ['Land', (o) => o.country, 12],
  ['Formaat', (o) => o.sizeName, 14],
  ['Prijs', (o) => Number(o.price) || 0, 8],
  ['Betaald', (o) => (o.paid ? 'ja' : 'nee'), 9],
  ['Betaald op', (o) => fmtDate(o.paidAt, false), 12],
  ['Status', (o) => statusLabel(o.status), 11],
  ['Opmerking', (o) => o.note, 40],
];

const xml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

// Een klein, echt Excel-bestand (.xlsx is een zip met xml-bestanden).
async function xlsxBlob(orders) {
  const cell = (v, bold) =>
    typeof v === 'number'
      ? `<c${bold ? ' s="1"' : ''}><v>${v}</v></c>`
      : `<c t="inlineStr"${bold ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  const rows = [
    `<row>${COLUMNS.map(([h]) => cell(h, true)).join('')}</row>`,
    ...orders.map((o) => `<row>${COLUMNS.map(([, get]) => cell(get(o) ?? '')).join('')}</row>`),
  ];
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const zip = new window.JSZip();
  const add = zip.file.bind(zip);
  zip.file = (name, data) => add(name, data, { createFolders: false });
  zip.file('[Content_Types].xml', `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.file('_rels/.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `${head}<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Bestellingen" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', `${head}<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`);
  zip.file('xl/worksheets/sheet1.xml', `${head}<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${COLUMNS.map(([, , w], i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData></worksheet>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// CSV met puntkomma's (zo opent Excel in België het meteen in kolommen).
function csvBlob(orders) {
  const cell = (v) => {
    let s = String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // geen formules laten uitvoeren
    else if (typeof v === 'number') s = s.replace('.', ',');
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [COLUMNS.map(([h]) => h), ...orders.map((o) => COLUMNS.map(([, get]) => get(o)))];
  return new Blob(['﻿' + lines.map((l) => l.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

// filter: 'alle' | 'onbetaald' | 'betaald'
export async function exportOrders(orders, filter, format = 'xlsx') {
  const name = `bestellingen-${filter}-${new Date().toISOString().slice(0, 10)}.${format}`;
  download(format === 'csv' ? csvBlob(orders) : await xlsxBlob(orders), name);
}
