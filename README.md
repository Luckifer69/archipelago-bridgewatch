# Archipelago BridgeWatch

An interactive, deterministic graph safety analysis and visualization platform for island-and-footbridge networks. Archipelago BridgeWatch visualizes a low-link Depth-First Search (DFS) traversal step by step, identifying critical bridges (cut-edges) and articulation points (cut-vertices) whose closure would disconnect festival attendees from critical amenities like first aid, food stalls, or music stages.

![Archipelago BridgeWatch at event 44, showing why bridge B04 is critical](docs/evidence/screenshots/7-bridge-B04.png)

---

## 1. Project Overview

### What Archipelago BridgeWatch Is
**Archipelago BridgeWatch** is a self-contained, browser-based topological safety analysis tool. It models an archipelago of festival islands connected by narrow footbridges as an undirected graph, runs a rigorous low-link Depth-First Search (DFS) algorithm, and provides an interactive, deterministic step-by-step replay of how the network is inspected.

### The Real-World Problem It Addresses
Organizing community festivals across natural archipelagos or multi-island parks introduces significant safety risks. Footbridges and small islands often serve as the sole transit corridors between vital venues—such as medical tents, fresh water supplies, and main stages. If an overcrowded bridge fails or a central island junction becomes impassable due to flooding or bottlenecking, portions of the crowd can become instantly stranded without access to emergency services.

### Why Identifying Critical Bridges and Island Junctions Matters
- **Critical Bridges (Bridges / Cut-Edges):** A bridge whose removal increases the number of connected components in the graph. If footbridge `B04` fails, visitors at the music stage side are completely cut off from the first-aid tent at Barrel Bay. Identifying these bridges informs where reinforcement or secondary pontoon routes must be prioritized.
- **Island Junctions (Articulation Points / Cut-Vertices):** An island whose failure or closure partitions the remaining network into two or more disconnected components. Even when multiple bridges lead to an island (such as Doubloon Dunes), if that island itself is the sole junction connecting two subgraphs, losing the island splits the festival.
- **Explainability:** Festival volunteers, safety wardens, and emergency coordinators do not need black-box conclusions. They need transparent, verifiable proofs that clearly explain *why* an infrastructure element is vulnerable before, during, and after an incident.

### Concise Explanation of the Application
The application operates on an explicit **"Calculate Once, Replay Deterministically"** paradigm:
1. It validates the topological network against structural and boundary constraints.
2. It constructs an immutable, read-only `GraphState` with lexicographically sorted adjacency lists.
3. It executes a low-link DFS, recording an ordered sequence of 56 immutable event snapshots.
4. It provides playback controls (**Load**, **Step**, **Run to End / Skip**, **Reset**) that render the graph state onto an SVG map and synchronized UI panels without performing any runtime calculations.

---

## 2. Key Features

Every feature documented below is implemented and tested in the codebase:

- **Candidate-Created Deterministic Archipelago:** An 8-island, 9-bridge archipelago featuring two multi-edge safe loops (`ANCHOR`–`BARREL`–`COMPASS` and `DOUBLOON`–`EMERALD`–`FLAG`) connected by a critical bottleneck bridge (`B04`), leading into an exposed linear branch (`FLAG`–`GULL`–`HOOK`).
- **Graph Construction & Validation:** Robust validation engine (`src/engine/validate.js`) checking input structure, coordinate boundaries ($0 \le x, y \le 100$), ID formats (`/^[A-Z][A-Z0-9_-]{0,15}$/`), non-empty display names, absence of self-loops, duplicate edges (in either direction), unknown endpoints, and graph size boundaries ($1 \le V \le 12$, $0 \le E \le 20$). Invalid graphs fail completely without emitting partial state.
- **Sorted Adjacency-List Generation:** Guaranteed determinism across platforms by sorting all island IDs and outgoing bridge connections in ASCII code-unit order (`src/engine/ids.js`).
- **Low-Link DFS Traversal:** Comprehensive implementation of Tarjan's bridge-finding algorithm (`src/engine/lowlink.js`) tracking discovery times, low-link values, and parent-child traversal trees.
- **Bridge Detection:** Identification of bridges using the strict inequality condition:
  $$\text{low}[v] > \text{discovery}[u]$$
- **Articulation Point Detection:** Identification of cut-vertices using dual rules:
  1. **Non-Root Nodes:** Node $u$ is an articulation point if $\text{low}[v] \ge \text{discovery}[u]$ for any DFS-tree child $v$.
  2. **Root Nodes:** The DFS root is an articulation point if and only if it has two or more DFS-tree children ($\text{children} \ge 2$).
- **Step-by-Step Traversal Replay:** Fine-grained event-driven replay state machine (`src/replay.js` & `src/player.js`) permitting manual single-event advancement, uninterrupted automated playback, mid-step fast-forwarding, and instant reset.
- **Numerical Discovery and Low-Value Updates:** Live display of discovery timestamps and dynamic low-link propagations as back-connections are encountered and recursive children return.
- **Interactive Map Visualization & State Highlighting:** SVG-based map rendering (`src/ui/map.js`) that displays distinct visual treatments for unvisited, current, tree edges, back connections, bridges, and articulation points without relying solely on color.
- **Final Safety Summary:** Clear summary card listing total connected components, all critical bridges, and all articulation points, accompanied by plain-language justifications for each finding.
- **Reset & Repeatable Execution:** Exact, repeatable state restoration. Stepped runs, continuous runs, and post-reset replays produce bit-identical event streams and visual snapshots.
- **Error Handling & Multi-Error Diagnostics:** Aggregates and surfaces all structural validation errors simultaneously rather than failing on the first error encountered.

---

## 3. Algorithm and Technical Approach

### Low-Link DFS Traversal
The traversal engine uses a recursive depth-first search to explore the graph and compute two primary metrics for every island:
1. **Discovery Time ($\text{discovery}[u]$):** The integer timestamp at which node $u$ is first visited. The discovery clock starts at 0 and increments monotonically across the entire graph (even across disconnected components).
2. **Low-Link Value ($\text{low}[u]$):** The smallest discovery time reachable from $u$ via a sequence of zero or more DFS-tree edges followed by at most one back-edge (non-tree connection).

$$\text{low}[u] = \min \begin{cases} 
\text{discovery}[u] \\
\text{discovery}[w] & \text{for every back-edge } (u, w) \text{ where } w \ne \text{parent}[u] \\
\text{low}[v] & \text{for every DFS-tree edge } (u, v)
\end{cases}$$

### Bridge and Articulation Point Criteria
- **Bridge Condition:** An undirected edge $(u, v)$ with parent $u$ and child $v$ is a bridge if and only if:
  $$\text{low}[v] > \text{discovery}[u]$$
  *Interpretation:* There is no back-edge from $v$ or any of its descendants capable of reaching $u$ or any ancestor of $u$. Removing $(u, v)$ isolates $v$'s subtree.
- **Articulation Point Condition (Non-Root):** A non-root island $u$ is an articulation point if it has at least one child $v$ such that:
  $$\text{low}[v] \ge \text{discovery}[u]$$
  *Interpretation:* Descendants of $v$ cannot reach any strict ancestor of $u$ without passing through $u$. While a back-edge from $v$'s subtree might loop back to $u$ itself (making $(u, v)$ not a bridge), failing island $u$ completely severs $v$'s subtree.
- **Articulation Point Condition (Root):** The initial root of a DFS tree does not have ancestors. It is an articulation point if and only if it has two or more distinct DFS-tree children ($\text{childCount} \ge 2$). In the demo archipelago, `ANCHOR` has only 1 DFS child (`BARREL`), so it is not an articulation point despite being the root.

### Deterministic Traversal Ordering
To eliminate race conditions and platform-dependent object iteration order:
- All islands are evaluated as potential roots in ascending ASCII ID order.
- In each island's adjacency list, incident bridges and neighbor islands are sorted in ascending ASCII order by neighbor ID (`compareIds` in `src/engine/ids.js`).
- This guarantees identical traversal sequences, identical discovery numbers, and identical event lists across any execution environment.

### Handling Disconnected Components
If the graph contains multiple disconnected components or isolated islands:
- The traversal iterates through all islands in sorted ASCII order.
- If an island is unvisited, it initiates a new DFS tree as a new component root.
- The discovery clock does **not** reset; it continues monotonically, ensuring globally unique discovery timestamps.
- When each root finishes traversal, a `component-complete` event is emitted.

### Event Schema & Emission Order
The engine records 8 distinct event types during the low-link DFS:

```
Starting at island u:
  1. discover (u)
  2. For each neighbour v in sorted order:
       inspect (u -> v):
         - kind: 'tree' (v unvisited) -> recursive DFS on v, then:
             return (v -> u)
             bridge-check (u, child v)
             articulation-check (u, child v) [if u is not root]
         - kind: 'parent' (v is parent) -> skip
         - kind: 'visited' (v previously visited) -> update low[u] = min(low[u], discovery[v])
  3. root-check (u) [if u is root]
  4. node-complete (u)
  5. component-complete (u) [if u is root]
```

#### Event Structure
Every event object in the sequence adheres to the following contract:
```typescript
interface TraversalEvent {
  seq: number;                   // Zero-based index (0 to 55 for demo)
  type: string;                  // 'discover' | 'inspect' | 'return' | 'bridge-check' | 
                                 // 'articulation-check' | 'root-check' | 'node-complete' | 
                                 // 'component-complete'
  node: string;                  // Island ID being evaluated
  edge: string | null;           // Bridge ID involved (or null)
  snapshot: EventSnapshot;       // Full, immutable state after this event
  [key: string]: any;            // Context-specific metrics (childLow, lowBefore, etc.)
}

interface EventSnapshot {
  nodes: Record<string, { parent: string | null; discovery: number | null; low: number | null }>;
  edges: Record<string, 'unvisited' | 'tree' | 'non-tree' | 'bridge'>;
  componentCount: number;
  bridges: string[];             // Bridges identified so far (sorted)
  articulations: string[];       // Articulation islands identified so far (sorted)
}
```

---

## 4. Architecture and Project Structure

The project follows a clean separation of concerns, separating pure graph algorithms and state machines from DOM manipulation.

```
archipelago-bridgewatch/
├── .gitattributes             # Cross-platform LF line-ending enforcement
├── .gitignore                 # Dependency, environment, and OS file exclusions
├── AI_USAGE.md                # Comprehensive AI development and human review log
├── index.html                 # Semantic HTML5 layout and SVG container
├── package.json               # Project manifest, npm scripts, and dev dependencies
├── package-lock.json          # Deterministic dependency lockfile
├── README.md                  # Comprehensive architectural and usage documentation
├── server.js                  # Lightweight, secure local static server
├── styles.css                 # CSS tokens, layout grid, and dark/light themes
├── docs/
│   ├── EVENTS.md              # Detailed event schema and full 56-event replay trace
│   ├── ORACLE.md              # Mathematical expected values and manual derivations
│   ├── PLAN.md                # Approved pre-implementation architectural plan
│   ├── PROMPTS.md             # Complete chronological AI prompt log
│   ├── oracle-check.py        # Python verification script (low-link vs. brute-force)
│   └── evidence/
│       ├── browser-walkthrough.mjs  # Playwright verification script
│       ├── browser-walkthrough.txt  # 67/67 assertions walkthrough report
│       ├── mutation-check.mjs       # 19-mutation verification harness
│       ├── mutation-check.txt       # Mutation verification output
│       ├── test-output.txt          # Node test runner output (151 tests)
│       └── screenshots/             # 11 evidence captures (desktop, mobile, dark theme)
├── fixtures/
│   └── graphs.js              # Standard test topologies (main, cycle, mixed, bowtie)
├── scripts/
│   └── layout.js              # Development tool for deterministic ForceAtlas2 layout
├── src/
│   ├── player.js              # Animation timing and UI interaction orchestrator
│   ├── replay.js              # Pure state machine managing position in event list
│   ├── archipelago/
│   │   ├── index.js           # Combined archipelago dataset (topology + positions)
│   │   ├── positions.js       # Saved 2D coordinates for SVG rendering
│   │   └── topology.js        # Graph topology (islands, festival roles, bridges)
│   ├── engine/
│   │   ├── freeze.js          # Deep object freezing helper
│   │   ├── graphState.js      # Immutable, validated graph data structure
│   │   ├── ids.js             # ASCII-safe string comparator and ID validator
│   │   ├── lowlink.js         # Core low-link DFS traversal and event generator
│   │   └── validate.js        # Comprehensive graph schema and boundary validator
│   └── ui/
│       ├── animation.js       # requestAnimationFrame bridge travel animator
│       ├── animationPlan.js   # Motion timing, durations, and coordinate paths
│       ├── describe.js        # Plain-language explanatory text generator
│       ├── main.js            # Client entry point binding DOM to Player
│       ├── map.js             # SVG rendering and graph-state element styler
│       ├── mapModel.js        # Geometry calculations (label offsets, diamond paths)
│       └── panels.js          # DOM update controller for table, history, and summary
└── test/
    ├── animationPlan.test.js  # Timing and trajectory unit tests
    ├── describe.test.js       # Text generation formatting unit tests
    ├── events.test.js         # 56-event exact sequence and snapshot parity tests
    ├── graphState.test.js     # Adjacency sorting and immutability tests
    ├── independence.test.js   # Verifies app modules never import test fixtures
    ├── layout.test.js         # Layout repeatability and boundary compliance tests
    ├── lowlink.test.js        # Algorithmic accuracy on all 4 topologies + 500 random graphs
    ├── mapModel.test.js       # Geometry and SVG path coordinate tests
    ├── player.test.js         # Playback control transitions and edge-case tests
    ├── replay.test.js         # State machine position and error recovery tests
    ├── server.test.js         # HTTP server, MIME types, and path traversal tests
    └── validate.test.js       # Boundary and malformed input validation tests
```

### Module Responsibilities & Interactions

```
   ┌──────────────────────────────────────────────────────────────┐
   │                     Archipelago Data                         │
   │               (topology.js + positions.js)                   │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │               src/engine/validate.js                         │
   │  Checks node/edge bounds, IDs, coordinates, loops, endpoints │
   └──────────────────────────────┬───────────────────────────────┘
                                  │ Valid Graph
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │               src/engine/graphState.js                       │
   │   Constructs read-only state with ASCII sorted adjacency     │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │               src/engine/lowlink.js                          │
   │   Runs low-link DFS; emits 56 events with full snapshots     │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │               src/replay.js (State Machine)                  │
   │   Maintains cursor position: Load, Step, RunToEnd, Reset     │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │               src/player.js (Orchestrator)                   │
   │   Coordinates animation ticks, user clicks, and DOM renders  │
   └──────────────┬───────────────────────────────┬───────────────┘
                  │                               │
                  ▼                               ▼
   ┌──────────────────────────────┐┌──────────────────────────────┐
   │        src/ui/map.js         ││       src/ui/panels.js       │
   │  Draws SVG nodes, bridges,   ││  Updates Node Table, Current │
   │  rings, and diamond markers  ││  Event Box, History, Summary │
   └──────────────────────────────┘└──────────────────────────────┘
```

### Technology Stack
- **Runtime & Engine:** Node.js (tested on versions 20–26, native ES Modules). Zero production runtime dependencies.
- **Frontend / UI:** Native HTML5, Vanilla CSS (Custom Properties, Grid, Flexbox, `@media (prefers-color-scheme: dark)`), and inline SVG.
- **Animation:** Native `window.requestAnimationFrame` with linear interpolation and `@media (prefers-reduced-motion)` support.
- **Testing:** Node.js built-in test runner (`node --test`), `node:assert/strict`.
- **Layout Tooling (Development Only):** `graphology` and `graphology-layout-forceatlas2` for offline coordinate generation.

---

## 5. Getting Started

### Prerequisites
- **Node.js:** v18.0.0 or later (v20+ or v22+ recommended; supports `node:test` and native ES modules).
- **npm:** v9.0.0 or later.
- **Python (Optional):** Python 3.8+ to execute the independent mathematical oracle verification script.

### Installation Instructions
Clone the repository and install development dependencies (required only for the layout script and test runner):

```bash
git clone https://github.com/Luckifer69/archipelago-bridgewatch.git
cd archipelago-bridgewatch
npm ci
```

### Environment Configuration
No environment configuration or `.env` file is required. The application runs entirely as a local static web application.

### Running the Application
Start the built-in HTTP server:

```bash
npm start
```
The server will start on port 8000 by default (or the port specified by the `PORT` environment variable):
```
Treasure-Island Bridge Safety Map: http://localhost:8000/
```
Open your web browser and navigate to:
**`http://localhost:8000/`**

### Running the Tests
Execute the complete automated test suite (151 unit and integration tests):

```bash
npm test
```

### Running Additional Verification Tools
1. **Independent Mathematical Oracle Verification (Python):**
   ```bash
   python docs/oracle-check.py
   ```
2. **Mutation Testing Harness (verifies tests catch code defects):**
   ```bash
   node docs/evidence/mutation-check.mjs
   ```
3. **Regenerate Deterministic Island Coordinates (Development):**
   ```bash
   npm run layout
   ```

---

## 6. How to Use the Application

### Available Controls

| Control | Description | Behavior |
|---|---|---|
| **Load My Archipelago** | Initializes the graph network | Loads the festival archipelago into memory and draws all islands and bridges in their initial unvisited state. Clears any prior traversal history. |
| **Step** | Advances single event | Advances the replay by exactly one event in the sequence. If pressed while a bridge animation is in progress, it immediately finishes the current animation and executes the next event. |
| **Run to End** / **Skip to End** | Continuous replay | Automatically animates every remaining event sequentially (~20 seconds total). While running, the button text updates to **Skip to End**; clicking it instantly fast-forwards to the final state. |
| **Reset** | Restores initial state | Returns the map and UI to the freshly loaded pre-traversal state (all nodes unvisited, clock at 0, event sequence reset to 0). |

### Visual Highlights & Map Legend
The SVG map uses distinct structural treatments beyond color to convey state:
- **Unvisited Island:** Hollow circular node with dashed borders.
- **Current Island:** Encircled by a prominent indicator ring with a directional marker.
- **DFS Tree Bridge:** Solid blue connecting line indicating forward traversal.
- **Non-Tree / Back Connection:** Amber dashed line marked with a loop symbol (`↺`).
- **Critical Bridge:** Heavy double-line with hazard stripes and warning symbol (`⚠`).
- **Articulation Island:** Diamond-shaped node marked with a solid diamond icon (`◆`).

### Interpreting the Final Safety Results
When the traversal completes (Event 56), the summary panel reveals the comprehensive safety assessment:
- **Components (1):** The archipelago is currently fully connected; attendees can reach any island from any other island.
- **Critical Bridges (`B04`, `B08`, `B09`):**
  - **`B04` (`COMPASS` ↔ `DOUBLOON`):** $\text{low}[\text{DOUBLOON}] = 3 > \text{discovery}[\text{COMPASS}] = 2$. Closure severs the music stage and craft market from the medical tent and main gate.
  - **`B08` (`FLAG` ↔ `GULL`):** $\text{low}[\text{GULL}] = 6 > \text{discovery}[\text{FLAG}] = 5$. Closure cuts off the lookout and treasure hunt areas.
  - **`B09` (`GULL` ↔ `HOOK`):** $\text{low}[\text{HOOK}] = 7 > \text{discovery}[\text{GULL}] = 6$. Closure isolates Hook's Hideaway completely.
- **Articulation Islands (`COMPASS`, `DOUBLOON`, `FLAG`, `GULL`):**
  - `COMPASS` and `DOUBLOON` form critical transit hubs. Even though `DOUBLOON` has a loop connection back through `FLAG`, losing `DOUBLOON` itself severs all downstream festival activities.

---

## 7. Testing and Validation

The project includes 151 automated tests executing via Node's native test runner (`node --test`), organized into focused test suites:

### Test Coverage Highlights

1. **Normal Graph Traversal (`test/lowlink.test.js`, `test/events.test.js`):**
   - Validates the complete 56-event emission sequence against hand-verified traces.
   - Asserts discovery times, low-values, and parent relationships at every step.
2. **Cycle-Only Topology (`fixtures/graphs.js`, `test/lowlink.test.js`):**
   - Verifies a 4-island ring with no bridges and no articulation points.
3. **Bridges and Articulation Points (`test/lowlink.test.js`):**
   - Tests strict bridge inequality ($\text{low} > \text{disc}$) vs. non-root articulation equality ($\text{low} \ge \text{disc}$).
   - Verifies the "Bowtie" topology (single cut-vertex `C` joining two loops, with zero cut-edges).
4. **Disconnected Components & Isolated Nodes (`test/lowlink.test.js`):**
   - Validates the 3-component "Mixed" graph containing multi-child root `A`, isolated node `D`, and an independent loop `E`–`F`–`G`.
   - Confirms discovery clock continues monotonically across component boundaries.
5. **Deterministic Ordering & Permutation Invariance (`test/layout.test.js`, `test/lowlink.test.js`):**
   - Tests graph execution against 500 randomized node/edge permutations, asserting identical outputs.
   - Tests ForceAtlas2 layout stability across multiple random seeds.
6. **Invalid Graph Inputs (`test/validate.test.js`):**
   - Verifies rejection of 0 or >12 nodes, >20 edges, invalid ID syntax, duplicate node/edge IDs, self-loops, duplicate edges in reverse order (`A-B` and `B-A`), missing endpoints, and out-of-range coordinates ($x, y < 0$ or $> 100$).
7. **Low-Value Propagation (`test/lowlink.test.js`):**
   - Confirms that back-connections correctly update $\text{low}[u]$ using $\text{discovery}[v]$ rather than $\text{low}[v]$.
8. **Root Articulation Rules (`test/lowlink.test.js`):**
   - Proves root `ANCHOR` (1 child) is not an articulation point, while root `A` in the mixed graph (2 children) is correctly identified.
9. **Reset & Replay Consistency (`test/replay.test.js`, `test/player.test.js`):**
   - Validates that stepping, continuous playback, and post-reset re-execution produce identical state trees.
   - Confirms mid-animation button presses and rapid clicks cannot corrupt the state machine.

### Verification Execution Results
- **Automated Tests:** `npm test` $\rightarrow$ **151 of 151 passing (0 failed, 0 skipped)**.
- **Oracle Verification:** `python docs/oracle-check.py` $\rightarrow$ **4 of 4 topologies agree with brute force**.
- **Mutation Testing:** `node docs/evidence/mutation-check.mjs` $\rightarrow$ **19 of 19 intentional mutations caught**.
- **Browser Automation:** `docs/evidence/browser-walkthrough.mjs` $\rightarrow$ **67 of 67 layout and contrast checks passing**.

---

## 8. Design Decisions and Limitations

### Design Decisions and Trade-offs

| Decision | Rationale | Alternatives Considered & Rejected |
|---|---|---|
| **Zero Runtime Dependencies** | Vanilla ES Modules run identically in browser and Node tests without build steps, transpilation, or bundlers. | React, Vite, Webpack: unnecessary overhead for a single-page map with four panels. |
| **Pure SVG Map Rendering** | SVG handles responsive scaling, clean vector line dashing, and DOM event bindings natively. | Canvas / WebGL: excessive complexity for graphs with $\le 12$ nodes and $\le 20$ edges. |
| **Full Snapshots in Events** | Storing immutable snapshots per event allows $O(1)$ state restoration, eliminating complex undo/reverse logic. | Delta-based undo stack: prone to state desynchronization during back-edge evaluation. |
| **Pre-Generated Layout Coordinates** | Running ForceAtlas2 offline via `npm run layout` produces fixed, deterministic coordinates committed to code. | Client-side layout calculation: risks layout jitter and introduces client dependencies. |
| **Fixed Panel Dimensions & Layout Stability** | Explicit table column widths and panel heights prevent layout shifts during playback. | Content-sized fluid containers: caused jarring layout jumps as numbers and text changed. |
| **Native CSS Dark Mode** | Uses CSS `@media (prefers-color-scheme: dark)` to seamlessly adapt to user system preferences. | Manual theme toggle: added state complexity when system preference already provides the signal. |

### Limitations & Scope Boundaries
- **Logical Simulation, Not Live Sensor Monitor:** Archipelago BridgeWatch is a self-contained graph algorithm demonstration. It does not interface with physical IoT load sensors, GIS satellite maps, or live weather APIs.
- **Demonstration Graph Limits:** Designed specifically for networks conforming to the problem specification ($\le 12$ islands, $\le 20$ bridges). It is not optimized for large-scale geographic road networks ($10^5+$ nodes).
- **Fixed Topology Display:** The browser interface visualizes the curated festival archipelago. Input validation is fully tested via automated test suites rather than a client-side visual graph editor.

---

## 9. Future Improvements

The current release prioritizes algorithmic precision, deterministic replay, and test verification. Planned future improvements include:
1. **Interactive Graph Topology Editor:** A visual authoring mode allowing festival coordinators to drag and drop new islands, draw bridges, and instantly calculate safety metrics.
2. **Polished Design & UI Enhancement:** A refined visual hierarchy featuring custom cartographic SVG styling (island terrain textures, animated water ripples), modern typography, and collapsible analysis panels.
3. **What-If Scenario Simulator:** An interactive simulation mode allowing users to click any bridge or island to simulate immediate failure and observe real-time component partitioning.
4. **Exportable Safety Reports:** Generation of downloadable PDF/PNG festival safety manifests summarizing critical bottlenecks for local emergency personnel.

---

## 10. AI-Assisted Development

In compliance with the Cisco AI-Assisted Coding Assessment guidelines, this project transparently documents the use of AI assistance during its lifecycle:
- **AI Tooling Used:** Anthropic Claude (via Claude Code, Claude Opus 5.5).
- **Scope of AI Assistance:** Initial requirement analysis, brainstorming architecture trade-offs, drafting test cases, and assisting with test implementation.
- **Human Engineering & Governance:** Every architectural choice (vanilla JS, SVG over Canvas, build-time ForceAtlas2, full event snapshots, layout stability rules) was directed, evaluated, and decided by the human engineer. Factual errors made by the AI (such as misreading specification inputs) were identified and corrected.
- **Reference Documentation:**
  - Complete AI Prompt Log & Human Decisions: [`AI_USAGE.md`](AI_USAGE.md) and [`docs/PROMPTS.md`](docs/PROMPTS.md)
  - Pre-Implementation Architecture Plan: [`docs/PLAN.md`](docs/PLAN.md)
  - Mathematical Ground Truths: [`docs/ORACLE.md`](docs/ORACLE.md)
  - Test Evidence & Browser Verification: [`docs/evidence/`](docs/evidence/)
