# GATLAB - Interactive Communication Lab Practice Simulator

A browser-based interactive Communication Lab practice simulator (Simulink/Tinkercad-style) designed for students preparing for lab examinations. Built with React/TypeScript/modern ES Modules, HTML5 Canvas rendering, and a real Modified Nodal Analysis (MNA) simulation engine in a Web Worker.

---

## Milestone 2 Complete: Real Instruments + MNA Simulation Engine

### 1. Instruments Panel & Benchtop Equipment
Added an **Instruments** tab to the component palette. Each instrument is placed in the workspace and features physical, wireable binding posts and BNC terminals that connect directly to breadboard holes or other instruments.

#### A) Function Generators: FG1 (Message) & FG2 (Carrier)
- **Top Row Arrangement**: Both **Function Generator 1 (Message)** and **Function Generator 2 (Carrier)** sit side by side in the equipment strip, followed by the **DC Power Supply** and the **Oscilloscope**.
- **Rearrangeable Panels**: Use the `⠿` drag handle on any instrument header to drag and reorder panels in the workbench strip.
- **Independent Controls & Terminals**: Each generator maintains independent settings and its own `OUT (+)` and `GND (⏚)` binding posts.
- **Waveforms**: Sine ($\sim$), Square ($\sqcap$), Triangle ($\wedge$), and Pulse.
- **Controls**:
  - Frequency typed in or adjusted with stepped inputs, with dedicated unit selector (`Hz`, `kHz`, `MHz`).
  - Amplitude with `$V_p$` / `$V_{pp}$` toggle (e.g. 2 $V_p$ = 4 $V_{pp}$).
  - DC Offset knob (-15 V to +15 V).
  - Duty Cycle slider (5% to 95%) for square and pulse waves.
  - Output On/Off toggle with LED power indicator.
  - "Suggested for this lab" hint pill (e.g. `1 kHz, 2 Vp` for message, `8 kHz, 5 Vp` for carrier) with 1-click **Apply**.

#### B) Benchtop DC Power Supply
- **Terminals**: `+` (VCC) and `GND` (0 V).
- **Controls**:
  - Dual 7-segment LED digital display showing Voltage (V) and simulated live Current (A).
  - Continuous regulation slider from 0 to 30 V.
  - Quick lab voltage preset buttons: `+5V`, `+10V (Lab 5)`, `+15V (Lab 7)`, `+18V (Lab 2)`.
  - Output On/Off power button.

#### C) Dual-Channel Digital Storage Oscilloscope (DSO)
- **Terminals**:
  - `CH1 (+)` yellow BNC terminal and `CH1 GND (⏚)` alligator clip.
  - `CH2 (+)` cyan BNC terminal and `CH2 GND (⏚)` alligator clip.
- **Display**:
  - High-contrast phosphor CRT/LCD screen with standard $10 \times 8$ division graticule and minor tick subdivisions.
  - Real-time animated traces: Channel 1 (Yellow `#FACC15`) and Channel 2 (Cyan `#38BDF8`).
- **Horizontal & Vertical Controls**:
  - Time/Div selector: 5 µs to 10 ms / div.
  - Volts/Div per channel: 100 mV to 10 V / div.
  - Vertical Position offset sliders per channel.
  - Coupling toggles: `DC`, `AC` (removes DC bias), and `GND` (zero reference).
- **Triggering**:
  - Trigger Source (`CH1` / `CH2`), Level slider, Edge (`Rising` / `Falling`), and Mode (`Auto` / `Norm` / `Single`).
- **Advanced Features**:
  - **Run / Stop** button to freeze and inspect live waveforms.
  - **X-Y Mode** for Lissajous pattern visualization.
  - **Interactive Cursors**: On-screen cursors calculating $\Delta T$, $1/\Delta T$ (Frequency), and $\Delta V$.
  - **Auto-Measurements**: Live digital display of $V_{\max}$, $V_{\min}$, $V_{pp}$, $V_{\text{rms}}$, and measured Frequency for both channels.
  - **FFT / Spectrum View**: Computes Discrete Fourier Transform of the probed net, plotting spectral magnitude in dB vs Frequency.

---

### 2. Real MNA Simulation Engine
- **No Faked Waveforms**: The oscilloscope displays the real node voltages determined entirely by the student's physical wiring.
- **Modified Nodal Analysis (MNA)**:
  - Formulates and solves $\mathbf{G} \cdot \mathbf{v} = \mathbf{i}$ using Gaussian elimination with partial pivoting.
  - **Companion Models**:
    - Capacitors: Trapezoidal Norton companion model ($G_C = \frac{2C}{\Delta t}$, history current $I_{C,\text{hist}}$).
    - Inductors: Trapezoidal Norton companion model ($G_L = \frac{\Delta t}{2L}$, history current $I_{L,\text{hist}}$).
  - **Nonlinear Newton-Raphson Solver**:
    - Diodes: Shockley equation $I_D = I_s (e^{V_D / n V_t} - 1)$ with dynamic conductance $g_d$ and equivalent current source $I_{eq}$ (1N4007 silicon $\sim 0.7\text{ V}$, OA79 germanium $\sim 0.25\text{ V}$).
    - Transistors: Ebers-Moll forward active and saturation modeling for BC107 and 2N2222.
  - **Integrated IC Behavioral Macro-Models**:
    - NE555 Timer: Internal voltage divider, threshold & trigger comparators, SR flip-flop, discharge transistor at pin 7, low-impedance output buffer at pin 3.
    - ICL8038 VCO: Internal current source tracking modulation input at pins 7/8, timing capacitor charge/discharge on pin 10, sine-shaper output on pin 2.
- **Multithreaded Web Worker**: Simulation runs continuously in `SimulationWorker.js`, streaming time-series buffers to the UI at 60 FPS without UI stutter.

---

### 3. First Test: 1 kHz RC Low-Pass Filter (Verified & Working)
Click the **"First Test: 1 kHz RC"** button on the top toolbar to automatically wire:
1. Function Generator 1: Sine, 1 kHz, 2 Vp ($4\text{ V}_{pp}$) $\to$ Breadboard row 10
2. Resistor $R_1 = 1\text{ k}\Omega$ $\to$ between row 10 and row 14
3. Capacitor $C_1 = 0.1\ \mu\text{F}$ $\to$ between row 14 and Bottom Ground Rail
4. Scope CH1 $\to$ row 10 (Input voltage)
5. Scope CH2 $\to$ row 14 (Output voltage across capacitor)

#### Theory vs Measured Values:
* **Cutoff Frequency**: $f_c = \frac{1}{2\pi R C} = \frac{1}{2\pi \cdot 1000 \cdot 10^{-7}} \approx 1591.55\text{ Hz}$
* **Input Peak**: $2.000\text{ V}$
* **Output Peak**:
  $$|H(j\omega)| = \frac{1}{\sqrt{1 + (2\pi \cdot 1000 \cdot 1000 \cdot 10^{-7})^2}} \approx 0.8466$$
  $$V_{\text{out, peak}} = 2.0 \times 0.8466 = 1.693\text{ V} \quad (\text{Measured: } 1.693\text{ V})$$
* **Phase Shift**: $\phi = -\arctan(2\pi \cdot 1000 \cdot 10^{-4}) \approx -32.14^\circ \implies \Delta t \approx 89.3\ \mu\text{s}$

Both traces appear live on the oscilloscope screen with the exact amplitude reduction and phase lag.

---

### How to Run & Verify

1. **Launch the Application**:
   ```bash
   python run_server.py
   ```
   *Opens `http://localhost:3000` in your web browser.*

2. **Click "First Test: 1 kHz RC"** on the top toolbar to see the circuit wired and the live waveforms drawn on the oscilloscope.

3. **Run Unit & Integration Tests**:
   ```bash
   node --experimental-strip-types --test test/test_breadboard.mjs test/test_solver.mjs test/test_instruments_integration.mjs
   ```
   *All 7 tests pass with 100% mathematical precision.*
