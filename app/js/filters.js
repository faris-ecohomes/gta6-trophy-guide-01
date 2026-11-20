// Vice Ledger — which trophies a view shows, and what a masked
// trophy looks like while the spoiler shield or PlayStation's own
// hidden flag covers it.

export const KIND_LABELS = {
  story: 'Story',
  collectibles: 'Collectibles',
  activities: 'Activities',
  feats: 'Feats',
  completion: 'Completion',
};

// A story trophy is masked while the spoiler shield is on and the
// trophy is unearned: its name and description are replaced, in the
// list and in the guide pane alike, until it is earned.
export function isShielded(trophy, state) {
  return (
    state.settings.spoilerShield &&
    trophy.kind === 'story' &&
    !state.earned.includes(trophy.id)
  );
}

// A trophy PlayStation lists as hidden shows as a hidden trophy
// unless the player turns on "reveal hidden" or has earned it.
export function isConcealed(trophy, state) {
  return trophy.hidden && !state.settings.revealHidden && !state.earned.includes(trophy.id);
}

export function displayName(trophy, state) {
  if (isShielded(trophy, state)) return 'Shielded story trophy';
  if (isConcealed(trophy, state)) return 'Hidden Trophy';
  return trophy.name;
}

export function displayDescription(trophy, state) {
  if (isShielded(trophy, state)) {
    return 'The spoiler shield is hiding this story beat until you earn it.';
  }
  if (isConcealed(trophy, state)) {
    return 'PlayStation keeps this trophy hidden until it is earned.';
  }
  return trophy.description;
}

// The checklist filter: kind chip (with "missable" as a flag rather
// than a kind), the unearned-only switch, and a search that reads the
// name, description, guide and kind of every trophy — masked ones are
// searched by their real text, so a player hunting a name can still
// find the row the shield is covering.
export function visibleTrophies(trophies, state, ui) {
  const query = ui.query.trim().toLowerCase();
  return trophies.filter((trophy) => {
    if (ui.kind === 'missable') {
      if (!trophy.missable) return false;
    } else if (ui.kind !== 'all' && trophy.kind !== ui.kind) {
      return false;
    }
    if (state.settings.unearnedOnly && state.earned.includes(trophy.id)) return false;
    if (!query) return true;
    const haystack = [trophy.name, trophy.description, trophy.guide, KIND_LABELS[trophy.kind] ?? '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}
