# Prompts and decisions

This log records the prompts used to turn the problem statement into a specification for the AI assistant (Claude Code), what each one changed, and how the plan changed during the build.

## Planning prompts

| # | Prompt | What it changed |
|---|---|---|
| 1 | "I want to plan an Idea first for the given problem statement, then will move into implementation details so for now just give me an highlevel Idea not code. ... (We are not supposed to over engineer anything than asked)", followed by the full problem statement | Set the working rules: plan first, no code yet, build only what the brief asks for. The assistant proposed the demo graph and checked it with a separate trace and a brute-force test. |
| 2 | "Do a websearch and find all option to draw complicated structures like a network graph" | Surveyed browser drawing, graph libraries, diagram editors, text-to-diagram tools and desktop apps. SVG stayed, because the map has at most 12 islands and 20 bridges. |
| 3 | "How do we already have position?" | Caught a wrong claim. The assistant had said the brief supplies island positions, but it only requires them. We choose them. |
| 4 | "I think having a library to convert a graph input (like adjecency list) to poisitions of node will be better. Check if any library already exists to do this" | Replaced hand-placed positions with a layout library. Determinism became the deciding test, and the assistant proposed generating positions once and saving them. |
| 5 | Comments on rescaling: multiply centres by a constant, and offset by `max(-all coordinates)` if anything is negative. Also confirmed sorting before building. | Became the offset and scaling rule. The assistant refined it: offset first, one constant for both axes, no radius scaling, and a 10–90 range so labels aren't clipped. |
| 6 | "https://graphology.github.io/ Check if this suites our purpose" | graphology replaced d3-force. Searching its source found no random calls in ForceAtlas2, but found `Math.random` in noverlap, so noverlap was rejected. |
| 7 | "We want to add our own animations like while doing DFS, we wanna have a slow animation over edges to show the user entire process instead of magically giving a new state. What would be better?" | Animation moved into scope as a display layer in the SVG. It was separated from the layout library choice, because neither candidate draws anything. |
| 8 | "How are we planning to keep everthing in a sync? My idea: Have a GraphState class ... Another class Event{node no., low, descovery} //pre calculated ... This way UI can simply use precomputed events to render" | Added the read-only `GraphState` and made precomputed events the only thing the interface renders. See the next section for what was changed in this idea and why. |
| 9 | Chose "Leave it out" when asked about a Back button | Back stays out of scope. Snapshots keep it easy to add if the live modification round asks for it. |
| 10 | "Make sure you use atomic git commits and in description mention why behind every technical decisions made by you" | Added the commit rules. The commit history now records the reasoning behind each decision. |

## Where human and AI ideas changed each other

**The sync design (prompt 8).** The assistant's earlier design rebuilt the state by replaying events from the start. The prompt's idea of a UI that only renders precomputed events led to something simpler: each event stores a full snapshot, so there is no second copy of the update logic.

Three parts of the proposal changed:
- **Graph format:** `vector<ordered_set<int>>` became string IDs with sorted neighbour lists that also carry the bridge ID. Results must name bridges such as `B04`, and the DFS never needs an "is this a neighbour?" lookup.
- **Event contents:** `Event{node, low, discovery}` can't describe a bridge check, which changes no island's numbers. Events gained a type, a bridge, a direction, old and new values, and a verdict.
- **Going back:** undoing by hand assumes the previous island is the parent. In the mixed test graph the order is A, B, C but C's parent is A, so undoing C would animate an edge from C to B that doesn't exist. Snapshots avoid this.

**Island positions (prompts 3 to 6).** The assistant first recommended hand-placed positions. The prompt for a layout library won out, because rerunning one command is much quicker than placing islands by hand if the graph changes. The assistant's contribution was keeping that step out of the browser app, so the map can't shift between loads.

## Changes to the plan during the build

The approved plan is in `PLAN.md`.

| Change | Why |
|---|---|
| The plan and this log were committed in step 1 instead of step 5 | They already existed, and later commits record changes against them. |
| Step 1 did not start from an empty folder, as the plan assumed | The session had been rewound after an earlier build. Its leftover documents and evidence described code that no longer existed, so they were moved out of the project and not reused as evidence. |
| The layout script gained an orientation step, and uses ForceAtlas2's `linLogMode` | The default layout was taller than wide and ran right to left, while the map panel is wider than tall. `linLogMode` gave the largest measured gaps around islands and bridges. |
