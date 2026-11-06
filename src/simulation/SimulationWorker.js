/**
 * SimulationWorker.js - Background Web Worker for continuous MNA transient simulation
 */

import { MNASolver } from './MNASolver.js';

const solver = new MNASolver();

self.onmessage = function (e) {
  const { netlist, tStop = 0.005, dt = 1e-6, messageId } = e.data;

  try {
    const result = solver.solveTransient(netlist, tStop, dt);

    // Convert Map of Float arrays to transferable objects
    const nodeData = {};
    for (const [netName, arr] of result.nodeVoltages.entries()) {
      nodeData[netName] = arr;
    }

    self.postMessage({
      success: !result.error,
      messageId,
      time: result.time,
      sampleRate: result.sampleRate,
      nodeVoltages: nodeData,
      error: result.error || null,
    });
  } catch (err) {
    self.postMessage({
      success: false,
      messageId,
      error: err.message || 'Simulation error',
    });
  }
};

