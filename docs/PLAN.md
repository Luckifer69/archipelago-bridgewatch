> The plan as approved, before implementation. Changes made afterwards are listed in `PROMPTS.md`.

# Treasure-Island Bridge Safety Map: High-Level Plan

## Context

Festival volunteers need to see which single bridge or island could split the event, and be able to explain why. The app turns one fixed island map into a step-by-step replay of a low-link depth-first search (DFS). By the end, every critical item on the map is backed by numbers the volunteer watched being produced.

The project folder is empty, so this is a fresh build. This is the idea only; implementation details and code come next. The guiding rule is to build what the brief asks for and nothing more.

## The core idea

**Calculate once, then replay.** The engine validates the graph and runs the whole search up front, producing a final result and an ordered list of explanatory events. Each event records what happened and holds a full snapshot of the state after it. The interface never calculates anything. It holds a position in that list and draws that event's snapshot.

This one decision covers several requirements:

| Requirement | How it is met |
|---|---|
| Map, table, current event and summary stay in sync | All four are drawn from the same event and its snapshot |
| Step and Run to End match | Both only move the position through the same list |
| Reset is exact | The position returns to the start and nothing else was changed |
| Visible values agree with the final result | A test checks each event's stated change against the snapshots before and after it, and the last snapshot against the final result |

## The three parts

1. **Engine (no browser code):** validates the complete graph, builds a read-only `GraphState`, runs the traversal, and emits events and results. Invalid input returns only errors that name the node, edge or endpoint, and no `GraphState` is built.
2. **Replay state (no browser code):** handles Load, Step, Run to End and Reset, and clears old output if a load fails. It can be fully tested without a browser.
3. **Interface:** draws the current state as an SVG map and panels, and holds no logic of its own.

## GraphState

`GraphState` is the single source for the graph, and any code that needs graph information reads it from there. It never changes after it is built, and traversal values live in the event snapshots instead.

It holds:
- **Islands:** ID, display name, and `x` and `y` for each.
- **Bridges:** ID and endpoints for each.
- **Adjacency:** for each island, its neighbours sorted by ID in plain ASCII order, each paired with the connecting bridge ID.
- **Root order:** all island IDs in the same sorted order.

## Technology choice

Plain JavaScript modules, SVG for the map, and Node's built-in test runner, with no runtime dependencies or build step. A very small local static file server is needed because browsers block JavaScript modules opened directly from disk. The only dependencies are three graphology packages (`graphology`, `graphology-layout` and `graphology-layout-forceatlas2`), used during development by the layout script described under "Island positions". Animation needs no library.

A single fixed map and a few panels don't justify a framework. Keeping this small should also make the live modification round quicker. Node 26 is already installed.

## The demo archipelago

It has 8 islands and 9 bridges, with two safe loops and one exposed branch. The sketch shows the connections; the final positions come from the layout script.

```
 ANCHOR ──B01── BARREL         DOUBLOON ──B05── EMERALD
    \            /             /     \            /
    B03        B02          B04      B07        B06
      \        /            /          \        /
       COMPASS ────────────┘            FLAG ──B08── GULL ──B09── HOOK
```

| ID | Name | Festival role | Parent | Discovery | Low |
|---|---|---|---|---|---|
| ANCHOR | Anchor Landing | Main gate | none | 0 | 0 |
| BARREL | Barrel Bay | First-aid tent | ANCHOR | 1 | 0 |
| COMPASS | Compass Cove | Food stalls | BARREL | 2 | 0 |
| DOUBLOON | Doubloon Dunes | Music stage | COMPASS | 3 | 3 |
| EMERALD | Emerald Atoll | Games | DOUBLOON | 4 | 3 |
| FLAG | Flagship Rock | Craft market | EMERALD | 5 | 3 |
| GULL | Gull's Perch | Lookout | FLAG | 6 | 6 |
| HOOK | Hook's Hideaway | Treasure hunt | GULL | 7 | 7 |

**Expected result:** 1 component, bridges B04, B08 and B09, and articulation islands COMPASS, DOUBLOON, FLAG and GULL.

I have already checked these values with a separate low-link trace and a brute-force test that removes each bridge and island in turn. Both agree, and shuffling the input order changes nothing.

**Why this map demonstrates well:**
- **Strict bridge rule, B04:** low[DOUBLOON] = 3 is greater than discovery[COMPASS] = 2, so B04 is a bridge. If it closes, the music stage side loses the first-aid tent.
- **`>` versus `>=`, B05:** low[EMERALD] = 3 is not greater than discovery[DOUBLOON] = 3, so B05 is not a bridge. But 3 >= 3 makes DOUBLOON an articulation island. One comparison shows both rules.
- **Root rule, ANCHOR:** it has only one DFS child, so it is not an articulation island despite being the root.

## Island positions

A small development script generates the positions once and saves them in the map data as each island's `x` and `y`. The browser app never runs the layout library, so the map can't shift between loads. If the graph changes, rerunning the script updates the positions.

1. **Sort:** order islands and edges by ID, using the same plain ASCII sort as the engine.
2. **Lay out:** add them to a graphology graph in that order, place them in a circle as the starting layout, then run ForceAtlas2 for a fixed number of iterations. Skip graphology's noverlap layout, because its code calls `Math.random`.
3. **Offset:** subtract the smallest x from every x, and the smallest y from every y.
4. **Scale:** multiply both axes by one constant, 80 divided by the larger of the two ranges, to keep the layout's shape.
5. **Centre in the valid range:** add 10, giving values from 10 to 90 so edge islands and labels aren't clipped, then round to 2 decimals. If all islands share one point, such as a single-island graph, place them at 50, 50.

Island radius is a fixed drawing setting in the SVG, not part of the map data. If graphology fails the repeatability check in step 1 below, d3-force is the fallback.

## Replay events

Each undirected edge is recorded from both adjacency entries, so it is inspected twice. This also makes visible the second look at a loop edge, which changes nothing.

Every event also stores a snapshot of the state after it: parent, discovery and low for each island, the status of each bridge, the component count, and the bridges and articulation islands found so far. Before the first event, the interface draws a fixed all-unvisited state, built from `GraphState`.

| Event | Emitted when | What it states |
|---|---|---|
| Discover | A node is first reached | Discovery and low values, and parent |
| Inspect | For each neighbour, in sorted order | Tree, parent or already-visited; if already-visited, low old and new |
| Return | A child finishes | Parent's low, old and new |
| Bridge check | Straight after Return | low[child] > discovery[parent], with both numbers |
| Articulation check | After Bridge check, non-root parents only | low[child] >= discovery[parent], with both numbers |
| Root check | Before a root completes | Number of DFS children, and whether it is at least 2 |
| Node complete | All neighbours are done | Final low |
| Component complete | After the root completes | Component number |

The main demo produces exactly 56 events: 8 discover, 18 inspect, 7 return, 7 bridge checks, 6 articulation checks, 1 root check, 8 node completes and 1 component complete. A test will assert this sequence.

## Animation

Animation is a display layer on top of the replay. It never changes the events or values, which is the condition the brief sets for optional animation. One small helper built on the browser's `requestAnimationFrame` moves a marker between two island positions, which is simple because bridges are straight lines.

| Event | What the volunteer sees | Rough time |
|---|---|---|
| Inspect, tree | Marker travels from island to island, drawing the bridge behind it | 600 ms |
| Inspect, already-visited | Marker travels to the visited island and back along a dashed line | 600 ms |
| Return | Marker travels back from child to parent | 600 ms |
| Inspect, parent | Bridge pulses, with no travel | 250 ms |
| All other events | Island or bridge pulses | 250 ms |

Behaviour:
- **Order on screen:** new numbers and map states appear when the animation finishes, so each change follows the movement that caused it.
- **Step:** advances exactly one event. Pressing it mid-animation completes the current event instantly and starts the next, so no press is lost.
- **Run to End:** plays every event in order, taking about 20 seconds for the demo. Step is disabled while it plays, and pressing Run to End again skips to the final state.
- **Reset:** cancels any animation and restores the pre-traversal state.
- **Reduced motion:** if the browser's reduced-motion setting is on, animation is skipped and the states are unchanged.

Inspect and Return events must carry the edge ID and direction so the marker knows where to travel.

## The screen

Everything sits on one page, so a volunteer can explain a result without scrolling or opening developer tools.

```
┌───────────────────────────────┬──────────────────────┐
│ [Load] [Step] [Run to End] [Reset]    Event 23 of 56 │
├───────────────────────────────┼──────────────────────┤
│                               │ CURRENT EVENT        │
│        ISLAND MAP (SVG)       │ plain-language text  │
│           + legend            │ and numeric change   │
│                               ├──────────────────────┤
│                               │ NODE TABLE           │
│                               │ ID, parent, disc, low│
├───────────────────────────────┼──────────────────────┤
│ SUMMARY: components, bridges, │ EVENT HISTORY        │
│ articulation islands          │ scrollable           │
└───────────────────────────────┴──────────────────────┘
```

The six map states are distinguishable without relying on colour:

| State | Treatment beyond colour |
|---|---|
| Unvisited | Hollow island, thin dotted line |
| Current | Thick ring with a ▶ marker |
| DFS-tree | Solid line |
| Inspected non-tree | Dashed line with a ↺ label |
| Bridge | Heavy double line with a ⚠ label |
| Articulation | Diamond-shaped island with a ◆ marker |

## Implementation steps and checkpoints

1. **Create the map and write the expected answers first.** Generate the island positions with the layout script. Document the archipelago, adjacency lists, discovery order, table and results in `docs/ORACLE.md`, along with the event schema.
   *Checkpoint:* two runs and a shuffled-input run give identical positions, and the map is readable. The documents exist before any engine code, and the app never reads them.
2. **Build the engine with tests.** Add validation, adjacency, traversal and events.
   *Checkpoint:* all rule, validation and shuffle tests pass.
3. **Build the replay state.** Add Load, Step, Run to End and Reset.
   *Checkpoint:* stepped and complete runs are identical, Reset matches the initial state exactly, and a failed load leaves no old output.
4. **Build the interface.** Add the map, panels, legend and edge animation.
   *Checkpoint:* a browser walkthrough can explain B04 and B05 from the screen alone. Rapid Step presses, Reset mid-animation and reduced motion all end in the same states as an uninterrupted run.
5. **Prepare the evidence and rehearse.** Write the README and collect the prompt log, screenshots and test output.
   *Checkpoint:* a practice small change is made and verified from a clean start.

`docs/PROMPTS.md` runs through all five steps and starts with your first prompt. It also records changes to this plan, which the evaluation asks you to explain.

## Git commits

The folder isn't a git repository yet, so step 1 starts by creating one. Work happens on a `build/safety-map` branch, and nothing is pushed.

- **Atomic:** each commit makes one logical change and includes its tests. `node --test` passes at every commit.
- **The why in every description:** each description gives the reason behind every technical decision in that commit, including the main alternative rejected and any rule from the brief it satisfies. It only claims what was actually checked.
- **Attribution:** each message ends with the co-author line for Claude.

| Step | Commit | Decisions its description explains |
|---|---|---|
| 1 | Project setup | Plain JavaScript modules, no build step, Node's test runner |
| 1 | Expected answers and event schema | Writing them before the engine; two Inspect events per bridge; the Return, Bridge check, Articulation check order |
| 1 | Layout script and island positions | graphology ForceAtlas2, circular start, no noverlap, generating once, rescaling to 10–90 |
| 2 | Validation | Reporting all errors together; validating before `GraphState` is built |
| 2 | `GraphState` | String IDs, sorted neighbour lists, bridge IDs in adjacency, read-only |
| 2 | Low-link traversal | Recursive or iterative; discovery versus low on back connections; the separate root rule |
| 2 | Events and snapshots | Full snapshots instead of undo logic or replaying events |
| 3 | Replay state | Step, Run to End and Reset only moving a position; clearing output on a failed load |
| 4 | Local server and page layout | Why modules need a server; keeping everything on one screen |
| 4 | SVG map and legend | SVG over Canvas and graph libraries; showing states without relying on colour |
| 4 | Panels and controls | One render path for every panel; revealing the summary as the replay proves it |
| 4 | Edge animation | `requestAnimationFrame` with no library; numbers updating on arrival; Step mid-animation; reduced motion |
| 5 | README, prompt log and evidence | What the screenshots and test output demonstrate |

This list may change during the build. Any change gets explained in the commit where it happens and in `docs/PROMPTS.md`.

## Verification

**Test graphs** (expected values already checked):
- **Cycle only:** four islands in a ring, with no bridges or articulation islands.
- **Mixed:** root A with two children, an isolated island, and a separate three-island loop. This gives 3 components, a discovery clock that carries across all of them, bridges on A's two edges, and A as the only articulation island.

**Focused tests:**
- **Traversal rules:** back-connection low propagation using discovery rather than low, the strict bridge inequality, the non-root `>=` rule, the root child count, and root ordering across components.
- **Ordering:** reversed and shuffled input arrays give the same results; IDs sort by plain ASCII rather than locale order; the event sequence is fixed.
- **Validation:** out-of-range and non-finite coordinates, duplicate node IDs and edge IDs, bad ID format, empty display name, unknown endpoint, self-loop, and the same pair in reverse (A-B and B-A). Also the size limits: 0 or 13 nodes and 21 edges are rejected, while 1 node with 0 edges is accepted. Each case must produce no partial analysis.
- **Replay:** stepped and complete runs match, Reset is exact, a failed load clears old output, each event's stated change matches the snapshots before and after it, and the last snapshot matches the final result.
- **Positions:** the script gives identical output on repeat and shuffled-input runs, all values stay in range, and moving an island never changes the traversal or results.

**End to end:** run the tests with `node --test`, then start the app in a browser and walk through Load, Step, Run to End and Reset, capturing screenshots. Animation runs only in the browser, so it's checked in this walkthrough, including pressing Step and Reset mid-animation.

## Decisions and what is left out

- **Reset** returns to the loaded map with everything unvisited and the position at the start, not to a blank page.
- **Summary** fills in as the replay reveals each result, so answers aren't shown before the steps that prove them.
- **Validation errors** are all reported together, not just the first one.
- **Invalid graphs** are demonstrated through tests, as the brief allows, so there is no upload feature or graph editor.
- **Left out:** Back button, speed control, scrubber, Pause, saved data and any backend. The optional print view is only worth adding if time remains. Snapshots keep Back easy to add if the live modification round asks for it.
