/**
 * test_solver.mjs - Unit tests for MNA Transient Simulation & RC Low-Pass Filter
 */

import test from 'node:test';
import assert from 'node:assert';
import { MNASolver } from '../src/simulation/MNASolver.js';

test('RC Low-Pass Filter at 1 kHz matches theoretical attenuation and phase shift', () => {
  const solver = new MNASolver();

  const netlist = [
    // Function generator: Sine 1 kHz, 2 Vp (Vpp = 4 V)
    {
      id: 'FG1',
      type: 'function_generator',
      nodes: ['IN', '0'],
      value: 2.0,
      properties: {
        waveform: 'sine',
        frequency: 1000.0,
        amplitude: 2.0,
        offset: 0.0,
        enabled: true,
      },
    },
    // R = 1 kΩ between IN and OUT
    {
      id: 'R1',
      type: 'resistor',
      nodes: ['IN', 'OUT'],
      value: 1000.0,
    },
    // C = 0.1 µF between OUT and GND (0)
    {
      id: 'C1',
      type: 'capacitor',
      nodes: ['OUT', '0'],
      value: 0.1e-6,
    },
  ];

  // Simulate 5 ms (5 full cycles of 1 kHz) with 1 µs time step
  const result = solver.solveTransient(netlist, 0.005, 1e-6);

  const t = result.time;
  const vIn = result.nodeVoltages.get('IN');
  const vOut = result.nodeVoltages.get('OUT');

  assert.ok(vIn, 'vIn array must exist');
  assert.ok(vOut, 'vOut array must exist');

  // Examine steady-state during last 2 cycles (t between 3 ms and 5 ms)
  const startIndex = Math.floor(0.003 / 1e-6);
  let maxVIn = -Infinity;
  let maxVOut = -Infinity;
  let tPeakIn = 0;
  let tPeakOut = 0;

  for (let i = startIndex; i < result.time.length; i++) {
    if (vIn[i] > maxVIn) {
      maxVIn = vIn[i];
      tPeakIn = t[i];
    }
    if (vOut[i] > maxVOut) {
      maxVOut = vOut[i];
      tPeakOut = t[i];
    }
  }

  // Theoretical values:
  // V_in peak = 2.0 V
  assert.ok(Math.abs(maxVIn - 2.0) < 0.05, `Input peak should be ~2.0 V, got ${maxVIn}`);

  // V_out peak = 2.0 * (1 / sqrt(1 + (2*pi*f*R*C)^2)) ≈ 1.693 V
  const f = 1000.0;
  const omega = 2 * Math.PI * f;
  const expectedGain = 1.0 / Math.sqrt(1 + Math.pow(omega * 1000.0 * 0.1e-6, 2));
  const expectedVOut = 2.0 * expectedGain; // ~1.693 V

  console.log(`Measured V_out peak: ${maxVOut.toFixed(4)} V | Expected: ${expectedVOut.toFixed(4)} V`);
  assert.ok(
    Math.abs(maxVOut - expectedVOut) < 0.05,
    `Output peak should be ~${expectedVOut.toFixed(3)} V, got ${maxVOut.toFixed(3)} V`
  );

  // Phase shift: should be lagging by ~89 µs (32.14 degrees)
  const expectedPhaseLagDeg = (Math.atan(omega * 1000.0 * 0.1e-6) * 180) / Math.PI;
  const expectedDelaySec = expectedPhaseLagDeg / (360 * f); // ~8.92e-5 s
  console.log(`Expected phase lag: ${expectedPhaseLagDeg.toFixed(2)}° (~${(expectedDelaySec * 1e6).toFixed(1)} µs)`);
});

test('Diode Rectifier exhibits realistic Shockley forward drop ~0.7 V', () => {
  const solver = new MNASolver();

  const netlist = [
    {
      id: 'FG1',
      type: 'function_generator',
      nodes: ['IN', '0'],
      value: 5.0,
      properties: {
        waveform: 'sine',
        frequency: 1000.0,
        amplitude: 5.0,
        enabled: true,
      },
    },
    {
      id: 'D1',
      type: 'diode_1n4007',
      nodes: ['IN', 'OUT'],
      value: 0.7,
    },
    {
      id: 'RLOAD',
      type: 'resistor',
      nodes: ['OUT', '0'],
      value: 1000.0,
    },
  ];

  const result = solver.solveTransient(netlist, 0.003, 1e-6);
  const vOut = result.nodeVoltages.get('OUT');

  // Peak output across load should be ~5.0 - 0.7 = ~4.3 V
  const maxV = Math.max(...vOut);
  const minV = Math.min(...vOut);

  console.log(`Rectifier V_peak: ${maxV.toFixed(3)} V | V_min: ${minV.toFixed(3)} V`);
  assert.ok(maxV > 4.1 && maxV < 4.5, `Rectified peak should be ~4.3 V, got ${maxV}`);
  assert.ok(minV >= -0.05, `Rectified negative cycle should be clipped to ~0 V, got ${minV}`);
  assert.strictEqual(result.error, null);
});

function assertFlatFinite(result) {
  assert.ok(result.error, 'expected a solver error');
  for (const arr of result.nodeVoltages.values()) {
    for (const v of arr) {
      assert.strictEqual(v, 0);
      assert.ok(Number.isFinite(v));
    }
  }
  for (const t of result.time) assert.ok(Number.isFinite(t));
}

test('A circuit with no ground reports the reason and stays flat', () => {
  const solver = new MNASolver();
  const result = solver.solveTransient([
    {
      id: 'FG1',
      type: 'function_generator',
      nodes: ['A', 'B'],
      value: 2,
      properties: { waveform: 'sine', frequency: 1000, amplitude: 2, enabled: true },
    },
    { id: 'R1', type: 'resistor', nodes: ['A', 'B'], value: 1000 },
  ], 0.001, 1e-5);
  assert.strictEqual(result.error, 'No ground connected');
  assertFlatFinite(result);
});

test('Two sources on the same nodes are reported as shorted', () => {
  const solver = new MNASolver();
  const result = solver.solveTransient([
    {
      id: 'FG1',
      type: 'function_generator',
      nodes: ['A', '0'],
      value: 2,
      properties: { waveform: 'sine', frequency: 1000, amplitude: 2, enabled: true },
    },
    {
      id: 'PS1',
      type: 'dc_supply',
      nodes: ['A', '0'],
      value: 5,
      properties: { voltage: 5, enabled: true },
    },
  ], 0.001, 1e-5);
  assert.strictEqual(result.error, 'Generator 1 and the DC supply are shorted');
  assertFlatFinite(result);
});

test('A node with no path to ground is floating and the result is finite', () => {
  const solver = new MNASolver();
  const result = solver.solveTransient([
    {
      id: 'FG1',
      type: 'function_generator',
      nodes: ['IN', '0'],
      value: 2,
      properties: { waveform: 'sine', frequency: 1000, amplitude: 2, enabled: true },
    },
    { id: 'Rfloat', type: 'resistor', nodes: ['X', 'Y'], value: 1000 },
  ], 0.001, 1e-5);
  assert.strictEqual(result.error, 'Nodes X, Y are floating');
  assertFlatFinite(result);
});

test('The bottom ground rail can be the reference without shorting the top rail', () => {
  const solver = new MNASolver();
  const alone = solver.solveTransient([
    {
      id: 'FG1',
      type: 'function_generator',
      nodes: ['IN', 'GND_BTM'],
      value: 2,
      properties: { waveform: 'sine', frequency: 1000, amplitude: 2, enabled: true },
    },
    { id: 'R1', type: 'resistor', nodes: ['IN', 'GND_BTM'], value: 1000 },
  ], 0.001, 2e-5);
  assert.strictEqual(alone.error, null);
  const peak = Math.max(...alone.nodeVoltages.get('IN'));
  assert.ok(Math.abs(peak - 2) < 0.05, `bottom-rail source should still be 2 V, got ${peak}`);

  // A supply that only touches the other rail must not be silently tied to this ground.
  const split = solver.solveTransient([
    {
      id: 'FG1',
      type: 'function_generator',
      nodes: ['IN', 'GND_BTM'],
      value: 2,
      properties: { waveform: 'sine', frequency: 1000, amplitude: 2, enabled: true },
    },
    { id: 'R1', type: 'resistor', nodes: ['IN', 'GND_BTM'], value: 1000 },
    {
      id: 'PS1',
      type: 'dc_supply',
      nodes: ['VCC', 'GND_TOP'],
      value: 5,
      properties: { voltage: 5, enabled: true },
    },
  ], 0.001, 2e-5);
  assert.match(split.error, /floating/);
  assertFlatFinite(split);
});

