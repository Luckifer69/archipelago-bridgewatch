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
| Island labels use scored placement | Bridges leave islands in different directions, so one fixed label spot would overlap on some islands. |
| The island table gained a Hosts column | Knowing that BARREL holds the first-aid tent is what makes a cut-off island matter to a volunteer. It gives way on a phone, where the required columns must fit. |
| A `Player` class sits between the buttons and the replay, beyond the plan's three parts | Rules such as "Step mid-animation completes that event" are easy to get wrong. With the animation passed in, a fake animator tests them without a browser. |
| Shared test graphs live in `fixtures/`, not `test/` | Node's test runner treats every file in `test/` as a test. |
| A third test graph, the bowtie, was added | It has an articulation island with no bridges, which neither planned graph covers. |
| `docs/oracle-check.py` and a mutation check were added | The script works out the expected answers with no app code. The mutation check breaks the code on purpose, because passing tests only count if they can fail. |
| The browser walkthrough became a script, using `playwright-core` installed with `--no-save` | A script can be rerun and compared. Only this check needs the package, so the project doesn't depend on it. |
| The phone table fix got its own commit, and step 5's one commit became several | Each is a separate logical change, under the atomic commit rule. |

## Constraints given to the assistant

| Constraint | From | Effect |
|---|---|---|
| Plan first, with no code until the plan is approved | Prompt 1 | The approved plan came before any code. |
| Build what the brief asks for and nothing more | Prompt 1 | No graph editor, upload, Back button, speed control or framework. |
| The brief's contracts: size limits, ID format, ascending-ID order and the low-link rules | Prompt 1 | Became the validation rules, traversal code and focused tests. |
| Get positions from a library, not by hand | Prompt 4 | Led to the layout script. |
| A slow animation along the bridges, with no state appearing "magically" | Prompt 7 | Led to the marker that travels along each bridge, with numbers changing when it arrives. |
| A `GraphState` class and precomputed events, with the UI only rendering them | Prompt 8 | Became the core design. |
| Atomic commits that explain every technical decision | Prompt 10 | Set the shape of the commit history. |

The assistant proposed these, and they were accepted when the plan was approved: plain JavaScript modules, SVG, Node's test runner, no runtime dependencies, and writing the expected answers before the engine.

## Trade-offs and assumptions

| Choice | What it gains | What it costs |
|---|---|---|
| A full snapshot in each event | Any state is one draw, with no undo logic | More memory, which doesn't matter at 12 islands and 20 bridges |
| Recursive DFS | Reads like the brief's rules | Could overflow on a huge graph, which the 12-island limit rules out |
| Positions generated once by graphology and saved | One command updates the map, and the map can't shift | Three development dependencies, so `npm test` needs `npm ci` first |
| Each bridge inspected from both ends | The second look at a loop bridge is visible | 18 inspect events rather than 9, so a longer replay |
| Numbers change when the animation finishes | Each change follows the movement that caused it | Step feels slower, so pressing it mid-animation completes the current event at once |
| The summary fills in as the replay proves each result | Answers don't appear before their proof | The summary is empty at the start |
| Tests pin the documented main map | An accidental change fails loudly | A deliberate map change also needs its expected values updated |

Assumptions the brief left open:
- **Reset** returns to the loaded map, not a blank page.
- **Invalid graphs** are shown through tests, as the brief allows, so the app has no way to enter one.
- **Run to End** plays every event with its animation, and a second press skips to the end. The brief only requires that it uses the same event sequence.

## Problems found by verification

| Found by | Problem | Fix |
|---|---|---|
| A test that measures map overlaps | An island's label overlapped its diamond | The label gap now allows for the diamond and the current ring |
| The walkthrough's comparison with a control run | The counter said "Event 17" above event 16's numbers while the animation played | The counter follows the event shown on screen |
| The walkthrough itself | Its island selector also matched table rows, so the script was checking the wrong elements | Narrowed the selector to the map |
| The phone screenshot | The required Low column was clipped | The optional Hosts column hides at phone width, and a browser check now covers this |
| Reviewing the screenshots | The B04 proof wrapped onto a second line at 1280x800 | Rebalanced the summary columns and reduced the proof text size. Measured with no wrapping from 1280px wide up; narrower screens still wrap, and stay readable |

## Assistant mistakes

| Mistake | Caught by | Outcome |
|---|---|---|
| Said the brief supplies island positions | Prompt 3 | Corrected, and led to the layout library |
| Assumed the folder was empty, and overwrote `package.json` and `.gitignore` without looking | The assistant, from a `git init` warning | The earlier `package.json` was still in the session's file history, and nothing important was lost |
| Stopped a test server with a broad `pkill -f 'node server.js'`, which ended its own shell and could have matched any process with that text | The assistant, from the exit code | No test server was left running. It should have used the process ID. The walkthrough now starts and stops its own server. |

## Live modification rehearsal

Both changes were made in a throwaway clone from a clean start, and neither was committed.

| Modification | What changed | Result |
|---|---|---|
| Back button | `Replay.stepBack`, `Player.stepBack` and a button, about 15 lines across 4 files, plus a test | 152 of 152 tests pass. In Chrome, Back from event 28 to 27 matched the stepped state exactly, with no errors. |
| Ninth island, IVORY, joined to HOOK by B10 | `topology.js`, then `npm run layout` | The app worked first time, with 63 events, a readable map and no page errors. B10 and HOOK were correctly marked critical. 22 of the 151 tests failed, because they pin the documented main map. |
