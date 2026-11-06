/**
 * CircuitChecker.js - Part 4: Circuit Checker that Always Talks
 * Compares current circuit against selected lab reference netlist,
 * reports issues with actionable fixes and "Show me" / "Fix it for me" buttons.
 */

export class CircuitChecker {
  constructor(containerElement, stateManager, breadboardCanvas, simulationController, instruments) {
    this.container = containerElement;
    this.state = stateManager;
    this.canvas = breadboardCanvas;
    this.sim = simulationController;
    this.instruments = instruments;

    this.selectedLab = null; // { id, name, reference }
    this.lastIssues = [];

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="checker-panel" id="checker-panel">
        <div class="checker-header">
          <strong>Circuit Check</strong>
          <select id="checker-lab-select" class="inst-select" title="Select reference lab to check against">
            <option value="">— No reference (basic checks only) —</option>
            <option value="lab1a">Lab 1A: AM Modulation</option>
            <option value="lab1b">Lab 1B: AM Demodulation</option>
            <option value="lab2">Lab 2: FM using ICL8038</option>
            <option value="lab5">Lab 5: PAM using BC107</option>
            <option value="lab7">Lab 7: PWM using 555</option>
            <option value="lab8">Lab 8: ASK using 2N2222</option>
          </select>
          <button id="btn-run-check" class="inst-btn check-btn">▶ Run Check</button>
        </div>
        <div id="checker-results" class="checker-results">
          <div class="checker-idle">Select a lab and click "Run Check" to verify your circuit.</div>
        </div>
      </div>
    `;

    document.getElementById('btn-run-check')?.addEventListener('click', () => this.runCheck());
    document.getElementById('checker-lab-select')?.addEventListener('change', (e) => {
      this.selectedLab = e.target.value || null;
    });
  }

  runCheck() {
    const resultsEl = document.getElementById('checker-results');
    if (!resultsEl) return;

    resultsEl.innerHTML = '<div class="checker-loading">Analyzing circuit…</div>';

    // Run after short delay so UI updates
    setTimeout(() => {
      const issues = this._analyzeCircuit();
      this.lastIssues = issues;
      this._renderResults(issues);
    }, 50);
  }

  _analyzeCircuit() {
    const issues = [];
    const cg = this.state.circuitGraph;
    const components = this.state.components;
    const wires = this.state.wires;

    cg.rebuild(components, wires);

    // ── Basic checks (always run) ───────────────────────────────────────────

    // 1. No components
    if (components.length === 0) {
      issues.push({
        severity: 'error',
        title: 'Empty breadboard',
        why: 'No components have been placed on the breadboard.',
        fix: 'Drag components from the parts palette on the left and place them on the breadboard.',
        holeIds: [],
      });
      return issues;
    }

    // 2. Missing ground
    const hasGndWire = wires.some(
      (w) =>
        w.fromHoleId.startsWith('TN-') ||
        w.toHoleId.startsWith('TN-') ||
        w.fromHoleId.startsWith('BN-') ||
        w.toHoleId.startsWith('BN-')
    );
    const hasGndComp = components.some((c) => c.type === 'gnd_terminal');
    if (!hasGndWire && !hasGndComp) {
      issues.push({
        severity: 'error',
        title: 'No ground connection',
        why: 'At least one wire must connect to the negative rail (GND) for the simulation to have a reference.',
        fix: 'Draw a wire from any component GND pin or instrument GND terminal to the blue (-) rail.',
        holeIds: ['TN-1', 'BN-1'],
      });
    }

    // 3. Short circuit on power rails
    const topPosRoot = cg.dsu.find('TP-1');
    const topGndRoot = cg.dsu.find('TN-1');
    if (topPosRoot === topGndRoot) {
      issues.push({
        severity: 'error',
        title: 'Power Rail Short Circuit',
        why: 'The positive (+) and negative (-) rails are shorted together. This would blow a fuse in real life.',
        fix: 'Remove the wire connecting the + rail to the − rail.',
        holeIds: ['TP-1', 'TN-1'],
      });
    }

    // 4. Component-level issues
    for (const comp of components) {
      this._checkComponent(comp, cg, issues);
    }

    // 5. Instrument checks
    this._checkInstruments(issues, cg);

    // 6. Oscilloscope checks
    this._checkScope(issues, cg);

    // ── Lab-specific reference checks ──────────────────────────────────────
    if (this.selectedLab) {
      this._checkLabReference(issues, cg);
    }

    // ── Simulation data checks ─────────────────────────────────────────────
    const simData = this.sim.getLatestData();
    if (simData?.error) {
      issues.push({
        severity: 'error',
        title: 'Simulation Error',
        why: simData.error,
        fix: 'Check for floating nodes, missing ground, or short circuits.',
        holeIds: [],
      });
    }

    return issues;
  }

  _checkComponent(comp, cg, issues) {
    // Check for floating / missing pins
    const unplugged = comp.pins.filter((p) => !p.holeId);
    if (unplugged.length === comp.pins.length) {
      issues.push({
        severity: 'warn',
        title: `${comp.label} is unplugged`,
        why: `${comp.displayValue} has no pins in breadboard holes.`,
        fix: 'Drag this component onto the breadboard.',
        componentId: comp.id,
        holeIds: [],
      });
      return;
    }

    // Check both leads connected
    if (unplugged.length > 0 && comp.type !== 'potentiometer') {
      issues.push({
        severity: 'warn',
        title: `${comp.label} has floating pin(s)`,
        why: `${unplugged.length} pin(s) of ${comp.label} are outside the breadboard.`,
        fix: 'Move the component so all its pins land in valid holes.',
        componentId: comp.id,
        holeIds: comp.pins.filter((p) => p.holeId).map((p) => p.holeId),
      });
    }

    // Self-short check (both pins on same net)
    if (comp.pins.length >= 2 && comp.pins[0].holeId && comp.pins[1].holeId) {
      const net0 = cg.getNetForHole(comp.pins[0].holeId);
      const net1 = cg.getNetForHole(comp.pins[1].holeId);
      if (net0 === net1 && net0 !== '0') {
        issues.push({
          severity: 'error',
          title: `${comp.label} is shorted across itself`,
          why: `Both leads of ${comp.label} are in the same connected strip (${comp.pins[0].holeId} and ${comp.pins[1].holeId}). No current will flow.`,
          fix: 'Move one lead to a different 5-hole strip.',
          componentId: comp.id,
          holeIds: [comp.pins[0].holeId, comp.pins[1].holeId],
        });
      }
    }

    // 555 specific: check VCC (pin 8) and GND (pin 1) are powered
    if (comp.type === 'ic_555') {
      const p1 = comp.pins.find((p) => p.id === 'p1'); // GND
      const p4 = comp.pins.find((p) => p.id === 'p4'); // RESET
      const p8 = comp.pins.find((p) => p.id === 'p8'); // VCC

      if (p8?.holeId) {
        const vccNet = cg.getNetForHole(p8.holeId);
        const knownPowerNets = this._getKnownPowerNets(cg);
        if (!knownPowerNets.has(vccNet)) {
          issues.push({
            severity: 'error',
            title: '555 Pin 8 (VCC) not powered',
            why: 'Pin 8 of the 555 must connect to the positive supply rail (VCC). Without power, the IC will not function.',
            fix: 'Draw a wire from pin 8 of the 555 to the + (red) power rail.',
            componentId: comp.id,
            holeIds: p8.holeId ? [p8.holeId] : [],
          });
        }
      }

      if (p4?.holeId && p1?.holeId) {
        const resetNet = cg.getNetForHole(p4.holeId);
        const gndNet = cg.getNetForHole(p1.holeId);
        if (resetNet === gndNet || resetNet === '0') {
          issues.push({
            severity: 'error',
            title: '555 Pin 4 (RESET) tied to GND',
            why: 'Pin 4 (RESET) must be tied to VCC for the 555 to oscillate. When RESET is LOW, the output is forced low.',
            fix: 'Connect pin 4 to VCC (the + rail), not GND.',
            componentId: comp.id,
            holeIds: p4.holeId ? [p4.holeId] : [],
          });
        }
      }
    }

    // ICL8038 specific: check VCC+ (pin 6) is powered
    if (comp.type === 'ic_8038') {
      const p6 = comp.pins.find((p) => p.id === 'p6'); // V+
      if (p6?.holeId) {
        const vccNet = cg.getNetForHole(p6.holeId);
        const knownPowerNets = this._getKnownPowerNets(cg);
        if (!knownPowerNets.has(vccNet)) {
          issues.push({
            severity: 'error',
            title: 'ICL8038 Pin 6 (V+) not powered',
            why: 'Pin 6 of the ICL8038 must connect to the positive supply. Without power the VCO will not oscillate.',
            fix: 'Connect pin 6 of the ICL8038 to the + supply rail.',
            componentId: comp.id,
            holeIds: p6.holeId ? [p6.holeId] : [],
          });
        }
      }
    }

    // Transistor: detect if E/B/C might be swapped (Vce should be > Vbe at DC)
    if (comp.type === 'transistor_bc107' || comp.type === 'transistor_2n2222') {
      const pe = comp.pins.find((p) => p.id === 'E');
      const pb = comp.pins.find((p) => p.id === 'B');
      const pc = comp.pins.find((p) => p.id === 'C');
      if (pe?.holeId && pb?.holeId && pc?.holeId) {
        const netE = cg.getNetForHole(pe.holeId);
        const netC = cg.getNetForHole(pc.holeId);
        // If emitter and collector on same net — likely swapped
        if (netE === netC) {
          issues.push({
            severity: 'warn',
            title: `${comp.label} Emitter and Collector on same net`,
            why: 'If emitter and collector of a BJT are on the same electrical net, the transistor cannot amplify.',
            fix: 'Check that E (emitter) connects to the low side and C (collector) to the high side. Labels are shown on the breadboard.',
            componentId: comp.id,
            holeIds: [pe.holeId, pc.holeId],
          });
        }
      }
    }
  }

  _checkInstruments(issues, cg) {
    const fgs = this.instruments.functionGenerators;

    // Check each function generator
    for (const fg of fgs) {
      if (!fg.enabled) {
        issues.push({
          severity: 'info',
          title: `${fg.title} output is OFF`,
          why: `The function generator "${fg.title}" has its output disabled. No signal is being produced.`,
          fix: `Click the "Output ON/OFF" button on ${fg.title} to enable it.`,
          holeIds: [],
          instrumentId: fg.id,
        });
      }

      // Check if OUT terminal is wired to anything
      const outNet = cg.getNetForHole(fg.terminals.out.id);
      if (outNet === `NET_${fg.terminals.out.id}`) {
        issues.push({
          severity: 'warn',
          title: `${fg.title} OUT terminal not connected`,
          why: `The output terminal of ${fg.title} is not wired to the circuit. The generator has no effect.`,
          fix: `Draw a wire from the OUT terminal of ${fg.title} to your circuit input.`,
          holeIds: [],
          instrumentId: fg.id,
        });
      }
    }

    // DC Power Supply check
    if (this.instruments.powerSupply) {
      const ps = this.instruments.powerSupply;
      if (!ps.enabled) {
        issues.push({
          severity: 'info',
          title: 'DC Power Supply is OFF',
          why: 'The DC Power Supply output is disabled. ICs and transistors require DC power to operate.',
          fix: 'Click the "Output ON/OFF" button on the DC Power Supply to enable it.',
          holeIds: [],
          instrumentId: ps.id,
        });
      }
    }
  }

  _checkScope(issues, cg) {
    const osc = this.instruments.oscilloscope;
    if (!osc) return;

    const ch1Net = cg.getNetForHole('OSC_CH1');
    const ch2Net = cg.getNetForHole('OSC_CH2');

    // CH1 probe unconnected
    if (ch1Net === 'NET_OSC_CH1') {
      issues.push({
        severity: 'info',
        title: 'Scope CH1 probe not connected',
        why: 'CH1 of the oscilloscope is not wired to any node. Connect it to the signal you want to observe.',
        fix: 'Draw a wire from the yellow CH1 probe terminal on the oscilloscope to the node you want to measure.',
        holeIds: [],
      });
    }

    // Scope time/div may be too coarse/fine for expected signal
    const simData = this.sim.getLatestData();
    if (simData && ch1Net && ch1Net !== 'NET_OSC_CH1') {
      const v1 = simData.nodeVoltages?.[ch1Net];
      if (v1 && v1.length > 10) {
        const vPp = Math.max(...v1) - Math.min(...v1);
        if (vPp < 0.01 && osc.ch1Enabled) {
          issues.push({
            severity: 'warn',
            title: 'CH1 signal is flat (< 10 mV)',
            why: `CH1 shows only ${(vPp * 1000).toFixed(1)} mV peak-to-peak. The probe may be on a DC node or the circuit is not oscillating.`,
            fix: 'Check that the signal source is ON and connected to this node. Try a different probe point.',
            holeIds: [],
          });
        }
        if (vPp > 0.01 && vPp / osc.ch1VoltsDiv < 0.5) {
          issues.push({
            severity: 'info',
            title: 'CH1 V/div too high for the signal',
            why: `Signal Vpp ≈ ${vPp.toFixed(2)} V but V/div is set to ${osc.ch1VoltsDiv} V. The trace will be barely visible.`,
            fix: `Reduce CH1 V/div to about ${(vPp / 4).toFixed(2)} V to see the signal clearly.`,
            holeIds: [],
          });
        }
      }
    }
  }

  _checkLabReference(issues, cg) {
    // Simple structural checks based on expected component types
    const labRequirements = {
      lab1a: {
        name: 'AM Modulation',
        needs: ['diode_1n4007', 'resistor', 'capacitor'],
        needsFG2: true,
        hint: 'AM modulation needs a carrier (FG2 ~8 kHz), a message (FG1 ~1 kHz), a diode, and an RC filter.',
      },
      lab1b: {
        name: 'AM Demodulation',
        needs: ['diode_1n4007', 'resistor', 'capacitor'],
        hint: 'Envelope detector needs a diode and an RC low-pass filter.',
      },
      lab2: {
        name: 'FM using ICL8038',
        needs: ['ic_8038', 'resistor', 'capacitor'],
        hint: 'FM circuit needs an ICL8038 VCO with timing resistors and capacitor.',
      },
      lab5: {
        name: 'PAM using BC107',
        needs: ['transistor_bc107', 'resistor'],
        needsFG2: true,
        hint: 'PAM samples (FG2 ~10 kHz) a message (FG1 ~1 kHz) using BC107 transistor as switch.',
      },
      lab7: {
        name: 'PWM using 555',
        needs: ['ic_555', 'resistor', 'capacitor', 'diode_1n4007'],
        needsFG: true,
        hint: '555 astable requires VCC on pin 8, GND on pin 1, timing RC on pins 6,7, and reset on pin 4 to VCC.',
      },
      lab8: {
        name: 'ASK using 2N2222',
        needs: ['transistor_2n2222', 'resistor'],
        needsFG2: true,
        hint: 'ASK on/off keying uses 2N2222 controlled by message signal to gate 13 kHz carrier.',
      },
    };

    const req = labRequirements[this.selectedLab];
    if (!req) return;

    const compTypes = this.state.components.map((c) => c.type);
    const compTypeCounts = {};
    for (const t of compTypes) {
      compTypeCounts[t] = (compTypeCounts[t] || 0) + 1;
    }

    for (const needed of req.needs) {
      if (!compTypeCounts[needed]) {
        const names = {
          diode_1n4007: '1N4007 diode',
          diode_oa79: 'OA79 diode',
          ic_555: '555 Timer IC',
          ic_8038: 'ICL8038 Function Generator IC',
          transistor_bc107: 'BC107 transistor',
          transistor_2n2222: '2N2222 transistor',
          resistor: 'at least one resistor',
          capacitor: 'at least one capacitor',
        };
        issues.push({
          severity: 'error',
          title: `Missing: ${names[needed] || needed}`,
          why: `${req.name} requires ${names[needed] || needed} but none is placed on the board.`,
          fix: `Add a ${names[needed] || needed} from the parts palette.`,
          holeIds: [],
        });
      }
    }

    if (req.needsFG2) {
      const fg2 = this.instruments.functionGenerators?.[1];
      if (!fg2?.enabled) {
        issues.push({
          severity: 'warn',
          title: 'Function Generator 2 (Carrier) is OFF',
          why: `${req.name} needs the carrier signal from FG2.`,
          fix: 'Enable FG2 and connect its OUT terminal to the carrier input of the circuit.',
          holeIds: [],
        });
      }
    }

    // Success hint if no structural errors
    const structuralErrors = issues.filter((i) => i.severity === 'error');
    if (structuralErrors.length === 0) {
      // Check simulation measurements
      const simData = this.sim.getLatestData();
      if (simData && !simData.error) {
        issues.push({
          severity: 'ok',
          title: `${req.name} — Structural checks PASS`,
          why: req.hint,
          fix: 'Review scope measurements to verify waveforms.',
          holeIds: [],
          measurements: this._getSimMeasurements(simData),
        });
      }
    }
  }

  _getKnownPowerNets(cg) {
    const nets = new Set();
    // Any net connected to a power supply or VCC terminal is a "power net"
    for (const fg of this.instruments.functionGenerators || []) {
      if (fg.enabled) {
        const n = cg.getNetForHole(fg.terminals.out.id);
        nets.add(n);
      }
    }
    if (this.instruments.powerSupply?.enabled) {
      const n = cg.getNetForHole(this.instruments.powerSupply.terminals.pos.id);
      nets.add(n);
    }
    return nets;
  }

  _getSimMeasurements(simData) {
    const osc = this.instruments.oscilloscope;
    const measurements = osc?.measurements;
    if (!measurements) return null;
    return {
      ch1: measurements.ch1,
      ch2: measurements.ch2,
    };
  }

  _renderResults(issues) {
    const resultsEl = document.getElementById('checker-results');
    if (!resultsEl) return;

    if (issues.length === 0) {
      resultsEl.innerHTML = `
        <div class="checker-ok">
          <span class="checker-icon-ok">✓</span>
          <div>
            <strong>Circuit OK</strong>
            <p>No issues found. Your circuit looks correct!</p>
          </div>
        </div>
      `;
      return;
    }

    const okIssues = issues.filter((i) => i.severity === 'ok');
    const realIssues = issues.filter((i) => i.severity !== 'ok');

    let html = '';

    if (okIssues.length > 0) {
      html += `<div class="checker-ok">
        <span class="checker-icon-ok">✓</span>
        <div><strong>${okIssues[0].title}</strong><p>${okIssues[0].why}</p></div>
      </div>`;
    }

    for (let idx = 0; idx < realIssues.length; idx++) {
      const issue = realIssues[idx];
      const severityClass = issue.severity === 'error' ? 'issue-error' : issue.severity === 'warn' ? 'issue-warn' : 'issue-info';
      const icon = issue.severity === 'error' ? '✕' : issue.severity === 'warn' ? '⚠' : 'ℹ';

      const holeButtons = (issue.holeIds || []).length > 0
        ? `<button class="issue-btn show-btn" data-idx="${idx}">📍 Show me</button>`
        : '';

      const compButton = issue.componentId
        ? `<button class="issue-btn show-btn" data-idx="${idx}">📍 Show component</button>`
        : '';

      html += `
        <div class="issue-card ${severityClass}">
          <div class="issue-header">
            <span class="issue-icon">${icon}</span>
            <strong>${issue.title}</strong>
          </div>
          <div class="issue-why"><em>Why:</em> ${issue.why}</div>
          <div class="issue-fix"><em>Fix:</em> ${issue.fix}</div>
          <div class="issue-actions">
            ${holeButtons}${compButton}
          </div>
        </div>
      `;
    }

    resultsEl.innerHTML = html;

    // Bind "Show me" buttons
    resultsEl.querySelectorAll('.show-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const issue = realIssues[idx];
        this._showIssue(issue);
      });
    });
  }

  _showIssue(issue) {
    // Highlight holes on canvas
    if (this.canvas) {
      this.canvas.highlightHoles = issue.holeIds || [];
      this.canvas.highlightComponentId = issue.componentId || null;
      this.canvas.render();

      // Clear highlight after 3 seconds
      setTimeout(() => {
        this.canvas.highlightHoles = [];
        this.canvas.highlightComponentId = null;
        this.canvas.render();
      }, 3000);
    }
  }
}

