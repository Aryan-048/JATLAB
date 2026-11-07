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

const ROLE_HEX = {
  vcc: '#EF4444',
  gnd: '#1F2937',
  message: '#10B981',
  carrier: '#F59E0B',
  scope: '#3B82F6',
  timing: '#F97316',
  pulse: '#8B5CF6',
  jumper: '#E5E7EB',
};

const ROLE_NAME = {
  vcc: 'red supply',
  gnd: 'black ground',
  message: 'green message',
  carrier: 'yellow carrier',
  scope: 'blue scope',
  timing: 'orange timing',
  pulse: 'purple pulse',
  jumper: 'white jumper',
};

/** Pick a palette color from the two ends and a short description of the connection. */
export function wireRole(from, to, hint = '') {
  const ends = `${from || ''} ${to || ''}`;
  const text = String(hint).toLowerCase();
  if (/GND|BN-|BP-/.test(ends)) return 'gnd';
  if (/PS1_POS|VCC/.test(ends)) return 'vcc';
  if (/OSC_/.test(ends)) return 'scope';
  if (/FG2_/.test(ends)) return /pulse|clock/.test(text) ? 'pulse' : 'carrier';
  if (/FG1_/.test(ends)) return 'message';
  if (/\bmessage\b/.test(text)) return 'message';
  if (/\b(tie|join)\b/.test(text)) return 'jumper';
  if (/timing|pin 2|pin 6|pin 7|pin 10/.test(text)) return 'timing';
  return 'jumper';
}

export function wireColor(from, to, hint = '') {
  return ROLE_HEX[wireRole(from, to, hint)];
}

export function wireColorName(from, to, hint = '') {
  return ROLE_NAME[wireRole(from, to, hint)];
}

export function createWire(fromHoleId, toHoleId, color = '#10B981') {
  return {
    id: `wire_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fromHoleId,
    toHoleId,
    color,
    waypoints: [],
  };
}

