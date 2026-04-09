# Design: Security Hardening + Interactive Visual Explainer

**Date:** 2026-04-04  
**Project:** ECB Penguin (`index.html`, Netlify)

---

## 1. Security Hardening

### HTTP Headers (`_headers` file)

Add a Netlify `_headers` file at the repo root:

```
/*
  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://upload.wikimedia.org; connect-src 'none'; frame-ancestors 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Notes:
- `unsafe-inline` required because scripts and styles are inline in the single HTML file
- `img-src` allows `data:` (embedded base64 logo) and Wikimedia (Tux PNG)
- `frame-ancestors 'none'` is the CSP equivalent of X-Frame-Options (both included for compatibility)

### Input Sanitization (belt-and-suspenders)

The key input is already safe — it is passed to `TextEncoder`, never injected into the DOM via `innerHTML`. Still apply:
- Strip ASCII control characters (< 0x20, except tab) from the passphrase before use
- `maxlength="64"` already present in HTML

---

## 2. Interactive Visual Explainer

Placed **below the three canvases**, above the stats box. Three interactive panels in a vertical stack, each in the existing `surface` card style.

### Panel 1 — Block Anatomy

**Purpose:** Show what one 16-byte AES block looks like inside a pixel image.

**Layout:**
- Header: "What is one AES block?"
- A row of 4 pixel cells (each pixel = coloured square)
- Each pixel subdivided into 4 byte cells labelled R, G, B, A
- Bracket underneath: "= 16 bytes = 1 AES block"

**Interaction:**
- Hover a pixel → its 4 byte cells highlight; tooltip shows hex values read from the actual `canvasOrig` pixel data
- Hover a byte cell → label animates (R=red tint, G=green tint, B=blue tint, A=grey tint)

**Implementation:** HTML divs + CSS Grid + CSS custom properties for tinting. Pixel data read from `canvasOrig` via `getImageData`.

---

### Panel 2 — Key Derivation Flow

**Purpose:** Show how the passphrase becomes an AES key.

**Layout:** Horizontal flow of stages:
```
[Passphrase] → [TextEncoder] → [SHA-256] → [slice 0..15] → [AES-128 Key]
```

Each stage is a box. An animated arrow (CSS `scaleX` transition) connects them.

**Interaction:**
- "Step through" button advances a highlight through each stage
- Boxes update live from the actual page key input (re-reads on each step)
- Final key box shows the hex bytes, coloured by position

**Implementation:** JS reads `keyInput.value`, runs `deriveKeyBytes`, renders hex output. Steps driven by a `currentStep` counter.

---

### Panel 3 — ECB vs GCM Data Flow

**Purpose:** Show why ECB leaks structure and GCM does not.

**Layout:** Two columns — ECB (left) and GCM (right). Two identical plaintext blocks feed into each.

**ECB column:**
```
Block A (plaintext) → AES_K → Ciphertext A
Block B (plaintext) → AES_K → Ciphertext B  ← same as A, glows red
```
Identical inputs → identical outputs. Red highlight + label "Pattern preserved!"

**GCM column:**
```
Block A (plaintext) → XOR ← CTR(K, nonce+0) → Ciphertext A
Block B (plaintext) → XOR ← CTR(K, nonce+1) → Ciphertext B  ← different, glows green
```
Identical inputs → different outputs due to counter. Green highlight + label "Pattern hidden!"

**Interaction:**
- "Step" button animates each stage in sequence (highlight moves left to right)
- "Reset" returns to initial state

**Implementation:** CSS transitions on border-color/background-color. JS drives a step array with per-element class toggles.

---

## 3. Implementation Notes

- All visuals match the existing dark theme (CSS variables `--bg`, `--surface`, `--border`, `--accent`, `--danger`, `--success`)
- Zero new dependencies — pure HTML/CSS/JS
- Panels are hidden initially, revealed after `drawTux()` completes (same pattern as stats/explainer)

Wait — actually Panels 1-3 are educational and should be **always visible** (not gated behind encryption). Only the stats box and why-leaks explainer are gated.

- Panel 1 (Block Anatomy) and Panel 3 (ECB vs GCM flow): always visible
- Panel 2 (Key Derivation): always visible, but updates live as user changes key

---

## 4. File Changes

| File | Change |
|------|--------|
| `_headers` | New — Netlify HTTP security headers |
| `index.html` | Add 3 interactive panels + input sanitization in JS |
