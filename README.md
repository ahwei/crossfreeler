# CrossFreeler 🍷

A CrossOver-like graphical Wine frontend for macOS (Apple Silicon), built with Tauri 2 + React +
Vite — **built primarily for games**.

Manage multiple Wine bottles and launch Windows x64 apps and games in one click, without installing
Windows.

繁體中文說明：[README.zh-TW.md](./README.zh-TW.md)

## Features (v1)

- 🍾 Bottle (Wine prefix) management: create / rename / delete / open C: drive / winecfg
- 🎮 Game template: Wine Staging (esync) + game-oriented environment variable defaults
- ▶️ Run any `.exe` / `.msi` / `.bat`; one-click launch from shortcut cards
- 🔧 winetricks component installation (vcrun, dotnet, fonts, DirectX components…)
- 📜 Live log streaming panel
- ⚙️ Per-bottle Windows version and environment variables

See [SPEC.md](./SPEC.md) for the spec and roadmap (DXVK, built-in Wine runtime downloader).

## Requirements

- Apple Silicon Mac
- Rosetta 2
- At least one Wine engine (see [Setup](#setup))
- Optional: `brew install winetricks`

## Setup

### 1. Install Rosetta 2

```bash
softwareupdate --install-rosetta --agree-to-license
```

### 2. Install a Wine engine

CrossFreeler does not bundle Wine — it detects engines already on your machine, so install at least
one. Everything lives under the app's data directory:

```
~/Library/Application Support/CrossFreeler/
```

**Stable** — the baseline, fine for most apps.

Download a build from [Gcenx macOS Wine builds](https://github.com/Gcenx/macOS_Wine_builds/releases),
then place it so that `runtime/current/bin/wine` exists:

```bash
CF=~/Library/Application\ Support/CrossFreeler/runtime
mkdir -p "$CF"
# after unpacking Wine Stable.app:
cp -R "Wine Stable.app/Contents/Resources/wine" "$CF/wine-stable"
ln -sfn "$CF/wine-stable" "$CF/current"
```

Homebrew's `wine-stable` cask is deprecated (removal scheduled for 2026-09) and is no longer
recommended, though `/opt/homebrew/bin/wine` is still detected if you have it.

**Staging** — a newer Wine, needed by some patchers and launchers.

Unpack it into a directory named `wine-staging-*`; the newest one wins:

```bash
cp -R <unpacked-staging-wine> "$CF/wine-staging-9.x"
```

**CrossOver engine** — required for protected games.

Games shipping Themida / WinLicense / GameGuard (e.g. official Ragnarok Online) only run on a
CrossOver-derived engine. Any one of these is detected automatically:

- CrossOver.app in `/Applications` or `~/Applications`
- [Whisky](https://getwhisky.app)'s bundled WhiskyWine
- a manual copy at `runtime/crossover/bin/wine`

### 3. Build and run

```bash
npm install
npm run tauri dev     # development
npm run tauri build   # package .app / .dmg
```

Requires Node 22+ and Rust stable (`brew install rust`).

### 4. First launch

The app probes your environment on startup and the setup guide reports what it found. From there:

1. Create a bottle — pick a Windows version and an engine (choose the CrossOver engine for
   protected games).
2. Or import an existing Whisky / CrossOver bottle. The prefix is *shared*, not copied; removing it
   from CrossFreeler only unlinks it.
3. Run an installer, or add a shortcut to an `.exe` and double-click the card to launch.

Shortcuts can override the engine individually, so one bottle can run its patcher on staging while
the game itself runs on the CrossOver engine.

## Known limitations

- Online games using kernel anti-cheat (EAC / BattlEye) will not run — true of every Wine solution.
- Argument fields are split on whitespace; quoted arguments are not supported.

## License notice

This project invokes [Wine](https://www.winehq.org) as an external program. Wine is free software
licensed under the LGPL; its source is available at [winehq.org](https://www.winehq.org). macOS
builds come from [Gcenx/macOS_Wine_builds](https://github.com/Gcenx/macOS_Wine_builds).
