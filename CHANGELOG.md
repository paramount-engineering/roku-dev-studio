# Changelog

All notable changes to Roku Dev Studio are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/); versions match the
tags in [Releases](https://github.com/paramount-engineering/roku-dev-studio/releases).

## [Unreleased]

## [1.2.0]

### Added
- **BrightScript Socket Debugger** — attach a live debug session (breakpoints, stepping, variable inspection) to a connected device from the Telnet sidebar; also available via the API/CLI and MCP tools.
- **Static Analysis** — run `sca-cmd`–aligned static analysis on a channel package from within the app, with severity/category filtering and deep-linkable results.
- **Sideload Relay** — point your sideload tool (VS Code + BrightScript extension, Eclipse, or the `roku-deploy` CLI) or a browser at this machine instead of a single Roku; RDS accepts the build once, then installs, launches, and opens console on every enabled target. Sideloads from same machine proceed automatically; Sideload requests from another LAN device needs the Dev Password and an allow prompt.
- **Console Monitor** — automatic BrightScript crash/error detection in the live Console and Log File Viewer, with a findings analytics modal.
- **Network Inspector** — capture, inspect, and replay your device's network traffic, now with multi-keyword find, request replay/edit-resend, rewrite rules, whole-session HAR/native export, and a standalone Network Session Viewer for saved captures. HTTPS decrypts automatically via the built-in MITM proxy — no device-side certificate setup needed.
- **Try Demo App** — a bundled demo channel so new users can explore Roku Dev Studio's features without a physical device.
- **Crash Reporting** — uncaught errors now surface as an actionable report (with a prefilled GitHub issue link) instead of failing silently; sensitive IPs/MACs are redacted, and it can be turned off in Settings.
- **Remote Server** — network inspector and debugger streaming now available over the headless remote-server API, not just the desktop app.
- **Language Switching** — the app now ships in 6 languages (English, Español, Українська, Polski, Română, Português).
- **Privacy Mode** — now broadcasts across every open window (Console, Network Inspector, viewers) instead of just the active one.
- Action Scripts saved-script library — save, browse, import, and re-apply scripts from an in-app library.
- TV Inputs panel and keyboard remote control on the Remote tab.
- OS "Open With" support and drag-and-drop for `.log` / `.har` / `.pcap` / native-bundle files, opening directly into the Log Viewer or Network Session Viewer.
- Automatic update checking (electron-updater / GitHub Releases) with a "Check for Updates" menu item, release-notes modal, and a manual-download fallback.
- Device reboot / update-check actions in the hardware modal; instant tooltips for clamped Settings help; Settings deep-links from Help content.

### Changed
- Log File Viewer: switched to a windowed, byte-indexed model instead of loading the whole file, with async indexing, chunked parsing, and a page-load-style loading animation in place of the old spinner — large files now open without freezing the window.
- Broad performance work: main-process file I/O moved off the main thread (async fs, worker pools for parsing and cert signing), fewer per-frame allocations in device metrics, throttled offline/polling checks, paused background animations, and a smaller/minified renderer bundle.
- UI polish across the welcome screen, about dialog, screenshot panel, and modal backdrop-click handling.

### Fixed
- Windows: Network Inspector capture now resolves the correct Npcap device.
- Startup: removed a ~4s stall caused by the first `sessionStorage` touch.
- Console: fixed a freeze when Filter mode ran over a large in-memory buffer with only a few matches.
- RALE frame parsing; in-memory buffer bounds and listener/socket leak fixes; HTTP body reassembly across TCP segments.

### Security
- Hardened external-open handling, sideload HTTP digest auth, and the remote-server API with optional bearer-token auth.
- Dependency security updates: esbuild, ws, form-data, adm-zip, electron.

## [1.1.0]

### Added
- Floating Remote — a small always-on-top mini remote you can keep visible while working in another app or window.
- Device Performance / process stats panel for live CPU, memory, and graphics metrics on a connected device.
- Remembered device passwords, so reconnecting to a known device no longer requires re-entering its developer password.

### Changed
- Console and Log File Viewer: search/filter and general usability cleanup.
- Windows: fixed zoom/DPI scaling issues in the desktop app window.

## [1.0.0]

### Added
- Initial public release: Remote Control, Device Discovery, Sideload, RALE / App Connector, Network Inspector, Action Scripts, MCP server for AI agents, and the `rds` CLI.

[Unreleased]: https://github.com/paramount-engineering/roku-dev-studio/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/paramount-engineering/roku-dev-studio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/paramount-engineering/roku-dev-studio/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/paramount-engineering/roku-dev-studio/releases/tag/1.0.0
