/**
 * SimulationController.js - Orchestrates MNA Simulation via Web Worker & Synchronous Fallback
 */

import { MNASolver } from './MNASolver.js';

export class SimulationController {
  constructor(stateManager, instrumentsRegistry) {
    this.appState = stateManager;
    this.instruments = instrumentsRegistry;
    this.latestData = null;
    this.fallbackSolver = new MNASolver();
    this.isSimulating = false;

    this.initWorker();

    // Trigger simulation whenever circuit changes
    this.appState.subscribe(() => {
      this.triggerSim();
    });
  }

  initWorker() {
    try {
      this.worker = new Worker(new URL('./SimulationWorker.js', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e) => {
        const { success, time, sampleRate, nodeVoltages, error } = e.data;
        if (success || error) {
          this.latestData = { time, sampleRate, nodeVoltages, error: error || null };
        }
        this.isSimulating = false;
      };

      this.worker.onerror = (err) => {
        console.warn('Simulation Web Worker error, falling back to direct MNA solver:', err);
        this.worker = null;
      };
    } catch (err) {
      console.warn('Web Workers unavailable or file origin, running MNA solver synchronously:', err);
      this.worker = null;
    }
  }

  getLatestData() {
    return this.latestData;
  }

  triggerSim() {
    // 1. Build netlist from breadboard components + instrument voltage sources
    const netlist = this.extractNetlist();

    // Choose simulation window based on scope timebase or lowest frequency
    let tStop = 0.005; // 5 ms default
    let dt = 1e-6;     // 1 µs step

    if (this.instruments.oscilloscope) {
      const scopeTime = this.instruments.oscilloscope.timeDiv * 12;
      tStop = Math.max(0.001, Math.min(0.05, scopeTime));
      dt = Math.max(2e-7, Math.min(1e-5, tStop / 2000));
    }

    if (this.worker) {
      this.isSimulating = true;
      this.worker.postMessage({
        netlist,
        tStop,
        dt,
        messageId: Date.now(),
      });
    } else {
      // Synchronous execution fallback
      try {
        const res = this.fallbackSolver.solveTransient(netlist, tStop, dt);
        const nodeData = {};
        for (const [netName, arr] of res.nodeVoltages.entries()) {
          nodeData[netName] = arr;
        }
        this.latestData = {
          time: res.time,
          sampleRate: res.sampleRate,
          nodeVoltages: nodeData,
          error: res.error || null,
        };
      } catch (err) {
        console.error('MNA solver error:', err);
        this.latestData = {
          time: [],
          sampleRate: 1e6,
          nodeVoltages: {},
          error: `Solver exception: ${err.message}`,
        };
      }
    }
  }

  extractNetlist() {
    const netlist = [];
    const cg = this.appState.circuitGraph;

    // 1. Breadboard Components
    for (const comp of this.appState.components) {
      const pluggedPins = comp.pins.filter((p) => p.holeId);
      if (pluggedPins.length === 0) continue;

      const nodes = comp.pins.map((p) => (p.holeId ? cg.getNetForHole(p.holeId) : '0'));

      let val = comp.value;
      if (comp.type === 'potentiometer' || comp.type === 'rheostat') {
        const wiperPos = comp.properties?.wiperPos ?? 0.5;
        // Model pot as two resistors: R1-W and RW-2
        if (comp.pins.length >= 3 && comp.pins[0].holeId && comp.pins[1].holeId && comp.pins[2].holeId) {
          const r1w = Math.max(1.0, comp.value * wiperPos);
          const rw2 = Math.max(1.0, comp.value * (1.0 - wiperPos));
          netlist.push({
            id: `${comp.id}_R1W`,
            type: 'resistor',
            nodes: [nodes[0], nodes[1]],
            value: r1w,
          });
          netlist.push({
            id: `${comp.id}_RW2`,
            type: 'resistor',
            nodes: [nodes[1], nodes[2]],
            value: rw2,
          });
          continue;
        }
      }

      netlist.push({
        id: comp.id,
        type: comp.type,
        nodes,
        value: val,
        properties: comp.properties,
      });
    }

    // 2. Function Generators
    for (const fg of this.instruments.functionGenerators) {
      if (!fg.enabled) continue;
      const netOut = cg.getNetForHole(fg.terminals.out.id);
      const netGnd = cg.getNetForHole(fg.terminals.gnd.id);

      // Convert Vpp to Vp if in Vpp mode
      let amp = fg.amplitude;
      if (fg.ampMode === 'Vpp') {
        amp = fg.amplitude / 2.0;
      }

      netlist.push({
        id: fg.id,
        type: 'function_generator',
        nodes: [netOut, netGnd],
        value: amp,
        properties: {
          enabled: fg.enabled,
          waveform: fg.waveform,
          frequency: fg.frequency,
          amplitude: amp,
          offset: fg.offset,
          dutyCycle: fg.dutyCycle,
        },
      });
    }

    // 3. DC Power Supplies
    if (this.instruments.powerSupply && this.instruments.powerSupply.enabled) {
      const ps = this.instruments.powerSupply;
      const netPos = cg.getNetForHole(ps.terminals.pos.id);
      const netGnd = cg.getNetForHole(ps.terminals.gnd.id);

      netlist.push({
        id: ps.id,
        type: 'dc_supply',
        nodes: [netPos, netGnd],
        value: ps.voltage,
        properties: {
          enabled: ps.enabled,
          voltage: ps.voltage,
        },
      });
    }

    return netlist;
  }
}

