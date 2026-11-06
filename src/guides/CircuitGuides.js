/**
 * CircuitGuides.js - Part 5: Five Pre-Built Circuit Guides
 * Lab 1: AM Modulation/Demodulation, Lab 2: FM ICL8038,
 * Lab 5: PAM BC107, Lab 7: PWM 555, Lab 8: ASK 2N2222
 */

export const LAB_GUIDES = {
  lab1a: {
    id: 'lab1a',
    name: 'Lab 1A: AM Modulation',
    aim: 'Generate an Amplitude Modulated (AM) signal by multiplying a 1 kHz sine message with an 8 kHz sine carrier using a 1N4007 diode.',
    equipment: ['Function Generator 1 (Message: 1 kHz, 2 Vp)', 'Function Generator 2 (Carrier: 8 kHz, 5 Vp)', '1N4007 Diode', '1 kΩ Resistor', '100 Ω Resistor', 'Oscilloscope', 'DC Power Supply (5V)'],
    theory: 'AM modulation: s(t) = [1 + m·n(t)] × c(t). The diode acts as a non-linear element that produces sum/difference frequencies. The modulation index m = Vm/Vc.',
    steps: [
      { label: 'Place 1N4007 diode D1', instruction: 'Drag a 1N4007 diode from the palette. Place it spanning columns 15–17, row D on the upper bank. Anode at 15-D, Cathode at 17-D.', targetHoles: ['15-D', '17-D'], ghostWire: null },
      { label: 'Place 1kΩ resistor R1 (load)', instruction: 'Drag a 1 kΩ resistor. Place it at columns 20–24, row E. R1 connects the diode output to ground.', targetHoles: ['20-E', '24-E'], ghostWire: null },
      { label: 'Connect FG1 (Message) to anode', instruction: 'Draw a wire from FG1 OUT terminal to hole 15-A.', targetHoles: ['15-A'], ghostWire: { from: 'FG1_OUT', to: '15-A' } },
      { label: 'Connect FG2 (Carrier) to anode', instruction: 'Draw a wire from FG2 OUT terminal to hole 15-C.', targetHoles: ['15-C'], ghostWire: { from: 'FG2_OUT', to: '15-C' } },
      { label: 'Connect GND', instruction: 'Draw a wire from FG1 GND and FG2 GND terminals to the bottom blue rail (BN-20).', targetHoles: ['BN-20'], ghostWire: { from: 'FG1_GND', to: 'BN-10' } },
      { label: 'Connect load R1 to GND', instruction: 'Draw a wire from hole 24-E to BN-24 (ground rail).', targetHoles: ['24-E', 'BN-24'], ghostWire: { from: '24-E', to: 'BN-24' } },
      { label: 'Connect Scope CH1 to cathode', instruction: 'Wire Scope CH1 probe to hole 17-F (after the diode cathode). This shows the AM signal.', targetHoles: ['17-F'], ghostWire: { from: 'OSC_CH1', to: '17-F' } },
      { label: 'Connect Scope CH2 to load', instruction: 'Wire Scope CH2 probe to hole 20-F (across R1 load). This shows the envelope.', targetHoles: ['20-F'], ghostWire: { from: 'OSC_CH2', to: '20-F' } },
    ],
  },

  lab1b: {
    id: 'lab1b',
    name: 'Lab 1B: AM Demodulation (Envelope Detector)',
    aim: 'Recover the original message signal from an AM signal using a 1N4007 diode rectifier followed by an RC low-pass filter.',
    equipment: ['AM signal source (from Lab 1A output)', '1N4007 Diode', '1 kΩ Resistor', '0.1 µF Capacitor', 'Oscilloscope'],
    theory: 'The 1N4007 diode rectifies the AM signal. The RC filter (τ = RC = 100 µs) smooths the rectified signal. τ must satisfy: 1/fc << RC << 1/fm. For fc=8kHz, fm=1kHz: 125µs << RC << 1ms.',
    steps: [
      { label: 'Place 1N4007 diode D1', instruction: 'Drag a 1N4007 diode. Anode at 10-D, Cathode at 12-D. This rectifies the input.', targetHoles: ['10-D', '12-D'], ghostWire: null },
      { label: 'Place 1kΩ resistor R1', instruction: 'Drag a 1 kΩ resistor. Place it at columns 14–18, row E.', targetHoles: ['14-E', '18-E'], ghostWire: null },
      { label: 'Place 0.1µF capacitor C1', instruction: 'Drag a 0.1 µF (104) capacitor. Place it at columns 14–16, row F, straddling the gap. C1 connects from cathode node to GND.', targetHoles: ['14-F', '16-F'], ghostWire: null },
      { label: 'Connect input to anode', instruction: 'Wire from FG1 OUT (AM signal) to hole 10-A.', targetHoles: ['10-A'], ghostWire: { from: 'FG1_OUT', to: '10-A' } },
      { label: 'Connect GND', instruction: 'Wire FG1 GND to BN-10 (bottom GND rail). Wire R1 bottom and C1 bottom to BN-14.', targetHoles: ['BN-10', 'BN-14'], ghostWire: { from: 'FG1_GND', to: 'BN-10' } },
      { label: 'Probe across C1', instruction: 'Wire Scope CH2 probe to hole 14-G (across C1 — recovered message). Wire Scope GND to BN-14.', targetHoles: ['14-G'], ghostWire: { from: 'OSC_CH2', to: '14-G' } },
    ],
  },

  lab2: {
    id: 'lab2',
    name: 'Lab 2: FM using ICL8038',
    aim: 'Generate a Frequency Modulated (FM) signal using the ICL8038 Waveform Generator IC. Demonstrate frequency deviation proportional to the modulating voltage.',
    equipment: ['ICL8038 IC', '10 kΩ Resistors (pins 4 & 5)', '0.1 µF Capacitor (pin 10)', 'Function Generator 1 (Message: 1 kHz)', 'DC Power Supply (±15V or single 18V)', 'Oscilloscope'],
    theory: 'ICL8038 is a VCO (Voltage-Controlled Oscillator). Nominal frequency f₀ ≈ 0.3/(R×C). With R=10kΩ and C=0.1µF: f₀ ≈ 300 Hz. The modulation input (pin 8) shifts frequency: Δf proportional to ΔV.',
    steps: [
      { label: 'Place ICL8038 IC', instruction: 'Drag the ICL8038 from palette. Place it straddling the center gap, with pin 1 at column 20. Pins 1–7 on top bank (A–E), pins 8–14 on bottom bank (F–J).', targetHoles: ['20-E', '20-F'], ghostWire: null },
      { label: 'Connect supply (pin 6 → VCC)', instruction: 'Wire from hole 25-E (pin 6 of ICL8038) to the red + rail (TP-25). Connect PS1 + terminal to TP-20.', targetHoles: ['25-E', 'TP-25'], ghostWire: { from: 'PS1_POS', to: 'TP-20' } },
      { label: 'Connect GND (pin 11)', instruction: 'Wire hole 20+10-J (pin 11) to BN-30. Connect PS1 GND to BN-20.', targetHoles: ['30-J', 'BN-30'], ghostWire: { from: 'PS1_GND', to: 'BN-20' } },
      { label: 'Place timing resistors R1, R2', instruction: 'Place a 10kΩ resistor at 22-A to 22-D (pin 4) and another at 23-A to 23-D (pin 5).', targetHoles: ['22-A', '22-D', '23-A', '23-D'], ghostWire: null },
      { label: 'Place timing capacitor C1', instruction: 'Place a 0.1µF capacitor between hole 30-E and BN-30 (pin 10).', targetHoles: ['30-E', 'BN-30'], ghostWire: null },
      { label: 'Connect modulation input', instruction: 'Wire FG1 OUT to hole pin 8 (28-E). This is the frequency modulation input.', targetHoles: ['28-E'], ghostWire: { from: 'FG1_OUT', to: '28-E' } },
      { label: 'Probe sine output (pin 2)', instruction: 'Wire Scope CH1 to hole 21-E (pin 2 — sine output). Scope CH2 to FG1 OUT to compare FM signal vs message.', targetHoles: ['21-E'], ghostWire: { from: 'OSC_CH1', to: '21-E' } },
    ],
  },

  lab5: {
    id: 'lab5',
    name: 'Lab 5: PAM using BC107',
    aim: 'Generate Pulse Amplitude Modulated (PAM) signals using BC107 transistor as a switching element, controlled by a 10 kHz sampling clock.',
    equipment: ['BC107 NPN Transistor', '1 kΩ Resistor (Base)', '4.7 kΩ Resistor (Collector)', 'Function Generator 1 (Message: 1 kHz sine)', 'Function Generator 2 (Sampling clock: 10 kHz square)', 'DC Power Supply (5V)', 'Oscilloscope'],
    theory: 'BC107 acts as a switch. When the base (from FG2 10kHz square) goes HIGH, the transistor saturates and the collector voltage drops — it samples the emitter (message input). PAM output appears at the collector.',
    steps: [
      { label: 'Place BC107 transistor Q1', instruction: 'Drag BC107 from palette. Place it at columns 15–17, row D–F. E at 15-F, B at 16-F, C at 17-F.', targetHoles: ['15-F', '16-F', '17-F'], ghostWire: null },
      { label: 'Connect base resistor Rb = 1kΩ', instruction: 'Place 1kΩ resistor between holes 10-D and 16-D. Connects FG2 to base.', targetHoles: ['10-D', '16-D'], ghostWire: null },
      { label: 'Connect collector resistor Rc = 4.7kΩ', instruction: 'Place 4.7kΩ resistor between TP-17 (VCC rail) and 17-D.', targetHoles: ['TP-17', '17-D'], ghostWire: null },
      { label: 'Connect FG1 (Message) to emitter', instruction: 'Wire FG1 OUT to hole 15-C (emitter input). The message signal feeds the emitter.', targetHoles: ['15-C'], ghostWire: { from: 'FG1_OUT', to: '15-C' } },
      { label: 'Connect FG2 (Sampling clock) to base', instruction: 'Wire FG2 OUT (10 kHz square) to hole 10-B.', targetHoles: ['10-B'], ghostWire: { from: 'FG2_OUT', to: '10-B' } },
      { label: 'Connect supply and GND', instruction: 'Wire PS1 + to TP-15. Wire FG1 GND, FG2 GND and emitter bottom to BN-15.', targetHoles: ['TP-15', 'BN-15'], ghostWire: { from: 'PS1_POS', to: 'TP-15' } },
      { label: 'Probe PAM output', instruction: 'Wire Scope CH1 to hole 17-G (collector — PAM output). Wire Scope CH2 to FG1 OUT (message) for comparison.', targetHoles: ['17-G'], ghostWire: { from: 'OSC_CH1', to: '17-G' } },
    ],
  },

  lab7: {
    id: 'lab7',
    name: 'Lab 7: PWM using 555 Timer',
    aim: 'Generate Pulse Width Modulated (PWM) signal using a 555 timer in astable mode. The duty cycle varies with the modulating voltage at pin 5 (CONT).',
    equipment: ['555 Timer IC', '4.7 kΩ Resistor (RA, pin 7–VCC)', '4.7 kΩ Resistor (RB, pin 7–6)', '0.01 µF Capacitor (C, pins 2/6–GND)', '0.01 µF Bypass Cap (pin 5)', 'Function Generator 1 (Message: 100 Hz, 1 Vp)', 'DC Power Supply (5V)', 'Oscilloscope'],
    theory: '555 astable: f ≈ 1.44/((RA+2RB)×C) ≈ 65 kHz with RA=RB=4.7kΩ, C=10nF. Applying a voltage to pin 5 (CONT) shifts the comparator thresholds: when CONT rises, comparator thresholds shift and duty cycle changes — PWM!',
    steps: [
      { label: 'Place NE555 IC', instruction: 'Drag the 555 IC. Place it at columns 10–17, straddling the center gap. Pin 1 at 10-E, Pin 8 at 10-F.', targetHoles: ['10-E', '10-F'], ghostWire: null },
      { label: 'VCC: Pin 8 → + rail', instruction: 'Wire hole 10-J (pin 8 — but check your IC orientation) to TP-17. Actually wire PS1 POS to TP-10 and connect pin 8 to TP.', targetHoles: ['TP-10'], ghostWire: { from: 'PS1_POS', to: 'TP-10' } },
      { label: 'GND: Pin 1 → GND rail', instruction: 'Wire hole 10-A (pin 1) to TN-10 (blue top rail used as GND here).', targetHoles: ['10-A', 'TN-10'], ghostWire: { from: '10-A', to: 'TN-10' } },
      { label: 'RESET: Pin 4 → VCC', instruction: 'Wire pin 4 hole to TP rail. Pin 4 must be HIGH for 555 to oscillate.', targetHoles: ['13-A'], ghostWire: { from: '13-A', to: 'TP-13' } },
      { label: 'Place timing resistor RA = 4.7kΩ', instruction: 'Place 4.7kΩ resistor between TP-14 and 14-D (pin 7 — DISCH).', targetHoles: ['TP-14', '14-D'], ghostWire: null },
      { label: 'Place timing resistor RB = 4.7kΩ', instruction: 'Place 4.7kΩ resistor between 14-B and 15-B. Connects DISCH (pin 7) to THRESH/TRIG (pins 6/2).', targetHoles: ['14-B', '15-B'], ghostWire: null },
      { label: 'Place timing capacitor C1 = 0.01µF', instruction: 'Place 0.01µF (103) capacitor between 15-C and TN-15 (GND). This sets the charge/discharge cycle.', targetHoles: ['15-C', 'TN-15'], ghostWire: null },
      { label: 'Connect TRIG/THRESH (pin 2 and 6 together)', instruction: 'Wire pin 2 hole to pin 6 hole. Both trigger and threshold tied together for astable.', targetHoles: ['11-B', '12-B'], ghostWire: { from: '11-B', to: '12-B' } },
      { label: 'Connect message to CONT (pin 5)', instruction: 'Wire FG1 OUT (100 Hz message) to pin 5 hole. This modulates the duty cycle.', targetHoles: ['12-D'], ghostWire: { from: 'FG1_OUT', to: '12-D' } },
      { label: 'Probe PWM output', instruction: 'Wire Scope CH1 to pin 3 (OUTPUT) hole. Wire Scope CH2 to FG1 OUT (message) for comparison.', targetHoles: ['11-G'], ghostWire: { from: 'OSC_CH1', to: '11-G' } },
    ],
  },

  lab8: {
    id: 'lab8',
    name: 'Lab 8: ASK using 2N2222',
    aim: 'Generate Amplitude Shift Keyed (ASK) signal using 2N2222 transistor to switch a 13 kHz carrier ON/OFF controlled by a 500 Hz square message signal.',
    equipment: ['2N2222 NPN Transistor', '10 kΩ Resistor (Base)', '1 kΩ Resistor (Collector)', 'Function Generator 1 (Message: 500 Hz square)', 'Function Generator 2 (Carrier: 13 kHz sine)', 'DC Power Supply (5V)', 'Oscilloscope'],
    theory: 'ASK (OOK — On-Off Keying): When message=HIGH, transistor saturates → carrier appears at output. When message=LOW, transistor cuts off → output is 0V. This creates a "burst" of carrier at the message rate.',
    steps: [
      { label: 'Place 2N2222 transistor Q1', instruction: 'Drag 2N2222 from palette. Place at columns 20–22, row F–H. E at 20-H, B at 21-H, C at 22-H.', targetHoles: ['20-H', '21-H', '22-H'], ghostWire: null },
      { label: 'Base resistor Rb = 10kΩ', instruction: 'Place 10kΩ resistor between holes 15-G and 21-G. Connects message signal to base.', targetHoles: ['15-G', '21-G'], ghostWire: null },
      { label: 'Collector resistor Rc = 1kΩ', instruction: 'Place 1kΩ resistor between TP-22 (VCC rail) and 22-G.', targetHoles: ['TP-22', '22-G'], ghostWire: null },
      { label: 'Connect message (500 Hz) to base', instruction: 'Wire FG1 OUT (500 Hz square) to hole 15-F.', targetHoles: ['15-F'], ghostWire: { from: 'FG1_OUT', to: '15-F' } },
      { label: 'Connect carrier (13 kHz) to emitter', instruction: 'Wire FG2 OUT (13 kHz sine) to hole 20-G.', targetHoles: ['20-G'], ghostWire: { from: 'FG2_OUT', to: '20-G' } },
      { label: 'Connect GND', instruction: 'Wire FG1 GND, FG2 GND and emitter bottom to BN-20. Wire PS1 GND to BN-15.', targetHoles: ['BN-20'], ghostWire: { from: 'FG1_GND', to: 'BN-20' } },
      { label: 'Connect supply', instruction: 'Wire PS1 + to TP-22. This powers the collector load.', targetHoles: ['TP-22'], ghostWire: { from: 'PS1_POS', to: 'TP-22' } },
      { label: 'Probe ASK output', instruction: 'Wire Scope CH1 to hole 22-G (collector — ASK output). Wire Scope CH2 to FG1 OUT (message) for comparison.', targetHoles: ['22-G'], ghostWire: { from: 'OSC_CH1', to: '22-G' } },
    ],
  },
};

export class CircuitGuides {
  constructor(containerElement, stateManager, breadboardCanvas, instruments, simulationController) {
    this.container = containerElement;
    this.state = stateManager;
    this.canvas = breadboardCanvas;
    this.instruments = instruments;
    this.sim = simulationController;

    this.currentGuide = null;
    this.currentStep = 0;
    this.stepMode = false; // step-by-step wizard mode

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="guides-panel">
        <div class="guides-header">
          <strong>Circuit Guides</strong>
        </div>
        <div class="guides-list">
          ${Object.values(LAB_GUIDES).map((guide) => `
            <div class="guide-card" data-lab="${guide.id}">
              <div class="guide-title">${guide.name}</div>
              <div class="guide-aim">${guide.aim.substring(0, 100)}…</div>
              <div class="guide-actions">
                <button class="inst-btn guide-load-btn" data-lab="${guide.id}">▶ Load Circuit</button>
                <button class="inst-btn guide-steps-btn" data-lab="${guide.id}">🧭 Step by Step</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Step-by-Step Wizard Modal -->
      <div id="guide-wizard-modal" class="guide-wizard-modal" style="display:none">
        <div class="guide-wizard-box">
          <div class="wizard-header">
            <span id="wizard-lab-name"></span>
            <button id="wizard-close-btn" class="inst-btn">✕ Close</button>
          </div>
          <div class="wizard-progress">
            <span id="wizard-step-label">Step 1 of N</span>
            <div class="wizard-progress-bar">
              <div id="wizard-progress-fill" class="wizard-progress-fill" style="width:0%"></div>
            </div>
          </div>
          <div id="wizard-step-title" class="wizard-step-title"></div>
          <div id="wizard-step-instruction" class="wizard-step-instruction"></div>
          <div class="wizard-actions">
            <button id="wizard-prev-btn" class="inst-btn">◀ Back</button>
            <button id="wizard-check-btn" class="inst-btn">✓ Check my step</button>
            <button id="wizard-next-btn" class="inst-btn check-btn">Next ▶</button>
          </div>
          <div id="wizard-feedback" class="wizard-feedback"></div>
        </div>
      </div>
    `;

    // Bind lab action buttons
    this.container.querySelectorAll('.guide-load-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const labId = btn.dataset.lab;
        this.loadReferenceCircuit(labId);
      });
    });

    this.container.querySelectorAll('.guide-steps-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const labId = btn.dataset.lab;
        this.startStepByStep(labId);
      });
    });

    document.getElementById('wizard-close-btn')?.addEventListener('click', () => {
      this.closeWizard();
    });

    document.getElementById('wizard-prev-btn')?.addEventListener('click', () => {
      if (this.currentStep > 0) {
        this.currentStep--;
        this.renderWizardStep();
      }
    });

    document.getElementById('wizard-next-btn')?.addEventListener('click', () => {
      if (this.currentGuide && this.currentStep < this.currentGuide.steps.length - 1) {
        this.currentStep++;
        this.renderWizardStep();
      } else {
        this.closeWizard();
        this._showToast('All steps complete! Check your circuit with the oscilloscope.', 'ok');
      }
    });

    document.getElementById('wizard-check-btn')?.addEventListener('click', () => {
      this.checkCurrentStep();
    });
  }

  loadReferenceCircuit(labId) {
    const guide = LAB_GUIDES[labId];
    if (!guide) return;

    if (!confirm(`Load reference circuit for "${guide.name}"? This will clear the current breadboard.`)) {
      return;
    }

    this.state.clearCircuit();
    this._configureInstrumentsForLab(labId);

    this._showToast(`${guide.name} reference circuit loading… Place components manually or use "Step by Step".`, 'info');
  }

  startStepByStep(labId) {
    const guide = LAB_GUIDES[labId];
    if (!guide) return;

    if (!confirm(`Start step-by-step guide for "${guide.name}"? This will clear the current breadboard.`)) {
      return;
    }

    this.state.clearCircuit();
    this.currentGuide = guide;
    this.currentStep = 0;
    this.stepMode = true;

    this._configureInstrumentsForLab(labId);

    const modal = document.getElementById('guide-wizard-modal');
    if (modal) {
      modal.style.display = 'flex';
      document.getElementById('wizard-lab-name').textContent = guide.name;
    }

    this.renderWizardStep();
  }

  renderWizardStep() {
    if (!this.currentGuide) return;
    const steps = this.currentGuide.steps;
    const step = steps[this.currentStep];

    document.getElementById('wizard-step-label').textContent = `Step ${this.currentStep + 1} of ${steps.length}`;
    document.getElementById('wizard-step-title').textContent = step.label;
    document.getElementById('wizard-step-instruction').textContent = step.instruction;
    document.getElementById('wizard-feedback').textContent = '';

    const fillPct = ((this.currentStep + 1) / steps.length) * 100;
    const fillEl = document.getElementById('wizard-progress-fill');
    if (fillEl) fillEl.style.width = `${fillPct}%`;

    const prevBtn = document.getElementById('wizard-prev-btn');
    if (prevBtn) prevBtn.disabled = this.currentStep === 0;

    const nextBtn = document.getElementById('wizard-next-btn');
    if (nextBtn) {
      nextBtn.textContent = this.currentStep === steps.length - 1 ? 'Finish ✓' : 'Next ▶';
    }

    // Highlight target holes on canvas
    if (this.canvas) {
      this.canvas.highlightHoles = step.targetHoles || [];
      this.canvas.render();
    }
  }

  checkCurrentStep() {
    const feedbackEl = document.getElementById('wizard-feedback');
    if (!feedbackEl || !this.currentGuide) return;

    const step = this.currentGuide.steps[this.currentStep];

    // Basic check: are the target holes occupied?
    let allOccupied = true;
    for (const holeId of (step.targetHoles || [])) {
      if (!this.state.occupancyMap.has(holeId)) {
        allOccupied = false;
        break;
      }
    }

    if (step.targetHoles && step.targetHoles.length > 0 && !allOccupied) {
      feedbackEl.textContent = '⚠ Not done yet — the highlighted holes are not all connected. Try placing the component or drawing the wire shown.';
      feedbackEl.style.color = '#EF4444';
    } else {
      feedbackEl.textContent = '✓ Looks good! Click Next to continue.';
      feedbackEl.style.color = '#10B981';
    }
  }

  closeWizard() {
    const modal = document.getElementById('guide-wizard-modal');
    if (modal) modal.style.display = 'none';
    if (this.canvas) {
      this.canvas.highlightHoles = [];
      this.canvas.render();
    }
    this.currentGuide = null;
    this.currentStep = 0;
    this.stepMode = false;
  }

  _configureInstrumentsForLab(labId) {
    const fg1 = this.instruments.functionGenerators?.[0];
    const fg2 = this.instruments.functionGenerators?.[1];
    const ps = this.instruments.powerSupply;
    const osc = this.instruments.oscilloscope;

    // Set suggested starting values (not locked — user can change them)
    switch (labId) {
      case 'lab1a':
      case 'lab1b':
        if (fg1) { fg1.waveform = 'sine'; fg1.frequency = 1000; fg1.amplitude = 2; fg1.ampMode = 'Vp'; fg1.enabled = true; }
        if (fg2) { fg2.waveform = 'sine'; fg2.frequency = 8000; fg2.amplitude = 5; fg2.ampMode = 'Vp'; fg2.enabled = true; }
        if (osc) { osc.timeDiv = 0.0002; osc.ch1VoltsDiv = 1; osc.ch2VoltsDiv = 1; }
        break;
      case 'lab2':
        if (fg1) { fg1.waveform = 'sine'; fg1.frequency = 1000; fg1.amplitude = 2; fg1.enabled = true; }
        if (ps) { ps.voltage = 15; ps.enabled = true; }
        if (osc) { osc.timeDiv = 0.0005; osc.ch1VoltsDiv = 2; }
        break;
      case 'lab5':
        if (fg1) { fg1.waveform = 'sine'; fg1.frequency = 1000; fg1.amplitude = 2; fg1.enabled = true; }
        if (fg2) { fg2.waveform = 'square'; fg2.frequency = 10000; fg2.amplitude = 3; fg2.dutyCycle = 0.5; fg2.enabled = true; }
        if (ps) { ps.voltage = 5; ps.enabled = true; }
        if (osc) { osc.timeDiv = 0.0001; osc.ch1VoltsDiv = 1; }
        break;
      case 'lab7':
        if (fg1) { fg1.waveform = 'sine'; fg1.frequency = 100; fg1.amplitude = 1; fg1.enabled = true; }
        if (ps) { ps.voltage = 5; ps.enabled = true; }
        if (osc) { osc.timeDiv = 0.00002; osc.ch1VoltsDiv = 2; }
        break;
      case 'lab8':
        if (fg1) { fg1.waveform = 'square'; fg1.frequency = 500; fg1.amplitude = 3; fg1.enabled = true; }
        if (fg2) { fg2.waveform = 'sine'; fg2.frequency = 13000; fg2.amplitude = 3; fg2.enabled = true; }
        if (ps) { ps.voltage = 5; ps.enabled = true; }
        if (osc) { osc.timeDiv = 0.0001; osc.ch1VoltsDiv = 1; }
        break;
    }
  }

  _showToast(msg, type) {
    this.state.showToast(msg, type);
  }
}

