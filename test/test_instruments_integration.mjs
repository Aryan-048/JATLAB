/**
 * test_instruments_integration.mjs - Integration test for Instruments & Breadboard Wiring
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
import { SimulationController } from '../src/simulation/SimulationController.js';

test('End-to-End Instrument Wiring & RC Low-Pass Measurement', () => {
  const bb = new BreadboardModel();
  const state = new StateManager(bb);

  const instruments = {
    functionGenerators: [createDefaultFunctionGen('FG1', 'Function Generator 1')],
    powerSupply: createDefaultPowerSupply('PS1', 'DC Power Supply'),
    oscilloscope: createDefaultOscilloscope('OSC1', 'Dual-Channel Oscilloscope'),
  };

  const sim = new SimulationController(state, instruments);

  // 1. Configure FG1: 1 kHz Sine, 2 Vp
  const fg = instruments.functionGenerators[0];
  fg.enabled = true;
  fg.waveform = 'sine';
  fg.frequency = 1000.0;
  fg.amplitude = 2.0;

  // 2. Place Resistor R1 = 1 kΩ (pins at 10-C and 14-C)
  state.startPlacement('resistor', { value: 1000, label: 'R1' });
  state.commitPendingPlacement('10-C');

  // 3. Place Capacitor C1 = 0.1 µF (pins at 14-D and 16-D)
  state.startPlacement('capacitor', { value: 0.1e-6, label: 'C1' });
  state.commitPendingPlacement('14-D');

  // 4. Wire instruments to free holes in the same strips.
  // Component leads already occupy 10-C, 14-C, 14-D and 16-D.
  state.addWire('FG1_OUT', '10-A');
  state.addWire('FG1_GND', 'BN-10');
  state.addWire('16-A', 'BN-16');
  state.addWire('OSC_CH1', '10-B');
  state.addWire('OSC_CH1_GND', 'BN-12');
  state.addWire('OSC_CH2', '14-E');
  state.addWire('OSC_CH2_GND', 'BN-14');

  // 5. Verify graph unions
  const netIn = state.circuitGraph.getNetForHole('10-C');
  const netFgOut = state.circuitGraph.getNetForHole('FG1_OUT');
  const netOscCh1 = state.circuitGraph.getNetForHole('OSC_CH1');
  assert.strictEqual(netIn, netFgOut, 'FG1_OUT must share electrical net with 10-C');
  assert.strictEqual(netIn, netOscCh1, 'OSC_CH1 must probe the input net at 10-C');

  const netMid = state.circuitGraph.getNetForHole('14-C');
  const netCap1 = state.circuitGraph.getNetForHole('14-D');
  const netOscCh2 = state.circuitGraph.getNetForHole('OSC_CH2');
  assert.strictEqual(netMid, netCap1, '14-C and 14-D must share tie strip at row 14');
  assert.strictEqual(netMid, netOscCh2, 'OSC_CH2 must probe across capacitor at row 14');

  // 6. Run simulation via controller
  sim.triggerSim();
  const simData = sim.getLatestData();
  assert.ok(simData, 'Simulation output must be generated');

  const vCh1 = simData.nodeVoltages[netOscCh1];
  const vCh2 = simData.nodeVoltages[netOscCh2];
  assert.ok(vCh1 && vCh1.length > 0, 'CH1 waveform must have data points');
  assert.ok(vCh2 && vCh2.length > 0, 'CH2 waveform must have data points');

  const maxCh1 = Math.max(...vCh1.slice(vCh1.length - 1000));
  const maxCh2 = Math.max(...vCh2.slice(vCh2.length - 1000));

  console.log(`Instrument Probe CH1 Peak: ${maxCh1.toFixed(3)} V (Target ~2.00 V)`);
  console.log(`Instrument Probe CH2 Peak: ${maxCh2.toFixed(3)} V (Target ~1.69 V)`);

  assert.ok(Math.abs(maxCh1 - 2.0) < 0.05, `CH1 peak must be ~2.0 V, got ${maxCh1}`);
  assert.ok(Math.abs(maxCh2 - 1.693) < 0.05, `CH2 peak must be ~1.69 V, got ${maxCh2}`);
});

