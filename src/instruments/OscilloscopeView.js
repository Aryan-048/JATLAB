/**
 * OscilloscopeView.js - Photorealistic Dual-Channel Digital Storage Oscilloscope (DSO)
 */

export class OscilloscopeView {
  constructor(containerElement, scopeState, simulationController, stateManager) {
    this.container = containerElement;
    this.state = scopeState;
    this.sim = simulationController;
    this.appState = stateManager;

    this.render();
    this.initCanvas();
  }

  render() {
    this.container.innerHTML = `
      <div class="instrument-box scope-box">
        <!-- Scope Top Header -->
        <div class="instrument-header">
          <div class="instrument-title-group">
            <span class="drag-handle" title="Drag to rearrange instrument panel">⠿</span>
            <span class="instrument-badge scope-badge">DSO</span>
            <strong class="instrument-name">${this.state.title}</strong>
          </div>
          <div class="scope-header-actions">
            <button id="btn-scope-fft" class="inst-btn" title="View Frequency Spectrum / FFT">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 18v-6M8 18V6M13 18v-9M18 18V2M22 18H2"></path>
              </svg>
              FFT
            </button>
            <button id="btn-scope-xy" class="inst-btn ${this.state.xyMode ? 'active' : ''}" title="Toggle X-Y Lissajous Mode">
              X-Y
            </button>
            <button id="btn-scope-cursors" class="inst-btn ${this.state.cursorsEnabled ? 'active' : ''}" title="Toggle Measurement Cursors">
              Cursors
            </button>
            <button id="btn-scope-runstop" class="inst-btn ${this.state.runStop ? 'run' : 'stop'}">
              ${this.state.runStop ? 'RUN' : 'STOP'}
            </button>
          </div>
        </div>

        <!-- Scope Main Body: Screen + Control Panel -->
        <div class="scope-body">
          <!-- CRT / LCD Screen Container -->
          <div class="scope-screen-wrapper">
            <canvas id="scope-screen-canvas" width="460" height="320"></canvas>
            
            <!-- Live Auto-Measurements Bar -->
            <div class="scope-measurements-bar">
              <div class="meas-ch1">
                <span class="ch-tag ch1">CH1</span>
                <span>Vpp: <b id="m-ch1-vpp">0.00 V</b></span>
                <span>Vmax: <b id="m-ch1-vmax">0.00 V</b></span>
                <span>Vmin: <b id="m-ch1-vmin">0.00 V</b></span>
                <span>Freq: <b id="m-ch1-freq">0.0 Hz</b></span>
              </div>
              <div class="meas-ch2">
                <span class="ch-tag ch2">CH2</span>
                <span>Vpp: <b id="m-ch2-vpp">0.00 V</b></span>
                <span>Vmax: <b id="m-ch2-vmax">0.00 V</b></span>
                <span>Vmin: <b id="m-ch2-vmin">0.00 V</b></span>
                <span>Freq: <b id="m-ch2-freq">0.0 Hz</b></span>
              </div>
            </div>
          </div>

          <!-- Knob & Channel Control Deck -->
          <div class="scope-controls-deck">
            <!-- Horizontal / Timebase Controls -->
            <div class="control-section">
              <div class="section-label">TIMEBASE</div>
              <div class="control-row">
                <label>Time / Div</label>
                <select id="scope-timediv-select" class="inst-select">
                  <option value="0.000005">5 µs</option>
                  <option value="0.00001">10 µs</option>
                  <option value="0.00002">20 µs</option>
                  <option value="0.00005">50 µs</option>
                  <option value="0.0001">100 µs</option>
                  <option value="0.0002" selected>200 µs</option>
                  <option value="0.0005">500 µs</option>
                  <option value="0.001">1 ms</option>
                  <option value="0.002">2 ms</option>
                  <option value="0.005">5 ms</option>
                  <option value="0.01">10 ms</option>
                </select>
              </div>
            </div>

            <!-- CH1 Controls -->
            <div class="control-section ch1-section">
              <div class="section-label ch1-label">
                <span>CHANNEL 1</span>
                <input type="checkbox" id="chk-ch1-enable" ${this.state.ch1Enabled ? 'checked' : ''}>
              </div>
              <div class="control-row">
                <label>Volts / Div</label>
                <select id="scope-ch1-vdiv" class="inst-select">
                  <option value="0.1">100 mV</option>
                  <option value="0.2">200 mV</option>
                  <option value="0.5">500 mV</option>
                  <option value="1.0" selected>1 V</option>
                  <option value="2.0">2 V</option>
                  <option value="5.0">5 V</option>
                  <option value="10.0">10 V</option>
                </select>
              </div>
              <div class="control-row">
                <label>Coupling</label>
                <div class="btn-group-sm">
                  <button class="btn-sm ${this.state.ch1Coupling === 'DC' ? 'active' : ''}" data-ch="1" data-coup="DC">DC</button>
                  <button class="btn-sm ${this.state.ch1Coupling === 'AC' ? 'active' : ''}" data-ch="1" data-coup="AC">AC</button>
                  <button class="btn-sm ${this.state.ch1Coupling === 'GND' ? 'active' : ''}" data-ch="1" data-coup="GND">GND</button>
                </div>
              </div>
              <div class="control-row">
                <label>Y Pos</label>
                <input type="range" id="scope-ch1-pos" class="inst-slider" min="-4" max="4" step="0.1" value="${this.state.ch1Pos}">
              </div>
            </div>

            <!-- CH2 Controls -->
            <div class="control-section ch2-section">
              <div class="section-label ch2-label">
                <span>CHANNEL 2</span>
                <input type="checkbox" id="chk-ch2-enable" ${this.state.ch2Enabled ? 'checked' : ''}>
              </div>
              <div class="control-row">
                <label>Volts / Div</label>
                <select id="scope-ch2-vdiv" class="inst-select">
                  <option value="0.1">100 mV</option>
                  <option value="0.2">200 mV</option>
                  <option value="0.5">500 mV</option>
                  <option value="1.0" selected>1 V</option>
                  <option value="2.0">2 V</option>
                  <option value="5.0">5 V</option>
                  <option value="10.0">10 V</option>
                </select>
              </div>
              <div class="control-row">
                <label>Coupling</label>
                <div class="btn-group-sm">
                  <button class="btn-sm ${this.state.ch2Coupling === 'DC' ? 'active' : ''}" data-ch="2" data-coup="DC">DC</button>
                  <button class="btn-sm ${this.state.ch2Coupling === 'AC' ? 'active' : ''}" data-ch="2" data-coup="AC">AC</button>
                  <button class="btn-sm ${this.state.ch2Coupling === 'GND' ? 'active' : ''}" data-ch="2" data-coup="GND">GND</button>
                </div>
              </div>
              <div class="control-row">
                <label>Y Pos</label>
                <input type="range" id="scope-ch2-pos" class="inst-slider" min="-4" max="4" step="0.1" value="${this.state.ch2Pos}">
              </div>
            </div>

            <!-- Trigger Controls -->
            <div class="control-section">
              <div class="section-label">TRIGGER</div>
              <div class="control-row">
                <label>Source</label>
                <select id="scope-trig-source" class="inst-select">
                  <option value="CH1" ${this.state.triggerSource === 'CH1' ? 'selected' : ''}>CH1</option>
                  <option value="CH2" ${this.state.triggerSource === 'CH2' ? 'selected' : ''}>CH2</option>
                </select>
              </div>
              <div class="control-row">
                <label>Level</label>
                <input type="range" id="scope-trig-level" class="inst-slider" min="-5" max="5" step="0.1" value="${this.state.triggerLevel}">
              </div>
              <div class="control-row">
                <label>Edge</label>
                <div class="btn-group-sm">
                  <button class="btn-sm ${this.state.triggerEdge === 'rising' ? 'active' : ''}" id="btn-trig-rising">↗ Rise</button>
                  <button class="btn-sm ${this.state.triggerEdge === 'falling' ? 'active' : ''}" id="btn-trig-falling">↘ Fall</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Scope Terminals Deck (Clickable BNC binding posts for wires) -->
        <div class="scope-terminals-bar">
          <div class="term-group">
            <span class="term-group-label ch1-color">CH1 Input</span>
            <div class="terminal-post" data-term-id="OSC_CH1" title="Click to wire CH1 Probe (+)">
              <div class="bnc-ring ch1-ring"></div>
              <span>CH1 (+)</span>
            </div>
            <div class="terminal-post" data-term-id="OSC_CH1_GND" title="Click to wire CH1 Ground Clip">
              <div class="bnc-ring gnd-ring"></div>
              <span>GND (⏚)</span>
            </div>
          </div>

          <div class="term-group">
            <span class="term-group-label ch2-color">CH2 Input</span>
            <div class="terminal-post" data-term-id="OSC_CH2" title="Click to wire CH2 Probe (+)">
              <div class="bnc-ring ch2-ring"></div>
              <span>CH2 (+)</span>
            </div>
            <div class="terminal-post" data-term-id="OSC_CH2_GND" title="Click to wire CH2 Ground Clip">
              <div class="bnc-ring gnd-ring"></div>
              <span>GND (⏚)</span>
            </div>
          </div>
        </div>

        <!-- FFT Modal Overlay (Hidden by default) -->
        <div id="scope-fft-modal" class="fft-modal ${this.state.fftOpen ? 'open' : ''}">
          <div class="fft-modal-header">
            <strong>FFT Spectrum Analysis (Frequency Domain)</strong>
            <div class="fft-actions">
              <button id="btn-fft-ch1" class="btn-sm ${this.state.fftChannel === 'CH1' ? 'active' : ''}">CH1</button>
              <button id="btn-fft-ch2" class="btn-sm ${this.state.fftChannel === 'CH2' ? 'active' : ''}">CH2</button>
              <button id="btn-close-fft" class="drawer-close">✕</button>
            </div>
          </div>
          <canvas id="fft-screen-canvas" width="500" height="220"></canvas>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  initCanvas() {
    this.canvas = document.getElementById('scope-screen-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.fftCanvas = document.getElementById('fft-screen-canvas');
    if (this.fftCanvas) {
      this.fftCtx = this.fftCanvas.getContext('2d');
    }

    // Animation / Render loop
    const loop = () => {
      this.drawScopeScreen();
      if (this.state.fftOpen) {
        this.drawFFTScreen();
      }
      this.animId = requestAnimationFrame(loop);
    };
    loop();
  }

  bindEvents() {
    // Time/Div
    document.getElementById('scope-timediv-select')?.addEventListener('change', (e) => {
      this.state.timeDiv = parseFloat(e.target.value);
    });

    // CH1 Volts/Div
    document.getElementById('scope-ch1-vdiv')?.addEventListener('change', (e) => {
      this.state.ch1VoltsDiv = parseFloat(e.target.value);
    });

    // CH2 Volts/Div
    document.getElementById('scope-ch2-vdiv')?.addEventListener('change', (e) => {
      this.state.ch2VoltsDiv = parseFloat(e.target.value);
    });

    // Y Positions
    document.getElementById('scope-ch1-pos')?.addEventListener('input', (e) => {
      this.state.ch1Pos = parseFloat(e.target.value);
    });

    document.getElementById('scope-ch2-pos')?.addEventListener('input', (e) => {
      this.state.ch2Pos = parseFloat(e.target.value);
    });

    // Enables
    document.getElementById('chk-ch1-enable')?.addEventListener('change', (e) => {
      this.state.ch1Enabled = e.target.checked;
    });

    document.getElementById('chk-ch2-enable')?.addEventListener('change', (e) => {
      this.state.ch2Enabled = e.target.checked;
    });

    // Couplings
    this.container.querySelectorAll('.btn-group-sm button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ch = btn.dataset.ch;
        const coup = btn.dataset.coup;
        if (ch === '1') this.state.ch1Coupling = coup;
        if (ch === '2') this.state.ch2Coupling = coup;
        this.container
          .querySelectorAll(`button[data-ch="${ch}"]`)
          .forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Trigger source & level
    document.getElementById('scope-trig-source')?.addEventListener('change', (e) => {
      this.state.triggerSource = e.target.value;
    });

    document.getElementById('scope-trig-level')?.addEventListener('input', (e) => {
      this.state.triggerLevel = parseFloat(e.target.value);
    });

    document.getElementById('btn-trig-rising')?.addEventListener('click', () => {
      this.state.triggerEdge = 'rising';
      document.getElementById('btn-trig-rising')?.classList.add('active');
      document.getElementById('btn-trig-falling')?.classList.remove('active');
    });

    document.getElementById('btn-trig-falling')?.addEventListener('click', () => {
      this.state.triggerEdge = 'falling';
      document.getElementById('btn-trig-falling')?.classList.add('active');
      document.getElementById('btn-trig-rising')?.classList.remove('active');
    });

    // Run / Stop
    const runStopBtn = document.getElementById('btn-scope-runstop');
    runStopBtn?.addEventListener('click', () => {
      this.state.runStop = !this.state.runStop;
      runStopBtn.textContent = this.state.runStop ? 'RUN' : 'STOP';
      runStopBtn.className = `inst-btn ${this.state.runStop ? 'run' : 'stop'}`;
    });

    // Cursors toggle
    const cursorsBtn = document.getElementById('btn-scope-cursors');
    cursorsBtn?.addEventListener('click', () => {
      this.state.cursorsEnabled = !this.state.cursorsEnabled;
      cursorsBtn.classList.toggle('active', this.state.cursorsEnabled);
    });

    // X-Y mode
    const xyBtn = document.getElementById('btn-scope-xy');
    xyBtn?.addEventListener('click', () => {
      this.state.xyMode = !this.state.xyMode;
      xyBtn.classList.toggle('active', this.state.xyMode);
    });

    // FFT Modal toggle
    const fftBtn = document.getElementById('btn-scope-fft');
    const fftModal = document.getElementById('scope-fft-modal');
    fftBtn?.addEventListener('click', () => {
      this.state.fftOpen = !this.state.fftOpen;
      fftModal?.classList.toggle('open', this.state.fftOpen);
    });

    document.getElementById('btn-close-fft')?.addEventListener('click', () => {
      this.state.fftOpen = false;
      fftModal?.classList.remove('open');
    });

    document.getElementById('btn-fft-ch1')?.addEventListener('click', () => {
      this.state.fftChannel = 'CH1';
      document.getElementById('btn-fft-ch1')?.classList.add('active');
      document.getElementById('btn-fft-ch2')?.classList.remove('active');
    });

    document.getElementById('btn-fft-ch2')?.addEventListener('click', () => {
      this.state.fftChannel = 'CH2';
      document.getElementById('btn-fft-ch2')?.classList.add('active');
      document.getElementById('btn-fft-ch1')?.classList.remove('active');
    });

    // Terminal wire clicks
    this.container.querySelectorAll('.terminal-post').forEach((post) => {
      post.addEventListener('click', () => {
        const termId = post.dataset.termId;
        // Start or complete wire from this terminal
        if (window.gatlabApp?.canvas) {
          window.gatlabApp.canvas.handleTerminalClick(termId, post);
        }
      });
    });
  }

  // --- Graticule & Waveform Drawing ---

  drawScopeScreen() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Deep dark phosphor CRT background
    ctx.fillStyle = '#06101E';
    ctx.fillRect(0, 0, w, h);

    // 10 horizontal divisions, 8 vertical divisions
    const numDivX = 10;
    const numDivY = 8;
    const dx = w / numDivX;
    const dy = h / numDivY;

    // Draw Graticule Grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;

    for (let i = 1; i < numDivX; i++) {
      ctx.beginPath();
      ctx.moveTo(i * dx, 0);
      ctx.lineTo(i * dx, h);
      ctx.stroke();
    }

    for (let j = 1; j < numDivY; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * dy);
      ctx.lineTo(w, j * dy);
      ctx.stroke();
    }

    // Center Crosshairs with Minor Ticks
    const midX = w / 2;
    const midY = h / 2;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1.2;

    // Center vertical axis ticks
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, h);
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    // Minor ticks (5 per division)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    for (let i = 0; i < numDivX; i++) {
      for (let s = 1; s < 5; s++) {
        const x = i * dx + (s * dx) / 5;
        ctx.beginPath();
        ctx.moveTo(x, midY - 3);
        ctx.lineTo(x, midY + 3);
        ctx.stroke();
      }
    }
    for (let j = 0; j < numDivY; j++) {
      for (let s = 1; s < 5; s++) {
        const y = j * dy + (s * dy) / 5;
        ctx.beginPath();
        ctx.moveTo(midX - 3, y);
        ctx.lineTo(midX + 3, y);
        ctx.stroke();
      }
    }

    // If simulation results are available, fetch waveforms for probed nets
    const simData = this.sim.getLatestData();
    if (!simData || !this.state.runStop) {
      if (this.lastDrawnData) {
        this.renderTraces(ctx, this.lastDrawnData, w, h, dx, dy);
      }
      return;
    }

    this.lastDrawnData = simData;

    // Part 3: Show error banner if solver failed
    if (simData.error) {
      this._drawErrorBanner(ctx, w, h, simData.error);
      return; // flatline (screen is already drawn with no traces)
    }

    this.renderTraces(ctx, simData, w, h, dx, dy);
  }

  renderTraces(ctx, simData, w, h, dx, dy) {
    const { time, nodeVoltages } = simData;
    if (!time || time.length === 0) return;

    // Resolve which global electrical nets the scope probes are wired to!
    const ch1Net = this.appState.circuitGraph.getNetForHole('OSC_CH1');
    const ch2Net = this.appState.circuitGraph.getNetForHole('OSC_CH2');

    const v1Raw = nodeVoltages[ch1Net] || new Array(time.length).fill(0);
    const v2Raw = nodeVoltages[ch2Net] || new Array(time.length).fill(0);

    // Apply coupling (AC removes mean DC bias, GND forces 0V)
    const v1 = this.applyCoupling(v1Raw, this.state.ch1Coupling);
    const v2 = this.applyCoupling(v2Raw, this.state.ch2Coupling);

    // Auto-measurements calculation
    this.calculateMeasurements(v1, v2, time);

    // X-Y Mode (Lissajous)
    if (this.state.xyMode && this.state.ch1Enabled && this.state.ch2Enabled) {
      this.drawXYMode(ctx, v1, v2, w, h);
      return;
    }

    // Trigger alignment
    const trigSource = this.state.triggerSource === 'CH2' ? v2 : v1;
    const trigIdx = this.findTriggerIndex(trigSource, this.state.triggerLevel, this.state.triggerEdge);

    const totalTimeWindow = this.state.timeDiv * 10; // 10 horizontal divisions
    const tStart = time[trigIdx] || 0;
    const tEnd = tStart + totalTimeWindow;

    const midY = h / 2;

    // Render CH1 (Yellow Phosphor Trace: #FACC15)
    if (this.state.ch1Enabled) {
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 6;
      ctx.beginPath();

      let started = false;
      for (let i = trigIdx; i < time.length && time[i] <= tEnd; i++) {
        const xNorm = (time[i] - tStart) / totalTimeWindow;
        const screenX = xNorm * w;

        // V to screen Y: 1 division = dy pixels
        const vVal = v1[i];
        const vDivs = vVal / this.state.ch1VoltsDiv;
        const screenY = midY - (vDivs + this.state.ch1Pos) * dy;

        if (!started) {
          ctx.moveTo(screenX, screenY);
          started = true;
        } else {
          ctx.lineTo(screenX, screenY);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Render CH2 (Cyan Phosphor Trace: #38BDF8)
    if (this.state.ch2Enabled) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 6;
      ctx.beginPath();

      let started = false;
      for (let i = trigIdx; i < time.length && time[i] <= tEnd; i++) {
        const xNorm = (time[i] - tStart) / totalTimeWindow;
        const screenX = xNorm * w;

        const vVal = v2[i];
        const vDivs = vVal / this.state.ch2VoltsDiv;
        const screenY = midY - (vDivs + this.state.ch2Pos) * dy;

        if (!started) {
          ctx.moveTo(screenX, screenY);
          started = true;
        } else {
          ctx.lineTo(screenX, screenY);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw Cursors if enabled
    if (this.state.cursorsEnabled) {
      this.drawCursors(ctx, w, h);
    }
  }

  applyCoupling(vArr, coupling) {
    if (coupling === 'GND') {
      return new Array(vArr.length).fill(0);
    }
    if (coupling === 'AC') {
      const mean = vArr.reduce((a, b) => a + b, 0) / (vArr.length || 1);
      return vArr.map((v) => v - mean);
    }
    return vArr;
  }

  findTriggerIndex(vArr, level, edge) {
    for (let i = 1; i < vArr.length - 100; i++) {
      if (edge === 'rising') {
        if (vArr[i - 1] <= level && vArr[i] > level) {
          return i;
        }
      } else {
        if (vArr[i - 1] >= level && vArr[i] < level) {
          return i;
        }
      }
    }
    return 0;
  }

  calculateMeasurements(v1, v2, time) {
    const calc = (arr) => {
      if (!arr || arr.length === 0) {
        return { vMax: 0, vMin: 0, vPp: 0, vRms: 0, frequency: 0 };
      }
      let max = -Infinity;
      let min = Infinity;
      let sumSq = 0;

      for (let i = 0; i < arr.length; i++) {
        const val = arr[i];
        if (val > max) max = val;
        if (val < min) min = val;
        sumSq += val * val;
      }

      const vPp = max - min;
      const vRms = Math.sqrt(sumSq / arr.length);

      // Simple zero-crossing frequency detector
      let crossings = 0;
      const mid = (max + min) / 2;
      for (let i = 1; i < arr.length; i++) {
        if ((arr[i - 1] - mid) * (arr[i] - mid) < 0) {
          crossings++;
        }
      }

      const totalTime = time[time.length - 1] - time[0];
      const freq = totalTime > 0 ? (crossings / 2) / totalTime : 0;

      return { vMax: max, vMin: min, vPp, vRms, frequency: freq };
    };

    const m1 = calc(v1);
    const m2 = calc(v2);

    this.state.measurements.ch1 = m1;
    this.state.measurements.ch2 = m2;

    // Update measurement labels in UI
    const el1Pp = document.getElementById('m-ch1-vpp');
    if (el1Pp) el1Pp.textContent = `${m1.vPp.toFixed(2)} V`;
    const el1Max = document.getElementById('m-ch1-vmax');
    if (el1Max) el1Max.textContent = `${m1.vMax.toFixed(2)} V`;
    const el1Min = document.getElementById('m-ch1-vmin');
    if (el1Min) el1Min.textContent = `${m1.vMin.toFixed(2)} V`;
    const el1F = document.getElementById('m-ch1-freq');
    if (el1F) {
      el1F.textContent = m1.frequency > 1000 ? `${(m1.frequency / 1000).toFixed(2)} kHz` : `${m1.frequency.toFixed(1)} Hz`;
    }

    const el2Pp = document.getElementById('m-ch2-vpp');
    if (el2Pp) el2Pp.textContent = `${m2.vPp.toFixed(2)} V`;
    const el2Max = document.getElementById('m-ch2-vmax');
    if (el2Max) el2Max.textContent = `${m2.vMax.toFixed(2)} V`;
    const el2Min = document.getElementById('m-ch2-vmin');
    if (el2Min) el2Min.textContent = `${m2.vMin.toFixed(2)} V`;
    const el2F = document.getElementById('m-ch2-freq');
    if (el2F) {
      el2F.textContent = m2.frequency > 1000 ? `${(m2.frequency / 1000).toFixed(2)} kHz` : `${m2.frequency.toFixed(1)} Hz`;
    }
  }

  drawCursors(ctx, w, h) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;

    // Time cursors (Vertical dashed lines)
    const x1 = w * 0.3;
    const x2 = w * 0.7;
    ctx.beginPath();
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, h);
    ctx.moveTo(x2, 0);
    ctx.lineTo(x2, h);
    ctx.stroke();

    // Voltage cursors (Horizontal dashed lines)
    const y1 = h * 0.35;
    const y2 = h * 0.65;
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(w, y1);
    ctx.moveTo(0, y2);
    ctx.lineTo(w, y2);
    ctx.stroke();

    // Cursors readout box
    const dt = (x2 - x1) * (this.state.timeDiv * 10 / w);
    const dv = (y2 - y1) * (this.state.ch1VoltsDiv * 8 / h);
    const invDt = dt > 0 ? 1 / dt : 0;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(w - 180, 10, 170, 50);
    ctx.font = '10px monospace';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`ΔT: ${(dt * 1e6).toFixed(1)} µs`, w - 170, 26);
    ctx.fillText(`1/ΔT: ${invDt > 1000 ? (invDt / 1000).toFixed(2) + ' kHz' : invDt.toFixed(0) + ' Hz'}`, w - 170, 40);
    ctx.fillText(`ΔV: ${dv.toFixed(2)} V`, w - 170, 54);

    ctx.restore();
  }

  _drawErrorBanner(ctx, w, h, errorMsg) {
    // Draw flatline at center
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Red banner at top of scope screen
    const bannerH = 46;
    ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
    ctx.fillRect(0, 0, w, bannerH);

    // ⚠ icon
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('⚠', 10, bannerH / 2);

    // Error message (wrapping)
    ctx.font = '11px system-ui, sans-serif';
    const maxWidth = w - 42;
    const words = errorMsg.split(' ');
    let line = '';
    let lineY = 14;
    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line.trim(), 32, lineY);
        line = word + ' ';
        lineY += 14;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), 32, lineY);

    ctx.restore();
  }

  drawXYMode(ctx, v1, v2, w, h) {
    ctx.save();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    const midX = w / 2;
    const midY = h / 2;
    const dx = w / 10;
    const dy = h / 8;

    for (let i = 0; i < v1.length; i++) {
      const x = midX + (v1[i] / this.state.ch1VoltsDiv) * dx;
      const y = midY - (v2[i] / this.state.ch2VoltsDiv) * dy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawFFTScreen() {
    if (!this.fftCtx || !this.fftCanvas) return;
    const ctx = this.fftCtx;
    const w = this.fftCanvas.width;
    const h = this.fftCanvas.height;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    // Spectrum grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 50; x < w; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h - 20);
      ctx.stroke();
    }
    for (let y = 30; y < h - 20; y += 30) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const simData = this.lastDrawnData;
    if (!simData) return;

    const net =
      this.state.fftChannel === 'CH1'
        ? this.appState.circuitGraph.getNetForHole('OSC_CH1')
        : this.appState.circuitGraph.getNetForHole('OSC_CH2');

    const vArr = simData.nodeVoltages[net] || [];
    if (vArr.length < 64) return;

    // Compute Discrete Fourier Transform (DFT / FFT magnitude)
    const N = Math.min(vArr.length, 512);
    const mags = [];
    let maxMag = -Infinity;

    for (let k = 0; k < N / 2; k++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        re += vArr[n] * Math.cos(angle);
        im -= vArr[n] * Math.sin(angle);
      }
      const mag = Math.sqrt(re * re + im * im) / N;
      mags.push(mag);
      if (mag > maxMag) maxMag = mag;
    }

    // Draw spectrum plot (dB scale)
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const fMax = (simData.sampleRate || 1e6) / 2; // Nyquist
    const plotW = w - 50;
    const plotH = h - 35;

    for (let k = 1; k < mags.length; k++) {
      const x = 45 + (k / mags.length) * plotW;
      const db = 20 * Math.log10(Math.max(1e-4, mags[k] / (maxMag || 1)));
      const normY = Math.max(0, Math.min(1, (db + 60) / 60)); // -60 dB to 0 dB
      const y = 15 + (1 - normY) * plotH;

      if (k === 1) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Axis labels
    ctx.font = '10px monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('0 dB', 5, 20);
    ctx.fillText('-30 dB', 5, 15 + plotH / 2);
    ctx.fillText('-60 dB', 5, 15 + plotH);
    ctx.fillText('0 Hz', 45, h - 5);
    ctx.fillText(`${(fMax / 1000).toFixed(0)} kHz`, w - 60, h - 5);
  }
}

