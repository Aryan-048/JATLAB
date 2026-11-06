/**
 * CircuitGraph.ts - Graph Topology & Netlist Extractor
 * Uses Disjoint-Set-Union (DSU) to resolve connected electrical nodes from breadboard strips + jumper wires.
 */

import { BreadboardModel } from './BreadboardModel.js';
import { ComponentItem } from './ComponentModel.js';
import { WireItem } from './WireModel.js';

export class DisjointSet {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  public find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
      return x;
    }
    let root = x;
    while (root !== this.parent.get(root)) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let curr = x;
    while (curr !== root) {
      const nxt = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = nxt;
    }
    return root;
  }

  public union(x: string, y: string): void {
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

  public getGroups(): Map<string, string[]> {
    const groups: Map<string, string[]> = new Map();
    for (const item of this.parent.keys()) {
      const root = this.find(item);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(item);
    }
    return groups;
  }
}

export interface ResolvedCircuitIssue {
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  componentId?: string;
}

export class CircuitGraph {
  public breadboard: BreadboardModel;
  public dsu: DisjointSet = new DisjointSet();
  public holeToNetId: Map<string, string> = new Map();
  public netNames: Map<string, string> = new Map(); // e.g. "GND", "VCC", "Net_1"

  constructor(breadboard: BreadboardModel) {
    this.breadboard = breadboard;
  }

  /**
   * Rebuild the global connectivity from wires and placed components
   */
  public rebuild(components: ComponentItem[], wires: WireItem[]): void {
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
    // Top negative rail and bottom negative rail are standard GND reference
    const topGndHole = 'TN-1';
    const btmGndHole = 'BN-1';
    const topPosHole = 'TP-1';
    const btmPosHole = 'BP-1';

    const gndRoot = this.dsu.find(topGndHole);
    this.netNames.set(gndRoot, '0'); // MNA reference node 0 (GND)

    const btmGndRoot = this.dsu.find(btmGndHole);
    this.netNames.set(btmGndRoot, '0'); // Bottom GND rail also reference 0

    const posRoot = this.dsu.find(topPosHole);
    if (posRoot !== gndRoot) {
      this.netNames.set(posRoot, 'VCC_TOP');
    }
  }

  /**
   * Get the electrical node name/id for a given hole
   */
  public getNetForHole(holeId: string): string {
    const root = this.dsu.find(holeId);
    return this.netNames.get(root) || `NET_${root}`;
  }

  /**
   * Analyze the circuit for issues (shorts, floating pins, reverse polarity)
   */
  public analyzeIssues(components: ComponentItem[], wires: WireItem[]): ResolvedCircuitIssue[] {
    this.rebuild(components, wires);
    const issues: ResolvedCircuitIssue[] = [];

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

      // Check for component pin short-out (both leads in the same strip)
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

      // Check 555 IC power
      if (comp.type === 'ic_555') {
        const pin1 = comp.pins.find((p) => p.id === 'p1'); // GND
        const pin8 = comp.pins.find((p) => p.id === 'p8'); // VCC
        const pin4 = comp.pins.find((p) => p.id === 'p4'); // RESET
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
