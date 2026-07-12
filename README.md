# CrossFreeler 🍷

macOS（Apple Silicon）上類 CrossOver 的 Wine 圖形化前端 — 用 Tauri 2 + React + Vite 打造，**以遊戲為主要使用情境**。

管理多個 Wine bottles、一鍵執行 Windows x64 軟體與遊戲，不需安裝完整 Windows。

## 功能（v1）

- 🍾 Bottle（Wine prefix）管理：建立／改名／刪除／開啟 C 槽／winecfg
- 🎮 遊戲範本：Wine Staging（esync）+ 遊戲用環境變數預設
- ▶️ 執行任意 `.exe` / `.msi` / `.bat`，程式捷徑卡片一鍵啟動
- 🔧 winetricks 元件安裝（vcrun、dotnet、字型、DirectX 元件…）
- 📜 即時 log 串流面板
- ⚙️ Per-bottle Windows 版本與環境變數設定

規格與 roadmap（DXVK、Wine runtime 內建下載器）見 [SPEC.md](./SPEC.md)。

## 環境需求

- Apple Silicon Mac + Rosetta 2（`softwareupdate --install-rosetta --agree-to-license`）
- Wine：建議直接下載 [Gcenx macOS Wine builds](https://github.com/Gcenx/macOS_Wine_builds/releases)
  解壓後將 `Wine Stable.app/Contents/Resources/wine` 放到
  `~/Library/Application Support/CrossFreeler/runtime/`（並建立 `current` symlink），app 會自動偵測。
  > 注意：Homebrew 的 `wine-stable` cask 已被標記 deprecated（2026-09 停用），不再建議。
- （選用）`brew install winetricks`

## 開發

```bash
npm install
npm run tauri dev     # 開發模式
npm run tauri build   # 打包 .app / .dmg
```

需要 Node 22+ 與 Rust stable（`brew install rust`）。

## 已知限制

- 使用 kernel anti-cheat（EAC / BattlEye）的線上遊戲無法執行（所有 Wine 方案皆然）。
- 參數欄位以空白切割，不支援含引號的參數。

## 授權聲明

本專案透過外部程序呼叫 [Wine](https://www.winehq.org)。Wine 為 LGPL 授權的自由軟體，
其原始碼可於 [winehq.org](https://www.winehq.org) 取得；macOS 建置版來自
[Gcenx/macOS_Wine_builds](https://github.com/Gcenx/macOS_Wine_builds)。
