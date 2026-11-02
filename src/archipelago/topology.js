// Everything about the demo archipelago except where the islands sit on the map.
// scripts/layout.js turns this into positions.js.

export const ISLANDS = [
  { id: 'ANCHOR', name: 'Anchor Landing', role: 'Main gate' },
  { id: 'BARREL', name: 'Barrel Bay', role: 'First-aid tent' },
  { id: 'COMPASS', name: 'Compass Cove', role: 'Food stalls' },
  { id: 'DOUBLOON', name: 'Doubloon Dunes', role: 'Music stage' },
  { id: 'EMERALD', name: 'Emerald Atoll', role: 'Games' },
  { id: 'FLAG', name: 'Flagship Rock', role: 'Craft market' },
  { id: 'GULL', name: "Gull's Perch", role: 'Lookout' },
  { id: 'HOOK', name: "Hook's Hideaway", role: 'Treasure hunt' },
];

export const BRIDGES = [
  { id: 'B01', a: 'ANCHOR', b: 'BARREL' },
  { id: 'B02', a: 'BARREL', b: 'COMPASS' },
  { id: 'B03', a: 'ANCHOR', b: 'COMPASS' },
  { id: 'B04', a: 'COMPASS', b: 'DOUBLOON' },
  { id: 'B05', a: 'DOUBLOON', b: 'EMERALD' },
  { id: 'B06', a: 'EMERALD', b: 'FLAG' },
  { id: 'B07', a: 'DOUBLOON', b: 'FLAG' },
  { id: 'B08', a: 'FLAG', b: 'GULL' },
  { id: 'B09', a: 'GULL', b: 'HOOK' },
];
