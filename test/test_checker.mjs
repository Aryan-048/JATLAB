/**
 * Circuit checker: lab 1A wiring, wrong value, reversed diode, and Fix-it data.
 */

import test from 'node:test';
import assert from 'node:assert';
import { BreadboardModel } from '../src/core/BreadboardModel.js';
import { StateManager } from '../src/ui/StateManager.js';
import { createComponent } from '../src/core/ComponentModel.js';
import {
  createDefaultFunctionGen,
  createDefaultPowerSupply,
  createDefaultOscilloscope,
} from '../src/instruments/InstrumentModel.js';
import { analyzeCircuit } from '../src/ui/labCheck.js';

function instruments() {
  const fg1 = createDefaultFunctionGen('FG1', 'Generator 1');
  const fg2 = createDefaultFunctionGen('FG2', 'Generator 2');
  fg1.frequency = 100;
  fg1.unit = 'Hz';
  fg1.waveform = 'sine';
  fg1.amplitude = 2;
  fg1.ampMode = 'Vp';
  const osc = createDefaultOscilloscope();
  osc.timeDiv = 0.002;
  return {
    functionGenerators: [fg1, fg2],
    powerSupply: createDefaultPowerSupply(),
    oscilloscope: osc,
  };
}

function place(state, type, hole, props = {}) {
  state.startPlacement(type, props);
  const ok = state.commitPendingPlacement(hole);
  assert.strictEqual(ok, true, `${type} at ${hole}`);
  return state.components[state.components.length - 1];
}

function buildAm(state) {
  place(state, 'resistor', '8-B', { value: 1000, label: 'R1' });
  place(state, 'resistor', '20-B', { value: 1000, label: 'R2' });
  place(state, 'diode_1n4007', '12-D', { label: 'D1' });
  place(state, 'inductor', '15-A', { value: 0.004, label: 'L1' });
  place(state, 'capacitor', '15-E', { value: 0.1e-6, label: 'C1' });
  assert.ok(state.addWire('12-A', '24-A'));
  assert.ok(state.addWire('FG1_OUT', '8-A'));
  assert.ok(state.addWire('FG1_GND', 'BN-8'));
  assert.ok(state.addWire('FG2_OUT', '20-D'));
  assert.ok(state.addWire('FG2_GND', 'BN-20'));
  assert.ok(state.addWire('18-C', 'BN-18'));
  assert.ok(state.addWire('17-B', 'BN-17'));
  assert.ok(state.addWire('OSC_CH1', '15-B'));
  assert.ok(state.addWire('OSC_CH1_GND', 'BN-12'));
}

function check(state, inst, labId) {
  return analyzeCircuit({
    components: state.components,
    wires: state.wires,
    circuitGraph: state.circuitGraph,
    breadboard: state.bb,
    instruments: inst,
    labId,
    simData: null,
  });
}

function titles(issues) {
  return issues.map((item) => item.title);
}

test('An empty board still produces a result', () => {
  const state = new StateManager(new BreadboardModel());
  const issues = check(state, instruments(), null);
  assert.strictEqual(issues.length, 1);
  assert.match(issues[0].title, /Empty breadboard/);
});

test('A complete Lab 1A has no errors', () => {
  const state = new StateManager(new BreadboardModel());
  const inst = instruments();
  buildAm(state);
  const issues = check(state, inst, 'lab1a');
  const errors = issues.filter((item) => item.severity === 'error');
  assert.deepStrictEqual(titles(errors), [], titles(issues).join(' | '));
});

test('A 10 kΩ message resistor is reported as the wrong value and can be fixed', () => {
  const state = new StateManager(new BreadboardModel());
  const inst = instruments();
  buildAm(state);
  const r1 = state.components.find((c) => c.label === 'R1');
  state.setComponentValue(r1.id, 10000);
  const issues = check(state, inst, 'lab1a');
  const wrong = issues.find((item) => item.title.startsWith('Wrong value:'));
  assert.ok(wrong, titles(issues).join(' | '));
  assert.match(wrong.title, /10 kΩ/);
  assert.match(wrong.title, /1 kΩ/);
  assert.strictEqual(wrong.action.kind, 'value');
  assert.strictEqual(wrong.action.value, 1000);

  state.setComponentValue(wrong.action.componentId, wrong.action.value);
  const again = check(state, inst, 'lab1a').filter((item) => item.severity === 'error');
  assert.deepStrictEqual(titles(again), [], titles(again).join(' | '));
});

test('A missing anode wire is named and offers a wire to add', () => {
  const state = new StateManager(new BreadboardModel());
  const inst = instruments();
  buildAm(state);
  const join = state.wires.find((w) => w.fromHoleId === '12-A' || w.toHoleId === '12-A');
  state.removeWire(join.id);
  const issues = check(state, inst, 'lab1a');
  const missing = issues.find((item) => item.title.startsWith('Missing:') && /R2/.test(item.title));
  assert.ok(missing, titles(issues).join(' | '));
  assert.strictEqual(missing.action.kind, 'wire');
  assert.ok(missing.holeIds.length > 0);
});

test('A reversed diode is detected, and swapping the leads clears it', () => {
  const state = new StateManager(new BreadboardModel());
  const inst = instruments();
  buildAm(state);
  const diode = state.components.find((c) => c.type === 'diode_1n4007');
  assert.strictEqual(state.swapPins(diode.id, 'anode', 'cathode'), true);
  const issues = check(state, inst, 'lab1a');
  const reversed = issues.find((item) => item.title === 'Diode is reversed');
  assert.ok(reversed, titles(issues).join(' | '));
  assert.strictEqual(reversed.action.kind, 'swapPins');
  state.swapPins(reversed.action.componentId, reversed.action.pinA, reversed.action.pinB);
  const again = check(state, inst, 'lab1a');
  assert.ok(!again.some((item) => item.title === 'Diode is reversed'));
});

test('Generator 2 off uses the envelope sentence', () => {
  const state = new StateManager(new BreadboardModel());
  const inst = instruments();
  buildAm(state);
  inst.functionGenerators[1].enabled = false;
  const issues = check(state, inst, 'lab1a');
  const off = issues.find((item) => item.title.includes('Generator 2 is OFF'));
  assert.ok(off, titles(issues).join(' | '));
  assert.strictEqual(off.action.kind, 'enable');
});

test('A 555 sitting on one side of the gap is reported', () => {
  const state = new StateManager(new BreadboardModel());
  const ic = createComponent('ic_555', { label: 'U1' });
  ic.pins.forEach((pin, index) => {
    pin.holeId = `${20 + (index % 4)}-C`;
  });
  state.components.push(ic);
  const issues = check(state, instruments(), null);
  assert.ok(issues.some((item) => item.title === '555 is not straddling the centre gap'), titles(issues).join(' | '));
});
