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
const patient     = params.get('patient')     || '';
const dob         = params.get('dob')         || '';
const therapist   = params.get('therapist')   || '';
const destination = params.get('destination') || '';
const notes       = params.get('notes')       || '';
let   measures    = [];
try { measures = JSON.parse(params.get('measures') || '[]'); } catch (_) {}

const hasData = patient || dob || therapist || destination || notes || measures.length;

if (hasData) {
  if (patient)   document.getElementById('field-patient').textContent   = patient;
  if (dob)       document.getElementById('field-dob').textContent       = dob;
  if (therapist) document.getElementById('field-therapist').textContent = therapist;

  let crHTML = '';
  if (destination) crHTML += `<h3>Destination</h3><p>${esc(destination)}</p>`;
  if (notes)       crHTML += `<h3>Observations</h3><p>${esc(notes).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
  if (measures.length) {
    crHTML += '<h3>Mesures relevées</h3>';
    measures.forEach(({ label, value }) => {
      crHTML += `<p>${esc(label || '—')} : <strong>${esc(value ? value + ' cm' : '—')}</strong></p>`;
    });
  }

  if (crHTML) document.getElementById('cr-editor').innerHTML = crHTML;
} else {
  document.getElementById('cr-editor').innerHTML =
    `<p class="cr-placeholder">Le compte rendu généré apparaîtra ici. Ce champ est entièrement modifiable avant l'impression.</p>`;
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
      doc.text(node.textContent.toUpperCase(), ML, y);
      y += 6;

    } else if (node.tagName === 'P') {
      guard(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...TEXT);

      const lines = doc.splitTextToSize(node.textContent, TW);
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
