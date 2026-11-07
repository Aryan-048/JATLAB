/**
 * Circuit check. Always returns a list of issues. An empty list means
 * nothing structural is wrong; the panel then says Circuit OK.
 */

import { LAB_REFERENCES } from './labReferences.js';
import { wireColor } from '../core/WireModel.js';
import { formatResistance, formatCapacitance, formatInductance } from '../core/ComponentModel.js';

const SYMMETRIC = new Set(['resistor', 'capacitor', 'inductor', 'rheostat']);
const GROUND_NETS = new Set(['0', 'GND', 'GND_TOP', 'GND_BTM', 'RAIL_TOP_NEG', 'RAIL_BTM_NEG']);
const TIME_STEPS = [5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 0.01];

const TYPE_LABEL = {
  resistor: 'resistor',
  capacitor: 'capacitor',
  inductor: 'inductor',
  diode_1n4007: '1N4007 diode',
  diode_oa79: 'OA79 diode',
  transistor_bc107: 'BC107',
  transistor_2n2222: '2N2222',
  ic_555: '555 timer',
  ic_8038: 'ICL8038',
};

export function analyzeCircuit({ components, wires, circuitGraph, breadboard, instruments, labId, simData }) {
  const issues = [];
  const cg = circuitGraph;
  cg.rebuild(components, wires);

  if (!components || components.length === 0) {
    issues.push(issue('error', 'Empty breadboard',
      'No components have been placed on the breadboard.',
      'Drag a part from the palette and drop it on the board.',
      { holeIds: [] }));
    return issues;
  }

  checkGround(components, wires, cg, issues);
  checkRailShorts(cg, issues);
  for (const comp of components) checkPart(comp, cg, breadboard, issues);
  checkScopeBasics(instruments, cg, simData, issues);

  const lab = labId ? LAB_REFERENCES[labId] : null;
  if (lab) checkAgainstLab(lab, components, wires, cg, breadboard, instruments, issues);

  if (simData?.error) {
    issues.push(issue('error', 'Simulation error', simData.error,
      'The scope is a flat line until this is fixed.', { holeIds: [] }));
  }

  return issues;
}

export function suggestTimeDiv(frequencyHz) {
  if (!frequencyHz || frequencyHz <= 0) return 1e-3;
  const ideal = (2 / frequencyHz) / 10;
  return TIME_STEPS.reduce((best, step) =>
    Math.abs(Math.log(step / ideal)) < Math.abs(Math.log(best / ideal)) ? step : best
  );
}

function issue(severity, title, why, fix, extra = {}) {
  return { severity, title, why, fix, holeIds: extra.holeIds || [], ...extra };
}

function isGroundNet(net) {
  return GROUND_NETS.has(net);
}

function normNet(net) {
  if (!net) return null;
  return isGroundNet(net) ? 'GROUND' : net;
}

function isNegRailHole(holeId) {
  return typeof holeId === 'string' && (holeId.startsWith('TN-') || holeId.startsWith('BN-'));
}

function formatValue(type, value) {
  if (type === 'resistor' || type === 'potentiometer' || type === 'rheostat') return formatResistance(value);
  if (type === 'capacitor') return formatCapacitance(value);
  if (type === 'inductor') return formatInductance(value);
  return String(value);
}

function closeValue(actual, expected) {
  const scale = Math.max(Math.abs(actual), Math.abs(expected), 1e-18);
  return Math.abs(actual - expected) / scale < 0.02;
}

function checkGround(components, wires, cg, issues) {
  const wired = wires.some((w) => isNegRailHole(w.fromHoleId) || isNegRailHole(w.toHoleId));
  const symbol = components.some((c) => c.type === 'gnd_terminal');
  const pinOnGround = components.some((c) =>
    c.pins.some((p) => p.holeId && isGroundNet(cg.getNetForHole(p.holeId)))
  );
  if (!wired && !symbol && !pinOnGround) {
    issues.push(issue('error', 'No ground connection',
      'Nothing on the board touches a blue ground rail, so the solver has no reference.',
      'Draw a wire from the circuit ground to the blue (−) rail.',
      { holeIds: ['TN-1', 'BN-1'] }));
  }
}

function checkRailShorts(cg, issues) {
  if (cg.dsu.find('TP-1') === cg.dsu.find('TN-1')) {
    issues.push(issue('error', 'Top power rail is shorted',
      'The top red (+) rail and the top blue (−) rail are tied together.',
      'Remove the wire that joins the top + rail to the top − rail.',
      { holeIds: ['TP-1', 'TN-1'] }));
  }
  if (cg.dsu.find('BP-1') === cg.dsu.find('BN-1')) {
    issues.push(issue('error', 'Bottom power rail is shorted',
      'The bottom red (+) rail and the bottom blue (−) rail are tied together.',
      'Remove the wire that joins the bottom + rail to the bottom − rail.',
      { holeIds: ['BP-1', 'BN-1'] }));
  }
}

function checkPart(comp, cg, breadboard, issues) {
  const unplugged = comp.pins.filter((p) => !p.holeId);
  if (unplugged.length === comp.pins.length) {
    issues.push(issue('warn', `${comp.label} is unplugged`,
      `${comp.displayValue || comp.label} has no pin in a hole.`,
      'Drop the part onto the breadboard.',
      { componentId: comp.id, holeIds: [] }));
    return;
  }
  if (unplugged.length > 0) {
    issues.push(issue('warn', `${comp.label} has a floating pin`,
      `${unplugged.map((p) => p.name).join(', ')} is not in a hole.`,
      'Move the part so every pin lands in a hole.',
      { componentId: comp.id, holeIds: comp.pins.filter((p) => p.holeId).map((p) => p.holeId) }));
  }

  if (comp.pins.length >= 2 && comp.pins[0].holeId && comp.pins[1].holeId) {
    const n0 = cg.getNetForHole(comp.pins[0].holeId);
    const n1 = cg.getNetForHole(comp.pins[1].holeId);
    if (n0 === n1) {
      issues.push(issue('error', `${comp.label} is shorted across itself`,
        `Both leads share ${comp.pins[0].holeId}’s strip, so the part does nothing.`,
        'Move one lead into a different strip.',
        { componentId: comp.id, holeIds: [comp.pins[0].holeId, comp.pins[1].holeId] }));
    }
  }

  if (comp.type === 'ic_555' || comp.type === 'ic_8038') checkStraddle(comp, issues);
  if (comp.type === 'ic_555') check555Power(comp, cg, issues);
  if (comp.type === 'ic_8038') check8038Power(comp, cg, issues);
}

function rowLetter(holeId) {
  const match = String(holeId).match(/-([A-J])$/);
  return match ? match[1] : null;
}

function checkStraddle(comp, issues) {
  const rows = comp.pins.map((p) => rowLetter(p.holeId)).filter(Boolean);
  const top = rows.some((r) => 'ABCDE'.includes(r));
  const bottom = rows.some((r) => 'FGHIJ'.includes(r));
  if (rows.length > 0 && (!top || !bottom)) {
    const name = comp.type === 'ic_555' ? '555' : 'ICL8038';
    issues.push(issue('error', `${name} is not straddling the centre gap`,
      'A DIP must sit across the gap, with one row of pins in A–E and the other in F–J.',
      `Pick the part up and drop it so pin 1 is in row E. It will straddle the gap.`,
      { componentId: comp.id, holeIds: comp.pins.filter((p) => p.holeId).map((p) => p.holeId) }));
  }
}

function check555Power(comp, cg, issues) {
  const pin = (id) => comp.pins.find((p) => p.id === id);
  const net = (p) => (p?.holeId ? normNet(cg.getNetForHole(p.holeId)) : null);
  const p1 = pin('p1');
  const p4 = pin('p4');
  const p8 = pin('p8');
  const n1 = net(p1);
  const n4 = net(p4);
  const n8 = net(p8);
  if (p8?.holeId && n8 === 'GROUND') {
    issues.push(issue('error', '555 pin 8 (VCC) is not powered',
      'Pin 8 is on ground. The timer has no supply.',
      'Connect pin 8 to the DC supply positive.',
      { componentId: comp.id, holeIds: [p8.holeId] }));
  }
  if (p1?.holeId && n1 && n1 !== 'GROUND') {
    issues.push(issue('error', '555 pin 1 is not grounded',
      'Pin 1 (GND) is not on a ground rail.',
      'Connect pin 1 to the blue (−) rail.',
      { componentId: comp.id, holeIds: [p1.holeId] }));
  }
  if (p4?.holeId && n4 === 'GROUND') {
    issues.push(issue('error', '555 pin 4 (RESET) is tied to ground',
      'RESET held low forces the 555 output off.',
      'Tie pin 4 to the same supply as pin 8.',
      { componentId: comp.id, holeIds: [p4.holeId] }));
  }
}

function check8038Power(comp, cg, issues) {
  const p6 = comp.pins.find((p) => p.id === 'p6');
  const p11 = comp.pins.find((p) => p.id === 'p11');
  if (p6?.holeId && normNet(cg.getNetForHole(p6.holeId)) === 'GROUND') {
    issues.push(issue('error', 'ICL8038 pin 6 (V+) is not powered',
      'Pin 6 is on ground, so the oscillator has no supply.',
      'Connect pin 6 to +18 V.',
      { componentId: comp.id, holeIds: [p6.holeId] }));
  }
  if (p11?.holeId && normNet(cg.getNetForHole(p11.holeId)) !== 'GROUND') {
    issues.push(issue('error', 'ICL8038 pin 11 is not grounded',
      'Pin 11 (V− / GND) is not on a ground rail.',
      'Connect pin 11 to the blue (−) rail.',
      { componentId: comp.id, holeIds: [p11.holeId] }));
  }
}

function checkScopeBasics(instruments, cg, simData, issues) {
  const osc = instruments?.oscilloscope;
  if (!osc) return;
  const ch1 = cg.getNetForHole('OSC_CH1');
  if (ch1 === 'NET_OSC_CH1') {
    issues.push(issue('info', 'Scope CH1 probe is not connected',
      'CH1 is not wired to a node.',
      'Wire the yellow CH1 terminal to the node you want to see.',
      { holeIds: [], instrumentId: 'OSC1' }));
  }
  if (osc.ch1Coupling === 'GND') {
    issues.push(issue('error', 'CH1 coupling is GND, so the trace is a flat line',
      'GND coupling disconnects the probe and draws 0 V.',
      'Set CH1 coupling to DC.',
      { holeIds: [], instrumentId: 'OSC1', action: { kind: 'coupling', channel: 1, value: 'DC' } }));
  }
  if (osc.ch2Coupling === 'GND') {
    issues.push(issue('warn', 'CH2 coupling is GND, so that trace is a flat line',
      'GND coupling forces channel 2 to 0 V.',
      'Set CH2 coupling to DC.',
      { holeIds: [], instrumentId: 'OSC1', action: { kind: 'coupling', channel: 2, value: 'DC' } }));
  }

  const freq = lowestWiredFrequency(instruments, cg);
  if (freq && osc.timeDiv) {
    const window = osc.timeDiv * 10;
    const tooFast = window < 1 / freq;
    const tooSlow = window > 30 / freq;
    if (tooFast || tooSlow) {
      const better = suggestTimeDiv(freq);
      issues.push(issue('warn', 'Time/div is hiding the signal',
        tooFast
          ? `The screen shows only a fraction of one cycle at ${formatHz(freq)}.`
          : `So many cycles are packed on screen that the shape at ${formatHz(freq)} disappears.`,
        `Set time/div to about ${formatTime(better)}.`,
        { holeIds: [], instrumentId: 'OSC1', action: { kind: 'timeDiv', value: better } }));
    }
  }
}

function lowestWiredFrequency(instruments, cg) {
  let best = null;
  for (const fg of instruments?.functionGenerators || []) {
    if (!fg.enabled) continue;
    const net = cg.getNetForHole(fg.terminals.out.id);
    if (net === `NET_${fg.terminals.out.id}`) continue;
    if (best == null || fg.frequency < best) best = fg.frequency;
  }
  return best;
}

function formatHz(hz) {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
  if (hz >= 1000) return `${(hz / 1000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')} kHz`;
  return `${hz} Hz`;
}

function formatTime(seconds) {
  if (seconds >= 1e-3) return `${(seconds * 1e3).toFixed(seconds >= 1e-3 ? 0 : 1).replace(/\.0$/, '')} ms`;
  return `${Math.round(seconds * 1e6)} µs`;
}

function checkAgainstLab(lab, components, wires, cg, breadboard, instruments, issues) {
  const matched = new Map();
  const used = new Set();
  const pool = components.filter((c) => c.pins.some((p) => p.holeId));

  for (const spec of lab.parts) {
    const candidates = pool.filter((c) => c.type === spec.type && !used.has(c.id));
    if (candidates.length === 0) {
      issues.push(issue('error', `Missing: ${spec.label}`,
        `${lab.name} needs ${spec.label}, and it is not on the board.`,
        `Place ${spec.label} from the palette.`,
        { holeIds: [] }));
      continue;
    }
    candidates.sort((a, b) => valueDistance(a, spec) - valueDistance(b, spec));
    const best = candidates[0];
    used.add(best.id);
    matched.set(spec.role, best);
    if (spec.value != null && !closeValue(best.value, spec.value)) {
      issues.push(issue('error',
        `Wrong value: ${spec.label} is ${formatValue(spec.type, best.value)}, expected ${formatValue(spec.type, spec.value)}`,
        `${spec.label} has the wrong value for ${lab.name}.`,
        `Change it to ${formatValue(spec.type, spec.value)}.`,
        {
          componentId: best.id,
          holeIds: best.pins.filter((p) => p.holeId).map((p) => p.holeId),
          action: { kind: 'value', componentId: best.id, value: spec.value, type: spec.type },
        }));
    }
  }

  for (const comp of components) {
    if (used.has(comp.id)) continue;
    if (comp.type === 'gnd_terminal' || comp.type === 'vcc_terminal') continue;
    if (!comp.pins.some((p) => p.holeId)) continue;
    const name = comp.displayValue || TYPE_LABEL[comp.type] || comp.type;
    issues.push(issue('warn', `Extra: ${name}`,
      `${name} is not part of ${lab.name}.`,
      'Remove it if you did not mean to add it.',
      { componentId: comp.id, holeIds: comp.pins.filter((p) => p.holeId).map((p) => p.holeId) }));
  }

  const flips = chooseFlips(lab, matched, cg, instruments);
  const diode = [...matched.entries()].find(([, comp]) => comp.type.startsWith('diode_'));
  if (flips.diode && diode) {
    const comp = diode[1];
    issues.push(issue('error', 'Diode is reversed',
      `The ${comp.displayValue || 'diode'} conducts the wrong way for ${lab.name}.`,
      'Turn the diode around. The band is the cathode.',
      {
        componentId: comp.id,
        holeIds: comp.pins.filter((p) => p.holeId).map((p) => p.holeId),
        action: { kind: 'swapPins', componentId: comp.id, pinA: 'anode', pinB: 'cathode' },
      }));
  }
  const bjt = [...matched.entries()].find(([, comp]) => comp.type.startsWith('transistor_'));
  if (flips.bjt && bjt) {
    const comp = bjt[1];
    issues.push(issue('error', 'Emitter and collector are swapped',
      `${comp.displayValue || 'The transistor'} has E and C exchanged, so it cannot switch the way this lab expects.`,
      'Swap the emitter and collector leads.',
      {
        componentId: comp.id,
        holeIds: comp.pins.filter((p) => p.holeId).map((p) => p.holeId),
        action: { kind: 'swapPins', componentId: comp.id, pinA: 'E', pinB: 'C' },
      }));
  }

  for (const link of lab.links) {
    if (!endsPresent(link, matched)) continue;
    if (linkOk(link, flips, matched, cg, instruments)) continue;
    const holes = holesForLink(link, flips, matched, breadboard, components, wires);
    const action = holes
      ? { kind: 'wire', from: holes.from, to: holes.to, color: wireColor(holes.from, holes.to, link.name) }
      : null;
    issues.push(issue('error', `Missing: ${link.name}`,
      `${link.name} is not connected.`,
      action ? 'Fix it for me will add that wire on free holes in the same strips.' : `Draw a wire for: ${link.name}.`,
      { holeIds: holes?.show || [], action }));
  }

  reportExtraShorts(lab, flips, matched, cg, instruments, issues);
  checkGenerators(lab, instruments, issues);
  checkSupply(lab, instruments, issues);
  checkProbe(lab, flips, matched, cg, components, wires, breadboard, issues);
}

function valueDistance(comp, spec) {
  if (spec.value == null) return 0;
  const scale = Math.max(Math.abs(spec.value), 1e-18);
  return Math.abs((comp.value || 0) - spec.value) / scale;
}

function endsPresent(link, matched) {
  return endPresent(link.a, matched) && endPresent(link.b, matched);
}

function endPresent(end, matched) {
  if (!Array.isArray(end)) return true;
  return matched.has(end[0]);
}

function chooseFlips(lab, matched, cg, instruments) {
  const sym = new Set();
  const roles = lab.parts.filter((p) => SYMMETRIC.has(p.type) && matched.has(p.role)).map((p) => p.role);
  const flips = { diode: false, bjt: false, sym };
  for (let pass = 0; pass < 2; pass++) {
    for (const role of roles) {
      const on = new Set(sym);
      on.add(role);
      const off = new Set(sym);
      off.delete(role);
      const cOn = countLinks(lab, { ...flips, sym: on }, matched, cg, instruments);
      const cOff = countLinks(lab, { ...flips, sym: off }, matched, cg, instruments);
      if (cOn > cOff) sym.add(role);
      else sym.delete(role);
    }
  }
  if (countLinks(lab, { ...flips, diode: true }, matched, cg, instruments) > countLinks(lab, flips, matched, cg, instruments)) {
    flips.diode = true;
  }
  if (countLinks(lab, { ...flips, bjt: true }, matched, cg, instruments) > countLinks(lab, flips, matched, cg, instruments)) {
    flips.bjt = true;
  }
  return flips;
}

function countLinks(lab, flips, matched, cg, instruments) {
  let n = 0;
  for (const link of lab.links) {
    if (!endsPresent(link, matched)) continue;
    if (linkOk(link, flips, matched, cg, instruments)) n++;
  }
  return n;
}

function linkOk(link, flips, matched, cg, instruments) {
  const a = endNet(link.a, flips, matched, cg, instruments);
  const b = endNet(link.b, flips, matched, cg, instruments);
  return Boolean(a && b && a === b);
}

function endNet(end, flips, matched, cg, instruments) {
  if (end === 'gnd') return 'GROUND';
  if (end === 'fg1') return sourceNet(instruments?.functionGenerators?.[0], cg);
  if (end === 'fg2') return sourceNet(instruments?.functionGenerators?.[1], cg);
  if (end === 'vcc') return sourceNet(instruments?.powerSupply, cg, 'pos');
  if (!Array.isArray(end)) return null;
  return readPinNet(end[0], end[1], flips, matched, cg);
}

function sourceNet(device, cg, which = 'out') {
  if (!device) return null;
  const id = which === 'pos' ? device.terminals?.pos?.id : device.terminals?.out?.id;
  if (!id) return null;
  const net = cg.getNetForHole(id);
  if (!net || net === `NET_${id}`) return null;
  return normNet(net);
}

function readPinNet(role, pinId, flips, matched, cg) {
  const comp = matched.get(role);
  if (!comp) return null;
  const physical = physicalPin(role, pinId, comp, flips);
  const pin = comp.pins.find((p) => p.id === physical);
  if (!pin?.holeId) return null;
  return normNet(cg.getNetForHole(pin.holeId));
}

function physicalPin(role, pinId, comp, flips) {
  if (flips.sym.has(role) && (pinId === 'p1' || pinId === 'p2')) {
    return pinId === 'p1' ? 'p2' : 'p1';
  }
  if (flips.diode && comp.type.startsWith('diode_')) {
    if (pinId === 'anode') return 'cathode';
    if (pinId === 'cathode') return 'anode';
  }
  if (flips.bjt && comp.type.startsWith('transistor_')) {
    if (pinId === 'E') return 'C';
    if (pinId === 'C') return 'E';
  }
  return pinId;
}

function holesForLink(link, flips, matched, breadboard, components, wires) {
  const occupancy = occupiedHoles(components, wires);
  const a = endpointHole(link.a, flips, matched, breadboard, occupancy);
  const b = endpointHole(link.b, flips, matched, breadboard, occupancy);
  if (!a || !b) return null;
  const show = [a.show, b.show].filter(Boolean);
  if (!a.connect || !b.connect || a.connect === b.connect) return { show };
  return { from: a.connect, to: b.connect, show };
}

function occupiedHoles(components, wires) {
  const used = new Set();
  for (const comp of components) {
    for (const pin of comp.pins) if (pin.holeId) used.add(pin.holeId);
  }
  for (const wire of wires) {
    used.add(wire.fromHoleId);
    used.add(wire.toHoleId);
  }
  return used;
}

function endpointHole(end, flips, matched, breadboard, occupancy) {
  if (end === 'gnd') {
    const hole = freeGroundHole(breadboard, occupancy);
    return hole ? { connect: hole, show: hole } : null;
  }
  if (end === 'fg1' || end === 'fg2' || end === 'vcc') {
    const id = end === 'fg1' ? 'FG1_OUT' : end === 'fg2' ? 'FG2_OUT' : 'PS1_POS';
    return { connect: id, show: null };
  }
  if (!Array.isArray(end)) return null;
  const comp = matched.get(end[0]);
  if (!comp) return null;
  const pin = comp.pins.find((p) => p.id === physicalPin(end[0], end[1], comp, flips));
  if (!pin?.holeId) return null;
  if (!breadboard.holes.has(pin.holeId)) return { connect: pin.holeId, show: pin.holeId };
  const free = freeInStrip(breadboard, pin.holeId, occupancy);
  return { connect: free, show: pin.holeId };
}

function freeInStrip(breadboard, holeId, occupancy) {
  const hole = breadboard.holes.get(holeId);
  if (!hole) return null;
  if (isNegRailHole(holeId)) return freeGroundHole(breadboard, occupancy);
  const ids = breadboard.stripToHoles.get(hole.stripId) || [];
  return ids.find((id) => !occupancy.has(id)) || null;
}

function freeGroundHole(breadboard, occupancy) {
  for (let n = 1; n <= 63; n++) {
    const id = `BN-${n}`;
    if (breadboard.holes.has(id) && !occupancy.has(id)) return id;
  }
  for (let n = 1; n <= 63; n++) {
    const id = `TN-${n}`;
    if (breadboard.holes.has(id) && !occupancy.has(id)) return id;
  }
  return null;
}

function reportExtraShorts(lab, flips, matched, cg, instruments, issues) {
  const uf = new UnionFind();
  const tokens = new Set(['gnd', 'fg1', 'fg2', 'vcc']);
  for (const [role, comp] of matched) {
    for (const pin of comp.pins) tokens.add(`${role}.${pin.id}`);
  }
  for (const link of lab.links) {
    uf.union(tokenOf(link.a), tokenOf(link.b));
  }
  const byNet = new Map();
  for (const token of tokens) {
    const net = tokenStudentNet(token, flips, matched, cg, instruments);
    if (!net) continue;
    if (!byNet.has(net)) byNet.set(net, []);
    byNet.get(net).push(token);
  }
  let reported = 0;
  for (const tokensOnNet of byNet.values()) {
    if (reported >= 3) break;
    let first = null;
    let second = null;
    for (const token of tokensOnNet) {
      if (!first) {
        first = token;
        continue;
      }
      if (uf.find(token) !== uf.find(first)) {
        second = token;
        break;
      }
    }
    if (first && second) {
      reported++;
      issues.push(issue('error', `Extra: ${prettyToken(first, lab)} is shorted to ${prettyToken(second, lab)}`,
        'Those two points are joined, and the lab reference keeps them apart.',
        'Remove the wire or part that joins them.',
        { holeIds: holesForToken(first, flips, matched).concat(holesForToken(second, flips, matched)) }));
    }
  }
}

function tokenOf(end) {
  if (Array.isArray(end)) return `${end[0]}.${end[1]}`;
  return end;
}

function tokenStudentNet(token, flips, matched, cg, instruments) {
  if (token === 'gnd') return 'GROUND';
  if (token === 'fg1' || token === 'fg2' || token === 'vcc') {
    return endNet(token, flips, matched, cg, instruments);
  }
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  return readPinNet(token.slice(0, dot), token.slice(dot + 1), flips, matched, cg);
}

function prettyToken(token, lab) {
  if (token === 'gnd') return 'ground';
  if (token === 'fg1') return 'Generator 1';
  if (token === 'fg2') return 'Generator 2';
  if (token === 'vcc') return 'the DC supply';
  const dot = token.indexOf('.');
  const role = token.slice(0, dot);
  const pin = token.slice(dot + 1);
  const spec = lab.parts.find((p) => p.role === role);
  return `${spec?.label || role} ${pin}`;
}

function holesForToken(token, flips, matched) {
  if (!token.includes('.')) return [];
  const dot = token.indexOf('.');
  const role = token.slice(0, dot);
  const pinId = token.slice(dot + 1);
  const comp = matched.get(role);
  if (!comp) return [];
  const pin = comp.pins.find((p) => p.id === physicalPin(role, pinId, comp, flips));
  return pin?.holeId ? [pin.holeId] : [];
}

class UnionFind {
  constructor() {
    this.parent = new Map();
  }
  find(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    return root;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function checkGenerators(lab, instruments, issues) {
  const specs = lab.generators || {};
  for (const [key, spec] of Object.entries(specs)) {
    const fg = (instruments?.functionGenerators || []).find((g) => g.id === key);
    if (!fg) continue;
    if (!fg.enabled) {
      const title = spec.offTitle || `Generator ${key === 'FG1' ? 1 : 2} is OFF`;
      issues.push(issue('error', title,
        spec.offTitle
          ? spec.offTitle
          : `${spec.label} comes from ${fg.title || key}, and its output is off.`,
        'Turn that generator output on.',
        { holeIds: [], instrumentId: fg.id, action: { kind: 'enable', instrumentId: fg.id } }));
      continue;
    }
    const fixes = {};
    const problems = [];
    if (spec.waveform && fg.waveform !== spec.waveform) {
      problems.push(`waveform is ${fg.waveform}, expected ${spec.waveform}`);
      fixes.waveform = spec.waveform;
    }
    if (spec.frequency && Math.abs(fg.frequency - spec.frequency) / spec.frequency > 0.2) {
      problems.push(`frequency is ${formatHz(fg.frequency)}, expected about ${formatHz(spec.frequency)}`);
      fixes.frequency = spec.frequency;
    }
    const peak = fg.ampMode === 'Vpp' ? fg.amplitude / 2 : fg.amplitude;
    if (Array.isArray(spec.peak)) {
      if (peak < spec.peak[0] || peak > spec.peak[1]) {
        problems.push(`amplitude is ${peak} Vp, expected ${spec.peak[0]}–${spec.peak[1]} Vp`);
        fixes.amplitude = (spec.peak[0] + spec.peak[1]) / 2;
        fixes.ampMode = 'Vp';
      }
    } else if (typeof spec.peak === 'number' && Math.abs(peak - spec.peak) / spec.peak > 0.2) {
      problems.push(`amplitude is ${peak} Vp, expected about ${spec.peak} Vp`);
      fixes.amplitude = spec.peak;
      fixes.ampMode = 'Vp';
    }
    if (problems.length) {
      issues.push(issue('error', `Wrong value: ${fg.title || key} ${problems[0]}`,
        `${spec.label}: ${problems.join('; ')}.`,
        'Set the generator to the lab values. Fix it for me will do that.',
        {
          holeIds: [],
          instrumentId: fg.id,
          action: { kind: 'generator', instrumentId: fg.id, ...fixes },
        }));
    }
  }
}

function checkSupply(lab, instruments, issues) {
  if (lab.supply == null) return;
  const ps = instruments?.powerSupply;
  if (!ps) return;
  if (!ps.enabled) {
    issues.push(issue('error', 'DC supply is OFF',
      `${lab.name} needs ${lab.supply} V, and the supply output is off.`,
      'Turn the DC supply on and set the voltage.',
      { holeIds: [], instrumentId: ps.id, action: { kind: 'supply', voltage: lab.supply, enabled: true } }));
    return;
  }
  if (Math.abs(ps.voltage - lab.supply) > 0.2) {
    issues.push(issue('error', `Wrong value: DC supply is ${ps.voltage} V, expected ${lab.supply} V`,
      `${lab.name} is built for ${lab.supply} V.`,
      `Set the supply to ${lab.supply} V.`,
      { holeIds: [], instrumentId: ps.id, action: { kind: 'supply', voltage: lab.supply, enabled: true } }));
  }
}

function checkProbe(lab, flips, matched, cg, components, wires, breadboard, issues) {
  if (!lab.probe) return;
  const expected = readPinNet(lab.probe.role, lab.probe.pin, flips, matched, cg);
  if (!expected) return;
  const ch1 = normNet(cg.getNetForHole('OSC_CH1'));
  if (!ch1 || ch1 === 'NET_OSC_CH1') return;
  if (ch1 === expected) return;
  const comp = matched.get(lab.probe.role);
  const pin = comp?.pins.find((p) => p.id === physicalPin(lab.probe.role, lab.probe.pin, comp, flips));
  const occupancy = occupiedHoles(components, wires);
  const free = pin?.holeId ? freeInStrip(breadboard, pin.holeId, occupancy) : null;
  const existing = wires.find((w) => w.fromHoleId === 'OSC_CH1' || w.toHoleId === 'OSC_CH1');
  let action = null;
  if (free && existing) {
    const end = existing.toHoleId === 'OSC_CH1' ? 'from' : 'to';
    action = { kind: 'moveWire', wireId: existing.id, end, holeId: free };
  } else if (free) {
    action = { kind: 'wire', from: 'OSC_CH1', to: free, color: wireColor('OSC_CH1', free, 'scope probe') };
  }
  issues.push(issue('warn', 'Scope CH1 is on the wrong node',
    `CH1 should show ${lab.probe.label}.`,
    `Move the CH1 probe to ${lab.probe.label}.`,
    { holeIds: pin?.holeId ? [pin.holeId] : [], instrumentId: 'OSC1', action }));
}
