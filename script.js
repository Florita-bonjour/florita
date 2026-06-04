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
        system: 'Tu es un assistant spécialisé en ergothérapie. Tu remplis une trame de compte rendu à partir des notes brutes. RÈGLES : 1) Tu n\'inventes rien qui ne soit pas dans les notes. 2) Si une section manque écris À compléter par l\'ergothérapeute. 3) Reformule en langage professionnel sans ajouter de contenu. 4) Jamais le terme chutogène. 5) Commence par BROUILLON.',
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Erreur HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    editor.innerHTML = paragraphs.map(p =>
      `<p>${esc(p).replace(/\n/g, '<br>').replace(/§§(.+?)§§/g, '<mark class="hl">$1</mark>')}</p>`
    ).join('');

  } catch (err) {
    editor.innerHTML = `<p class="cr-placeholder">Erreur lors de la génération : ${esc(err.message)}</p>`;
  } finally {
    editor.setAttribute('contenteditable', 'true');
  }
}

/* ── Export PDF ─────────────────────────────────────────────────────── */
document.getElementById('btn-pdf').addEventListener('click', exportPDF);

function exportPDF() {
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW  = 210;
  const PH  = 297;
  const ML  = 22;
  const MR  = 22;
  const MT  = 22;
  const MB  = 22;
  const TW  = PW - ML - MR;

  let y = MT;

  const newPage = () => { doc.addPage(); y = MT; };
  const guard   = (h = 7) => { if (y + h > PH - MB) newPage(); };

  const ACCENT = [26,  79, 122];
  const TEXT   = [28,  43,  58];
  const MUTED  = [99, 112, 128];
  const BORDER = [208, 215, 222];

  /* ── En-tête du document ── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT);
  doc.text("Cabinet d'Ergothérapie", ML, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(document.getElementById('doc-date').textContent, PW - MR, y, { align: 'right' });

  y += 4.5;
  doc.text('12 rue des Lilas — 75000 Paris', ML, y);

  y += 5;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.line(ML, y, PW - MR, y);
  y += 8;

  /* ── Infos patient ── */
  const patient   = document.getElementById('field-patient').textContent.trim();
  const dob       = document.getElementById('field-dob').textContent.trim();
  const therapist = document.getElementById('field-therapist').textContent.trim();

  const infos = [
    ['Patient :', patient],
    ['Date de naissance :', dob],
    ['Thérapeute :', therapist],
  ];

  doc.setFontSize(8.5);
  infos.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(label, ML, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT);
    doc.text(value, ML + doc.getTextWidth(label) + 2, y);
    y += 5.5;
  });

  y += 5;

  /* ── Titre du CR ── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...ACCENT);
  doc.text('COMPTE RENDU D’ÉVALUATION ERGOTHÉRAPIQUE', ML, y);
  y += 4;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.line(ML, y, PW - MR, y);
  y += 8;

  /* ── Corps du document ── */
  const editor = document.getElementById('cr-editor');

  for (const node of editor.childNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    if (node.tagName === 'H3') {
      guard(14);
      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...ACCENT);
      doc.text(node.textContent.replace(/§§(.+?)§§/g, '$1').toUpperCase(), ML, y);
      y += 6;

    } else if (node.tagName === 'P') {
      guard(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...TEXT);

      const lines = doc.splitTextToSize(node.textContent.replace(/§§(.+?)§§/g, '$1'), TW);
      for (const line of lines) {
        guard(6);
        doc.text(line, ML, y);
        y += 5.8;
      }
      y += 1.5;
    }
  }

  /* ── Signature ── */
  y += 8;
  guard(18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Signature du thérapeute', PW - MR, y, { align: 'right' });
  y += 7;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(PW - MR - 50, y, PW - MR, y);

  /* ── Numéros de page ── */
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(170, 175, 185);
    doc.text(`${p} / ${total}`, PW / 2, PH - 12, { align: 'center' });
  }

  doc.save('compte-rendu-ergotherapie.pdf');
}
