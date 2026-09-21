# Changelog

All notable changes to Roku Dev Studio are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/); versions match the
tags in [Releases](https://github.com/paramount-engineering/roku-dev-studio/releases).

## [Unreleased]

## [1.2.1]

### Added
- **Device Performance** — a System / Graphics memory mode with live texture and system graphics series, a bitmaps (`r2d2`) modal, chart history with process snapshots, CSV / JSON / image export of any chart, and a per-chart explanatory info modal. Also exposed to agents as the `device_performance_metrics` MCP tool (chart selection, time window, downsampling).
- **Console Monitor** — now tracks Roku launch/performance beacons alongside BrightScript errors, with analytics surfaced in the telnet console.
- **Debugger** — the debugger API scans channel sources for symbols and `stop` statements and feeds them to the debug session controller for richer inspection.
- **MCP** — `network_inspector_find` for full-content search across captured requests and responses; `status` / `statusClass` / `contentType` OR-filters on the list and analyze tools; and a **View MCP Tools** modal in Settings that groups every exposed tool by capability area.
- **Hardware images** — device photos are fetched through the main process, the device details modal always opens, and a placeholder is shown when no photo resolves.
- An **Open** action on file-related toasts launches the file through the OS.
- New UI strings for all of the above are translated in the ES / PL / PT / RO / UK catalogs.

### Changed
- **Official macOS builds are signed and notarized.** The DMG and zip on GitHub Releases now carry a Developer ID signature and an Apple notarization ticket, so Gatekeeper opens the app directly — the `xattr -cr` step is gone from the install instructions. electron-builder handles signing, `notarytool` submission and stapling natively; the release job fails fast if the signing secrets are missing rather than shipping an unsigned build. **Upgrading from 1.2.0 on macOS is a one-time manual download:** the in-app updater cannot replace the unsigned 1.2.0 with a signed build (Squirrel.Mac requires the update to match the running app's signature), so 1.2.0 will report an update error — download the 1.2.1 `.dmg` once, and auto-update works from there on.
- Live-only device controls are disabled while a device is unreachable, while already-captured content (network events, console scrollback, saved screenshots) stays fully usable.
- Modal open/close animations are unified on a shared origin-aware motion system (dialogs grow from the button that opened them and shrink back into it).
- Fiddle, Dev App, Remote, Log Viewer and Query workflows refined, including device metrics and secret-screen handling; Settings relay controls updated; telnet and system-command IPC consolidated with consistent error handling.
- Release artifacts use one naming scheme across platforms (`Roku-Dev-Studio-<version>-<arch>.<ext>`, with `-Setup-` / `-Portable-` variants for the two Windows builds, which previously would have resolved to the same file name). The release notes' Downloads table is now generated from the uploaded assets, and `npm run verify:artifact-names` guards the naming templates against collisions.
- Dependency housekeeping: esbuild 0.28.2, vite 8.2.2, tsx 4.23.13, concurrently 10.0.5, `@tanstack/virtual-core` 3.17.8, `@types/node` 22.20.3, pinned type definitions, refreshed Node and Dockerfile digests.

### Fixed
- **Check for Updates** works again: the 1.2.0 release shipped without its `latest-*.yml` publish metadata because `build.publish: null` suppressed it, so `checkForUpdates()` threw `ENOENT`. Metadata generation is restored (uploads still go only through the release workflow), a missing `app-update.yml` is now handled as gracefully as a missing `latest-*.yml`, and the updater falls back to a manual-download banner when a release asset is unreachable.
- **Windows and Linux auto-update** can now find releases: the release workflow only ever attached `latest-mac.yml`, so electron-updater on Windows (`latest.yml`) and Linux (`latest-linux.yml` / `latest-linux-arm64.yml`) always reported the channel file missing and fell back to the manual-download banner. Those files, plus the Windows differential `.exe.blockmap`, now ship with every release, making 1.2.1 the first version those platforms can update *from* automatically.
- Debugger: attaching to a device that already has a healthy session is a no-op instead of a reconnect; continue/step no longer clobber a stop that arrives before the command is acknowledged; session lifecycle hardened against stale sessions and invalid state transitions.
- The file-drop overlay no longer sticks open after an interrupted or cancelled OS drag, and remote-control shortcuts are suppressed while it is visible.
- Chromium's benign `ResizeObserver` warnings no longer trigger the crash-report modal (#66).
- Action Scripts: the Builder, Executor and Import flows can validate scripts that include or resolve a dev password; MCP and remote authoring keep the strict rejection.
- MCP: readiness is reported when the MITM proxy is active even without raw packet capture, and the app name is set before single-instance/userData resolution so settings never land in the wrong folder and the MCP descriptor no longer drifts.

### Security
- adm-zip updated to 0.6.1 for [CVE-2026-77301](https://github.com/advisories/GHSA-7q85-xj36-vmfc); sharp updated to 0.35.4 (security advisory).
- Certificate and API-key material (`*.p12`, `*.p8`) is git-ignored so local signing credentials cannot enter the repository.

## [1.2.0]

### Added
- **BrightScript Socket Debugger** — attach a live debug session (breakpoints, stepping, variable inspection) to a connected device from the Telnet sidebar; also available via the API/CLI and MCP tools.
- **Static Analysis** — run `sca-cmd`–aligned static analysis on a channel package from within the app, with severity/category filtering and deep-linkable results.
- **Sideload Relay** — point your sideload tool (VS Code + BrightScript extension, Eclipse, or the `roku-deploy` CLI) or a browser at this machine instead of a single Roku; RDS accepts the build once, then installs, launches, and opens console on every enabled target. Sideloads from same machine proceed automatically; Sideload requests from another LAN device needs the Dev Password and an allow prompt.
- **Console Monitor** — automatic BrightScript crash/error detection in the live Console and Log File Viewer, with a findings analytics modal.
- **Network Inspector** — capture, inspect, and replay your device's network traffic, now with multi-keyword find, request replay/edit-resend, rewrite rules, whole-session HAR/native export, and a standalone Network Session Viewer for saved captures. HTTPS decrypts automatically via the built-in MITM proxy — no device-side certificate setup needed.
- **Try Demo App** — a bundled demo channel so users can explore all the features of Roku Dev Studio.
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

[Unreleased]: https://github.com/paramount-engineering/roku-dev-studio/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/paramount-engineering/roku-dev-studio/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/paramount-engineering/roku-dev-studio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/paramount-engineering/roku-dev-studio/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/paramount-engineering/roku-dev-studio/releases/tag/1.0.0
