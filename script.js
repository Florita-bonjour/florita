import { TRAME_VAD_CONTENU, TRAME_TEL, TRAME_ACTION } from './trames.js';

const TRAMES = { vad: TRAME_VAD_CONTENU, tel: TRAME_TEL, action: TRAME_ACTION };

/* ── Date ──────────────────────────────────────────────────────────── */
document.getElementById('doc-date').textContent = new Date().toLocaleDateString('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric'
});

/* ── Injection depuis le formulaire (query string) ─────────────────── */
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

const params      = new URLSearchParams(window.location.search);
const destination = params.get('destination') || '';
const notes       = params.get('notes')       || '';
const trameKey    = params.get('trame') || 'vad';
const trame       = TRAMES[trameKey] ?? TRAME_VAD_CONTENU;
let   measures    = [];
try { measures = JSON.parse(params.get('measures') || '[]'); } catch (_) {}

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

  let apiKey = localStorage.getItem('anthropic_api_key') || '';
  if (!apiKey) {
    apiKey = window.prompt('Clé API Anthropic (mémorisée localement) :');
    if (!apiKey) {
      editor.setAttribute('contenteditable', 'true');
      editor.innerHTML = `<p class="cr-placeholder">Clé API manquante. Rechargez la page pour réessayer.</p>`;
      return;
    }
    localStorage.setItem('anthropic_api_key', apiKey.trim());
    apiKey = apiKey.trim();
  }

  let userContent = 'Génère un compte rendu d\'évaluation ergothérapique professionnel en français à partir des données suivantes :\n\n';
  if (destination) userContent += `Destination / objectif : ${destination}\n\n`;
  if (notes)       userContent += `Observations cliniques :\n${notes}\n\n`;
  if (measures.length) {
    userContent += 'Mesures relevées :\n';
    measures.forEach(({ label, value }) => {
      userContent += `- ${label || '—'} : ${value ? value + ' cm' : '—'}\n`;
    });
    userContent += '\n';
  }
  if (trame) userContent += `\nComplète la trame suivante en renseignant chaque rubrique à partir des informations ci-dessus. Conserve exactement les titres et la structure. Si une information manque, écris À compléter par l'ergothérapeute.\n\nTRAME :\n${trame}`;
  else       userContent += 'Rédige un compte rendu structuré, clinique et professionnel. Utilise uniquement du texte courant (pas de markdown, pas de listes à puces). Chaque paragraphe thématique doit être séparé par une ligne vide. Ne génère pas de titre général ni d\'en-tête.';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: 'Tu es un assistant spécialisé en ergothérapie. Tu remplis une trame de compte rendu à partir des notes brutes. RÈGLES : 1) Tu n\'inventes rien qui ne soit pas dans les notes. 2) Si une information manque pour une section, encadre le contenu avec §§ et §§, ex : §§À compléter par l\'ergothérapeute§§. 3) Reformule en langage professionnel sans ajouter de contenu. 4) Termes interdits : chutogène (utiliser : risque de chute) ; glissance (utiliser : risque de chute ou surface glissante). 5) Commence par BROUILLON.',
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Erreur HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    editor.innerHTML = mdToHTML(text);

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
          runs.push(new TextRun({ text: child.textContent }));
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
