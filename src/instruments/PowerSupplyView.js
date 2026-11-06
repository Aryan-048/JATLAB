/**
 * PowerSupplyView.js - Benchtop DC Power Supply Panel with Wire Terminals
 */

export class PowerSupplyView {
  constructor(containerElement, psState, simulationController, stateManager) {
    this.container = containerElement;
    this.state = psState;
    this.sim = simulationController;
    this.appState = stateManager;

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="instrument-box ps-box" id="inst-${this.state.id}">
        <!-- Instrument Header -->
        <div class="instrument-header">
          <div class="instrument-title-group">
            <span class="drag-handle" title="Drag to rearrange instrument panel">⠿</span>
            <span class="instrument-badge ps-badge">DC SUPPLY</span>
            <strong class="instrument-name">${this.state.title}</strong>
          </div>
          <div class="inst-power-group">
            <button id="${this.state.id}-btn-power" class="inst-power-btn ${this.state.enabled ? 'on' : 'off'}">
              <span class="led ${this.state.enabled ? 'green' : 'red'}"></span>
              OUTPUT ${this.state.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <!-- Main Body -->
        <div class="ps-body">
          <!-- Digital 7-Segment LED Displays -->
          <div class="ps-meters">
            <div class="meter-box">
              <span class="meter-label">VOLTAGE (V)</span>
              <div class="seven-segment red-display" id="${this.state.id}-volt-display">
                ${this.state.enabled ? this.state.voltage.toFixed(2) : '0.00'}
              </div>
            </div>
            <div class="meter-box">
              <span class="meter-label">CURRENT (A)</span>
              <div class="seven-segment blue-display" id="${this.state.id}-curr-display">
                ${this.state.enabled ? this.state.current.toFixed(3) : '0.000'}
              </div>
            </div>
          </div>

          <!-- Quick Voltage Presets -->
          <div class="ps-presets">
            <span class="preset-label">Lab Presets:</span>
            <button class="preset-btn ${this.state.voltage === 5 ? 'active' : ''}" data-volt="5">+5V</button>
            <button class="preset-btn ${this.state.voltage === 10 ? 'active' : ''}" data-volt="10">+10V (Lab 5)</button>
            <button class="preset-btn ${this.state.voltage === 15 ? 'active' : ''}" data-volt="15">+15V (Lab 7)</button>
            <button class="preset-btn ${this.state.voltage === 18 ? 'active' : ''}" data-volt="18">+18V (Lab 2)</button>
          </div>

          <!-- Voltage Adjustment Knob / Slider -->
          <div class="ps-slider-group">
            <div class="slider-header">
              <label class="control-title">Voltage Regulation (0 to 30 V)</label>
              <input type="number" id="${this.state.id}-volt-input" class="form-input num-sm" value="${this.state.voltage}" min="0" max="30" step="0.1">
            </div>
            <input type="range" id="${this.state.id}-volt-slider" class="range-slider ps-slider" min="0" max="30" step="0.1" value="${this.state.voltage}">
          </div>
        </div>

        <!-- Wire Output Terminals Footer (Consistent with Function Generator) -->
        <div class="ps-terminals-bar">
          <span class="term-bar-label">Terminals:</span>
          <div class="terminal-post" data-term-id="${this.state.terminals.pos.id}" title="Click to wire DC Positive Rail (+)">
            <div class="binding-post red-post"></div>
            <span>+ (VCC)</span>
          </div>
          <div class="terminal-post" data-term-id="${this.state.terminals.gnd.id}" title="Click to wire DC Ground (0V)">
            <div class="binding-post black-post"></div>
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

    // Presets
    this.container.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = parseFloat(btn.dataset.volt);
        this.state.voltage = v;
        this.render();
        this.sim.triggerSim();
      });
    });

    // Voltage Slider & Input
    const slider = document.getElementById(`${this.state.id}-volt-slider`);
    const input = document.getElementById(`${this.state.id}-volt-input`);

    slider?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.state.voltage = v;
      if (input) input.value = v.toFixed(1);
      const disp = document.getElementById(`${this.state.id}-volt-display`);
      if (disp && this.state.enabled) disp.textContent = v.toFixed(2);
      this.sim.triggerSim();
    });

    input?.addEventListener('change', (e) => {
      const v = Math.max(0, Math.min(30, parseFloat(e.target.value) || 0));
      this.state.voltage = v;
      if (slider) slider.value = v.toString();
      const disp = document.getElementById(`${this.state.id}-volt-display`);
      if (disp && this.state.enabled) disp.textContent = v.toFixed(2);
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
