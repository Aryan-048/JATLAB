/**
 * WireModel.js - Jumper Wire Model & Color Definitions (ES Module)
 */

export const WIRE_COLORS = [
  { name: 'Red (+VCC)', hex: '#EF4444' },
  { name: 'Black (GND)', hex: '#1F2937' },
  { name: 'Green (Signal/Msg)', hex: '#10B981' },
  { name: 'Yellow (Carrier)', hex: '#F59E0B' },
  { name: 'Blue (Osc/Scope)', hex: '#3B82F6' },
  { name: 'Orange (Timing)', hex: '#F97316' },
  { name: 'Purple (Pulse/Clock)', hex: '#8B5CF6' },
  { name: 'White (Jumper)', hex: '#E5E7EB' },
];

export function createWire(fromHoleId, toHoleId, color = '#10B981') {
  return {
    id: `wire_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fromHoleId,
    toHoleId,
    color,
    waypoints: [],
  };
}

