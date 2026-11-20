// Vice Ledger — saved progress.
//
// Everything the tracker remembers lives in one localStorage record:
// which trophies are earned, the running counters for the trophies
// PlayStation tracks by count, the player's own note on each trophy,
// and the three display settings (spoiler shield, reveal hidden,
// unearned only). Export writes that record to a JSON file; import
// reads one back. Nothing is sent anywhere.

export const STORAGE_KEY = 'vice-ledger-gta6-v1';

export function blankState() {
  return {
    earned: [],
    counters: {},
    notes: {},
    settings: { spoilerShield: false, revealHidden: false, unearnedOnly: false },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw);
    const state = blankState();
    if (Array.isArray(parsed.earned)) state.earned = parsed.earned.filter(Number.isInteger);
    if (parsed.counters && typeof parsed.counters === 'object') state.counters = parsed.counters;
    if (parsed.notes && typeof parsed.notes === 'object') state.notes = parsed.notes;
    if (parsed.settings && typeof parsed.settings === 'object') {
      Object.assign(state.settings, parsed.settings);
    }
    return state;
  } catch {
    return blankState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isEarned(state, id) {
  return state.earned.includes(id);
}

export function setEarned(state, id, on) {
  state.earned = on
    ? [...new Set([...state.earned, id])]
    : state.earned.filter((x) => x !== id);
}

export function counterOf(state, trophy) {
  return Number(state.counters[trophy.id] ?? 0);
}

export function downloadExport(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vice-ledger-progress.json';
  a.click();
  URL.revokeObjectURL(url);
}

export async function readImport(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const state = blankState();
  if (Array.isArray(parsed.earned)) state.earned = parsed.earned.filter(Number.isInteger);
  if (parsed.counters && typeof parsed.counters === 'object') state.counters = parsed.counters;
  if (parsed.notes && typeof parsed.notes === 'object') state.notes = parsed.notes;
  if (parsed.settings && typeof parsed.settings === 'object') {
    Object.assign(state.settings, parsed.settings);
  }
  return state;
}
