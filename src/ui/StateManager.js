/**
 * StateManager.js - Central State, Undo/Redo & Serialization
 * Part 1: Strict 1-item-per-hole enforcement via occupancyMap
 */

import { CircuitGraph } from '../core/CircuitGraph.js';
import { createWire } from '../core/WireModel.js';
import { createComponent, calculateResistorBands } from '../core/ComponentModel.js';

export class StateManager {
  constructor(breadboard) {
    this.bb = breadboard;
    this.circuitGraph = new CircuitGraph(breadboard);

    this.components = [];
    this.wires = [];

    // Part 1: Strict occupancy tracking { holeId -> { type: 'wire'|'component', id, end: 'from'|'to'|pinId } }
    this.occupancyMap = new Map();

    // Interaction state
    this.activeWireColor = '#EF4444'; // Default red
    this.pendingPlacement = null; // Component template being placed
    this.pendingHole = null; // Snapped hole for ghost
    this.selectedItem = null;
    this.fadeWires = false; // Part 2: Fade wires toggle

    // History stack for Undo/Redo
    this.undoStack = [];
    this.redoStack = [];

    // Event listeners
    this.listeners = new Set();
    this.selectionListeners = new Set();
    this.issuesListeners = new Set();
    this.toastListeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onSelection(listener) {
    this.selectionListeners.add(listener);
    return () => this.selectionListeners.delete(listener);
  }

  onIssues(listener) {
    this.issuesListeners.add(listener);
    return () => this.issuesListeners.delete(listener);
  }

  onToast(listener) {
    this.toastListeners.add(listener);
    return () => this.toastListeners.delete(listener);
  }

  showToast(message, type = 'error') {
    for (const listener of this.toastListeners) {
      try { listener(message, type); } catch (err) { /* ignore */ }
    }
  }

  notify() {
    this.circuitGraph.rebuild(this.components, this.wires);
    const issues = this.circuitGraph.analyzeIssues(this.components, this.wires);

    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (err) {
        console.error('Error in state listener:', err);
      }
    }

    for (const issueListener of this.issuesListeners) {
      try {
        issueListener(issues);
      } catch (err) {
        console.error('Error in issues listener:', err);
      }
    }
  }

  onSelectionChange(selected) {
    this.selectedItem = selected;
    for (const listener of this.selectionListeners) {
      try {
        listener(selected);
      } catch (err) {
        console.error('Error in selection listener:', err);
      }
    }
  }

  snapshot() {
    const stateCopy = {
      components: JSON.parse(JSON.stringify(this.components)),
      wires: JSON.parse(JSON.stringify(this.wires)),
    };
    this.undoStack.push(stateCopy);
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const current = {
      components: JSON.parse(JSON.stringify(this.components)),
      wires: JSON.parse(JSON.stringify(this.wires)),
    };
    this.redoStack.push(current);

    const prev = this.undoStack.pop();
    this.components = prev.components;
    this.wires = prev.wires;
    this.rebuildOccupancy();
    this.notify();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const current = {
      components: JSON.parse(JSON.stringify(this.components)),
      wires: JSON.parse(JSON.stringify(this.wires)),
    };
    this.undoStack.push(current);

    const next = this.redoStack.pop();
    this.components = next.components;
    this.wires = next.wires;
    this.rebuildOccupancy();
    this.notify();
  }

  // ─── Occupancy Map ────────────────────────────────────────────────────────

  /** Determine whether a holeId is a "real" breadboard hole (not a terminal ID) */
  _isBreadboardHole(holeId) {
    return this.bb.holes.has(holeId);
  }

  rebuildOccupancy() {
    this.occupancyMap.clear();
    for (const wire of this.wires) {
      if (this._isBreadboardHole(wire.fromHoleId)) {
        this.occupancyMap.set(wire.fromHoleId, { type: 'wire', id: wire.id, end: 'from' });
      }
      if (this._isBreadboardHole(wire.toHoleId)) {
        this.occupancyMap.set(wire.toHoleId, { type: 'wire', id: wire.id, end: 'to' });
      }
    }
    for (const comp of this.components) {
      for (const pin of comp.pins) {
        if (pin.holeId && this._isBreadboardHole(pin.holeId)) {
          this.occupancyMap.set(pin.holeId, { type: 'component', id: comp.id, pinId: pin.id });
        }
      }
    }
  }

  isHoleOccupied(holeId) {
    if (!this._isBreadboardHole(holeId)) return false; // instrument terminals can multi-connect
    return this.occupancyMap.has(holeId);
  }

  // ─── Wires Management ────────────────────────────────────────────────────

  addWire(fromHoleId, toHoleId, color = this.activeWireColor, { skipOccupancyCheck = false } = {}) {
    if (fromHoleId === toHoleId) return null;

    // Avoid duplicate identical wire
    const exists = this.wires.some(
      (w) =>
        (w.fromHoleId === fromHoleId && w.toHoleId === toHoleId) ||
        (w.fromHoleId === toHoleId && w.toHoleId === fromHoleId)
    );
    if (exists) {
      this.showToast('A wire already connects those two points.', 'warn');
      return null;
    }

    if (!skipOccupancyCheck) {
      // Check occupancy for breadboard holes only
      if (this._isBreadboardHole(fromHoleId) && this.occupancyMap.has(fromHoleId)) {
        this.showToast(`Hole ${fromHoleId} is already used. Use a different hole in the same strip.`, 'error');
        return null;
      }
      if (this._isBreadboardHole(toHoleId) && this.occupancyMap.has(toHoleId)) {
        this.showToast(`Hole ${toHoleId} is already used. Use a different hole in the same strip.`, 'error');
        return null;
      }
    }

    this.snapshot();
    const wire = createWire(fromHoleId, toHoleId, color);
    this.wires.push(wire);

    // Update occupancy
    if (this._isBreadboardHole(fromHoleId)) {
      this.occupancyMap.set(fromHoleId, { type: 'wire', id: wire.id, end: 'from' });
    }
    if (this._isBreadboardHole(toHoleId)) {
      this.occupancyMap.set(toHoleId, { type: 'wire', id: wire.id, end: 'to' });
    }

    this.notify();
    return wire;
  }

  removeWire(wireId) {
    const wire = this.wires.find((w) => w.id === wireId);
    if (!wire) return;
    this.snapshot();
    this.wires = this.wires.filter((w) => w.id !== wireId);
    // Remove from occupancy
    if (this._isBreadboardHole(wire.fromHoleId)) this.occupancyMap.delete(wire.fromHoleId);
    if (this._isBreadboardHole(wire.toHoleId)) this.occupancyMap.delete(wire.toHoleId);
    this.notify();
  }

  /**
   * Move a wire endpoint (end = 'from' or 'to') to a new hole, with occupancy checks.
   * Returns true on success, false if the new hole is occupied.
   */
  moveWireEnd(wireId, end, newHoleId) {
    const wire = this.wires.find((w) => w.id === wireId);
    if (!wire) return false;
    if (this._isBreadboardHole(newHoleId) && this.occupancyMap.has(newHoleId)) {
      // Check it's not the wire itself occupying it
      const occ = this.occupancyMap.get(newHoleId);
      if (!(occ.type === 'wire' && occ.id === wireId)) {
        this.showToast(`Hole ${newHoleId} is already used.`, 'error');
        return false;
      }
    }
    // Free old hole
    const oldHoleId = end === 'from' ? wire.fromHoleId : wire.toHoleId;
    if (this._isBreadboardHole(oldHoleId)) this.occupancyMap.delete(oldHoleId);

    // Update wire
    this.snapshot();
    if (end === 'from') wire.fromHoleId = newHoleId;
    else wire.toHoleId = newHoleId;

    // Set new occupancy
    if (this._isBreadboardHole(newHoleId)) {
      this.occupancyMap.set(newHoleId, { type: 'wire', id: wireId, end });
    }
    this.notify();
    return true;
  }

  setWireColor(wireId, color) {
    const wire = this.wires.find((w) => w.id === wireId);
    if (wire) {
      this.snapshot();
      wire.color = color;
      this.notify();
    }
  }

  bringWireToFront(wireId) {
    const idx = this.wires.findIndex((w) => w.id === wireId);
    if (idx >= 0 && idx < this.wires.length - 1) {
      const [wire] = this.wires.splice(idx, 1);
      this.wires.push(wire);
      this.notify();
    }
  }

  sendWireToBack(wireId) {
    const idx = this.wires.findIndex((w) => w.id === wireId);
    if (idx > 0) {
      const [wire] = this.wires.splice(idx, 1);
      this.wires.unshift(wire);
      this.notify();
    }
  }

  // ─── Components Management ────────────────────────────────────────────────

  startPlacement(componentType, customProps = {}) {
    this.pendingPlacement = createComponent(componentType, customProps);
    this.pendingHole = null;
  }

  commitPendingPlacement(anchorHoleId) {
    if (!this.pendingPlacement || !anchorHoleId) return false;

    const comp = this.pendingPlacement;
    comp.anchorHoleId = anchorHoleId;
    this.calculatePinPlacements(comp, anchorHoleId);

    // Check all pin target holes for occupancy
    for (const pin of comp.pins) {
      if (pin.holeId && this._isBreadboardHole(pin.holeId) && this.occupancyMap.has(pin.holeId)) {
        this.showToast(`Hole ${pin.holeId} is already used. Try a different position.`, 'error');
        return false;
      }
    }

    // Also validate no two pins land on the same strip (would short the component itself)
    if (comp.pins.length >= 2 && comp.pins[0].holeId && comp.pins[1].holeId) {
      this.circuitGraph.rebuild(this.components, this.wires);
      const net0 = this.circuitGraph.getNetForHole(comp.pins[0].holeId);
      const net1 = this.circuitGraph.getNetForHole(comp.pins[1].holeId);
      if (net0 === net1) {
        this.showToast(
          `Component leads would land on the same strip (${comp.pins[0].holeId} & ${comp.pins[1].holeId}). Try rotating or moving it.`,
          'error'
        );
        return false;
      }
    }

    this.snapshot();
    this.components.push(comp);

    // Update occupancy for all pins
    for (const pin of comp.pins) {
      if (pin.holeId && this._isBreadboardHole(pin.holeId)) {
        this.occupancyMap.set(pin.holeId, { type: 'component', id: comp.id, pinId: pin.id });
      }
    }

    this.pendingPlacement = null;
    this.pendingHole = null;
    this.onSelectionChange({ type: 'component', id: comp.id });
    this.notify();
    return true;
  }

  updateComponentAnchor(componentId, newAnchorHoleId) {
    const comp = this.components.find((c) => c.id === componentId);
    if (!comp) return;

    // Free old pin occupancy
    for (const pin of comp.pins) {
      if (pin.holeId && this._isBreadboardHole(pin.holeId)) {
        const occ = this.occupancyMap.get(pin.holeId);
        if (occ && occ.id === componentId) {
          this.occupancyMap.delete(pin.holeId);
        }
      }
    }

    comp.anchorHoleId = newAnchorHoleId;
    this.calculatePinPlacements(comp, newAnchorHoleId);

    // Re-register new occupancy
    for (const pin of comp.pins) {
      if (pin.holeId && this._isBreadboardHole(pin.holeId)) {
        this.occupancyMap.set(pin.holeId, { type: 'component', id: componentId, pinId: pin.id });
      }
    }

    this.notify();
  }

  rotateComponent(componentId) {
    const comp = this.components.find((c) => c.id === componentId);
    if (!comp) return;

    // DIP ICs cannot rotate freely (they must straddle the center gap)
    if (comp.type === 'ic_555' || comp.type === 'ic_8038') {
      return;
    }

    this.snapshot();
    comp.rotation = (comp.rotation + 90) % 360;

    // Rotate pin relative offsets (90 deg clockwise: (col, row) -> (-row, col))
    for (const pin of comp.pins) {
      const oldCol = pin.relCol;
      const oldRow = pin.relRow;
      pin.relCol = -oldRow;
      pin.relRow = oldCol;
    }

    if (comp.anchorHoleId) {
      // Free old occupancy
      for (const pin of comp.pins) {
        if (pin.holeId && this._isBreadboardHole(pin.holeId)) {
          this.occupancyMap.delete(pin.holeId);
        }
      }
      this.calculatePinPlacements(comp, comp.anchorHoleId);
      // Re-register
      for (const pin of comp.pins) {
        if (pin.holeId && this._isBreadboardHole(pin.holeId)) {
          this.occupancyMap.set(pin.holeId, { type: 'component', id: componentId, pinId: pin.id });
        }
      }
    }
    this.notify();
  }

  removeComponent(componentId) {
    const comp = this.components.find((c) => c.id === componentId);
    if (comp) {
      for (const pin of comp.pins) {
        if (pin.holeId && this._isBreadboardHole(pin.holeId)) {
          this.occupancyMap.delete(pin.holeId);
        }
      }
    }
    this.snapshot();
    this.components = this.components.filter((c) => c.id !== componentId);
    this.notify();
  }

  setComponentValue(componentId, newValue) {
    const comp = this.components.find((c) => c.id === componentId);
    if (!comp) return;

    this.snapshot();
    comp.value = newValue;

    if (comp.type === 'resistor') {
      comp.properties.colorBands = calculateResistorBands(newValue);
      comp.displayValue = `${newValue} Ω`;
    } else if (comp.type === 'potentiometer' || comp.type === 'rheostat') {
      comp.properties.maxResistance = newValue;
      comp.properties.activeResistance = Math.round(newValue * (comp.properties.wiperPos ?? 0.5));
    }
    this.notify();
  }

  setPotWiper(componentId, wiperPos) {
    const comp = this.components.find((c) => c.id === componentId);
    if (!comp) return;

    comp.properties.wiperPos = Math.max(0, Math.min(1, wiperPos));
    comp.properties.activeResistance = Math.round(comp.value * comp.properties.wiperPos);
    this.notify();
  }

  // Maps component pin relative offsets to exact breadboard hole IDs
  calculatePinPlacements(comp, anchorHoleId) {
    const anchor = this.bb.holes.get(anchorHoleId);
    if (!anchor) return;

    const rowOrder = ['TP', 'TN', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'BP', 'BN'];
    const anchorRowIndex = rowOrder.indexOf(anchor.rowId);

    for (const pin of comp.pins) {
      const targetCol = anchor.colIndex + pin.relCol;
      const targetRowIndex = anchorRowIndex + pin.relRow;

      if (
        targetCol >= 1 &&
        targetCol <= this.bb.config.columns &&
        targetRowIndex >= 0 &&
        targetRowIndex < rowOrder.length
      ) {
        const targetRowId = rowOrder[targetRowIndex];
        let targetHoleId;
        if (targetRowId.startsWith('T') || targetRowId.startsWith('B')) {
          targetHoleId = `${targetRowId}-${targetCol}`;
        } else {
          targetHoleId = `${targetCol}-${targetRowId}`;
        }

        if (this.bb.holes.has(targetHoleId)) {
          pin.holeId = targetHoleId;
        } else {
          pin.holeId = undefined;
        }
      } else {
        pin.holeId = undefined;
      }
    }
  }

  clearCircuit() {
    this.snapshot();
    this.components = [];
    this.wires = [];
    this.selectedItem = null;
    this.occupancyMap.clear();
    this.notify();
  }

  exportJSON() {
    return JSON.stringify(
      {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        components: this.components,
        wires: this.wires,
      },
      null,
      2
    );
  }

  loadJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.components) && Array.isArray(data.wires)) {
        this.snapshot();
        this.components = data.components;
        this.wires = data.wires;
        this.selectedItem = null;
        this.rebuildOccupancy();
        this.notify();
        return true;
      }
    } catch (err) {
      console.error('Failed to parse circuit JSON:', err);
    }
    return false;
  }
}
