/**
 * InstrumentModel.js - Data Structures & Factory for Benchtop Lab Instruments (ES Module)
 */

export function createDefaultFunctionGen(id = 'FG1', title = 'Function Generator 1 (Message)', x = 30, y = 20) {
  const isCarrier = id === 'FG2';
  return {
    id,
    type: 'function_generator',
    title,
    x,
    y,
    enabled: true,
    waveform: 'sine',
    frequency: isCarrier ? 8000.0 : 1000.0,
    unit: 'kHz',
    amplitude: isCarrier ? 5.0 : 2.0, // 5 Vp for carrier, 2 Vp for message
    ampMode: 'Vp',
    offset: 0.0,
    dutyCycle: 0.5,
    suggestedHint: isCarrier ? 'Carrier: 8 kHz, 5 Vp' : 'Message: 1 kHz, 2 Vp',
    terminals: {
      out: {
        id: `${id}_OUT`,
        name: `${title} OUT (+)`,
        color: '#EF4444',
        x: x + 240,
        y: y + 105,
      },
      gnd: {
        id: `${id}_GND`,
        name: `${title} GND (-)`,
        color: '#1F2937',
        x: x + 280,
        y: y + 105,
      },
    },
  };
}

export function createDefaultPowerSupply(id = 'PS1', title = 'DC Power Supply', x = 360, y = 20) {
  return {
    id,
    type: 'dc_supply',
    title,
    x,
    y,
    enabled: true,
    voltage: 5.0,
    current: 0.045,
    terminals: {
      pos: {
        id: `${id}_POS`,
        name: 'VCC (+)',
        color: '#EF4444',
        x: x + 160,
        y: y + 105,
      },
      gnd: {
        id: `${id}_GND`,
        name: 'GND (0V)',
        color: '#1F2937',
        x: x + 200,
        y: y + 105,
      },
    },
  };
}

export function createDefaultOscilloscope(id = 'OSC1', title = 'Dual-Channel Oscilloscope', x = 600, y = 20) {
  return {
    id,
    type: 'oscilloscope',
    title,
    x,
    y,
    timeDiv: 0.0002, // 200 µs/div (shows 2 full cycles of 1 kHz across 10 divs)
    ch1VoltsDiv: 1.0, // 1 V/div
    ch2VoltsDiv: 1.0, // 1 V/div
    ch1Pos: 0.0,
    ch2Pos: 0.0,
    ch1Coupling: 'DC',
    ch2Coupling: 'DC',
    ch1Enabled: true,
    ch2Enabled: true,
    triggerSource: 'CH1',
    triggerLevel: 0.0,
    triggerEdge: 'rising',
    triggerMode: 'auto',
    runStop: true,
    xyMode: false,
    cursorsEnabled: false,
    cursorT1: 0.0004,
    cursorT2: 0.0014,
    cursorV1: 1.0,
    cursorV2: -1.0,
    fftOpen: false,
    fftChannel: 'CH1',
    measurements: {
      ch1: { vMax: 0, vMin: 0, vPp: 0, vRms: 0, frequency: 0 },
      ch2: { vMax: 0, vMin: 0, vPp: 0, vRms: 0, frequency: 0 },
    },
    terminals: {
      ch1Pos: {
        id: 'OSC_CH1',
        name: 'CH1 Probe (+)',
        color: '#FACC15', // Yellow
        x: x + 120,
        y: y + 250,
      },
      ch1Gnd: {
        id: 'OSC_CH1_GND',
        name: 'CH1 GND Clip',
        color: '#1F2937',
        x: x + 160,
        y: y + 250,
      },
      ch2Pos: {
        id: 'OSC_CH2',
        name: 'CH2 Probe (+)',
        color: '#38BDF8', // Cyan
        x: x + 340,
        y: y + 250,
      },
      ch2Gnd: {
        id: 'OSC_CH2_GND',
        name: 'CH2 GND Clip',
        color: '#1F2937',
        x: x + 380,
        y: y + 250,
      },
    },
  };
}

