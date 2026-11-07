/**
 * Circuit Guides. Each lab can be loaded as a finished reference
 * (so Check Circuit can cross-check it) or built one step at a time.
 */

import { LAB_PRESETS, applyLabInstruments, buildLabPreset } from './labPresets.js';

export const LAB_GUIDES = LAB_PRESETS;

export class CircuitGuides {
  constructor(containerElement, stateManager, breadboardCanvas, instruments, simulationController) {
    this.container = containerElement;
    this.state = stateManager;
    this.canvas = breadboardCanvas;
    this.instruments = instruments;
    this.sim = simulationController;
    this.currentGuide = null;
    this.currentStep = 0;
    this.render();
  }

  stepsOf(guide) {
    const partSteps = guide.parts.map((part) => ({
      kind: 'part',
      label: part.label,
      instruction: `${part.label}. ${part.why}`,
      why: part.why,
      targetHoles: part.holes,
      ghost: null,
    }));
    const wireSteps = guide.wires.map((wire) => ({
      kind: 'wire',
      label: wire.label,
      instruction: `${wire.label}: ${wire.from} to ${wire.to}. ${wire.why}`,
      why: wire.why,
      targetHoles: [wire.from, wire.to].filter((id) => this.state.bb.holes.has(id)),
      ghost: { from: wire.from, to: wire.to },
    }));
    return partSteps.concat(wireSteps);
  }

  render() {
    const cards = Object.values(LAB_PRESETS).map((guide) => `
      <div class="guide-card" data-lab="${guide.id}">
        <div class="guide-title">${guide.name}</div>
        <div class="guide-aim">${guide.aim}</div>
        <div class="guide-actions">
          <button class="inst-btn guide-load-btn" data-lab="${guide.id}">Load reference</button>
          <button class="inst-btn guide-steps-btn" data-lab="${guide.id}">Build step by step</button>
        </div>
      </div>
    `).join('');

    this.container.innerHTML = `
      <div class="guides-panel">
        <div class="guides-header"><strong>Lab experiments</strong></div>
        <p class="guides-note">Load a reference, then Run Check. A matching build says Circuit OK.</p>
        <div class="guides-list">${cards}</div>
      </div>
      <div id="guide-wizard-modal" class="guide-wizard-modal" style="display:none">
        <div class="guide-wizard-box">
          <div class="wizard-header">
            <span id="wizard-lab-name"></span>
            <button id="wizard-close-btn" class="inst-btn">Close</button>
          </div>
          <div class="wizard-progress">
            <span id="wizard-step-label"></span>
            <div class="wizard-progress-bar"><div id="wizard-progress-fill" class="wizard-progress-fill"></div></div>
          </div>
          <div id="wizard-step-title" class="wizard-step-title"></div>
          <div id="wizard-step-instruction" class="wizard-step-instruction"></div>
          <div class="wizard-actions">
            <button id="wizard-prev-btn" class="inst-btn">Back</button>
            <button id="wizard-show-btn" class="inst-btn">Show me</button>
            <button id="wizard-check-btn" class="inst-btn">Check my step</button>
            <button id="wizard-next-btn" class="inst-btn check-btn">Next</button>
          </div>
          <div id="wizard-feedback" class="wizard-feedback"></div>
        </div>
      </div>
    `;

    this.container.querySelectorAll('.guide-load-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.loadReferenceCircuit(btn.dataset.lab));
    });
    this.container.querySelectorAll('.guide-steps-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.startStepByStep(btn.dataset.lab));
    });
    document.getElementById('wizard-close-btn')?.addEventListener('click', () => this.closeWizard());
    document.getElementById('wizard-prev-btn')?.addEventListener('click', () => {
      if (this.currentStep > 0) {
        this.currentStep--;
        this.renderWizardStep();
      }
    });
    document.getElementById('wizard-next-btn')?.addEventListener('click', () => {
      const steps = this.stepsOf(this.currentGuide);
      if (this.currentStep < steps.length - 1) {
        this.currentStep++;
        this.renderWizardStep();
      } else {
        const labId = this.currentGuide.id;
        this.closeWizard();
        this._selectChecker(labId);
        this.state.showToast('Steps finished. Run Check to cross-check the whole lab.', 'ok');
      }
    });
    document.getElementById('wizard-check-btn')?.addEventListener('click', () => this.checkCurrentStep());
    document.getElementById('wizard-show-btn')?.addEventListener('click', () => this.renderWizardStep());
    const modal = this.container.querySelector('#guide-wizard-modal');
    if (modal) document.body.appendChild(modal);
  }

  loadReferenceCircuit(labId, force = false) {
    const guide = LAB_PRESETS[labId];
    if (!guide) return false;
    if (!force && !confirm(`Load the reference for ${guide.name}? This clears the breadboard.`)) return false;
    try {
      buildLabPreset(this.state, labId);
    } catch (err) {
      this.state.showToast(err.message, 'error');
      return false;
    }
    this._applyInstruments(labId);
    this._selectChecker(labId);
    if (this.canvas) this.canvas.selectedItem = null;
    this.canvas?.render();
    this.state.showToast(`${guide.name} is on the board. Circuit Check is comparing it now.`, 'ok');
    window.gatlabApp?.circuitChecker?.runCheck();
    return true;
  }

  startStepByStep(labId, force = false) {
    const guide = LAB_PRESETS[labId];
    if (!guide) return;
    if (!force && !confirm(`Build ${guide.name} step by step? This clears the breadboard.`)) return;
    this.state.clearCircuit();
    if (this.canvas) this.canvas.selectedItem = null;
    this._applyInstruments(labId);
    this._selectChecker(labId);
    this.currentGuide = guide;
    this.currentStep = 0;
    const modal = document.getElementById('guide-wizard-modal');
    if (modal) {
      modal.style.display = 'flex';
      document.getElementById('wizard-lab-name').textContent = guide.name;
    }
    this.renderWizardStep();
  }

  renderWizardStep() {
    if (!this.currentGuide) return;
    const steps = this.stepsOf(this.currentGuide);
    const step = steps[this.currentStep];
    document.getElementById('wizard-step-label').textContent = `Step ${this.currentStep + 1} of ${steps.length}`;
    document.getElementById('wizard-step-title').textContent = step.label;
    document.getElementById('wizard-step-instruction').textContent = step.instruction;
    const feedback = document.getElementById('wizard-feedback');
    if (feedback) feedback.textContent = step.why;
    const fill = document.getElementById('wizard-progress-fill');
    if (fill) fill.style.width = `${((this.currentStep + 1) / steps.length) * 100}%`;
    const prev = document.getElementById('wizard-prev-btn');
    if (prev) prev.disabled = this.currentStep === 0;
    const next = document.getElementById('wizard-next-btn');
    if (next) next.textContent = this.currentStep === steps.length - 1 ? 'Finish' : 'Next';
    if (this.canvas) {
      this.canvas.highlightHoles = step.targetHoles || [];
      this.canvas.guideGhost = step.ghost;
      this.canvas.render();
    }
  }

  checkCurrentStep() {
    const feedback = document.getElementById('wizard-feedback');
    if (!feedback || !this.currentGuide) return;
    const step = this.stepsOf(this.currentGuide)[this.currentStep];
    const holes = step.targetHoles || [];
    const missing = holes.filter((id) => !this.state.occupancyMap.has(id));
    if (missing.length) {
      feedback.textContent = `Not yet. Still empty: ${missing.join(', ')}.`;
      feedback.style.color = '#FCA5A5';
    } else {
      feedback.textContent = 'That step is on the board. Next.';
      feedback.style.color = '#6EE7B7';
    }
  }

  closeWizard() {
    const modal = document.getElementById('guide-wizard-modal');
    if (modal) modal.style.display = 'none';
    if (this.canvas) {
      this.canvas.highlightHoles = [];
      this.canvas.guideGhost = null;
      this.canvas.render();
    }
    this.currentGuide = null;
    this.currentStep = 0;
  }

  _applyInstruments(labId) {
    applyLabInstruments(this.instruments, labId);
    const app = window.gatlabApp;
    app?.fg1View?.render();
    app?.fg2View?.render();
    app?.ps1View?.render();
    const osc = this.instruments.oscilloscope;
    this._setSelect('scope-timediv-select', osc?.timeDiv);
    this._setSelect('scope-ch1-vdiv', osc?.ch1VoltsDiv);
    this.sim?.triggerSim();
  }

  _setSelect(id, value) {
    const el = document.getElementById(id);
    if (!el || value == null) return;
    const match = [...el.options].find((option) => Math.abs(parseFloat(option.value) - value) < 1e-9);
    if (match) el.value = match.value;
  }

  _selectChecker(labId) {
    const checker = window.gatlabApp?.circuitChecker;
    const select = document.getElementById('checker-lab-select');
    if (select) select.value = labId;
    if (checker) checker.selectedLab = labId;
  }
}
