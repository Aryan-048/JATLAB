/**
 * PartsPalette.js - Categorized Component Palette Sidebar
 */

export class PartsPalette {
  constructor(containerElement, stateManager) {
    this.container = containerElement;
    this.state = stateManager;
    this.activeCategory = 'all';

    this.render();
  }

  getPartsCatalog() {
    return [
      // Benchtop Instruments
      {
        category: 'instruments',
        type: 'instrument_fg',
        label: 'Function Generator 1',
        sub: 'Sine / Square / Tri / Pulse',
        value: 1000,
        badge: 'Bench',
        icon: 'fg_bench',
        props: { instId: 'FG1' },
      },
      {
        category: 'instruments',
        type: 'instrument_fg',
        label: 'Function Generator 2',
        sub: 'Carrier / Message 2nd Src',
        value: 8000,
        badge: 'Bench',
        icon: 'fg_bench',
        props: { instId: 'FG2' },
      },
      {
        category: 'instruments',
        type: 'instrument_ps',
        label: 'DC Power Supply',
        sub: '0 to 30V Regulated + / GND',
        value: 5,
        badge: 'Bench',
        icon: 'ps_bench',
        props: { instId: 'PS1' },
      },
      {
        category: 'instruments',
        type: 'instrument_scope',
        label: 'Dual-Channel Oscilloscope',
        sub: 'DSO CH1/CH2 + FFT Cursors',
        value: 0,
        badge: 'DSO',
        icon: 'scope_bench',
        props: { instId: 'OSC1' },
      },

      // Resistors
      {
        category: 'resistors',
        type: 'resistor',
        label: '220 Ω Resistor',
        sub: 'Red-Red-Brown',
        value: 220,
        badge: 'Lab 7',
        icon: 'resistor',
        props: { label: 'R_220' },
      },
      {
        category: 'resistors',
        type: 'resistor',
        label: '1 kΩ Resistor',
        sub: 'Brown-Black-Red',
        value: 1000,
        badge: 'Lab 1,5,7,8',
        icon: 'resistor',
        props: { label: 'R_1k' },
      },
      {
        category: 'resistors',
        type: 'resistor',
        label: '2.2 kΩ Resistor',
        sub: 'Red-Red-Red',
        value: 2200,
        badge: 'Lab 5',
        icon: 'resistor',
        props: { label: 'R_2.2k' },
      },
      {
        category: 'resistors',
        type: 'resistor',
        label: '4.7 kΩ Resistor',
        sub: 'Yellow-Violet-Red',
        value: 4700,
        badge: 'Lab 5',
        icon: 'resistor',
        props: { label: 'R_4.7k' },
      },
      {
        category: 'resistors',
        type: 'resistor',
        label: '10 kΩ Resistor',
        sub: 'Brown-Black-Orange',
        value: 10000,
        badge: 'Lab 1,2,8',
        icon: 'resistor',
        props: { label: 'R_10k' },
      },
      {
        category: 'resistors',
        type: 'resistor',
        label: '100 kΩ Resistor',
        sub: 'Brown-Black-Yellow',
        value: 100000,
        badge: 'Lab 1B',
        icon: 'resistor',
        props: { label: 'R_100k' },
      },
      {
        category: 'resistors',
        type: 'resistor',
        label: 'Custom Resistor',
        sub: 'User Defined Value',
        value: 1000,
        icon: 'resistor',
        props: { label: 'R_custom' },
      },

      // Variable Resistors
      {
        category: 'resistors',
        type: 'potentiometer',
        label: '10 kΩ Potentiometer',
        sub: '3-Pin Rotary / Wiper',
        value: 10000,
        badge: 'Tuning',
        icon: 'pot',
        props: { label: 'POT_10k', wiperPos: 0.5 },
      },
      {
        category: 'resistors',
        type: 'rheostat',
        label: 'Rheostat (Variable R)',
        sub: '2-Pin Adjustable R',
        value: 10000,
        icon: 'pot',
        props: { label: 'RHEO', wiperPos: 0.5 },
      },

      // Capacitors
      {
        category: 'capacitors',
        type: 'capacitor',
        label: '0.01 µF Capacitor',
        sub: 'Code: 103 (10 nF)',
        value: 1e-8,
        badge: 'Lab 1B,2,7',
        icon: 'capacitor',
        props: { label: 'C_103', markingCode: '103' },
      },
      {
        category: 'capacitors',
        type: 'capacitor',
        label: '0.1 µF Capacitor',
        sub: 'Code: 104 (100 nF)',
        value: 1e-7,
        badge: 'Lab 1A,1B,2',
        icon: 'capacitor',
        props: { label: 'C_104', markingCode: '104' },
      },
      {
        category: 'capacitors',
        type: 'capacitor',
        label: 'Custom Capacitor',
        sub: 'User Defined Value',
        value: 1e-7,
        icon: 'capacitor',
        props: { label: 'C_custom' },
      },

      // Inductors
      {
        category: 'inductors',
        type: 'inductor',
        label: '4 mH Inductor',
        sub: 'Tank Resonator ~8 kHz',
        value: 0.004,
        badge: 'Lab 1A',
        icon: 'inductor',
        props: { label: 'L_tank' },
      },

      // Diodes
      {
        category: 'semiconductors',
        type: 'diode_1n4007',
        label: '1N4007 Diode (Si)',
        sub: '~0.7V Drop | Shockley',
        value: 0.7,
        badge: 'Lab 1A',
        icon: 'diode_si',
        props: { label: 'D_1N4007' },
      },
      {
        category: 'semiconductors',
        type: 'diode_oa79',
        label: 'OA79 Diode (Ge)',
        sub: '~0.25V Drop | Glass',
        value: 0.25,
        badge: 'Lab 1B',
        icon: 'diode_ge',
        props: { label: 'D_OA79' },
      },

      // Transistors
      {
        category: 'semiconductors',
        type: 'transistor_bc107',
        label: 'BC107 BJT (NPN)',
        sub: 'TO-18 Metal Can w/ Tab',
        value: 200,
        badge: 'Lab 5 PAM',
        icon: 'transistor',
        props: { label: 'Q_BC107' },
      },
      {
        category: 'semiconductors',
        type: 'transistor_2n2222',
        label: '2N2222 BJT (NPN)',
        sub: 'High-Speed RF Switch',
        value: 100,
        badge: 'Lab 8 ASK',
        icon: 'transistor',
        props: { label: 'Q_2N2222' },
      },

      // ICs
      {
        category: 'ics',
        type: 'ic_555',
        label: 'NE555 Timer IC',
        sub: '8-Pin DIP Straddle',
        value: 0,
        badge: 'Lab 7 PWM',
        icon: 'ic_dip8',
        props: { label: 'U_555' },
      },
      {
        category: 'ics',
        type: 'ic_8038',
        label: 'ICL8038 VCO IC',
        sub: '14-Pin DIP Straddle',
        value: 0,
        badge: 'Lab 2 FM',
        icon: 'ic_dip14',
        props: { label: 'U_8038' },
      },

      // Power / Ground
      {
        category: 'power',
        type: 'vcc_terminal',
        label: 'VCC Power Supply (+)',
        sub: 'Configurable 5V / 15V / 18V',
        value: 5,
        icon: 'vcc',
        props: { label: 'VCC', voltage: 5 },
      },
      {
        category: 'power',
        type: 'gnd_terminal',
        label: 'Ground Terminal (⏚)',
        sub: '0 V Common Reference',
        value: 0,
        icon: 'gnd',
        props: { label: 'GND', voltage: 0 },
      },
    ];
  }

  render() {
    this.container.innerHTML = `
      <div class="palette-header">
        <div class="palette-title">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="18" rx="2"></rect>
            <path d="M7 8h10M7 12h10M7 16h6"></path>
          </svg>
          Component Palette
        </div>
        <div class="palette-desc">Click or drag a part to place it on the breadboard</div>
      </div>

      <!-- Categories Filter Tabs -->
      <div class="palette-tabs">
        <button class="palette-tab active" data-cat="all">All</button>
        <button class="palette-tab" data-cat="instruments">Instruments</button>
        <button class="palette-tab" data-cat="resistors">Resistors</button>
        <button class="palette-tab" data-cat="capacitors">Caps</button>
        <button class="palette-tab" data-cat="semiconductors">Diodes/BJT</button>
        <button class="palette-tab" data-cat="ics">ICs</button>
        <button class="palette-tab" data-cat="power">Power</button>
      </div>

      <!-- Part Cards Grid -->
      <div class="palette-grid"></div>
    `;

    // Category button events
    const tabs = this.container.querySelectorAll('.palette-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeCategory = tab.dataset.cat;
        this.renderCards();
      });
    });

    this.renderCards();
  }

  renderCards() {
    const grid = this.container.querySelector('.palette-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const catalog = this.getPartsCatalog();
    const filtered =
      this.activeCategory === 'all'
        ? catalog
        : catalog.filter((item) => item.category === this.activeCategory);

    for (const item of filtered) {
      const card = document.createElement('div');
      card.className = 'part-card';
      card.setAttribute('title', `Click to place ${item.label} on breadboard (press 'R' to rotate)`);

      card.innerHTML = `
        <div class="part-icon-box">
          ${this.getSVGIcon(item.icon)}
        </div>
        <div class="part-info">
          <div class="part-name">
            ${item.label}
            ${item.badge ? `<span class="part-badge">${item.badge}</span>` : ''}
          </div>
          <div class="part-sub">${item.sub}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (item.type.startsWith('instrument_')) {
          if (window.gatlabApp) {
            window.gatlabApp.focusInstrument(item.props.instId);
          }
          return;
        }

        this.state.startPlacement(item.type, {
          value: item.value,
          properties: item.props,
        });

        // Visual feedback
        document.querySelectorAll('.part-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
      });

      grid.appendChild(card);
    }
  }

  getSVGIcon(iconType) {
    switch (iconType) {
      case 'fg_bench':
        return `
          <svg viewBox="0 0 32 32" width="28" height="28">
            <rect x="2" y="5" width="28" height="22" rx="3" fill="#1E293B" stroke="#38BDF8"/>
            <rect x="5" y="8" width="14" height="8" rx="1" fill="#047857"/>
            <path d="M7 12c1.5-3 3-3 4.5 0s3 3 4.5 0" stroke="#6EE7B7" stroke-width="1.5" fill="none"/>
            <circle cx="23" cy="18" r="3" fill="#EF4444"/>
          </svg>
        `;
      case 'ps_bench':
        return `
          <svg viewBox="0 0 32 32" width="28" height="28">
            <rect x="2" y="5" width="28" height="22" rx="3" fill="#1E293B" stroke="#EF4444"/>
            <rect x="5" y="8" width="10" height="7" fill="#B91C1C"/>
            <rect x="17" y="8" width="10" height="7" fill="#1D4ED8"/>
            <circle cx="9" cy="20" r="3" fill="#EF4444"/>
            <circle cx="23" cy="20" r="3" fill="#111827"/>
          </svg>
        `;
      case 'scope_bench':
        return `
          <svg viewBox="0 0 32 32" width="28" height="28">
            <rect x="2" y="4" width="28" height="24" rx="3" fill="#0F172A" stroke="#FACC15"/>
            <rect x="5" y="7" width="16" height="18" fill="#06101E"/>
            <path d="M6 16c2-4 4-4 6 0s4 4 6 0" stroke="#FACC15" stroke-width="1.5" fill="none"/>
            <circle cx="25" cy="11" r="2.5" fill="#38BDF8"/>
            <circle cx="25" cy="19" r="2.5" fill="#FACC15"/>
          </svg>
        `;
      case 'resistor':
        return `
          <svg viewBox="0 0 40 20" width="40" height="20">
            <line x1="2" y1="10" x2="10" y2="10" stroke="#94A3B8" stroke-width="2"/>
            <rect x="10" y="5" width="20" height="10" rx="3" fill="#E5D5BA" stroke="#BFA075"/>
            <line x1="14" y1="5" x2="14" y2="15" stroke="#78350F" stroke-width="2"/>
            <line x1="18" y1="5" x2="18" y2="15" stroke="#DC2626" stroke-width="2"/>
            <line x1="22" y1="5" x2="22" y2="15" stroke="#EA580C" stroke-width="2"/>
            <line x1="26" y1="5" x2="26" y2="15" stroke="#D97706" stroke-width="2"/>
            <line x1="30" y1="10" x2="38" y2="10" stroke="#94A3B8" stroke-width="2"/>
          </svg>
        `;
      case 'pot':
        return `
          <svg viewBox="0 0 32 32" width="28" height="28">
            <rect x="4" y="4" width="24" height="24" rx="4" fill="#2563EB" stroke="#1D4ED8"/>
            <circle cx="16" cy="16" r="8" fill="#F8FAFC"/>
            <line x1="16" y1="16" x2="21" y2="11" stroke="#EF4444" stroke-width="2"/>
          </svg>
        `;
      case 'capacitor':
        return `
          <svg viewBox="0 0 32 32" width="28" height="28">
            <line x1="16" y1="2" x2="16" y2="8" stroke="#94A3B8" stroke-width="2"/>
            <circle cx="16" cy="16" r="10" fill="#EA580C"/>
            <text x="16" y="19" font-size="8" fill="#FEF08A" font-weight="bold" text-anchor="middle">104</text>
            <line x1="16" y1="24" x2="16" y2="30" stroke="#94A3B8" stroke-width="2"/>
          </svg>
        `;
      case 'inductor':
        return `
          <svg viewBox="0 0 36 20" width="36" height="20">
            <rect x="6" y="5" width="24" height="10" rx="3" fill="#1E293B"/>
            <circle cx="12" cy="10" r="5" fill="none" stroke="#D97706" stroke-width="2"/>
            <circle cx="18" cy="10" r="5" fill="none" stroke="#D97706" stroke-width="2"/>
            <circle cx="24" cy="10" r="5" fill="none" stroke="#D97706" stroke-width="2"/>
          </svg>
        `;
      case 'diode_si':
        return `
          <svg viewBox="0 0 36 20" width="36" height="20">
            <line x1="2" y1="10" x2="8" y2="10" stroke="#94A3B8" stroke-width="2"/>
            <rect x="8" y="5" width="20" height="10" rx="2" fill="#0F172A"/>
            <rect x="23" y="5" width="4" height="10" fill="#E2E8F0"/>
            <line x1="28" y1="10" x2="34" y2="10" stroke="#94A3B8" stroke-width="2"/>
          </svg>
        `;
      case 'diode_ge':
        return `
          <svg viewBox="0 0 36 20" width="36" height="20">
            <line x1="2" y1="10" x2="8" y2="10" stroke="#94A3B8" stroke-width="2"/>
            <rect x="8" y="5" width="20" height="10" rx="2" fill="rgba(191,219,254,0.7)" stroke="#60A5FA"/>
            <circle cx="14" cy="10" r="3" fill="#B91C1C"/>
            <rect x="23" y="5" width="4" height="10" fill="#DC2626"/>
            <line x1="28" y1="10" x2="34" y2="10" stroke="#94A3B8" stroke-width="2"/>
          </svg>
        `;
      case 'transistor':
        return `
          <svg viewBox="0 0 30 30" width="26" height="26">
            <circle cx="15" cy="15" r="11" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5"/>
            <rect x="2" y="13" width="4" height="4" fill="#64748B"/>
            <text x="15" y="18" font-size="8" font-weight="bold" fill="#0F172A" text-anchor="middle">NPN</text>
          </svg>
        `;
      case 'ic_dip8':
        return `
          <svg viewBox="0 0 36 24" width="36" height="24">
            <rect x="4" y="4" width="28" height="16" rx="2" fill="#18181B"/>
            <circle cx="8" cy="8" r="1.5" fill="#71717A"/>
            <text x="18" y="16" font-size="8" font-family="monospace" fill="#F4F4F5" text-anchor="middle">555</text>
          </svg>
        `;
      case 'ic_dip14':
        return `
          <svg viewBox="0 0 46 24" width="46" height="24">
            <rect x="2" y="4" width="42" height="16" rx="2" fill="#18181B"/>
            <circle cx="6" cy="8" r="1.5" fill="#71717A"/>
            <text x="23" y="16" font-size="7" font-family="monospace" fill="#F4F4F5" text-anchor="middle">ICL8038</text>
          </svg>
        `;
      case 'vcc':
        return `
          <svg viewBox="0 0 24 24" width="24" height="24">
            <circle cx="12" cy="12" r="10" fill="#EF4444"/>
            <text x="12" y="16" font-size="14" font-weight="bold" fill="#FFFFFF" text-anchor="middle">+</text>
          </svg>
        `;
      case 'gnd':
        return `
          <svg viewBox="0 0 24 24" width="24" height="24">
            <circle cx="12" cy="12" r="10" fill="#1F2937"/>
            <text x="12" y="16" font-size="12" font-weight="bold" fill="#FFFFFF" text-anchor="middle">⏚</text>
          </svg>
        `;
      default:
        return `<circle cx="12" cy="12" r="8" fill="#64748B"/>`;
    }
  }
}

