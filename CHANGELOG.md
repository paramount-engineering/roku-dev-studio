# Changelog

All notable changes to Roku Dev Studio are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/); versions match the
tags in [Releases](https://github.com/paramount-engineering/roku-dev-studio/releases).

## [Unreleased]

## [1.3.0]

**Upgrading from 1.2.0 is a one-time manual download on every platform.** macOS 1.2.0 finds 1.3.0 but its download fails with a 404 (its manifest names a file that does not exist on the release, see *Fixed*), and Squirrel.Mac cannot replace the unsigned 1.2.0 with the signed 1.3.0 anyway. Windows and Linux 1.2.0 never see any update (their channel files were never published). Install 1.3.0 from the [release page](https://github.com/paramount-engineering/roku-dev-studio/releases/latest); from 1.3.0 on, in-app updates work on all three platforms.

### Added
- **Roku Cloud Emulator (RCE) support** — **Add Location** gains an **RCE** tab: sign in with a Personal Access Token to list, start (with optional snapshot / firmware / max-runtime) and stop Roku's cloud-hosted virtual devices, then work with them like any other device — remote control, ECP queries, the Console, sideload, screenshots, App Connector and the debugger all run through the emulator's ports bridge. RCE devices are visible to the MCP tools and the Remote Server flows too. Ships as the new `roku-dev-studio-rce` package.
- **Ports Window** — a standalone per-device window (Console header → **Open Ports Window**) with one tab per port: the **8080** SceneGraph console, the **8087** screensaver console, and the **8081** debug protocol with the debugger controls, REPL and a live wire trace, plus a **Custom Port** tab (Cloud Emulator devices tunnel 9999 and 49152–65535). The window holds the socket, so one-shot consumers in the main window (Query tab, Action Scripts, Toggle FPS) reuse it instead of dialing their own. Works for local, lab-server and Cloud Emulator devices.
- **Sideload Relay** — per-device relay controls with a dev-password flow in the device panel; relay and Dev App actions follow the live device state.
- **Device Performance** — a System / Graphics memory mode with live texture and system graphics series, a bitmaps (`r2d2`) modal, chart history with process snapshots, CSV / JSON / image export of any chart, and a per-chart explanatory info modal. Also exposed to agents as the `device_performance_metrics` MCP tool (chart selection, time window, downsampling).
- **Console Monitor** — now tracks Roku launch/performance beacons alongside BrightScript errors, with analytics surfaced in the telnet console.
- **Debugger** — the debugger API scans channel sources for symbols and `stop` statements and feeds them to the debug session controller for richer inspection.
- **MCP** — `network_inspector_find` for full-content search across captured requests and responses; `status` / `statusClass` / `contentType` OR-filters on the list and analyze tools; and a **View MCP Tools** modal in Settings that groups every exposed tool by capability area.
- **Device modal** — a live **Device Info** panel (localized), device photos fetched through the main process so the modal always opens, and a placeholder when no photo resolves.
- An **Open** action on file-related toasts launches the file through the OS.
- New UI strings for all of the above are translated in the ES / PL / PT / RO / UK catalogs.
- Add Location has a "Forget it on App Quit/Close" checkbox (RDS Relay and RCE). Such a location is dropped when the app quits and again at the next startup (crash safety), together with its RCE token and any Sideload Relay targets that pointed at it. RCE relay targets are matched through the in-memory device registry, so they are dropped at quit only. Device tabs opened at such a location are never remembered for auto-connect.

### Changed
- **Network Session Viewer** now matches the live Network tab: ↑/↓ and Home/End keyboard navigation, the **Proxied** (decrypted-only) filter, the Large Body explainer, right-click **Copy Image / Save File** on media previews, Cmd/Ctrl+A scoped to a body pane, Escape closes the copy menu, and the same drag-resizable filter (shared modules, no duplicated glue).
- **Official macOS builds are signed and notarized.** The DMG and zip on GitHub Releases now carry a Developer ID signature and an Apple notarization ticket, so Gatekeeper opens the app directly — the `xattr -cr` step is gone from the install instructions. electron-builder handles signing, `notarytool` submission and stapling natively; the release job fails fast if the signing secrets are missing rather than shipping an unsigned build. Squirrel.Mac requires an update to match the running app's signature, so the unsigned 1.2.0 cannot be replaced in-app (see the upgrade note at the top of this release).
- Live-only device controls are disabled while a device is unreachable, while already-captured content (network events, console scrollback, saved screenshots) stays fully usable.
- Modal open/close animations are unified on a shared origin-aware motion system (dialogs grow from the button that opened them and shrink back into it).
- Fiddle, Dev App, Remote, Log Viewer and Query workflows refined, including device metrics and secret-screen handling; Settings relay controls updated; telnet and system-command IPC consolidated with consistent error handling.
- Release artifacts use one naming scheme across platforms (`Roku-Dev-Studio-<version>-<arch>.<ext>`, with `-Setup-` / `-Portable-` variants for the two Windows builds, which previously would have resolved to the same file name). The release notes' Downloads table is now generated from the uploaded assets, and `npm run verify:artifact-names` guards the naming templates against collisions.
- Dependency housekeeping: esbuild 0.28.2, vite 8.2.2, tsx 4.23.13, concurrently 10.0.5, `@tanstack/virtual-core` 3.17.8, `@types/node` 22.20.3, pinned type definitions, refreshed Node and Dockerfile digests.
- Remote Server: `/device/:ip/sideload` accepts multipart uploads only. The JSON `{ filePath }` variant (a package path on the server host) is removed, together with the matching `relayClient.sideload({ filePath })` mode in roku-dev-studio-api; `file` (Buffer or local path) is now required there.
- Startup: remembered devices now connect the moment discovery reports them — a local device on its first SSDP reply, a lab-server device as soon as its location's list arrives, a Cloud Emulator device as soon as its account's list arrives — instead of waiting for every location to finish scanning. Tabs typically appear within 2–7 seconds of launch rather than 10–12; a final sweep when all scans complete still catches anything discovered late.
- Debugger: the per-device "Sideload with Debugging" checkbox (Dev App tab, Fiddle) is now "Enable Debugger", because it governs more than sideloads: while on, the debugger also attaches automatically whenever the running channel reports it is waiting for one on port 8081 — a launch from the Roku remote, the Apps tab, or an IDE, on local, lab-server and Cloud Emulator devices alike. A stale "waiting" line replayed by Roku when the Console connects is tried and dropped quietly. Existing per-device choices are carried over automatically (the stored setting key changed).
- Sideload Relay: every target's device tab and Console now open at the start of a run, and the console connects before the install, so a target whose install fails is still connected and visible, and the Console is already listening when the channel compiles. Local targets get a transparent console reconnect after install (some firmware unbinds the previous console client on install). The debugger still attaches after install, since its port only opens on a debug launch.
- Remote Server: sideload uploads are forwarded to the device straight from memory instead of being written to and read back from a temp file; the temp directory is now used only for pcap and CA-certificate exports.
- **About dialog** reworked: icon-left header, an **App Details** table with a one-click copy button, **Submit an Issue** (opens a GitHub issue with the app details prefilled), **Check for Updates** and **Close** actions, and a link to the docs site; the window sizes itself to its content, in every locale, with no scrollbar.
- Welcome tiles: **Remote Locations** now describes relay servers and Roku Cloud Emulator; **Console** lists the 8085 console plus the 8080 / 8087 / 8081 ports.
- Documentation: README, FEATURES and the docs site cover the Ports Window, Roku Cloud Emulator, Device Performance and MCP additions; the Remote Server README and OpenAPI spec now document every route (telnet, debugger, bearer auth); the new `roku-dev-studio-rce` package has a README; install and release guides describe the signed, notarized pipeline and its secrets.

### Fixed
- **Auto-updater: every failure is explained in plain language, with the action that helps.**
  - A missing release file, a bad checksum, another HTTP error, being offline, "no published release" and "GitHub isn't responding" (outages, rate limits, proxy or captive-portal pages) each get their own title and copy in all six locales, replacing electron-updater's raw exception text. Actions are consistent across every banner: a copy-icon **Copy Details** button (reason, step and raw error for bug reports), **Retry** (re-runs the step that failed), **Open Release Page** (the browser), and **Download** now means the in-app download only. Actions always fit one row, and a long raw message can no longer overflow the banner.
  - The automatic startup check is quiet when it merely could not reach GitHub or found no stable release: those failures are logged, and only a user-initiated **Check for Updates** shows them. Download failures always show, since the user asked for the download.
  - The "You're up to date" toast names the running build and says when it is ahead of the latest release (dev and pre-release builds).
  - A release without updater metadata combined with an unreachable GitHub API is reported as GitHub trouble instead of "up to date", and a 503 or a proxy page on the manifest URL is no longer mistaken for "the release has no metadata" (it used to produce a "please download manually" banner).
- **Network Inspector:** base64-encoded bodies that are really text (JSON/XML from HAR exporters, or an unfamiliar MIME tagged binary) now render, copy, search and edit as text instead of a "binary — not previewable" note; genuine binary keeps the note.
- **Network Session Viewer:** selecting a request no longer scrolls the list back to the top (the list was rebuilt on every click).
- **Network Inspector Find:** body highlights and ↑/↓ match cycling survive leaving and returning to a matched request (the find bar re-indexes whenever the body re-renders); the Find term is tinted in the Overview URL and headers on both surfaces; the body find bar no longer sits on the Overview/Headers tabs showing "0".
- **The in-app update download from 1.2.0 failed with a 404.** electron-builder's default artifact name contained spaces (`Roku Dev Studio-1.2.0-arm64-mac.zip`); the manifest recorded it with hyphens while GitHub stored the uploaded asset with periods, so `latest-mac.yml` pointed at a file that did not exist. 1.3.0 uses the space-free artifact name (see *Changed*), so manifest and assets always agree, and `npm run verify:artifact-names` guards it. The updater also HEAD-checks the asset before offering **Download** and falls back to the manual-download banner when it is unreachable. A missing bundled `app-update.yml` (1.1.0 builds were made with `publish: null` and have no update metadata at all) is handled as gracefully as a missing `latest-*.yml`.
- **Windows and Linux auto-update** can now find releases: the release workflow only ever attached `latest-mac.yml`, so electron-updater on Windows (`latest.yml`) and Linux (`latest-linux.yml` / `latest-linux-arm64.yml`) always reported the channel file missing and fell back to the manual-download banner. Those files, plus the Windows differential `.exe.blockmap`, now ship with every release, making 1.3.0 the first version those platforms can update *from* automatically.
- Debugger: attaching to a device that already has a healthy session is a no-op instead of a reconnect; continue/step no longer clobber a stop that arrives before the command is acknowledged; session lifecycle hardened against stale sessions and invalid state transitions.
- The file-drop overlay no longer sticks open after an interrupted or cancelled OS drag, and remote-control shortcuts are suppressed while it is visible.
- Chromium's benign `ResizeObserver` warnings no longer trigger the crash-report modal (#66).
- Action Scripts: the Builder, Executor and Import flows can validate scripts that include or resolve a dev password; MCP and remote authoring keep the strict rejection.
- MCP: readiness is reported when the MITM proxy is active even without raw packet capture, and the app name is set before single-instance/userData resolution so settings never land in the wrong folder and the MCP descriptor no longer drifts.
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
- Fiddle: the temporary Fiddle channel is now removed from the device on every exit path — closing the Fiddle window, switching the Fiddle's target device, closing that device's tab, and quitting Roku Dev Studio (the quit now waits, briefly, for the delete to reach the device; previously the channel stayed installed). A device that is already off cannot be cleaned and is left as is.
- Fiddle: the terminal went blank whenever a debugger attached to the run — which the per-device "Enable Debugger" flag now does automatically — because Roku routes the channel's print output to the debugger instead of the console port. Debugger output is now fed to the Fiddle terminal as well, for local, lab-server and Cloud Emulator devices.
- Remote Server: when a lab server restarts (for example after a redeploy), Roku Dev Studio now reconnects its debugger and Network Inspector event streams with a capped backoff. Previously every open remote tab's debugger sidebar froze at "Connecting…" until the app was restarted.
- Sideload Relay: a run no longer opens a second tab ("… @ Remote") for a lab-server device that is already open. Relay targets and the remembered auto-connect list store the location's internal id, which changes when a location is removed and re-added; the app now resolves the location by its server URL (or Cloud Emulator account) when that id is stale, and refuses to open a tab for a location it does not know.
- Roku Cloud Emulator: connecting a device while its first connect was still in flight (a startup auto-connect overlapping a Sideload Relay run, a second click on Connect, or an MCP `connect_device` call) opened two identical tabs. Connects are now single-flight per device.
- Startup: the remembered-devices auto-connect no longer skips itself when some tab is already open by the time the startup scans finish (a Sideload Relay run during startup opened its targets first, and the remaining remembered tabs never came back). Entries in the remembered list that resolve to the same device are connected once.
- RCE devices: the Device Info panel and Organization row in the device modal no longer go blank ("Device info unavailable.", "N/A") after the first device-state push, which was nulling the device's account name; the name is now stamped at every normalization site.
- Add Location: adding an RDS Relay location no longer fails with a TypeError once an RCE account exists (the host dedupe skips RCE entries). Adding an RCE account now rejects a PAT that is already stored (no API call) and a different PAT for the same RCE user (compares the `GET /user/me` id, recorded alongside each stored token and backfilled once for older accounts). A rejected PAT now reads "Unauthorized — invalid or missing RCE token." instead of a JSON parse error from the plain-text 401 body.
- **Auto Connect:** closing a device tab while a scan is still running no longer reconnects it. The closed device is forgotten immediately and stays dismissed for the session, and remembered-list writes are serialized, so a just-removed device can no longer be resurrected by a concurrent auto-connect and come back on the next launch.

### Security
- adm-zip updated to 0.6.1 for [CVE-2026-77301](https://github.com/advisories/GHSA-7q85-xj36-vmfc); sharp updated to 0.35.4 (security advisory).

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

### Known issues (fixed in 1.3.0)
- **macOS: the in-app update download fails with a 404.** The release's `latest-mac.yml` names `Roku-Dev-Studio-1.2.0-arm64-mac.zip`, but the asset GitHub stored is `Roku.Dev.Studio-1.2.0-arm64-mac.zip`. Update checks succeed; the download cannot. Install 1.3.0 manually once.
- **Windows and Linux: no update is ever detected.** Only `latest-mac.yml` was published with this release, so `latest.yml` / `latest-linux*.yml` are missing and those builds always show the manual-download banner.
- **macOS build is unsigned.** The signed, notarized 1.3.0 cannot be installed over it by the in-app updater; download the 1.3.0 `.dmg` once and auto-update works from there.

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

[Unreleased]: https://github.com/paramount-engineering/roku-dev-studio/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/paramount-engineering/roku-dev-studio/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/paramount-engineering/roku-dev-studio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/paramount-engineering/roku-dev-studio/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/paramount-engineering/roku-dev-studio/releases/tag/1.0.0
