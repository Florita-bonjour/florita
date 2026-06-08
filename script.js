import { TRAME_VAD_CONTENU, TRAME_TEL, TRAME_ACTION } from './trames.js';

const TRAMES = { vad: TRAME_VAD_CONTENU, tel: TRAME_TEL, action: TRAME_ACTION };

/* ── Date ──────────────────────────────────────────────────────────── */
document.getElementById('doc-date').textContent = new Date().toLocaleDateString('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric'
});

/* ── Fonctions utilitaires ─────────────────────────────────────────── */
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

/* ── Lecture des données depuis localStorage ───────────────────────── */
let destination = '';
let notes       = '';
let trameKey    = 'vad';
let measures    = [];
let sexe        = '';

const saved = localStorage.getItem('florita-cr-data');
if (saved) {
  try {
    const data = JSON.parse(saved);
    destination = data.destination || '';
    notes       = data.notes || '';
    trameKey    = data.trame || 'vad';
    measures    = data.measures || [];
    sexe        = data.sexe || '';
  } catch (_) {}
}

const trame   = TRAMES[trameKey] ?? TRAME_VAD_CONTENU;
const hasData = destination || notes || measures.length;

if (hasData) {
  generateCR(destination, notes, measures, trame, sexe);
} else {
  document.getElementById('cr-editor').innerHTML =
    `<p class="cr-placeholder">Le compte rendu généré apparaîtra ici. Ce champ est entièrement modifiable avant l'impression.</p>`;
}

/* ── Génération du CR avec streaming ───────────────────────────────── */
async function generateCR(destination, notes, measures, trame, sexe) {
  const editor = document.getElementById('cr-editor');

  editor.setAttribute('contenteditable', 'false');
  editor.innerHTML = `<p class="cr-placeholder" style="font-style:italic;opacity:.7;">Génération du compte rendu en cours…</p>`;

  try {
    const response = await fetch('/.netlify/functions/generate-cr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, notes, measures, trame, sexe }),
    });

    if (!response.ok) {
      let errorMsg = `Erreur HTTP ${response.status}`;
      try {
        const data = await response.json();
        errorMsg = data.error || errorMsg;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
      editor.innerHTML = mdToHTML(fullText);
    }

  } catch (err) {
    editor.innerHTML = `<p class="cr-placeholder">Erreur lors de la génération : ${esc(err.message)}</p>`;
  } finally {
    editor.setAttribute('contenteditable', 'true');
  }
}

/* ── Export Word ─────────────────────────────────────────────────────── */
document.getElementById('btn-word').addEventListener('click', exportWord);

async function exportWord() {
  const { Document, Paragraph, TextRun, Packer } = window.docx;

  const patient   = document.getElementById('field-patient').textContent.trim();
  const dob       = document.getElementById('field-dob').textContent.trim();
  const therapist = document.getElementById('field-therapist').textContent.trim();
  const date      = document.getElementById('doc-date').textContent.trim();

  const children = [
    new Paragraph({ children: [new TextRun({ text: "Cabinet d'Ergothérapie", bold: true, size: 24 })] }),
    new Paragraph({ children: [new TextRun({ text: date, color: '637080', size: 18 })] }),
    new Paragraph({ children: [new TextRun({ text: '' })] }),
    new Paragraph({ children: [new TextRun({ text: `Patient : ${patient}` })] }),
    new Paragraph({ children: [new TextRun({ text: `Date de naissance : ${dob}` })] }),
    new Paragraph({ children: [new TextRun({ text: `Thérapeute : ${therapist}` })] }),
    new Paragraph({ children: [new TextRun({ text: '' })] }),
    new Paragraph({ children: [new TextRun({ text: "COMPTE RENDU D'ÉVALUATION ERGOTHÉRAPIQUE", bold: true, size: 22 })] }),
    new Paragraph({
      children: [],
      border: { bottom: { style: 'single', size: 6, color: 'D0D7DE', space: 1 } },
      spacing: { after: 160 },
    }),
  ];

  const editor = document.getElementById('cr-editor');

  for (const node of editor.childNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    if (node.tagName === 'H3') {
      children.push(new Paragraph({
        children: [new TextRun({ text: node.textContent, bold: true, size: 20 })],
        spacing: { before: 240, after: 80 },
      }));

    } else if (node.tagName === 'HR') {
      children.push(new Paragraph({
        children: [],
        border: { bottom: { style: 'single', size: 4, color: 'D0D7DE', space: 1 } },
        spacing: { before: 80, after: 80 },
      }));

    } else if (node.tagName === 'P') {
      const runs = [];
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          if (child.textContent) runs.push(new TextRun({ text: child.textContent }));
        } else if (child.tagName === 'STRONG') {
          runs.push(new TextRun({ text: child.textContent, bold: true }));
        } else if (child.tagName === 'MARK') {
          runs.push(new TextRun({ text: child.textContent, highlight: 'yellow' }));
        } else if (child.tagName === 'BR') {
          runs.push(new TextRun({ break: 1 }));
        }
      }
      if (runs.length) children.push(new Paragraph({ children: runs, spacing: { after: 120 } }));
    }
  }

  const doc  = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'compte-rendu-ergotherapie.docx';
  a.click();
  URL.revokeObjectURL(url);
}