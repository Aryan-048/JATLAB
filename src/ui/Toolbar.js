/**
 * Toolbar.js - Top Action Bar with Wire Colors, Zoom, Undo/Redo & JSON Save/Load
 */

import { WIRE_COLORS } from '../core/WireModel.js';

export class Toolbar {
  constructor(containerElement, stateManager, canvas) {
    this.container = containerElement;
    this.state = stateManager;
    this.canvas = canvas;

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="toolbar-left">
        <!-- Logo & Branding -->
        <div class="app-brand">
          <div class="brand-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M12 2v20M2 12h20M7 7l10 10M17 7L7 17"></path>
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-title">GATLAB</span>
            <span class="brand-subtitle">Comm Lab Simulator</span>
          </div>
        </div>

        <!-- First Test Button -->
        <button id="btn-quick-rc-test" class="tool-btn test-btn" title="Run First Test: 1 kHz RC Low-Pass Filter with Scope">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          First Test: 1 kHz RC
        </button>

        <div class="toolbar-divider"></div>

        <!-- Wire Color Palette Chips -->
        <div class="wire-color-picker" title="Active Wire Color">
          <span class="toolbar-label">Wire:</span>
          ${WIRE_COLORS.map(
            (c) => `
            <button 
              class="color-chip ${this.state.activeWireColor === c.hex ? 'active' : ''}" 
              data-hex="${c.hex}" 
              style="background-color: ${c.hex};" 
              title="${c.name}">
            </button>
          `
          ).join('')}
        </div>
        <button id="btn-tool-select" class="tool-btn text-btn active" title="Select parts, holes and wires">Select</button>
        <button id="btn-tool-wire" class="tool-btn text-btn" title="Draw a wire between holes">Wire</button>
      </div>

      <div class="toolbar-center">
        <!-- History Controls -->
        <button id="btn-undo" class="tool-btn" title="Undo (Ctrl+Z)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
          </svg>
        </button>
        <button id="btn-redo" class="tool-btn" title="Redo (Ctrl+Y)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 7v6h-6M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path>
          </svg>
        </button>

        <div class="toolbar-divider"></div>

        <!-- Zoom Controls -->
        <button id="btn-zoom-in" class="tool-btn" title="Zoom In (+)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
        <button id="btn-zoom-reset" class="tool-btn text-btn" title="Reset Zoom">100%</button>
        <button id="btn-zoom-out" class="tool-btn" title="Zoom Out (-)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>

        <div class="toolbar-divider"></div>

        <!-- Rotate & Delete -->
        <button id="btn-tool-rotate" class="tool-btn" title="Rotate Selected Part (R)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
          </svg>
        </button>
        <button id="btn-tool-delete" class="tool-btn danger" title="Delete Selected (Del)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>

      <div class="toolbar-right">
        <!-- Issues Badge -->
        <button id="btn-toggle-issues" class="tool-btn issues-btn" title="View Circuit Diagnostics">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span class="issues-text">Issues</span>
          <span id="issues-badge" class="badge">0</span>
        </button>

        <div class="toolbar-divider"></div>

        <!-- Part 2: Fade Wires Toggle -->
        <button id="btn-fade-wires" class="tool-btn text-btn" title="Fade wires to 40% opacity so holes underneath are visible and clickable">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          Fade Wires
        </button>

        <!-- Part 2: Wire order controls -->
        <button id="btn-wire-front" class="tool-btn text-btn" title="Bring selected wire to front">
          ↑ Front
        </button>
        <button id="btn-wire-back" class="tool-btn text-btn" title="Send selected wire to back">
          ↓ Back
        </button>

        <!-- Part 4: Check Circuit -->
        <button id="btn-check-circuit" class="tool-btn text-btn check-btn" title="Check Circuit against reference">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          Check Circuit
        </button>

        <div class="toolbar-divider"></div>

        <!-- Save / Load JSON -->
        <button id="btn-save-circuit" class="tool-btn text-btn" title="Export Circuit JSON">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          Save
        </button>
        <button id="btn-load-circuit" class="tool-btn text-btn" title="Load Circuit JSON">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path>
          </svg>
          Load
        </button>
        <input type="file" id="file-circuit-loader" accept=".json" style="display: none;">

        <button id="btn-clear-circuit" class="tool-btn text-btn danger" title="Clear all components and wires">
          Clear
        </button>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // First Test: RC Low-Pass
    document.getElementById('btn-quick-rc-test')?.addEventListener('click', () => {
      if (window.gatlabApp) {
        window.gatlabApp.loadFirstRCTest();
      }
    });

    // Wire color selector chips
    const colorChips = this.container.querySelectorAll('.color-chip');
    colorChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        colorChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.state.activeWireColor = chip.dataset.hex;
      });
    });

    document.getElementById('btn-tool-select')?.addEventListener('click', () => this.canvas.setTool('select'));
    document.getElementById('btn-tool-wire')?.addEventListener('click', () => this.canvas.setTool('wire'));

    // History
    document.getElementById('btn-undo')?.addEventListener('click', () => this.state.undo());
    document.getElementById('btn-redo')?.addEventListener('click', () => this.state.redo());

    // Zoom
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.canvas.zoomIn());
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.canvas.zoomOut());
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => this.canvas.resetZoom());

    // Tools
    document.getElementById('btn-tool-rotate')?.addEventListener('click', () => this.canvas.rotateSelected());
    document.getElementById('btn-tool-delete')?.addEventListener('click', () => this.canvas.deleteSelected());

    // Clear
    document.getElementById('btn-clear-circuit')?.addEventListener('click', () => {
      if (confirm('Clear the entire breadboard and remove all components/wires?')) {
        this.state.clearCircuit();
        this.canvas.render();
      }
    });

    // Save JSON
    document.getElementById('btn-save-circuit')?.addEventListener('click', () => {
      const json = this.state.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gatlab_circuit_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Load JSON
    const fileLoader = document.getElementById('file-circuit-loader');
    document.getElementById('btn-load-circuit')?.addEventListener('click', () => {
      fileLoader?.click();
    });

    fileLoader?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const success = this.state.loadJSON(event.target.result);
          if (success) {
            this.canvas.render();
          } else {
            alert('Invalid circuit JSON format!');
          }
        };
        reader.readAsText(file);
      }
    });

    // Issues listener for badge count
    this.state.onIssues((issues) => {
      const badge = document.getElementById('issues-badge');
      if (badge) {
        badge.textContent = issues.length.toString();
        const hasError = issues.some((i) => i.type === 'error');
        badge.className = `badge ${hasError ? 'badge-error' : issues.length > 0 ? 'badge-warn' : 'badge-ok'}`;
      }
    });

    // Part 2: Fade Wires toggle
    document.getElementById('btn-fade-wires')?.addEventListener('click', () => {
      this.state.fadeWires = !this.state.fadeWires;
      const btn = document.getElementById('btn-fade-wires');
      if (btn) btn.classList.toggle('active', this.state.fadeWires);
      this.canvas.render();
    });

    // Part 2: Wire order
    document.getElementById('btn-wire-front')?.addEventListener('click', () => {
      if (this.state.selectedItem?.type === 'wire') {
        this.state.bringWireToFront(this.state.selectedItem.id);
        this.canvas.render();
      }
    });
    document.getElementById('btn-wire-back')?.addEventListener('click', () => {
      if (this.state.selectedItem?.type === 'wire') {
        this.state.sendWireToBack(this.state.selectedItem.id);
        this.canvas.render();
      }
    });

    // Part 4: Check Circuit
    document.getElementById('btn-check-circuit')?.addEventListener('click', () => {
      if (window.gatlabApp?.circuitChecker) {
        window.gatlabApp.circuitChecker.runCheck();
      }
    });
  }
}

