/**
 * MNASolver.js - Real Modified Nodal Analysis (MNA) Engine (ES Module)
 * Part 3: gmin, NaN/Infinity guard, Newton-Raphson damping, structured error return
 */

export class MNASolver {
  constructor() {
    this.nodeMap = new Map();
    this.numNodes = 0;
    this.Vt = 0.02585; // 26 mV thermal voltage
    this.GMIN = 1e-12; // Minimum conductance stamp to prevent singular matrices
  }

  /**
   * Run transient MNA simulation.
   * Returns { time, nodeVoltages, sampleRate, error? }
   * nodeVoltages is a Map<string, number[]>.
   * If `error` is set, all node arrays contain zeros (flatline).
   */
  solveTransient(components, tStop = 0.005, dt = 1e-6) {
    // An enabled supply whose posts touch nothing else is not part of the circuit.
    components = this._dropUnconnectedSources(components || []);

    // ── Pre-flight validation ────────────────────────────────────────────
    const preflightError = this._preflightCheck(components);
    if (preflightError) {
      const numSteps = Math.min(Math.floor(tStop / dt), 10000);
      const time = Array.from({ length: numSteps }, (_, i) => i * dt);
      const names = new Set(['0']);
      for (const comp of components) {
        for (const node of comp.nodes || []) {
          if (node) names.add(node);
        }
      }
      const nodeVoltages = new Map();
      for (const name of names) nodeVoltages.set(name, new Array(numSteps).fill(0));
      return { time, nodeVoltages, sampleRate: 1 / dt, error: preflightError };
    }

    this.buildNodeMap(components);

    const N = this.numNodes;
    const vSources = components.filter(
      (c) =>
        c.type === 'vsource' ||
        c.type === 'function_generator' ||
        c.type === 'dc_supply' ||
        c.type === 'vcc_terminal'
    );
    const M = vSources.length;
    const matrixSize = N + M;

    const capStates = new Map();
    const indStates = new Map();

    let ne555_flipflop = false;
    let vco_cap_voltage = 0.0;
    let vco_charging = true;

    const numSteps = Math.min(Math.floor(tStop / dt), 10000);
    const timeArray = new Array(numSteps);
    const nodeVoltageArrays = new Map();

    for (const [netName] of this.nodeMap.entries()) {
      nodeVoltageArrays.set(netName, new Array(numSteps).fill(0));
    }

    let vPrev = new Array(matrixSize).fill(0);
    let simError = null;

    for (let step = 0; step < numSteps; step++) {
      const t = step * dt;
      timeArray[step] = t;

      let xSol = [...vPrev];
      const maxIter = 30;
      let converged = false;

      for (let iter = 0; iter < maxIter; iter++) {
        const A = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(0));
        const b = new Array(matrixSize).fill(0);

        // gmin stamp on every node (Part 3: prevents singular matrix)
        for (let i = 0; i < N; i++) {
          A[i][i] += this.GMIN;
        }

        let vSrcIdx = 0;

        for (const comp of components) {
          const n1 = this.getNodeIndex(comp.nodes[0]);
          const n2 = this.getNodeIndex(comp.nodes[1]);

          switch (comp.type) {
            case 'resistor':
            case 'potentiometer':
            case 'rheostat': {
              const R = Math.max(comp.value, 1e-4);
              const G = 1.0 / R;
              this.stampConductance(A, n1, n2, G);
              break;
            }

            case 'capacitor': {
              const C = comp.value;
              const G = (2 * C) / dt;
              this.stampConductance(A, n1, n2, G);

              const state = capStates.get(comp.id) || { vPrev: 0, iPrev: 0 };
              const I_eq = -G * state.vPrev - state.iPrev;
              this.stampCurrentSource(b, n1, n2, I_eq);
              break;
            }

            case 'inductor': {
              const L = comp.value;
              const G = dt / (2 * L);
              this.stampConductance(A, n1, n2, G);

              const state = indStates.get(comp.id) || { iPrev: 0, vPrev: 0 };
              const I_eq = state.iPrev + G * state.vPrev;
              this.stampCurrentSource(b, n1, n2, -I_eq);
              break;
            }

            case 'diode_1n4007':
            case 'diode_oa79': {
              const isGe = comp.type === 'diode_oa79';
              const Is = isGe ? 1e-6 : 1e-11;
              const n = isGe ? 1.1 : 1.5;
              const nVt = n * this.Vt;

              const vAnode = n1 > 0 ? xSol[n1 - 1] : 0;
              const vCathode = n2 > 0 ? xSol[n2 - 1] : 0;
              // Part 3: Clamp Vd to prevent exp() overflow
              let Vd = Math.max(-10, Math.min(1.2, vAnode - vCathode));

              const expVal = Math.exp(Math.min(40, Vd / nVt));
              const Id = Is * (expVal - 1);
              const gd = Math.max(this.GMIN, (Is / nVt) * expVal);
              const Ieq = Id - gd * Vd;

              this.stampConductance(A, n1, n2, gd);
              this.stampCurrentSource(b, n1, n2, Ieq);
              break;
            }

            case 'transistor_bc107':
            case 'transistor_2n2222': {
              const nE = this.getNodeIndex(comp.nodes[0]);
              const nB = this.getNodeIndex(comp.nodes[1]);
              const nC = this.getNodeIndex(comp.nodes[2]);

              const vE = nE > 0 ? xSol[nE - 1] : 0;
              const vB = nB > 0 ? xSol[nB - 1] : 0;
              const vC = nC > 0 ? xSol[nC - 1] : 0;

              const Vbe = Math.max(-5, Math.min(0.9, vB - vE));
              const Is = 1e-14;
              const nVt = 1.0 * this.Vt;
              const expBe = Math.exp(Math.min(40, Vbe / nVt));
              const Ibe = Is * (expBe - 1);
              const gbe = Math.max(this.GMIN, (Is / nVt) * expBe);
              const Ibe_eq = Ibe - gbe * Vbe;

              this.stampConductance(A, nB, nE, gbe);
              this.stampCurrentSource(b, nB, nE, Ibe_eq);

              const beta = comp.value || 100;
              const Ic = Math.max(0, beta * Ibe);
              this.stampCurrentSource(b, nC, nE, Ic);
              break;
            }

            case 'ic_555': {
              const nGnd = this.getNodeIndex(comp.nodes[0]);
              const nTrig = this.getNodeIndex(comp.nodes[1]);
              const nOut = this.getNodeIndex(comp.nodes[2]);
              const nReset = this.getNodeIndex(comp.nodes[3]);
              const nCont = this.getNodeIndex(comp.nodes[4]);
              const nThresh = this.getNodeIndex(comp.nodes[5]);
              const nDisch = this.getNodeIndex(comp.nodes[6]);
              const nVcc = this.getNodeIndex(comp.nodes[7]);

              const vVcc = nVcc > 0 ? xSol[nVcc - 1] : 15;
              const vCont = nCont > 0 ? xSol[nCont - 1] : (2 / 3) * vVcc;
              const vThreshRef = Math.max(0.5, vCont);
              const vTrigRef = vThreshRef / 2;

              const vTrig = nTrig > 0 ? xSol[nTrig - 1] : 0;
              const vThresh = nThresh > 0 ? xSol[nThresh - 1] : 0;
              const vReset = nReset > 0 ? xSol[nReset - 1] : vVcc;

              if (vReset < 0.7) {
                ne555_flipflop = true;
              } else if (vTrig < vTrigRef) {
                ne555_flipflop = false;
              } else if (vThresh > vThreshRef) {
                ne555_flipflop = true;
              }

              const vTargetOut = ne555_flipflop ? 0.2 : vVcc - 1.4;
              const gOut = 1.0 / 20.0;
              this.stampConductance(A, nOut, nGnd, gOut);
              const Iout = gOut * vTargetOut;
              this.stampCurrentSource(b, nOut, nGnd, -Iout);

              if (ne555_flipflop) {
                this.stampConductance(A, nDisch, nGnd, 0.1);
              }
              break;
            }

            case 'ic_8038': {
              const nSine = this.getNodeIndex(comp.nodes[1]);
              const nVcc = this.getNodeIndex(comp.nodes[5]);
              const nMod = this.getNodeIndex(comp.nodes[7]);
              const nCap = this.getNodeIndex(comp.nodes[9]);
              const nGnd = this.getNodeIndex(comp.nodes[10]);

              const vVcc = nVcc > 0 ? xSol[nVcc - 1] : 18;
              const vMod = nMod > 0 ? xSol[nMod - 1] : vVcc;

              const deltaV = Math.max(0.1, vVcc - vMod);
              const freqNominal = 4000.0 * (deltaV / (vVcc * 0.2 + 0.1));
              const currentI = Math.max(1e-6, freqNominal * 0.01e-6 * 2.0);

              if (vco_charging) {
                vco_cap_voltage += (currentI / 0.01e-6) * dt;
                if (vco_cap_voltage >= (2 / 3) * vVcc) {
                  vco_charging = false;
                }
              } else {
                vco_cap_voltage -= (currentI / 0.01e-6) * dt;
                if (vco_cap_voltage <= (1 / 3) * vVcc) {
                  vco_charging = true;
                }
              }

              const triNorm = (vco_cap_voltage - 0.5 * vVcc) / (0.17 * vVcc);
              const sineVal = Math.sin(triNorm * Math.PI * 0.5);
              const vSineTarget = 0.5 * vVcc + 2.5 * sineVal;

              const gSine = 1.0 / 50.0;
              this.stampConductance(A, nSine, nGnd, gSine);
              this.stampCurrentSource(b, nSine, nGnd, -gSine * vSineTarget);
              break;
            }

            case 'vsource':
            case 'function_generator':
            case 'dc_supply':
            case 'vcc_terminal': {
              const row = N + vSrcIdx;
              const vVal = this.getVoltageSourceValue(comp, t);

              if (n1 > 0) {
                A[n1 - 1][row] += 1;
                A[row][n1 - 1] += 1;
              }
              if (n2 > 0) {
                A[n2 - 1][row] -= 1;
                A[row][n2 - 1] -= 1;
              }
              b[row] = vVal;
              vSrcIdx++;
              break;
            }
          }
        }

        let xNew;
        try {
          xNew = this.solveLinearSystem(A, b);
        } catch (err) {
          simError = `Matrix solve failed: ${err.message}`;
          xNew = new Array(matrixSize).fill(0);
        }

        if (simError) break;

        // Part 3: NaN / Infinity guard after solve
        for (let i = 0; i < matrixSize; i++) {
          if (!isFinite(xNew[i])) {
            simError = `Simulation diverged at t=${(t * 1000).toFixed(3)} ms (node ${i + 1} = ${xNew[i]}). Check for floating nodes or short circuits.`;
            xNew = new Array(matrixSize).fill(0);
            break;
          }
        }
        if (simError) break;

        // Part 3: Newton-Raphson step damping — clamp voltage updates to ±1V per iteration
        let maxDiff = 0;
        for (let i = 0; i < N; i++) {
          const delta = xNew[i] - xSol[i];
          const dampedDelta = Math.max(-1.0, Math.min(1.0, delta));
          xNew[i] = xSol[i] + dampedDelta;
          maxDiff = Math.max(maxDiff, Math.abs(dampedDelta));
        }

        xSol = xNew;
        if (maxDiff < 1e-4) {
          converged = true;
          break;
        }
      }

      if (!simError && !converged) {
        simError = `Newton-Raphson did not converge at t=${(t * 1000).toFixed(3)} ms.`;
      }

      if (simError) break;

      // Store node voltages for this timestep
      for (const [netName, idx] of this.nodeMap.entries()) {
        const vNode = idx > 0 ? (isFinite(xSol[idx - 1]) ? xSol[idx - 1] : 0) : 0.0;
        nodeVoltageArrays.get(netName)[step] = vNode;
      }

      // Update capacitor and inductor state
      for (const comp of components) {
        const n1 = this.getNodeIndex(comp.nodes[0]);
        const n2 = this.getNodeIndex(comp.nodes[1]);
        const v1 = n1 > 0 ? xSol[n1 - 1] : 0;
        const v2 = n2 > 0 ? xSol[n2 - 1] : 0;
        const vBranch = v1 - v2;

        if (comp.type === 'capacitor') {
          const C = comp.value;
          const G = (2 * C) / dt;
          const state = capStates.get(comp.id) || { vPrev: 0, iPrev: 0 };
          const iCurr = G * (vBranch - state.vPrev) - state.iPrev;
          capStates.set(comp.id, { vPrev: vBranch, iPrev: iCurr });
        } else if (comp.type === 'inductor') {
          const L = comp.value;
          const G = dt / (2 * L);
          const state = indStates.get(comp.id) || { iPrev: 0, vPrev: 0 };
          const iCurr = state.iPrev + G * (vBranch + state.vPrev);
          indStates.set(comp.id, { iPrev: iCurr, vPrev: vBranch });
        }
      }

      vPrev = xSol;
    }

    for (const arr of nodeVoltageArrays.values()) {
      for (let i = 0; i < arr.length; i++) {
        if (!Number.isFinite(arr[i])) {
          simError = simError || 'Solver returned a non-finite voltage.';
          break;
        }
      }
    }

    // A failed solve is a flat line. Never leave Infinity or NaN in the buffers.
    if (simError) {
      for (let i = 0; i < numSteps; i++) {
        if (timeArray[i] == null) timeArray[i] = i * dt;
      }
      for (const arr of nodeVoltageArrays.values()) {
        arr.fill(0);
      }
    }

    return {
      time: timeArray,
      nodeVoltages: nodeVoltageArrays,
      sampleRate: 1.0 / dt,
      error: simError || null,
    };
  }

  // ── Pre-flight checks ────────────────────────────────────────────────────

  _preflightCheck(components) {
    // Check 1: No components at all
    if (!components || components.length === 0) {
      return 'No components in circuit. Place components and connect them.';
    }

    // Check 2: At least one voltage source
    const hasSrc = components.some(
      (c) =>
        c.type === 'vsource' ||
        c.type === 'function_generator' ||
        c.type === 'dc_supply' ||
        c.type === 'vcc_terminal'
    );
    if (!hasSrc) {
      return 'No voltage source connected. Connect a Function Generator or DC Power Supply.';
    }

    this.buildNodeMap(components);
    if (!this.referenceNet) {
      return 'No ground connected';
    }
    if (this.numNodes === 0 && components.every((c) => this._isVoltageSource(c))) {
      return 'Circuit has no nodes. All components appear disconnected.';
    }

    const loopError = this._voltageSourceLoopError(components);
    if (loopError) return loopError;

    const floatingError = this._floatingNodeError(components);
    if (floatingError) return floatingError;

    return null;
  }

  _voltageSourceLoopError(components) {
    const sources = components.filter((c) => this._isVoltageSource(c) && c.nodes && c.nodes.length >= 2);
    const edges = [];
    for (const src of sources) {
      const a = this.getNodeIndex(src.nodes[0]);
      const b = this.getNodeIndex(src.nodes[1]);
      if (a === b) return `${this._sourceLabel(src)} is shorted`;
      edges.push({ a, b, src });
    }

    const seenPair = new Map();
    for (const edge of edges) {
      const key = edge.a < edge.b ? `${edge.a}|${edge.b}` : `${edge.b}|${edge.a}`;
      if (seenPair.has(key)) {
        return this._shortedMessage(seenPair.get(key), edge.src);
      }
      seenPair.set(key, edge.src);
    }

    const adj = new Map();
    edges.forEach((edge, index) => {
      if (!adj.has(edge.a)) adj.set(edge.a, []);
      if (!adj.has(edge.b)) adj.set(edge.b, []);
      adj.get(edge.a).push({ to: edge.b, edge: index });
      adj.get(edge.b).push({ to: edge.a, edge: index });
    });

    const visited = new Set();
    for (const start of adj.keys()) {
      if (visited.has(start)) continue;
      const stack = [{ node: start, prevEdge: -1 }];
      const parent = new Map([[start, -1]]);
      while (stack.length) {
        const { node, prevEdge } = stack.pop();
        if (visited.has(node)) continue;
        visited.add(node);
        for (const next of adj.get(node) || []) {
          if (next.edge === prevEdge) continue;
          if (parent.has(next.to)) {
            const involved = new Set([edges[next.edge].src]);
            let cursor = node;
            while (cursor !== next.to && cursor != null) {
              const edgeIndex = parent.get(cursor);
              if (edgeIndex == null || edgeIndex < 0) break;
              involved.add(edges[edgeIndex].src);
              cursor = edges[edgeIndex].a === cursor ? edges[edgeIndex].b : edges[edgeIndex].a;
            }
            const labels = [...involved].map((src) => this._sourceLabel(src));
            if (labels.length === 2) return `${labels[0]} and ${labels[1]} are shorted`;
            return `Voltage sources ${labels.join(', ')} are shorted`;
          }
          parent.set(next.to, next.edge);
          stack.push({ node: next.to, prevEdge: next.edge });
        }
      }
    }
    return null;
  }

  _floatingNodeError(components) {
    const adj = new Map();
    const link = (a, b) => {
      if (a === b) return;
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b);
      adj.get(b).push(a);
    };

    for (const comp of components) {
      const idxs = (comp.nodes || []).map((node) => this.getNodeIndex(node));
      for (let i = 0; i < idxs.length; i++) {
        for (let j = i + 1; j < idxs.length; j++) {
          link(idxs[i], idxs[j]);
        }
      }
    }

    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const node = queue.pop();
      for (const next of adj.get(node) || []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }

    const floating = [];
    const reported = new Set();
    for (const [name, idx] of this.nodeMap.entries()) {
      if (idx === 0 || seen.has(idx) || reported.has(idx)) continue;
      reported.add(idx);
      floating.push(name);
    }
    if (floating.length === 0) return null;
    if (floating.length === 1) return `Node ${floating[0]} is floating`;
    return `Nodes ${floating.join(', ')} are floating`;
  }

  getVoltageSourceValue(comp, t) {
    if (!comp.properties || comp.properties.enabled === false) {
      return 0.0;
    }

    if (comp.type === 'dc_supply' || comp.type === 'vcc_terminal') {
      return comp.properties.voltage ?? comp.value ?? 5.0;
    }

    const waveform = comp.properties.waveform || 'sine';
    const freq = comp.properties.frequency || 1000.0;
    const amp = comp.properties.amplitude || 2.0;
    const offset = comp.properties.offset || 0.0;
    const duty = comp.properties.dutyCycle || 0.5;

    const phase = (2 * Math.PI * freq * t) % (2 * Math.PI);

    switch (waveform) {
      case 'sine':
        return offset + amp * Math.sin(phase);

      case 'square':
        return offset + (phase < 2 * Math.PI * duty ? amp : -amp);

      case 'pulse':
        return offset + (phase < 2 * Math.PI * duty ? amp : 0.0);

      case 'triangle': {
        const norm = phase / (2 * Math.PI);
        const tri = norm < 0.5 ? 4 * norm - 1 : 3 - 4 * norm;
        return offset + amp * tri;
      }

      default:
        return offset + amp * Math.sin(phase);
    }
  }

  buildNodeMap(components) {
    this.nodeMap.clear();
    this.nodeMap.set('0', 0);

    const present = new Set();
    for (const comp of components) {
      for (const node of comp.nodes || []) {
        if (node) present.add(node);
      }
    }

    const railNames = ['GND', 'GND_TOP', 'GND_BTM', 'RAIL_TOP_NEG', 'RAIL_BTM_NEG'];
    const railsUsed = railNames.filter((name) => present.has(name));
    const symbolGrounds = [];
    for (const comp of components) {
      if (comp.type === 'gnd_terminal' && comp.nodes && comp.nodes[0]) {
        symbolGrounds.push(comp.nodes[0]);
      }
    }

    let reference = null;
    if (present.has('0')) {
      reference = '0';
    } else if (symbolGrounds.length > 0) {
      reference = symbolGrounds[0];
    } else if (railsUsed.length === 1) {
      reference = railsUsed[0];
    } else if (railsUsed.length > 1) {
      const sources = components.filter((c) => this._isVoltageSource(c));
      for (const src of sources) {
        const neg = src.nodes && src.nodes[1];
        if (railsUsed.includes(neg)) {
          reference = neg;
          break;
        }
      }
      if (!reference) reference = railsUsed[0];
    }

    this.referenceNet = reference;
    if (reference) this.nodeMap.set(reference, 0);

    let nextIdx = 1;
    for (const comp of components) {
      for (const node of comp.nodes || []) {
        if (!node || this.nodeMap.has(node)) continue;
        this.nodeMap.set(node, nextIdx++);
      }
    }
    this.numNodes = nextIdx - 1;
  }

  _dropUnconnectedSources(components) {
    const usedByParts = new Set();
    const groundNames = new Set(['0', 'GND', 'GND_TOP', 'GND_BTM', 'RAIL_TOP_NEG', 'RAIL_BTM_NEG']);
    for (const comp of components) {
      if (this._isVoltageSource(comp)) continue;
      for (const node of comp.nodes || []) usedByParts.add(node);
    }
    return components.filter((comp) => {
      if (!this._isVoltageSource(comp)) return true;
      return (comp.nodes || []).some((node) => usedByParts.has(node) || groundNames.has(node));
    });
  }

  _isVoltageSource(comp) {
    return (
      comp.type === 'vsource' ||
      comp.type === 'function_generator' ||
      comp.type === 'dc_supply' ||
      comp.type === 'vcc_terminal'
    );
  }

  _sourceLabel(comp) {
    if (comp.type === 'dc_supply' || comp.type === 'vcc_terminal') return 'the DC supply';
    if (comp.type === 'function_generator') {
      const match = String(comp.id || '').match(/(\d+)/);
      return match ? `Generator ${match[1]}` : 'the generator';
    }
    return comp.id || 'a voltage source';
  }

  _shortedMessage(a, b) {
    const labels = [this._sourceLabel(a), this._sourceLabel(b)];
    labels.sort((x, y) => (x.startsWith('Generator') ? 0 : 1) - (y.startsWith('Generator') ? 0 : 1));
    return `${labels[0]} and ${labels[1]} are shorted`;
  }

  _nodeName(index) {
    for (const [name, idx] of this.nodeMap.entries()) {
      if (idx === index && name !== '0') return name;
    }
    return index === 0 ? '0' : String(index);
  }

  getNodeIndex(netName) {
    if (!netName) return 0;
    return this.nodeMap.get(netName) || 0;
  }

  stampConductance(A, n1, n2, G) {
    if (n1 > 0) A[n1 - 1][n1 - 1] += G;
    if (n2 > 0) A[n2 - 1][n2 - 1] += G;
    if (n1 > 0 && n2 > 0) {
      A[n1 - 1][n2 - 1] -= G;
      A[n2 - 1][n1 - 1] -= G;
    }
  }

  stampCurrentSource(b, n1, n2, I) {
    if (n1 > 0) b[n1 - 1] -= I;
    if (n2 > 0) b[n2 - 1] += I;
  }

  solveLinearSystem(A, b) {
    const n = b.length;
    const M = A.map((row) => [...row]);
    const x = [...b];

    for (let p = 0; p < n; p++) {
      let maxRow = p;
      let maxVal = Math.abs(M[p][p]);
      for (let r = p + 1; r < n; r++) {
        if (Math.abs(M[r][p]) > maxVal) {
          maxVal = Math.abs(M[r][p]);
          maxRow = r;
        }
      }

      if (maxRow !== p) {
        [M[p], M[maxRow]] = [M[maxRow], M[p]];
        [x[p], x[maxRow]] = [x[maxRow], x[p]];
      }

      if (Math.abs(M[p][p]) < 1e-20) {
        if (p < this.numNodes) {
          throw new Error(`Node ${this._nodeName(p + 1)} is floating`);
        }
        throw new Error('Voltage sources are shorted');
      }

      for (let r = p + 1; r < n; r++) {
        const factor = M[r][p] / M[p][p];
        x[r] -= factor * x[p];
        for (let c = p; c < n; c++) {
          M[r][c] -= factor * M[p][c];
        }
      }
    }

    const sol = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = x[i];
      for (let j = i + 1; j < n; j++) {
        sum -= M[i][j] * sol[j];
      }
      if (Math.abs(M[i][i]) < 1e-20) {
        sol[i] = 0;
      } else {
        sol[i] = sum / M[i][i];
      }
    }

    return sol;
  }
}
