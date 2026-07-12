# CrossFreeler 🍷

macOS（Apple Silicon）上類 CrossOver 的 Wine 圖形化前端 — 用 Tauri 2 + React + Vite 打造。

管理多個 Wine bottles、一鍵執行 Windows x64 軟體，不需安裝完整 Windows。

## 狀態

📋 規格階段 — 完整規格見 [SPEC.md](./SPEC.md)，依其中 Milestones 實作。

## 前置需求

```bash
softwareupdate --install-rosetta --agree-to-license  # Rosetta 2
brew install --cask wine-stable                       # Wine
brew install winetricks                               # 選用
brew install rust                                     # 開發用
```

## 開發

```bash
npm install
npm run tauri dev
```
