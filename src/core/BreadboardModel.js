/**
 * BreadboardModel.js - Solderless Breadboard Topology & Electrical Model (ES Module)
 */

export const DEFAULT_CONFIG = {
  pitch: 20,
  columns: 63,
  originX: 80,
  originY: 50,
  centerGap: 36,
  railGap: 24,
};

export class BreadboardModel {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.holes = new Map();
    this.stripToHoles = new Map();
    this.width = 0;
    this.height = 0;
    this.generateTopology();
  }

  generateTopology() {
    const { pitch, columns, originX, originY, centerGap, railGap } = this.config;

    this.holes.clear();
    this.stripToHoles.clear();

    const addHole = (hole) => {
      this.holes.set(hole.id, hole);
      if (!this.stripToHoles.has(hole.stripId)) {
        this.stripToHoles.set(hole.stripId, []);
      }
      this.stripToHoles.get(hole.stripId).push(hole.id);
    };

    // Calculate Y positions for each row
    const y_TP = originY;                          // Top (+) red rail
    const y_TN = y_TP + pitch;                     // Top (-) blue rail

    // Upper Terminal Area: A, B, C, D, E
    const y_A = y_TN + railGap;
    const y_B = y_A + pitch;
    const y_C = y_B + pitch;
    const y_D = y_C + pitch;
    const y_E = y_D + pitch;

    // Lower Terminal Area: F, G, H, I, J
    const y_F = y_E + centerGap;
    const y_G = y_F + pitch;
    const y_H = y_G + pitch;
    const y_I = y_H + pitch;
    const y_J = y_I + pitch;

    // Bottom Power Rails
    const y_BP = y_J + railGap;                    // Bottom (+) red rail
    const y_BN = y_BP + pitch;                     // Bottom (-) blue rail

    this.height = y_BN + originY + 20;
    this.width = originX * 2 + columns * pitch;

    // Generate holes across all 63 columns
    for (let c = 1; c <= columns; c++) {
      const x = originX + (c - 1) * pitch;

      // 1. Top Power Rails
      addHole({
        id: `TP-${c}`,
        x,
        y: y_TP,
        colIndex: c,
        rowId: 'TP',
        stripId: 'RAIL_TOP_POS',
        label: `Top Rail (+) Hole ${c}`,
        isPowerRail: true,
        polarity: '+',
      });

      addHole({
        id: `TN-${c}`,
        x,
        y: y_TN,
        colIndex: c,
        rowId: 'TN',
        stripId: 'RAIL_TOP_NEG',
        label: `Top Rail (-) / GND Hole ${c}`,
        isPowerRail: true,
        polarity: '-',
      });

      // 2. Upper Terminal Strip: A to E (connected vertically in this column)
      const topStripId = `TIE_TOP_COL_${c}`;
      const upperRows = [
        { row: 'A', y: y_A },
        { row: 'B', y: y_B },
        { row: 'C', y: y_C },
        { row: 'D', y: y_D },
        { row: 'E', y: y_E },
      ];

      for (const { row, y } of upperRows) {
        addHole({
          id: `${c}-${row}`,
          x,
          y,
          colIndex: c,
          rowId: row,
          stripId: topStripId,
          label: `Column ${c}, Row ${row}`,
          isPowerRail: false,
        });
      }

      // 3. Lower Terminal Strip: F to J (connected vertically in this column)
      const btmStripId = `TIE_BTM_COL_${c}`;
      const lowerRows = [
        { row: 'F', y: y_F },
        { row: 'G', y: y_G },
        { row: 'H', y: y_H },
        { row: 'I', y: y_I },
        { row: 'J', y: y_J },
      ];

      for (const { row, y } of lowerRows) {
        addHole({
          id: `${c}-${row}`,
          x,
          y,
          colIndex: c,
          rowId: row,
          stripId: btmStripId,
          label: `Column ${c}, Row ${row}`,
          isPowerRail: false,
        });
      }

      // 4. Bottom Power Rails
      addHole({
        id: `BP-${c}`,
        x,
        y: y_BP,
        colIndex: c,
        rowId: 'BP',
        stripId: 'RAIL_BTM_POS',
        label: `Bottom Rail (+) Hole ${c}`,
        isPowerRail: true,
        polarity: '+',
      });

      addHole({
        id: `BN-${c}`,
        x,
        y: y_BN,
        colIndex: c,
        rowId: 'BN',
        stripId: 'RAIL_BTM_NEG',
        label: `Bottom Rail (-) / GND Hole ${c}`,
        isPowerRail: true,
        polarity: '-',
      });
    }
  }

  findNearestHole(x, y, maxDist = 18) {
    let nearest = null;
    let minDistSq = maxDist * maxDist;

    for (const hole of this.holes.values()) {
      const dx = hole.x - x;
      const dy = hole.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = hole;
      }
    }
    return nearest;
  }

  getHolesInStrip(holeId) {
    const hole = this.holes.get(holeId);
    if (!hole) return [];
    const holeIds = this.stripToHoles.get(hole.stripId) || [];
    return holeIds.map((id) => this.holes.get(id)).filter(Boolean);
  }
}

