# Design: CPU, memory, and object-count graphs (Remote section)

## Purpose

Define how **Roku Dev Studio** can show **lightweight, readable** graphs for **CPU usage**, **memory usage**, and **BrightScript object counts** in the **Remote** area of a device panel (below the quick remote), using the same **ECP Device Query** family the app already uses elsewhere (`api.query` / `window.roku.remoteQuery`).

This doc covers **UX**, **data sources**, **polling and scaling** (many devices, local vs relay), and **relay-server** behavior expectations. It does not prescribe exact component filenames.

---

## Goals

- Surface **actionable** dev metrics without copying full **Roku Resource Monitor** complexity.
- Charts are **detailed enough** to spot spikes and drift (CPU %, RSS-style memory, object totals), but **default to a simple** presentation (clear labels, units, short time window).
- **Polling must stay gentle** for the Electron app, the Roku (ECP server on `:8060`), and the **remote relay** when used.
- **Scale** when many devices are connected: avoid *O(devices × rate)* work when the user is not looking at a given device.

## Non-goals (initially)

- Full SG node dumps, registry diffing, or texture bitmap lists in this panel (heavy payloads; different UX).
- Historical export, alerting, or cross-session persistence (can be a later phase).
- **Export CSV** (or other export) of the metrics ring buffer — **not planned for now**; keep scope to on-screen sparklines only.
- Production-channel object counts without the keyed-dev caveats in Roku’s ECP docs (treat as advanced / optional).

---

## Placement and UX

### Placement

- **Remote** (or device **Control**) section: **below** the existing quick remote / key area.
- A single collapsible block: **“Device metrics”** (or **“Channel resources”**) with a short subtitle that these require **developer mode** and **Control by mobile apps → Enabled** (same prerequisites as other dev ECP queries).

### Visual design (simple, not busy)

Recommend **three row strips**, not a dense dashboard:

1. **CPU** — Combined **user + system** CPU % (single line or stacked area maxing at 100%). Optional tiny legend “user / sys” only if both series stay readable; otherwise one **total** line derived in the client (`user + sys` capped sensibly) for minimalism.
2. **Memory** — Primary series: **`<used>`** from `chanperf` (bytes → MB with 1 decimal). Optional faint band or second line for **`<res>`** only if it adds clarity without clutter; default to **used only**.
3. **Objects** — Single scalar time series: **total object count** from `app-object-counts` (sum of counts, or the single most relevant total if the XML exposes a summary — parse strategy in implementation).

Each row:

- **Label + current value** on the left (e.g. `CPU 14%`, `Mem 84 MB`, `Objects 1,240`).
- **Sparkline / mini chart** for the last **N** samples (see **Retention** below).
- **Y-axis**: soft auto-scale per series; CPU fixed **0–100%** if showing combined %.

**Empty / error states**

- If query fails (ECP disabled, dev mode off, wrong app id for object counts): show a **one-line** reason and a **Retry** / link to help, not a blank chart.

### Retention (time window)

- Keep **in-memory ring buffer** only, per device tab: e.g. **60 samples** (fixed count is fine). **Wall-clock span** of the chart = `60 × (device metrics poll interval from settings)` — so a faster user-chosen interval shows a shorter recent window; a slower interval stretches history. No need for a large canvas; **sparkline** resolution is enough to see trends.

---

## Data sources (Roku-documented ECP)

All of these are **HTTP GET** to the device’s ECP port **8060**, returning **XML** (see [External Control API](https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md)).

| Metric | Endpoint | Notes |
|--------|----------|--------|
| CPU + memory (channel process) | **`GET /query/chanperf`** | XML includes `<cpu-percent>` (`<user>`, `<sys>`) and `<memory>` (`<used>`, `<res>`, etc.). Documented example uses RAM in bytes. Requires **developer mode** and **Control by mobile apps** per ECP table. |
| BrightScript object counts | **`GET /query/app-object-counts/{appId}`** | Roku OS **13+**. **v1:** call **only** for **`dev`** (sideloaded developer channel). **Architecture:** keep the fetch path parameterized by `appId` so we can later add settings or active-app–driven targets (e.g. keyed store apps) without rewriting the graph layer. |
| (Optional heavier SG metric) | **`GET /query/sgnodes/all?count_only=true`** | Lighter than full node dump when `count_only=true`; still more expensive than `chanperf` — **not recommended** for default 1 Hz polling; reserve for manual refresh or low frequency. |

**Parsing**

- Prefer **one shared XML parse path** used by Device Queries / action scripts (avoid duplicate ad-hoc parsers).
- Treat missing fields as “unavailable” for that OS / app state.

---

## Polling strategy (gentle on Roku, app, and relay)

### Default vs user-configured interval

- Ship an **ideal default** poll interval tuned for **responsive graphs without hammering** the device (concrete value chosen at implementation time; **~1–2 s** is a reasonable starting band for `chanperf` + `app-object-counts` in one batched tick).
- Expose the interval as an **app setting** (e.g. **“Device metrics sample interval”** in seconds or milliseconds) so power users can slow it down for weak networks / many tabs, or speed it up within safe bounds.
- **Enforce min/max in settings UI and validation** (e.g. floor **≥ 500 ms** to avoid pathological ECP load, ceiling **≤ 10–15 s** so the graph still feels live). Values outside range fall back to nearest clamped value.
- **Do not** rely on `chanperf/?duration-seconds=` as a tight client-driven loop; keep **explicit GETs** on a schedule the app controls (setting-driven + jitter below).

### Principles

1. **Poll only what is visible** — If the device tab is **not selected**, or the **metrics strip is collapsed**, **do not** poll (or use a **much slower** keepalive, e.g. every 60 s, optional — default **off** when collapsed).
2. **One coordinator per device** — A single timer drives **one batched tick** for that device: fetch **chanperf** and **app-object-counts** in **sequence** or **limited parallel** (max 2 in flight), not independent overlapping intervals.
3. **Interval from settings** — The base period between ticks = **configured sample interval** (see above). Re-read setting when the settings window saves or when a shared `app-user-settings` (or equivalent) subscription fires so live tabs pick up changes without restart.
4. **Jitter** — Add **±200–400 ms** random jitter per tick to avoid synchronized bursts across devices.
5. **Page visibility** — When `document.visibilityState === 'hidden'`, **pause** polling (or drop to 30–60 s) to save CPU and battery.
6. **Backoff on errors** — On repeated failure (403/401, timeout, parse error), **exponential backoff** (e.g. 2s → 4s → 8s … cap 60s) and surface status in UI.
7. **De-dupe in flight** — If a tick is slow, **skip** the next tick until the prior completes (no pile-up).

### Why this scales for **multiple devices**

- **Worst case** without visibility gating: *N devices × (chanperf + object counts) / interval* → hurts Rokus and relay.
- With **tab-selected + section-expanded** gating: **at most one device** at full rate, plus optionally **zero** for background tabs.
- If product later requires “background monitoring for all devices,” introduce a **global cap** (e.g. max **2** devices at low rate, queue others) — document as phase 2.

---

## Local vs remote (relay) data path

### Local

- Renderer (or main) issues ECP GET to `http://{ip}:8060/query/...` via existing IPC / HTTP helpers (same stack as current Device Queries).

### Remote

The relay already exposes proxied queries:

- **`GET /device/:ip/query/*`** (see `packages/roku-dev-studio-remote-server/roku-remote-server.ts` header comments and handler).

So the **same** logical paths (`/query/chanperf`, `/query/app-object-counts/dev`) are used; the **client** uses `api.query` (`window.roku.remoteQuery(serverUrl, ip, endpoint)`), keeping **one code path**.

### Relay server performance

- Each poll is **one HTTP request** relay → device ECP. Keep payloads small (**chanperf** and **app-object-counts** XML are bounded compared to full `sgnodes` dumps).
- **Do not** add relay-side **per-device tight loops**; the **tool** owns cadence. Relay remains a **stateless proxy**.
- If relay logs every query, consider **sampling** or **debug-only** logging for these endpoints to avoid disk I/O at scale.

---

## Implementation sketch (high level)

1. **Metrics controller** (per device tab instance): holds ring buffers, timer id, visibility listeners, `inFlight` guard, and **subscribes to the global setting** for sample interval.
2. **Fetch layer**: `fetchChanperf()`, `fetchObjectCounts(appId)` returning normalized numbers + timestamps; shared **XML** parsing.
3. **View**: three rows of sparkline + current value; CSS aligned with existing device panel cards.
4. **Wire-up**: only start controller when Remote / metrics section is mounted **and** device is connected; `destroy()` clears timers and listeners.

### App id for object counts

- **v1 behavior:** request **`/query/app-object-counts/dev` only** — object-count graph applies to the **sideloaded dev channel**, not whatever happens to be in the foreground. CPU/memory from `chanperf` still reflect the **current channel process** per Roku’s response; document that subtlety in UI help text if users confuse the two.
- **Expandability:** implement `fetchObjectCounts(appId: string)` and a single place (settings or future dropdown) that supplies `appId`; default constant **`'dev'`**. Later phases can add **active-app id**, **user-picked app id**, or keyed-store flows without changing the graph component.

---

## Testing and acceptance

- **Single local device**: graphs update smoothly at default interval; no UI jank.
- **Settings change**: after saving a new **device metrics sample interval**, open metrics tabs **pick up the new cadence** without app restart.
- **Tab switch**: polling stops for background device; resumes for foreground without duplicate timers.
- **Collapsed metrics**: no polling (or documented slow path).
- **Remote device** via relay: same behavior, relay CPU stable with 3–5 simulated clients each viewing one device.
- **Failure modes**: ECP disabled → clear message, backoff works, no runaway retry loop.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| `chanperf` / object counts **unavailable** (settings, OS) | Graceful empty state + prerequisites text. |
| **Object counts** scope confusion (foreground vs `dev`) | v1 documents that counts are for **`dev`** only; CPU/mem still useful for any channel. |
| Users open **many tabs** and leave metrics expanded | Visibility + tab focus gating; optional global poll budget (phase 2). |
| XML size grows on future OS | Cap buffer size; parse only needed nodes. |

---

## References

- Roku **External Control API** (`query/chanperf`, `query/app-object-counts`, prerequisites): https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md  
- Relay routes: `packages/roku-dev-studio-remote-server/roku-remote-server.ts` (`GET /device/:ip/query/*`).  
- Existing query presets: `apps/roku-dev-studio/renderer/index.html` (Object Counts button), `apps/roku-dev-studio/renderer/components/action-scripts/action-registry.ts` (chanperf, sgnodes, etc.).

---

## Decisions (product)

| Topic | Decision |
|--------|-----------|
| **Sampling rate** | Use a **single ideal default** interval at ship time; expose **user-configurable sample interval** in **app settings** (with validated min/max). No separate “high resolution” toggle beyond what the setting allows. |
| **CSV export** | **Not for now** — no export of ring buffer data; revisit only if bug-report workflows need it. |
| **Object counts target** | **v1:** **`dev` only** for `app-object-counts`. Keep code **expandable** (parameterized `appId`, future UI for other apps / keyed channels) without implementing non-`dev` targets in the first release. |
