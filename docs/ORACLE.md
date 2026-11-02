# Expected answers

These values were documented before the engine was written. The application never reads this file. The tests hold their own typed copies, and a test checks that application code doesn't reference this file or the test files.

**How they were checked:** `docs/oracle-check.py` is separate from the application and shares no code or data with it. It works out each graph twice, with its own low-link DFS and with brute force, which removes each bridge and island in turn and counts the components. Brute force uses no low-link logic, so it is a real second opinion on the bridges and articulation islands. The parent, discovery and low tables come from the script's DFS and the hand trace in `EVENTS.md`.

Run it with `python3 docs/oracle-check.py`.

## Main archipelago

8 islands and 9 bridges, with two safe loops and one exposed branch.

```
 ANCHOR ──B01── BARREL         DOUBLOON ──B05── EMERALD
    \            /             /     \            /
    B03        B02          B04      B07        B06
      \        /            /          \        /
       COMPASS ────────────┘            FLAG ──B08── GULL ──B09── HOOK
```

### Sorted adjacency lists

| Island | Neighbours, with connecting bridge |
|---|---|
| ANCHOR | BARREL (B01), COMPASS (B03) |
| BARREL | ANCHOR (B01), COMPASS (B02) |
| COMPASS | ANCHOR (B03), BARREL (B02), DOUBLOON (B04) |
| DOUBLOON | COMPASS (B04), EMERALD (B05), FLAG (B07) |
| EMERALD | DOUBLOON (B05), FLAG (B06) |
| FLAG | DOUBLOON (B07), EMERALD (B06), GULL (B08) |
| GULL | FLAG (B08), HOOK (B09) |
| HOOK | GULL (B09) |

### Traversal

**Discovery order:** ANCHOR, BARREL, COMPASS, DOUBLOON, EMERALD, FLAG, GULL, HOOK

| Island | Parent | Discovery | Low |
|---|---|---|---|
| ANCHOR | none | 0 | 0 |
| BARREL | ANCHOR | 1 | 0 |
| COMPASS | BARREL | 2 | 0 |
| DOUBLOON | COMPASS | 3 | 3 |
| EMERALD | DOUBLOON | 4 | 3 |
| FLAG | EMERALD | 5 | 3 |
| GULL | FLAG | 6 | 6 |
| HOOK | GULL | 7 | 7 |

### Results

| Result | Value |
|---|---|
| Components | 1 |
| Bridges | B04, B08, B09 |
| Articulation islands | COMPASS, DOUBLOON, FLAG, GULL |

### Why these results hold

| Item | Comparison | Conclusion |
|---|---|---|
| B04 | low[DOUBLOON] = 3 > discovery[COMPASS] = 2 | Bridge: nothing past DOUBLOON reaches COMPASS or earlier |
| B05 | low[EMERALD] = 3 > discovery[DOUBLOON] = 3 is false | Not a bridge: B07 gives another route back to DOUBLOON |
| DOUBLOON | low[EMERALD] = 3 >= discovery[DOUBLOON] = 3 | Articulation: that route still ends at DOUBLOON itself |
| B08 | low[GULL] = 6 > discovery[FLAG] = 5 | Bridge |
| B09 | low[HOOK] = 7 > discovery[GULL] = 6 | Bridge |
| ANCHOR | 1 DFS child, and a root needs at least 2 | Not an articulation island |

## Focused test graphs

### Cycle only

Four islands in a ring, with edges E1 A-B, E2 B-C, E3 C-D and E4 A-D.

| Island | Parent | Discovery | Low |
|---|---|---|---|
| A | none | 0 | 0 |
| B | A | 1 | 0 |
| C | B | 2 | 0 |
| D | C | 3 | 0 |

1 component, no bridges and no articulation islands.

### Mixed

Root A with two children, isolated island D, and a separate loop. Edges are E1 A-B, E2 A-C, E3 E-F, E4 F-G and E5 E-G.

| Island | Parent | Discovery | Low |
|---|---|---|---|
| A | none | 0 | 0 |
| B | A | 1 | 1 |
| C | A | 2 | 2 |
| D | none | 3 | 3 |
| E | none | 4 | 4 |
| F | E | 5 | 4 |
| G | F | 6 | 4 |

3 components, bridges E1 and E2, and articulation island A. The discovery clock carries across all three components.

### Bowtie

Two triangles sharing island C, with edges E1 A-B, E2 B-C, E3 A-C, E4 C-D, E5 D-E and E6 C-E. This graph shows why a back connection must use the neighbour's discovery value, not its low value.

| Island | Parent | Discovery | Low |
|---|---|---|---|
| A | none | 0 | 0 |
| B | A | 1 | 0 |
| C | B | 2 | 0 |
| D | C | 3 | 2 |
| E | D | 4 | 2 |

1 component, no bridges, and articulation island C. Using low[C] = 0 on the connection from E to C would make low[D] = 0, and C would wrongly stop being an articulation island.
