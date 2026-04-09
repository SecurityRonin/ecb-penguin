# Design: Bit Flip Attack + Block Heatmap + Mobile Polish

**Date:** 2026-04-08
**Project:** ECB Penguin (`web/index.html`, Netlify)

---

## Feature 1: Bit Flip Attack Demo

### Panel
New educational panel after ECB vs GCM data flow, before Real-World Impact. Hidden until encryption is performed (same pattern as stats box).

### Layout
Header: "Bit Flip Attack — Why Authentication Matters"
Two columns (ECB / GCM), each with a small canvas or visual showing the effect.

### Interaction
1. User clicks any pixel on the main ECB ciphertext canvas (#canvasECB)
2. That pixel's bytes get XOR'd with 0xFF (visible bit flip)
3. The bit-flip panel shows:
   - ECB: auto-decrypts the modified ciphertext. Only the flipped block is corrupted, rest is perfect.
   - GCM: auto-decrypts and fails (auth tag mismatch). Shows AUTH FAILED.
4. "Reset Flip" button restores original ciphertext and clears the panel.

### State
- `flippedEcbBytes` — copy of lastEcbBytes with the flipped block
- `flippedBlockIndex` — which block was flipped (for highlighting)

### Educational Message
ECB footer: "Attacker modified 1 block — only that block corrupted. The rest decrypts perfectly. No error detected."
GCM footer: "Even a single bit flip is detected. GCM refuses to decrypt tampered data."

---

## Feature 3: Live Block Heatmap

### Toggle
Button in ECB panel header: "Heatmap" (toggles on/off).

### Implementation
- Second canvas (`#canvasHeatmap`) overlaid on `#canvasECB` with `position:absolute`, `pointer-events:none`
- For each 16-byte block in the ECB ciphertext, hash the block to a hue value
- Identical blocks → identical color
- Duplicate blocks: rendered at higher opacity (0.7), unique blocks at lower opacity (0.3)
- When toggled off, hide the overlay canvas

### Visual
- Semi-transparent colored overlay
- Duplicate clusters visually "pop" as same-colored regions
- Unique blocks fade into background

---

## Feature 5: Mobile Responsiveness

### Breakpoints
All at `@media (max-width: 600px)` (extending existing breakpoint):

### Key Derivation Flow
- `.kd-flow`: change to `flex-direction: column; align-items: stretch`
- `.kd-arrow`: change text from → to ↓, center
- `.kd-stage`: full width

### ECB vs GCM Data Flow
- `.df-grid`: already 1-column at 600px
- `.df-block-grid`: ensure width doesn't overflow (cap at 88px, center)

### Timeline Attacks
- `.tl-attack`: change from 3-column grid to stacked (1-column)
- `.tl-attack-year` and `.tl-attack-name` on same line, desc below

### Controls
- `.controls`: `flex-direction: column`
- `.btn-row`: `flex-wrap: wrap`
- `input[type="text"]`: `width: 100%`

### Edu Panels
- `.edu-panel`: reduce padding to `1rem`

---

## File Changes

| File | Change |
|------|--------|
| `web/index.html` | Bit flip panel HTML/CSS/JS, heatmap canvas + toggle, mobile media queries |
| `tests/ecb-penguin.test.js` | Tests for bit flip, heatmap toggle, mobile viewport tests |
