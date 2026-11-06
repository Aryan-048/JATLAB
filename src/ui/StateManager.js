/**
 * StateManager.js - Central State, Undo/Redo & Serialization
 * Part 1: Strict 1-item-per-hole enforcement via occupancyMap
 */

import { CircuitGraph } from '../core/CircuitGraph.js';
import { createWire } from '../core/WireModel.js';
import { createComponent, calculateResistorBands, formatCapacitance, formatInductance } from '../core/ComponentModel.js';

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

  /**
   * DIP packages always straddle the centre gap: pin 1's row is E,
   * the opposite row is F. The clicked column is kept, shifted inward
   * if the package would run off the right edge.
   */
  resolveAnchor(comp, holeId) {
    if (!comp || !holeId) return holeId;
    if (comp.type !== 'ic_555' && comp.type !== 'ic_8038') return holeId;
    const hole = this.bb.holes.get(holeId);
    if (!hole) return holeId;
    const span = Math.max(...comp.pins.map((p) => p.relCol));
    let col = hole.colIndex;
    const maxCol = this.bb.config.columns - span;
    if (col > maxCol) col = maxCol;
    if (col < 1) col = 1;
    return `${col}-E`;
  }

  /** Where each pin would land, without writing those holes onto the part. */
  projectPins(comp, anchorHoleId) {
    const anchorId = this.resolveAnchor(comp, anchorHoleId);
    const anchor = this.bb.holes.get(anchorId);
    if (!anchor) return [];
    const rowOrder = ['TP', 'TN', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'BP', 'BN'];
    const anchorRowIndex = rowOrder.indexOf(anchor.rowId);
    return comp.pins.map((pin) => {
      const targetCol = anchor.colIndex + pin.relCol;
      const targetRowIndex = anchorRowIndex + pin.relRow;
      if (
        targetCol < 1 ||
        targetCol > this.bb.config.columns ||
        targetRowIndex < 0 ||
        targetRowIndex >= rowOrder.length
      ) {
        return null;
      }
      const targetRowId = rowOrder[targetRowIndex];
      const isRail = targetRowId === 'TP' || targetRowId === 'TN' || targetRowId === 'BP' || targetRowId === 'BN';
      const targetHoleId = isRail ? `${targetRowId}-${targetCol}` : `${targetCol}-${targetRowId}`;
      const hole = this.bb.holes.get(targetHoleId);
      if (!hole) return null;
      return { id: pin.id, name: pin.name, holeId: hole.id, x: hole.x, y: hole.y, stripId: hole.stripId };
    });
  }

  /**
   * Returns a user-facing reason the projected pins cannot be placed, or null.
   * `ignoreComponentId` is the part being moved, whose current holes are free.
   */
  placementProblem(comp, anchorHoleId, ignoreComponentId = null) {
    const projected = this.projectPins(comp, anchorHoleId);
    if (projected.length !== comp.pins.length || projected.some((p) => !p)) {
      return 'That part does not fit on the board there.';
    }
    const strips = new Set();
    for (const pin of projected) {
      if (strips.has(pin.stripId)) {
        return 'Component leads would land on the same strip. Move or rotate it.';
      }
      strips.add(pin.stripId);
      if (!this._isBreadboardHole(pin.holeId)) continue;
      const occ = this.occupancyMap.get(pin.holeId);
      if (occ && occ.id !== ignoreComponentId) return 'Hole already used';
    }
    return null;
  }

  // ─── Wires Management ────────────────────────────────────────────────────

  addWire(fromHoleId, toHoleId, color = this.activeWireColor) {
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

    if (this._isBreadboardHole(fromHoleId) && this.occupancyMap.has(fromHoleId)) {
      this.showToast('Hole already used', 'error');
      return null;
    }
    if (this._isBreadboardHole(toHoleId) && this.occupancyMap.has(toHoleId)) {
      this.showToast('Hole already used', 'error');
      return null;
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
        this.showToast('Hole already used', 'error');
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
    anchorHoleId = this.resolveAnchor(comp, anchorHoleId);
    const problem = this.placementProblem(comp, anchorHoleId);
    if (problem) {
      this.showToast(problem, 'error');
      return false;
    }

    comp.anchorHoleId = anchorHoleId;
    this.calculatePinPlacements(comp, anchorHoleId);

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

    newAnchorHoleId = this.resolveAnchor(comp, newAnchorHoleId);
    if (newAnchorHoleId === comp.anchorHoleId) return;

    const problem = this.placementProblem(comp, newAnchorHoleId, componentId);
    if (problem) {
      const key = `${problem}|${newAnchorHoleId}`;
      if (this._lastReject !== key) {
        this._lastReject = key;
        this.showToast(problem, 'error');
      }
      return;
    }
    this._lastReject = null;

    this._releaseComponent(comp);
    comp.anchorHoleId = newAnchorHoleId;
    this.calculatePinPlacements(comp, newAnchorHoleId);
    this._claimComponent(comp);
    this.notify();
  }

  rotateComponent(componentId) {
    const comp = this.components.find((c) => c.id === componentId);
    if (!comp) return;

    // DIP ICs cannot rotate freely (they must straddle the center gap)
    if (comp.type === 'ic_555' || comp.type === 'ic_8038') {
      return;
    }

    const savedRels = comp.pins.map((p) => ({ relCol: p.relCol, relRow: p.relRow }));
    for (const pin of comp.pins) {
      const oldCol = pin.relCol;
      const oldRow = pin.relRow;
      pin.relCol = -oldRow;
      pin.relRow = oldCol;
    }

    if (comp.anchorHoleId) {
      const problem = this.placementProblem(comp, comp.anchorHoleId, componentId);
      if (problem) {
        comp.pins.forEach((p, i) => {
          p.relCol = savedRels[i].relCol;
          p.relRow = savedRels[i].relRow;
        });
        this.showToast(problem, 'error');
        return;
      }
    }

    const rotated = comp.pins.map((p) => ({ relCol: p.relCol, relRow: p.relRow }));
    comp.pins.forEach((p, i) => {
      p.relCol = savedRels[i].relCol;
      p.relRow = savedRels[i].relRow;
    });
    this.snapshot();
    comp.pins.forEach((p, i) => {
      p.relCol = rotated[i].relCol;
      p.relRow = rotated[i].relRow;
    });
    comp.rotation = (comp.rotation + 90) % 360;

    if (comp.anchorHoleId) {
      this._releaseComponent(comp);
      this.calculatePinPlacements(comp, comp.anchorHoleId);
      this._claimComponent(comp);
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
    } else if (comp.type === 'capacitor') {
      comp.displayValue = formatCapacitance(newValue);
    } else if (comp.type === 'inductor') {
      comp.displayValue = formatInductance(newValue);
    } else if (comp.type === 'potentiometer' || comp.type === 'rheostat') {
      comp.properties.maxResistance = newValue;
      comp.properties.activeResistance = Math.round(newValue * (comp.properties.wiperPos ?? 0.5));
    }
    this.notify();
  }

  swapPins(componentId, pinA, pinB) {
    const comp = this.components.find((c) => c.id === componentId);
    if (!comp) return false;
    const a = comp.pins.find((p) => p.id === pinA);
    const b = comp.pins.find((p) => p.id === pinB);
    if (!a || !b) return false;
    this.snapshot();
    for (const key of ['holeId', 'relCol', 'relRow', 'x', 'y']) {
      const tmp = a[key];
      a[key] = b[key];
      b[key] = tmp;
    }
    this.rebuildOccupancy();
    this.notify();
    return true;
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
    const projected = this.projectPins(comp, anchorHoleId);
    comp.pins.forEach((pin, i) => {
      pin.holeId = projected[i]?.holeId;
    });
  }

  _releaseComponent(comp) {
    for (const pin of comp.pins) {
      if (pin.holeId && this._isBreadboardHole(pin.holeId)) {
        const occ = this.occupancyMap.get(pin.holeId);
        if (occ && occ.id === comp.id) this.occupancyMap.delete(pin.holeId);
      }
    }
  }

  _claimComponent(comp) {
    for (const pin of comp.pins) {
      if (pin.holeId && this._isBreadboardHole(pin.holeId)) {
        this.occupancyMap.set(pin.holeId, { type: 'component', id: comp.id, pinId: pin.id });
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
