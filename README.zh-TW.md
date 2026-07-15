# CrossFreeler 🍷

macOS（Apple Silicon）上類 CrossOver 的 Wine 圖形化前端 — 用 Tauri 2 + React + Vite 打造，
**以遊戲為主要使用情境**。

管理多個 Wine bottles、一鍵執行 Windows x64 軟體與遊戲，不需安裝完整 Windows。

English: [README.md](./README.md)

## 功能（v1）

- 🍾 Bottle（Wine prefix）管理：建立／改名／刪除／開啟 C 槽／winecfg
- 🎮 遊戲範本：Wine Staging（esync）+ 遊戲用環境變數預設
- ▶️ 執行任意 `.exe` / `.msi` / `.bat`，程式捷徑卡片一鍵啟動
- 🔧 winetricks 元件安裝（vcrun、dotnet、字型、DirectX 元件…）
- 📜 即時 log 串流面板
- ⚙️ Per-bottle Windows 版本與環境變數設定

規格與 roadmap（DXVK、Wine runtime 內建下載器）見 [SPEC.md](./SPEC.md)。

## 環境需求

- Apple Silicon Mac
- Rosetta 2
- 至少一套 Wine 引擎（見[初始設定](#初始設定)）
- （選用）`brew install winetricks`

## 初始設定

### 1. 安裝 Rosetta 2

```bash
softwareupdate --install-rosetta --agree-to-license
```

### 2. 安裝 Wine 引擎

CrossFreeler 不內建 Wine，而是偵測機器上既有的引擎，所以至少要裝一套。相關檔案都放在 app 的資料目錄：

```
~/Library/Application Support/CrossFreeler/
```

**Stable** — 基本款，一般軟體用這個就夠。

到 [Gcenx macOS Wine builds](https://github.com/Gcenx/macOS_Wine_builds/releases) 下載，
解壓後擺成 `runtime/current/bin/wine` 這個路徑：

```bash
CF=~/Library/Application\ Support/CrossFreeler/runtime
mkdir -p "$CF"
# 解開 Wine Stable.app 之後：
cp -R "Wine Stable.app/Contents/Resources/wine" "$CF/wine-stable"
ln -sfn "$CF/wine-stable" "$CF/current"
```

Homebrew 的 `wine-stable` cask 已標記 deprecated（2026-09 停用），不再建議使用；
但若你機器上已經有 `/opt/homebrew/bin/wine`，還是會被偵測到。

**Staging** — 較新版的 Wine，部分 patcher 與啟動器需要。

解壓到名為 `wine-staging-*` 的目錄，會取版號最新的那個：

```bash
cp -R <解壓好的 staging wine> "$CF/wine-staging-9.x"
```

**CrossOver 引擎** — 跑保護殼遊戲必備。

有 Themida / WinLicense / GameGuard 保護的遊戲（例如官方仙境傳說 RO）只能在 CrossOver 系引擎上跑。
以下任一種都會自動偵測：

- `/Applications` 或 `~/Applications` 底下的 CrossOver.app
- [Whisky](https://getwhisky.app) 內附的 WhiskyWine
- 自己放到 `runtime/crossover/bin/wine`

### 3. 建置與執行

```bash
npm install
npm run tauri dev     # 開發模式
npm run tauri build   # 打包 .app / .dmg
```

需要 Node 22+ 與 Rust stable（`brew install rust`）。

### 4. 第一次啟動

App 啟動時會自動偵測環境，設定精靈會列出找到了什麼。接著：

1. 建立 bottle — 選 Windows 版本與引擎（保護殼遊戲請選 CrossOver 引擎）。
2. 或匯入現有的 Whisky／CrossOver bottle。prefix 是**共用**不是複製，從 CrossFreeler 移除時只會解除掛載。
3. 執行安裝檔，或替 `.exe` 加一張捷徑卡片，雙擊即可啟動。

捷徑可以個別覆寫引擎，所以同一個 bottle 能讓 patcher 跑 staging、遊戲本體跑 CrossOver 引擎。

## 已知限制

- 使用 kernel anti-cheat（EAC / BattlEye）的線上遊戲無法執行（所有 Wine 方案皆然）。
- 參數欄位以空白切割，不支援含引號的參數。

## 授權聲明

本專案透過外部程序呼叫 [Wine](https://www.winehq.org)。Wine 為 LGPL 授權的自由軟體，
其原始碼可於 [winehq.org](https://www.winehq.org) 取得；macOS 建置版來自
[Gcenx/macOS_Wine_builds](https://github.com/Gcenx/macOS_Wine_builds)。
