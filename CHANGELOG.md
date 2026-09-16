# Changelog

All notable changes to Roku Dev Studio are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/); versions match the
tags in [Releases](https://github.com/paramount-engineering/roku-dev-studio/releases).

## [Unreleased]

### Fixed
- Console: a Sideload Relay install with debugging enabled could leave the device's console port held by an orphaned socket — the panel showed Disconnected, every Connect failed with "Console connection is already in use.", and only restarting the app recovered. Concurrent connects for one device now share a single socket, a replaced socket's close can no longer tear down its successor, and the Console panel adopts a connection the app opened on its behalf (status and Connect/Disconnect reflect the live socket).
- Console: after a relay run, Disconnect and closing the device tab now actually release the device's console port (the relay no longer holds a lease it never released).
- Debugger: Detach, closing a device tab, the MCP `debugger_detach` tool, and quitting the app no longer exit the running channel on the device — detaching releases a halted thread and closes the debug sockets without sending the protocol's exit-channel command. "Stop & Exit App" remains the explicit way to exit.
- Roku Cloud Emulator: a tunnel closed by the remote end now surfaces as a disconnect (and is re-dialed on the next connect) instead of appearing connected with no output.
- Remote Server: uploads and exports no longer fail with `ENOENT … /tmp/roku-relay-uploads/…` after the host's temp cleaner removes the idle upload directory — it is re-created before every write.
- Debugger: the automatic attach when a channel reports "Waiting for debugger" never fired for local devices (it matched the flag by IP while the flag is stored by serial) and did not exist for lab-server or Cloud Emulator devices. It now works for all three.
- Console: after a debugger session ends, Roku keeps routing that channel run's print output to the (closed) debugger and does not send it back to port 8085 until the channel is relaunched — the Console used to just go silent. It now says so, both when the session ends and when a reconnect replays a run that a debugger had owned, and points at Restart / re-sideload.
- Roku Cloud Emulator: the Console dropped every line of the debugger's output for RCE devices (an origin-filter mismatch), so a debugged RCE channel looked dead even while attached. Debugger output now renders for RCE like it does locally.
- Roku Cloud Emulator: a debug sideload is now Delete + Install (so `remotedebug=1` is honored and the channel really relaunches), and an "Identical to previous version" reply no longer counts as success — it triggers the same clean reinstall.
- Roku Cloud Emulator: device operations resolve the instance URL per call instead of capturing it once, so an instance restart no longer leaves an open tab talking to a stale URL.
- Debugger: a replayed "Waiting for debugger" line that already resolved (a debugger connected, or nobody did) no longer triggers a 20-second attach attempt on every console reconnect.
- Debugger: the attach-failure help no longer claims that "Thread selected" means the socket protocol is inactive (that line also follows a successful attach); it now explains the detached-run case and the real micro-debugger banner.

### Changed
- Debugger: the per-device "Sideload with Debugging" checkbox (Dev App tab, Fiddle) is now "Enable Debugger", because it governs more than sideloads: while on, the debugger also attaches automatically whenever the running channel reports it is waiting for one on port 8081 — a launch from the Roku remote, the Apps tab, or an IDE, on local, lab-server and Cloud Emulator devices alike. A stale "waiting" line replayed by Roku when the Console connects is tried and dropped quietly. Existing per-device choices are carried over automatically (the stored setting key changed).
- Sideload Relay: every target's device tab and Console now open at the start of a run, and the console connects before the install, so a target whose install fails is still connected and visible, and the Console is already listening when the channel compiles. Local targets get a transparent console reconnect after install (some firmware unbinds the previous console client on install). The debugger still attaches after install, since its port only opens on a debug launch.
- Remote Server: sideload uploads are forwarded to the device straight from memory instead of being written to and read back from a temp file; the temp directory is now used only for pcap and CA-certificate exports.

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

[Unreleased]: https://github.com/paramount-engineering/roku-dev-studio/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/paramount-engineering/roku-dev-studio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/paramount-engineering/roku-dev-studio/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/paramount-engineering/roku-dev-studio/releases/tag/1.0.0
