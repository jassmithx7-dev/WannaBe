# Project Context

## Overview

This project is a **fantasy football draft companion** with an **HTML data visualization dashboard**:

- Live draft board, rankings tables, roster views, and draft reports
- **WannaBeGms AI / Draft Companion** for 2026 Superflex PPR

**Draft Companion** is a static browser app: HTML + vanilla JS, no build step. Auth and persistence use **Supabase**; live league data comes from **Sleeper**; draft advice uses **Anthropic Claude** with a user-supplied API key.

**User flow:** `index.html` → `account.html` → `fantasy_draft_2026.html`

---

## Core Goals

- Render interactive HTML tables and views for draft-day decisions
- Merge external rankings and custom scoring into one player model
- Sync live league state from Sleeper (teams, picks, trades, keepers)
- Enable fantasy football draft analysis (VORP, suggestions, AI context, draft history)

**Data in:** `rankings_2026.json`, Sleeper API, Supabase, and optional manual export (`league_setup.json` from `1_league_setup.html`).

---

## Key Modules

Current repo is **flat root** (no build folders required):

| Area | Role | Location |
|------|------|----------|
| **Frontend** | HTML/CSS/JS UI | `index.html`, `account.html`, `fantasy_draft_2026.html`, `1_league_setup.html` |
| **Logic** | Scoring, ranking, integrations | `draft_app.js` — `CUSTOM_SCORES`, `calcVORP()`, Sleeper sync, AI, mock draft |
| **Assets** | Static data | `rankings_2026.json`, `logo.png` |

**Monolith note:** Almost all logic lives in `draft_app.js` (~4,100 lines). Preserve structure unless refactoring is requested; extract only when a change is substantial.

---

## Data Structures

Keep these shapes stable when loading or saving data.

**Player (runtime):** `name`, `team`, `pos`, `rank`, `adp`, `customScore`, `customRank`, `vorp`, `vorpRank`, `tier`, `bye`, `drafted`, optional `note`

**FantasyPros / rankings JSON row:** `playerName`, `team`, `position`, `ecrRank`, `tier`, `byeWeek`, `averageRank`, …

**League setup export:** `{ version, teams: [{ name, owner, slot, keepers }], trades, exportedAt }`

**Saved draft (Supabase):** `picks`, `team_rosters`, `team_names`, `team_user_ids`, `my_team_idx`, `draft_type` (`real` \| `mock`)

---

## External Services

| Service | Use |
|---------|-----|
| **Supabase** | Auth; tables `user_settings`, `saved_drafts`, `league_managers` |
| **Sleeper API** | League import, live pick sync, player team assignments |
| **Anthropic** | In-draft AI (`claude-sonnet-4-6`, context from `buildDraftContext()`) |
| **FantasyPros ECR** | Via `rankings_2026.json` (Apify scraper export) |

Default league: **12 teams · 18 rounds · snake · Superflex PPR**.

---

## Rules for AI changes

- Prefer simple JS over heavy frameworks unless needed
- Maintain readable table-based UI (grid columns, panel layout, position badges)
- Preserve data structure consistency (player objects, JSON export formats, Supabase row shapes)
- Minimize scope; match existing naming and inline-style patterns until a shared CSS layer exists
- Do not add tests, docs, or refactors unless requested

---

## Current Focus

- Build better UI for player comparison
- Optimize fantasy draft ranking logic *(VORP baselines, `CUSTOM_SCORES`, ECR merge, NFL OL/SOS factors)*

---

## Quick Reference

| File | Purpose |
|------|---------|
| `draft_app.js` | Auth, Sleeper, rankings, VORP, AI, mock draft, Supabase saves |
| `fantasy_draft_2026.html` | Main draft UI |
| `account.html` | Leagues hub, launch draft, draft history |
| `rankings_2026.json` | Drop-in ECR update (replace file to refresh) |
| `1_league_setup.html` | Offline slot/keeper/trade setup → `league_setup.json` |

**Run locally:** Static HTTP server required (`fetch` for JSON/API). No npm/build in repo.

**Branding:** WannaBeGms AI / Draft Companion (repo folder: DraftCompanion).
