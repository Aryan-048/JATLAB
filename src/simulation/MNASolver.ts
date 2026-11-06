/**
 * MNASolver.ts - Real Modified Nodal Analysis (MNA) Engine
 * Transient simulation with companion models & Newton-Raphson nonlinear solver.
 */

export interface MNAComponent {
  id: string;
  type: string;
  nodes: string[];       // Net names for each terminal
  value: number;         // Ohms, Farads, Henrys, Volts
  properties?: Record<string, any>;
}

export interface SimulationResult {
  time: number[];                    // Time points (seconds)
  nodeVoltages: Map<string, number[]>; // Voltage waveform per node
  sampleRate: number;
}

export class MNASolver {
  private nodeMap: Map<string, number> = new Map(); // Net name -> integer index (0 = GND)
  private numNodes: number = 0;                     // Excludes GND node 0

  // Standard constants
  private readonly Vt = 0.02585; // Thermal voltage kT/q at 300K (~26 mV)

  /**
   * Run transient simulation on given netlist
   * @param components Components in netlist
   * @param tStop Total simulation duration (e.g. 0.005 s = 5 ms)
   * @param dt Time step (e.g. 1e-6 = 1 µs)
   */
  public solveTransient(
    components: MNAComponent[],
    tStop: number = 0.005,
    dt: number = 1e-6
  ): SimulationResult {
    // 1. Assign integer indices to all electrical nets
    this.buildNodeMap(components);

    const N = this.numNodes;
    // Count voltage sources (Function Generators and Power Supplies)
    const vSources = components.filter(
      (c) =>
        c.type === 'vsource' ||
        c.type === 'function_generator' ||
        c.type === 'dc_supply' ||
        c.type === 'vcc_terminal'
    );
    const M = vSources.length;
    const matrixSize = N + M;

    // History states for reactive elements
    const capStates = new Map<string, { vPrev: number; iPrev: number }>();
    const indStates = new Map<string, { iPrev: number; vPrev: number }>();

    // 555 IC state
    let ne555_flipflop = false; // false = output high, discharge off; true = output low, discharge on

    // ICL8038 VCO state
    let vco_cap_voltage = 0.0;
    let vco_charging = true;

    // Prepare result arrays
    const numSteps = Math.min(Math.floor(tStop / dt), 10000);
    const timeArray: number[] = new Array(numSteps);
    const nodeVoltageArrays: Map<string, number[]> = new Map();

    for (const [netName] of this.nodeMap.entries()) {
      nodeVoltageArrays.set(netName, new Array(numSteps).fill(0));
    }

    let vPrev = new Array(matrixSize).fill(0);

    // Transient time-stepping loop
    for (let step = 0; step < numSteps; step++) {
      const t = step * dt;
      timeArray[step] = t;

      let xSol = [...vPrev];

      // Newton-Raphson iteration for nonlinear elements (diodes/transistors)
      const maxIter = 25;
      let converged = false;

      for (let iter = 0; iter < maxIter; iter++) {
        // Allocate MNA Matrix A and RHS vector b
        const A: number[][] = Array.from({ length: matrixSize }, () =>
          new Array(matrixSize).fill(0)
        );
        const b: number[] = new Array(matrixSize).fill(0);

        // Add small shunt conductance to ground at every node (100 MΩ) to prevent singular matrices on floating nodes
        for (let i = 0; i < N; i++) {
          A[i][i] += 1e-8;
        }

        let vSrcIdx = 0;

        // Stamp all components
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
              // Trapezoidal companion model: G = 2C / dt, I_eq = -G * vPrev - iPrev
              const G = (2 * C) / dt;
              this.stampConductance(A, n1, n2, G);

              const state = capStates.get(comp.id) || { vPrev: 0, iPrev: 0 };
              const I_eq = -G * state.vPrev - state.iPrev;
              this.stampCurrentSource(b, n1, n2, I_eq);
              break;
            }

            case 'inductor': {
              const L = comp.value;
              // Trapezoidal companion model: G = dt / (2L), I_eq = iPrev + G * vPrev
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

              // Current estimate of diode voltage Vd = v_anode - v_cathode
              const vAnode = n1 > 0 ? xSol[n1 - 1] : 0;
              const vCathode = n2 > 0 ? xSol[n2 - 1] : 0;
              let Vd = vAnode - vCathode;

              // Limiting to prevent numerical overflow in exp()
              Vd = Math.max(-50, Math.min(1.2, Vd));

              // Shockley diode equation: Id = Is * (exp(Vd / nVt) - 1)
              const expVal = Math.exp(Vd / nVt);
              const Id = Is * (expVal - 1);
              const gd = Math.max(1e-12, (Is / nVt) * expVal);
              const Ieq = Id - gd * Vd;

              this.stampConductance(A, n1, n2, gd);
              this.stampCurrentSource(b, n1, n2, Ieq);
              break;
            }

            case 'transistor_bc107':
            case 'transistor_2n2222': {
              // comp.nodes: [E, B, C]
              const nE = this.getNodeIndex(comp.nodes[0]);
              const nB = this.getNodeIndex(comp.nodes[1]);
              const nC = this.getNodeIndex(comp.nodes[2]);

              const vE = nE > 0 ? xSol[nE - 1] : 0;
              const vB = nB > 0 ? xSol[nB - 1] : 0;
              const vC = nC > 0 ? xSol[nC - 1] : 0;

              const Vbe = Math.max(-50, Math.min(0.9, vB - vE));
              const Vce = Math.max(0, vC - vE);

              // Ebers-Moll base-emitter diode
              const Is = 1e-14;
              const nVt = 1.0 * this.Vt;
              const expBe = Math.exp(Vbe / nVt);
              const Ibe = Is * (expBe - 1);
              const gbe = Math.max(1e-12, (Is / nVt) * expBe);
              const Ibe_eq = Ibe - gbe * Vbe;

              this.stampConductance(A, nB, nE, gbe);
              this.stampCurrentSource(b, nB, nE, Ibe_eq);

              // Collector current Ic = beta * Ib in forward active
              const beta = comp.value || 100;
              const Ic = Math.max(0, beta * Ibe);
              // Collector-to-Emitter dependent current
              this.stampCurrentSource(b, nC, nE, Ic);
              break;
            }

            case 'ic_555': {
              // 555 Timer Astable & PWM Behavioral Sub-Circuit
              // Pins: 1:GND, 2:TRIG, 3:OUT, 4:RESET, 5:CONT, 6:THRESH, 7:DISCH, 8:VCC
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

              // Flip-flop state update
              if (vReset < 0.7) {
                ne555_flipflop = true; // Reset forced
              } else if (vTrig < vTrigRef) {
                ne555_flipflop = false; // Set (output high, discharge off)
              } else if (vThresh > vThreshRef) {
                ne555_flipflop = true; // Reset (output low, discharge on)
              }

              // Output pin 3 drive (low impedance buffer)
              const vTargetOut = ne555_flipflop ? 0.2 : vVcc - 1.4;
              const gOut = 1.0 / 20.0; // 20 ohm output impedance
              this.stampConductance(A, nOut, nGnd, gOut);
              const Iout = gOut * vTargetOut;
              this.stampCurrentSource(b, nOut, nGnd, -Iout);

              // Discharge pin 7 switch
              if (ne555_flipflop) {
                // Saturated NPN to ground (~10 ohm)
                this.stampConductance(A, nDisch, nGnd, 0.1);
              }
              break;
            }

            case 'ic_8038': {
              // ICL8038 Waveform Generator Behavioral Sub-Circuit
              // Pin 2: SINE OUT, Pin 4: R1, Pin 5: R2, Pin 6: V+, Pins 7/8: FM MOD, Pin 10: CAP, Pin 11: GND
              const nSine = this.getNodeIndex(comp.nodes[1]); // Pin 2
              const nVcc = this.getNodeIndex(comp.nodes[5]);  // Pin 6
              const nMod = this.getNodeIndex(comp.nodes[7]);  // Pin 8 (FM Sweep)
              const nCap = this.getNodeIndex(comp.nodes[9]);  // Pin 10
              const nGnd = this.getNodeIndex(comp.nodes[10]); // Pin 11

              const vVcc = nVcc > 0 ? xSol[nVcc - 1] : 18;
              const vMod = nMod > 0 ? xSol[nMod - 1] : vVcc; // Message input
              const vCap = nCap > 0 ? xSol[nCap - 1] : vco_cap_voltage;

              // Base carrier freq ~ 4 kHz, deviates with vMod modulation voltage!
              const deltaV = Math.max(0.1, vVcc - vMod);
              const freqNominal = 4000.0 * (deltaV / (vVcc * 0.2 + 0.1));
              const currentI = Math.max(1e-6, freqNominal * 0.01e-6 * 2.0);

              // VCO Relaxation Oscillator on Pin 10
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

              // Sine wave output on Pin 2
              // Triangular to sine conversion: V_sine = V_bias + A * sin(2*pi*f*t)
              const triNorm = (vco_cap_voltage - 0.5 * vVcc) / (0.17 * vVcc);
              const sineVal = Math.sin(triNorm * Math.PI * 0.5);
              const vSineTarget = 0.5 * vVcc + 2.5 * sineVal;

              const gSine = 1.0 / 50.0; // 50 ohm output buffer
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

              // B matrix stamping: +1 at n1, -1 at n2
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

        // Solve linear system A * xSol = b
        const xNew = this.solveLinearSystem(A, b);

        // Check convergence
        let maxDiff = 0;
        for (let i = 0; i < N; i++) {
          maxDiff = Math.max(maxDiff, Math.abs(xNew[i] - xSol[i]));
        }

        xSol = xNew;
        if (maxDiff < 1e-4) {
          converged = true;
          break;
        }
      }

      // Record node voltages for this time step
      for (const [netName, idx] of this.nodeMap.entries()) {
        const vNode = idx > 0 ? xSol[idx - 1] : 0.0;
        nodeVoltageArrays.get(netName)![step] = vNode;
      }

      // Update reactive element history currents/voltages
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

    return {
      time: timeArray,
      nodeVoltages: nodeVoltageArrays,
      sampleRate: 1.0 / dt,
    };
  }

  private getVoltageSourceValue(comp: MNAComponent, t: number): number {
    if (!comp.properties || comp.properties.enabled === false) {
      return 0.0;
    }

    if (comp.type === 'dc_supply' || comp.type === 'vcc_terminal') {
      return comp.properties.voltage ?? comp.value ?? 5.0;
    }

    // Function Generator
    const waveform = comp.properties.waveform || 'sine';
    const freq = comp.properties.frequency || 1000.0;
    const amp = comp.properties.amplitude || 2.0; // Vp
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
        const norm = phase / (2 * Math.PI); // 0 to 1
        const tri = norm < 0.5 ? 4 * norm - 1 : 3 - 4 * norm;
        return offset + amp * tri;
      }

      default:
        return offset + amp * Math.sin(phase);
    }
  }

  private buildNodeMap(components: MNAComponent[]): void {
    this.nodeMap.clear();
    // Reference Ground
    this.nodeMap.set('0', 0);
    this.nodeMap.set('GND', 0);
    this.nodeMap.set('RAIL_TOP_NEG', 0);
    this.nodeMap.set('RAIL_BTM_NEG', 0);

    let nextIdx = 1;
    for (const comp of components) {
      for (const node of comp.nodes) {
        if (!this.nodeMap.has(node)) {
          this.nodeMap.set(node, nextIdx++);
        }
      }
    }
    this.numNodes = nextIdx - 1;
  }

  private getNodeIndex(netName?: string): number {
    if (!netName) return 0;
    return this.nodeMap.get(netName) || 0;
  }

  private stampConductance(A: number[][], n1: number, n2: number, G: number): void {
    if (n1 > 0) A[n1 - 1][n1 - 1] += G;
    if (n2 > 0) A[n2 - 1][n2 - 1] += G;
    if (n1 > 0 && n2 > 0) {
      A[n1 - 1][n2 - 1] -= G;
      A[n2 - 1][n1 - 1] -= G;
    }
  }

  private stampCurrentSource(b: number[], n1: number, n2: number, I: number): void {
    if (n1 > 0) b[n1 - 1] -= I;
    if (n2 > 0) b[n2 - 1] += I;
  }

  /**
   * Gaussian Elimination with Partial Pivoting
   */
  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = b.length;
    // Copy matrix and vector
    const M: number[][] = A.map((row) => [...row]);
    const x: number[] = [...b];

    for (let p = 0; p < n; p++) {
      // Find pivot row
      let maxRow = p;
      let maxVal = Math.abs(M[p][p]);
      for (let r = p + 1; r < n; r++) {
        if (Math.abs(M[r][p]) > maxVal) {
          maxVal = Math.abs(M[r][p]);
          maxRow = r;
        }
      }

      // Swap rows
      if (maxRow !== p) {
        const tempRow = M[p];
        M[p] = M[maxRow];
        M[maxRow] = tempRow;

        const tempB = x[p];
        x[p] = x[maxRow];
        x[maxRow] = tempB;
      }

      // Check singular
      if (Math.abs(M[p][p]) < 1e-15) {
        M[p][p] = 1e-15;
      }

      // Eliminate lower rows
      for (let r = p + 1; r < n; r++) {
        const factor = M[r][p] / M[p][p];
        x[r] -= factor * x[p];
        for (let c = p; c < n; c++) {
          M[r][c] -= factor * M[p][c];
        }
      }
    }

    // Back-substitution
    const sol = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = x[i];
      for (let j = i + 1; j < n; j++) {
        sum -= M[i][j] * sol[j];
      }
      sol[i] = sum / M[i][i];
    }

    return sol;
  }
}

