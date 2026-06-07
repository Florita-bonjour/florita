import { TRAME_VAD_CONTENU, TRAME_TEL, TRAME_ACTION } from './trames.js';

const TRAMES = { vad: TRAME_VAD_CONTENU, tel: TRAME_TEL, action: TRAME_ACTION };

/* ── Date ──────────────────────────────────────────────────────────── */
document.getElementById('doc-date').textContent = new Date().toLocaleDateString('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric'
});

/* ── Injection depuis le formulaire (localStorage) ─────────────────── */
function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/§§(.+?)§§/g, '<mark class="hl">$1</mark>');
}

function mdToHTML(text) {
  const lines = text.split('\n');
  const html  = [];
  let para     = [];

  const flushPara = () => {
    if (!para.length) return;
    html.push(`<p>${inline(esc(para.join('\n')).replace(/\n/g, '<br>'))}</p>`);
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === '---') {
      flushPara();
      html.push('<hr>');
    } else if (/^## /.test(line)) {
      flushPara();
      html.push(`<h3>${inline(esc(line.replace(/^## /, '')))}</h3>`);
    } else if (line.trim() === '') {
      flushPara();
    } else {
      para.push(line);
    }
  }
  flushPara();
  return html.join('');
}

let destination = '';
let notes       = '';
let trameKey    = 'vad';
let measures    = [];

const saved = localStorage.getItem('florita-cr-data');
if (saved) {
  try {
    const data = JSON.parse(saved);
    destination = data.destination || '';
    notes       = data.notes || '';
    trameKey    = data.trame || 'vad';
    measures    = data.measures || [];
  } catch (_) {}
}

const trame   = TRAMES[trameKey] ?? TRAME_VAD_CONTENU;
const hasData = destination || notes || measures.length;

if (hasData) {
  generateCR(destination, notes, measures, trame);
} else {
  document.getElementById('cr-editor').innerHTML =
    `<p class="cr-placeholder">Le compte rendu généré apparaîtra ici. Ce champ est entièrement modifiable avant l'impression.</p>`;
}

async function generateCR(destination, notes, measures, trame) {
  const editor = document.getElementById('cr-editor');

  editor.setAttribute('contenteditable', 'false');
  editor.innerHTML = `<p class="cr-placeholder" style="font-style:italic;opacity:.7;">Génération du compte rendu en cours…</p>`;

  try {
    const response = await fetch('/.netlify/functions/generate-cr', {
      method: 'POST',
      headers: {