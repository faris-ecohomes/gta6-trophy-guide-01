# Vice Ledger — a GTA VI trophy guide and tracker

![Competition](https://make.fun/badge/gta6-trophy-guide-01.svg)
![Rank](https://make.fun/badge/gta6-trophy-guide-01/faris-ecohomes/gta6-trophy-guide-01/rank.svg)
![Reward](https://make.fun/badge/gta6-trophy-guide-01/faris-ecohomes/gta6-trophy-guide-01/reward.svg)

An offline guide and tracker for all 55 PlayStation 5 trophies of
Grand Theft Auto VI, built for the make.fun bounty
[gta6-trophy-guide-01](https://make.fun/bounty/gta6-trophy-guide-01).

Open `app/index.html` from any static file server (or run `node serve.ts`
and visit http://localhost:8080) and the guide works with the network off:
every file it loads lives under `app/`, and it asks the network for nothing.

## What it does

- **Checklist of the whole official list.** Every trophy with the name,
  description and grade PlayStation publishes, a checkbox to mark it earned,
  and a progress counter for the trophies PlayStation tracks by count
  (250 stunts, 42 shooting-range challenges, $250,000 laundered, and so on).
- **A guide for every trophy, in our own words**, each one naming its
  sources: the official list on Exophase for the name, description and
  grade, PSNProfiles for the progress target where PlayStation tracks one,
  and our own advice — drawn from the official description and flagged
  honestly where a detail is not yet pinned down in the game.
- **Roadmap to the platinum** in eight stages, ordered so the missable
  trophies are dealt with before the story closes the doors behind them.
- **Missables page** flagging every trophy the official descriptions mark
  as tied to a one-time moment, choice or mission beat.
- **Spoiler shield**: story trophies you have not earned yet show masked
  names and descriptions until you earn them or lift the shield. A separate
  switch reveals the trophies PlayStation itself keeps hidden.
- **Saved progress** in the browser (localStorage), with export to a file
  and import back, per-trophy notes, and a "Next up" planner that queues
  missables first, then whatever your current roadmap stage still owes.

## Layout

- `main.ts` — the hand-in program (Node 22, standard library only). It
  copies `app/` and `screenshots/` to the output directory and writes
  `dossier.json` with the vendored make.fun library.
- `app/` — the guide itself: `index.html`, styles under `css/`, ES modules
  under `js/`, and the trophy data at `app/data/trophies.json`.
- `screenshots/` — renders of the guide taken from its own code.
- `vendor/makefun-frontend.ts` — the kit's dossier library, unchanged.

## Trophy data

Names, descriptions and grades are the official PlayStation 5 list as
frozen on 2026-11-18; Exophase and PSNProfiles agree on every one. The
kind, stage and missable markings are built from those official
descriptions. No Rockstar Games logo, artwork or game screenshot appears
anywhere in the guide; the look is our own.

Licensed under the MIT License (see `LICENSE`).
