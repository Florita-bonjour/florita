const measuresList  = document.getElementById('measures-list');
const measuresEmpty = document.getElementById('measures-empty');

function syncEmpty() {
  measuresEmpty.style.display =
    measuresList.querySelectorAll('.measure-row').length === 0 ? 'block' : 'none';
}

function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function addRow(label, value) {
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
  if (label !== undefined) row.querySelector('.m-label').value = label;
  if (value !== undefined) row.querySelector('.m-value').value = value;
  row.querySelector('.btn-remove').addEventListener('click', () => {
    row.remove();
    syncEmpty();
    scheduleSave();
  });
  measuresList.appendChild(row);
  syncEmpty();
  if (label === undefined) row.querySelector('.m-label').focus();
}

document.getElementById('btn-add').addEventListener('click', () => {
  addRow();
  scheduleSave();
});

/* ── Draft auto-save ─────────────────────────────────────────────── */
let draftId   = null;
let saveTimer = null;
let creating  = false;

function collectDraft() {
  const measures = [];
  measuresList.querySelectorAll('.measure-row').forEach(row => {
    const label = row.querySelector('.m-label').value.trim();
    const value = row.querySelector('.m-value').value.trim();
    if (label || value) measures.push({ label, value });
  });
  return {
    destination: document.getElementById('destination').value || null,
    trame_key:   document.getElementById('trame').value || null,
    sexe:        document.getElementById('sexe').value || null,
    date_vad:    document.getElementById('date-vad').value || null,
    ville:       document.getElementById('ville').value.trim() || null,
    notes:       document.getElementById('notes').value || null,
    measures,
  };
}

async function createDraft() {
  if (creating || draftId) return;
  creating = true;
  const sb = window.floritaSb;
  if (!sb) { creating = false; return; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { creating = false; return; }
  const { data, error } = await sb.from('drafts')
    .insert({ user_id: session.user.id, ...collectDraft() })
    .select('id').single();
  creating = false;
  if (error || !data) { console.error('Draft create failed:', error); return; }
  draftId = data.id;
  history.replaceState(null, '', '?draft=' + draftId);
}

async function saveDraft() {
  if (!draftId) return;
  const sb = window.floritaSb;
  if (!sb) return;
  await sb.from('drafts').update(collectDraft()).eq('id', draftId);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!draftId) await createDraft();
    else await saveDraft();
  }, 800);
}

document.getElementById('cr-form').addEventListener('input', scheduleSave);
document.getElementById('cr-form').addEventListener('change', scheduleSave);

/* ── Soumission ───────────────────────────────────────────────────── */
document.getElementById('cr-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearTimeout(saveTimer);
  if (!draftId) await createDraft();
  else await saveDraft();

  const trameSelect  = document.getElementById('trame');
  const selectedOpt  = trameSelect.options[trameSelect.selectedIndex];
  const trameContent = selectedOpt ? (selectedOpt.dataset.content || '') : '';

  const destination = document.getElementById('destination').value;
  const notes       = document.getElementById('notes').value.trim();
  const measures    = [];
  measuresList.querySelectorAll('.measure-row').forEach(row => {
    const label = row.querySelector('.m-label').value.trim();
    const value = row.querySelector('.m-value').value.trim();
    if (label || value) measures.push({ label, value });
  });
  const sexe    = document.getElementById('sexe').value;
  const dateVad = document.getElementById('date-vad').value;
  const ville   = document.getElementById('ville').value.trim();

  localStorage.setItem('florita-cr-data', JSON.stringify({
    trame: 'custom', trame_content: trameContent,
    destination, notes, measures, sexe, dateVad, ville,
    draft_id: draftId,
  }));
  window.location.href = 'index.html';
});

/* ── Chargement des trames ─────────────────────────────────────────── */
let pendingTrameKey = null;

(async function loadTrames() {
  const sb        = window.floritaSb;
  const select    = document.getElementById('trame');
  const noMsg     = document.getElementById('no-trames-msg');
  const submitBtn = document.querySelector('.btn-generate');
  if (!sb) return;

  const { data } = await sb.from('trames').select('id, name, content').order('created_at', { ascending: true });

  select.innerHTML = '';

  if (!data || !data.length) {
    select.style.display = 'none';
    noMsg.style.display  = 'block';
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  data.forEach(t => {
    const opt           = document.createElement('option');
    opt.value           = t.id;
    opt.textContent     = t.name;
    opt.dataset.content = t.content;
    select.appendChild(opt);
  });
  select.disabled = false;

  if (pendingTrameKey) {
    select.value    = pendingTrameKey;
    pendingTrameKey = null;
  }
})();

/* ── Chargement d'un brouillon existant ───────────────────────────── */
(async function loadDraft() {
  const id = new URLSearchParams(window.location.search).get('draft');
  if (!id) return;

  const sb = window.floritaSb;
  if (!sb) return;

  const { data, error } = await sb.from('drafts').select('*').eq('id', id).single();
  if (error || !data) return;

  if (data.status === 'generated') {
    await sb.from('drafts').update({ status: 'drafting' }).eq('id', id);
  }

  draftId = data.id;

  document.getElementById('destination').value = data.destination || '';
  document.getElementById('sexe').value        = data.sexe || '';
  document.getElementById('date-vad').value    = data.date_vad || '';
  document.getElementById('ville').value       = data.ville || '';
  document.getElementById('notes').value       = data.notes || '';

  const trameSelect = document.getElementById('trame');
  if (data.trame_key) {
    if (!trameSelect.disabled && trameSelect.options.length > 0) {
      trameSelect.value = data.trame_key;
    } else {
      pendingTrameKey = data.trame_key;
    }
  }

  if (Array.isArray(data.measures) && data.measures.length) {
    data.measures.forEach(m => addRow(m.label || '', m.value || ''));
  }
})();
