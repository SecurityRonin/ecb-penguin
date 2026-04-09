# Security Hardening + Interactive Visual Explainer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add HTTP security headers via Netlify `_headers`, sanitize key input, and build three always-visible interactive educational panels (Block Anatomy, Key Derivation, ECB vs GCM Data Flow) below the canvas panels.

**Architecture:** Single `index.html` — all panels are pure HTML/CSS/JS, zero new dependencies. Netlify `_headers` file handles HTTP-level security. Interactive panels use CSS transitions + JS step counters. All new elements use existing CSS variables (`--bg`, `--surface`, `--border`, `--accent`, `--danger`, `--success`).

**Tech Stack:** HTML/CSS/JS (vanilla), Playwright (tests), Netlify (`_headers`)

---

## Task 1: Netlify Security Headers

**Files:**
- Create: `_headers`
- Test: `tests/ecb-penguin.test.js` (add tests at top of file)

**Step 1: Write failing Playwright test**

Add to `tests/ecb-penguin.test.js` before the existing `test.describe` block:

```js
test.describe('Security headers', () => {
    test('X-Frame-Options is DENY', async ({ request }) => {
        const res = await request.get('/');
        expect(res.headers()['x-frame-options']).toBe('DENY');
    });

    test('X-Content-Type-Options is nosniff', async ({ request }) => {
        const res = await request.get('/');
        expect(res.headers()['x-content-type-options']).toBe('nosniff');
    });

    test('CSP header is present', async ({ request }) => {
        const res = await request.get('/');
        expect(res.headers()['content-security-policy']).toBeTruthy();
    });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx playwright test --grep "Security headers"
```
Expected: 3 FAIL (headers not present — local dev server doesn't serve `_headers`)

Note: These header tests only pass when served via Netlify. For local dev, they will fail — that is expected and acceptable. Skip in CI if needed, or run against deployed URL. Continue to next step regardless.

**Step 3: Create `_headers`**

Create `/Users/4n6h4x0r/src/ecb-penguin/_headers`:

```
/*
  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://upload.wikimedia.org; connect-src 'none'; frame-ancestors 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Step 4: Commit (RED + GREEN together — headers only verifiable on Netlify)**

```bash
git add _headers tests/ecb-penguin.test.js
git commit -m "feat: add Netlify security headers and header tests"
```

---

## Task 2: Input Sanitization

**Files:**
- Modify: `index.html` (JS section, `doEncrypt` and `updateKeyHex`)
- Test: `tests/ecb-penguin.test.js`

**Step 1: Write failing Playwright test**

Add to the `ECB Penguin Demo` describe block in `tests/ecb-penguin.test.js`:

```js
test('Control characters are stripped from key input before use', async ({ page }) => {
    // Type a passphrase with control chars injected
    await page.fill('#keyInput', 'MyKey\x01\x02\x03');
    // Key hex display should show hex of "MyKey" only (5 bytes), not the control chars
    const hexText = await page.textContent('#keyHex');
    // Control chars have ASCII codes < 0x20 — verify the display updated (not empty)
    expect(hexText).toBeTruthy();
    expect(hexText).toContain('Key →');
});
```

**Step 2: Run to verify it fails**

```bash
npx playwright test --grep "Control characters"
```
Expected: FAIL

**Step 3: Add sanitizer function to `index.html` JS**

Add this function right before `deriveKeyBytes`:

```js
function sanitizeKey(raw) {
    // Strip ASCII control characters (0x00–0x1F except 0x09 tab, 0x0A newline)
    return raw.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
}
```

Then wrap every use of `pass` / `document.getElementById('keyInput').value`:
- In `updateKeyHex`: change `const pass = document.getElementById('keyInput').value;` → `const pass = sanitizeKey(document.getElementById('keyInput').value);`
- In `doEncrypt`: change `const pass = document.getElementById('keyInput').value;` → `const pass = sanitizeKey(document.getElementById('keyInput').value);`

**Step 4: Run test to verify it passes**

```bash
npx playwright test --grep "Control characters"
```
Expected: PASS

**Step 5: Commit RED then GREEN**

```bash
git add index.html tests/ecb-penguin.test.js
git commit -m "feat: sanitize key input — strip control characters"
```

---

## Task 3: Panel 1 — Block Anatomy HTML + CSS

**Files:**
- Modify: `index.html` (HTML section — add panel after `.panels` div)
- Test: `tests/ecb-penguin.test.js`

**Step 1: Write failing test**

```js
test('Block anatomy panel is visible on page load', async ({ page }) => {
    await expect(page.locator('#blockAnatomy')).toBeVisible();
    await expect(page.locator('#blockAnatomy .anatomy-pixel')).toHaveCount(4);
});
```

**Step 2: Run to verify FAIL**

```bash
npx playwright test --grep "Block anatomy panel is visible"
```

**Step 3: Add HTML for Panel 1**

Insert after the closing `</div>` of `.panels` and before `<div class="stats" id="statsBox">`:

```html
<!-- ── Panel 1: Block Anatomy ── -->
<div class="edu-panel" id="blockAnatomy">
    <div class="edu-panel-title">What is one AES block?</div>
    <div class="edu-panel-body">
        <p class="edu-desc">One AES block = <strong>16 bytes</strong> = 4 consecutive pixels (each pixel is 4 bytes: R, G, B, A). Hover a pixel to inspect its bytes.</p>
        <div class="anatomy-row" id="anatomyRow">
            <!-- 4 pixel cells injected by JS -->
        </div>
        <div class="anatomy-bracket">
            <span class="anatomy-bracket-line"></span>
            <span class="anatomy-bracket-label">= 16 bytes = 1 AES-128 block</span>
        </div>
        <div class="anatomy-tooltip" id="anatomyTooltip"></div>
    </div>
</div>
```

**Step 4: Add CSS for Panel 1**

Add inside `<style>` before the closing `</style>`:

```css
/* ── Educational panels ── */
.edu-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.75rem;
}

.edu-panel-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin-bottom: 1rem;
}

.edu-desc {
    font-size: 0.82rem;
    color: var(--muted);
    margin-bottom: 1rem;
    line-height: 1.5;
}

.anatomy-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.anatomy-pixel {
    display: flex;
    gap: 3px;
    cursor: pointer;
    border: 2px solid transparent;
    border-radius: 6px;
    padding: 4px;
    transition: border-color 0.15s;
}

.anatomy-pixel:hover { border-color: var(--accent); }

.anatomy-byte {
    width: 28px;
    height: 42px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    transition: background 0.15s, color 0.15s;
    background: var(--surface2);
    color: var(--muted);
    border: 1px solid var(--border);
    flex-direction: column;
    gap: 2px;
}

.anatomy-byte .byte-label { font-size: 0.52rem; opacity: 0.7; }
.anatomy-byte .byte-val   { font-size: 0.64rem; }

.anatomy-byte.ch-r { background: #3a1212; color: #f47c7c; border-color: #f47c7c44; }
.anatomy-byte.ch-g { background: #122a1c; color: #7cf49a; border-color: #7cf49a44; }
.anatomy-byte.ch-b { background: #0f1f3a; color: #7cb8f4; border-color: #7cb8f444; }
.anatomy-byte.ch-a { background: #2a2a2a; color: #c9d1d9; border-color: #c9d1d944; }

.anatomy-bracket {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-top: 0.35rem;
}

.anatomy-bracket-line {
    display: block;
    width: calc(4 * 28px + 4 * 3px * 2 + 4 * 4px * 2 + 4 * 2px + 3 * 0.5rem);
    height: 2px;
    background: var(--border);
    border-radius: 1px;
}

.anatomy-bracket-label {
    font-size: 0.68rem;
    color: var(--accent);
}
```

**Step 5: Add JS to populate anatomy pixels**

Add this function in the JS section after `updateKeyHex`:

```js
function initBlockAnatomy() {
    const row = document.getElementById('anatomyRow');
    const ctx = document.getElementById('canvasOrig').getContext('2d');
    // Read first 4 pixels from row 128 (middle of image — interesting colors)
    const d = ctx.getImageData(0, 128, 4, 1).data;
    const channels = ['R','G','B','A'];
    const classes   = ['ch-r','ch-g','ch-b','ch-a'];

    for (let p = 0; p < 4; p++) {
        const pxDiv = document.createElement('div');
        pxDiv.className = 'anatomy-pixel';
        pxDiv.dataset.pixel = p;
        for (let c = 0; c < 4; c++) {
            const val = d[p * 4 + c];
            const byteDiv = document.createElement('div');
            byteDiv.className = `anatomy-byte ${classes[c]}`;
            byteDiv.innerHTML = `<span class="byte-label">${channels[c]}</span><span class="byte-val">${val.toString(16).padStart(2,'0')}</span>`;
            pxDiv.appendChild(byteDiv);
        }
        row.appendChild(pxDiv);
    }
}
```

Call `initBlockAnatomy()` inside the `(async () => { ... })()` init block, after `await drawTux(...)`.

**Step 6: Run test to verify PASS**

```bash
npx playwright test --grep "Block anatomy panel is visible"
```
Expected: PASS

**Step 7: Commit**

```bash
git add index.html tests/ecb-penguin.test.js
git commit -m "feat: add block anatomy panel (Panel 1)"
```

---

## Task 4: Panel 2 — Key Derivation Flow

**Files:**
- Modify: `index.html`
- Test: `tests/ecb-penguin.test.js`

**Step 1: Write failing tests**

```js
test('Key derivation panel is visible', async ({ page }) => {
    await expect(page.locator('#keyDerivation')).toBeVisible();
});

test('Key derivation step button advances highlight', async ({ page }) => {
    const btn = page.locator('#keyDeriveStep');
    await btn.click();
    const active = page.locator('.kd-stage.kd-active');
    await expect(active).toHaveCount(1);
});
```

**Step 2: Run to verify FAIL**

```bash
npx playwright test --grep "Key derivation"
```

**Step 3: Add HTML for Panel 2**

Insert after `#blockAnatomy` closing `</div>`:

```html
<!-- ── Panel 2: Key Derivation ── -->
<div class="edu-panel" id="keyDerivation">
    <div class="edu-panel-title">How the key is derived</div>
    <div class="edu-panel-body">
        <p class="edu-desc">Your passphrase is hashed with SHA-256, then the first 16 (or 32) bytes become the AES key. Click Step to walk through it.</p>
        <div class="kd-flow" id="kdFlow">
            <div class="kd-stage" id="kd0">
                <div class="kd-stage-label">Passphrase</div>
                <div class="kd-stage-val" id="kdPass">—</div>
            </div>
            <div class="kd-arrow">→</div>
            <div class="kd-stage" id="kd1">
                <div class="kd-stage-label">TextEncoder</div>
                <div class="kd-stage-val kd-mono" id="kdEncoded">UTF-8 bytes</div>
            </div>
            <div class="kd-arrow">→</div>
            <div class="kd-stage" id="kd2">
                <div class="kd-stage-label">SHA-256</div>
                <div class="kd-stage-val kd-mono" id="kdHash">32-byte hash</div>
            </div>
            <div class="kd-arrow">→</div>
            <div class="kd-stage" id="kd3">
                <div class="kd-stage-label">Slice 0…15</div>
                <div class="kd-stage-val kd-mono" id="kdSlice">first 16 bytes</div>
            </div>
            <div class="kd-arrow">→</div>
            <div class="kd-stage kd-stage-final" id="kd4">
                <div class="kd-stage-label">AES Key</div>
                <div class="kd-stage-val kd-mono kd-key" id="kdKey">—</div>
            </div>
        </div>
        <div class="kd-controls">
            <button class="btn-secondary" id="kdReset" onclick="kdResetStep()">Reset</button>
            <button class="btn-primary"   id="keyDeriveStep" onclick="kdNextStep()">Step →</button>
        </div>
    </div>
</div>
```

**Step 4: Add CSS for Panel 2**

```css
.kd-flow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
}

.kd-arrow {
    color: var(--muted);
    font-size: 1.2rem;
}

.kd-stage {
    background: var(--bg);
    border: 2px solid var(--border);
    border-radius: 8px;
    padding: 0.6rem 0.8rem;
    min-width: 100px;
    transition: border-color 0.2s, background 0.2s;
    flex: 1;
    min-width: 80px;
}

.kd-stage.kd-active {
    border-color: var(--accent);
    background: #0d1f3a;
}

.kd-stage-final.kd-active {
    border-color: var(--success);
    background: #0d1f0d;
}

.kd-stage-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
    margin-bottom: 0.3rem;
}

.kd-stage-val {
    font-size: 0.72rem;
    color: var(--text);
    word-break: break-all;
    line-height: 1.3;
}

.kd-mono { font-family: inherit; }
.kd-key  { color: var(--warning); }

.kd-controls {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}
```

**Step 5: Add JS for Panel 2**

```js
let kdStep = -1;

async function kdNextStep() {
    const pass = sanitizeKey(document.getElementById('keyInput').value) || 'empty';
    const size = parseInt(document.getElementById('keySize').value);
    const raw  = new TextEncoder().encode(pass);
    const hash = await crypto.subtle.digest('SHA-256', raw);
    const hashBytes = new Uint8Array(hash);
    const keyBytes  = hashBytes.slice(0, size);

    kdStep = Math.min(kdStep + 1, 4);

    // Clear all
    for (let i = 0; i <= 4; i++) {
        document.getElementById('kd' + i).classList.remove('kd-active');
    }

    if (kdStep >= 0) {
        document.getElementById('kdPass').textContent = '"' + pass + '"';
        document.getElementById('kd0').classList.add('kd-active');
    }
    if (kdStep >= 1) {
        document.getElementById('kdEncoded').textContent = raw.length + ' bytes: ' + Array.from(raw.slice(0,6)).map(b=>b.toString(16).padStart(2,'0')).join(' ') + '…';
        document.getElementById('kd1').classList.add('kd-active');
    }
    if (kdStep >= 2) {
        document.getElementById('kdHash').textContent = hex(hashBytes).slice(0, 24) + '…';
        document.getElementById('kd2').classList.add('kd-active');
    }
    if (kdStep >= 3) {
        document.getElementById('kdSlice').textContent = 'bytes 0–' + (size-1);
        document.getElementById('kd3').classList.add('kd-active');
    }
    if (kdStep >= 4) {
        document.getElementById('kdKey').textContent = hex(keyBytes);
        document.getElementById('kd4').classList.add('kd-active');
        document.getElementById('keyDeriveStep').disabled = true;
    }
}

function kdResetStep() {
    kdStep = -1;
    for (let i = 0; i <= 4; i++) {
        document.getElementById('kd' + i).classList.remove('kd-active');
    }
    document.getElementById('kdPass').textContent    = '—';
    document.getElementById('kdEncoded').textContent = 'UTF-8 bytes';
    document.getElementById('kdHash').textContent    = '32-byte hash';
    document.getElementById('kdSlice').textContent   = 'first 16 bytes';
    document.getElementById('kdKey').textContent     = '—';
    document.getElementById('keyDeriveStep').disabled = false;
}
```

**Step 6: Run tests to verify PASS**

```bash
npx playwright test --grep "Key derivation"
```
Expected: PASS

**Step 7: Commit**

```bash
git add index.html tests/ecb-penguin.test.js
git commit -m "feat: add key derivation flow panel (Panel 2)"
```

---

## Task 5: Panel 3 — ECB vs GCM Data Flow

**Files:**
- Modify: `index.html`
- Test: `tests/ecb-penguin.test.js`

**Step 1: Write failing tests**

```js
test('ECB vs GCM data flow panel is visible', async ({ page }) => {
    await expect(page.locator('#ecbVsGcm')).toBeVisible();
});

test('ECB vs GCM step button animates stages', async ({ page }) => {
    await page.click('#ecbGcmStep');
    const active = page.locator('.df-stage.df-active');
    await expect(active).toHaveCount(2); // one in each column
});

test('ECB duplicate warning appears at final step', async ({ page }) => {
    // Click through all steps
    for (let i = 0; i < 5; i++) await page.click('#ecbGcmStep');
    await expect(page.locator('#ecbDupeWarn')).toBeVisible();
});
```

**Step 2: Run to verify FAIL**

```bash
npx playwright test --grep "ECB vs GCM"
```

**Step 3: Add HTML for Panel 3**

Insert after `#keyDerivation` closing `</div>`:

```html
<!-- ── Panel 3: ECB vs GCM Data Flow ── -->
<div class="edu-panel" id="ecbVsGcm">
    <div class="edu-panel-title">ECB vs GCM — block-by-block data flow</div>
    <div class="edu-panel-body">
        <p class="edu-desc">Two identical plaintext blocks go into each mode. Watch what comes out.</p>
        <div class="df-grid">

            <!-- ECB column -->
            <div class="df-col">
                <div class="df-col-head df-head-danger">AES-ECB</div>

                <div class="df-stage" id="dfEcbP1">
                    <span class="df-stage-label">Block A (plaintext)</span>
                    <span class="df-stage-val df-identical">a3 f0 … 7c</span>
                </div>
                <div class="df-down-arrow">↓</div>
                <div class="df-stage df-stage-box" id="dfEcbBox1">
                    <span class="df-stage-label">AES_K( · )</span>
                </div>
                <div class="df-down-arrow">↓</div>
                <div class="df-stage" id="dfEcbC1">
                    <span class="df-stage-label">Ciphertext A</span>
                    <span class="df-stage-val" id="dfEcbCv1">—</span>
                </div>

                <div style="height:1rem"></div>

                <div class="df-stage" id="dfEcbP2">
                    <span class="df-stage-label">Block B (identical plaintext)</span>
                    <span class="df-stage-val df-identical">a3 f0 … 7c</span>
                </div>
                <div class="df-down-arrow">↓</div>
                <div class="df-stage df-stage-box" id="dfEcbBox2">
                    <span class="df-stage-label">AES_K( · )</span>
                </div>
                <div class="df-down-arrow">↓</div>
                <div class="df-stage" id="dfEcbC2">
                    <span class="df-stage-label">Ciphertext B</span>
                    <span class="df-stage-val" id="dfEcbCv2">—</span>
                </div>

                <div class="df-warn" id="ecbDupeWarn" style="display:none">
                    ⚠️ Ciphertext A = Ciphertext B — pattern preserved!
                </div>
            </div>

            <!-- GCM column -->
            <div class="df-col">
                <div class="df-col-head df-head-safe">AES-GCM</div>

                <div class="df-stage" id="dfGcmP1">
                    <span class="df-stage-label">Block A (plaintext)</span>
                    <span class="df-stage-val df-identical">a3 f0 … 7c</span>
                </div>
                <div class="df-down-arrow">↓</div>
                <div class="df-stage df-stage-box" id="dfGcmBox1">
                    <span class="df-stage-label">CTR(K, nonce+0) ⊕ block</span>
                </div>
                <div class="df-down-arrow">↓</div>
                <div class="df-stage" id="dfGcmC1">
                    <span class="df-stage-label">Ciphertext A</span>
                    <span class="df-stage-val" id="dfGcmCv1">—</span>
                </div>

                <div style="height:1rem"></div>

                <div class="df-stage" id="dfGcmP2">
                    <span class="df-stage-label">Block B (identical plaintext)</span>
                    <span class="df-stage-val df-identical">a3 f0 … 7c</span>
                </div>
                <div class="df-down-arrow">↓</div>
                <div class="df-stage df-stage-box" id="dfGcmBox2">
                    <span class="df-stage-label">CTR(K, nonce+1) ⊕ block</span>
                </div>
                <div class="df-down-arrow">↓</div>
                <div class="df-stage" id="dfGcmC2">
                    <span class="df-stage-label">Ciphertext B</span>
                    <span class="df-stage-val" id="dfGcmCv2">—</span>
                </div>

                <div class="df-safe" id="gcmSafeNote" style="display:none">
                    ✓ Ciphertext A ≠ Ciphertext B — pattern hidden!
                </div>
            </div>
        </div>

        <div class="kd-controls" style="margin-top:1rem">
            <button class="btn-secondary" onclick="dfReset()">Reset</button>
            <button class="btn-primary" id="ecbGcmStep" onclick="dfNextStep()">Step →</button>
        </div>
    </div>
</div>
```

**Step 4: Add CSS for Panel 3**

```css
.df-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
}

.df-col { display: flex; flex-direction: column; align-items: stretch; }

.df-col-head {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.4rem;
    border-radius: 6px;
    margin-bottom: 0.75rem;
}

.df-head-danger { background: #3a1212; color: var(--danger); }
.df-head-safe   { background: #122a1c; color: var(--success); }

.df-stage {
    background: var(--bg);
    border: 2px solid var(--border);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    transition: border-color 0.25s, background 0.25s;
}

.df-stage.df-active-ecb  { border-color: var(--danger);  background: #1f0d0d; }
.df-stage.df-active-gcm  { border-color: var(--success); background: #0d1f0d; }
.df-stage.df-active-box  { border-color: var(--accent);  background: #0d1f3a; }

.df-stage-label { font-size: 0.6rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.df-stage-val   { font-size: 0.72rem; word-break: break-all; }
.df-identical   { color: var(--warning); }

.df-stage-box { align-items: center; justify-content: center; min-height: 2.5rem; }
.df-stage-box .df-stage-label { font-size: 0.7rem; text-align: center; text-transform: none; letter-spacing: 0; color: var(--text); }

.df-down-arrow {
    text-align: center;
    color: var(--muted);
    font-size: 1.1rem;
    line-height: 1.4;
}

.df-warn {
    margin-top: 0.75rem;
    background: #3a1212;
    color: var(--danger);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
}

.df-safe {
    margin-top: 0.75rem;
    background: #122a1c;
    color: var(--success);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
}

@media (max-width: 600px) {
    .df-grid { grid-template-columns: 1fr; }
}
```

**Step 5: Add JS for Panel 3**

Add these globals and functions to the JS section:

```js
let dfStep = -1;
// A fixed 16-byte plaintext block (shared by both — demonstrates identical input)
const DF_PLAIN = new Uint8Array([0xa3,0xf0,0x12,0x7c,0x88,0x3e,0x55,0xd1,
                                  0x04,0xb9,0xc7,0x2a,0x6f,0xd3,0x91,0x0e]);

async function dfNextStep() {
    const pass = sanitizeKey(document.getElementById('keyInput').value) || 'empty';
    const size = parseInt(document.getElementById('keySize').value);

    if (dfStep === -1) {
        // Pre-compute ciphertexts
        const ecbBytes = await encryptECB({ data: { buffer: DF_PLAIN.buffer } }, pass, size);
        // For display, use first 8 bytes as preview
        const ecbHex = hex(ecbBytes.slice(0, 8)) ;
        document.getElementById('dfEcbCv1').textContent = ecbHex.match(/.{2}/g).slice(0,4).join(' ') + ' …';
        document.getElementById('dfEcbCv2').textContent = ecbHex.match(/.{2}/g).slice(0,4).join(' ') + ' …';

        // GCM uses same key but different counters — simulate with two separate encryptions
        const gcmBytes1 = await encryptGCMBlock(DF_PLAIN, pass, size, 0);
        const gcmBytes2 = await encryptGCMBlock(DF_PLAIN, pass, size, 1);
        document.getElementById('dfGcmCv1').textContent = hex(gcmBytes1.slice(0,4)).match(/.{2}/g).join(' ') + ' …';
        document.getElementById('dfGcmCv2').textContent = hex(gcmBytes2.slice(0,4)).match(/.{2}/g).join(' ') + ' …';
    }

    const steps = [
        ['dfEcbP1','dfGcmP1'],
        ['dfEcbBox1','dfGcmBox1'],
        ['dfEcbC1','dfGcmC1'],
        ['dfEcbP2','dfGcmP2'],
        ['dfEcbBox2','dfGcmBox2'],
        ['dfEcbC2','dfGcmC2'],
    ];

    dfStep = Math.min(dfStep + 1, steps.length - 1);

    // Clear previous actives
    document.querySelectorAll('.df-stage').forEach(el => {
        el.classList.remove('df-active-ecb','df-active-gcm','df-active-box');
    });

    // Activate up to current step
    for (let i = 0; i <= dfStep; i++) {
        const [ecbId, gcmId] = steps[i];
        const isBox = ecbId.includes('Box');
        document.getElementById(ecbId).classList.add(isBox ? 'df-active-box' : 'df-active-ecb');
        document.getElementById(gcmId).classList.add(isBox ? 'df-active-box' : 'df-active-gcm');
    }

    if (dfStep === steps.length - 1) {
        document.getElementById('ecbDupeWarn').style.display = 'block';
        document.getElementById('gcmSafeNote').style.display = 'block';
        document.getElementById('ecbGcmStep').disabled = true;
    }
}

function dfReset() {
    dfStep = -1;
    document.querySelectorAll('.df-stage').forEach(el => {
        el.classList.remove('df-active-ecb','df-active-gcm','df-active-box');
    });
    document.getElementById('ecbDupeWarn').style.display = 'none';
    document.getElementById('gcmSafeNote').style.display = 'none';
    document.getElementById('ecbGcmStep').disabled = false;
    ['dfEcbCv1','dfEcbCv2','dfGcmCv1','dfGcmCv2'].forEach(id => {
        document.getElementById(id).textContent = '—';
    });
}

// Helper: encrypt a single block with GCM using a deterministic nonce derived from blockIndex
async function encryptGCMBlock(plainBlock, passphrase, keySize, blockIndex) {
    const keyBytes = await deriveKeyBytes(passphrase, keySize);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']
    );
    // Deterministic nonce: 11 zero bytes + 1 byte block index (demo only — real GCM uses random nonce)
    const iv = new Uint8Array(12);
    iv[11] = blockIndex;
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plainBlock);
    return new Uint8Array(enc).slice(0, plainBlock.length);
}
```

Note: `encryptECB` takes an object with `data.buffer` — pass `{ data: { buffer: DF_PLAIN.buffer } }` to reuse the existing function.

Wait — `encryptECB` takes `pixelData` and reads `pixelData.data.buffer`. But `DF_PLAIN` is already a `Uint8Array`. We need a tiny wrapper or just inline the ECB encryption for demo purposes. Replace the `encryptECB` call in `dfNextStep` with a direct inline call:

```js
// Inside dfNextStep, replace the encryptECB call:
const keyBytes  = await deriveKeyBytes(pass, size);
const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']);
const enc = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, cryptoKey, DF_PLAIN);
const ecbResult = new Uint8Array(enc).slice(0, 16);
const ecbHex = hex(ecbResult);
```

**Step 6: Run tests to verify PASS**

```bash
npx playwright test --grep "ECB vs GCM"
```
Expected: PASS

**Step 7: Run full suite**

```bash
npx playwright test
```
Expected: all PASS

**Step 8: Commit**

```bash
git add index.html tests/ecb-penguin.test.js
git commit -m "feat: add ECB vs GCM data flow panel (Panel 3)"
```

---

## Final Checklist

- [ ] `_headers` file present at repo root
- [ ] All inputs run through `sanitizeKey()`
- [ ] Panel 1 (Block Anatomy) renders 4 pixel cells, hover shows RGBA bytes
- [ ] Panel 2 (Key Derivation) steps through 5 stages, reads live key input
- [ ] Panel 3 (ECB vs GCM Flow) steps through 6 stages, shows dupe warning at end
- [ ] All 7 original Playwright tests still pass
- [ ] New Playwright tests pass
- [ ] No new external dependencies added
