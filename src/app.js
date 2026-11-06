/**
 * app.js - Main Application Orchestrator
 * Parts 1-6: Hole occupancy, arc wires, solver fixes, circuit checker, guides, toast notifications
 */

import { BreadboardModel } from './core/BreadboardModel.js';
import { StateManager } from './ui/StateManager.js';
import { BreadboardCanvas } from './ui/BreadboardCanvas.js';
import { PartsPalette } from './ui/PartsPalette.js';
import { PropertyInspector } from './ui/PropertyInspector.js';
import { Toolbar } from './ui/Toolbar.js';
import { IssuesPanel } from './ui/IssuesPanel.js';
import { CircuitChecker } from './ui/CircuitChecker.js';
import { CircuitGuides } from './guides/CircuitGuides.js';

import {
  createDefaultFunctionGen,
  createDefaultPowerSupply,
  createDefaultOscilloscope,
} from './instruments/InstrumentModel.js';
import { FunctionGenView } from './instruments/FunctionGenView.js';
import { PowerSupplyView } from './instruments/PowerSupplyView.js';
import { OscilloscopeView } from './instruments/OscilloscopeView.js';
import { SimulationController } from './simulation/SimulationController.js';

export class App {
  constructor() {
    this.breadboard = new BreadboardModel();
    this.state = new StateManager(this.breadboard);

    // 1. Instruments Registry (Two Function Generators: FG1 Message & FG2 Carrier)
    this.instruments = {
      functionGenerators: [
        createDefaultFunctionGen('FG1', 'Function Generator 1 (Message)', 30, 20),
        createDefaultFunctionGen('FG2', 'Function Generator 2 (Carrier)', 470, 20),
      ],
      powerSupply: createDefaultPowerSupply('PS1', 'DC Power Supply', 910, 20),
      oscilloscope: createDefaultOscilloscope('OSC1', 'Dual-Channel Oscilloscope', 1220, 20),
    };

    // 2. Simulation Engine Controller
    this.sim = new SimulationController(this.state, this.instruments);

    // 3. UI Views
    const canvasEl = document.getElementById('breadboard-canvas');
    this.canvas = new BreadboardCanvas(canvasEl, this.breadboard, this.state);

    const paletteEl = document.getElementById('palette-container');
    this.palette = new PartsPalette(paletteEl, this.state);

    const inspectorEl = document.getElementById('inspector-container');
    this.inspector = new PropertyInspector(inspectorEl, this.state, this.breadboard);

    const toolbarEl = document.getElementById('toolbar-container');
    this.toolbar = new Toolbar(toolbarEl, this.state, this.canvas);

    const issuesEl = document.getElementById('issues-drawer-container');
    this.issues = new IssuesPanel(issuesEl, this.state);

    // 4. Instrument Views in Workbench Rack
    const fg1El = document.getElementById('fg1-panel-container');
    if (fg1El) {
      this.fg1View = new FunctionGenView(fg1El, this.instruments.functionGenerators[0], this.sim, this.state);
    }

    const fg2El = document.getElementById('fg2-panel-container');
    if (fg2El) {
      this.fg2View = new FunctionGenView(fg2El, this.instruments.functionGenerators[1], this.sim, this.state);
    }

    const ps1El = document.getElementById('ps1-panel-container');
    if (ps1El) {
      this.ps1View = new PowerSupplyView(ps1El, this.instruments.powerSupply, this.sim, this.state);
    }

    const scopeEl = document.getElementById('scope-panel-container');
    if (scopeEl) {
      this.scopeView = new OscilloscopeView(scopeEl, this.instruments.oscilloscope, this.sim, this.state);
    }

    // 5. Part 4: Circuit Checker
    const checkerEl = document.getElementById('circuit-checker-container');
    if (checkerEl) {
      this.circuitChecker = new CircuitChecker(checkerEl, this.state, this.canvas, this.sim, this.instruments);
    }

    // 6. Part 5: Circuit Guides
    const guidesEl = document.getElementById('circuit-guides-container');
    if (guidesEl) {
      this.circuitGuides = new CircuitGuides(guidesEl, this.state, this.canvas, this.instruments, this.sim);
    }

    // 7. Toast notification system
    this._initToasts();

    // 8. Setup Drag-and-Drop Reordering for Instruments in the Rack
    this.setupInstrumentsDragAndDrop();

    // State changes re-render canvas and trigger simulation
    this.state.subscribe(() => {
      this.canvas.render();
    });

    console.log('GATLAB Simulator initialized — Parts 1-5 active!');

    // Automatically trigger initial simulation
    setTimeout(() => {
      this.sim.triggerSim();
    }, 100);
  }

  _initToasts() {
    // Create toast container if not in HTML
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      `;
      document.body.appendChild(toastContainer);
    }

    this.state.onToast((message, type) => {
      const toast = document.createElement('div');
      const bg = type === 'error' ? '#DC2626' : type === 'warn' ? '#D97706' : type === 'ok' ? '#059669' : '#2563EB';
      toast.style.cssText = `
        background: ${bg};
        color: white;
        padding: 10px 18px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        pointer-events: auto;
        max-width: 480px;
        text-align: center;
        animation: fadeInUp 0.2s ease;
      `;
      toast.textContent = message;
      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    });
  }

  setupInstrumentsDragAndDrop() {
    const rack = document.getElementById('instruments-rack');
    if (!rack) return;

    let draggedItem = null;

    rack.querySelectorAll('.instrument-dock-item').forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.id);
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
        rack.querySelectorAll('.instrument-dock-item').forEach((i) => i.classList.remove('drag-over'));
        setTimeout(() => this.canvas?.render(), 50);
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedItem && draggedItem !== item) {
          const rect = item.getBoundingClientRect();
          const midX = rect.left + rect.width / 2;
          if (e.clientX < midX) {
            rack.insertBefore(draggedItem, item);
          } else {
            rack.insertBefore(draggedItem, item.nextSibling);
          }
        }
      });
    });
  }

  focusInstrument(instId) {
    const map = {
      FG1: 'fg1-panel-container',
      FG2: 'fg2-panel-container',
      PS1: 'ps1-panel-container',
      OSC1: 'scope-panel-container',
    };
    const elId = map[instId] || 'fg1-panel-container';
    document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', inline: 'start' });
  }

  /**
   * Load First Test: 1 kHz RC Low-Pass Filter
   */
  loadFirstRCTest() {
    this.state.clearCircuit();

    const fg = this.instruments.functionGenerators[0];
    fg.enabled = true;
    fg.waveform = 'sine';
    fg.frequency = 1000.0;
    fg.unit = 'kHz';
    fg.amplitude = 2.0;
    fg.ampMode = 'Vp';
    fg.offset = 0.0;
    this.fg1View?.render();

    const osc = this.instruments.oscilloscope;
    osc.timeDiv = 0.0002;
    osc.ch1VoltsDiv = 1.0;
    osc.ch2VoltsDiv = 1.0;
    osc.ch1Pos = 0.0;
    osc.ch2Pos = 0.0;
    osc.ch1Coupling = 'DC';
    osc.ch2Coupling = 'DC';
    osc.ch1Enabled = true;
    osc.ch2Enabled = true;
    osc.runStop = true;
    this.scopeView?.render();
    this.scopeView?.initCanvas();

    // Place Resistor R1 = 1 kΩ
    this.state.startPlacement('resistor', { value: 1000, label: 'R1 (1k)' });
    this.state.commitPendingPlacement('10-C');

    // Place Capacitor C1 = 0.1 µF
    this.state.startPlacement('capacitor', { value: 0.1e-6, label: 'C1 (0.1µF)' });
    this.state.commitPendingPlacement('14-D');

    // Each instrument terminal lands in its own free hole of the right strip.
    // R1 occupies 10-C and 14-C. C1 occupies 14-D and 16-D.
    this.state.addWire(fg.terminals.out.id, '10-A', '#EF4444');
    this.state.addWire(fg.terminals.gnd.id, 'BN-10', '#1F2937');
    this.state.addWire('16-A', 'BN-16', '#1F2937');
    this.state.addWire(osc.terminals.ch1Pos.id, '10-B', '#FACC15');
    this.state.addWire(osc.terminals.ch1Gnd.id, 'BN-12', '#1F2937');
    this.state.addWire(osc.terminals.ch2Pos.id, '14-E', '#38BDF8');
    this.state.addWire(osc.terminals.ch2Gnd.id, 'BN-14', '#1F2937');

    this.sim.triggerSim();
    this.canvas.render();

    console.log('First Test (1 kHz RC Low-Pass Filter) loaded and running!');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gatlabApp = new App();
});
