# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Loading the Extension

There is no build step. Load `extension/` directly as an unpacked extension in Chrome at `chrome://extensions` → "Load unpacked". After any file change, click the refresh icon on the extension card.

## Architecture

This is a Manifest V3 Chrome extension with no external dependencies or bundler.

**Data flow for energy display:**
1. `content/content-script.js` runs on every page, collects DOM/network/media metrics every 10s, and posts them to the service worker via `chrome.runtime.sendMessage`.
2. `background/service-worker.js` receives metrics, calls `estimateWatts()` for frontend cost, then calls `resolveAIWatts()` to detect the AI platform and compute backend inference cost. The sum (`totalWatts`) is stored in `tabTotalWatts[tabId]` and persisted to `chrome.storage.local` via `appendWatts()`.
3. `popup/popup.js` polls `GET_METRICS` every 5s and displays `totalWatts` directly — it uses the service worker's pre-computed value, not its own local estimate.
4. `options/options.html` (the settings/history page) requests `GET_HISTORY` and renders the stored array as a bar chart.

**Key coupling:** The popup's displayed watts and the history graph must show the same number. The graph reads from `wattsHistory` in storage, which is written by the service worker using the same `totalWatts` value the popup shows.

**AI watts calculation:** `AIEnergyManager.energyToWatts()` converts accumulated Wh to an instantaneous watt figure by dividing by session duration. This value grows small as the session lengthens (energy is spread over more hours). If the tab has been open a long time, `aiWatts` will approach 0 even for active AI sites — this is intentional.

## File Roles

| File | Role |
|---|---|
| `background/service-worker.js` | Receives metrics, computes totals, owns storage writes |
| `content/content-script.js` | Passive metric collection only — no energy math |
| `lib/energy-estimator.js` | Frontend heuristic: DOM + mutations + network + media → watts (0.1–5 W range) |
| `lib/ai-energy-database.js` | AI site detection patterns + `AIEnergyManager` class |
| `lib/storage.js` | `appendWatts` / `readHistory` / `clearHistory` against `chrome.storage.local` |
| `popup/popup.js` | Reads `totalWatts` from SW; does NOT re-estimate |
| `options/options.js` | Reads history array, renders canvas bar chart, computes Current/Avg/Peak stats |

## Constants to Know

- Light bulb comparison: **6 W** (not 60 W)
- History cap: 120 entries (~20 min at 10s sampling)
- Storage key: `'wattsHistory'`
- History entry shape: `{ ts: number, watts: number, site: string|null }`
- `energyPerQuery` values are in **Wh** (watt-hours), not watts

## Scope Constraints (from SKILL.md)

Do not add: premium access, full analytics dashboard, OODA agent, pattern recognition, notifications, website integration, export/import, or advanced settings. MVP only.
