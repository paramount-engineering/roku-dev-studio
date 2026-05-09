# Dependency automation (Renovate)

This repo uses **[Renovate](https://docs.renovatebot.com/)** (the hosted Mend
GitHub App) to keep npm dependencies, GitHub Actions, and lockfiles current.
Config lives in [`renovate.json`](../renovate.json) at the repo root.

## Goals

- Catch security advisories quickly without manual `npm audit` chores.
- Keep transitive dependencies fresh (weekly `lockFileMaintenance`) so we
  don't accumulate years of drift before a forced upgrade.
- Land low-risk bumps (devDependency patch/minor, GitHub Actions digests)
  with **zero human attention** when CI is green.
- Hold high-risk bumps (Electron majors, `brighterscript`) for **explicit
  approval** via the dashboard issue, because they regress in ways our CI
  can't detect (Chromium API churn, BrightScript diagnostic output changes).

## Why Renovate, not Dependabot

| Need | Why Renovate wins |
|---|---|
| Group `@types/*` and `eslint*` into single PRs | Dependabot can group, but Renovate's grouping is far more flexible (regex, dep-type, manager mix) |
| Weekly schedule + auto-merge policies | Renovate has first-class `schedule` and `platformAutomerge` |
| Manage Electron majors via approval gate | Renovate's `dependencyDashboardApproval` is purpose-built for this |
| Refresh `package-lock.json` even when no deps changed | Renovate `lockFileMaintenance` (Dependabot has no equivalent) |
| Tolerate the stale `bun.lock` we still keep around | Renovate `ignorePaths` is a clean opt-out |

## Repo-specific design choices

### npm workspaces, not pnpm

CI runs `npm ci` and the root has `package-lock.json`. Renovate's `npm`
manager understands workspaces natively — no extra config needed for the
four workspace packages (`apps/roku-dev-studio`,
`packages/roku-dev-studio-api`, `packages/roku-dev-studio-mcp`,
`packages/roku-dev-studio-remote-server`). The
[`group:monorepos`](https://docs.renovatebot.com/presets-group/#groupmonorepos)
preset keeps related package families (e.g. all `@types/*`) batched.

### Stale `bun.lock` is ignored

A `bun.lock` exists from an earlier evaluation
(see [`npm-to-bun-migration.md`](./npm-to-bun-migration.md)). We're back on
npm but haven't deleted it yet. `renovate.json` sets:

```json
"ignorePaths": ["bun.lock"]
```

so Renovate won't try to update a lockfile we no longer use. If the file
is removed later, this entry can come out.

### Electron majors are gated

Electron major bumps drag in a new Chromium and frequently break:

- preload script context (`contextBridge` semantics)
- native module ABI (anything compiled against `electron`'s Node headers)
- macOS code-signing entitlements (we already maintain a custom
  [`entitlements.mac.plist`](../apps/roku-dev-studio/entitlements.mac.plist))
- `electron-builder` packaging (the published artifact in `release.yml`)

Our CI only runs `node --check` on the bundled main file (see
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) — it cannot
catch a Chromium-side regression in the renderer. So:

```json
{
  "matchPackageNames": ["electron", "electron-builder"],
  "matchUpdateTypes": ["major"],
  "dependencyDashboardApproval": true
}
```

A check-box in the Dependency Dashboard issue is required before the PR
is opened. Patch and minor bumps still flow normally.

### `brighterscript` is gated

`brighterscript` is the lint engine behind the BrightScript Fiddle window
(see [`bs-fiddle-handlers.ts`](../apps/roku-dev-studio/main/ipc/bs-fiddle-handlers.ts)).
Even minor bumps can change diagnostic codes / messages and surface new
errors against user code that previously linted clean. Held for manual
approval on minor and major:

```json
{
  "matchPackageNames": ["brighterscript"],
  "matchUpdateTypes": ["minor", "major"],
  "dependencyDashboardApproval": true
}
```

### `@types/node` capped at <23

The published `roku-dev-studio-api` package declares
`"engines": { "node": ">=14.0.0" }`, and CI runs on Node 20. Allowing
`@types/node@23+` would let the type surface drift past what our
runtime actually supports.

```json
{ "matchPackageNames": ["@types/node"], "allowedVersions": "<23.0.0" }
```

### devDependencies auto-merge

Patch and minor bumps to `devDependencies` are auto-merged via GitHub's
platform auto-merge once required checks pass:

```json
{
  "matchDepTypes": ["devDependencies"],
  "matchUpdateTypes": ["patch", "minor"],
  "automerge": true,
  "platformAutomerge": true
}
```

`dependencies` (i.e. anything we ship to npm consumers of
`roku-dev-studio-api`/`roku-dev-studio-mcp`) is **not** auto-merged.
Those changes are user-visible at the API surface and deserve eyes.

### GitHub Actions

Workflow versions (`actions/checkout`, `actions/setup-node`) are managed
together and auto-merged for digest/patch/minor:

```json
{
  "matchManagers": ["github-actions"],
  "groupName": "github actions",
  "automerge": true,
  "matchUpdateTypes": ["digest", "patch", "minor"]
}
```

### Schedule

```json
"schedule": ["before 6am on monday"],
"timezone": "America/Los_Angeles"
```

Single weekly batch on Monday morning. Avoids weekend noise; all PRs
land before the work-week starts so review can be a single short pass.
The `lockFileMaintenance` job uses the same window so transitive
refreshes don't add a second wave.

### Vulnerability alerts override the schedule

```json
"vulnerabilityAlerts": { "labels": ["security"], "automerge": false }
```

Security advisories bypass the Monday window and open immediately,
labeled `security`, but **never** auto-merge — a human must look at the
fix.

## How to install the GitHub App

> One-time setup. Requires repo-admin permissions on `hdonapati/roku-dev-studio`.

1. Go to <https://github.com/apps/renovate>.
2. Click **Configure** (or **Install** if first time).
3. Under your account / org, choose **Only select repositories** and pick
   `roku-dev-studio`. (Avoid "All repositories" unless you want Renovate
   running on every repo you own.)
4. Click **Install / Save**.
5. Renovate will create a one-time **"Configure Renovate"** onboarding
   pull request titled something like `Configure Renovate`. Because this
   repo already has a committed `renovate.json`, the onboarding PR will
   either:
   - show "Renovate already configured" and you can close it, or
   - show no proposed config diff, in which case just close it.
6. Within ~10 minutes Renovate will open the **Dependency Dashboard**
   issue (titled "Dependency Dashboard"). That's the control panel —
   pin it for visibility.
7. The first batch of update PRs typically lands the **following Monday
   before 6am PT** because of our `schedule`. To force an immediate run
   (e.g. for the first batch), check the "Create all rate-limited PRs at
   once" checkbox in the Dashboard issue.

## How to verify it's working

After install, you should see:

- A **`Dependency Dashboard`** GitHub issue listing every available update.
- The Renovate app appearing as a check on Renovate-authored PRs.
- Weekly Monday-morning PRs labeled `dependencies`.
- Auto-merged PRs closing themselves once CI passes (visible in the merged-PR list).

If a week passes with no PRs and no dashboard issue:

- Check <https://developer.mend.io/github/hdonapati/roku-dev-studio> (the
  Mend dashboard) for run logs and validation errors against
  `renovate.json`.
- Confirm the GitHub App still has access to the repo
  (Settings → GitHub Apps → Renovate → Configure).

## How to change the policy later

Edit `renovate.json` and merge to `main`. Renovate picks up config
changes on its next run — no app reinstall needed. Use the
[Renovate config validator](https://docs.renovatebot.com/config-validation/)
locally before pushing if you want a sanity check:

```bash
npx --package renovate -- renovate-config-validator
```

## What this does **not** cover

- **Native binaries / system tooling** (Electron's bundled Chromium,
  Node itself, `wizcli`, etc.) — those are tracked by hand in the
  workflow files.
- **Roku-side dependencies** (BrightScript / SceneGraph in
  `roku-components/`) — Roku has no published package registry; nothing
  for Renovate to manage.
- **The published artifact in `release.yml`** — Renovate manages source
  deps; release builds still go through the existing manual tag-and-push
  flow described in [`RELEASE_SETUP.md`](../RELEASE_SETUP.md).
