/**
 * test_breadboard.mjs - Unit Tests for Breadboard Topology, Components & CircuitGraph
 */

import test from 'node:test';
import assert from 'node:assert';

import { BreadboardModel } from '../src/core/BreadboardModel.js';
import {
  createComponent,
  calculateResistorBands,
  formatResistance,
} from '../src/core/ComponentModel.js';
import { CircuitGraph } from '../src/core/CircuitGraph.js';
import { createWire } from '../src/core/WireModel.js';
import { StateManager } from '../src/ui/StateManager.js';

test('BreadboardModel generates full 830-point topology', () => {
  const bb = new BreadboardModel();

  // 63 columns * 14 holes per column = 882 holes (standard full-size layout)
  assert.strictEqual(bb.holes.size, 63 * 14);

  // Check terminal row strip grouping
  const strip15A = bb.getHolesInStrip('15-A');
  assert.strictEqual(strip15A.length, 5); // 15-A, 15-B, 15-C, 15-D, 15-E
  const holeIds = strip15A.map((h) => h.id);
  assert.deepStrictEqual(holeIds.sort(), ['15-A', '15-B', '15-C', '15-D', '15-E'].sort());

  // Check that F..J is in a separate strip across center trough
  const strip15F = bb.getHolesInStrip('15-F');
  assert.strictEqual(strip15F.length, 5);
  assert.notStrictEqual(strip15A[0].stripId, strip15F[0].stripId);

  // Check power rail connectivity along entire length
  const topPosStrip = bb.getHolesInStrip('TP-1');
  assert.strictEqual(topPosStrip.length, 63);
  assert.strictEqual(topPosStrip[0].stripId, 'RAIL_TOP_POS');
});

test('Resistor color bands calculation matches EIA standard', () => {
  // 220 Ω -> Red (2), Red (2), Brown (x10), Gold
  const b220 = calculateResistorBands(220);
  assert.strictEqual(b220[0], '#DC2626'); // Red
  assert.strictEqual(b220[1], '#DC2626'); // Red
  assert.strictEqual(b220[2], '#78350F'); // Brown

  // 1000 Ω (1k) -> Brown (1), Black (0), Red (x100), Gold
  const b1k = calculateResistorBands(1000);
  assert.strictEqual(b1k[0], '#78350F'); // Brown
  assert.strictEqual(b1k[1], '#111827'); // Black
  assert.strictEqual(b1k[2], '#DC2626'); // Red

  // 2200 Ω (2.2k) -> Red (2), Red (2), Red (x100), Gold
  const b2k2 = calculateResistorBands(2200);
  assert.strictEqual(b2k2[0], '#DC2626'); // Red
  assert.strictEqual(b2k2[1], '#DC2626'); // Red
  assert.strictEqual(b2k2[2], '#DC2626'); // Red

  // 4700 Ω (4.7k) -> Yellow (4), Violet (7), Red (x100), Gold
  const b4k7 = calculateResistorBands(4700);
  assert.strictEqual(b4k7[0], '#EAB308'); // Yellow
  assert.strictEqual(b4k7[1], '#9333EA'); // Violet
  assert.strictEqual(b4k7[2], '#DC2626'); // Red

  // 10000 Ω (10k) -> Brown (1), Black (0), Orange (x1k), Gold
  const b10k = calculateResistorBands(10000);
  assert.strictEqual(b10k[0], '#78350F'); // Brown
  assert.strictEqual(b10k[1], '#111827'); // Black
  assert.strictEqual(b10k[2], '#EA580C'); // Orange

  // 100000 Ω (100k) -> Brown (1), Black (0), Yellow (x10k), Gold
  const b100k = calculateResistorBands(100000);
  assert.strictEqual(b100k[0], '#78350F'); // Brown
  assert.strictEqual(b100k[1], '#111827'); // Black
  assert.strictEqual(b100k[2], '#EAB308'); // Yellow
});

test('Component Factory correctly configures IC pins', () => {
  // 555 Timer (8 pins)
  const ic555 = createComponent('ic_555');
  assert.strictEqual(ic555.pins.length, 8);
  assert.strictEqual(ic555.pins[0].id, 'p1');
  assert.strictEqual(ic555.pins[0].name.includes('GND'), true);
  assert.strictEqual(ic555.pins[4].id, 'p5');
  assert.strictEqual(ic555.pins[4].name.includes('CONT'), true);
  assert.strictEqual(ic555.pins[7].id, 'p8');
  assert.strictEqual(ic555.pins[7].name.includes('VCC'), true);

  // ICL8038 VCO (14 pins)
  const ic8038 = createComponent('ic_8038');
  assert.strictEqual(ic8038.pins.length, 14);
  assert.strictEqual(ic8038.pins[1].name.includes('SINE_OUT'), true);
  assert.strictEqual(ic8038.pins[7].name.includes('FM_SWEEP'), true);
});

test('CircuitGraph detects shorts and merges connected nets via wires', () => {
  const bb = new BreadboardModel();
  const graph = new CircuitGraph(bb);

  // Initially: 15-C and 20-C are in different electrical nets
  graph.rebuild([], []);
  const netBefore1 = graph.getNetForHole('15-C');
  const netBefore2 = graph.getNetForHole('20-C');
  assert.notStrictEqual(netBefore1, netBefore2);

  // Add jumper wire from 15-C to 20-C
  const wire1 = createWire('15-C', '20-C');
  graph.rebuild([], [wire1]);
  const netAfter1 = graph.getNetForHole('15-C');
  const netAfter2 = graph.getNetForHole('20-C');
  assert.strictEqual(netAfter1, netAfter2); // Merged!

  // Check short circuit detection: short TP-1 to TN-1
  const shortWire = createWire('TP-1', 'TN-1');
  const issues = graph.analyzeIssues([], [shortWire]);
  assert.strictEqual(
    issues.some((i) => i.title.includes('Short Circuit')),
    true
  );
});

test('A hole accepts one lead or wire end, and a parallel wire uses another hole in the strip', () => {
  const bb = new BreadboardModel();
  const state = new StateManager(bb);

  const first = state.addWire('10-A', '18-A');
  assert.ok(first);
  const stacked = state.addWire('10-A', '20-A');
  assert.strictEqual(stacked, null);
  assert.strictEqual(state.wires.length, 1);

  const parallel = state.addWire('10-B', '18-B');
  assert.ok(parallel);
  assert.strictEqual(
    state.circuitGraph.getNetForHole('10-A'),
    state.circuitGraph.getNetForHole('10-B')
  );

  state.startPlacement('resistor', { value: 1000 });
  assert.strictEqual(state.commitPendingPlacement('10-A'), false);

  state.startPlacement('resistor', { value: 1000 });
  assert.strictEqual(state.commitPendingPlacement('12-C'), true);
  const leads = state.components[0].pins.map((p) => p.holeId);
  const strips = leads.map((id) => bb.holes.get(id).stripId);
  assert.notStrictEqual(strips[0], strips[1]);
});

test('A 555 dropped anywhere in a column straddles the gap, one pin per strip', () => {
  const bb = new BreadboardModel();
  const state = new StateManager(bb);
  state.startPlacement('ic_555');
  assert.strictEqual(state.commitPendingPlacement('20-A'), true);
  const ic = state.components[0];
  assert.strictEqual(ic.anchorHoleId, '20-E');
  const strips = ic.pins.map((p) => bb.holes.get(p.holeId).stripId);
  assert.strictEqual(new Set(strips).size, ic.pins.length);
  assert.deepStrictEqual(
    ic.pins.slice(0, 4).map((p) => p.holeId),
    ['20-E', '21-E', '22-E', '23-E']
  );
  assert.deepStrictEqual(
    ic.pins.slice(4).map((p) => p.holeId),
    ['23-F', '22-F', '21-F', '20-F']
  );
});

