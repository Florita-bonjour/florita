const measuresList  = document.getElementById('measures-list');
const measuresEmpty = document.getElementById('measures-empty');
function syncEmpty() {
  measuresEmpty.style.display =
    measuresList.querySelectorAll('.measure-row').length === 0 ? 'block' : 'none';
}
function addRow() {
  const row = document.createElement('div');
  row.className = 'measure-row';
  row.innerHTML = `
    <input type="text" class="m-label" placeholder="Intitulé (ex : largeur couloir)" aria-label="Intitulé" />
    <div class="unit-wrap">
      <input type="number" class="m-value" placeholder="0" min="0" step="0.1" aria-label="Valeur en cm" />
      <span class="unit-badge">cm</span>
    </div>
    <button type="button" class="btn-remove" aria-label="Supprimer">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  row.querySelector('.btn-remove').addEventListener('click', () => {
    row.remove();
    syncEmpty();
  });
  measuresList.appendChild(row);
  syncEmpty();
  row.querySelector('.m-label').focus();
}
document.getElementById('btn-add').addEventListener('click', addRow);
/* ── Échappement HTML ── */
function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
/* ── Génération du CR et redirection ── */
document.getElementById('cr-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const trameSelect = document.getElementById('trame');
  const trameVal    = trameSelect.value;
  const isDefault   = ['vad', 'tel', 'action'].includes(trameVal);
  const trameKey    = isDefault ? trameVal : 'custom';
  const trameContent = isDefault ? null : (trameSelect.options[trameSelect.selectedIndex].dataset.content || '');

  const destination = document.getElementById('destination').value;
  const notes       = document.getElementById('notes').value.trim();
  const measures = [];
  measuresList.querySelectorAll('.measure-row').forEach(row => {
    const label = row.querySelector('.m-label').value.trim();
    const value = row.querySelector('.m-value').value.trim();
    if (label || value) measures.push({ label, value });
  });
  const sexe    = document.getElementById('sexe').value;
  const dateVad = document.getElementById('date-vad').value;
  const ville   = document.getElementById('ville').value.trim();
  localStorage.setItem('florita-cr-data', JSON.stringify({
    trame: trameKey, trame_content: trameContent,
    destination, notes, measures, sexe, dateVad, ville
  }));
  window.location.href = 'index.html';
});

/* ── Chargement des trames personnalisées ── */
(async function () {
  const sb = window.floritaSb;
  if (!sb) return;
  const { data } = await sb.from('trames').select('id, name, content').order('created_at', { ascending: true });
  if (!data || !data.length) return;
  const select = document.getElementById('trame');
  const group  = document.createElement('optgroup');
  group.label  = 'Mes trames';
  data.forEach(t => {
    const opt         = document.createElement('option');
    opt.value         = t.id;
    opt.textContent   = t.name;
    opt.dataset.content = t.content;
    group.appendChild(opt);
  });
  select.appendChild(group);
})();