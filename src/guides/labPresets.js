/**
 * Preset builds for the five labs. Hole choices match the checker reference:
 * one lead per hole, parts joined only through strips and wires.
 */

import { suggestTimeDiv } from '../ui/labCheck.js';

export const LAB_PRESETS = {
  lab1a: {
    id: 'lab1a',
    name: 'Lab 1A: AM Modulation',
    aim: 'Build an AM signal: a 100 Hz message and an 8 kHz carrier meet at a 1N4007 anode through 1 kΩ resistors. The cathode drives a 4 mH and 0.1 µF tank to ground.',
    equipment: ['Generator 1: sine, 100 Hz, 2 Vp', 'Generator 2: sine, 8 kHz, 5 Vp', '1N4007 diode', 'Two 1 kΩ resistors', '4 mH inductor', '0.1 µF capacitor', 'Oscilloscope'],
    parts: [
      { type: 'resistor', hole: '8-B', props: { value: 1000, label: 'R1' }, holes: ['8-B', '12-B'], label: 'Place R1, 1 kΩ (message)', why: 'R1 brings the message to the diode anode without shorting the generator.' },
      { type: 'resistor', hole: '20-B', props: { value: 1000, label: 'R2' }, holes: ['20-B', '24-B'], label: 'Place R2, 1 kΩ (carrier)', why: 'R2 brings the carrier to the same anode on a different strip, so the two generators are not tied together.' },
      { type: 'diode_1n4007', hole: '12-D', props: { label: 'D1' }, holes: ['12-D', '15-D'], label: 'Place the 1N4007', why: 'The anode sits on R1’s output strip. The band (cathode) points at the tank.' },
      { type: 'inductor', hole: '15-A', props: { value: 0.004, label: 'L1' }, holes: ['15-A', '18-A'], label: 'Place L, 4 mH', why: 'One end shares the cathode strip. With the capacitor this is the tuned circuit, about 8 kHz.' },
      { type: 'capacitor', hole: '15-E', props: { value: 0.1e-6, label: 'C1' }, holes: ['15-E', '17-E'], label: 'Place C, 0.1 µF', why: 'C sits across the inductor. The AM waveform is the voltage on this tank.' },
    ],
    wires: [
      { from: '12-A', to: '24-A', label: 'Join R2 to the diode anode', why: 'R2’s far end and the anode are different columns. This wire makes them one node.' },
      { from: 'FG1_OUT', to: '8-A', label: 'Wire Generator 1 to R1', why: '8-A is the same strip as R1’s input, so the message reaches R1.' },
      { from: 'FG1_GND', to: 'BN-8', label: 'Ground Generator 1', why: 'The generator return has to land on the blue rail or the message has no reference.' },
      { from: 'FG2_OUT', to: '20-D', label: 'Wire Generator 2 to R2', why: '20-D is R2’s input strip. The carrier stays separate from the message until the anode.' },
      { from: 'FG2_GND', to: 'BN-20', label: 'Ground Generator 2', why: 'Both generator grounds share the bottom blue rail.' },
      { from: '18-C', to: 'BN-18', label: 'Ground the inductor', why: '18-C is the free end of L. The tank current returns through this rail.' },
      { from: '17-B', to: 'BN-17', label: 'Ground the capacitor', why: '17-B is the free end of C, so L and C are in parallel to ground.' },
      { from: 'OSC_CH1', to: '15-B', label: 'Probe the cathode', why: '15-B is the tank node. CH1 shows the AM signal.' },
      { from: 'OSC_CH1_GND', to: 'BN-12', label: 'Ground the CH1 probe', why: 'The scope measures the cathode against the same ground as the tank.' },
    ],
    instruments: {
      fg1: { waveform: 'sine', frequency: 100, amplitude: 2, ampMode: 'Vp' },
      fg2: { waveform: 'sine', frequency: 8000, amplitude: 5, ampMode: 'Vp' },
      scope: { ch1VoltsDiv: 1 },
    },
  },

  lab1b: {
    id: 'lab1b',
    name: 'Lab 1B: AM Demodulation',
    aim: 'Recover the message. The AM signal passes a 0.01 µF capacitor into an OA79. A 10 kΩ resistor holds the input, and 100 kΩ with 0.1 µF at the cathode is the envelope filter.',
    equipment: ['Generator 1: sine, 1 kHz, 2 Vp (stand-in for the AM signal)', 'OA79 diode', '0.01 µF and 0.1 µF capacitors', '10 kΩ and 100 kΩ resistors', 'Oscilloscope'],
    parts: [
      { type: 'capacitor', hole: '8-C', props: { value: 0.01e-6, label: 'C1' }, holes: ['8-C', '10-C'], label: 'Place C1, 0.01 µF', why: 'C1 couples the AM signal into the detector and blocks DC.' },
      { type: 'diode_oa79', hole: '10-D', props: { label: 'D1' }, holes: ['10-D', '13-D'], label: 'Place the OA79', why: 'A germanium diode drops only about 0.2 V, so a small message still gets through. Anode faces C1.' },
      { type: 'resistor', hole: '10-A', props: { value: 10000, label: 'R1' }, holes: ['10-A', '14-A'], label: 'Place R1, 10 kΩ', why: 'R1 holds the diode input node down to ground so the coupling capacitor has a discharge path.' },
      { type: 'resistor', hole: '13-B', props: { value: 100000, label: 'R2' }, holes: ['13-B', '17-B'], label: 'Place R2, 100 kΩ', why: 'R2 is the envelope load. With C2 it keeps the message and removes the carrier.' },
      { type: 'capacitor', hole: '13-E', props: { value: 0.1e-6, label: 'C2' }, holes: ['13-E', '15-E'], label: 'Place C2, 0.1 µF', why: 'C2 is in parallel with R2. The recovered message is the voltage across C2.' },
    ],
    wires: [
      { from: '14-B', to: 'BN-14', label: 'Ground R1', why: '14-B is R1’s free end. The detector input now has a DC path to ground.' },
      { from: '17-C', to: 'BN-17', label: 'Ground R2', why: '17-C is R2’s free end, the bottom of the envelope filter.' },
      { from: '15-A', to: 'BN-15', label: 'Ground C2', why: '15-A is C2’s free end, so C2 really is in parallel with R2.' },
      { from: 'FG1_OUT', to: '8-A', label: 'Wire the AM input to C1', why: '8-A is C1’s input strip.' },
      { from: 'FG1_GND', to: 'BN-8', label: 'Ground Generator 1', why: 'The source and the detector share the bottom blue rail.' },
      { from: 'OSC_CH1', to: '13-C', label: 'Probe the cathode', why: '13-C is the envelope node, the voltage across C2.' },
      { from: 'OSC_CH1_GND', to: 'BN-12', label: 'Ground the CH1 probe', why: 'CH1 is measured against the detector ground.' },
    ],
    instruments: {
      fg1: { waveform: 'sine', frequency: 1000, amplitude: 2, ampMode: 'Vp' },
      scope: { ch1VoltsDiv: 1 },
    },
  },

  lab2: {
    id: 'lab2',
    name: 'Lab 2: FM using ICL8038',
    aim: 'The ICL8038 is the VCO. Pins 4 and 5 each have 10 kΩ to +18 V, pin 10 has 0.01 µF to ground, and the message reaches tied pins 7 and 8 through 0.1 µF. FM comes out on pin 2.',
    equipment: ['ICL8038', 'Two 10 kΩ resistors', '0.01 µF and 0.1 µF capacitors', 'DC supply +18 V', 'Generator 1: sine, 1 kHz, 1 Vp', 'Oscilloscope on pin 2'],
    parts: [
      { type: 'ic_8038', hole: '20-E', props: { label: 'U1' }, holes: ['20-E', '26-E', '20-F', '26-F'], label: 'Place the ICL8038 across the gap', why: 'Pin 1 lands in row E and pin 14 in row F, so the package straddles the centre gap. One pin per strip.' },
      { type: 'resistor', hole: '23-A', props: { value: 10000, label: 'RA' }, holes: ['23-A', '27-A'], label: 'Place RA, 10 kΩ, on pin 4', why: '23-A is pin 4’s strip. RA sets one of the timing currents.' },
      { type: 'resistor', hole: '24-B', props: { value: 10000, label: 'RB' }, holes: ['24-B', '28-B'], label: 'Place RB, 10 kΩ, on pin 5', why: '24-B is pin 5’s strip. RA and RB together set the unmodulated frequency near 4 kHz.' },
      { type: 'capacitor', hole: '30-C', props: { value: 0.01e-6, label: 'CT' }, holes: ['30-C', '32-C'], label: 'Place the 0.01 µF timing capacitor', why: 'This is the pin 10 capacitor. It is wired across to the IC so it does not short pin 8.' },
      { type: 'capacitor', hole: '34-C', props: { value: 0.1e-6, label: 'CM' }, holes: ['34-C', '36-C'], label: 'Place the 0.1 µF message capacitor', why: 'The message is AC-coupled into the FM pins. A direct wire would put the generator’s DC on the VCO.' },
    ],
    wires: [
      { from: 'PS1_POS', to: '25-B', label: 'Supply pin 6', why: '25-B is pin 6 (V+). The chip runs from +18 V.' },
      { from: 'PS1_POS', to: '27-B', label: 'RA to +18 V', why: '27-B is RA’s free end. Pin 4 now sees +18 V through 10 kΩ.' },
      { from: 'PS1_POS', to: '28-A', label: 'RB to +18 V', why: '28-A is RB’s free end, the same supply node as pin 6.' },
      { from: 'PS1_GND', to: 'BN-25', label: 'Ground the supply', why: 'The supply return joins the bottom blue rail.' },
      { from: '23-G', to: 'BN-23', label: 'Ground pin 11', why: '23-G is pin 11’s strip. That pin is V− / GND.' },
      { from: '24-G', to: '30-A', label: 'Pin 10 to the timing capacitor', why: '24-G is pin 10. 30-A is one end of the 0.01 µF capacitor.' },
      { from: '32-B', to: 'BN-32', label: 'Ground the timing capacitor', why: 'The other end of that capacitor goes to ground, as the datasheet shows for pin 10.' },
      { from: '26-A', to: '26-H', label: 'Tie pins 7 and 8', why: 'Pin 7 is on the top of column 26 and pin 8 is on the bottom. They must be one node for FM.' },
      { from: '26-B', to: '34-A', label: 'Message capacitor to pins 7 and 8', why: '34-A is the message capacitor. 26-B is the tied FM pins.' },
      { from: 'FG1_OUT', to: '36-A', label: 'Generator 1 to the message capacitor', why: '36-A is the other side of the 0.1 µF capacitor.' },
      { from: 'FG1_GND', to: 'BN-36', label: 'Ground Generator 1', why: 'The message source shares the chip ground.' },
      { from: 'OSC_CH1', to: '21-A', label: 'Probe pin 2', why: '21-A is the sine output, pin 2. That is the FM signal.' },
      { from: 'OSC_CH1_GND', to: 'BN-21', label: 'Ground the CH1 probe', why: 'The scope ground is the same rail as pin 11.' },
    ],
    instruments: {
      fg1: { waveform: 'sine', frequency: 1000, amplitude: 1, ampMode: 'Vp' },
      supply: 18,
      scope: { ch1VoltsDiv: 5 },
    },
  },

  lab5: {
    id: 'lab5',
    name: 'Lab 5: PAM using BC107',
    aim: 'A BC107 samples the message. Collector 2.2 kΩ goes to +10 V, emitter 1 kΩ goes to ground, and the base is fed by two 4.7 kΩ resistors from a 1 kHz sine and a 10 kHz pulse. PAM is at the emitter.',
    equipment: ['BC107', '2.2 kΩ, 1 kΩ, and two 4.7 kΩ resistors', 'Supply +10 V', 'Generator 1: sine, 1 kHz, 1 Vp', 'Generator 2: pulse, 10 kHz, 2.5 Vp', 'Oscilloscope on the emitter'],
    parts: [
      { type: 'transistor_bc107', hole: '16-D', props: { label: 'Q1' }, holes: ['16-D', '17-D', '18-D'], label: 'Place the BC107', why: 'Emitter, base, and collector land in three different strips: 16-D, 17-D, and 18-D.' },
      { type: 'resistor', hole: '18-A', props: { value: 2200, label: 'RC' }, holes: ['18-A', '22-A'], label: 'Place RC, 2.2 kΩ', why: '18-A is the collector strip. This resistor feeds the collector from +10 V.' },
      { type: 'resistor', hole: '16-A', props: { value: 1000, label: 'RE' }, holes: ['16-A', '20-A'], label: 'Place RE, 1 kΩ', why: '16-A is the emitter strip. The PAM waveform is the voltage across this resistor.' },
      { type: 'resistor', hole: '17-B', props: { value: 4700, label: 'RM' }, holes: ['17-B', '21-B'], label: 'Place RM, 4.7 kΩ (message)', why: '17-B is the base. The message reaches the base through 4.7 kΩ.' },
      { type: 'resistor', hole: '13-E', props: { value: 4700, label: 'RP' }, holes: ['13-E', '17-E'], label: 'Place RP, 4.7 kΩ (pulse)', why: '17-E is also the base strip, but the pulse comes from column 13 so it is not shorted to the message.' },
    ],
    wires: [
      { from: 'PS1_POS', to: '22-C', label: 'Collector resistor to +10 V', why: '22-C is RC’s free end. The collector supply is 10 V.' },
      { from: 'PS1_GND', to: 'BN-18', label: 'Ground the supply', why: 'The 10 V return is the bottom blue rail.' },
      { from: '20-B', to: 'BN-20', label: 'Ground the emitter resistor', why: '20-B is RE’s free end. Emitter current returns here, and CH1 reads this node against ground.' },
      { from: 'FG1_OUT', to: '21-C', label: 'Message to RM', why: '21-C is RM’s free end. Generator 1 is the 1 kHz sine.' },
      { from: 'FG1_GND', to: 'BN-10', label: 'Ground Generator 1', why: 'The message shares the circuit ground.' },
      { from: 'FG2_OUT', to: '13-A', label: 'Pulse to RP', why: '13-A is RP’s free end. Generator 2 is the 10 kHz sampling pulse.' },
      { from: 'FG2_GND', to: 'BN-13', label: 'Ground Generator 2', why: 'The pulse source uses the same ground rail.' },
      { from: 'OSC_CH1', to: '16-B', label: 'Probe the emitter', why: '16-B is the emitter strip. That voltage is the PAM output.' },
      { from: 'OSC_CH1_GND', to: 'BN-16', label: 'Ground the CH1 probe', why: 'The probe ground is the emitter resistor’s ground.' },
    ],
    instruments: {
      fg1: { waveform: 'sine', frequency: 1000, amplitude: 1, ampMode: 'Vp' },
      fg2: { waveform: 'pulse', frequency: 10000, amplitude: 2.5, ampMode: 'Vp' },
      supply: 10,
      scope: { ch1VoltsDiv: 1 },
    },
  },

  lab7: {
    id: 'lab7',
    name: 'Lab 7: PWM using 555',
    aim: 'The 555 is an astable. RA is 220 Ω from the supply to pin 7, RB is 1 kΩ from pin 7 to pin 6, pins 2 and 6 are tied, and 0.01 µF goes to ground. The 10 kHz message enters pin 5 through another 0.01 µF. PWM is pin 3. Supply is +15 V, and pin 4 is tied to it.',
    equipment: ['555 timer', '220 Ω and 1 kΩ resistors', 'Two 0.01 µF capacitors', 'Supply +15 V', 'Generator 1: sine, 10 kHz, 2.5 Vp', 'Oscilloscope on pin 3'],
    parts: [
      { type: 'ic_555', hole: '20-E', props: { label: 'U1' }, holes: ['20-E', '23-E', '20-F', '23-F'], label: 'Place the 555 across the gap', why: 'Pin 1 is in row E and pin 8 in row F. Pins 2 and 6 are on opposite sides, so a wire has to tie them.' },
      { type: 'resistor', hole: '21-H', props: { value: 220, label: 'RA' }, holes: ['21-H', '25-H'], label: 'Place RA, 220 Ω', why: '21-H is pin 7’s strip. RA is the charge resistor from the supply to the discharge pin.' },
      { type: 'resistor', hole: '18-J', props: { value: 1000, label: 'RB' }, holes: ['18-J', '22-J'], label: 'Place RB, 1 kΩ', why: '22-J is pin 6. RB will be wired from pin 7 to pin 6 so the capacitor charges through RA+RB and discharges through RB.' },
      { type: 'capacitor', hole: '30-C', props: { value: 0.01e-6, label: 'CA' }, holes: ['30-C', '32-C'], label: 'Place CA, 0.01 µF', why: 'CA is the timing capacitor. f ≈ 1.44 / ((RA + 2 RB) C) is about 65 kHz.' },
      { type: 'capacitor', hole: '34-D', props: { value: 0.01e-6, label: 'CB' }, holes: ['34-D', '36-D'], label: 'Place CB, 0.01 µF', why: 'CB couples the message into pin 5, the control pin that moves the PWM thresholds.' },
    ],
    wires: [
      { from: 'PS1_POS', to: '20-G', label: 'Supply pin 8', why: '20-G is pin 8. The timer is powered from +15 V.' },
      { from: 'PS1_POS', to: '23-A', label: 'Tie pin 4 to the supply', why: '23-A is pin 4 (RESET). Held at the supply, RESET stays high and the 555 can run.' },
      { from: 'PS1_POS', to: '25-G', label: 'RA to the supply', why: '25-G is RA’s free end. Pin 7 is fed from the supply through 220 Ω.' },
      { from: 'PS1_GND', to: 'BN-28', label: 'Ground the supply', why: 'The supply return is the bottom blue rail.' },
      { from: '20-A', to: 'BN-20', label: 'Ground pin 1', why: '20-A is pin 1. It is not the same strip as pin 8, which is on the bottom of column 20.' },
      { from: '21-I', to: '18-G', label: 'RB to pin 7', why: '21-I is pin 7 and 18-G is RB’s other end. Pin 7 now reaches pin 6 through 1 kΩ.' },
      { from: '21-A', to: '22-G', label: 'Tie pins 2 and 6', why: 'Pin 2 is on the top of column 21 and pin 6 is on the bottom of column 22. Tied together, the capacitor charges and discharges between 1/3 and 2/3 of VCC.' },
      { from: '21-B', to: '30-A', label: 'Timing capacitor to pins 2 and 6', why: '30-A is CA. 21-B is the pin 2 strip, which is already tied to pin 6.' },
      { from: '32-A', to: 'BN-32', label: 'Ground the timing capacitor', why: 'CA’s other end goes to ground. That is the astable timing node’s return.' },
      { from: '23-G', to: '34-A', label: 'Message capacitor to pin 5', why: '23-G is pin 5. 34-A is CB. The message does not have a DC path into the control pin.' },
      { from: 'FG1_OUT', to: '36-A', label: 'Generator 1 to CB', why: '36-A is CB’s other end. The message is a 10 kHz, 2.5 Vp sine.' },
      { from: 'FG1_GND', to: 'BN-36', label: 'Ground Generator 1', why: 'The message source shares the 555 ground.' },
      { from: 'OSC_CH1', to: '22-A', label: 'Probe pin 3', why: '22-A is the output, pin 3. That is the PWM waveform.' },
      { from: 'OSC_CH1_GND', to: 'BN-22', label: 'Ground the CH1 probe', why: 'The scope ground is pin 1’s rail.' },
    ],
    instruments: {
      fg1: { waveform: 'sine', frequency: 10000, amplitude: 2.5, ampMode: 'Vp' },
      supply: 15,
      scope: { ch1VoltsDiv: 5 },
    },
  },

  lab8: {
    id: 'lab8',
    name: 'Lab 8: ASK using 2N2222',
    aim: 'The 13 kHz carrier drives the collector. A 500 Hz square message reaches the base through 10 kΩ. The emitter has 1 kΩ to ground. ASK is the emitter voltage: carrier bursts while the message is high.',
    equipment: ['2N2222', '10 kΩ and 1 kΩ resistors', 'Generator 1: square, 500 Hz, 2.5 Vp', 'Generator 2: sine, 13 kHz, 6 Vp', 'Oscilloscope on the emitter'],
    parts: [
      { type: 'transistor_2n2222', hole: '16-D', props: { label: 'Q1' }, holes: ['16-D', '17-D', '18-D'], label: 'Place the 2N2222', why: 'Emitter 16-D, base 17-D, collector 18-D. Three strips, so the transistor does not short itself.' },
      { type: 'resistor', hole: '17-A', props: { value: 10000, label: 'RB' }, holes: ['17-A', '21-A'], label: 'Place RB, 10 kΩ', why: '17-A is the base. The square message drives the base through 10 kΩ.' },
      { type: 'resistor', hole: '12-C', props: { value: 1000, label: 'RE' }, holes: ['12-C', '16-C'], label: 'Place RE, 1 kΩ', why: '16-C is the emitter strip. The ASK output is the voltage on this resistor.' },
    ],
    wires: [
      { from: '12-A', to: 'BN-12', label: 'Ground the emitter resistor', why: '12-A is RE’s free end. Emitter current returns to the blue rail.' },
      { from: 'FG1_OUT', to: '21-B', label: 'Message to the base resistor', why: '21-B is RB’s free end. Generator 1 is the 500 Hz square wave.' },
      { from: 'FG1_GND', to: 'BN-21', label: 'Ground Generator 1', why: 'The message return is the emitter ground.' },
      { from: 'FG2_OUT', to: '18-A', label: 'Carrier to the collector', why: '18-A is the collector. The 13 kHz sine is switched by the transistor.' },
      { from: 'FG2_GND', to: 'BN-18', label: 'Ground Generator 2', why: 'The carrier source shares the circuit ground.' },
      { from: 'OSC_CH1', to: '16-B', label: 'Probe the emitter', why: '16-B is the emitter strip. You should see bursts of the carrier at the message rate.' },
      { from: 'OSC_CH1_GND', to: 'BN-16', label: 'Ground the CH1 probe', why: 'CH1 measures the emitter against the 1 kΩ ground.' },
    ],
    instruments: {
      fg1: { waveform: 'square', frequency: 500, amplitude: 2.5, ampMode: 'Vp' },
      fg2: { waveform: 'sine', frequency: 13000, amplitude: 6, ampMode: 'Vp' },
      scope: { ch1VoltsDiv: 2 },
    },
  },
};

export function applyLabInstruments(instruments, labId) {
  const preset = LAB_PRESETS[labId];
  if (!preset) return;
  const fg1 = instruments.functionGenerators?.[0];
  const fg2 = instruments.functionGenerators?.[1];
  const ps = instruments.powerSupply;
  const osc = instruments.oscilloscope;
  const spec = preset.instruments;

  const applyFg = (fg, values) => {
    if (!fg || !values) return;
    fg.enabled = true;
    fg.waveform = values.waveform;
    fg.frequency = values.frequency;
    fg.amplitude = values.amplitude;
    fg.ampMode = values.ampMode || 'Vp';
    fg.unit = values.frequency >= 1e6 ? 'MHz' : values.frequency >= 1000 ? 'kHz' : 'Hz';
  };

  applyFg(fg1, spec.fg1);
  applyFg(fg2, spec.fg2);
  if (ps && spec.supply != null) {
    ps.enabled = true;
    ps.voltage = spec.supply;
  }
  if (osc) {
    osc.ch1Coupling = 'DC';
    osc.ch2Coupling = 'DC';
    osc.ch1Enabled = true;
    if (spec.scope?.ch1VoltsDiv) osc.ch1VoltsDiv = spec.scope.ch1VoltsDiv;
    const lowest = [spec.fg1, spec.fg2].filter(Boolean).map((fg) => fg.frequency);
    osc.timeDiv = suggestTimeDiv(Math.min(...lowest));
  }
}

export function buildLabPreset(state, labId) {
  const preset = LAB_PRESETS[labId];
  if (!preset) throw new Error(`Unknown lab ${labId}`);
  state.clearCircuit();
  for (const part of preset.parts) {
    state.startPlacement(part.type, part.props);
    const ok = state.commitPendingPlacement(part.hole);
    if (!ok) throw new Error(`${preset.name}: could not place ${part.label} at ${part.hole}`);
  }
  for (const wire of preset.wires) {
    const placed = state.addWire(wire.from, wire.to);
    if (!placed) throw new Error(`${preset.name}: could not wire ${wire.label} (${wire.from} to ${wire.to})`);
  }
  return preset;
}
