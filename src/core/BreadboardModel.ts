/**
 * BreadboardModel.ts - Solderless Breadboard Topology & Electrical Model
 * Models a standard 830-tie-point solderless breadboard.
 */

export interface BreadboardHole {
  id: string;              // e.g. "15-C", "TP-12", "BN-40"
  x: number;               // SVG/canvas coordinate X
  y: number;               // SVG/canvas coordinate Y
  colIndex: number;        // 1 to 63
  rowId: string;           // 'TP', 'TN', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'BP', 'BN'
  stripId: string;         // Unique electrical tie strip identifier
  label: string;           // Human readable tooltip label
  isPowerRail: boolean;
  polarity?: '+' | '-';
}

export interface BreadboardLayoutConfig {
  pitch: number;           // Hole center-to-center distance in px (default 18)
  columns: number;         // Number of columns/rows across breadboard (default 63)
  originX: number;         // Top-left breadboard padding X
  originY: number;         // Top-left breadboard padding Y
  centerGap: number;       // Height of middle divider trough (default 32)
  railGap: number;         // Gap between power rails and terminal strips (default 24)
}

export const DEFAULT_CONFIG: BreadboardLayoutConfig = {
  pitch: 20,
  columns: 63,
  originX: 80,
  originY: 50,
  centerGap: 36,
  railGap: 24,
};

export class BreadboardModel {
  public config: BreadboardLayoutConfig;
  public holes: Map<string, BreadboardHole> = new Map();
  public stripToHoles: Map<string, string[]> = new Map();

  // Dimensions
  public width: number = 0;
  public height: number = 0;

  constructor(config: Partial<BreadboardLayoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.generateTopology();
  }

  private generateTopology(): void {
    const { pitch, columns, originX, originY, centerGap, railGap } = this.config;

    this.holes.clear();
    this.stripToHoles.clear();

    const addHole = (hole: BreadboardHole) => {
      this.holes.set(hole.id, hole);
      if (!this.stripToHoles.has(hole.stripId)) {
        this.stripToHoles.set(hole.stripId, []);
      }
      this.stripToHoles.get(hole.stripId)!.push(hole.id);
    };

    // Calculate Y positions for each row
    // Top Power Rails
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
      // Rail holes are electrically connected along the entire rail
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
      const upperRows: Array<{ row: string; y: number }> = [
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
      const lowerRows: Array<{ row: string; y: number }> = [
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

  /**
   * Find nearest hole to a given coordinate (within maxDistance)
   */
  public findNearestHole(x: number, y: number, maxDist: number = 18): BreadboardHole | null {
    let nearest: BreadboardHole | null = null;
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

  /**
   * Get all holes in the same electrical strip as the given holeId
   */
  public getHolesInStrip(holeId: string): BreadboardHole[] {
    const hole = this.holes.get(holeId);
    if (!hole) return [];
    const holeIds = this.stripToHoles.get(hole.stripId) || [];
    return holeIds.map((id) => this.holes.get(id)!).filter(Boolean);
  }
}

