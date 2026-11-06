/**
 * InstrumentModel.ts - Data Structures for Benchtop Lab Instruments
 */

export interface InstrumentTerminal {
  id: string;              // e.g. "FG1_OUT", "FG1_GND", "OSC_CH1", "PS_POS"
  name: string;            // e.g. "OUT (+)", "GND (-)", "CH1 (+)"
  color: string;           // Hex color for terminal socket
  x: number;               // Global coordinate in workspace
  y: number;
}

export interface FunctionGenState {
  id: string;
  type: 'function_generator';
  title: string;
  x: number;
  y: number;
  enabled: boolean;
  waveform: 'sine' | 'square' | 'triangle' | 'pulse';
  frequency: number;       // In Hz
  unit: 'Hz' | 'kHz' | 'MHz';
  amplitude: number;       // Primary amplitude
  ampMode: 'Vp' | 'Vpp';   // Peak vs Peak-to-Peak
  offset: number;          // DC offset in Volts
  dutyCycle: number;       // 0.01 to 0.99 for square/pulse
  suggestedHint?: string;  // e.g. "8 kHz, 5 Vp"
  terminals: {
    out: InstrumentTerminal;
    gnd: InstrumentTerminal;
  };
}

export interface PowerSupplyState {
  id: string;
  type: 'dc_supply';
  title: string;
  x: number;
  y: number;
  enabled: boolean;
  voltage: number;         // 0 to 30 V
  current: number;         // Simulated live current readout
  terminals: {
    pos: InstrumentTerminal;
    gnd: InstrumentTerminal;
    neg?: InstrumentTerminal;
  };
}

export interface ScopeChannelMeasurements {
  vMax: number;
  vMin: number;
  vPp: number;
  vRms: number;
  frequency: number;
}

export interface OscilloscopeState {
  id: string;
  type: 'oscilloscope';
  title: string;
  x: number;
  y: number;
  timeDiv: number;         // Seconds per division (e.g. 0.0002 = 200 µs/div)
  ch1VoltsDiv: number;     // Volts per division (e.g. 1.0 V/div)
  ch2VoltsDiv: number;
  ch1Pos: number;          // Vertical offset in divisions (-4 to +4)
  ch2Pos: number;
  ch1Coupling: 'DC' | 'AC' | 'GND';
  ch2Coupling: 'DC' | 'AC' | 'GND';
  ch1Enabled: boolean;
  ch2Enabled: boolean;
  triggerSource: 'CH1' | 'CH2';
  triggerLevel: number;    // In Volts
  triggerEdge: 'rising' | 'falling';
  triggerMode: 'auto' | 'norm' | 'single';
  runStop: boolean;        // true = running, false = stopped
  xyMode: boolean;         // Lissajous X-Y mode
  cursorsEnabled: boolean;
  cursorT1: number;
  cursorT2: number;
  cursorV1: number;
  cursorV2: number;
  fftOpen: boolean;
  fftChannel: 'CH1' | 'CH2';
  measurements: {
    ch1: ScopeChannelMeasurements;
    ch2: ScopeChannelMeasurements;
  };
  terminals: {
    ch1Pos: InstrumentTerminal;
    ch1Gnd: InstrumentTerminal;
    ch2Pos: InstrumentTerminal;
    ch2Gnd: InstrumentTerminal;
  };
}

