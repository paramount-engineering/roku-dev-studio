# AI-Powered Action Script Generator — Next Steps

> Discussion doc. No code changes — planning only.

---

## Overview

Goal: build a system where a user pastes a **feature or bug ticket**, and an AI agent automatically generates a valid Roku Dev Studio **Action Script (JSON)** that can be run to test or reproduce the issue.

---

## How It Would Work (High-Level Flow)

1. User provides a ticket (Jira, GitHub Issue, Linear, or plain text).
2. AI agent reads the description, acceptance criteria, steps to reproduce, and expected behavior.
3. AI reasons about what Roku device interactions are needed to exercise the feature/bug.
4. AI emits a valid Action Script JSON (version `"2"`).
5. User reviews, tweaks if needed, and runs it in the tool.

---

## What the AI Needs to Know (Context to Inject)

For the AI to generate good scripts, it must be grounded in:

- **Action Script Schema** — full list of supported step types (`keypress`, `launch`, `wait`, `screenshot`, `appFunction`, `if`/`then`/`else`, etc.) with required/optional fields. Source of truth: `action-registry.ts` + `validator.ts`.
- **Available Keys** — full list of Roku remote key names (`Up`, `Down`, `Select`, `Back`, `Home`, `Fwd`, `Rev`, `Play`, etc.).
- **App IDs** — common Roku app/channel IDs relevant to the product (YouTube, Netflix, internal sideloaded channels, etc.).
- **RALE Functions** — available `appFunction` names and their signatures, for tickets that involve deep state inspection.
- **Wait Conditions** — supported condition shapes (media-player state, active-app attributes, variable checks).
- **Version** — always target `"2"` for `if`/`then`/`else` support.

All of this gets embedded in the system prompt.

---

## Next Steps (Phased Approach)

### Phase 1 — Prompt Engineering & Proof of Concept

**Goal:** validate that an LLM can produce correct Action Scripts from a ticket description.

Tasks:
- Write a system prompt that describes the full Action Script schema (generated from `action-registry.ts` to stay in sync).
- Include 3–5 few-shot examples of `ticket → Action Script` pairs covering common patterns:
  - Launch → navigate → screenshot
  - Launch → wait for playback → inspect state
  - Sideload → test feature → delete sideload
- Test against 10 real historical tickets manually.
- Evaluate output: valid JSON? Correct step types? Sensible flow?
- Catalogue common failure modes (wrong key names, missing waits, hallucinated step types).

**Deliverable:** a prompt that produces valid scripts ~70–80% of the time with no extra tooling.

---

### Phase 2 — Tool/Agent Layer

**Goal:** give the AI the ability to look things up instead of hallucinate.

Tasks:
- Expose the action-registry as a structured tool — AI can query "what fields does a `wait` step need?" at generation time.
- Expose available RALE function names as a tool or reference document.
- Add a **validation loop**: after generation, run `validateScriptStructure()` programmatically and feed errors back to the AI for self-correction (agentic retry).
- Add step-suggestion heuristics in the prompt:
  - "Visual regression in ticket" → add `screenshot` steps
  - "Playback issue" → add media-player `wait` conditions
  - "Performance/memory" → add `devicePerformance` capture

**Deliverable:** an agent that self-validates and retries, raising pass rate to ~90%+.

---

### Phase 3 — Integration into Roku Dev Studio

**Goal:** surface this natively in the tool so it feels like a first-class feature.

Two surfaces (pick one or both):

**A) In-app panel**
- "Generate from Ticket" button in the Action Script builder UI.
- Text area for ticket input; "Generate" returns a script directly into the builder for review and editing.
- A "Refine" prompt field for follow-up instructions (e.g. *"add a screenshot after each navigation step"*).

**B) CLI command**
- `rds generate-script --ticket "..."`
- `rds generate-script --url <jira-url>`
- Outputs a script JSON file.

Tasks:
- Wire the UI/CLI to a Claude API call (`claude-sonnet-4-6` default) in the main process, using the grounded system prompt.
- Display the result in the existing script editor for **human review before execution** — never auto-run.

**Deliverable:** end-to-end in-app flow.

---

### Phase 4 — Ticket Source Integrations (Optional)

**Goal:** let the AI pull the ticket directly rather than requiring copy-paste.

- **Jira** — given a ticket URL or ID, fetch title + description + acceptance criteria via Jira REST API.
- **GitHub Issues** — fetch issue body + labels via GitHub REST API.
- **Linear** — fetch issue via Linear GraphQL API.

Bonus: structured fields (labels, priority, components) can inform script decisions — e.g., a `Performance` label auto-inserts `devicePerformance` steps.

---

## Key Design Decisions to Resolve

1. **Where does the AI call happen?** Main process (Node/Electron) — keeps API keys out of the renderer.
2. **Which model?** Start with `claude-sonnet-4-6` for speed/cost; gate `claude-opus-4-6` for complex tickets or retries.
3. **How much schema to inject?** Start with full schema in the system prompt (simpler). Move to tool-use retrieval only if context grows too large.
4. **Human review always required?** Yes. Generated scripts are always presented for review before execution — never auto-run.
5. **Storage?** Save generated scripts alongside manually authored ones in the same Action Scripts folder, with a `generatedFrom` metadata field (ticket ID, prompt, model, timestamp) for traceability.

---

## Suggested Tech Stack

- **AI** — Claude API (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`, with prompt caching on the system prompt (schema + few-shots don't change often).
- **Validation** — reuse existing `validateScriptStructure()` from `packages/roku-dev-studio-api`.
- **UI** — extend the existing Action Script builder component in the renderer.
- **Ticket fetching (Phase 4)** — Jira REST, GitHub REST, Linear GraphQL.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| AI hallucinates unsupported step types | Inject full schema; validate + retry on error |
| AI uses wrong key names | Include full key list in the system prompt as a reference |
| Scripts are syntactically correct but logically wrong | Few-shot examples + mandatory human review gate |
| API costs at scale | Prompt caching on schema/few-shots; cache identical ticket hashes; Sonnet default |
| Ticket contains sensitive data | Run API calls server-side; never log ticket contents |
| Schema drifts from action-registry | Auto-generate the prompt's schema section from `action-registry.ts` at build time |

---

## Rough Sequencing

1. Phase 1 — ~1 week (prompt + manual eval on 10 tickets).
2. Phase 2 — ~1–2 weeks (validator loop + tools).
3. Phase 3 — ~2 weeks (UI panel + main-process wiring).
4. Phase 4 — optional, driven by demand.

Total: **~4–5 weeks** to a shipped first version.
