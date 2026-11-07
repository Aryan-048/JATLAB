/**
 * BreadboardCanvas.js - Interactive HTML5 Canvas Renderer
 * Parts 1 & 2: Arc wires, proper layering, wire/hole hit priority, fade-wires, end-handle drag
 */

export const HOLE_HIT_RADIUS = 8;
export const WIRE_HIT_RADIUS = 5;

/** Closest breadboard hole whose centre is within radius, or null. */
export function nearestHoleWithin(holes, x, y, radius) {
  let best = null;
  let bestD = radius;
  const list = holes?.values ? holes.values() : holes;
  for (const hole of list) {
    const d = Math.hypot(hole.x - x, hole.y - y);
    if (d <= bestD) {
      best = hole;
      bestD = d;
    }
  }
  return best;
}

/** Minimum distance from a point to a quadratic curve, sampled along its length. */
export function minDistanceToQuadratic(h1, h2, cpX, cpY, x, y) {
  let best = Infinity;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    const bx = u * u * h1.x + 2 * u * t * cpX + t * t * h2.x;
    const by = u * u * h1.y + 2 * u * t * cpY + t * t * h2.y;
    const d = Math.hypot(x - bx, y - by);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Select-mode hit. A hole wins inside its 8 px circle.
 * Otherwise the nearest wire within the 10 px-wide stroke wins.
 * `wires` is back-to-front; the last entry is painted on top and wins ties.
 */
export function pointerTarget(x, y, holes, wires) {
  const hole = nearestHoleWithin(holes, x, y, HOLE_HIT_RADIUS);
  if (hole) return { type: 'hole', id: hole.id, hole };
  let best = null;
  let bestD = WIRE_HIT_RADIUS;
  for (let i = wires.length - 1; i >= 0; i--) {
    const wire = wires[i];
    const d = minDistanceToQuadratic(wire.h1, wire.h2, wire.cpX, wire.cpY, x, y);
    if (d <= bestD) {
      best = wire;
      bestD = d;
    }
  }
  if (best) return { type: 'wire', id: best.id, dist: bestD };
  return null;
}

export class BreadboardCanvas {
  constructor(canvasElement, breadboard, stateManager) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.bb = breadboard;
    this.state = stateManager;

    // Viewport transform
    this.scale = 1.0;
    this.panX = 30;
    this.panY = 30;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    // Interaction state
    this.hoveredHole = null;
    this.hoveredWireId = null;
    this.activeStripHoles = [];
    this.wireStartHole = null;
    this.guideGhost = null;
    this.mouseCanvasPos = { x: 0, y: 0 };
    this.selectedItem = null; // { type: 'component' | 'wire' | 'hole', id }
    this.tool = 'select'; // 'select' | 'wire'
    this.draggingComponent = null;
    this.dragOffset = { x: 0, y: 0 };

    // Part 2: Wire end handle dragging
    this.draggingWireEnd = null; // { wireId, end: 'from'|'to' }
    this.draggingWireEndTarget = null; // candidate hole being hovered during drag

    // Part 2: Waypoint dragging
    this.draggingWaypoint = null; // { wireId, index }

    // Part 4: Highlight support for CircuitChecker "Show me"
    this.highlightHoles = [];
    this.highlightComponentId = null;

    this.initCanvasSize();
    this.bindEvents();
    this.render();
  }

  initCanvasSize() {
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth || 1200;
    const height = parent.clientHeight || 750;
    if (width === this.width && height === this.height && this.canvas.width > 0) return;

    this.width = width;
    this.height = height;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.initCanvasSize();
      this.render();
    });

    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => {
        this.initCanvasSize();
        this.render();
      });
      this._resizeObserver.observe(this.canvas.parentElement);
    }

    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancelAction();
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'r' || e.key === 'R') {
        this.rotateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelected();
      } else if (e.key === 'Escape') {
        this.cancelAction();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        this.state.undo();
        this.render();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        this.state.redo();
        this.render();
      }
    });
  }

  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (screenX - rect.left - this.panX) / this.scale;
    const y = (screenY - rect.top - this.panY) / this.scale;
    return { x, y };
  }

  handleMouseMove(e) {
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.mouseCanvasPos = world;

    if (this.isPanning) {
      this.panX = e.clientX - this.panStartX;
      this.panY = e.clientY - this.panStartY;
      this.render();
      return;
    }

    // Part 2: Wire end handle dragging
    if (this.draggingWireEnd) {
      const nearestHole = this.bb.findNearestHole(world.x, world.y, 18);
      this.draggingWireEndTarget = nearestHole || null;
      this.canvas.style.cursor = nearestHole ? 'crosshair' : 'grabbing';
      this.render();
      return;
    }

    if (this.draggingWaypoint) {
      const wire = this.state.wires.find((w) => w.id === this.draggingWaypoint.wireId);
      if (wire) {
        if (!wire.waypoints) wire.waypoints = [];
        wire.waypoints[this.draggingWaypoint.index] = { x: world.x, y: world.y };
        this.render();
        return;
      }
    }

    if (this.draggingComponent) {
      const nearest = this.bb.findNearestHole(world.x + this.dragOffset.x, world.y + this.dragOffset.y, 25);
      if (nearest) {
        const snapped = this.state.resolveAnchor(this.draggingComponent, nearest.id);
        this.state.updateComponentAnchor(this.draggingComponent.id, snapped);
      }
      this.render();
      return;
    }

    // Ghost component placement from palette
    if (this.state.pendingPlacement) {
      const nearest = this.bb.findNearestHole(world.x, world.y, 25);
      this.state.pendingHole = nearest
        ? this.state.resolveAnchor(this.state.pendingPlacement, nearest.id)
        : null;
      this.render();
      return;
    }

    // Hover: one target. Hole inside 8 px, otherwise the wire stroke.
    const hit = this._pointerHit(world.x, world.y);
    const nextHole = hit?.type === 'hole' ? hit.hole : null;
    const nextWire = hit?.type === 'wire' ? hit.id : null;
    if (nextHole !== this.hoveredHole || nextWire !== this.hoveredWireId) {
      this.hoveredHole = nextHole;
      this.hoveredWireId = nextWire;
      this.activeStripHoles = nextHole ? this.bb.getHolesInStrip(nextHole.id) : [];
      this.canvas.style.cursor = this.tool === 'wire'
        ? 'crosshair'
        : nextHole
          ? 'crosshair'
          : nextWire
            ? 'pointer'
            : 'default';
      this.render();
    }
  }

  handleMouseDown(e) {
    const world = this.screenToWorld(e.clientX, e.clientY);

    // Pan: middle mouse or shift+click
    if (e.button === 1 || e.shiftKey) {
      this.isPanning = true;
      this.panStartX = e.clientX - this.panX;
      this.panStartY = e.clientY - this.panY;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button !== 0) return;

    // 1. If pending placement from palette, commit it
    if (this.state.pendingPlacement) {
      const nearest = this.bb.findNearestHole(world.x, world.y, 20);
      if (nearest) {
        this.state.commitPendingPlacement(nearest.id);
        this.render();
      }
      return;
    }

    // Wire tool: holes only. Select tool: hole inside 8 px, else wire, else part body.
    if (this.tool === 'wire') {
      const holeForWire = this.bb.findNearestHole(world.x, world.y, 14);
      if (holeForWire) {
        if (!this.wireStartHole) {
          this.wireStartHole = holeForWire;
        } else if (this.wireStartHole.id !== holeForWire.id) {
          this.state.addWire(this.wireStartHole.id, holeForWire.id);
          this.wireStartHole = null;
        }
        this.render();
      }
      return;
    }

    if (e.altKey) {
      this._altCycleAt(world.x, world.y);
      return;
    }

    const endHandle = this.findWireEndHandleAt(world.x, world.y);
    if (endHandle) {
      this.draggingWireEnd = endHandle;
      this.selectedItem = { type: 'wire', id: endHandle.wireId };
      this.state.onSelectionChange(this.selectedItem);
      this.canvas.style.cursor = 'grabbing';
      this.render();
      return;
    }

    const hit = this._pointerHit(world.x, world.y);
    if (hit?.type === 'hole') {
      this.selectedItem = { type: 'hole', id: hit.hole.id };
      this.hoveredHole = hit.hole;
      this.hoveredWireId = null;
      this.activeStripHoles = this.bb.getHolesInStrip(hit.hole.id);
      this.wireStartHole = null;
      this.state.onSelectionChange(this.selectedItem);
      this.render();
      return;
    }

    if (hit?.type === 'wire') {
      this.selectedItem = { type: 'wire', id: hit.id };
      this.hoveredHole = null;
      this.activeStripHoles = [];
      this.state.onSelectionChange(this.selectedItem);
      this.render();
      return;
    }

    const clickedComp = this.findComponentBodyAt(world.x, world.y);
    if (clickedComp) {
      this.selectedItem = { type: 'component', id: clickedComp.id };
      this.draggingComponent = clickedComp;
      const anchorHole = clickedComp.anchorHoleId
        ? this.bb.holes.get(clickedComp.anchorHoleId)
        : null;
      if (anchorHole) {
        this.dragOffset = { x: anchorHole.x - world.x, y: anchorHole.y - world.y };
      } else {
        this.dragOffset = { x: 0, y: 0 };
      }
      this.state.onSelectionChange(this.selectedItem);
      this.render();
      return;
    }

    this.selectedItem = null;
    this.wireStartHole = null;
    this.state.onSelectionChange(null);
    this.render();
  }

  handleMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = 'default';
    }

    // Part 2: Wire end handle drop
    if (this.draggingWireEnd) {
      if (this.draggingWireEndTarget) {
        const { wireId, end } = this.draggingWireEnd;
        this.state.moveWireEnd(wireId, end, this.draggingWireEndTarget.id);
      }
      this.draggingWireEnd = null;
      this.draggingWireEndTarget = null;
      this.canvas.style.cursor = 'default';
      this.render();
      return;
    }

    if (this.draggingComponent) {
      this.state.snapshot();
      this.draggingComponent = null;
    }
    if (this.draggingWaypoint) {
      this.state.snapshot();
      this.draggingWaypoint = null;
    }
  }

  handleWheel(e) {
    e.preventDefault();
    const zoomFactor = 1.1;
    const oldScale = this.scale;

    if (e.deltaY < 0) {
      this.scale = Math.min(2.5, this.scale * zoomFactor);
    } else {
      this.scale = Math.max(0.4, this.scale / zoomFactor);
    }

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.panX = mouseX - ((mouseX - this.panX) * this.scale) / oldScale;
    this.panY = mouseY - ((mouseY - this.panY) * this.scale) / oldScale;

    this._syncZoomLabel();
    this.render();
  }

  cancelAction() {
    this.wireStartHole = null;
    this.state.pendingPlacement = null;
    this.state.pendingHole = null;
    this.draggingComponent = null;
    this.draggingWaypoint = null;
    this.draggingWireEnd = null;
    this.draggingWireEndTarget = null;
    this.render();
  }

  rotateSelected() {
    if (this.selectedItem && this.selectedItem.type === 'component') {
      this.state.rotateComponent(this.selectedItem.id);
      this.render();
    } else if (this.state.pendingPlacement) {
      this.state.pendingPlacement.rotation = (this.state.pendingPlacement.rotation + 90) % 360;
      this.render();
    }
  }

  deleteSelected() {
    if (!this.selectedItem) return;
    if (this.selectedItem.type === 'component') {
      this.state.removeComponent(this.selectedItem.id);
    } else if (this.selectedItem.type === 'wire') {
      this.state.removeWire(this.selectedItem.id);
    }
    this.selectedItem = null;
    this.state.onSelectionChange(null);
    this.render();
  }

  zoomIn() { this.scale = Math.min(2.5, this.scale * 1.2); this._syncZoomLabel(); this.render(); }
  zoomOut() { this.scale = Math.max(0.4, this.scale / 1.2); this._syncZoomLabel(); this.render(); }
  resetZoom() { this.scale = 1.0; this.panX = 30; this.panY = 30; this._syncZoomLabel(); this.render(); }

  _syncZoomLabel() {
    const el = document.getElementById('btn-zoom-reset');
    if (el) el.textContent = `${Math.round(this.scale * 100)}%`;
  }

  setTool(tool) {
    this.tool = tool === 'wire' ? 'wire' : 'select';
    if (this.tool !== 'wire') this.wireStartHole = null;
    document.getElementById('btn-tool-select')?.classList.toggle('active', this.tool === 'select');
    document.getElementById('btn-tool-wire')?.classList.toggle('active', this.tool === 'wire');
    this.canvas.style.cursor = this.tool === 'wire' ? 'crosshair' : 'default';
    this.render();
  }

  _wireSamples() {
    const samples = [];
    for (const wire of this.state.wires) {
      const h1 = this.getEndpointCoord(wire.fromHoleId);
      const h2 = this.getEndpointCoord(wire.toHoleId);
      if (!h1 || !h2) continue;
      const { cpX, cpY } = this._computeArcCp(h1, h2, wire);
      samples.push({ id: wire.id, h1, h2, cpX, cpY });
    }
    return samples;
  }

  _pointerHit(x, y) {
    return pointerTarget(x, y, this.bb.holes, this._wireSamples());
  }

  _stackedTargets(x, y) {
    const targets = [];
    const hole = nearestHoleWithin(this.bb.holes, x, y, HOLE_HIT_RADIUS);
    if (hole) targets.push({ type: 'hole', id: hole.id, hole });
    for (const sample of this._wireSamples().slice().reverse()) {
      const d = minDistanceToQuadratic(sample.h1, sample.h2, sample.cpX, sample.cpY, x, y);
      if (d <= WIRE_HIT_RADIUS) targets.push({ type: 'wire', id: sample.id });
    }
    for (let i = this.state.components.length - 1; i >= 0; i--) {
      const comp = this.state.components[i];
      const onLead = comp.pins.some((pin) => {
        const h = pin.holeId && this.bb.holes.get(pin.holeId);
        return h && Math.hypot(h.x - x, h.y - y) <= HOLE_HIT_RADIUS;
      });
      if (onLead) targets.push({ type: 'component', id: comp.id });
    }
    const body = this.findComponentBodyAt(x, y);
    if (body && !targets.some((t) => t.type === 'component' && t.id === body.id)) {
      targets.push({ type: 'component', id: body.id });
    }
    return targets;
  }

  // ─── Alt+Click Cycle ──────────────────────────────────────────────────────
  _altCycleAt(x, y) {
    const targets = this._stackedTargets(x, y);
    if (targets.length === 0) return;
    const curIdx = targets.findIndex(
      (t) => t.type === this.selectedItem?.type && t.id === this.selectedItem?.id
    );
    const next = targets[(curIdx + 1) % targets.length];
    this.selectedItem = { type: next.type, id: next.id };
    if (next.type === 'hole') {
      this.hoveredHole = next.hole;
      this.hoveredWireId = null;
      this.activeStripHoles = this.bb.getHolesInStrip(next.id);
    } else if (next.type === 'wire') {
      this.hoveredHole = null;
      this.hoveredWireId = next.id;
      this.activeStripHoles = [];
    }
    this.state.onSelectionChange(this.selectedItem);
    this.render();
  }

  // ─── Rendering Pipeline ───────────────────────────────────────────────────

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, this.scale);

    // Layer order: breadboard base → strip highlight → holes → components → wires → wire end handles → pending → HUD
    this.drawBreadboardBase(ctx);
    this.drawStripHighlight(ctx);
    this.drawHoles(ctx);
    this.drawComponents(ctx);
    this.drawWires(ctx);
    this.drawWireEndHandles(ctx);  // Part 2: on top of wires
    this.drawPendingWire(ctx);
    this.drawGuideGhost(ctx);
    this.drawPendingComponent(ctx);
    this.drawIssueHighlights(ctx); // Part 4: "Show me" highlights

    ctx.restore();

    this.drawHUD(ctx);
  }

  drawBreadboardBase(ctx) {
    const { originX, originY, pitch, columns, centerGap } = this.bb.config;
    const bbWidth = columns * pitch + originX;
    const bbHeight = this.bb.height;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;

    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;

    const cornerRadius = 14;
    ctx.beginPath();
    ctx.roundRect(20, 15, bbWidth + 40, bbHeight + 20, cornerRadius);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent';

    ctx.fillStyle = '#E2E8F0';
    for (let x = 60; x < bbWidth; x += 140) {
      ctx.fillRect(x, 15, 20, 4);
      ctx.fillRect(x, bbHeight + 31, 20, 4);
    }

    const y_TP = originY;
    const y_TN = y_TP + pitch;
    const y_BP = y_TN + 24 + 4 * pitch + centerGap + 4 * pitch + 24;
    const y_BN = y_BP + pitch;

    const lineStartX = originX - 10;
    const lineEndX = originX + (columns - 1) * pitch + 10;

    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(lineStartX, y_TP - 11); ctx.lineTo(lineEndX, y_TP - 11); ctx.stroke();

    ctx.strokeStyle = '#3B82F6';
    ctx.beginPath(); ctx.moveTo(lineStartX, y_TN + 11); ctx.lineTo(lineEndX, y_TN + 11); ctx.stroke();

    ctx.strokeStyle = '#EF4444';
    ctx.beginPath(); ctx.moveTo(lineStartX, y_BP - 11); ctx.lineTo(lineEndX, y_BP - 11); ctx.stroke();

    ctx.strokeStyle = '#3B82F6';
    ctx.beginPath(); ctx.moveTo(lineStartX, y_BN + 11); ctx.lineTo(lineEndX, y_BN + 11); ctx.stroke();

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#EF4444';
    ctx.fillText('+', lineStartX - 14, y_TP); ctx.fillText('+', lineEndX + 14, y_TP);
    ctx.fillText('+', lineStartX - 14, y_BP); ctx.fillText('+', lineEndX + 14, y_BP);

    ctx.fillStyle = '#3B82F6';
    ctx.fillText('-', lineStartX - 14, y_TN); ctx.fillText('-', lineEndX + 14, y_TN);
    ctx.fillText('-', lineStartX - 14, y_BN); ctx.fillText('-', lineEndX + 14, y_BN);

    const y_E = y_TN + 24 + 4 * pitch;
    const troughY = y_E + centerGap / 2;
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.roundRect(lineStartX - 10, troughY - 8, (lineEndX - lineStartX) + 20, 16, 4);
    ctx.fill();

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '10px monospace';
    for (let c = 1; c <= columns; c++) {
      if (c === 1 || c % 5 === 0 || c === columns) {
        const x = originX + (c - 1) * pitch;
        ctx.fillText(c.toString(), x, troughY);
      }
    }

    const letterLabels = [
      { letter: 'A', y: y_TN + 24 },
      { letter: 'B', y: y_TN + 24 + pitch },
      { letter: 'C', y: y_TN + 24 + 2 * pitch },
      { letter: 'D', y: y_TN + 24 + 3 * pitch },
      { letter: 'E', y: y_TN + 24 + 4 * pitch },
      { letter: 'F', y: y_E + centerGap },
      { letter: 'G', y: y_E + centerGap + pitch },
      { letter: 'H', y: y_E + centerGap + 2 * pitch },
      { letter: 'I', y: y_E + centerGap + 3 * pitch },
      { letter: 'J', y: y_E + centerGap + 4 * pitch },
    ];

    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillStyle = '#94A3B8';
    for (const { letter, y } of letterLabels) {
      ctx.fillText(letter, originX - 22, y);
      ctx.fillText(letter, lineEndX + 22, y);
    }
  }

  drawStripHighlight(ctx) {
    if (!this.activeStripHoles || this.activeStripHoles.length === 0) return;

    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;

    for (const hole of this.activeStripHoles) {
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHoles(ctx) {
    const holeRadius = 3.6;

    for (const hole of this.bb.holes.values()) {
      // Occupied indicator
      const isOccupied = this.state.occupancyMap.has(hole.id);

      ctx.fillStyle = isOccupied ? '#6B7280' : '#CBD5E1';
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, holeRadius + 0.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isOccupied ? '#374151' : '#1E293B';
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, holeRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#64748B';
      ctx.fillRect(hole.x - 1, hole.y - 2.5, 2, 5);
    }

    // Hovered hole highlight
    if (this.hoveredHole) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.hoveredHole.x, this.hoveredHole.y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Wire start hole highlight
    if (this.wireStartHole) {
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.wireStartHole.x, this.wireStartHole.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Wire end drag target highlight
    if (this.draggingWireEnd && this.draggingWireEndTarget) {
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.draggingWireEndTarget.x, this.draggingWireEndTarget.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ─── Components Rendering ─────────────────────────────────────────────────

  drawComponents(ctx) {
    for (const comp of this.state.components) {
      this.drawSingleComponent(ctx, comp, comp.id === this.selectedItem?.id);
    }
  }

  drawSingleComponent(ctx, comp, isSelected) {
    if (!comp.pins || comp.pins.length === 0) return;

    const pinCoords = comp.pins.map((p) => {
      if (p.holeId && this.bb.holes.has(p.holeId)) {
        const h = this.bb.holes.get(p.holeId);
        return { x: h.x, y: h.y, name: p.name, id: p.id };
      }
      return null;
    });

    if (pinCoords.some((c) => c === null)) return;

    ctx.save();

    if (isSelected) {
      ctx.shadowColor = '#3B82F6';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 3;
    }

    switch (comp.type) {
      case 'resistor': this.renderResistor(ctx, comp, pinCoords); break;
      case 'potentiometer':
      case 'rheostat': this.renderPotentiometer(ctx, comp, pinCoords); break;
      case 'capacitor': this.renderCapacitor(ctx, comp, pinCoords); break;
      case 'inductor': this.renderInductor(ctx, comp, pinCoords); break;
      case 'diode_1n4007':
      case 'diode_oa79': this.renderDiode(ctx, comp, pinCoords); break;
      case 'transistor_bc107':
      case 'transistor_2n2222': this.renderTransistor(ctx, comp, pinCoords); break;
      case 'ic_555':
      case 'ic_8038': this.renderDIP(ctx, comp, pinCoords); break;
      case 'vcc_terminal':
      case 'gnd_terminal': this.renderSupplyTerminal(ctx, comp, pinCoords); break;
    }

    ctx.restore();
  }

  renderResistor(ctx, comp, pins) {
    const p1 = pins[0];
    const p2 = pins[1];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);

    const bodyLen = Math.min(dist * 0.65, 34);
    const bodyHeight = 12;

    ctx.fillStyle = '#E5D5BA';
    ctx.beginPath();
    ctx.roundRect(-bodyLen / 2, -bodyHeight / 2, bodyLen, bodyHeight, 4);
    ctx.fill();
    ctx.strokeStyle = '#BFA075';
    ctx.lineWidth = 1;
    ctx.stroke();

    const bands = comp.properties?.colorBands || ['#78350F', '#111827', '#DC2626', '#D97706'];
    const bandWidth = 3;
    const bandSpacing = bodyLen / 5;

    for (let i = 0; i < bands.length; i++) {
      const bx = -bodyLen / 2 + (i + 1) * bandSpacing;
      ctx.fillStyle = bands[i];
      ctx.fillRect(bx - bandWidth / 2, -bodyHeight / 2, bandWidth, bodyHeight);
    }

    ctx.rotate(-angle);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'center';
    ctx.fillText(`${comp.label} (${comp.displayValue})`, 0, -bodyHeight - 4);

    ctx.restore();
  }

  renderPotentiometer(ctx, comp, pins) {
    const p1 = pins[0];
    const pw = pins[1];
    const p2 = pins[2];
    const midX = pw.x;
    const midY = pw.y - 18;

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2.5;
    for (const p of [p1, pw, p2]) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, midY);
      ctx.stroke();
    }

    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.roundRect(midX - 22, midY - 22, 44, 44, 8);
    ctx.fill();
    ctx.strokeStyle = '#1D4ED8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(midX, midY, 14, 0, Math.PI * 2);
    ctx.fill();

    const wiperPos = comp.properties?.wiperPos ?? 0.5;
    const wiperAngle = -Math.PI * 0.75 + wiperPos * (Math.PI * 1.5);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(midX + Math.cos(wiperAngle) * 11, midY + Math.sin(wiperAngle) * 11);
    ctx.stroke();

    const activeR = Math.round(comp.value * wiperPos);
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.fillText(`${comp.label}: ${(wiperPos * 100).toFixed(0)}%`, midX, midY - 26);
    ctx.fillText(`Rw: ${activeR} Ω`, midX, midY + 34);
  }

  renderCapacitor(ctx, comp, pins) {
    const p1 = pins[0];
    const p2 = pins[1];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.arc(midX, midY, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C2410C';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#FEF08A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(comp.properties?.markingCode || '104', midX, midY);

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#1E293B';
    ctx.fillText(`${comp.label} (${comp.displayValue})`, midX, midY - 18);
  }

  renderInductor(ctx, comp, pins) {
    const p1 = pins[0];
    const p2 = pins[1];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);

    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(-16, -7, 32, 14, 3);
    ctx.fill();

    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 2.5;
    for (let x = -12; x <= 12; x += 6) {
      ctx.beginPath();
      ctx.arc(x, 0, 8, 0, Math.PI);
      ctx.stroke();
    }

    ctx.rotate(-angle);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'center';
    ctx.fillText(`${comp.label} (${comp.displayValue})`, 0, -16);

    ctx.restore();
  }

  renderDiode(ctx, comp, pins) {
    const anode = pins.find((p) => p.id === 'anode') || pins[0];
    const cathode = pins.find((p) => p.id === 'cathode') || pins[1];
    const midX = (anode.x + cathode.x) / 2;
    const midY = (anode.y + cathode.y) / 2;
    const angle = Math.atan2(cathode.y - anode.y, cathode.x - anode.x);

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(anode.x, anode.y);
    ctx.lineTo(cathode.x, cathode.y);
    ctx.stroke();

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);

    const isGe = comp.type === 'diode_oa79';
    const bodyLen = 22;
    const bodyHeight = 10;

    if (isGe) {
      ctx.fillStyle = 'rgba(191, 219, 254, 0.65)';
      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-bodyLen / 2, -bodyHeight / 2, bodyLen, bodyHeight, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#B91C1C';
      ctx.beginPath();
      ctx.arc(-2, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#DC2626';
      ctx.fillRect(bodyLen / 2 - 5, -bodyHeight / 2, 4, bodyHeight);
    } else {
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(-bodyLen / 2, -bodyHeight / 2, bodyLen, bodyHeight, 3);
      ctx.fill();

      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(bodyLen / 2 - 5, -bodyHeight / 2, 4, bodyHeight);
    }

    ctx.rotate(-angle);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'center';
    ctx.fillText(`${comp.label} (${comp.displayValue})`, 0, -14);

    ctx.restore();
  }

  renderTransistor(ctx, comp, pins) {
    const pe = pins.find((p) => p.id === 'E') || pins[0];
    const pb = pins.find((p) => p.id === 'B') || pins[1];
    const pc = pins.find((p) => p.id === 'C') || pins[2];
    const midX = pb.x;
    const midY = pb.y - 18;

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2.5;
    for (const p of [pe, pb, pc]) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, midY);
      ctx.stroke();
    }

    ctx.fillStyle = '#E2E8F0';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(midX, midY, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.fillRect(midX - 18, midY - 3, 5, 6);

    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.fillText('E', pe.x, pe.y + 12);
    ctx.fillText('B', pb.x, pb.y + 12);
    ctx.fillText('C', pc.x, pc.y + 12);

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(comp.displayValue, midX, midY - 20);
  }

  renderDIP(ctx, comp, pins) {
    const is555 = comp.type === 'ic_555';
    const numPins = is555 ? 8 : 14;
    const halfPins = numPins / 2;

    const topPins = pins.slice(0, halfPins);
    const btmPins = pins.slice(halfPins);

    const minX = Math.min(...pins.map((p) => p.x));
    const maxX = Math.max(...pins.map((p) => p.x));
    const minY = Math.min(...pins.map((p) => p.y));
    const maxY = Math.max(...pins.map((p) => p.y));

    ctx.fillStyle = '#94A3B8';
    for (const p of pins) {
      ctx.beginPath();
      ctx.roundRect(p.x - 2, p.y - 4, 4, 8, 1);
      ctx.fill();
    }

    const bodyMargin = 8;
    const bodyX = minX - bodyMargin;
    const bodyY = minY + 6;
    const bodyW = maxX - minX + bodyMargin * 2;
    const bodyH = maxY - minY - 12;

    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#27272A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#27272A';
    ctx.beginPath();
    ctx.arc(bodyX, bodyY + bodyH / 2, 5, -Math.PI / 2, Math.PI / 2);
    ctx.fill();

    ctx.fillStyle = '#71717A';
    ctx.beginPath();
    ctx.arc(minX, minY + 14, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#F4F4F5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(is555 ? 'NE555' : 'ICL8038', bodyX + bodyW / 2, bodyY + bodyH / 2);

    ctx.font = '8px monospace';
    ctx.fillStyle = '#A1A1AA';
    for (let i = 0; i < pins.length; i++) {
      const p = pins[i];
      const pinNum = (i + 1).toString();
      const textY = p.y < bodyY + bodyH / 2 ? p.y + 12 : p.y - 12;
      ctx.fillText(pinNum, p.x, textY);
    }
  }

  renderSupplyTerminal(ctx, comp, pins) {
    const p = pins[0];
    const isVcc = comp.type === 'vcc_terminal';
    const color = isVcc ? '#EF4444' : '#1F2937';

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isVcc ? '+' : '⏚', p.x, p.y);

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(comp.label, p.x, p.y - 15);
  }

  // ─── Wires Rendering ─────────────────────────────────────────────────────

  drawWires(ctx) {
    const fadeWires = this.state.fadeWires;
    for (const wire of this.state.wires) {
      const isSelected = wire.id === this.selectedItem?.id;
      const isHovered = wire.id === this.hoveredWireId;
      this.drawSingleWire(ctx, wire, isSelected, isHovered, fadeWires);
    }
  }

  /**
   * Lifted quadratic arc. The bow is chosen so the curve stays off hole
   * centres (except its two ends) and parallel wires sit on different bows.
   */
  _computeArcCp(h1, h2, wire) {
    if (wire.waypoints && wire.waypoints.length > 0) {
      return { cpX: wire.waypoints[0].x, cpY: wire.waypoints[0].y };
    }
    const dx = h2.x - h1.x;
    const dy = h2.y - h1.y;
    const dist = Math.hypot(dx, dy) || 1;
    const midX = (h1.x + h2.x) / 2;
    const midY = (h1.y + h2.y) / 2;
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const alongX = dx / dist;
    const alongY = dy / dist;
    const index = Math.max(0, this.state.wires.indexOf(wire));
    const lateral = ((index % 5) - 2) * 14;
    const base = Math.max(56, Math.min(150, dist * 0.45));

    let best = null;
    for (const peak of [base, base + 40]) {
      for (const sign of [1, -1]) {
        const lift = peak * 2;
        const cpX = midX + sign * perpX * lift + alongX * lateral;
        const cpY = midY + sign * perpY * lift + alongY * lateral;
        const hits = this._arcHoleHits(h1, h2, cpX, cpY);
        const upward = cpY < midY ? 0 : 1;
        const score = hits * 10 + upward;
        if (!best || score < best.score) best = { cpX, cpY, score };
      }
    }
    return best;
  }

  _arcHoleHits(h1, h2, cpX, cpY) {
    const minX = Math.min(h1.x, h2.x, cpX) - 4;
    const maxX = Math.max(h1.x, h2.x, cpX) + 4;
    const minY = Math.min(h1.y, h2.y, cpY) - 4;
    const maxY = Math.max(h1.y, h2.y, cpY) + 4;
    let hits = 0;
    for (let i = 1; i <= 7; i++) {
      const t = i / 8;
      const u = 1 - t;
      const x = u * u * h1.x + 2 * u * t * cpX + t * t * h2.x;
      const y = u * u * h1.y + 2 * u * t * cpY + t * t * h2.y;
      for (const hole of this.bb.holes.values()) {
        if (hole.x < minX || hole.x > maxX || hole.y < minY || hole.y > maxY) continue;
        if (Math.hypot(hole.x - h1.x, hole.y - h1.y) < 10) continue;
        if (Math.hypot(hole.x - h2.x, hole.y - h2.y) < 10) continue;
        if (Math.hypot(hole.x - x, hole.y - y) < 9) {
          hits += 1;
          break;
        }
      }
    }
    return hits;
  }

  drawSingleWire(ctx, wire, isSelected, isHovered, fadeWires) {
    const h1 = this.getEndpointCoord(wire.fromHoleId);
    const h2 = this.getEndpointCoord(wire.toHoleId);
    if (!h1 || !h2) return;

    const { cpX, cpY } = this._computeArcCp(h1, h2, wire);

    ctx.save();

    if (fadeWires && !isSelected) {
      ctx.globalAlpha = 0.4;
    }

    // Shadow so overlapping wires look layered
    ctx.shadowColor = 'rgba(0, 0, 0, 0.30)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // Selection / hover glow (behind wire)
    if (isSelected) {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(h1.x, h1.y);
      ctx.quadraticCurveTo(cpX, cpY, h2.x, h2.y);
      ctx.stroke();
    } else if (isHovered) {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(h1.x, h1.y);
      ctx.quadraticCurveTo(cpX, cpY, h2.x, h2.y);
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(h1.x, h1.y, 6, 0, Math.PI * 2);
      ctx.arc(h2.x, h2.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer insulation — pointer-events: none equivalent: we use invisible hit areas separately
    ctx.strokeStyle = wire.color || '#10B981';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.moveTo(h1.x, h1.y);
    ctx.quadraticCurveTo(cpX, cpY, h2.x, h2.y);
    ctx.stroke();

    ctx.shadowColor = 'transparent';

    // Metal pin dots at insertion points
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(h1.x, h1.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(h2.x, h2.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // If selected, draw draggable waypoint at arc apex
    if (isSelected) {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(cpX, cpY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Part 2: Draw wire end handles on top of everything else.
   * These are always grabbable, even under fade mode.
   */
  drawWireEndHandles(ctx) {
    for (const wire of this.state.wires) {
      const isSelected = wire.id === this.selectedItem?.id;
      if (!isSelected && !this.draggingWireEnd) continue;

      const h1 = this.getEndpointCoord(wire.fromHoleId);
      const h2 = this.getEndpointCoord(wire.toHoleId);
      if (!h1 || !h2) continue;

      const ends = [
        { coord: h1, end: 'from' },
        { coord: h2, end: 'to' },
      ];

      for (const { coord, end } of ends) {
        const isDragging =
          this.draggingWireEnd?.wireId === wire.id &&
          this.draggingWireEnd?.end === end;

        ctx.save();
        ctx.fillStyle = isDragging ? '#8B5CF6' : (isSelected ? '#38BDF8' : '#FACC15');
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // If dragging, draw rubber-band line to mouse
    if (this.draggingWireEnd) {
      const wire = this.state.wires.find((w) => w.id === this.draggingWireEnd.wireId);
      if (wire) {
        const fixedEnd =
          this.draggingWireEnd.end === 'from'
            ? this.getEndpointCoord(wire.toHoleId)
            : this.getEndpointCoord(wire.fromHoleId);
        const target = this.draggingWireEndTarget || this.mouseCanvasPos;
        if (fixedEnd && target) {
          ctx.save();
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = '#8B5CF6';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const mx = (fixedEnd.x + target.x) / 2;
          const my = (fixedEnd.y + target.y) / 2 - 20;
          ctx.moveTo(fixedEnd.x, fixedEnd.y);
          ctx.quadraticCurveTo(mx, my, target.x, target.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  drawPendingWire(ctx) {
    if (!this.wireStartHole) return;

    ctx.save();
    ctx.strokeStyle = this.state.activeWireColor || '#10B981';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([6, 4]);

    const h1 = this.wireStartHole.isTerminal
      ? this.getTerminalWorldPos(this.wireStartHole.id)
      : this.wireStartHole;
    const h2 = this.hoveredHole ? this.hoveredHole : this.mouseCanvasPos;
    if (!h1 || !h2) {
      ctx.restore();
      return;
    }

    const midX = (h1.x + h2.x) / 2;
    const midY = (h1.y + h2.y) / 2 - 30;

    ctx.beginPath();
    ctx.moveTo(h1.x, h1.y);
    ctx.quadraticCurveTo(midX, midY, h2.x, h2.y);
    ctx.stroke();

    ctx.restore();
  }

  drawGuideGhost(ctx) {
    const ghost = this.guideGhost;
    if (!ghost) return;
    const p1 = this._guidePoint(ghost.from);
    const p2 = this._guidePoint(ghost.to);
    if (!p1 || !p2) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    const midX = (p1.x + p2.x) / 2;
    const midY = Math.min(p1.y, p2.y) - 48;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(midX, midY, p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  _guidePoint(id) {
    if (!id) return null;
    if (this.bb.holes.has(id)) return this.bb.holes.get(id);
    return this.getTerminalWorldPos(id);
  }

  drawPendingComponent(ctx) {
    const comp = this.state.pendingPlacement;
    if (!comp) return;

    const anchorHoleId = this.state.pendingHole;

    ctx.save();
    ctx.globalAlpha = 0.7;

    const ghostPins = anchorHoleId
      ? this.state.projectPins(comp, anchorHoleId)
      : comp.pins.map((p) => ({
          x: this.mouseCanvasPos.x + p.relCol * this.bb.config.pitch,
          y: this.mouseCanvasPos.y + p.relRow * this.bb.config.pitch,
          name: p.name,
          id: p.id,
          holeId: null,
        }));

    if (!ghostPins.length || ghostPins.some((p) => !p)) {
      ctx.restore();
      return;
    }

    for (const pin of ghostPins) {
      if (!pin.holeId) continue;
      const taken = this.state.occupancyMap.has(pin.holeId);
      ctx.strokeStyle = taken ? '#EF4444' : '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    switch (comp.type) {
      case 'resistor': this.renderResistor(ctx, comp, ghostPins); break;
      case 'potentiometer':
      case 'rheostat': this.renderPotentiometer(ctx, comp, ghostPins); break;
      case 'capacitor': this.renderCapacitor(ctx, comp, ghostPins); break;
      case 'inductor': this.renderInductor(ctx, comp, ghostPins); break;
      case 'diode_1n4007':
      case 'diode_oa79': this.renderDiode(ctx, comp, ghostPins); break;
      case 'transistor_bc107':
      case 'transistor_2n2222': this.renderTransistor(ctx, comp, ghostPins); break;
      case 'ic_555':
      case 'ic_8038': this.renderDIP(ctx, comp, ghostPins); break;
      case 'vcc_terminal':
      case 'gnd_terminal': this.renderSupplyTerminal(ctx, comp, ghostPins); break;
    }

    ctx.restore();
  }

  drawIssueHighlights(ctx) {
    if ((!this.highlightHoles || this.highlightHoles.length === 0) && !this.highlightComponentId) return;
    
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    ctx.save();
    
    // Highlight specific holes
    if (this.highlightHoles && this.highlightHoles.length > 0) {
      for (const holeId of this.highlightHoles) {
        const hole = this.bb.holes.get(holeId);
        if (!hole) continue;
        
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + 0.6 * pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, 10 + 3 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = `rgba(239, 68, 68, ${0.15 * pulse})`;
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Highlight component
    if (this.highlightComponentId) {
      const comp = this.state.components.find(c => c.id === this.highlightComponentId);
      if (comp) {
        for (const pin of comp.pins) {
          if (pin.holeId && this.bb.holes.has(pin.holeId)) {
            const h = this.bb.holes.get(pin.holeId);
            ctx.strokeStyle = `rgba(251, 146, 60, ${0.5 + 0.5 * pulse})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(h.x, h.y, 12 + 2 * pulse, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }
    
    ctx.restore();
    
    // Re-render to animate the pulse
    if ((this.highlightHoles && this.highlightHoles.length > 0) || this.highlightComponentId) {
      requestAnimationFrame(() => this.render());
    }
  }

  drawHUD(ctx) {
    // Tooltip for hovered hole
    if (this.hoveredHole) {
      const netName = this.state.circuitGraph.getNetForHole(this.hoveredHole.id);
      const occ = this.state.occupancyMap.get(this.hoveredHole.id);
      const occStr = occ ? ` [${occ.type}]` : ' [free]';
      const text = `${this.hoveredHole.label} Net: ${netName}${occStr}`;
      this._drawTooltip(ctx, text);
    } else if (this.hoveredWireId) {
      const wire = this.state.wires.find((w) => w.id === this.hoveredWireId);
      if (wire) {
        const netFrom = this.state.circuitGraph.getNetForHole
          ? this.state.circuitGraph.getNetForHole(wire.fromHoleId)
          : wire.fromHoleId;
        const text = `Wire: ${wire.fromHoleId} → ${wire.toHoleId} [Net: ${netFrom}]`;
        this._drawTooltip(ctx, text);
      }
    }
  }

  _drawTooltip(ctx, text) {
    ctx.save();
    ctx.font = '12px system-ui, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const padX = 10;
    const padY = 6;
    const x = 20;
    const y = this.height - 30;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x, y - 20, textWidth + padX * 2, 28, 6);
    ctx.fill();

    ctx.fillStyle = '#38BDF8';
    ctx.fillText(text, x + padX, y);
    ctx.restore();
  }

  // ─── Hit Testing ──────────────────────────────────────────────────────────

  findComponentBodyAt(x, y) {
    if (nearestHoleWithin(this.bb.holes, x, y, HOLE_HIT_RADIUS)) return null;
    for (let i = this.state.components.length - 1; i >= 0; i--) {
      const comp = this.state.components[i];
      const pts = [];
      for (const pin of comp.pins) {
        const h = pin.holeId && this.bb.holes.get(pin.holeId);
        if (h) pts.push(h);
      }
      if (pts.length < 2) continue;
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y));
      const tall = maxY - minY > 16;
      if (tall) {
        if (x > minX && x < maxX && y > minY + HOLE_HIT_RADIUS && y < maxY - HOLE_HIT_RADIUS) {
          return comp;
        }
      } else if (this._nearSegment(pts[0], pts[pts.length - 1], x, y, 10)) {
        return comp;
      }
    }
    return null;
  }

  _nearSegment(a, b, x, y, radius) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    if (Math.hypot(x - px, y - py) > radius) return false;
    if (Math.hypot(x - a.x, y - a.y) <= HOLE_HIT_RADIUS) return false;
    if (Math.hypot(x - b.x, y - b.y) <= HOLE_HIT_RADIUS) return false;
    return true;
  }

  findWireEndHandleAt(x, y) {
    const handleRadius = 8;
    for (let i = this.state.wires.length - 1; i >= 0; i--) {
      const wire = this.state.wires[i];
      const isSelected = wire.id === this.selectedItem?.id;
      // End handles are only grabbable when the wire is selected
      if (!isSelected) continue;

      const h1 = this.getEndpointCoord(wire.fromHoleId);
      const h2 = this.getEndpointCoord(wire.toHoleId);

      if (h1 && Math.hypot(x - h1.x, y - h1.y) < handleRadius) {
        return { wireId: wire.id, end: 'from' };
      }
      if (h2 && Math.hypot(x - h2.x, y - h2.y) < handleRadius) {
        return { wireId: wire.id, end: 'to' };
      }
    }
    return null;
  }

  // ─── Instrument Terminal Integration ─────────────────────────────────────

  getEndpointCoord(id) {
    if (this.bb.holes.has(id)) {
      return this.bb.holes.get(id);
    }
    return this.getTerminalWorldPos(id);
  }

  getTerminalWorldPos(termId) {
    const el = document.querySelector(`[data-term-id="${termId}"]`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return this.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  handleTerminalClick(termId) {
    if (!this.wireStartHole) {
      this.wireStartHole = { id: termId, isTerminal: true };
    } else if (this.wireStartHole.id !== termId) {
      this.state.addWire(this.wireStartHole.id, termId);
      this.wireStartHole = null;
    }
    this.render();
  }
}
