/**
 * Structural reference for each lab. Hole numbers are not fixed;
 * the checker compares parts, values, and which pins share a net.
 */

export const LAB_REFERENCES = {
  lab1a: {
    id: 'lab1a',
    name: 'Lab 1A: AM Modulation',
    parts: [
      { role: 'D1', type: 'diode_1n4007', label: '1N4007 diode' },
      { role: 'R1', type: 'resistor', value: 1000, label: 'R1 (message)' },
      { role: 'R2', type: 'resistor', value: 1000, label: 'R2 (carrier)' },
      { role: 'L1', type: 'inductor', value: 0.004, label: 'L (tank)' },
      { role: 'C1', type: 'capacitor', value: 0.1e-6, label: 'C (tank)' },
    ],
    links: [
      { name: 'Generator 1 to R1 (message)', a: 'fg1', b: ['R1', 'p1'] },
      { name: 'Generator 2 to R2 (carrier)', a: 'fg2', b: ['R2', 'p1'] },
      { name: 'R1 (message) to the diode anode', a: ['R1', 'p2'], b: ['D1', 'anode'] },
      { name: 'R2 (carrier) to the diode anode', a: ['R2', 'p2'], b: ['D1', 'anode'] },
      { name: 'diode cathode to the tank inductor', a: ['D1', 'cathode'], b: ['L1', 'p1'] },
      { name: 'diode cathode to the tank capacitor', a: ['D1', 'cathode'], b: ['C1', 'p1'] },
      { name: 'tank inductor to ground', a: ['L1', 'p2'], b: 'gnd' },
      { name: 'tank capacitor to ground', a: ['C1', 'p2'], b: 'gnd' },
    ],
    generators: {
      FG1: { waveform: 'sine', frequency: 100, peak: [1, 3], label: 'message' },
      FG2: {
        waveform: 'sine',
        frequency: 8000,
        peak: 5,
        label: 'carrier',
        offTitle: 'No envelope: the carrier is 0 V because Generator 2 is OFF.',
      },
    },
    probe: { role: 'D1', pin: 'cathode', label: 'the AM output at the diode cathode' },
  },

  lab1b: {
    id: 'lab1b',
    name: 'Lab 1B: AM Demodulation',
    parts: [
      { role: 'Cin', type: 'capacitor', value: 0.01e-6, label: 'C1 0.01 µF' },
      { role: 'D1', type: 'diode_oa79', label: 'OA79 diode' },
      { role: 'Rin', type: 'resistor', value: 10000, label: 'R1 10 kΩ' },
      { role: 'Rout', type: 'resistor', value: 100000, label: 'R2 100 kΩ' },
      { role: 'Cout', type: 'capacitor', value: 0.1e-6, label: 'C2 0.1 µF' },
    ],
    links: [
      { name: 'AM input to C1', a: 'fg1', b: ['Cin', 'p1'] },
      { name: 'C1 to the OA79 anode', a: ['Cin', 'p2'], b: ['D1', 'anode'] },
      { name: 'R1 10 kΩ from the diode input to ground', a: ['Rin', 'p1'], b: ['D1', 'anode'] },
      { name: 'R1 10 kΩ to ground', a: ['Rin', 'p2'], b: 'gnd' },
      { name: 'OA79 cathode to R2', a: ['D1', 'cathode'], b: ['Rout', 'p1'] },
      { name: 'OA79 cathode to C2', a: ['D1', 'cathode'], b: ['Cout', 'p1'] },
      { name: 'R2 100 kΩ to ground', a: ['Rout', 'p2'], b: 'gnd' },
      { name: 'C2 0.1 µF to ground', a: ['Cout', 'p2'], b: 'gnd' },
    ],
    generators: {
      FG1: { waveform: 'sine', frequency: 1000, peak: [1, 5], label: 'AM input' },
    },
    probe: { role: 'D1', pin: 'cathode', label: 'the recovered message across C2' },
  },

  lab2: {
    id: 'lab2',
    name: 'Lab 2: FM using ICL8038',
    parts: [
      { role: 'U1', type: 'ic_8038', label: 'ICL8038' },
      { role: 'RA', type: 'resistor', value: 10000, label: 'RA 10 kΩ (pin 4)' },
      { role: 'RB', type: 'resistor', value: 10000, label: 'RB 10 kΩ (pin 5)' },
      { role: 'CT', type: 'capacitor', value: 0.01e-6, label: 'timing capacitor 0.01 µF' },
      { role: 'CM', type: 'capacitor', value: 0.1e-6, label: 'message capacitor 0.1 µF' },
    ],
    links: [
      { name: 'pin 6 (V+) to the +18 V supply', a: ['U1', 'p6'], b: 'vcc' },
      { name: 'pin 11 to ground', a: ['U1', 'p11'], b: 'gnd' },
      { name: 'RA 10 kΩ from pin 4 to +18 V', a: ['RA', 'p1'], b: ['U1', 'p4'] },
      { name: 'RA 10 kΩ to +18 V', a: ['RA', 'p2'], b: 'vcc' },
      { name: 'RB 10 kΩ from pin 5 to +18 V', a: ['RB', 'p1'], b: ['U1', 'p5'] },
      { name: 'RB 10 kΩ to +18 V', a: ['RB', 'p2'], b: 'vcc' },
      { name: 'timing capacitor from pin 10 to ground', a: ['CT', 'p1'], b: ['U1', 'p10'] },
      { name: 'timing capacitor to ground', a: ['CT', 'p2'], b: 'gnd' },
      { name: 'pins 7 and 8 tied together', a: ['U1', 'p7'], b: ['U1', 'p8'] },
      { name: 'message capacitor into pins 7 and 8', a: ['CM', 'p1'], b: ['U1', 'p7'] },
      { name: 'Generator 1 to the message capacitor', a: 'fg1', b: ['CM', 'p2'] },
    ],
    generators: {
      FG1: { waveform: 'sine', frequency: 1000, peak: [0.5, 1.2], label: 'message' },
    },
    supply: 18,
    probe: { role: 'U1', pin: 'p2', label: 'the FM output on pin 2' },
  },

  lab5: {
    id: 'lab5',
    name: 'Lab 5: PAM using BC107',
    parts: [
      { role: 'Q1', type: 'transistor_bc107', label: 'BC107' },
      { role: 'RC', type: 'resistor', value: 2200, label: 'collector resistor 2.2 kΩ' },
      { role: 'RE', type: 'resistor', value: 1000, label: 'emitter resistor 1 kΩ' },
      { role: 'RM', type: 'resistor', value: 4700, label: 'message resistor 4.7 kΩ' },
      { role: 'RP', type: 'resistor', value: 4700, label: 'pulse resistor 4.7 kΩ' },
    ],
    links: [
      { name: 'collector resistor to VCC', a: ['RC', 'p1'], b: 'vcc' },
      { name: 'collector resistor to the collector', a: ['RC', 'p2'], b: ['Q1', 'C'] },
      { name: 'emitter resistor to the emitter', a: ['RE', 'p1'], b: ['Q1', 'E'] },
      { name: 'emitter resistor to ground', a: ['RE', 'p2'], b: 'gnd' },
      { name: 'message resistor to the base', a: ['RM', 'p1'], b: ['Q1', 'B'] },
      { name: 'Generator 1 to the message resistor', a: 'fg1', b: ['RM', 'p2'] },
      { name: 'pulse resistor to the base', a: ['RP', 'p1'], b: ['Q1', 'B'] },
      { name: 'Generator 2 to the pulse resistor', a: 'fg2', b: ['RP', 'p2'] },
    ],
    generators: {
      FG1: { waveform: 'sine', frequency: 1000, peak: 1, label: 'message' },
      FG2: { waveform: 'pulse', frequency: 10000, peak: 2.5, label: 'sampling pulse' },
    },
    supply: 10,
    probe: { role: 'Q1', pin: 'E', label: 'the PAM output at the emitter' },
  },

  lab7: {
    id: 'lab7',
    name: 'Lab 7: PWM using 555',
    parts: [
      { role: 'U1', type: 'ic_555', label: '555 timer' },
      { role: 'RA', type: 'resistor', value: 220, label: 'RA 220 Ω' },
      { role: 'RB', type: 'resistor', value: 1000, label: 'RB 1 kΩ' },
      { role: 'CA', type: 'capacitor', value: 0.01e-6, label: 'CA 0.01 µF' },
      { role: 'CB', type: 'capacitor', value: 0.01e-6, label: 'CB 0.01 µF' },
    ],
    links: [
      { name: 'pin 8 to the supply', a: ['U1', 'p8'], b: 'vcc' },
      { name: 'pin 4 (RESET) to the supply', a: ['U1', 'p4'], b: 'vcc' },
      { name: 'pin 1 to ground', a: ['U1', 'p1'], b: 'gnd' },
      { name: 'RA from the supply to pin 7', a: ['RA', 'p1'], b: 'vcc' },
      { name: 'RA to pin 7', a: ['RA', 'p2'], b: ['U1', 'p7'] },
      { name: 'RB between pin 7 and pin 6', a: ['RB', 'p1'], b: ['U1', 'p7'] },
      { name: 'RB to pin 6', a: ['RB', 'p2'], b: ['U1', 'p6'] },
      { name: 'pins 2 and 6 tied', a: ['U1', 'p2'], b: ['U1', 'p6'] },
      { name: 'CA from pins 2 and 6 to ground', a: ['CA', 'p1'], b: ['U1', 'p2'] },
      { name: 'CA to ground', a: ['CA', 'p2'], b: 'gnd' },
      { name: 'message capacitor into pin 5', a: ['CB', 'p1'], b: ['U1', 'p5'] },
      { name: 'Generator 1 to the message capacitor', a: 'fg1', b: ['CB', 'p2'] },
    ],
    generators: {
      FG1: { waveform: 'sine', frequency: 10000, peak: 2.5, label: 'message' },
    },
    supply: 15,
    probe: { role: 'U1', pin: 'p3', label: 'the PWM output on pin 3' },
  },

  lab8: {
    id: 'lab8',
    name: 'Lab 8: ASK using 2N2222',
    parts: [
      { role: 'Q1', type: 'transistor_2n2222', label: '2N2222' },
      { role: 'RB', type: 'resistor', value: 10000, label: 'base resistor 10 kΩ' },
      { role: 'RE', type: 'resistor', value: 1000, label: 'emitter resistor 1 kΩ' },
    ],
    links: [
      { name: 'carrier generator to the collector', a: 'fg2', b: ['Q1', 'C'] },
      { name: 'base resistor to the base', a: ['RB', 'p1'], b: ['Q1', 'B'] },
      { name: 'Generator 1 to the base resistor', a: 'fg1', b: ['RB', 'p2'] },
      { name: 'emitter resistor to the emitter', a: ['RE', 'p1'], b: ['Q1', 'E'] },
      { name: 'emitter resistor to ground', a: ['RE', 'p2'], b: 'gnd' },
    ],
    generators: {
      FG1: { waveform: 'square', frequency: 500, peak: 2.5, label: 'message' },
      FG2: { waveform: 'sine', frequency: 13000, peak: 6, label: 'carrier' },
    },
    probe: { role: 'Q1', pin: 'E', label: 'the ASK output at the emitter' },
  },
};
