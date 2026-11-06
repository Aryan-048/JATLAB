/**
 * PropertyInspector.js - Side Panel for Inspecting & Editing Selected Parts / Wires
 */

import { WIRE_COLORS } from '../core/WireModel.js';
import { formatResistance, formatCapacitance, formatInductance } from '../core/ComponentModel.js';

export class PropertyInspector {
  constructor(containerElement, stateManager, breadboard) {
    this.container = containerElement;
    this.state = stateManager;
    this.bb = breadboard;

    this.state.onSelection((selected) => {
      this.render(selected);
    });

    this.render(null);
  }

  render(selected) {
    if (!selected) {
      this.renderEmptyState();
      return;
    }

    if (selected.type === 'component') {
      const comp = this.state.components.find((c) => c.id === selected.id);
      if (!comp) {
        this.renderEmptyState();
        return;
      }
      this.renderComponentInspector(comp);
    } else if (selected.type === 'wire') {
      const wire = this.state.wires.find((w) => w.id === selected.id);
      if (!wire) {
        this.renderEmptyState();
        return;
      }
      this.renderWireInspector(wire);
    } else if (selected.type === 'hole') {
      const hole = this.bb.holes.get(selected.id);
      if (!hole) {
        this.renderEmptyState();
        return;
      }
      const mates = this.bb.getHolesInStrip(hole.id).map((h) => h.id).join(', ');
      const net = this.state.circuitGraph.getNetForHole(hole.id);
      this.container.innerHTML = `
        <div class="inspector-header">
          <div class="inspector-title">Hole ${hole.id}</div>
          <div class="inspector-badge">Strip</div>
        </div>
        <div class="inspector-body">
          <p class="inspector-hint">Net ${net}. Connected holes: ${mates}.</p>
        </div>
      `;
    } else {
      this.renderEmptyState();
    }
  }

  renderEmptyState() {
    this.container.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-title">Inspector</div>
        <div class="inspector-badge">Workspace</div>
      </div>
      <div class="inspector-empty">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#94A3B8" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4M12 8h.01"></path>
        </svg>
        <p>Select any placed component or wire on the breadboard to inspect and modify properties.</p>
        <div class="stats-box">
          <div class="stat-row">
            <span>Components Placed:</span>
            <strong>${this.state.components.length}</strong>
          </div>
          <div class="stat-row">
            <span>Jumper Wires:</span>
            <strong>${this.state.wires.length}</strong>
          </div>
          <div class="stat-row">
            <span>Active Nets:</span>
            <strong>${this.state.circuitGraph.dsu.getGroups().size}</strong>
          </div>
        </div>
        <div class="quick-shortcuts">
          <div class="shortcut-item"><kbd>R</kbd> Rotate component</div>
          <div class="shortcut-item"><kbd>Del</kbd> Delete selected</div>
          <div class="shortcut-item"><kbd>Ctrl+Z</kbd> Undo</div>
          <div class="shortcut-item"><kbd>Ctrl+Y</kbd> Redo</div>
          <div class="shortcut-item"><kbd>Esc</kbd> Cancel action</div>
        </div>
      </div>
    `;
  }

  renderComponentInspector(comp) {
    const isResistor = comp.type === 'resistor';
    const isPot = comp.type === 'potentiometer' || comp.type === 'rheostat';
    const isCap = comp.type === 'capacitor';
    const isInd = comp.type === 'inductor';

    this.container.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-title">${comp.displayValue}</div>
        <span class="inspector-badge">${comp.type.toUpperCase()}</span>
      </div>

      <div class="inspector-body">
        <!-- Label Field -->
        <div class="form-group">
          <label class="form-label">Component Label</label>
          <input type="text" id="comp-label-input" class="form-input" value="${comp.label || ''}">
        </div>

        <!-- Primary Value Editor -->
        ${
          isResistor || isCap || isInd
            ? `
          <div class="form-group">
            <label class="form-label">Electrical Value</label>
            <div class="input-with-unit">
              <input type="number" id="comp-val-input" class="form-input" value="${comp.value}" step="any">
              <span class="unit-badge">${comp.unit}</span>
            </div>
          </div>
        `
            : ''
        }

        <!-- Potentiometer Wiper Slider -->
        ${
          isPot
            ? `
          <div class="form-group pot-control-box">
            <div class="slider-header">
              <label class="form-label">Wiper Position</label>
              <strong id="pot-pct-display">${((comp.properties.wiperPos ?? 0.5) * 100).toFixed(0)}%</strong>
            </div>
            <input type="range" id="pot-wiper-slider" class="range-slider" min="0" max="1" step="0.01" value="${comp.properties.wiperPos ?? 0.5}">
            <div class="pot-readouts">
              <div>R<sub>1-W</sub>: <strong id="pot-r1w">${Math.round(comp.value * (comp.properties.wiperPos ?? 0.5))} Ω</strong></div>
              <div>R<sub>W-2</sub>: <strong id="pot-rw2">${Math.round(comp.value * (1 - (comp.properties.wiperPos ?? 0.5)))} Ω</strong></div>
            </div>
          </div>
        `
            : ''
        }

        <!-- Pins Status Table -->
        <div class="form-group">
          <label class="form-label">Pin Connections</label>
          <div class="pins-table">
            <div class="pins-header">
              <span>Pin</span>
              <span>Hole</span>
              <span>Net</span>
            </div>
            ${comp.pins
              .map((p) => {
                const net = p.holeId ? this.state.circuitGraph.getNetForHole(p.holeId) : 'Unplugged';
                return `
                <div class="pin-row ${p.holeId ? 'connected' : 'floating'}">
                  <span class="pin-name">${p.name}</span>
                  <span class="pin-hole">${p.holeId || 'None'}</span>
                  <span class="pin-net">${net}</span>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>

        <!-- Actions -->
        <div class="inspector-actions">
          <button id="btn-rotate-comp" class="btn btn-secondary">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
            </svg>
            Rotate (R)
          </button>
          <button id="btn-delete-comp" class="btn btn-danger">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete
          </button>
        </div>
      </div>
    `;

    // Event listeners
    const labelInput = document.getElementById('comp-label-input');
    if (labelInput) {
      labelInput.addEventListener('change', (e) => {
        comp.label = e.target.value;
        this.state.notify();
      });
    }

    const valInput = document.getElementById('comp-val-input');
    if (valInput) {
      valInput.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val > 0) {
          this.state.setComponentValue(comp.id, val);
          this.renderComponentInspector(comp);
        }
      });
    }

    const wiperSlider = document.getElementById('pot-wiper-slider');
    if (wiperSlider) {
      wiperSlider.addEventListener('input', (e) => {
        const pos = parseFloat(e.target.value);
        this.state.setPotWiper(comp.id, pos);
        document.getElementById('pot-pct-display').textContent = `${(pos * 100).toFixed(0)}%`;
        document.getElementById('pot-r1w').textContent = `${Math.round(comp.value * pos)} Ω`;
        document.getElementById('pot-rw2').textContent = `${Math.round(comp.value * (1 - pos))} Ω`;
      });
    }

    document.getElementById('btn-rotate-comp')?.addEventListener('click', () => {
      this.state.rotateComponent(comp.id);
      this.renderComponentInspector(comp);
    });

    document.getElementById('btn-delete-comp')?.addEventListener('click', () => {
      this.state.removeComponent(comp.id);
      this.renderEmptyState();
    });
  }

  getEndpointLabel(id) {
    if (this.bb.holes.has(id)) {
      const h = this.bb.holes.get(id);
      return h.label;
    }
    // Instrument terminal friendly label
    const map = {
      FG1_OUT: 'FG1 Output (+)',
      FG1_GND: 'FG1 Ground (⏚)',
      FG2_OUT: 'FG2 Output (+)',
      FG2_GND: 'FG2 Ground (⏚)',
      PS1_POS: 'DC Supply (+VCC)',
      PS1_GND: 'DC Supply (0V)',
      OSC_CH1: 'Scope CH1 Probe (+)',
      OSC_CH1_GND: 'Scope CH1 GND Clip',
      OSC_CH2: 'Scope CH2 Probe (+)',
      OSC_CH2_GND: 'Scope CH2 GND Clip',
    };
    return map[id] || id;
  }

  renderWireInspector(wire) {
    const net = this.state.circuitGraph.getNetForHole(wire.fromHoleId);
    const labelFrom = this.getEndpointLabel(wire.fromHoleId);
    const labelTo = this.getEndpointLabel(wire.toHoleId);

    this.container.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-title">Jumper Wire</div>
        <span class="inspector-badge">WIRE</span>
      </div>

      <div class="inspector-body">
        <div class="form-group">
          <label class="form-label">Connection</label>
          <div class="wire-endpoints">
            <span class="hole-chip" title="${wire.fromHoleId}">${labelFrom}</span>
            <span class="arrow">➜</span>
            <span class="hole-chip" title="${wire.toHoleId}">${labelTo}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Shared Electrical Net</label>
          <div class="net-display">${net}</div>
        </div>

        <!-- Wire Color Selector -->
        <div class="form-group">
          <label class="form-label">Wire Color</label>
          <div class="color-palette-grid">
            ${WIRE_COLORS.map(
              (c) => `
              <button 
                class="color-btn ${wire.color === c.hex ? 'active' : ''}" 
                data-hex="${c.hex}" 
                style="background-color: ${c.hex};" 
                title="${c.name}">
              </button>
            `
            ).join('')}
          </div>
        </div>

        <!-- Actions -->
        <div class="inspector-actions">
          <button id="btn-delete-wire" class="btn btn-danger">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete Wire
          </button>
        </div>
      </div>
    `;

    const colorBtns = this.container.querySelectorAll('.color-btn');
    colorBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.setWireColor(wire.id, btn.dataset.hex);
        this.renderWireInspector(wire);
      });
    });

    document.getElementById('btn-delete-wire')?.addEventListener('click', () => {
      this.state.removeWire(wire.id);
      this.renderEmptyState();
    });
  }
}

