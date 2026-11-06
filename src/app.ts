/**
 * app.ts - Main Application Orchestrator with Two Generators, Instruments & MNA Solver (TypeScript)
 */

import { BreadboardModel } from './core/BreadboardModel.js';
import { StateManager } from './ui/StateManager.js';
import { BreadboardCanvas } from './ui/BreadboardCanvas.js';
import { PartsPalette } from './ui/PartsPalette.js';
import { PropertyInspector } from './ui/PropertyInspector.js';
import { Toolbar } from './ui/Toolbar.js';
import { IssuesPanel } from './ui/IssuesPanel.js';

import {
  createDefaultFunctionGen,
  createDefaultPowerSupply,
  createDefaultOscilloscope,
  FunctionGenState,
  PowerSupplyState,
  OscilloscopeState,
} from './instruments/InstrumentModel.js';
import { FunctionGenView } from './instruments/FunctionGenView.js';
import { PowerSupplyView } from './instruments/PowerSupplyView.js';
import { OscilloscopeView } from './instruments/OscilloscopeView.js';
import { SimulationController } from './simulation/SimulationController.js';

export interface InstrumentsRegistry {
  functionGenerators: FunctionGenState[];
  powerSupply: PowerSupplyState;
  oscilloscope: OscilloscopeState;
}

export class App {
  public breadboard: BreadboardModel;
  public state: StateManager;
  public instruments: InstrumentsRegistry;
  public sim: SimulationController;
  public canvas: BreadboardCanvas;
  public palette: PartsPalette;
  public inspector: PropertyInspector;
  public toolbar: Toolbar;
  public issues: IssuesPanel;
  public fg1View?: FunctionGenView;
  public fg2View?: FunctionGenView;
  public ps1View?: PowerSupplyView;
  public scopeView?: OscilloscopeView;

  constructor() {
    this.breadboard = new BreadboardModel();
    this.state = new StateManager(this.breadboard);

    this.instruments = {
      functionGenerators: [
        createDefaultFunctionGen('FG1', 'Function Generator 1 (Message)', 30, 20) as FunctionGenState,
        createDefaultFunctionGen('FG2', 'Function Generator 2 (Carrier)', 470, 20) as FunctionGenState,
      ],
      powerSupply: createDefaultPowerSupply('PS1', 'DC Power Supply', 910, 20) as PowerSupplyState,
      oscilloscope: createDefaultOscilloscope('OSC1', 'Dual-Channel Oscilloscope', 1220, 20) as OscilloscopeState,
    };

    this.sim = new SimulationController(this.state, this.instruments);

    const canvasEl = document.getElementById('breadboard-canvas') as HTMLCanvasElement;
    this.canvas = new BreadboardCanvas(canvasEl, this.breadboard, this.state);

    const paletteEl = document.getElementById('palette-container') as HTMLElement;
    this.palette = new PartsPalette(paletteEl, this.state);

    const inspectorEl = document.getElementById('inspector-container') as HTMLElement;
    this.inspector = new PropertyInspector(inspectorEl, this.state, this.breadboard);

    const toolbarEl = document.getElementById('toolbar-container') as HTMLElement;
    this.toolbar = new Toolbar(toolbarEl, this.state, this.canvas);

    const issuesEl = document.getElementById('issues-drawer-container') as HTMLElement;
    this.issues = new IssuesPanel(issuesEl, this.state);

    const fg1El = document.getElementById('fg1-panel-container');
    if (fg1El) {
      this.fg1View = new FunctionGenView(
        fg1El,
        this.instruments.functionGenerators[0],
        this.sim,
        this.state
      );
    }

    const fg2El = document.getElementById('fg2-panel-container');
    if (fg2El) {
      this.fg2View = new FunctionGenView(
        fg2El,
        this.instruments.functionGenerators[1],
        this.sim,
        this.state
      );
    }

    const ps1El = document.getElementById('ps1-panel-container');
    if (ps1El) {
      this.ps1View = new PowerSupplyView(
        ps1El,
        this.instruments.powerSupply,
        this.sim,
        this.state
      );
    }

    const scopeEl = document.getElementById('scope-panel-container');
    if (scopeEl) {
      this.scopeView = new OscilloscopeView(
        scopeEl,
        this.instruments.oscilloscope,
        this.sim,
        this.state
      );
    }

    this.setupInstrumentsDragAndDrop();

    this.state.subscribe(() => {
      this.canvas.render();
    });

    console.log('GATLAB Simulator initialized with Two Generators, Instruments & MNA Solver!');

    setTimeout(() => {
      this.sim.triggerSim();
    }, 100);
  }

  public setupInstrumentsDragAndDrop(): void {
    const rack = document.getElementById('instruments-rack');
    if (!rack) return;

    let draggedItem: HTMLElement | null = null;

    rack.querySelectorAll('.instrument-dock-item').forEach((item) => {
      const el = item as HTMLElement;
      el.addEventListener('dragstart', (e: DragEvent) => {
        draggedItem = el;
        el.classList.add('dragging');
        e.dataTransfer?.setData('text/plain', el.id);
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        draggedItem = null;
        setTimeout(() => this.canvas?.render(), 50);
      });

      el.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        if (draggedItem && draggedItem !== el) {
          const rect = el.getBoundingClientRect();
          const midX = rect.left + rect.width / 2;
          if (e.clientX < midX) {
            rack.insertBefore(draggedItem, el);
          } else {
            rack.insertBefore(draggedItem, el.nextSibling);
          }
        }
      });
    });
  }

  public focusInstrument(instId: string): void {
    const map: Record<string, string> = {
      FG1: 'fg1-panel-container',
      FG2: 'fg2-panel-container',
      PS1: 'ps1-panel-container',
      OSC1: 'scope-panel-container',
    };
    const elId = map[instId] || 'fg1-panel-container';
    document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', inline: 'start' });
  }

  public loadFirstRCTest(): void {
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

    this.state.startPlacement('resistor', {
      value: 1000,
      label: 'R1 (1k)',
    });
    this.state.commitPendingPlacement('10-C');

    this.state.startPlacement('capacitor', {
      value: 0.1e-6,
      label: 'C1 (0.1µF)',
    });
    this.state.commitPendingPlacement('14-D');

    this.state.addWire(fg.terminals.out.id, '10-C', '#EF4444');
    this.state.addWire(fg.terminals.gnd.id, 'BN-10', '#1F2937');
    this.state.addWire('16-D', 'BN-16', '#1F2937');
    this.state.addWire(osc.terminals.ch1Pos.id, '10-C', '#FACC15');
    this.state.addWire(osc.terminals.ch1Gnd.id, 'BN-12', '#1F2937');
    this.state.addWire(osc.terminals.ch2Pos.id, '14-D', '#38BDF8');
    this.state.addWire(osc.terminals.ch2Gnd.id, 'BN-14', '#1F2937');

    this.sim.triggerSim();
    this.canvas.render();
  }
}

declare global {
  interface Window {
    gatlabApp: App;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gatlabApp = new App();
});
