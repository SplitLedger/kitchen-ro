# Kitchen RO

Local helper for Ragnarok Online cooking orders. This shell has navigation, a light/dark theme, and one SQLite settings row.

Review happens in the browser. The desktop window is a Windows build.

## Browser review

From this repo, including on WSL:

```bash
npm install
npm run dev
```

Open http://localhost:1420. The dev server stays on port 1420 because that is the URL the Windows app loads.

Routes use a hash (`http://localhost:1420/#/settings`) so a refresh still opens the same screen in the desktop window.

The header theme control is stored on the settings row. Reload the page and the choice should remain. The Settings screen shows that row.

In the browser the database is SQLite compiled to WebAssembly (`sql.js`). Its bytes are kept in IndexedDB under the name `kitchen-ro`.

## Windows app

Install these before running the desktop app:

- Node.js
- Rust, with the MSVC toolchain (the default from `rustup` on Windows)
- Visual Studio Build Tools, with the Desktop development with C++ workload
- WebView2, already present on Windows 11 and on updated Windows 10

From a Windows shell in this project:

```bash
npm install
npm run tauri dev
npm run tauri build
```

`tauri build` produces an NSIS installer. The database file is `kitchen-ro.db` in Tauri's app config directory. On Windows that directory is `%APPDATA%\com.kitchenro.app\`.

## Checks

```bash
npm run typecheck
npm run lint
npm run fmt:check
npm run test
```
