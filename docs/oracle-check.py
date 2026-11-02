#!/usr/bin/env python3
"""Independent check of the values documented in ORACLE.md.

Shares no code or data with the application. Each graph is typed here by hand
and analysed twice: by a separate low-link DFS, and by brute force, which
removes each edge and node in turn and counts the connected components.

Run with: python3 docs/oracle-check.py
"""

GRAPHS = {
    "MAIN": (
        ["ANCHOR", "BARREL", "COMPASS", "DOUBLOON", "EMERALD", "FLAG", "GULL", "HOOK"],
        [
            ("B01", "ANCHOR", "BARREL"),
            ("B02", "BARREL", "COMPASS"),
            ("B03", "ANCHOR", "COMPASS"),
            ("B04", "COMPASS", "DOUBLOON"),
            ("B05", "DOUBLOON", "EMERALD"),
            ("B06", "EMERALD", "FLAG"),
            ("B07", "DOUBLOON", "FLAG"),
            ("B08", "FLAG", "GULL"),
            ("B09", "GULL", "HOOK"),
        ],
    ),
    "CYCLE": (
        ["A", "B", "C", "D"],
        [("E1", "A", "B"), ("E2", "B", "C"), ("E3", "C", "D"), ("E4", "A", "D")],
    ),
    "MIXED": (
        ["A", "B", "C", "D", "E", "F", "G"],
        [("E1", "A", "B"), ("E2", "A", "C"), ("E3", "E", "F"), ("E4", "F", "G"), ("E5", "E", "G")],
    ),
    "BOWTIE": (
        ["A", "B", "C", "D", "E"],
        [
            ("E1", "A", "B"),
            ("E2", "B", "C"),
            ("E3", "A", "C"),
            ("E4", "C", "D"),
            ("E5", "D", "E"),
            ("E6", "C", "E"),
        ],
    ),
}


def low_link(nodes, edges):
    adjacency = {node: [] for node in nodes}
    for edge_id, a, b in edges:
        adjacency[a].append((b, edge_id))
        adjacency[b].append((a, edge_id))
    for neighbours in adjacency.values():
        neighbours.sort()

    discovery, low, parent, order = {}, {}, {}, []
    bridges, articulations = set(), set()

    def visit(u, p):
        discovery[u] = low[u] = len(order)
        parent[u] = p
        order.append(u)
        children = 0
        for v, edge_id in adjacency[u]:
            if v not in discovery:
                children += 1
                visit(v, u)
                low[u] = min(low[u], low[v])
                if low[v] > discovery[u]:
                    bridges.add(edge_id)
                if p is not None and low[v] >= discovery[u]:
                    articulations.add(u)
            elif v != p:
                low[u] = min(low[u], discovery[v])
        if p is None and children >= 2:
            articulations.add(u)

    components = 0
    for node in sorted(nodes):
        if node not in discovery:
            components += 1
            visit(node, None)
    return adjacency, order, parent, discovery, low, components, sorted(bridges), sorted(articulations)


def count_components(nodes, edges):
    adjacency = {node: [] for node in nodes}
    for _, a, b in edges:
        adjacency[a].append(b)
        adjacency[b].append(a)
    seen, count = set(), 0
    for start in nodes:
        if start in seen:
            continue
        count += 1
        stack = [start]
        while stack:
            node = stack.pop()
            if node not in seen:
                seen.add(node)
                stack.extend(adjacency[node])
    return count


def brute_force(nodes, edges):
    base = count_components(nodes, edges)
    bridges = [e[0] for e in edges if count_components(nodes, [x for x in edges if x != e]) > base]
    articulations = []
    for node in nodes:
        rest = [n for n in nodes if n != node]
        kept = [e for e in edges if node not in e[1:]]
        # Removing an isolated node removes its component, which isn't a split.
        isolated = len(kept) == len(edges)
        if count_components(rest, kept) > base - (1 if isolated else 0):
            articulations.append(node)
    return sorted(bridges), sorted(articulations)


for name, (nodes, edges) in GRAPHS.items():
    adjacency, order, parent, discovery, low, components, bridges, articulations = low_link(nodes, edges)
    print(f"== {name}")
    for node in sorted(nodes):
        entries = ", ".join(f"{v} ({e})" for v, e in adjacency[node]) or "none"
        print(f"  {node:9} neighbours: {entries}")
    print(f"  discovery order: {' '.join(order)}")
    for node in sorted(nodes):
        print(f"  {node:9} parent={str(parent[node]):9} discovery={discovery[node]} low={low[node]}")
    print(f"  components={components} bridges={bridges} articulations={articulations}")
    agrees = brute_force(nodes, edges) == (bridges, articulations)
    print(f"  brute force agrees: {agrees}")
    assert agrees, name
