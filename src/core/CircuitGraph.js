/**
 * CircuitGraph.js - Graph Topology & Netlist Extractor (ES Module)
 */

export class DisjointSet {
  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  find(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
      return x;
    }
    let root = x;
    while (root !== this.parent.get(root)) {
      root = this.parent.get(root);
    }
    // Path compression
    let curr = x;
    while (curr !== root) {
      const nxt = this.parent.get(curr);
      this.parent.set(curr, root);
      curr = nxt;
    }
    return root;
  }

  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getGroups() {
    const groups = new Map();
    for (const item of this.parent.keys()) {
      const root = this.find(item);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root).push(item);
    }
    return groups;
  }
}

export class CircuitGraph {
  constructor(breadboard) {
    this.breadboard = breadboard;
    this.dsu = new DisjointSet();
    this.holeToNetId = new Map();
    this.netNames = new Map();
  }

  rebuild(components, wires) {
    this.dsu = new DisjointSet();
    this.holeToNetId.clear();
    this.netNames.clear();

    // 1. Initialize all breadboard holes into their internal tie strip groups
    for (const [stripId, holeIds] of this.breadboard.stripToHoles.entries()) {
      const firstHole = holeIds[0];
      for (const hId of holeIds) {
        this.dsu.union(firstHole, hId);
      }
    }

    // 2. Union connected holes & instrument terminals from jumper wires
    for (const wire of wires) {
      if (wire.fromHoleId && wire.toHoleId) {
        this.dsu.union(wire.fromHoleId, wire.toHoleId);
      }
    }

    // 3. Map all holes to their canonical root net ID
    for (const holeId of this.breadboard.holes.keys()) {
      const root = this.dsu.find(holeId);
      this.holeToNetId.set(holeId, root);
    }

    // 4. Assign intuitive names to standard power/GND nets
    const topGndHole = 'TN-1';
    const btmGndHole = 'BN-1';
    const topPosHole = 'TP-1';
    const btmPosHole = 'BP-1';

    const gndRoot = this.dsu.find(topGndHole);
    this.netNames.set(gndRoot, '0');

    const btmGndRoot = this.dsu.find(btmGndHole);
    this.netNames.set(btmGndRoot, '0');

    const posRoot = this.dsu.find(topPosHole);
    if (posRoot !== gndRoot) {
      this.netNames.set(posRoot, 'VCC_TOP');
    }
  }

  getNetForHole(holeId) {
    const root = this.dsu.find(holeId);
    return this.netNames.get(root) || `NET_${root}`;
  }

  analyzeIssues(components, wires) {
    this.rebuild(components, wires);
    const issues = [];

    // Check 1: VCC to GND Short Circuit
    const topPosRoot = this.dsu.find('TP-1');
    const topGndRoot = this.dsu.find('TN-1');
    const btmPosRoot = this.dsu.find('BP-1');
    const btmGndRoot = this.dsu.find('BN-1');

    if (topPosRoot === topGndRoot) {
      issues.push({
        type: 'error',
        title: 'Power Rail Short Circuit!',
        message: 'Top positive (+) and negative (-) rails are shorted directly together! Check your jumper wires.',
      });
    }

    if (btmPosRoot === btmGndRoot) {
      issues.push({
        type: 'error',
        title: 'Bottom Rail Short Circuit!',
        message: 'Bottom positive (+) and negative (-) rails are shorted directly together!',
      });
    }

    // Check 2: Components with disconnected or floating pins
    for (const comp of components) {
      const pluggedPins = comp.pins.filter((p) => p.holeId && this.breadboard.holes.has(p.holeId));
      if (pluggedPins.length === 0) {
        issues.push({
          type: 'warning',
          title: `${comp.label} is Unplugged`,
          message: `${comp.label} (${comp.displayValue}) has no pins plugged into breadboard holes.`,
          componentId: comp.id,
        });
      } else if (pluggedPins.length < comp.pins.length) {
        issues.push({
          type: 'warning',
          title: `${comp.label} Has Floating Pins`,
          message: `${comp.pins.length - pluggedPins.length} pin(s) of ${comp.label} are not plugged in.`,
          componentId: comp.id,
        });
      }

      if (comp.type === 'resistor' || comp.type === 'capacitor' || comp.type === 'inductor' || comp.type.startsWith('diode')) {
        if (comp.pins.length >= 2 && comp.pins[0].holeId && comp.pins[1].holeId) {
          const net1 = this.getNetForHole(comp.pins[0].holeId);
          const net2 = this.getNetForHole(comp.pins[1].holeId);
          if (net1 === net2) {
            issues.push({
              type: 'warning',
              title: `${comp.label} is Shorted Across Itself`,
              message: `Both leads of ${comp.label} are plugged into the same electrical strip (${comp.pins[0].holeId} & ${comp.pins[1].holeId}). Move one lead to a different row!`,
              componentId: comp.id,
            });
          }
        }
      }

      if (comp.type === 'ic_555') {
        const pin1 = comp.pins.find((p) => p.id === 'p1');
        const pin8 = comp.pins.find((p) => p.id === 'p8');
        const pin4 = comp.pins.find((p) => p.id === 'p4');
        if (pin1?.holeId && pin8?.holeId) {
          const netGnd = this.getNetForHole(pin1.holeId);
          const netVcc = this.getNetForHole(pin8.holeId);
          if (netGnd === netVcc) {
            issues.push({
              type: 'error',
              title: '555 IC Power Shorted',
              message: 'Pins 1 (GND) and 8 (VCC) of the 555 timer are connected to the same node!',
              componentId: comp.id,
            });
          }
        }
        if (pin4?.holeId && pin1?.holeId) {
          const netReset = this.getNetForHole(pin4.holeId);
          const netGnd = this.getNetForHole(pin1.holeId);
          if (netReset === netGnd) {
            issues.push({
              type: 'warning',
              title: '555 Reset Held Low',
              message: 'Pin 4 (RESET) of the 555 is tied to GND. Pin 4 must be tied to VCC for the timer to oscillate.',
              componentId: comp.id,
            });
          }
        }
      }
    }

    return issues;
  }
}