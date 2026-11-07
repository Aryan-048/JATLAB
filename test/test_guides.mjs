/**
 * Each preset lab builds without stacked leads and passes the circuit checker.
 */

import test from 'node:test';
import assert from 'node:assert';
import { BreadboardModel } from '../src/core/BreadboardModel.js';
import { StateManager } from '../src/ui/StateManager.js';
import {
  createDefaultFunctionGen,
  createDefaultPowerSupply,
  createDefaultOscilloscope,
} from '../src/instruments/InstrumentModel.js';
import { analyzeCircuit } from '../src/ui/labCheck.js';
import { LAB_PRESETS, applyLabInstruments, buildLabPreset } from '../src/guides/labPresets.js';
import { wireColor } from '../src/core/WireModel.js';

function instruments() {
  return {
    functionGenerators: [
      createDefaultFunctionGen('FG1', 'Generator 1'),
      createDefaultFunctionGen('FG2', 'Generator 2'),
    ],
    powerSupply: createDefaultPowerSupply(),
    oscilloscope: createDefaultOscilloscope(),
  };
}

for (const labId of Object.keys(LAB_PRESETS)) {
  test(`${LAB_PRESETS[labId].name} loads and matches the reference`, () => {
    const state = new StateManager(new BreadboardModel());
    const inst = instruments();
    buildLabPreset(state, labId);
    applyLabInstruments(inst, labId);

    const colors = new Set(state.wires.map((wire) => wire.color));
    assert.ok(colors.size >= 3, `${labId} uses only ${[...colors].join(', ')}`);
    const grounds = state.wires.filter((wire) => /GND|BN-/.test(`${wire.fromHoleId} ${wire.toHoleId}`));
    assert.ok(grounds.every((wire) => wire.color === wireColor(wire.fromHoleId, wire.toHoleId, 'ground')), 'a ground wire is not black');

    const holes = state.components.flatMap((comp) => comp.pins.map((pin) => pin.holeId)).filter(Boolean);
    assert.strictEqual(new Set(holes).size, holes.length, 'a lead shares a hole');

    const issues = analyzeCircuit({
      components: state.components,
      wires: state.wires,
      circuitGraph: state.circuitGraph,
      breadboard: state.bb,
      instruments: inst,
      labId,
      simData: null,
    });
    const problems = issues.filter((item) => item.severity === 'error' || item.severity === 'warn');
    assert.deepStrictEqual(
      problems.map((item) => item.title),
      [],
      problems.map((item) => item.title).join(' | ')
    );
  });
}
