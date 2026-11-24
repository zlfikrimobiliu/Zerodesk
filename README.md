# FE-REMOTESYSTEM

Console superadmin **ZeroDesk** (platform Zerologic) — Vue 3 + Vite + Tauri.

Login: `fikri` / `4001`

## Desktop (yang dipakai)

```bash
cd FE-REMOTESYSTEM
npm install
npm run tauri dev
```

Itu yang membuka window desktop. Jangan `npm run dev` kalau mau app Tauri; `npm run dev` cuma browser.

## Browser saja (debug UI)

```bash
npm run dev
```

Lalu buka `http://localhost:5173`

## Build installer (kasih ke superadmin)

Jangan PM2 / `npm run dev` di server. Langkah lengkap: [`../RILIS.md`](../RILIS.md)

```bash
npm run tauri build
```

Hasil: `src-tauri/target/release/bundle/nsis/ZeroDesk_*_x64-setup.exe`

Kontrak API: [`../BACKEND.md`](../BACKEND.md)  
Host BE: `https://zerologic.lokanesa.com`
