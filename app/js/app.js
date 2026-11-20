// Vice Ledger — boot and rendering.
//
// One page, four views over a single trophy list: the checklist with
// its guide pane, the roadmap, the missables page and the Next up
// planner. The data is app/data/trophies.json (the official list plus
// our guides); the player's progress is store.js's localStorage
// record. Everything renders from those two inputs and nothing else.

import {
  loadState, saveState, isEarned, setEarned, counterOf,
  downloadExport, readImport,
} from './store.js';
import {
  KIND_LABELS, isShielded, isConcealed, displayName,
  displayDescription, visibleTrophies,
} from './filters.js';

const GRADE_POINTS = { bronze: 15, silver: 30, gold: 90, platinum: 300 };

const state = loadState();
const ui = { view: 'guide', kind: 'all', query: '', selectedId: 9 };
let trophies = [];
let stages = [];

const $ = (sel) => document.querySelector(sel);

function esc(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function byId(id) {
  return trophies.find((t) => t.id === id);
}

/* ---------- header progress ---------- */

function renderProgress() {
  const earned = trophies.filter((t) => isEarned(state, t.id));
  $('#earned-count').textContent = String(earned.length);
  $('#progress-bar').style.width = `${(earned.length / trophies.length) * 100}%`;
  const tally = ['platinum', 'gold', 'silver', 'bronze'].map((grade) => {
    const total = trophies.filter((t) => t.grade === grade).length;
    const got = earned.filter((t) => t.grade === grade).length;
    return `${got}/${total} ${grade}`;
  });
  $('#grade-tally').textContent = tally.join(' · ');
  const points = earned.reduce((sum, t) => sum + (GRADE_POINTS[t.grade] ?? 0), 0);
  const pointsTotal = trophies.reduce((sum, t) => sum + (GRADE_POINTS[t.grade] ?? 0), 0);
  $('#points-line').textContent = `${points} of ${pointsTotal} trophy points`;
}

/* ---------- checklist ---------- */

function tagRow(trophy) {
  const tags = [
    `<span class="tag tag-grade">${esc(trophy.grade)}</span>`,
    `<span class="tag">${esc(KIND_LABELS[trophy.kind] ?? trophy.kind)}</span>`,
  ];
  if (trophy.missable) tags.push('<span class="tag tag-missable">Missable</span>');
  if (trophy.hidden) tags.push('<span class="tag">Hidden on PSN</span>');
  if (trophy.target) {
    tags.push(`<span class="tag tag-counter">${counterOf(state, trophy)} / ${trophy.target} ${esc(trophy.targetLabel ?? '')}</span>`);
  }
  return `<div class="tag-row">${tags.join('')}</div>`;
}

function renderList() {
  const list = $('#trophy-list');
  const visible = visibleTrophies(trophies, state, ui);
  if (visible.length === 0) {
    list.innerHTML = '<p class="empty-note">No trophy matches those filters. Loosen the search or pick another kind.</p>';
    return;
  }
  list.innerHTML = visible.map((trophy) => {
    const earned = isEarned(state, trophy.id);
    const masked = isShielded(trophy, state) || isConcealed(trophy, state);
    const counter = trophy.target
      ? `<label class="counter-box">count
           <input type="number" min="0" max="${trophy.target}" value="${counterOf(state, trophy)}"
             data-counter="${trophy.id}" aria-label="Progress count for ${esc(trophy.name)}">
         </label>`
      : '';
    return `<article class="trophy-row${earned ? ' is-earned' : ''}${ui.selectedId === trophy.id ? ' is-selected' : ''}" data-row="${trophy.id}">
      <input class="trophy-check" type="checkbox" data-earn="${trophy.id}" ${earned ? 'checked' : ''}
        aria-label="Mark ${esc(trophy.name)} earned">
      <span class="medal medal-${trophy.grade}" aria-hidden="true"></span>
      <button class="trophy-open" type="button" data-open="${trophy.id}">
        <span class="trophy-name${masked ? ' masked-name' : ''}">${esc(displayName(trophy, state))}</span>
        <span class="trophy-desc${masked ? ' masked-desc' : ''}">${esc(displayDescription(trophy, state))}</span>
        ${tagRow(trophy)}
      </button>
      ${counter}
    </article>`;
  }).join('');

  list.querySelectorAll('[data-earn]').forEach((box) => {
    box.addEventListener('change', () => {
      setEarned(state, Number(box.dataset.earn), box.checked);
      saveState(state);
      renderAll();
    });
  });
  list.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.selectedId = Number(btn.dataset.open);
      renderList();
      renderPane();
    });
  });
  list.querySelectorAll('[data-counter]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = Number(input.dataset.counter);
      state.counters[id] = Math.max(0, Number(input.value) || 0);
      saveState(state);
      renderList();
    });
  });
}

/* ---------- guide pane ---------- */

function renderPane() {
  const pane = $('#guide-pane');
  const trophy = byId(ui.selectedId) ?? trophies[0];
  if (!trophy) { pane.innerHTML = ''; return; }
  const earned = isEarned(state, trophy.id);
  const masked = isShielded(trophy, state) || isConcealed(trophy, state);
  if (masked) {
    pane.innerHTML = `<h2 class="masked-name">${esc(displayName(trophy, state))}</h2>
      <p class="official">${esc(displayDescription(trophy, state))}</p>
      <p>This trophy's guide is covered by the same mask. Earn the trophy, or lift the
      spoiler shield / reveal hidden trophies in the toolbar, to read it.</p>
      <div class="pane-actions">
        <button class="earn-btn" type="button" data-pane-earn="${trophy.id}">${earned ? 'Earned ✓ — tap to undo' : 'Mark earned'}</button>
      </div>`;
  } else {
    const counter = trophy.target
      ? `<h3>Progress</h3><p>${counterOf(state, trophy)} of ${trophy.target} ${esc(trophy.targetLabel ?? '')} so far.
         Update the count on the checklist row; at the target, tick the trophy earned.</p>`
      : '';
    const missable = trophy.missable
      ? `<p class="missable-warning"><strong>Missable.</strong> ${esc(trophy.missableNote ?? '')}</p>`
      : '';
    const sources = (trophy.sources ?? []).map((s) => `<li>${esc(s)}</li>`).join('');
    pane.innerHTML = `<h2>${esc(trophy.name)}</h2>
      <p class="official">“${esc(trophy.description)}” — official description</p>
      ${tagRow(trophy)}
      ${missable}
      <h3>Guide</h3>
      <p>${esc(trophy.guide)}</p>
      ${counter}
      <h3>Sources</h3>
      <div class="sources-box"><ul>${sources}</ul></div>
      <h3>Your note</h3>
      <textarea class="note-area" data-note="${trophy.id}" placeholder="Your own reminder for this trophy…">${esc(state.notes[trophy.id] ?? '')}</textarea>
      <div class="pane-actions">
        <button class="earn-btn" type="button" data-pane-earn="${trophy.id}">${earned ? 'Earned ✓ — tap to undo' : 'Mark earned'}</button>
      </div>`;
  }
  pane.querySelector('[data-pane-earn]')?.addEventListener('click', () => {
    setEarned(state, trophy.id, !isEarned(state, trophy.id));
    saveState(state);
    renderAll();
  });
  pane.querySelector('[data-note]')?.addEventListener('change', (event) => {
    state.notes[trophy.id] = event.target.value;
    saveState(state);
  });
}

/* ---------- roadmap, missables, next up ---------- */

function stageTrophies(stage) {
  return trophies.filter((t) => t.stage === stage.id);
}

function renderRoadmap() {
  $('#roadmap-body').innerHTML = stages.map((stage) => {
    const members = stageTrophies(stage);
    const done = members.filter((t) => isEarned(state, t.id)).length;
    const chips = members.map((t) => {
      const earned = isEarned(state, t.id);
      return `<button class="stage-chip${earned ? ' done' : ''}" type="button" data-jump="${t.id}">${esc(displayName(t, state))}</button>`;
    }).join('');
    return `<article class="stage-block">
      <h3>Stage ${stage.id} — ${esc(stage.title)} <span class="tag">${done}/${members.length}</span></h3>
      <p>${esc(stage.blurb)}</p>
      <div class="stage-chips">${chips}</div>
    </article>`;
  }).join('');
  $('#roadmap-body').querySelectorAll('[data-jump]').forEach((chip) => {
    chip.addEventListener('click', () => jumpTo(Number(chip.dataset.jump)));
  });
}

function renderMissables() {
  const missables = trophies.filter((t) => t.missable);
  $('#missables-body').innerHTML =
    `<p class="empty-note" style="padding:0 0 6px">These ${missables.length} trophies hang on a moment,
     a choice or a mission beat that the story does not offer twice. The flags are built from the
     official descriptions; where a description leaves room for doubt, the note says so — treat
     these as “do them when you see them”, not as certainties.</p>` +
    missables.map((t) => `<article class="missable-entry">
      <h3>${esc(displayName(t, state))} <span class="tag tag-grade">${esc(t.grade)}</span>
        ${isEarned(state, t.id) ? '<span class="tag">Earned</span>' : ''}</h3>
      <p>“${esc(displayDescription(t, state))}”</p>
      <p>${esc(t.missableNote ?? '')}</p>
      <p><button class="stage-chip" type="button" data-jump="${t.id}">Open its guide</button></p>
    </article>`).join('');
  $('#missables-body').querySelectorAll('[data-jump]').forEach((chip) => {
    chip.addEventListener('click', () => jumpTo(Number(chip.dataset.jump)));
  });
}

function renderNext() {
  const unearned = trophies.filter((t) => !isEarned(state, t.id));
  const currentStage = stages.find((s) => stageTrophies(s).some((t) => !isEarned(state, t.id)))?.id ?? 8;
  const queue = [...unearned].sort((a, b) => {
    if (a.missable !== b.missable) return a.missable ? -1 : 1;
    if (a.stage !== b.stage) return a.stage - b.stage;
    return a.id - b.id;
  }).slice(0, 8);
  $('#next-body').innerHTML = queue.length === 0
    ? '<p class="empty-note">Nothing left — the platinum is yours. Vice got a price, and you paid it.</p>'
    : queue.map((t) => {
      const reason = t.missable
        ? 'Missable — catch it before the story moves on.'
        : t.stage === currentStage
          ? `Next on the roadmap: stage ${t.stage}.`
          : `Roadmap stage ${t.stage}.`;
      const progress = t.target ? ` Progress so far: ${counterOf(state, t)} / ${t.target} ${esc(t.targetLabel ?? '')}.` : '';
      return `<article class="next-entry">
        <h3>${esc(displayName(t, state))} <span class="tag tag-grade">${esc(t.grade)}</span></h3>
        <p>${reason}${progress}</p>
        <p><button class="stage-chip" type="button" data-jump="${t.id}">Open its guide</button></p>
      </article>`;
    }).join('');
  $('#next-body').querySelectorAll('[data-jump]').forEach((chip) => {
    chip.addEventListener('click', () => jumpTo(Number(chip.dataset.jump)));
  });
}

function jumpTo(id) {
  ui.selectedId = id;
  switchView('guide');
  renderAll();
}

/* ---------- chrome: tabs, toolbar, import/export ---------- */

function switchView(view) {
  ui.view = view;
  document.querySelectorAll('#view-tabs .tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.view === view);
  });
  document.querySelectorAll('.view').forEach((section) => {
    section.classList.toggle('is-active', section.id === `view-${view}`);
  });
}

function renderAll() {
  renderProgress();
  renderList();
  renderPane();
  renderRoadmap();
  renderMissables();
  renderNext();
}

function wireChrome() {
  document.querySelectorAll('#view-tabs .tab').forEach((tab) => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });
  document.querySelectorAll('#kind-filters .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      ui.kind = chip.dataset.kind;
      document.querySelectorAll('#kind-filters .chip').forEach((c) => {
        c.classList.toggle('is-active', c === chip);
      });
      renderList();
    });
  });
  $('#search').addEventListener('input', (event) => {
    ui.query = event.target.value;
    renderList();
  });
  const bindToggle = (selector, key) => {
    const box = $(selector);
    box.checked = Boolean(state.settings[key]);
    box.addEventListener('change', () => {
      state.settings[key] = box.checked;
      saveState(state);
      renderAll();
    });
  };
  bindToggle('#spoiler-toggle', 'spoilerShield');
  bindToggle('#hidden-toggle', 'revealHidden');
  bindToggle('#unearned-toggle', 'unearnedOnly');
  $('#export-btn').addEventListener('click', () => downloadExport(state));
  const fileInput = $('#import-file');
  $('#import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files?.[0]) return;
    try {
      const imported = await readImport(fileInput.files[0]);
      Object.assign(state, imported);
      saveState(state);
      wireChrome.refreshToggles();
      renderAll();
    } catch {
      alert('That file is not a Vice Ledger progress export.');
    }
  });
  wireChrome.refreshToggles = () => {
    $('#spoiler-toggle').checked = Boolean(state.settings.spoilerShield);
    $('#hidden-toggle').checked = Boolean(state.settings.revealHidden);
    $('#unearned-toggle').checked = Boolean(state.settings.unearnedOnly);
  };
}

/* ---------- boot ---------- */

async function boot() {
  const response = await fetch('data/trophies.json');
  const data = await response.json();
  trophies = data.trophies;
  stages = data.stages ?? [];
  wireChrome();
  renderAll();
}

boot();
