# UI Text Casing Review

Audit of user-visible text (labels, badges, tooltips, `aria-label`s, placeholders, status/error/toast messages, menu items, headings) across the app that is lowercase or mis-cased and should use proper sentence/title casing.

## How to read this

- **Corrections** — clear casing fixes with a proposed replacement. Grouped by area.
- **Uncertain / needs human decision** — strings where a change is plausible but depends on a style choice (sentence vs Title Case, intentionally-lowercase placeholders, example syntax, abbreviations, product-naming). Listed at the end.
- `Current` / `Suggested` show only the text fragment; `${...}` tokens are dynamic values and stay unchanged.

## Casing conventions assumed

- **Buttons / field labels / section headings / badges / menu items** → Title Case (`Add Field`, `Capture Setup`).
- **Tooltips, descriptions, toasts, error/status messages** → sentence case (capitalize first word + proper nouns).
- **Proper nouns** always cased correctly anywhere they appear: Roku, BrightScript, BrightScript Fiddle, RALE, ECP, App Connector, App Function, TrackerTask, Wireshark, Npcap, macOS, Windows, Linux, Dev App, Dev Mode, Developer Mode, Network Inspector, Action Script(s), Quick Remote, Floating Remote, Telnet, Keychain, JSON, URL, HTTP, HTTPS, DNS, SNI, CPU, ID, PDF, PCAP, MITM, BPF, CA, TLS, Content-Type.

---

# Corrections

## 1. Network Inspector (renderer)


| File:Line                                                          | Current                                         | Suggested                                                | Type    | Notes                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------- | ------- | --------------------------------------------------------- |
| `renderer/components/network-inspector/network-tab.ts:115`         | Response content-type (alias content-type:).    | Response Content-Type (alias `content-type`:).           | message | Header name in prose; keep filter token lowercase.        |
| `renderer/components/network-inspector/network-tab.ts:141`         | Filter help                                     | Filter Help                                              | aria    | Match Title Case of other dialogs (e.g. "Traffic Rules"). |
| `renderer/components/network-inspector/network-tab.ts:147`         | …status, kind, or content-type.                 | …status, kind, or Content-Type.                          | message | Filter help prose.                                        |
| `renderer/components/network-inspector/network-tab.ts:768`         | Proxy Port unavailable                          | Proxy Port Unavailable                                   | message | Align with title-case badge.                              |
| `renderer/components/network-inspector/network-tab.ts:933`         | …to capture Network requests.                   | …to capture Network Requests.                            | message | Erroneous mid-sentence capital on "Network".              |
| `renderer/components/network-inspector/network-tab.ts:1373`        | Capture setup                                   | Capture Setup                                            | badge   | Pair with "Capture Blocked" for consistency.              |
| `renderer/components/network-inspector/network-tab.ts:1376`        | Hotspot capture setup - click for instructions  | Hotspot Capture Setup — Click for Instructions           | tooltip | Capitalize feature name.                                  |
| `renderer/components/network-inspector/network-sessions.ts:75`     | pending…                                        | Pending…                                                 | label   | Duration label; matches "Pending" status pill.            |
| `renderer/components/network-inspector/network-detail.ts:380`      | query ${hostname}                               | Query ${hostname}                                        | label   | DNS summary text.                                         |
| `renderer/components/network-inspector/network-detail.ts:441`      | (pending)                                       | (Pending)                                                | message | DNS response placeholder.                                 |
| `renderer/components/network-inspector/traffic-rules-modal.ts:215` | Traffic rules                                   | Traffic Rules                                            | aria    | Match modal heading.                                      |
| `renderer/components/network-inspector/traffic-rules-modal.ts:233` | Device traffic                                  | Device Traffic                                           | heading | Section card title.                                       |
| `renderer/components/network-inspector/traffic-rules-modal.ts:244` | Bandwidth limit                                 | Bandwidth Limit                                          | label   | Form field label.                                         |
| `renderer/components/network-inspector/traffic-rules-modal.ts:248` | Added latency                                   | Added Latency                                            | label   | Form field label.                                         |
| `renderer/components/network-inspector/traffic-rules-modal.ts:261` | Per-host rules                                  | Per-Host Rules                                           | heading | Section card title.                                       |
| `renderer/components/network-inspector/traffic-rules-modal.ts:478` | speed is capped to the device limit (…)         | Per-Host speed is capped to the Device Limit (…)         | message | Throttle note fragment.                                   |
| `renderer/components/network-inspector/traffic-rules-modal.ts:479` | latency is floored to the device latency (… ms) | Per-Host latency is floored to the Device Latency (… ms) | message | Throttle note fragment.                                   |
| `renderer/components/network-inspector/traffic-rules-modal.ts:480` | Host ${parts...}.                               | Per-Host ${parts...}.                                    | message | Composite status line.                                    |
| `renderer/components/network-inspector/traffic-rules-modal.ts:582` | Save failed                                     | Failed to save Traffic Rules.                            | message | Sentence case + clearer wording.                          |


## 2. Modal fragments (HTML)


| File:Line                                                                  | Current                              | Suggested                            | Type    | Notes                              |
| -------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------ | ------- | ---------------------------------- |
| `renderer/components/modals/fragments/help-modal.html:99`                  | …your running dev app                | …your running Dev App                | message | Proper noun.                       |
| `renderer/components/modals/fragments/help-modal.html:122`                 | …your running dev app                | …your running Dev App                | message | Proper noun.                       |
| `renderer/components/modals/fragments/help-modal.html:161`                 | AI agents                            | AI Agents                            | heading | Match nav label "AI Agents (MCP)". |
| `renderer/components/modals/fragments/help-modal.html:183`                 | Start / Stop capture                 | Start/Stop Capture                   | message | Toolbar feature label.             |
| `renderer/components/modals/fragments/help-modal.html:183`                 | panes layout                         | Panes Layout                         | message | Toolbar feature label.             |
| `renderer/components/modals/fragments/help-modal.html:183`                 | Configure traffic rules              | Configure Traffic Rules              | message | Matches "Traffic Rules".           |
| `renderer/components/modals/fragments/help-modal.html:193`                 | status / content-type / delay / body | status / Content-Type / delay / body | message | HTTP header name.                  |
| `renderer/components/modals/fragments/help-modal.html:215`                 | brighterscript                       | BrighterScript                       | message | Tool name.                         |
| `renderer/components/modals/fragments/help-modal.html:229`                 | Wi-Fi info                           | Wi-Fi Info                           | message | Parallel with "Channel Info".      |
| `renderer/components/modals/fragments/help-modal.html:236`                 | Auto Hide SideBar                    | Auto Hide Sidebar                    | message | "Sidebar" standard casing.         |
| `renderer/components/modals/fragments/help-modal.html:248`                 | Mac Mini                             | Mac Mini                             | message | Apple product naming.              |
| `renderer/components/modals/fragments/secret-screens-modal.html:22`        | ECP limitation                       | ECP Limitation                       | heading | Note title.                        |
| `renderer/components/modals/fragments/secret-screens-modal.html:33`        | Secret screens                       | Secret Screens                       | heading | Match "Roku Secret Screens".       |
| `renderer/components/modals/fragments/integration-guide-modal.html:46`     | App Connector Functionality          | App Connector Functionality          | message | Over-capitalized "Functionality".  |
| `renderer/components/modals/fragments/integration-guide-modal.html:241`    | your App's `components/` directory   | your App's `components/` directory   | message | Sentence-case possessive.          |
| `renderer/components/modals/fragments/action-scripts-import-modal.html:12` | Choose file                          | Choose File                          | label   | Button label.                      |
| `renderer/components/modals/fragments/action-scripts-import-modal.html:24` | Output folder                        | Output Folder                        | label   | Form label.                        |
| `renderer/components/modals/fragments/action-scripts-import-modal.html:26` | Choose folder                        | Choose Folder                        | label   | Button label.                      |
| `renderer/components/modals/fragments/add-location-modal.html:6`           | Mac Mini                             | Mac Mini                             | message | Apple product naming.              |
| `renderer/components/modals/fragments/keyboard-remote-help-modal.html:14`  | Remote action                        | Remote Action                        | heading | Table column header.               |


## 3. Action Scripts (renderer)


| File:Line                                                              | Current                                                         | Suggested                                                       | Type        | Notes                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- | ----------- | ------------------------------- |
| `renderer/components/action-scripts/builder-render-step-fields.ts:184` | Dev Password                                                    | Dev Password                                                    | placeholder | Sideload password field.        |
| `renderer/components/action-scripts/builder-render-step-fields.ts:204` | Dev Password                                                    | Dev Password                                                    | placeholder | Delete-sideload password field. |
| `renderer/components/action-scripts/builder-render-step-fields.ts:389` | Wait type                                                       | Wait Type                                                       | label       | Match "Wait Before".            |
| `renderer/components/action-scripts/builder-render-step-fields.ts:399` | media-player                                                    | Media Player                                                    | menu        | Wait "Source" option.           |
| `renderer/components/action-scripts/builder-render-step-fields.ts:417` | Poll interval (ms)                                              | Poll Interval (ms)                                              | label       | Label consistency.              |
| `renderer/components/action-scripts/builder-render-step-fields.ts:430` | Node id                                                         | Node ID                                                         | label       | Proper abbreviation.            |
| `renderer/components/action-scripts/builder-render-step-fields.ts:431` | node id                                                         | Node ID                                                         | placeholder |                                 |
| `renderer/components/action-scripts/builder-render-step-fields.ts:435` | field in fieldlist                                              | Field in FieldList                                              | placeholder | Starts lowercase.               |
| `renderer/components/action-scripts/builder-render-step-fields.ts:445` | compare string                                                  | Compare string                                                  | placeholder |                                 |
| `renderer/components/action-scripts/builder-render-step-fields.ts:461` | Poll interval (ms)                                              | Poll Interval (ms)                                              | label       | RALE wait timing row.           |
| `renderer/components/action-scripts/builder-render-step-fields.ts:542` | Node id                                                         | Node ID                                                         | label       | If-RALE panel.                  |
| `renderer/components/action-scripts/builder-render-step-fields.ts:543` | node id                                                         | Node ID                                                         | placeholder |                                 |
| `renderer/components/action-scripts/builder-render-step-fields.ts:547` | field in fieldlist                                              | Field in FieldList                                              | placeholder |                                 |
| `renderer/components/action-scripts/builder-render-step-fields.ts:557` | compare string                                                  | Compare string                                                  | placeholder |                                 |
| `renderer/components/action-scripts/builder-render-step-fields.ts:600` | Variable path                                                   | Variable Path                                                   | label       | Match "Node ID" label style.    |
| `renderer/components/action-scripts/builder-render-step-fields.ts:610` | compare value                                                   | Compare Value                                                   | placeholder |                                 |
| `renderer/components/action-scripts/action-step-help-modal.ts:99`      | RALE node field                                                 | RALE Node Field                                                 | heading     | Help modal subtitle.            |
| `renderer/components/action-scripts/action-step-help-modal.ts:114`     | Active app                                                      | Active App                                                      | heading     | Help modal subtitle.            |
| `renderer/components/action-scripts/action-step-help-modal.ts:115`     | RALE node field                                                 | RALE Node Field                                                 | heading     | Help modal subtitle.            |
| `renderer/components/action-scripts/action-step-help-modal.ts:241`     | Set var                                                         | Set Var                                                         | message     | References builder field label. |
| `renderer/components/action-scripts/builder.ts:313`                    | Update step ${index + 1}                                        | Update Step ${index + 1}                                        | heading     | Builder form heading.           |
| `renderer/components/action-scripts/builder.ts:391`                    | Cannot move a step into its own if branch.                      | Cannot move a step into its own `If` branch.                      | message     | "If" is the step type name.     |
| `renderer/components/action-scripts/import-modal.ts:280`               | Import script into Builder                                      | Import Script into Builder                                      | heading     | Import modal title.             |
| `renderer/components/action-scripts/import-modal.ts:411`               | Save Folder is required for this script (e.g. screenshot step). | Save folder is required for this Script (e.g. Screenshot step). | message     | Step type name.                 |
| `renderer/components/action-scripts/index.ts:265`                      | AI agent loaded a script into the Builder                       | AI Agent loaded a Script into the Builder                       | message     | Toast.                          |
| `renderer/components/action-scripts/index.ts:399`                      | Could not fetch app function list from the channel.             | Could not fetch App Function list from the channel.             | message     | Runtime error in UI.            |
| `renderer/components/action-scripts/index.ts:467`                      | App function returned no result.                                | App Function returned no result.                                | message     | Runtime error in UI.            |
| `renderer/components/action-scripts/script-rale-validation.ts:14`      | Ensure your dev app is running with Developer Mode on           | Ensure your Dev App is running with Developer Mode on           | message     | Connection error.               |
| `renderer/components/action-scripts/executor.ts:108`                   | Run action script                                               | Run Action Script                                               | tooltip     | Run button idle state.          |
| `renderer/components/action-scripts/executor.ts:448`                   | Device performance chart                                        | Device Performance Chart                                        | aria        | Result image alt text.          |
| `renderer/components/action-scripts/executor.ts:727`                   | (using Dev Password from Auth)                                  | (using Dev Password from Auth)                                  | message     | Validation hint.                |
| `renderer/components/action-scripts/executor.ts:1202`                  | Save results as PDF                                             | Save Results as PDF                                             | tooltip     | Save button.                    |
| `renderer/components/action-scripts/executor-engine.ts:261`            | invalid media player response                                   | Invalid `media-player` response                                   | message     | Wait polling status.            |
| `renderer/components/action-scripts/executor-engine.ts:264`            | query failed: ${res.error}                                      | Query failed: ${res.error}                                      | message     | Wait polling status.            |
| `renderer/components/action-scripts/executor-engine.ts:264`            | no response                                                     | No Response                                                     | message     | Wait polling status.            |
| `renderer/components/action-scripts/executor-engine.ts:330`            | Connecting to telnet (port 8080)...                             | Connecting to Telnet (port `8080`)...                             | message     | Run log.                        |
| `renderer/components/action-scripts/executor-engine.ts:388`            | Active app · ${attr}                                            | Active App · ${attr}                                            | label       | If-step details column.         |
| `renderer/components/action-scripts/executor-engine.ts:400`            | query ${...}                                                    | Query ${...}                                                    | label       | Step description card header.   |
| `renderer/components/action-scripts/executor-engine.ts:402`            | telnet ${...}                                                   | Telnet ${...}                                                   | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:404`            | post ${...}                                                     | POST ${...}                                                     | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:406`            | keypress ${...}                                                 | Keypress ${...}                                                 | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:408`            | send text "${...}"                                              | Send text "${...}"                                              | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:410`            | launch app ${...}                                               | Launch app ${...}                                               | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:412`            | sideload ${...}                                                 | Sideload ${...}                                                 | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:414`            | delete sideload                                                 | Delete Sideload                                                 | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:417`            | app function ${...}                                             | App Function ${...}                                             | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:424`            | screenshot (${step.label})                                      | Screenshot (${step.label})                                      | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:426`            | screenshot (wait after: ${...}ms)                               | Screenshot (wait after: ${...}ms)                               | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:428`            | screenshot                                                      | Screenshot                                                      | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:447`            | wait · ${w}                                                     | Wait · ${w}                                                     | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:448`            | wait                                                            | Wait                                                            | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:451`            | if · ${line}                                                    | If · ${line}                                                    | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:452`            | if (…)                                                          | If (…)                                                          | label       | Step description.               |
| `renderer/components/action-scripts/executor-engine.ts:623`            | Device query "${ep}" uses dev telnet "${telnetCmd}"             | Device Query "${ep}" uses dev Telnet "${telnetCmd}"             | message     | Run log.                        |
| `renderer/components/action-scripts/executor-engine.ts:737`            | Invalid raleCommand                                             | Invalid RALE command                                            | message     | Run error.                      |
| `renderer/components/action-scripts/executor-engine.ts:766`            | Developer password required for screenshot.                     | Developer Password required for Screenshot.                     | message     | Step type name.                 |
| `renderer/components/action-scripts/executor-engine.ts:776`            | active-app query failed                                         | Active App query failed                                         | message     | Run error fallback.             |


## 4. Inspector (renderer)


| File:Line                                                 | Current                                                                               | Suggested                                                                                                  | Type    | Notes                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------- | ----------------------------- |
| `renderer/components/inspector/function-selector.ts:73`   | ${n} app function(s), ${m} RALE command(s)                                            | ${n} App Function(s), ${m} RALE command(s)                                                                 | message | Param hint (connected).       |
| `renderer/components/inspector/function-selector.ts:91`   | ${n} app function(s), ${m} RALE command(s)                                            | ${n} App Function(s), ${m} RALE command(s)                                                                 | message | Param hint (no selection).    |
| `renderer/components/inspector/function-execution.ts:75`  | Unknown RALE builtin                                                                  | Unknown RALE Builtin                                                                                       | message | Response panel error.         |
| `renderer/components/inspector/function-execution.ts:212` | getExternalControlFunctions returned false - make sure scene implements this function | `getExternalControlFunctions` returned `false` — make sure the `SceneGraph` scene implements this function | message | Response panel error.         |
| `renderer/components/inspector/node-update-panel.ts:43`   | integer: invalid number                                                               | Integer: invalid number                                                                                    | message | Inconsistent with "Boolean:". |
| `renderer/components/inspector/node-update-panel.ts:48`   | float: invalid number                                                                 | Float: invalid number                                                                                      | message | Modal feedback.               |
| `renderer/components/inspector/node-update-panel.ts:53`   | color: use integer (e.g. -16777216)                                                   | Color: use integer (e.g. -16777216)                                                                        | message | Modal feedback.               |
| `renderer/components/inspector/node-update-panel.ts:63`   | vector2d: at least two elements, e.g. [0,0]                                           | Vector2d: at least two elements, e.g. [0,0]                                                                | message | Modal feedback.               |
| `renderer/components/inspector/node-update-panel.ts:66`   | rect2d: four elements, e.g. [0,0,100,100]                                             | Rect2d: four elements, e.g. [0,0,100,100]                                                                  | message | Modal feedback.               |
| `renderer/components/inspector/node-update-panel.ts:80`   | array: invalid JSON array                                                             | Array: invalid JSON array                                                                                  | message | Modal feedback.               |
| `renderer/components/inspector/node-update-panel.ts:90`   | AssocArray: JSON object required                                                      | AssocArray: JSON object required                                                                           | message | Modal feedback.               |
| `renderer/components/inspector/node-update-panel.ts:92`   | AssocArray: JSON object required                                                      | AssocArray: JSON object required                                                                           | message | Modal feedback.               |
| `renderer/components/inspector/node-update-panel.ts:324`  | Remove field                                                                          | Remove Field                                                                                               | label   | Apply button (remove).        |
| `renderer/components/inspector/node-update-panel.ts:326`  | Add field                                                                             | Add Field                                                                                                  | label   | Apply button (add).           |
| `renderer/components/inspector/node-update-panel.ts:328`  | Update field                                                                          | Update Field                                                                                               | label   | Apply button (update).        |
| `renderer/components/inspector/rale-connection.ts:120`    | Please launch the sideloaded app first.                                               | Please launch the Sideloaded Dev App first.                                                                | message | Connect preflight error.      |


## 5. Dev App / Queries / Fiddle / Log Viewer (renderer)


| File:Line                                                            | Current                                                                       | Suggested                                                                     | Type        | Notes                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| `renderer/components/dev-app/screenshots.ts:45`                      | Launch the sideloaded dev app on the device to capture a screenshot.          | Launch the sideloaded Dev App on the device to capture a screenshot.          | tooltip     | Proper noun.                                   |
| `renderer/components/dev-app/screenshots.ts:72`                      | Launch the dev app on the device before capturing a screenshot.               | Launch the Dev App on the device before capturing a screenshot.               | message     | Proper noun.                                   |
| `renderer/components/dev-app/device-metrics.ts:299`                  | …and chanperf "used" memory…                                                  | …and `chanperf` ("used") memory…                                     | message     | Replace raw API name with user-facing wording. |
| `renderer/components/dev-app/device-metrics.ts:828`                  | Waiting for proc-stat sample…                                                 | Waiting for `proc-stat` sample…                                        | message     | CPU Process empty-state.                       |
| `renderer/components/dev-app/device-metrics.ts:963`                  | since first observed                                                          | Since first observed                                                          | badge       | CPU Process secondary value.                   |
| `renderer/components/dev-app/device-metrics.ts:979`                  | user ${cUserSec} · kernel ${cSysSec}                                          | User ${cUserSec} · Kernel ${cSysSec}                                          | badge       | Secondary value labels.                        |
| `renderer/components/dev-app/device-metrics.ts:986`                  | minor / major                                                                 | Minor/Major                                                                 | badge       | Child faults label.                            |
| `renderer/components/dev-app/device-metrics.ts:1210`                 | …if you need sideloaded dev object counts.                                    | …if you need sideloaded Dev App object counts.                                | message     | Objects empty-state.                           |
| `renderer/components/dev-app/device-metrics.ts:1254`                 | chanperf request failed                                                       | `chanperf` request failed                                            | message     | Error toast.                                   |
| `renderer/components/dev-app/device-metrics.ts:1258`                 | Could not parse channel performance (developer mode / ECP / chanperf).        | Could not parse Channel Performance (Dev Mode / `ECP` / `chanperf`).              | message     | Error toast.                                   |
| `renderer/components/dev-app/device-metrics.ts:1512`                 | Device performance paused — bring the Dev App to the foreground to resume.    | Device Performance Paused — bring the Dev App to the foreground to resume.    | message     | Inconsistent with sibling strings.             |
| `renderer/components/dev-app/device-metrics.ts:1513`                 | Performance paused                                                            | Device Performance paused                                                     | badge       | Align with feature name.                       |
| `renderer/components/dev-app/device-metrics.ts:1514`                 | Device performance paused — bring the Dev App to the foreground to resume.    | Device Performance Paused — bring the Dev App to the foreground to resume.    | tooltip     | Same as line 1512.                             |
| `renderer/components/dev-app/device-metrics.ts:84`                   | Tracing stop                                                                  | Tracing Stop                                                                  | label       | Linux process-state label.                     |
| `renderer/components/dev-app/device-metrics.ts:85`                   | Disk wait                                                                     | Disk Wait                                                                     | label       | Linux process-state label.                     |
| `renderer/components/dev-app/remote-metrics-charts.ts:151`           | Channel performance unavailable (chanperf status failed).                     | Channel Performance unavailable (status failed).                              | message     | Drop raw API identifier.                       |
| `renderer/components/dev-app/device-metrics-performance-step.ts:369` | Developer mode must be enabled on this device to capture performance metrics. | Developer Mode must be enabled on this device to capture performance metrics. | message     | Action Script step error.                      |
| `renderer/components/dev-app/password-auth.ts:95`                    | Verification failed — no response from the app.                               | Verification failed — no response from the Dev App.                           | message     | Auth status detail.                            |
| `renderer/components/queries/telnet-command-handler.ts:35`           | Connecting to telnet (port 8080)...                                           | Connecting to Telnet (port `8080`)...                                           | message     | Query output status.                           |
| `renderer/components/queries/telnet-command-handler.ts:43`           | Error: Failed to connect to telnet (port 8080):                               | Error: Failed to connect to Telnet (port `8080`):                               | message     | Query output error.                            |
| `renderer/components/queries/remove-plugin-handler.ts:55`            | Connecting to telnet (port 8080)...                                           | Connecting to Telnet (port `8080`)...                                           | message     | Query output status.                           |
| `renderer/components/fiddle/fiddle.ts:482`                           | No dev-enabled devices found                                                  | No Dev Mode–enabled devices found                                             | placeholder | Device dropdown empty state.                   |
| `renderer/components/fiddle/fiddle.ts:796`                           | Fiddle channel removed.                                                       | BrightScript Fiddle channel removed.                                          | message     | Status after Stop.                             |


## 6. Renderer modules


| File:Line                                                 | Current                                                      | Suggested                                                    | Type    | Notes                                    |
| --------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------- | ---------------------------------------- |
| `renderer/modules/utils/telnet-system-command-run.ts:133` | Failed to connect to telnet (port 8080): ${err} | Failed to connect to Telnet (port `8080`) : ${err} | 'unknown'} | Failed to connect to Telnet (port 8080): ${err || 'Unknown'} | message | Telnet proper noun; capitalize fallback. |
| `renderer/modules/utils/telnet-system-command-run.ts:143` | Remote telnet poll not available                             | Remote Telnet poll not available                             | message | Telnet proper noun.                      |
| `renderer/modules/utils/telnet-system-command-run.ts:218` | Failed to send command: ${err} | Failed to send Command: ${err} | 'unknown'}                  | Failed to send command: ${err || 'Unknown'}                  | message | Capitalize fallback.                     |
| `renderer/modules/console-log/console-find-bar.ts:497`    | (highlights capped)                                          | (Highlights capped)                                          | badge   | Match capitalized "Searching…".          |
| `renderer/modules/console-log/console-find-bar.ts:499`    | ${navPart} (searching ${pct}%)                               | ${navPart} (Searching ${pct}%)                               | badge   | Match "Searching… 0%".                   |


## 7. Main process (Settings / About / Menus / Dialogs)


| File:Line                                    | Current                                                                                                  | Suggested                                                                                                      | Type    | Notes                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| `main/about-dialog.ts:224`                   | roku-dev-studio-api Version:                                                                             | `roku-dev-studio-api` Version:                                                                                   | label   | About dialog version row.                       |
| `main/about-dialog.ts:249`                   | roku-dev-studio                                                                                          | `roku-dev-studio`                                                                                                 | label   | Repo link text in copyright line.               |
| `main/about-dialog.ts:251`                   | built by                                                                                                 | Built by                                                                                                       | label   | Copyright line starts lowercase.                |
| `main/about-dialog.ts:266`                   | roku-dev-studio-api Version:                                                                             | Roku Dev Studio API Version:                                                                                   | message | Same label in copied text.                      |
| `main/hamburger-menu.ts:52`                  | Open log file                                                                                            | Open Log File                                                                                                  | dialog  | File-picker dialog title.                       |
| `main/hamburger-menu.ts:56`                  | Log & text                                                                                               | Log & Text                                                                                                     | dialog  | Dialog filter name.                             |
| `main/hamburger-menu.ts:59`                  | All files                                                                                                | All Files                                                                                                      | dialog  | Dialog filter name.                             |
| `main/ipc/network-inspector-handlers.ts:141` | Save packet capture                                                                                      | Save Packet Capture                                                                                            | dialog  | Native save-dialog title.                       |
| `main/settings-dialog.ts:1131`               | Extra Logging in the Main Window                                                                         | Extra Logging in the Main Window                                                                               | label   | Odd mid-phrase caps in description.             |
| `main/settings-dialog.ts:1160`               | Roku Remote - Use Keyboard                                                                               | Use Keyboard for Roku Remote                                                                                   | label   | Inconsistent caps + trailing space.             |
| `main/settings-dialog.ts:1161`               | When On, you can use Keyboard to control the Roku. Keyboard Shortcuts can be found in Remote Help Modal. | When on, you can use the keyboard to control the Roku. Keyboard shortcuts are listed in the Remote Help modal. | label   | Over-capitalized common nouns.                  |
| `main/settings-dialog.ts:1171`               | …closing the App in the previous session.                                                                | …closing the App in the previous session.                                                                      | label   | "App" mid-sentence.                             |
| `main/settings-dialog.ts:1180`               | Auto Hide SideBar                                                                                        | Auto-Hide Sidebar                                                                                              | label   | "SideBar" nonstandard.                          |
| `main/settings-dialog.ts:1181`               | …the SideBar which presents the Devices List…                                                            | …the Sidebar, which presents the devices list…                                                                 | label   | Fix SideBar/Devices List casing.                |
| `main/settings-dialog.ts:1191`               | …encrypted via the OS keychain…                                                                          | …encrypted via the OS Keychain…                                                                                | label   | Proper noun.                                    |
| `main/settings-dialog.ts:1237`               | …start with the just the remote until…                                                                   | …start with just the Remote tab until…                                                                         | label   | Lowercase "remote"; also fixes typo "the just". |
| `main/settings-dialog.ts:1312`               | MITM proxy port                                                                                          | MITM Proxy Port                                                                                                | label   | Field label.                                    |
| `main/settings-dialog.ts:1319`               | Per-device packet limit                                                                                  | Per-Device Packet Limit                                                                                        | label   | Field label.                                    |
| `main/settings-dialog.ts:1320`               | …for the pcap export.                                                                                    | …for the PCAP export.                                                                                          | label   | Acronym.                                        |
| `main/settings-dialog.ts:1329`               | View setup                                                                                               | View Setup                                                                                                     | button  | Button label.                                   |
| `main/settings-dialog.ts:1759`               | min:                                                                                                     | Min:                                                                                                           | label   | Bound hint.                                     |
| `main/settings-dialog.ts:1769`               | max:                                                                                                     | Max:                                                                                                           | label   | Bound hint.                                     |
| `main/settings-dialog.ts:1996`               | …via system keychain).                                                                                   | …via System Keychain).                                                                                         | message | Keychain status.                                |
| `main/settings-dialog.ts:1999`               | …uses basic_text — passwords are base64 plaintext…                                                       | …uses basic text — passwords are Base64-encoded plaintext…                                                     | message | Avoid raw backend identifier.                   |
| `main/settings-dialog.ts:1294`               | Proxy port unavailable                                                                                   | Proxy Port Unavailable                                                                                         | heading | Conflict title.                                 |
| `main/settings-dialog.ts:2333`               | Proxy port unavailable                                                                                   | Proxy Port Unavailable                                                                                         | message | JS fallback; must match package string.         |
| `main/settings-dialog.ts:2496`               | Installed — return to the Network tab.                                                                   | Installed — return to the Network Inspector tab.                                                               | message | Tab is "Network Inspector".                     |
| `main/settings-dialog.ts:2501`               | Setup failed                                                                                             | Setup failed.                                                                                                  | message | Add terminal period for consistency.            |
| `main/settings-window-ipc.ts:59`             | Wait After Dev App Launch Before Screenshot.                                                             | Wait after Dev App launch before screenshot.                                                                   | label   | Title case mid-sentence.                        |
| `main/settings-window-ipc.ts:70`             | …needs developer mode and Control by mobile apps.                                                        | …needs Developer Mode and Control by Mobile Apps.                                                              | label   | Roku setting names.                             |
| `main/settings-window-ipc.ts:74`             | How far back the CPU and System memory charts plot                                                       | How far back the CPU and System Memory charts plot                                                             | label   | "System" over-capitalized.                      |


## 8. index.html (visible content)


| File:Line                   | Current                                                   | Suggested                                                 | Type   | Notes                      |
| --------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | ------ | -------------------------- |
| `renderer/index.html:12550` | …debug live BrightScript with a streaming telnet console… | …debug live BrightScript with a streaming Telnet console… | label  | Welcome subtitle.          |
| `renderer/index.html:12601` | …via Telnet, Filter and Search.                           | …via Telnet, Filter and Search.                      | label  | Random caps mid-sentence.  |
| `renderer/index.html:13101` | Auto screenshot                                           | Auto Screenshot                                           | label  | Match "Screenshot" card.   |
| `renderer/index.html:13359` | Only one telnet connection to a Roku device…              | Only one Telnet connection to a Roku device…              | label  | Console empty-state.       |
| `renderer/index.html:13406` | Log verbosity                                             | Log Verbosity                                             | label  | App Connector field label. |
| `renderer/index.html:13507` | Update field                                              | Update Field                                              | button | Update Node modal.         |
| `renderer/index.html:13508` | Add field                                                 | Add Field                                                 | button | Update Node modal.         |
| `renderer/index.html:13509` | Remove field                                              | Remove Field                                              | button | Update Node modal.         |
| `renderer/index.html:13600` | Action type                                               | Action Type                                               | label  | Builder form label.        |
| `renderer/index.html:13605` | Action type                                               | Action Type                                               | label  | Builder footer row.        |
| `renderer/index.html:13626` | or paste below                                            | Or Paste below                                            | label  | Executor import hint.      |
| `renderer/index.html:13694` | Capture setup                                             | Capture Setup                                             | badge  | Network Inspector badge.   |
| `renderer/index.html:13698` | Proxy Port unavailable                                    | Proxy Port Unavailable                                    | badge  | Port-conflict badge.       |
| `renderer/index.html:13770` | Copy body                                                 | Copy Body                                                 | option | Copy menu item.            |


## 9. Network Inspector package (remediation / prerequisites)


| File:Line                                                               | Current                                         | Suggested                                       | Type    | Notes                              |
| ----------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- | ------- | ---------------------------------- |
| `packages/roku-dev-studio-network-inspector/index.ts:1083`              | …Network Inspector → Proxy port.                | …Network Inspector → MITM Proxy Port.           | message | Align with Settings field label.   |
| `packages/roku-dev-studio-network-inspector/index.ts:1091`              | Proxy Port unavailable                          | Proxy Port Unavailable                          | heading | Drives Settings + badge.           |
| `packages/roku-dev-studio-network-inspector/index.ts:1092`              | An App or a Process is already using port       | An App or a Process is already using port         | message | Erroneous mid-string caps.         |
| `packages/roku-dev-studio-network-inspector/setup-guide.ts:55`          | Packet capture access                           | Packet Capture Access                           | heading | Setup modal subhead (macOS/Linux). |
| `packages/roku-dev-studio-network-inspector/setup-guide.ts:80`          | Hotspot capture access (Npcap)                  | Hotspot Capture Access (Npcap)                  | heading | Setup modal subhead (Windows).     |
| `packages/roku-dev-studio-network-inspector/setup-guide.ts:115`         | Packet capture access                           | Packet Capture Access                           | heading | Setup modal subhead (Linux).       |
| `packages/roku-dev-studio-network-inspector/prerequisites.ts:50`        | Packet capture ready                            | Packet Capture Ready                            | heading | PrerequisiteCheck title.           |
| `packages/roku-dev-studio-network-inspector/prerequisites.ts:59`        | Packet capture blocked                          | Packet Capture Blocked                          | heading | PrerequisiteCheck title.           |
| `packages/roku-dev-studio-network-inspector/prerequisites.ts:75`        | Packet capture ready                            | Packet Capture Ready                            | heading | Linux ok-state title.              |
| `packages/roku-dev-studio-network-inspector/prerequisites.ts:83`        | Packet capture needs setup                      | Packet Capture Needs Setup                      | heading | Linux blocked-state title.         |
| `packages/roku-dev-studio-network-inspector/prerequisites.ts:122`       | Hotspot capture needs Npcap (optional)          | Hotspot Capture Needs Npcap (Optional)          | heading | Windows optional prereq title.     |
| `packages/roku-dev-studio-network-inspector/prerequisites.ts:143`       | Capture module unavailable                      | Capture Module Unavailable                      | heading | Windows cap-module title.          |
| `packages/roku-dev-studio-network-inspector/capture-access-linux.ts:53` | Packet Capture Setup is only required on Linux. | Packet Capture Setup is only required on Linux. | message | Sentence case in error/status.     |
| `packages/roku-dev-studio-network-inspector/bpf-access-macos.ts:118`    | Packet Capture Setup is only required on macOS. | Packet Capture Setup is only required on macOS. | message | Sentence case in error/status.     |


---

# Uncertain / needs human decision

These depend on a style choice (sentence vs Title Case, intentionally-lowercase placeholders / example syntax, product naming, or abbreviations). No change made — your call.

## A. Example-syntax placeholders (likely leave lowercase)


| File:Line                                                                  | Current                                                         | Possible             | Notes                                                     |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------- | --------------------------------------------------------- |
| `renderer/components/action-scripts/builder-render-step-fields.ts:80`      | /query/… or telnet:plugins / telnet:free                        | —                    | Endpoint syntax; Title Case hurts copy fidelity.          |
| `renderer/components/action-scripts/builder-render-step-fields.ts:230`     | e.g. varX                                                       | —                    | Variable name example.                                    |
| `renderer/components/action-scripts/builder-render-step-fields.ts:309`     | e.g. varX                                                       | —                    | Variable name example.                                    |
| `renderer/components/action-scripts/builder-render-step-fields.ts:601`     | myVar or data.items.0.id                                        | —                    | Variable-path syntax.                                     |
| `renderer/components/inspector/parameter-inputs.ts:52`                     | true or false                                                   | True or false        | Boolean syntax example.                                   |
| `renderer/components/inspector/parameter-inputs.ts:69`                     | { "key": "value" }                                              | —                    | JSON example syntax.                                      |
| `renderer/components/network-inspector/traffic-rules-modal.ts:123`         | latency                                                         | Latency              | Numeric placeholder vs label.                             |
| `renderer/components/network-inspector/traffic-rules-modal.ts:135`         | application/json                                                | —                    | MIME example.                                             |
| `renderer/components/network-inspector/traffic-rules-modal.ts:145`         | Response body (e.g. {"error":"forced"})                         | —                    | JSON example syntax.                                      |
| `renderer/components/network-inspector/traffic-rules-modal.ts:264`         | api.example.com or api.example.com/v1/play                      | —                    | Host/path example.                                        |
| `renderer/components/modals/fragments/action-scripts-import-modal.html:19` | {"version":"1","steps":[…]}                                     | —                    | JSON example.                                             |
| `renderer/components/modals/fragments/add-location-modal.html:10`          | e.g., Office Lab, Studio B                                      | —                    | Example location names.                                   |
| `renderer/components/modals/fragments/add-location-modal.html:15`          | 192.168.1.50 or mac-mini.local                                  | —                    | Example host syntax.                                      |
| `renderer/index.html:13523–13529`                                          | string / integer / float / boolean / color / array / AssocArray | String / Integer / … | BrightScript type keywords — may match language literals. |


## B. "Dev channel" / "hotspot" terminology (consistency choice)


| File:Line                                                  | Current                                    | Possible                | Notes                                       |
| ---------------------------------------------------------- | ------------------------------------------ | ----------------------- | ------------------------------------------- |
| `renderer/components/network-inspector/network-tab.ts:764` | route your dev channel's requests          | …Dev channel's…         | "dev channel" used lowercase throughout NI. |
| `renderer/components/network-inspector/network-tab.ts:937` | …enable MITM in Settings for dev channels. | …for Dev channels.      | Same terminology question.                  |
| `renderer/components/network-inspector/network-tab.ts:939` | Capturing on hotspot.                      | Capturing on Hotspot.   | Generic noun vs feature name.               |
| `renderer/components/modals/fragments/help-modal.html:169` | sideloaded dev channel                     | sideloaded Dev channel  | Terminology consistency.                    |
| `renderer/components/modals/fragments/help-modal.html:177` | your dev channel makes                     | your Dev channel makes  | Terminology consistency.                    |
| `renderer/components/modals/fragments/help-modal.html:181` | hotspot capture                            | Hotspot Capture         | Feature name vs descriptive phrase.         |
| `renderer/components/modals/fragments/help-modal.html:219` | known Dev Password                         | known Dev Mode password | Branded phrasing.                           |


## C. Sentence-case vs Title-case for badges / tooltips / confirms


| File:Line                                                           | Current                                      | Possible                                      | Notes                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| `renderer/components/network-inspector/network-tab.ts:132`          | Add to filter                                | Add to Filter                                 | Chip tooltip.                                                               |
| `renderer/components/network-inspector/network-tab.ts:143`          | Filtering sessions                           | Filtering Sessions                            | Heading style may be intentional.                                           |
| `renderer/components/network-inspector/network-tab.ts:1373`         | Capture blocked                              | Capture Blocked                               | Badge microcopy.                                                            |
| `renderer/components/network-inspector/port-conflict-modal.ts:101`  | Re-check status                              | Re-check Status                               | Button tooltip/aria.                                                        |
| `renderer/components/network-inspector/traffic-rules-modal.ts:208`  | Roku device                                  | Roku Device                                   | Fallback device name.                                                       |
| `main/settings-dialog.ts:1326`                                      | Setup needed                                 | Setup Needed                                  | Status pill.                                                                |
| `main/settings-dialog.ts:2185`                                      | Capture access enabled / Setup needed        | Capture Access Enabled / Setup Needed         | Modal header badges.                                                        |
| `renderer/components/queries/query-search.ts:194`                   | 0 matches                                    | 0 Matches                                     | Compact counter; lowercase conventional.                                    |
| `renderer/components/fiddle/fiddle.ts:547–552`                      | No issues / N warning(s) / N error(s)        | No Issues / N Warning(s) / N Error(s)         | Diagnostic summary; lowercase common in dev tools.                          |
| `renderer/components/queries/remove-plugin-handler.ts:42`           | Remove plugin "${appId}"?                    | Remove Plugin "${appId}"?                     | Confirm dialog.                                                             |
| `renderer/components/dev-app/sideloading.ts:252`                    | Delete sideloaded channel?                   | Delete Sideloaded Channel?                    | Confirm dialog.                                                             |
| `renderer/components/queries/secret-screens.ts:209`                 | ${title} key sequence                        | ${title} Key Sequence                         | aria label.                                                                 |
| `renderer/modules/console-log/console-structured-view-modal.ts:130` | Copy formatted text                          | Copy Formatted Text                           | Tooltip style.                                                              |
| `renderer/modules/console-log/console-url-modal.ts:158`             | Open in default browser                      | Open in Default Browser                       | Tooltip style (also label/tooltip wording mismatch with "Open in browser"). |
| `main/settings-window-ipc.ts:55`                                    | Delay after KeyPress before Auto-Screenshot. | Delay after key press before auto-screenshot. | "KeyPress"/"Auto-Screenshot" may be deliberate.                             |
| `main/settings-window-ipc.ts:77`                                    | Success/Error Toast Visibility.              | Success/error toast visibility.               | Title vs sentence case.                                                     |


## D. Chart axis / progress micro-copy (lowercase may be intentional)


| File:Line                                                      | Current                      | Possible             | Notes                                      |
| -------------------------------------------------------------- | ---------------------------- | -------------------- | ------------------------------------------ |
| `renderer/components/dev-app/remote-metrics-charts.ts:902`     | now                          | Now                  | Chart x-axis tick; lowercase conventional. |
| `renderer/components/dev-app/remote-metrics-charts.ts:509–510` | now / ${mmss} ago            | Now / ${mmss} Ago    | Chart hover tooltip.                       |
| `renderer/components/log-file-viewer/log-file-viewer.ts:94`    | ${n} lines (loading ${pct}%) | …(Loading ${pct}%)   | Progress text.                             |
| `renderer/components/log-file-viewer/log-file-viewer.ts:245`   | 0 lines (loading 0%)         | 0 lines (Loading 0%) | Progress text.                             |


## E. Product naming / abbreviation judgment calls


| File:Line                                                            | Current                                          | Possible                                  | Notes                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| `main/about-dialog.ts:224`                                           | roku-dev-studio-api Version:                     | `roku-dev-studio-api` Version:              | Keep npm slug lowercase, only fix "Version"?               |
| `main/settings-dialog.ts:1160`                                       | Roku Remote - Use Keyboard                       | Roku Remote — Keyboard Shortcuts          | Hyphen vs em dash; wording.                                |
| `main/settings-dialog.ts:1271`                                       | …`roku-dev-studio` MCP Server entry…             | …`roku-dev-studio` MCP server entry…      | Prose around code slug.                                    |
| `renderer/index.html:12592`                                          | …control the App and auto-capture screenshots.   | …control the app…                         | "App" may mean Dev App.                                    |
| `renderer/index.html:12639`                                          | …Monaco editor, live linting…                    | …Monaco Editor…                           | Often left lowercase.                                      |
| `renderer/index.html:12747`                                          | Remote control (keypress, apps, etc.)            | …(key press, apps, etc.)                  | "keypress" one word vs two.                                |
| `renderer/index.html:13000`                                          | …Quick Remote and keypress features…             | …key press features…                      | Same spelling question.                                    |
| `renderer/index.html:13225`                                          | Channel Perf                                     | Channel Performance                       | May match ECP `/query/chanperf` shorthand.                 |
| `renderer/index.html:13732`                                          | Proxied                                          | Proxied only                              | Single-word filter label; expand for clarity?              |
| `renderer/components/dev-app/device-metrics.ts:1211`                 | …Control by mobile apps (network access)…        | …Control by Mobile Apps (Network Access)… | Should match exact Roku menu wording.                      |
| `renderer/components/dev-app/device-metrics.ts:1313`                 | Device metrics unavailable                       | Device Metrics unavailable                | Feature-name casing in error toast.                        |
| `renderer/components/dev-app/device-metrics.ts:804`                  | Latest Device Performance [Click to Open Remote] | …(Click to Open Remote)                   | Bracketed CTA vs sentence tooltip.                         |
| `renderer/components/dev-app/device-metrics-performance-step.ts:447` | …has not produced yet…                           | …process statistics…                      | `<proc-stat>` may be intentional for engineers.            |
| `renderer/modules/utils/telnet-system-command-run.ts:183`            | Telnet system data listener not available        | Telnet System data listener not available | Capitalize "System" as feature name?                       |
| `packages/roku-dev-studio-network-inspector/prerequisites.ts:76`     | tcpdump is available for capture.                | `tcpdump`…                                  | "tcpdump" traditionally lowercase.                         |
| `packages/roku-dev-studio-network-inspector/index.ts:1091`           | Proxy Port unavailable                           | Proxy port unavailable                    | Alternative: unify as sentence case instead of Title Case. |


## F. Possibly engineer-facing (verify it actually surfaces in UI)


| File:Line                                                     | Current                                                                     | Possible                    | Notes                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------- |
| `renderer/components/action-scripts/wait-node-field.ts:153`   | condition object required                                                   | Condition object required   | Validator error — may be engineer-facing.         |
| `renderer/components/action-scripts/wait-node-field.ts:160`   | condition.id is required                                                    | Condition.id is required    | JSON-path style validation message.               |
| `renderer/components/inspector/registry-params-ui.ts:156`     | name                                                                        | Name                        | API param identifier shown as label.              |
| `renderer/components/inspector/registry-params-ui.ts:186`     | key                                                                         | Key                         | API param identifier.                             |
| `renderer/components/inspector/registry-params-ui.ts:193`     | value                                                                       | Value                       | API param identifier.                             |
| `renderer/components/inspector/registry-params-ui.ts:264`     | newKey                                                                      | New Key                     | Wire/API field name vs human label.               |
| `renderer/components/inspector/registry-params-ui.ts:271`     | newValue                                                                    | New Value                   | Wire/API field name vs human label.               |
| `renderer/components/inspector/function-execution.ts:94`      | Sending getNodeById...                                                      | Sending Get Node by ID...   | Status line uses camelCase RALE command.          |
| `renderer/components/inspector/function-execution.ts:104`     | Sending getNodeByName...                                                    | Sending Get Node by Name... | Same pattern for all `Sending ${command}…`.       |
| `renderer/components/inspector/index.ts:184`                  | Refreshing getNodeById…                                                     | Refreshing Get Node by ID…  | Status line after Update Node modal.              |
| `renderer/components/inspector/rale-builtins.ts:91`           | enter newKey and newValue                                                   | enter New Key and New Value | Param names in registry help copy.                |
| `renderer/modules/mcp-bridge-client.ts:339,379,426,473`       | Drop failed / RALE command failed / Functions fetch failed / Connect failed | —                           | MCP/agent path; confirm whether shown in a toast. |
| `renderer/components/action-scripts/actions-list-view.ts:371` | ${step.type} (e.g. appFunction, raleCommand)                                | —                           | Raw step-type enum in "Type" column.              |


---

# Uncertain — proposed decisions

My resolved call for each Uncertain item, applying your Corrections convention (aggressive Title Case for labels/feature names, backtick-wrap raw code/identifiers/ports, drop spaces around slashes, keep genuine lowercase conventions). `Action`: **Change** / **Keep as-is** / **Resolved** (already decided in Corrections).

## A. Example-syntax placeholders

| File:Line | Current | Decision | Action | Why |
|-----------|---------|----------|--------|-----|
| `renderer/components/action-scripts/builder-render-step-fields.ts:80` | /query/… or telnet:plugins / telnet:free | (unchanged) | Keep as-is | Literal endpoint examples — Title Case breaks copy fidelity. |
| `renderer/components/action-scripts/builder-render-step-fields.ts:230` | e.g. varX | (unchanged) | Keep as-is | Literal variable-name example. |
| `renderer/components/action-scripts/builder-render-step-fields.ts:309` | e.g. varX | (unchanged) | Keep as-is | Literal variable-name example. |
| `renderer/components/action-scripts/builder-render-step-fields.ts:601` | myVar or data.items.0.id | (unchanged) | Keep as-is | Literal variable-path syntax. |
| `renderer/components/inspector/parameter-inputs.ts:52` | true or false | (unchanged) | Keep as-is | BrightScript boolean literals are lowercase. |
| `renderer/components/inspector/parameter-inputs.ts:69` | { "key": "value" } | (unchanged) | Keep as-is | JSON example syntax. |
| `renderer/components/network-inspector/traffic-rules-modal.ts:123` | latency | Latency | Change | Field-hint placeholder; matches other labels. |
| `renderer/components/network-inspector/traffic-rules-modal.ts:135` | application/json | (unchanged) | Keep as-is | MIME literal. |
| `renderer/components/network-inspector/traffic-rules-modal.ts:145` | Response body (e.g. {"error":"forced"}) | Response Body (e.g. {"error":"forced"}) | Change | Title-case the label part; keep JSON literal. |
| `renderer/components/network-inspector/traffic-rules-modal.ts:264` | api.example.com or api.example.com/v1/play | (unchanged) | Keep as-is | Host/path example. |
| `renderer/components/modals/fragments/action-scripts-import-modal.html:19` | {"version":"1","steps":[…]} | (unchanged) | Keep as-is | JSON example. |
| `renderer/components/modals/fragments/add-location-modal.html:10` | e.g., Office Lab, Studio B | (unchanged) | Keep as-is | Example location names. |
| `renderer/components/modals/fragments/add-location-modal.html:15` | 192.168.1.50 or mac-mini.local | (unchanged) | Keep as-is | Example host syntax. |
| `renderer/index.html:13523–13529` | string / integer / float / boolean / color / array / assocarray | String / Integer / Float / Boolean / Color / Array / AssocArray | Change | Title-case the visible `<option>` text only; keep each `value=""` attribute lowercase. |

## B. "Dev channel" / "hotspot" terminology

| File:Line | Current | Decision | Action | Why |
|-----------|---------|----------|--------|-----|
| `renderer/components/network-inspector/network-tab.ts:764` | route your dev channel's requests | route your Dev channel's requests | Change | "Dev" = the sideloaded build; capitalize for consistency with Dev App/Dev Mode. |
| `renderer/components/network-inspector/network-tab.ts:937` | …enable MITM in Settings for dev channels. | …enable MITM in Settings for Dev channels. | Change | Same. |
| `renderer/components/network-inspector/network-tab.ts:939` | Capturing on hotspot. | Capturing on Hotspot. | Change | Hotspot Capture is a named feature. |
| `renderer/components/modals/fragments/help-modal.html:169` | sideloaded dev channel | sideloaded Dev channel | Change | Consistency. |
| `renderer/components/modals/fragments/help-modal.html:177` | your dev channel makes | your Dev channel makes | Change | Consistency. |
| `renderer/components/modals/fragments/help-modal.html:181` | hotspot capture | Hotspot Capture | Change | Feature name. |
| `renderer/components/modals/fragments/help-modal.html:219` | known Dev Password | known Dev Password | Change | Match your "Dev Password" placeholder fix. |

## C. Sentence-case vs Title-case (badges / tooltips / confirms)

| File:Line | Current | Decision | Action | Why |
|-----------|---------|----------|--------|-----|
| `renderer/components/network-inspector/network-tab.ts:132` | Add to filter | Add to Filter | Change | Action label → Title Case. |
| `renderer/components/network-inspector/network-tab.ts:143` | Filtering sessions | Filtering Sessions | Change | Heading → Title Case. |
| `renderer/components/network-inspector/network-tab.ts:1373` | Capture blocked | Capture Blocked | Change | Match "Capture Setup" badge. |
| `renderer/components/network-inspector/port-conflict-modal.ts:101` | Re-check status | Re-check Status | Change | Button → Title Case. |
| `renderer/components/network-inspector/traffic-rules-modal.ts:208` | Roku device | Roku Device | Change | Fallback device label → Title Case. |
| `main/settings-dialog.ts:1326` | Setup needed | Setup Needed | Change | Status pill → Title Case. |
| `main/settings-dialog.ts:2185` | Capture access enabled / Setup needed | Capture Access Enabled / Setup Needed | Change | Header badges → Title Case. |
| `renderer/components/queries/query-search.ts:194` | 0 matches | (unchanged) | Keep as-is | Count noun reads better lowercase ("12 matches"); editor convention. |
| `renderer/components/fiddle/fiddle.ts:547–552` | No issues / N warning(s) / N error(s) | No Issues / N Warning(s) / N Error(s) | Change | Diagnostic summary → Title Case. |
| `renderer/components/queries/remove-plugin-handler.ts:42` | Remove plugin "${appId}"? | Remove Plugin "${appId}"? | Change | Confirm dialog → Title Case. |
| `renderer/components/dev-app/sideloading.ts:252` | Delete sideloaded channel? | Delete Sideloaded Channel? | Change | Confirm dialog → Title Case. |
| `renderer/components/queries/secret-screens.ts:209` | ${title} key sequence | ${title} Key Sequence | Change | aria label → Title Case. |
| `renderer/modules/console-log/console-structured-view-modal.ts:130` | Copy formatted text | Copy Formatted Text | Change | Tooltip → Title Case. |
| `renderer/modules/console-log/console-url-modal.ts:158` | Open in default browser | Open in Default Browser | Change | Tooltip → Title Case; also retitle the matching button "Open in browser" → "Open in Browser". |
| `main/settings-window-ipc.ts:55` | Delay after KeyPress before Auto-Screenshot. | Delay after key press before auto-screenshot. | Change | Settings hint → sentence case (matches your :59 decision). |
| `main/settings-window-ipc.ts:77` | Success/Error Toast Visibility. | Success/error toast visibility. | Change | Settings hint → sentence case. |

## D. Chart axis / progress micro-copy

| File:Line | Current | Decision | Action | Why |
|-----------|---------|----------|--------|-----|
| `renderer/components/dev-app/remote-metrics-charts.ts:902` | now | (unchanged) | Keep as-is | Time-axis tick; lowercase is the charting convention. |
| `renderer/components/dev-app/remote-metrics-charts.ts:509–510` | now / ${mmss} ago | (unchanged) | Keep as-is | Same axis/age convention. |
| `renderer/components/log-file-viewer/log-file-viewer.ts:94` | ${n} lines (loading ${pct}%) | ${n} lines (Loading ${pct}%) | Change | Match find-bar "(Searching …)" capitalization. |
| `renderer/components/log-file-viewer/log-file-viewer.ts:245` | 0 lines (loading 0%) | 0 lines (Loading 0%) | Change | Same. |

## E. Product naming / abbreviation

| File:Line | Current | Decision | Action | Why |
|-----------|---------|----------|--------|-----|
| `main/about-dialog.ts:224` | roku-dev-studio-api Version: | `roku-dev-studio-api` Version: | Resolved | Already decided in Corrections (backticked slug). |
| `main/settings-dialog.ts:1160` | Roku Remote - Use Keyboard | Use Keyboard for Roku Remote | Resolved | Already decided in Corrections. |
| `main/settings-dialog.ts:1271` | …`roku-dev-studio` MCP Server entry… | …`roku-dev-studio` MCP server entry… | Change | Keep slug; "server" is a common noun. |
| `renderer/index.html:12592` | …control the App and auto-capture screenshots. | …control the Dev App and auto-capture screenshots. | Change | It refers to the sideloaded Dev App specifically. |
| `renderer/index.html:12639` | …Monaco editor, live linting… | …Monaco Editor, live linting… | Change | Monaco is a product name. |
| `renderer/index.html:12747` | Remote control (keypress, apps, etc.) | (unchanged) | Keep as-is | Generic action word in a parenthetical list. |
| `renderer/index.html:13000` | …Quick Remote and keypress features… | (unchanged) | Keep as-is | Same. |
| `renderer/index.html:13225` | Channel Perf | Channel Performance | Change | Spell out (verify the button still fits its width). |
| `renderer/index.html:13732` | Proxied | (unchanged) | Keep as-is | Compact filter toggle label. |
| `renderer/components/dev-app/device-metrics.ts:1211` | …Control by mobile apps (network access)… | …Control by Mobile Apps (Network Access)… | Change | Roku Settings menu names (verify exact on-device wording). |
| `renderer/components/dev-app/device-metrics.ts:1313` | Device metrics unavailable | Device Metrics unavailable | Change | Capitalize feature name in error toast. |
| `renderer/components/dev-app/device-metrics.ts:804` | Latest Device Performance [Click to Open Remote] | Latest Device Performance (Click to Open Remote) | Change | Parenthetical CTA reads cleaner than brackets. |
| `renderer/components/dev-app/device-metrics-performance-step.ts:447` | …has not produced <proc-stat> yet… | …has not produced `proc-stat` yet… | Change | Backtick the raw token (your convention). |
| `renderer/modules/utils/telnet-system-command-run.ts:183` | Telnet system data listener not available | (unchanged) | Keep as-is | "Telnet" already correct; "system" is a common noun here. |
| `packages/roku-dev-studio-network-inspector/prerequisites.ts:76` | tcpdump is available for capture. | `tcpdump` is available for capture. | Change | Backtick the tool name (keeps its lowercase). |
| `packages/roku-dev-studio-network-inspector/index.ts:1091` | Proxy Port unavailable | Proxy Port Unavailable | Resolved | Already decided in Corrections (Title Case). |

## F. Possibly engineer-facing (kept, with backtick wrapping)

| File:Line | Current | Decision | Action | Why |
|-----------|---------|----------|--------|-----|
| `renderer/components/action-scripts/wait-node-field.ts:153` | condition object required | `condition` object required | Change | Backtick the JSON field name. |
| `renderer/components/action-scripts/wait-node-field.ts:160` | condition.id is required | `condition.id` is required | Change | Backtick the JSON path. |
| `renderer/components/inspector/registry-params-ui.ts:156` | name | Name | Change | Form field label → Title Case. |
| `renderer/components/inspector/registry-params-ui.ts:186` | key | Key | Change | Form field label → Title Case. |
| `renderer/components/inspector/registry-params-ui.ts:193` | value | Value | Change | Form field label → Title Case. |
| `renderer/components/inspector/registry-params-ui.ts:264` | newKey | New Key | Change | Human label (the literal `newKey` stays in code). |
| `renderer/components/inspector/registry-params-ui.ts:271` | newValue | New Value | Change | Human label (the literal `newValue` stays in code). |
| `renderer/components/inspector/function-execution.ts:94` | Sending getNodeById... | Sending `getNodeById`... | Change | Backtick the RALE command identifier. |
| `renderer/components/inspector/function-execution.ts:104` | Sending getNodeByName... | Sending `getNodeByName`... | Change | Same for all `Sending ${command}…` lines. |
| `renderer/components/inspector/index.ts:184` | Refreshing getNodeById… | Refreshing `getNodeById`… | Change | Same. |
| `renderer/components/inspector/rale-builtins.ts:91` | enter newKey and newValue | enter `newKey` and `newValue` | Change | Backtick the param identifiers. |
| `renderer/modules/mcp-bridge-client.ts:339,379,426,473` | Drop failed / RALE command failed / Functions fetch failed / Connect failed | (unchanged) | Keep as-is | Already capitalized; confirm whether actually surfaced in a toast. |
| `renderer/components/action-scripts/actions-list-view.ts:371` | ${step.type} (e.g. appFunction, raleCommand) | ${step.type} (e.g. `appFunction`, `raleCommand`) | Change | Backtick the enum identifiers. |

---

## Summary

- **Corrections:** ~140 clear casing fixes across 9 areas (Network Inspector, modals, Action Scripts, Inspector, Dev App/Queries/Fiddle, renderer modules, main process, `index.html`, and the Network Inspector package).
- **Uncertain:** ~70 entries grouped A–F, now each with a **proposed decision** (see "Uncertain — proposed decisions"). Of those, most are **Change**; **Keep as-is** for literal code/JSON/MIME/host examples, chart-axis time ticks, the search-match counter, and generic common nouns; **Resolved** = already decided in Corrections.
- Most common patterns: lowercase proper nouns (**Dev App**, **Telnet**, **Developer Mode**, **Keychain**), step-description / status fragments that start lowercase, sentence-vs-Title-case inconsistency on badges and field labels, and raw backend identifiers (`chanperf`, `proc-stat`, `basic_text`) shown to users.

