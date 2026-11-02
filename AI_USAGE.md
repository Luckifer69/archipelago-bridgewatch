# AI-Assisted Development & Engineering Process

This document details the AI-assisted development workflow, human engineering interventions, technical trade-offs, and verification methodologies used to build and validate **Archipelago BridgeWatch** for the Cisco AI-Assisted Coding Assessment.

---

## 1. Overview & Assessment Context

Modern software engineering leverages AI coding assistants to accelerate problem decomposition, architectural planning, and test-driven implementation. In this assessment:
- **Primary AI Assistant:** Anthropic Claude (via Claude Code, Claude Opus 5.5).
- **Human Role:** Lead System Architect, Requirements Evaluator, Code Reviewer, and Verification Engineer.
- **Guiding Principle:** Strict requirement adherence — design first, approve the plan before writing code, build what the specification demands without extraneous dependencies or speculative over-engineering, and verify all claims with reproducible tests.

The complete chronological prompt log and evolution history is preserved in [`docs/PROMPTS.md`](docs/PROMPTS.md). The original approved plan is preserved in [`docs/PLAN.md`](docs/PLAN.md).

---

## 2. Chronological Prompt Sequence & Strategic Direction

The project was developed in two distinct phases: an initial planning and specification phase followed by an implementation and empirical browser verification phase.

### Phase 1: Planning and Architecture

| # | Prompt Summary | Human Intent & Technical Impact |
|---|---|---|
| **1** | *"Plan an idea first for the given problem statement... high-level idea not code... not supposed to overengineer"* | Established core discipline: no implementation without an approved architectural plan. Prompted the mathematical definition of the 8-island festival network and independent verification via brute force. |
| **2** | *"Websearch and find all options to draw complicated structures like a network graph"* | Evaluated Canvas, SVG, WebGL, D3, Vis.js, and Cytoscape. Selected native SVG: zero runtime dependencies, accessible DOM nodes, and sufficient capacity for the $\le 12$ nodes and $\le 20$ edges specification. |
| **3** | *"How do we already have positions?"* | Factual correction: challenged an inaccurate AI assumption that the specification provided island coordinates. Confirmed that coordinates must be generated deterministically by the developer. |
| **4** | *"Use a library to convert graph input to positions of nodes... Check if any library already exists"* | Avoided error-prone manual coordinate placement. Introduced a development-time layout generation tool, requiring strict repeatability across runs. |
| **5** | *Rescaling rules: multiply centres by a constant, offset negative coordinates, and sort before layout* | Refined coordinate normalization: deterministic sorting, single-ratio aspect preservation, and margin padding ($10 \le x,y \le 90$) to eliminate label clipping. |
| **6** | *"Evaluate Graphology (https://graphology.github.io/)"* | Source code review revealed `graphology-layout-forceatlas2` was purely deterministic, whereas `noverlap` called `Math.random()`. `ForceAtlas2` with circular seeding was selected. |
| **7** | *"Add animated DFS traversal along bridges to show users the process rather than magic state jumps"* | Defined edge travel animation using pure `requestAnimationFrame` and linear interpolation. Kept animation as a display layer that observes events rather than computing state. |
| **8** | *"How to keep everything in sync? Idea: GraphState class + precomputed Event list with UI rendering events"* | Major architectural pivot: human proposed pre-calculating the traversal and having the UI render immutable snapshots. Replaced fragile forward/reverse mutation engines with pure state snapshots. |
| **9** | *Leave Back button out of initial scope* | Kept scope tight against the assessment brief. Immutable event snapshots ensure a Step Back feature can be added in 15 lines if requested during live interview modifications. |
| **10** | *"Make sure you use atomic git commits and in description mention why behind every technical decision"* | Enforced conventional, reviewable, atomic Git commits documenting rationale, alternatives rejected, and verification evidence for each increment. |

### Phase 2: Post-Build Empirical Review & Verification

| # | Prompt Summary | Human Intent & Technical Impact |
|---|---|---|
| **11** | *"I have given you access to Chrome to check if UI is as intended"* | Shifted verification from headless scripts to visual browser inspection. Uncovered real scrollbar rendering and subtle table layout shifts. |
| **12** | *"Provide a dark theme and choose based on browser default"* | Added automatic dark mode via CSS `@media (prefers-color-scheme: dark)`. Audited color contrast: caught low light-theme contrast on bridge labels (4.39:1) and active node rings (2.18:1), fixing both to meet WCAG AA standards. |
| **13** | *"Keep each box stable in its position without resizing at each step"* | Enforced visual layout stability: fixed grid row/column dimensions, fixed table layout, reserved heights for stacked panels, and prevented layout shifts across all 56 replay steps. |

---

## 3. Human vs. AI Architectural Synthesis

### 1. Deterministic Layout: Build-Time Tool vs. Browser Dependency
- **AI Proposal:** Compute graph layout dynamically inside the client browser upon page load.
- **Human Decision:** Rejected. Adding layout libraries to the client runtime introduces unnecessary bundle weight and risks layout shifts between reloads. Instead, run ForceAtlas2 once during development via `npm run layout` and commit immutable coordinates to `src/archipelago/positions.js`. The client app has zero runtime dependencies.

### 2. Synchronization Architecture: Event Snapshots vs. Mutation Replay
- **AI Proposal:** Store delta operations (e.g., `setLow(node, val)`) and compute inverse operations for stepping backward.
- **Human Decision:** Rejected. Inverse graph updates are fragile, particularly for non-tree edge re-visits and articulation point state transitions. Replaced with **full state snapshots**: each event stores an immutable clone of `GraphState`. Rendering any step is an $O(1)$ draw of that event's snapshot.

### 3. Visual Stability & Contrast Compliance
- **AI Proposal:** Variable panel sizing with fluid flex containers.
- **Human Review:** Visual inspection in real browsers revealed panel jumping as text length changed. Replaced with strict grid sizing, fixed table columns, and reserved scrollbar gutters. Contrast auditing uncovered insufficient contrast on SVG bridge labels and rings, prompting token adjustments to satisfy WCAG AA contrast standards.

---

## 4. AI Mistakes Identified and Corrected

1. **Specification Misinterpretation:**
   - *Mistake:* Claude initially claimed the assessment prompt supplied fixed island coordinates.
   - *Correction:* Human caught the error by reviewing the brief. The brief only required valid coordinates ($0 \le x, y \le 100$). This led to the creation of `scripts/layout.js`.
2. **Process Management Hazard:**
   - *Mistake:* Claude attempted to stop test servers using a broad `pkill -f 'node server.js'`, which risked terminating unrelated processes.
   - *Correction:* Replaced with ephemeral port binding (`server.listen(0)`) and programmatic lifecycle management in `test/server.test.js`.
3. **Premature Verification Claims:**
   - *Mistake:* Headless test suites reported the UI as "verified" even though layout boxes were shifting on real screens and scrollbars were clipping content.
   - *Correction:* Human mandated Chrome walkthroughs and real viewport measurements across 8 display widths (360px to 1920px).

---

## 5. Live Modification Rehearsal

To prepare for live assessment modification requests, two extensions were practiced in throwaway environments:
1. **Interactive Step-Back Button:**
   - Implemented in 15 lines of code across `src/replay.js`, `src/player.js`, `index.html`, and `test/player.test.js`. Because events hold full snapshots, stepping back simply decrements the event sequence index without requiring undo math.
2. **Dynamic Archipelago Extension (9th Island):**
   - Added island `IVORY` connected to `HOOK` via bridge `B10` in `src/archipelago/topology.js`. Ran `npm run layout`, which positioned `IVORY` cleanly without bridge crossings. The engine processed 63 events, correctly identifying `B10` as a bridge and `HOOK` as an articulation point.

---

## 6. Assessment Evidence Index

The following verifiable artifacts demonstrate the end-to-end development process:
- [`docs/PLAN.md`](docs/PLAN.md): Approved pre-implementation plan and technical choices.
- [`docs/PROMPTS.md`](docs/PROMPTS.md): Complete prompt log and human review records.
- [`docs/ORACLE.md`](docs/ORACLE.md): Mathematical ground-truth answers for all four test topologies.
- [`docs/EVENTS.md`](docs/EVENTS.md): Event schema and exact 56-event execution trace.
- [`docs/oracle-check.py`](docs/oracle-check.py): Python script cross-validating results against brute force.
- [`docs/evidence/test-output.txt`](docs/evidence/test-output.txt): Node test runner execution log (151/151 passing).
- [`docs/evidence/mutation-check.txt`](docs/evidence/mutation-check.txt): Mutation testing evidence (19/19 mutations caught).
- [`docs/evidence/browser-walkthrough.txt`](docs/evidence/browser-walkthrough.txt): Automated browser inspection report (67/67 assertions passing).
- [`docs/evidence/screenshots/`](docs/evidence/screenshots/): 11 captures demonstrating every visual state, theme, and viewport.
