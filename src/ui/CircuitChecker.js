/**
 * Circuit Check side panel. Run Check always writes a result.
 */

import { analyzeCircuit } from './labCheck.js';

export class CircuitChecker {
  constructor(containerElement, stateManager, breadboardCanvas, simulationController, instruments) {
    this.container = containerElement;
    this.state = stateManager;
    this.canvas = breadboardCanvas;
    this.sim = simulationController;
    this.instruments = instruments;
    this.selectedLab = null;
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
          <div class="checker-idle">Click Run Check. This panel always shows a result.</div>
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
    this.sim.triggerSim();
    const started = Date.now();
    const finish = () => {
      const simData = this.sim.getLatestData();
      const scope = window.gatlabApp?.scopeView;
      const scopeCaughtUp = !scope || !simData || scope.lastDrawnData === simData;
      const waiting = Date.now() - started < 2500 && (
        (this.sim.worker && this.sim.isSimulating) || !scopeCaughtUp
      );
      if (waiting) {
        setTimeout(finish, 40);
        return;
      }
      const issues = analyzeCircuit({
        components: this.state.components,
        wires: this.state.wires,
        circuitGraph: this.state.circuitGraph,
        breadboard: this.state.bb,
        instruments: this.instruments,
        labId: this.selectedLab,
        simData: this.sim.getLatestData(),
      });
      this.lastIssues = issues;
      this._renderResults(issues);
    };
    setTimeout(finish, 40);
  }

  _renderResults(issues) {
    const resultsEl = document.getElementById('checker-results');
    if (!resultsEl) return;

    const problems = issues.filter((item) => item.severity === 'error' || item.severity === 'warn');
    const notes = issues.filter((item) => item.severity === 'info');
    let html = '';

    if (problems.length === 0) {
      const matched = this.selectedLab ? 'Circuit OK, output matches the reference' : 'Circuit OK';
      html += `<div class="checker-ok"><span class="checker-icon-ok">✓</span><div>
        <strong>${matched}</strong>
        <p>${this._measurementLine()}</p>
      </div></div>`;
    }

    const cards = problems.concat(notes);
    cards.forEach((item, idx) => {
      const cls = item.severity === 'error' ? 'issue-error' : item.severity === 'warn' ? 'issue-warn' : 'issue-info';
      const icon = item.severity === 'error' ? '✕' : item.severity === 'warn' ? '⚠' : 'ℹ';
      const fixBtn = item.action
        ? `<button class="issue-btn fix-btn" data-idx="${idx}">Fix it for me</button>`
        : '';
      html += `
        <div class="issue-card ${cls}">
          <div class="issue-header"><span class="issue-icon">${icon}</span><strong>${escapeHtml(item.title)}</strong></div>
          <div class="issue-why"><em>Why:</em> ${escapeHtml(item.why)}</div>
          <div class="issue-fix"><em>Fix:</em> ${escapeHtml(item.fix)}</div>
          <div class="issue-actions">
            <button class="issue-btn show-btn" data-idx="${idx}">Show me</button>
            ${fixBtn}
          </div>
        </div>`;
    });

    if (!html) {
      html = `<div class="checker-ok"><strong>Circuit OK</strong><p>${this._measurementLine()}</p></div>`;
    }

    resultsEl.innerHTML = html;
    resultsEl.querySelectorAll('.show-btn').forEach((btn) => {
      btn.addEventListener('click', () => this._showIssue(cards[Number(btn.dataset.idx)]));
    });
    resultsEl.querySelectorAll('.fix-btn').forEach((btn) => {
      btn.addEventListener('click', () => this._fixIssue(cards[Number(btn.dataset.idx)]));
    });
  }

  _measurementLine() {
    const osc = this.instruments?.oscilloscope;
    const ch1 = osc?.measurements?.ch1;
    const ch2 = osc?.measurements?.ch2;
    const fmt = (m) => (m && Number.isFinite(m.vPp) ? `${m.vPp.toFixed(2)} Vpp` : '—');
    return `Measured CH1 ${fmt(ch1)}, CH2 ${fmt(ch2)}.`;
  }

  _showIssue(item) {
    if (!item || !this.canvas) return;
    this.canvas.highlightHoles = item.holeIds || [];
    this.canvas.highlightComponentId = item.componentId || null;
    this.canvas.render();
    if (item.instrumentId) {
      const el = document.getElementById(`${item.instrumentId}-btn-power`)
        || document.getElementById('scope-screen-canvas');
      el?.scrollIntoView({ inline: 'center', block: 'center' });
    }
    setTimeout(() => {
      this.canvas.highlightHoles = [];
      this.canvas.highlightComponentId = null;
      this.canvas.render();
    }, 3000);
  }

  _fixIssue(item) {
    const action = item?.action;
    if (!action) return;
    if (action.kind === 'value') {
      this.state.setComponentValue(action.componentId, action.value);
    } else if (action.kind === 'swapPins') {
      this.state.swapPins(action.componentId, action.pinA, action.pinB);
    } else if (action.kind === 'wire') {
      this.state.addWire(action.from, action.to);
    } else if (action.kind === 'moveWire') {
      this.state.moveWireEnd(action.wireId, action.end, action.holeId);
    } else if (action.kind === 'enable') {
      this._enableInstrument(action.instrumentId);
    } else if (action.kind === 'generator') {
      this._setGenerator(action);
    } else if (action.kind === 'supply') {
      this._setSupply(action);
    } else if (action.kind === 'coupling') {
      this._setCoupling(action.channel, action.value);
    } else if (action.kind === 'timeDiv') {
      this._setTimeDiv(action.value);
    }
    this.canvas?.render();
    this.runCheck();
  }

  _enableInstrument(id) {
    const fg = (this.instruments.functionGenerators || []).find((g) => g.id === id);
    const ps = this.instruments.powerSupply;
    const device = fg || (ps && ps.id === id ? ps : null);
    if (!device) return;
    device.enabled = true;
    const btn = document.getElementById(`${id}-btn-power`);
    if (btn) {
      btn.classList.add('on');
      btn.classList.remove('off');
      const led = btn.querySelector('.led');
      if (led) {
        led.classList.add('green');
        led.classList.remove('red');
      }
      const text = btn.lastChild;
      if (text && text.nodeType === Node.TEXT_NODE) text.textContent = ' OUTPUT ON';
    }
    this.sim.triggerSim();
  }

  _setGenerator(action) {
    const fg = (this.instruments.functionGenerators || []).find((g) => g.id === action.instrumentId);
    if (!fg) return;
    if (action.waveform) {
      fg.waveform = action.waveform;
      btnPanel(fg.id)?.querySelectorAll('.wave-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.wave === fg.waveform);
      });
    }
    if (action.frequency) {
      fg.frequency = action.frequency;
      const unit = action.frequency >= 1e6 ? 'MHz' : action.frequency >= 1000 ? 'kHz' : 'Hz';
      const mult = unit === 'MHz' ? 1e6 : unit === 'kHz' ? 1e3 : 1;
      fg.unit = unit;
      const input = document.getElementById(`${fg.id}-freq-input`);
      const select = document.getElementById(`${fg.id}-unit-select`);
      if (input) input.value = String(action.frequency / mult);
      if (select) select.value = unit;
      const lcd = document.getElementById(`${fg.id}-lcd-freq`);
      const lcdUnit = document.getElementById(`${fg.id}-lcd-unit`);
      if (lcd) lcd.textContent = String(action.frequency / mult);
      if (lcdUnit) lcdUnit.textContent = unit;
    }
    if (action.amplitude != null) {
      fg.amplitude = action.amplitude;
      fg.ampMode = action.ampMode || 'Vp';
      const amp = document.getElementById(`${fg.id}-amp-input`);
      if (amp) amp.value = String(action.amplitude);
      document.getElementById(`${fg.id}-btn-vp`)?.classList.toggle('active', fg.ampMode === 'Vp');
      document.getElementById(`${fg.id}-btn-vpp`)?.classList.toggle('active', fg.ampMode === 'Vpp');
    }
    this.sim.triggerSim();
  }

  _setSupply(action) {
    const ps = this.instruments.powerSupply;
    if (!ps) return;
    ps.enabled = action.enabled !== false;
    ps.voltage = action.voltage;
    const input = document.getElementById(`${ps.id}-volt-input`);
    const slider = document.getElementById(`${ps.id}-volt-slider`);
    const disp = document.getElementById(`${ps.id}-volt-display`);
    if (input) input.value = String(action.voltage);
    if (slider) slider.value = String(action.voltage);
    if (disp && ps.enabled) disp.textContent = Number(action.voltage).toFixed(2);
    this._enableInstrument(ps.id);
  }

  _setCoupling(channel, value) {
    const osc = this.instruments.oscilloscope;
    if (!osc) return;
    if (channel === 1) osc.ch1Coupling = value;
    else osc.ch2Coupling = value;
    document.querySelectorAll(`[data-ch="${channel}"][data-coup]`).forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.coup === value);
    });
  }

  _setTimeDiv(value) {
    const osc = this.instruments.oscilloscope;
    if (!osc) return;
    osc.timeDiv = value;
    const select = document.getElementById('scope-timediv-select');
    if (select) select.value = String(value);
  }
}

function btnPanel(fgId) {
  return document.getElementById(`${fgId}-btn-power`)?.closest('.instrument-box');
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
