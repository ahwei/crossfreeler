# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CrossFreeler is a CrossOver-like GUI frontend for Wine on macOS (Apple Silicon), aimed at running
Windows games. Tauri 2 (Rust backend) + React 19 + Vite + Tailwind 4 + Zustand.

Requires Node 22+ and Rust stable.

## Commands

```bash
npm install
npm run tauri dev     # dev mode (Vite + Rust, hot reload on both)
npm run tauri build   # package .app / .dmg
npm run build         # tsc typecheck + vite build (frontend only — the fastest check)
```

There is no test suite and no linter configured. `npm run build` is the type-check gate;
Rust is checked by `cargo check` inside `src-tauri/`.

## Architecture

**Everything Wine-related lives in Rust; the frontend never shells out.** The boundary is the
`invoke_handler` list in `src-tauri/src/lib.rs` — every backend capability is a `#[tauri::command]`
registered there, mirrored one-to-one in `src/lib/ipc.ts`. Adding a feature means touching both,
plus the shared shapes in `src/lib/types.ts` ⇄ `src-tauri/src/config.rs` (Rust structs are
`#[serde(rename_all = "camelCase")]`, so the TS interfaces are the same types by another name).

Rust modules:

- `config.rs` — `AppConfig` persisted to `~/Library/Application Support/CrossFreeler/config.json`
  (atomic write via `.tmp` + rename). Held in memory as `ConfigState(Mutex<AppConfig>)`, managed by
  Tauri. Read-modify-save is the pattern; new `Bottle` fields need `#[serde(default)]` or old
  configs fail to parse.
- `env.rs` — detects Rosetta, and three wine "runtimes" (see below). `resolve_wine()` is the single
  place that maps a runtime channel to a wine binary.
- `bottle.rs` — the bulk of the app: bottle CRUD, program/winetricks execution, registry tweaks,
  exe scanning, importing external bottles, shortcuts.
- `runner.rs` — process spawning. `run_and_wait` for long tasks (bottle creation, winetricks),
  `run_detached` for launching games.
- `icon.rs` — pulls the icon out of a PE exe (`pelite`), returns a PNG data URL.

Frontend: Zustand stores in `src/stores/` own all state; components are thin. `src/lib/events.ts`
`bootstrap()` runs once at module level (not in a React effect) to load data and subscribe to
backend events. `src/i18n/` is a hand-rolled dict store (zh/en) — `useT()` returns the dict;
all user-facing strings go through it.

## Runtime channels (the core domain concept)

A bottle has a `runtime`: `stable` | `staging` | `crossover`. It selects *which wine binary* runs the
program, and it exists because different engines are needed for different jobs:

- `crossover` — WhiskyWine / CrossOver.app / GPTK. Contains the commercial compatibility hacks needed
  by Themida/WinLicense/GameGuard-protected games (e.g. official Ragnarok Online). Stock Wine can't
  run these at all.
- `staging` — a newer Wine from `runtime/wine-staging-*`, for things the older CrossOver fork breaks
  (e.g. an RO patcher).
- `stable` — plain Wine; the fallback when the requested channel isn't installed.

Shortcuts carry an optional `runtime` override (`null` = follow the bottle), so one bottle can run
its patcher on staging and the game itself on crossover. `config.winePath` is a user override that
beats everything.

## Things that will bite you

- **Do not rename argv[0]** when spawning wine (`exec -a`). WhiskyWine/CrossOver locate their own
  support files via argv[0] and exit instantly if it's changed. `build_named_command` in `runner.rs`
  is dead code kept as a warning; the real fix for showing a game's name in macOS is an .app bundle.
- `runner.rs::apply_env` deliberately does `env_clear()` and whitelists a handful of vars, then sets
  `WINEPREFIX` and the bottle's own env. `cwd` is forced into the prefix — inheriting the app's cwd
  makes self-extracting installers dump their payload into the wrong directory.
- Imported Whisky/CrossOver bottles are *shared, not copied* (`prefix_path` is set). Deleting one
  must only unlink it from config — never `rm -rf` an external prefix.
- `runner.rs::is_noise` filters MoltenVK/Vulkan/SEH spam out of the log panel. Keep matches
  lowercase-compared; a case-sensitive check has leaked noise before.

Roadmap and deeper design notes: `SPEC.md`.
