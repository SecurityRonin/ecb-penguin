# Bit Flip Attack + Block Heatmap + Mobile Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three features: (1) interactive bit-flip attack showing ECB's lack of authentication vs GCM's integrity, (2) heatmap overlay on ECB canvas showing duplicate blocks, (3) mobile responsive polish for all educational panels.

**Architecture:** All changes in `web/index.html`. Bit flip uses click handler on ECB canvas. Heatmap uses a second overlay canvas. Mobile uses CSS media queries at 600px breakpoint. Zero new dependencies.

**Tech Stack:** HTML/CSS/JS (vanilla), WebCrypto API, Playwright (tests)

---

## Task 1: Live Block Heatmap

**Files:**
- Modify: `web/index.html`
- Modify: `tests/ecb-penguin.test.js`

**Step 1: Write failing tests**

Add inside `test.describe('Educational Panels', ...)`:

```js
test('Heatmap toggle button exists on ECB panel', async ({ page }) => {
    await expect(page.locator('#heatmapBtn')).toBeVisible();
});

test('Heatmap overlay appears after encryption and toggle', async ({ page }) => {
    await page.click('#encryptBtn');
    await page.waitForFunction(
        () => document.getElementById('statusBar').textContent.includes('Done'),
        { timeout: 60000 }
    );
    await page.click('#heatmapBtn');
    await expect(page.locator('#canvasHeatmap')).toBeVisible();
});
```

**Step 2: Run to verify FAIL, RED commit**

```bash
npx playwright test --grep "Heatmap"
```

```bash
git add tests/ecb-penguin.test.js
git commit -m "test: add failing tests for block heatmap overlay

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

**Step 3: Add heatmap button to ECB panel header**

In the ECB panel header (around line 749-751), change:

```html
<div class="panel-head">
    <span class="panel-title">AES-ECB Mode</span>
    <span class="badge badge-danger">INSECURE</span>
</div>
```

To:

```html
<div class="panel-head">
    <span class="panel-title">AES-ECB Mode</span>
    <span style="display:flex;gap:0.4rem;align-items:center;">
        <button class="btn-heatmap" id="heatmapBtn" onclick="toggleHeatmap()">Heatmap</button>
        <span class="badge badge-danger">INSECURE</span>
    </span>
</div>
```

**Step 4: Add heatmap canvas overlay**

After `<canvas id="canvasECB" width="256" height="256"></canvas>`, add:

```html
<canvas id="canvasHeatmap" width="256" height="256" style="display:none;position:absolute;top:0;left:0;width:100%;aspect-ratio:1/1;pointer-events:none;image-rendering:pixelated;"></canvas>
```

Note: The parent `.panel` already has `position: relative`.

**Step 5: Add CSS for heatmap button**

```css
.btn-heatmap {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.6rem;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: background 0.15s, color 0.15s;
}

.btn-heatmap:hover { background: var(--border); color: var(--text); }
.btn-heatmap.hm-active { background: var(--accent); color: #0d1117; border-color: var(--accent); }
```

**Step 6: Add heatmap JS**

```js
/* ─── Block Heatmap ───────────────────────────────────────────── */
let heatmapVisible = false;

function blockHash(bytes, offset) {
    // Simple hash of 16-byte block to a hue value 0-360
    let h = 0;
    for (let i = 0; i < 16; i++) {
        h = ((h << 5) - h + bytes[offset + i]) | 0;
    }
    return Math.abs(h) % 360;
}

function renderHeatmap() {
    if (!lastEcbBytes) return;
    const canvas = document.getElementById('canvasHeatmap');
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);

    // Count block frequencies
    const freq = new Map();
    for (let i = 0; i < lastEcbBytes.length; i += 16) {
        const key = hex(lastEcbBytes.slice(i, i + 16));
        freq.set(key, (freq.get(key) || 0) + 1);
    }

    // Render each block as a colored region
    for (let i = 0; i < lastEcbBytes.length; i += 16) {
        const key = hex(lastEcbBytes.slice(i, i + 16));
        const count = freq.get(key);
        const hue = blockHash(lastEcbBytes, i);
        const isDupe = count > 1;
        const alpha = isDupe ? 180 : 60;

        // Each 16-byte block = 4 pixels (RGBA), paint all 4 pixels same color
        for (let p = 0; p < 4; p++) {
            const px = (i + p * 4);
            img.data[px]     = 0;   // Will be overwritten by HSL conversion
            img.data[px + 1] = 0;
            img.data[px + 2] = 0;
            img.data[px + 3] = alpha;
        }

        // Convert HSL to RGB for this block's 4 pixels
        const [r, g, b] = hslToRgb(hue / 360, isDupe ? 0.9 : 0.4, isDupe ? 0.55 : 0.35);
        for (let p = 0; p < 4; p++) {
            const px = (i + p * 4);
            img.data[px]     = r;
            img.data[px + 1] = g;
            img.data[px + 2] = b;
        }
    }

    ctx.putImageData(img, 0, 0);
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function toggleHeatmap() {
    const canvas = document.getElementById('canvasHeatmap');
    const btn = document.getElementById('heatmapBtn');
    heatmapVisible = !heatmapVisible;
    if (heatmapVisible && lastEcbBytes) {
        renderHeatmap();
        canvas.style.display = 'block';
        btn.classList.add('hm-active');
    } else {
        canvas.style.display = 'none';
        btn.classList.remove('hm-active');
        heatmapVisible = false;
    }
}
```

Update `doReset()` to hide heatmap:

```js
document.getElementById('canvasHeatmap').style.display = 'none';
document.getElementById('heatmapBtn').classList.remove('hm-active');
heatmapVisible = false;
```

**Step 7: Run tests, GREEN commit**

```bash
npx playwright test --grep "Heatmap"
```

```bash
git add web/index.html tests/ecb-penguin.test.js
git commit -m "feat: add live block heatmap overlay for ECB canvas

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Bit Flip Attack Demo

**Files:**
- Modify: `web/index.html`
- Modify: `tests/ecb-penguin.test.js`

**Step 1: Write failing tests**

Add inside `test.describe('Educational Panels', ...)`:

```js
test('Bit flip panel appears after encryption', async ({ page }) => {
    await page.click('#encryptBtn');
    await page.waitForFunction(
        () => document.getElementById('statusBar').textContent.includes('Done'),
        { timeout: 60000 }
    );
    await expect(page.locator('#bitFlipPanel')).toBeVisible();
});

test('Clicking ECB canvas triggers bit flip attack demo', async ({ page }) => {
    await page.click('#encryptBtn');
    await page.waitForFunction(
        () => document.getElementById('statusBar').textContent.includes('Done'),
        { timeout: 60000 }
    );

    // Click center of ECB canvas
    await page.click('#canvasECB', { position: { x: 128, y: 128 } });

    // ECB side should show partial corruption
    await expect(page.locator('#bfEcbResult')).toBeVisible();
    const ecbMsg = await page.textContent('#bfEcbFoot');
    expect(ecbMsg).toContain('1 block');

    // GCM side should show auth failure
    await expect(page.locator('#bfGcmFail')).toBeVisible();
});
```

**Step 2: Run to verify FAIL, RED commit**

```bash
npx playwright test --grep "Bit flip"
```

```bash
git add tests/ecb-penguin.test.js
git commit -m "test: add failing tests for bit flip attack demo

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

**Step 3: Add bit flip panel HTML**

Insert AFTER the `#ecbVsGcm` panel closing `</div>` and BEFORE `#realWorldImpact`:

```html
<!-- ── Panel: Bit Flip Attack ── -->
<div class="edu-panel" id="bitFlipPanel" style="display:none">
    <div class="edu-panel-title">Bit Flip Attack — Why Authentication Matters</div>
    <div class="edu-panel-body">
        <p class="edu-desc">Click any pixel on the ECB ciphertext canvas above to flip a byte. Watch how each mode responds to tampered data.</p>
        <div class="bf-grid">
            <div class="bf-col">
                <div class="bf-col-head df-head-danger">ECB — Tampered</div>
                <canvas id="bfEcbResult" width="256" height="256" class="bf-canvas"></canvas>
                <div class="bf-foot" id="bfEcbFoot">Flip a byte on the ECB canvas above…</div>
            </div>
            <div class="bf-col">
                <div class="bf-col-head df-head-safe">GCM — Tampered</div>
                <div class="bf-gcm-result" id="bfGcmOk" style="display:none">
                    <canvas id="bfGcmResult" width="256" height="256" class="bf-canvas"></canvas>
                </div>
                <div class="bf-gcm-fail" id="bfGcmFail" style="display:none">
                    <div class="bf-auth-fail">
                        <div style="font-size:1rem;font-weight:700;color:#fff;">AUTHENTICATION FAILED</div>
                        <div style="font-size:0.68rem;color:#fff;opacity:0.85;">1 bit flip detected — entire decryption refused</div>
                    </div>
                </div>
                <div class="bf-foot" id="bfGcmFoot">Flip a byte on the ECB canvas above…</div>
            </div>
        </div>
        <div class="kd-controls" style="margin-top:1rem">
            <button class="btn-secondary" id="bfResetBtn" onclick="bfReset()">Reset Flip</button>
        </div>
    </div>
</div>
```

**Step 4: Add CSS for bit flip panel**

```css
/* ── Bit Flip Attack ── */
.bf-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
}

.bf-col { display: flex; flex-direction: column; align-items: stretch; }

.bf-col-head {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.4rem;
    border-radius: 6px;
    margin-bottom: 0.5rem;
}

.bf-canvas {
    width: 100%;
    aspect-ratio: 1/1;
    image-rendering: pixelated;
    border-radius: 6px;
    border: 1px solid var(--border);
}

.bf-gcm-fail {
    width: 100%;
    aspect-ratio: 1/1;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.bf-auth-fail {
    background: rgba(180,30,30,0.92);
    border-radius: 6px;
    padding: 2rem;
    text-align: center;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.bf-foot {
    font-size: 0.72rem;
    color: var(--muted);
    padding: 0.4rem 0;
    min-height: 1.5rem;
    line-height: 1.4;
}

@media (max-width: 600px) {
    .bf-grid { grid-template-columns: 1fr; }
}
```

**Step 5: Add JS for bit flip**

Add click handler for ECB canvas and bit flip logic:

```js
/* ─── Bit Flip Attack ─────────────────────────────────────────── */
function initBitFlip() {
    const canvas = document.getElementById('canvasECB');
    canvas.addEventListener('click', handleBitFlip);
}

async function handleBitFlip(e) {
    if (!lastEcbBytes) return;

    const canvas = document.getElementById('canvasECB');
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    const pixelIdx = (y * W + x) * 4;
    const blockIdx = Math.floor(pixelIdx / 16) * 16;

    // Create flipped copy
    const flipped = new Uint8Array(lastEcbBytes);
    // XOR all 16 bytes in the block with 0xFF
    for (let i = blockIdx; i < blockIdx + 16 && i < flipped.length; i++) {
        flipped[i] ^= 0xFF;
    }

    const pass = sanitizeKey(document.getElementById('keyInput').value);
    const keySize = parseInt(document.getElementById('keySize').value);

    // ECB: decrypt flipped ciphertext — only the flipped block is corrupted
    try {
        const ecbDec = await decryptECB(flipped, pass, keySize);
        renderBytes(document.getElementById('bfEcbResult'), ecbDec);
        const blockNum = Math.floor(blockIdx / 16);
        document.getElementById('bfEcbFoot').innerHTML =
            '<strong style="color:var(--danger)">Attacker modified 1 block (#' + blockNum + ') — only that block corrupted. Rest decrypts perfectly. No error detected.</strong>';
    } catch (e) {
        document.getElementById('bfEcbFoot').textContent = 'Error: ' + e.message;
    }

    // GCM: flip same byte in GCM ciphertext — auth tag fails
    if (lastGcmFull) {
        const gcmFlipped = new Uint8Array(lastGcmFull);
        for (let i = blockIdx; i < blockIdx + 16 && i < gcmFlipped.length - 16; i++) {
            gcmFlipped[i] ^= 0xFF;
        }
        try {
            const gcmDec = await decryptGCM(gcmFlipped, pass, keySize, lastGcmIv);
            // Shouldn't reach here with flipped data, but handle it
            renderBytes(document.getElementById('bfGcmResult'), gcmDec);
            document.getElementById('bfGcmOk').style.display = 'block';
            document.getElementById('bfGcmFail').style.display = 'none';
        } catch (e) {
            document.getElementById('bfGcmOk').style.display = 'none';
            document.getElementById('bfGcmFail').style.display = 'flex';
            document.getElementById('bfGcmFoot').innerHTML =
                '<strong style="color:var(--success)">GCM detected the tampering — decryption refused entirely. Even 1 flipped bit breaks the auth tag.</strong>';
        }
    }

    document.getElementById('bfEcbResult').style.display = 'block';
}

function bfReset() {
    document.getElementById('bfEcbFoot').textContent = 'Flip a byte on the ECB canvas above…';
    document.getElementById('bfGcmFoot').textContent = 'Flip a byte on the ECB canvas above…';
    document.getElementById('bfGcmOk').style.display = 'none';
    document.getElementById('bfGcmFail').style.display = 'none';
    const ecbCtx = document.getElementById('bfEcbResult').getContext('2d');
    ecbCtx.clearRect(0, 0, W, H);
}
```

Call `initBitFlip()` in the async init block.

In `doEncrypt()`, after enabling decrypt button, add:
```js
document.getElementById('bitFlipPanel').style.display = 'block';
```

In `doReset()`, add:
```js
document.getElementById('bitFlipPanel').style.display = 'none';
bfReset();
```

**Step 6: Run tests, GREEN commit**

```bash
npx playwright test --grep "Bit flip"
```

```bash
git add web/index.html tests/ecb-penguin.test.js
git commit -m "feat: add bit flip attack demo panel

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Mobile Responsiveness

**Files:**
- Modify: `web/index.html`
- Modify: `tests/ecb-penguin.test.js`

**Step 1: Write failing test**

```js
test('Controls stack vertically on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForFunction(() => {
        const c = document.getElementById('canvasOrig');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i] > 0 || d[i+1] > 0 || d[i+2] > 0) return true;
        }
        return false;
    }, { timeout: 20000 });

    // Controls should not overflow the viewport
    const controls = page.locator('.controls');
    const box = await controls.boundingBox();
    expect(box.width).toBeLessThanOrEqual(375);
});
```

**Step 2: Run to verify FAIL, RED commit**

```bash
npx playwright test --grep "Controls stack"
```

```bash
git add tests/ecb-penguin.test.js
git commit -m "test: add failing test for mobile responsiveness

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

**Step 3: Add/extend mobile media queries**

Find the existing `@media (max-width: 720px)` and `@media (max-width: 600px)` blocks. Replace/extend them with a single comprehensive mobile block. Add after all existing CSS, before `</style>`:

```css
/* ── Mobile ── */
@media (max-width: 600px) {
    body { padding: 1rem 0.5rem 2rem; }

    .controls {
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
    }

    .controls .ctrl-group { width: 100%; }

    input[type="text"] { width: 100%; }

    .btn-row { flex-wrap: wrap; }

    .panels { grid-template-columns: 1fr; }

    .edu-panel { padding: 1rem; }

    .kd-flow {
        flex-direction: column;
        align-items: stretch;
    }

    .kd-arrow {
        text-align: center;
        transform: rotate(90deg);
        font-size: 1rem;
    }

    .kd-stage { min-width: unset; }

    .df-grid { grid-template-columns: 1fr; }

    .bf-grid { grid-template-columns: 1fr; }

    .tl-attack {
        grid-template-columns: 3.5rem 1fr;
        grid-template-rows: auto auto;
    }

    .tl-attack-desc {
        grid-column: 1 / -1;
    }

    .tl-track { gap: 0.3rem; }

    .stats-grid {
        grid-template-columns: 1fr 1fr;
    }
}
```

Also remove the existing `@media (max-width: 720px) { .panels { grid-template-columns: 1fr; } }` since it's now covered by the 600px block (or keep it for tablet-like widths — keep it if it exists and change to 600px).

**Step 4: Run tests, GREEN commit**

```bash
npx playwright test --grep "Controls stack"
```

Full suite:
```bash
npx playwright test --grep "ECB Penguin Demo|Educational"
```

```bash
git add web/index.html tests/ecb-penguin.test.js
git commit -m "feat: add comprehensive mobile responsiveness

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Final Checklist

- [ ] Heatmap toggle on ECB panel header, overlay canvas shows duplicate block colors
- [ ] Heatmap hidden on reset
- [ ] Bit flip panel visible after encryption, hidden on reset
- [ ] Clicking ECB canvas flips a block, shows ECB partial corruption + GCM auth failure
- [ ] Reset Flip button clears bit flip state
- [ ] Controls, key derivation, data flow, timeline, and attack panels all fit on 375px viewport
- [ ] All existing tests still pass
- [ ] All new tests pass
