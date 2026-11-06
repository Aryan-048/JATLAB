/**
 * FunctionGenView.js - Benchtop Function Generator Panel with Wire Terminals
 */

export class FunctionGenView {
  constructor(containerElement, fgState, simulationController, stateManager) {
    this.container = containerElement;
    this.state = fgState;
    this.sim = simulationController;
    this.appState = stateManager;

    this.render();
  }

  render() {
    const isKhz = this.state.unit === 'kHz';
    const isMhz = this.state.unit === 'MHz';
    const displayFreq = isMhz
      ? (this.state.frequency / 1e6).toFixed(3)
      : isKhz
      ? (this.state.frequency / 1e3).toFixed(2)
      : this.state.frequency.toFixed(0);

    this.container.innerHTML = `
      <div class="instrument-box fg-box" id="inst-${this.state.id}">
        <!-- Instrument Header -->
        <div class="instrument-header">
          <div class="instrument-title-group">
            <span class="drag-handle" title="Drag to rearrange instrument panel">⠿</span>
            <span class="instrument-badge fg-badge">FUNC GEN</span>
            <strong class="instrument-name">${this.state.title}</strong>
          </div>
          <div class="inst-power-group">
            <button id="${this.state.id}-btn-power" class="inst-power-btn ${this.state.enabled ? 'on' : 'off'}">
              <span class="led ${this.state.enabled ? 'green' : 'red'}"></span>
              OUTPUT ${this.state.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <!-- Main Body (height: auto, no overflow hidden) -->
        <div class="fg-body">
          <!-- Digital Frequency LCD Screen -->
          <div class="fg-lcd">
            <div class="lcd-label">GENERATOR OUTPUT</div>
            <div class="lcd-main">
              <span class="lcd-value" id="${this.state.id}-lcd-freq">${displayFreq}</span>
              <span class="lcd-unit" id="${this.state.id}-lcd-unit">${this.state.unit}</span>
            </div>
            <div class="lcd-sub">
              <span>WAVE: <b>${this.state.waveform.toUpperCase()}</b></span>
              <span>AMP: <b>${this.state.amplitude} ${this.state.ampMode}</b></span>
              <span>OFFSET: <b>${this.state.offset} V</b></span>
            </div>
          </div>

          <!-- Suggested Hint Pill (if any) -->
          ${
            this.state.suggestedHint
              ? `
            <div class="hint-pill">
              <span>💡 ${this.state.suggestedHint}</span>
              <button class="btn-xs apply-hint-btn" id="${this.state.id}-apply-hint">Apply</button>
            </div>
          `
              : ''
          }

          <!-- Controls Grid (2-column CSS Grid with minmax(0, 1fr)) -->
          <div class="fg-controls-grid">
            <!-- Row 1: Waveform -->
            <div class="control-col">
              <label class="control-title">Waveform</label>
              <div class="waveform-btn-group">
                <button class="wave-btn ${this.state.waveform === 'sine' ? 'active' : ''}" data-wave="sine" title="Sine Wave">∿ Sine</button>
                <button class="wave-btn ${this.state.waveform === 'square' ? 'active' : ''}" data-wave="square" title="Square Wave">⎍ Sqr</button>
                <button class="wave-btn ${this.state.waveform === 'triangle' ? 'active' : ''}" data-wave="triangle" title="Triangle Wave">▲ Tri</button>
                <button class="wave-btn ${this.state.waveform === 'pulse' ? 'active' : ''}" data-wave="pulse" title="Pulse Wave">⎍ Pls</button>
              </div>
            </div>

            <!-- Row 1: Frequency + Unit -->
            <div class="control-col">
              <label class="control-title">Frequency</label>
              <div class="input-with-unit">
                <input type="number" id="${this.state.id}-freq-input" class="form-input" value="${displayFreq}" step="any">
                <select id="${this.state.id}-unit-select" class="inst-select unit-select">
                  <option value="Hz" ${this.state.unit === 'Hz' ? 'selected' : ''}>Hz</option>
                  <option value="kHz" ${this.state.unit === 'kHz' ? 'selected' : ''}>kHz</option>
                  <option value="MHz" ${this.state.unit === 'MHz' ? 'selected' : ''}>MHz</option>
                </select>
              </div>
            </div>

            <!-- Row 2: Amplitude + Vp/Vpp toggle -->
            <div class="control-col">
              <div class="title-with-toggle">
                <label class="control-title">Amplitude</label>
                <div class="toggle-switch-sm">
                  <button class="btn-sm ${this.state.ampMode === 'Vp' ? 'active' : ''}" id="${this.state.id}-btn-vp">Vp</button>
                  <button class="btn-sm ${this.state.ampMode === 'Vpp' ? 'active' : ''}" id="${this.state.id}-btn-vpp">Vpp</button>
                </div>
              </div>
              <input type="number" id="${this.state.id}-amp-input" class="form-input" value="${this.state.amplitude}" step="0.1" min="0.1" max="25">
            </div>

            <!-- Row 2: DC Offset -->
            <div class="control-col">
              <label class="control-title">DC Offset (V)</label>
              <input type="number" id="${this.state.id}-offset-input" class="form-input" value="${this.state.offset}" step="0.1" min="-15" max="15">
            </div>

            <!-- Row 3: Duty Cycle (Full width spanning 2 columns) -->
            <div class="control-col full-width">
              <div class="slider-header">
                <label class="control-title">Duty Cycle (Square/Pulse)</label>
                <strong id="${this.state.id}-duty-readout">${Math.round(this.state.dutyCycle * 100)}%</strong>
              </div>
              <input type="range" id="${this.state.id}-duty-slider" class="range-slider" min="0.05" max="0.95" step="0.01" value="${this.state.dutyCycle}">
            </div>
          </div>
        </div>

        <!-- Wire Output Terminals Footer Row (Clean layout, full visibility) -->
        <div class="fg-terminals-bar">
          <span class="term-bar-label">Terminals:</span>
          <div class="terminal-post" data-term-id="${this.state.terminals.out.id}" title="Click to wire Function Generator Output (+)">
            <div class="bnc-ring red-ring"></div>
            <span>OUT (+)</span>
          </div>
          <div class="terminal-post" data-term-id="${this.state.terminals.gnd.id}" title="Click to wire Function Generator Ground (⏚)">
            <div class="bnc-ring gnd-ring"></div>
            <span>GND (⏚)</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Power On/Off
    document.getElementById(`${this.state.id}-btn-power`)?.addEventListener('click', () => {
      this.state.enabled = !this.state.enabled;
      this.render();
      this.sim.triggerSim();
    });

    // Waveform select
    this.container.querySelectorAll('.wave-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.waveform = btn.dataset.wave;
        this.render();
        this.sim.triggerSim();
      });
    });

    // Frequency & Unit
    const freqInput = document.getElementById(`${this.state.id}-freq-input`);
    const unitSelect = document.getElementById(`${this.state.id}-unit-select`);

    const updateFrequency = () => {
      const val = parseFloat(freqInput.value);
      const unit = unitSelect.value;
      this.state.unit = unit;

      let mult = 1;
      if (unit === 'kHz') mult = 1e3;
      if (unit === 'MHz') mult = 1e6;

      if (!isNaN(val) && val > 0) {
        this.state.frequency = val * mult;
        const dispEl = document.getElementById(`${this.state.id}-lcd-freq`);
        const unitEl = document.getElementById(`${this.state.id}-lcd-unit`);
        if (dispEl) dispEl.textContent = val.toString();
        if (unitEl) unitEl.textContent = unit;
        this.sim.triggerSim();
      }
    };

    freqInput?.addEventListener('change', updateFrequency);
    unitSelect?.addEventListener('change', updateFrequency);

    // Amplitude & Vp / Vpp
    const ampInput = document.getElementById(`${this.state.id}-amp-input`);
    ampInput?.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        this.state.amplitude = val;
        this.sim.triggerSim();
      }
    });

    document.getElementById(`${this.state.id}-btn-vp`)?.addEventListener('click', () => {
      this.state.ampMode = 'Vp';
      document.getElementById(`${this.state.id}-btn-vp`)?.classList.add('active');
      document.getElementById(`${this.state.id}-btn-vpp`)?.classList.remove('active');
      this.sim.triggerSim();
    });

    document.getElementById(`${this.state.id}-btn-vpp`)?.addEventListener('click', () => {
      this.state.ampMode = 'Vpp';
      document.getElementById(`${this.state.id}-btn-vpp`)?.classList.add('active');
      document.getElementById(`${this.state.id}-btn-vp`)?.classList.remove('active');
      this.sim.triggerSim();
    });

    // Offset
    document.getElementById(`${this.state.id}-offset-input`)?.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        this.state.offset = val;
        this.sim.triggerSim();
      }
    });

    // Duty Cycle
    const dutySlider = document.getElementById(`${this.state.id}-duty-slider`);
    dutySlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.state.dutyCycle = val;
      const dutyReadout = document.getElementById(`${this.state.id}-duty-readout`);
      if (dutyReadout) dutyReadout.textContent = `${Math.round(val * 100)}%`;
      this.sim.triggerSim();
    });

    // Apply Hint Button
    document.getElementById(`${this.state.id}-apply-hint`)?.addEventListener('click', () => {
      if (this.state.suggestedHint.includes('8 kHz')) {
        this.state.frequency = 8000;
        this.state.unit = 'kHz';
        this.state.amplitude = 5;
      } else if (this.state.suggestedHint.includes('1 kHz')) {
        this.state.frequency = 1000;
        this.state.unit = 'kHz';
        this.state.amplitude = 2;
      } else if (this.state.suggestedHint.includes('100 Hz')) {
        this.state.frequency = 100;
        this.state.unit = 'Hz';
        this.state.amplitude = 2;
      } else if (this.state.suggestedHint.includes('13 kHz')) {
        this.state.frequency = 13000;
        this.state.unit = 'kHz';
        this.state.amplitude = 6;
      } else if (this.state.suggestedHint.includes('500 Hz')) {
        this.state.frequency = 500;
        this.state.unit = 'Hz';
        this.state.amplitude = 5;
      }
      this.render();
      this.sim.triggerSim();
    });

    // Wire terminal clicks
    this.container.querySelectorAll('.terminal-post').forEach((post) => {
      post.addEventListener('click', () => {
        const termId = post.dataset.termId;
        if (window.gatlabApp?.canvas) {
          window.gatlabApp.canvas.handleTerminalClick(termId, post);
        }
      });
    });
  }
}
