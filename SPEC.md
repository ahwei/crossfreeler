# CrossFreeler — 規格書（SPEC）

macOS 上類 CrossOver 的 Wine 圖形化前端：管理多個 Wine prefix（稱為「Bottle」）、安裝並執行 Windows x64 軟體，不需安裝完整 Windows。

> 本文件是給執行實作的 agent 看的完整規格。請依照「Milestones」章節的順序實作，每個 milestone 完成後 commit 一次。

---

## 1. 目標與非目標

### 目標
- 提供 GUI 管理 Wine bottles（建立、設定、刪除）。
- 在指定 bottle 內執行任意 `.exe` / `.msi`（安裝程式或應用程式）。
- **以遊戲為主要使用情境**：DXVK 圖形層、esync、Metal HUD、遊戲用 winetricks 元件（見 F9）。
- 為每個 bottle 保存常用程式捷徑，一鍵啟動。
- 整合 winetricks 安裝常見執行環境（corefonts、vcrun2022、dotnet48 等）。
- 即時顯示 Wine 輸出 log，方便除錯。

### 非目標
- 不把 Wine 打包進 .app bundle 內（上千個 binary 逐一簽名／公證太複雜）；改採「首次啟動下載 Wine runtime」策略（F8），Homebrew 的 `wine-stable` 作為備用來源。
- 不做 Windows 虛擬機。
- 不支援依賴 kernel anti-cheat（EAC/BattlEye）的線上遊戲 — 這是所有 Wine 方案的共同限制，UI 文案需註明。
- 不散布 Apple D3DMetal（GPTK）— 授權不允許；只偵測使用者機器上既有的 GPTK/CrossOver 安裝（F9）。
- 不支援 Intel Mac 以外的特殊處理——目標平台是 **Apple Silicon + Rosetta 2**（Intel Mac 理論上也能跑，但不特別測試）。

---

## 2. 技術棧

| 層 | 技術 | 版本 |
|---|---|---|
| Desktop shell | Tauri | 2.x |
| 前端框架 | React + TypeScript | React 18+ |
| Build tool | Vite | 最新 stable |
| 樣式 | Tailwind CSS | 4.x |
| 前端狀態 | Zustand | 最新 |
| 後端 | Rust（Tauri commands） | stable toolchain |

腳手架指令：`npm create tauri-app@latest -- --template react-ts`（之後補上 Tailwind、Zustand）。

---

## 3. 執行環境需求（runtime prerequisites）

App 啟動時必須偵測以下項目，缺少時在 UI 顯示導引（不是 crash）：

1. **Rosetta 2**：`/usr/bin/pgrep -q oahd` 判斷。缺少時提示執行 `softwareupdate --install-rosetta --agree-to-license`。
2. **Wine**：依序搜尋以下路徑，找到第一個可用的：
   - `~/Library/Application Support/CrossFreeler/runtime/current/bin/wine`（F8 下載的內建 runtime，優先）
   - `/opt/homebrew/bin/wine`
   - `/usr/local/bin/wine`
   - `/Applications/Wine Stable.app/Contents/Resources/wine/bin/wine`
   - `$PATH` 上的 `wine`
   找到後執行 `wine --version` 取得版本字串顯示於 UI。缺少時導引頁提供兩個選項：「下載內建 Wine runtime」（F8，主要路徑）或自行 `brew install --cask wine-stable`。
3. **winetricks**（選用功能）：搜尋 `$PATH` 與 `/opt/homebrew/bin/winetricks`。缺少時 Winetricks 頁面顯示 `brew install winetricks` 導引，其餘功能不受影響。

---

## 4. 核心概念：Bottle

一個 Bottle = 一個獨立的 `WINEPREFIX`（獨立的模擬 C 槽、registry、已安裝軟體）。

### 資料儲存位置
```
~/Library/Application Support/CrossFreeler/
├── config.json          # 全域設定 + bottle 清單 metadata
├── runtime/             # F8 下載的內建 Wine runtime
│   ├── current          # symlink → 目前使用的版本目錄
│   └── wine-10.0/       # 解壓後的 Wine（bin/, lib/, share/...）
└── bottles/
    └── <bottle-id>/     # WINEPREFIX 本體（drive_c/, *.reg, ...）
```

`bottle-id` 用 UUID v4。使用者看到的是 bottle 的顯示名稱。

### config.json schema（TypeScript 型別，Rust 端用 serde 對應）
```ts
interface AppConfig {
  version: 1;
  winePath: string | null;        // 使用者手動覆寫的 wine 路徑；null = 自動偵測
  bottles: Bottle[];
}

interface Bottle {
  id: string;                     // UUID
  name: string;                   // 顯示名稱，唯一
  createdAt: string;              // ISO 8601
  windowsVersion: 'win11' | 'win10' | 'win7';  // 建立時經 winecfg registry 設定
  runtime: 'stable' | 'staging';  // 使用哪個 Wine runtime（遊戲建議 staging）
  envVars: Record<string, string>; // 執行時附加的環境變數（如 WINEDEBUG=-all）
  shortcuts: Shortcut[];
}

interface Shortcut {
  id: string;                     // UUID
  name: string;                   // 顯示名稱
  exePath: string;                // Windows 路徑（C:\...）或 mac 絕對路徑皆可
  args: string;                   // 額外啟動參數
}
```

寫入 config.json 必須 atomic（先寫 temp file 再 rename）。

---

## 5. 功能規格

### F1 — 環境偵測與導引頁
- App 啟動時執行第 3 節的偵測，結果存於前端 store。
- Wine 缺少時：主畫面顯示安裝導引（含可複製的 brew 指令），並提供「重新偵測」按鈕。
- 設定頁允許手動指定 wine binary 路徑（存入 `config.winePath`）。

### F2 — Bottle 管理
- **建立**：輸入名稱 + 選 Windows 版本 → 後端執行 `WINEPREFIX=<dir> WINEARCH=win64 wine wineboot --init`，完成後用 `wine winecfg -v <version>` 設定 Windows 版本。建立過程顯示進度（初始化 prefix 需要數十秒，UI 要有 loading 狀態並串流 log）。
- **列表**：側欄列出所有 bottles，顯示名稱與 Windows 版本。
- **刪除**：二次確認後刪除 prefix 目錄與 config 內 metadata。刪除前先 `wineserver -k` 該 prefix。
- **改名**：只改 metadata，不動目錄。
- **開啟 C 槽**：在 Finder 開啟 `<prefix>/drive_c`（`open` 指令）。
- **執行 winecfg**：按鈕直接對該 bottle 開 `wine winecfg`。

### F3 — 執行程式
- Bottle 詳細頁提供「執行程式…」按鈕 → Tauri file dialog 選 `.exe`/`.msi`/`.bat`。
- 也支援把 `.exe` 拖進視窗（Tauri drag-drop event），詢問要在哪個 bottle 執行。
- 執行指令：
  ```
  WINEPREFIX=<prefix> <envVars...> wine <exePath> <args>
  ```
  `.msi` 用 `wine msiexec /i <path>`。
- 程序以 async 方式 spawn，stdout/stderr 逐行透過 Tauri event（`bottle-log://<bottleId>`）推到前端。
- 執行後詢問使用者是否要把該程式存成捷徑（F4）。

### F4 — 程式捷徑
- 每個 bottle 詳細頁以卡片 grid 顯示 shortcuts，點卡片即啟動。
- 卡片右鍵／選單：改名、編輯參數、刪除。
- 新增捷徑：手動挑檔案，或由 F3 執行後保存。

### F5 — Bottle 設定
- 每 bottle 可編輯：
  - Windows 版本（重新執行 `winecfg -v`）。
  - 自訂環境變數 key-value 清單（UI 提供常用預設快捷：`WINEDEBUG=-all`、`WINEESYNC=1`、`LC_ALL=zh_TW.UTF-8`）。
- 「強制關閉 bottle」按鈕：`WINEPREFIX=<prefix> wineserver -k`。

### F6 — Winetricks 元件
- Bottle 詳細頁的「元件」tab，提供精選 verb 清單（checkbox + 安裝按鈕）：
  `corefonts, cjkfonts, vcrun2015, vcrun2019, vcrun2022, dotnet48, d3dcompiler_47, gdiplus, msxml6`
- 執行 `WINEPREFIX=<prefix> winetricks -q <verbs...>`，log 同樣串流到前端。
- 也提供自由輸入欄位執行任意 verb。

### F7 — Log 面板
- 視窗底部可收合的 log 面板，依 bottle 分 tab。
- 顯示 F2/F3/F6 產生的即時輸出，上限保留最近 2000 行（ring buffer）。
- 提供「清除」與「複製全部」。

### F9 — 遊戲支援（主要使用情境）
- **遊戲範本**：建立 bottle 時可選「一般軟體」或「遊戲」範本。遊戲範本 = staging runtime + 預設 env（`WINEESYNC=1`、`WINEDEBUG=-all`）+ win10。
- **DXVK**（DirectX 9/10/11 → Vulkan → MoltenVK → Metal）：
  - 全域下載一次：[Gcenx/DXVK-macOS](https://github.com/Gcenx/DXVK-macOS) 最新 release tarball 解壓到 `<data>/dxvk/<version>/`。
  - Per-bottle 開關：安裝 = 把 x64 的 `d3d9.dll, d3d10core.dll, d3d11.dll, dxgi.dll` 複製進 `drive_c/windows/system32/`（先備份原檔到 `<bottle>/dxvk-backup/`）+ registry 設 DLL override 為 native；移除 = 還原備份 + 清 override。
  - UI 顯示每個 bottle 的 DXVK 狀態；`DXVK_HUD=fps` 作為可勾選項。
- **D3DMetal（Apple GPTK）**：不散布。偵測 CrossOver / GPTK 既有安裝（如 `/Applications/CrossOver.app` 內的 d3dmetal 目錄），偵測到才顯示啟用選項；v1 僅偵測 + 顯示說明。
- **Retina/HiDPI**：per-bottle 開關，寫 registry `HKCU\Software\Wine\Mac Driver` 的 `RetinaMode`（`y`/`n`）。
- **Metal 效能 HUD**：per-bottle 開關 → env `MTL_HUD_ENABLED=1`。
- **UI 文案**：bottle 建立頁註明 kernel anti-cheat（EAC/BattlEye）線上遊戲不支援。

### F10 — 已安裝程式管理（v1.1 已實作）
- Bottle 詳細頁「已安裝」tab：`wine uninstaller --list` 解析（格式 `key|||名稱`）列出已安裝程式。
- 單項「解除安裝」：`wine uninstaller --remove <key>`（detached，解除安裝精靈可能有 GUI）。
- 「開啟解除安裝工具」按鈕：`wine uninstaller`（GUI）。

### F11 — i18n（v1.1 已實作）
- 支援繁體中文與英文。自製輕量 dictionary（`src/i18n/`，zh/en 同型別），不引入 i18n 函式庫。
- 預設跟隨系統語言（`navigator.language`），使用者切換後存 localStorage。切換器在側欄底部。
- 後端錯誤訊息目前僅中文（已知限制，未來改 error code 由前端翻譯）。

### F8 — 內建 Wine runtime 下載器（Whisky 模式）
讓使用者不必碰 Homebrew，開箱即用。

> 注意：brew 的 `wine-stable` cask 已被標記 deprecated（Gatekeeper 問題，2026-09 停用），且其依賴 gstreamer-runtime 需要 sudo。直接下載 Gcenx build 是主要路徑，brew 僅為文件上的備選。

- **來源**：[Gcenx/macOS_Wine_builds](https://github.com/Gcenx/macOS_Wine_builds) 的 GitHub Releases。支援兩個 channel：
  - `stable`（一般軟體）：**latest release 不一定含 stable 資產**，須列出 releases（`GET /repos/Gcenx/macOS_Wine_builds/releases`）找最新含 `wine-stable-*-osx64.tar.xz` 的 release（實測：11.10 release 只有 devel/staging，stable 在 `11.0_1`）。
  - `staging`（遊戲建議，含 esync 補丁）：latest release 的 `wine-staging-*-osx64.tar.xz`。
  - 每個 bottle 可指定使用哪個 runtime（`Bottle.runtime: 'stable' | 'staging'`，預設 stable；建立 bottle 時可選「遊戲」範本 → staging + 遊戲環境變數預設）。
- **流程**：
  1. 導引頁（F1）點「下載內建 Wine」→ 顯示版本號與大小，開始下載到 `runtime/downloads/`（暫存）。
  2. 下載中顯示進度條（bytes 進度透過 Tauri event 推送），可取消。
  3. 完成後驗證 tar 可解壓 → 解壓到 `runtime/wine-<version>/`（實際 tarball 內容是 `Wine Stable.app`，取其中 `Contents/Resources/wine/` 目錄即可）→ 更新 `runtime/current` symlink → 移除 `com.apple.quarantine` attribute（`xattr -dr`）→ 刪除暫存檔。
  4. 重新執行環境偵測，UI 自動進入正常模式。
- **更新**：設定頁顯示目前 runtime 版本，提供「檢查更新」；有新版時同流程下載，完成後切換 symlink，舊版本目錄保留一份供回退（最多保留 2 個版本）。
- **移除**：設定頁可刪除內建 runtime（若使用者改用 brew 版）。
- **失敗處理**：下載／解壓失敗要清理暫存並顯示可讀錯誤，導引頁保留 brew 備用方案文字。
- **LGPL 合規**：README 與 app 的「關於」頁需註明 Wine 為 LGPL 授權、標示原始碼連結（winehq.org 與 Gcenx repo）。

---

## 6. 後端（Rust）介面

所有 Tauri command 回傳 `Result<T, String>`，錯誤訊息須是人類可讀的中文。

```rust
// 環境
detect_environment() -> EnvStatus        // { rosetta: bool, wine: Option<{path, version}>, winetricks: bool }
set_wine_path(path: Option<String>)

// config
load_config() -> AppConfig
// bottle CRUD（內部負責讀寫 config.json）
create_bottle(name: String, windows_version: String) -> Bottle   // 長任務，log 走 event
rename_bottle(id: String, name: String)
delete_bottle(id: String)
open_drive_c(id: String)
run_winecfg(id: String)
kill_bottle(id: String)                  // wineserver -k
update_bottle_env(id: String, env: HashMap<String, String>)
set_windows_version(id: String, version: String)

// 執行
run_program(bottle_id: String, exe_path: String, args: String) -> u32  // 回傳 pid，log 走 event
run_winetricks(bottle_id: String, verbs: Vec<String>)

// 捷徑
add_shortcut(bottle_id: String, shortcut: ShortcutInput) -> Shortcut
update_shortcut(bottle_id: String, shortcut: Shortcut)
remove_shortcut(bottle_id: String, shortcut_id: String)

// Wine runtime（F8）
check_runtime_release() -> RuntimeRelease   // { version, url, sizeBytes }，查 GitHub API
download_runtime(url: String, version: String)  // 長任務，進度走 event `runtime-progress`
cancel_runtime_download()
remove_runtime()
```

實作注意：
- spawn 子程序一律用 `tokio::process::Command`（Tauri async runtime），**不可**阻塞主執行緒。
- 環境變數只傳白名單 + bottle 自訂值，並一定設 `WINEPREFIX`；不要繼承會干擾 Wine 的變數。
- log event payload：`{ bottleId: string, line: string, stream: 'stdout' | 'stderr' }`。
- 路徑一律處理含空白與非 ASCII（中文檔名）情況——用參數陣列 spawn，不組 shell 字串。

---

## 7. 前端結構

```
src/
├── App.tsx                 # Layout：Sidebar + Main + LogPanel
├── stores/
│   ├── envStore.ts         # 環境偵測狀態
│   ├── bottleStore.ts      # bottles + 選中的 bottle
│   └── logStore.ts         # per-bottle ring buffer
├── components/
│   ├── Sidebar.tsx         # bottle 列表 + 新增按鈕 + 設定入口
│   ├── BottleDetail.tsx    # tabs: 程式 / 元件 / 設定
│   ├── ShortcutGrid.tsx
│   ├── WinetricksPanel.tsx
│   ├── BottleSettings.tsx
│   ├── LogPanel.tsx
│   ├── CreateBottleModal.tsx
│   └── SetupGuide.tsx      # F1 導引頁
└── lib/
    ├── ipc.ts              # 封裝所有 invoke() 呼叫，型別安全
    └── types.ts
```

UI 要求：
- 深色主題為主（跟隨系統亦可），介面語言 **繁體中文**。
- Sidebar 固定寬 240px；整體風格參考 CrossOver / Bottles（Linux）的簡潔卡片式布局。
- 所有長任務（建 bottle、winetricks）都要有進度回饋，不可讓 UI 看起來卡死。

---

## 8. Milestones（依序實作，每個完成後 commit）

1. **M1 — Scaffold**：Tauri 2 + React + TS + Vite + Tailwind + Zustand 腳手架可 `npm run tauri dev` 跑起來。
2. **M2 — 環境偵測**：F1 完成（偵測 + 導引頁 + 手動指定路徑）。
3. **M3 — Bottle CRUD**：F2 完成，含建立時的 log 串流與 loading 狀態。
4. **M4 — 執行程式 + Log**：F3 + F7 完成。
5. **M5 — 捷徑 + 設定**：F4 + F5 完成。
6. **M6 — Winetricks**：F6 完成。
7. **M7 — 打包**：`npm run tauri build` 產出可用的 `.app`／`.dmg`；README 補上安裝與使用說明。
8. **M8 — 內建 Wine runtime**：F8 完成（下載、進度條、解壓、symlink 切換、更新與移除、LGPL 標示）。
9. **M9 — 遊戲支援**：F9 完成（DXVK 下載與 per-bottle 安裝/移除、遊戲範本、Retina、Metal HUD、D3DMetal 偵測）。

> 遊戲是主要使用情境：v1 至少要含「遊戲範本」（staging runtime + esync env 預設）；DXVK 完整整合可在 v1 之後緊接著做。

---

## 9. 驗收標準

- [ ] 全新機器（已裝 wine-stable）啟動 app，能建立名為「測試」的 win10 bottle。
- [ ] 能執行一個 x64 安裝程式（例：Notepad++ installer）並完成安裝。
- [ ] 安裝後能把 `notepad++.exe` 存成捷徑並由卡片啟動。
- [ ] 未裝 Wine 的機器啟動 app 看到導引頁而非錯誤。
- [ ] 刪除 bottle 後目錄與 config 皆清乾淨，執行中的 wineserver 有被 kill。
- [ ] 含中文與空白的 exe 路徑可正常執行。
- [ ] `npm run tauri build` 成功產出 .app。
- [ ] 未裝 Wine 的機器可從導引頁下載內建 runtime，完成後不重啟 app 即可建立 bottle（M8）。
- [ ] 下載中途取消不留殘檔；斷網失敗顯示可讀錯誤（M8）。

---

## 10. 開發指令

```bash
npm install
npm run tauri dev     # 開發
npm run tauri build   # 打包 .app / .dmg
```

前置需求：Node 22+、Rust stable（`brew install rust`）、`brew install --cask wine-stable`、（選用）`brew install winetricks`。
