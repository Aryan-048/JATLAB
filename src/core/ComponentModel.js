/**
 * ComponentModel.js - Electronic Components Data Models & Definitions (ES Module)
 */

export const COLOR_MAP = {
  0: { name: 'Black', hex: '#111827' },
  1: { name: 'Brown', hex: '#78350F' },
  2: { name: 'Red', hex: '#DC2626' },
  3: { name: 'Orange', hex: '#EA580C' },
  4: { name: 'Yellow', hex: '#EAB308' },
  5: { name: 'Green', hex: '#16A34A' },
  6: { name: 'Blue', hex: '#2563EB' },
  7: { name: 'Violet', hex: '#9333EA' },
  8: { name: 'Gray', hex: '#6B7280' },
  9: { name: 'White', hex: '#F9FAFB' },
};

export const TOLERANCE_GOLD = { name: 'Gold (5%)', hex: '#D97706' };

export function calculateResistorBands(ohms) {
  if (ohms <= 0) return ['#78350F', '#111827', '#111827', TOLERANCE_GOLD.hex];

  let strVal = Math.round(ohms).toString();
  if (strVal.length === 1) {
    strVal = strVal + '0';
  }

  const d1 = parseInt(strVal[0], 10);
  const d2 = parseInt(strVal[1], 10);
  const multiplierPower = Math.floor(Math.log10(ohms)) - 1;
  const mult = Math.max(0, Math.min(6, multiplierPower));

  return [
    COLOR_MAP[d1]?.hex || '#78350F',
    COLOR_MAP[d2]?.hex || '#111827',
    COLOR_MAP[mult]?.hex || '#DC2626',
    TOLERANCE_GOLD.hex,
  ];
}

export function formatResistance(ohms) {
  if (ohms >= 1e6) return `${(ohms / 1e6).toFixed(1).replace(/\.0$/, '')} MΩ`;
  if (ohms >= 1e3) return `${(ohms / 1e3).toFixed(1).replace(/\.0$/, '')} kΩ`;
  return `${ohms} Ω`;
}

export function formatCapacitance(farads) {
  if (farads >= 1e-6) return `${(farads * 1e6).toFixed(2).replace(/\.?0+$/, '')} µF`;
  if (farads >= 1e-9) return `${(farads * 1e9).toFixed(2).replace(/\.?0+$/, '')} nF`;
  return `${(farads * 1e12).toFixed(1).replace(/\.?0+$/, '')} pF`;
}

export function formatInductance(henrys) {
  if (henrys >= 1) return `${henrys} H`;
  if (henrys >= 1e-3) return `${(henrys * 1e3).toFixed(1).replace(/\.0$/, '')} mH`;
  return `${(henrys * 1e6).toFixed(1).replace(/\.0$/, '')} µH`;
}

export function createComponent(type, customProps = {}) {
  const id = `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  switch (type) {
    case 'resistor': {
      const val = customProps.value ?? 1000;
      return {
        id,
        type: 'resistor',
        label: customProps.label ?? 'R',
        value: val,
        displayValue: formatResistance(val),
        unit: 'Ω',
        rotation: customProps.rotation ?? 0,
        pins: [
          { id: 'p1', name: 'Pin 1', relCol: 0, relRow: 0 },
          { id: 'p2', name: 'Pin 2', relCol: 4, relRow: 0 },
        ],
        properties: {
          colorBands: calculateResistorBands(val),
          package: 'Axial',
          ...customProps.properties,
        },
      };
    }

    case 'potentiometer': {
      const maxVal = customProps.value ?? 10000;
      const wiper = customProps.properties?.wiperPos ?? 0.5;
      return {
        id,
        type: 'potentiometer',
        label: customProps.label ?? 'POT',
        value: maxVal,
        displayValue: `${formatResistance(maxVal)} Pot`,
        unit: 'Ω',
        rotation: 0,
        pins: [
          { id: 'term1', name: 'Terminal 1', relCol: 0, relRow: 0 },
          { id: 'wiper', name: 'Wiper', relCol: 1, relRow: 0 },
          { id: 'term2', name: 'Terminal 2', relCol: 2, relRow: 0 },
        ],
        properties: {
          wiperPos: wiper,
          maxResistance: maxVal,
          activeResistance: Math.round(maxVal * wiper),
          package: 'Rotary-3Pin',
          ...customProps.properties,
        },
      };
    }

    case 'rheostat': {
      const maxVal = customProps.value ?? 10000;
      const wiper = customProps.properties?.wiperPos ?? 0.5;
      return {
        id,
        type: 'rheostat',
        label: customProps.label ?? 'Rheostat',
        value: maxVal,
        displayValue: `${formatResistance(maxVal)} Rheo`,
        unit: 'Ω',
        rotation: 0,
        pins: [
          { id: 'p1', name: 'Terminal 1', relCol: 0, relRow: 0 },
          { id: 'p2', name: 'Wiper / Terminal 2', relCol: 2, relRow: 0 },
        ],
        properties: {
          wiperPos: wiper,
          maxResistance: maxVal,
          activeResistance: Math.round(maxVal * wiper),
          package: 'Rheostat-2Pin',
          ...customProps.properties,
        },
      };
    }

    case 'capacitor': {
      const val = customProps.value ?? 1e-7;
      const display = formatCapacitance(val);
      const code = val < 5e-8 ? '103' : '104';
      return {
        id,
        type: 'capacitor',
        label: customProps.label ?? 'C',
        value: val,
        displayValue: display,
        unit: 'F',
        rotation: customProps.rotation ?? 0,
        pins: [
          { id: 'p1', name: 'Pin 1 (+)', relCol: 0, relRow: 0 },
          { id: 'p2', name: 'Pin 2 (-)', relCol: 2, relRow: 0 },
        ],
        properties: {
          markingCode: code,
          package: 'Ceramic Disc / Mylar',
          ...customProps.properties,
        },
      };
    }

    case 'inductor': {
      const val = customProps.value ?? 0.004;
      return {
        id,
        type: 'inductor',
        label: customProps.label ?? 'L',
        value: val,
        displayValue: formatInductance(val),
        unit: 'H',
        rotation: customProps.rotation ?? 0,
        pins: [
          { id: 'p1', name: 'Pin 1', relCol: 0, relRow: 0 },
          { id: 'p2', name: 'Pin 2', relCol: 3, relRow: 0 },
        ],
        properties: {
          core: 'Ferrite',
          package: 'Choke / Inductor',
          ...customProps.properties,
        },
      };
    }

    case 'diode_1n4007': {
      return {
        id,
        type: 'diode_1n4007',
        label: customProps.label ?? 'D_1N4007',
        value: 0.7,
        displayValue: '1N4007 (Si)',
        unit: 'V',
        rotation: customProps.rotation ?? 0,
        pins: [
          { id: 'anode', name: 'Anode (+)', relCol: 0, relRow: 0 },
          { id: 'cathode', name: 'Cathode (- Band)', relCol: 3, relRow: 0 },
        ],
        properties: {
          modelName: '1N4007',
          material: 'Silicon',
          forwardDrop: 0.7,
          Is: 1e-11,
          n: 1.5,
          color: '#111827',
          bandColor: '#D1D5DB',
          ...customProps.properties,
        },
      };
    }

    case 'diode_oa79': {
      return {
        id,
        type: 'diode_oa79',
        label: customProps.label ?? 'D_OA79',
        value: 0.25,
        displayValue: 'OA79 (Ge)',
        unit: 'V',
        rotation: customProps.rotation ?? 0,
        pins: [
          { id: 'anode', name: 'Anode (+)', relCol: 0, relRow: 0 },
          { id: 'cathode', name: 'Cathode (- Band)', relCol: 3, relRow: 0 },
        ],
        properties: {
          modelName: 'OA79',
          material: 'Germanium',
          forwardDrop: 0.25,
          Is: 1e-6,
          n: 1.1,
          color: 'rgba(219, 234, 254, 0.7)',
          bandColor: '#DC2626',
          ...customProps.properties,
        },
      };
    }

    case 'transistor_bc107': {
      return {
        id,
        type: 'transistor_bc107',
        label: customProps.label ?? 'Q_BC107',
        value: 200,
        displayValue: 'BC107 (NPN)',
        unit: 'hfe',
        rotation: 0,
        pins: [
          { id: 'E', name: 'Emitter (Tab)', relCol: 0, relRow: 0 },
          { id: 'B', name: 'Base', relCol: 1, relRow: 0 },
          { id: 'C', name: 'Collector', relCol: 2, relRow: 0 },
        ],
        properties: {
          modelName: 'BC107',
          polarity: 'NPN',
          package: 'TO-18 Metal Can',
          hfe: 200,
          ...customProps.properties,
        },
      };
    }

    case 'transistor_2n2222': {
      return {
        id,
        type: 'transistor_2n2222',
        label: customProps.label ?? 'Q_2N2222',
        value: 100,
        displayValue: '2N2222 (NPN)',
        unit: 'hfe',
        rotation: 0,
        pins: [
          { id: 'E', name: 'Emitter', relCol: 0, relRow: 0 },
          { id: 'B', name: 'Base', relCol: 1, relRow: 0 },
          { id: 'C', name: 'Collector', relCol: 2, relRow: 0 },
        ],
        properties: {
          modelName: '2N2222',
          polarity: 'NPN',
          package: 'TO-18 / TO-92',
          hfe: 100,
          ...customProps.properties,
        },
      };
    }

    case 'ic_555': {
      return {
        id,
        type: 'ic_555',
        label: customProps.label ?? 'U_555',
        value: 0,
        displayValue: 'NE555 Timer',
        unit: '',
        rotation: 0,
        pins: [
          { id: 'p1', name: 'Pin 1 (GND)', relCol: 0, relRow: 0, description: 'Ground' },
          { id: 'p2', name: 'Pin 2 (TRIG)', relCol: 1, relRow: 0, description: 'Trigger' },
          { id: 'p3', name: 'Pin 3 (OUT)', relCol: 2, relRow: 0, description: 'Output' },
          { id: 'p4', name: 'Pin 4 (RESET)', relCol: 3, relRow: 0, description: 'Reset' },
          { id: 'p5', name: 'Pin 5 (CONT)', relCol: 3, relRow: 1, description: 'Control Voltage' },
          { id: 'p6', name: 'Pin 6 (THRESH)', relCol: 2, relRow: 1, description: 'Threshold' },
          { id: 'p7', name: 'Pin 7 (DISCH)', relCol: 1, relRow: 1, description: 'Discharge' },
          { id: 'p8', name: 'Pin 8 (VCC)', relCol: 0, relRow: 1, description: 'Supply (+)' },
        ],
        properties: {
          modelName: 'NE555',
          package: 'DIP-8',
          vcc: 15,
          ...customProps.properties,
        },
      };
    }

    case 'ic_8038': {
      return {
        id,
        type: 'ic_8038',
        label: customProps.label ?? 'U_8038',
        value: 0,
        displayValue: 'ICL8038 VCO',
        unit: '',
        rotation: 0,
        pins: [
          { id: 'p1', name: 'Pin 1 (SINE_MIN)', relCol: 0, relRow: 0 },
          { id: 'p2', name: 'Pin 2 (SINE_OUT)', relCol: 1, relRow: 0, description: 'Sine Wave Output' },
          { id: 'p3', name: 'Pin 3 (TRI_OUT)', relCol: 2, relRow: 0 },
          { id: 'p4', name: 'Pin 4 (TIMING_R1)', relCol: 3, relRow: 0, description: 'Timing Resistor RA' },
          { id: 'p5', name: 'Pin 5 (TIMING_R2)', relCol: 4, relRow: 0, description: 'Timing Resistor RB' },
          { id: 'p6', name: 'Pin 6 (V+)', relCol: 5, relRow: 0, description: 'Positive Supply (+18V)' },
          { id: 'p7', name: 'Pin 7 (FM_BIAS)', relCol: 6, relRow: 0, description: 'FM Bias / Sweep Input' },
          { id: 'p8', name: 'Pin 8 (FM_SWEEP)', relCol: 6, relRow: 1, description: 'FM Sweep / Mod Input' },
          { id: 'p9', name: 'Pin 9 (SQR_OUT)', relCol: 5, relRow: 1 },
          { id: 'p10', name: 'Pin 10 (TIMING_C)', relCol: 4, relRow: 1, description: 'Timing Capacitor' },
          { id: 'p11', name: 'Pin 11 (V- / GND)', relCol: 3, relRow: 1, description: 'Negative Supply / Ground' },
          { id: 'p12', name: 'Pin 12 (SINE_ADJ)', relCol: 2, relRow: 1 },
          { id: 'p13', name: 'Pin 13 (NC)', relCol: 1, relRow: 1 },
          { id: 'p14', name: 'Pin 14 (NC)', relCol: 0, relRow: 1 },
        ],
        properties: {
          modelName: 'ICL8038',
          package: 'DIP-14',
          vcc: 18,
          ...customProps.properties,
        },
      };
    }

    case 'vcc_terminal': {
      const v = customProps.properties?.voltage ?? 5;
      return {
        id,
        type: 'vcc_terminal',
        label: customProps.label ?? `+${v}V`,
        value: v,
        displayValue: `+${v} V`,
        unit: 'V',
        rotation: 0,
        pins: [{ id: 'out', name: 'VCC (+)', relCol: 0, relRow: 0 }],
        properties: {
          voltage: v,
          color: '#DC2626',
          ...customProps.properties,
        },
      };
    }

    case 'gnd_terminal': {
      return {
        id,
        type: 'gnd_terminal',
        label: customProps.label ?? 'GND',
        value: 0,
        displayValue: '0 V',
        unit: 'V',
        rotation: 0,
        pins: [{ id: 'gnd', name: 'GND', relCol: 0, relRow: 0 }],
        properties: {
          voltage: 0,
          color: '#111827',
          ...customProps.properties,
        },
      };
    }
  }
}

