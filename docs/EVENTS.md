# Replay event schema

The engine runs the whole search up front and returns an ordered list of events. The interface only draws from this list. The rules below are fixed, so the same graph always gives the same list.

## Emission order

**Each undirected bridge is recorded from both adjacency entries**, so every bridge gets exactly two Inspect events. This keeps the rule simple and makes the second look at a loop bridge visible, even though it changes nothing.

Starting at an island `u`:

1. **Discover** `u`.
2. For each neighbour `v`, in ascending ID order, **Inspect** the connection:
   - **Tree** (`v` is unvisited): the full sequence for `v` runs here, followed by **Return**, **Bridge check** and, if `u` is not a root, **Articulation check**.
   - **Parent** (`v` is `u`'s parent): nothing else happens.
   - **Visited** (`v` was reached already): `low[u]` becomes `min(low[u], discovery[v])`.
3. If `u` is a root, **Root check**.
4. **Node complete** for `u`.
5. If `u` is a root, **Component complete**.

Roots are chosen in ascending ID order, and one discovery clock runs across all components.

## Fields

Every event has `seq` (its zero-based position), `type`, `node`, `edge` (a bridge ID or `null`) and `snapshot`.

| Type | `node` is | Other fields |
|---|---|---|
| `discover` | The island reached | `parent`, `discovery`, `low`, `component` |
| `inspect` | The island looking | `neighbour`, `from`, `to`, `kind` (`tree`, `parent` or `visited`). If `visited`, also `neighbourDiscovery`, `lowBefore`, `lowAfter` |
| `return` | The parent returned to | `child`, `from`, `to`, `childLow`, `lowBefore`, `lowAfter` |
| `bridge-check` | The parent | `child`, `childLow`, `parentDiscovery`, `isBridge` |
| `articulation-check` | The parent | `child`, `childLow`, `parentDiscovery`, `isArticulation` |
| `root-check` | The root | `childCount`, `isArticulation` |
| `node-complete` | The finished island | `discovery`, `low` |
| `component-complete` | The root | `component`, `size` |

`from` and `to` give the marker's direction of travel, so a Return goes from child to parent. A Discover has its arrival bridge in `edge`, or `null` for a root. A Root check, Node complete and Component complete have `edge: null`.

## Snapshot

Every event holds the complete state after it:

| Field | Meaning |
|---|---|
| `nodes` | For each island ID: `parent`, `discovery` and `low`, all `null` until it is discovered |
| `edges` | For each bridge ID: `unvisited`, `tree`, `non-tree` or `bridge` |
| `componentCount` | Components started so far, counted when a root is discovered |
| `bridges` | Bridge IDs found so far, in ascending ASCII order |
| `articulations` | Articulation island IDs found so far, in ascending ASCII order |

Bridge status changes at three moments: to `tree` on an Inspect of kind `tree`, to `non-tree` on an Inspect of kind `visited`, and to `bridge` on a Bridge check that passes. An Inspect of kind `parent` changes nothing.

## Main archipelago sequence

Derived by hand from the rules above and the adjacency lists in `ORACLE.md`. There are 56 events: 8 Discover, 18 Inspect, 7 Return, 7 Bridge check, 6 Articulation check, 1 Root check, 8 Node complete and 1 Component complete.

| # | Event | Result |
|---|---|---|
| 1 | Discover ANCHOR, root of component 1 | discovery = low = 0 |
| 2 | Inspect ANCHOR to BARREL over B01 | tree |
| 3 | Discover BARREL | discovery = low = 1 |
| 4 | Inspect BARREL to ANCHOR over B01 | parent |
| 5 | Inspect BARREL to COMPASS over B02 | tree |
| 6 | Discover COMPASS | discovery = low = 2 |
| 7 | Inspect COMPASS to ANCHOR over B03 | visited, low[COMPASS] 2 to 0 |
| 8 | Inspect COMPASS to BARREL over B02 | parent |
| 9 | Inspect COMPASS to DOUBLOON over B04 | tree |
| 10 | Discover DOUBLOON | discovery = low = 3 |
| 11 | Inspect DOUBLOON to COMPASS over B04 | parent |
| 12 | Inspect DOUBLOON to EMERALD over B05 | tree |
| 13 | Discover EMERALD | discovery = low = 4 |
| 14 | Inspect EMERALD to DOUBLOON over B05 | parent |
| 15 | Inspect EMERALD to FLAG over B06 | tree |
| 16 | Discover FLAG | discovery = low = 5 |
| 17 | Inspect FLAG to DOUBLOON over B07 | visited, low[FLAG] 5 to 3 |
| 18 | Inspect FLAG to EMERALD over B06 | parent |
| 19 | Inspect FLAG to GULL over B08 | tree |
| 20 | Discover GULL | discovery = low = 6 |
| 21 | Inspect GULL to FLAG over B08 | parent |
| 22 | Inspect GULL to HOOK over B09 | tree |
| 23 | Discover HOOK | discovery = low = 7 |
| 24 | Inspect HOOK to GULL over B09 | parent |
| 25 | Node complete HOOK | low 7 |
| 26 | Return HOOK to GULL over B09 | low[GULL] 6 to 6 |
| 27 | Bridge check B09 | 7 > 6, bridge |
| 28 | Articulation check GULL | 7 >= 6, articulation |
| 29 | Node complete GULL | low 6 |
| 30 | Return GULL to FLAG over B08 | low[FLAG] 3 to 3 |
| 31 | Bridge check B08 | 6 > 5, bridge |
| 32 | Articulation check FLAG | 6 >= 5, articulation |
| 33 | Node complete FLAG | low 3 |
| 34 | Return FLAG to EMERALD over B06 | low[EMERALD] 4 to 3 |
| 35 | Bridge check B06 | 3 > 4 is false |
| 36 | Articulation check EMERALD | 3 >= 4 is false |
| 37 | Node complete EMERALD | low 3 |
| 38 | Return EMERALD to DOUBLOON over B05 | low[DOUBLOON] 3 to 3 |
| 39 | Bridge check B05 | 3 > 3 is false |
| 40 | Articulation check DOUBLOON | 3 >= 3, articulation |
| 41 | Inspect DOUBLOON to FLAG over B07 | visited, low[DOUBLOON] 3 to 3 |
| 42 | Node complete DOUBLOON | low 3 |
| 43 | Return DOUBLOON to COMPASS over B04 | low[COMPASS] 0 to 0 |
| 44 | Bridge check B04 | 3 > 2, bridge |
| 45 | Articulation check COMPASS | 3 >= 2, articulation |
| 46 | Node complete COMPASS | low 0 |
| 47 | Return COMPASS to BARREL over B02 | low[BARREL] 1 to 0 |
| 48 | Bridge check B02 | 0 > 1 is false |
| 49 | Articulation check BARREL | 0 >= 1 is false |
| 50 | Node complete BARREL | low 0 |
| 51 | Return BARREL to ANCHOR over B01 | low[ANCHOR] 0 to 0 |
| 52 | Bridge check B01 | 0 > 0 is false |
| 53 | Inspect ANCHOR to COMPASS over B03 | visited, low[ANCHOR] 0 to 0 |
| 54 | Root check ANCHOR | 1 child, not an articulation island |
| 55 | Node complete ANCHOR | low 0 |
| 56 | Component complete | component 1, 8 islands |
