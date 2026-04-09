# Decryption Feature + Real-World Impact Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add decryption capability (correct key reverses, wrong key shows ECB garbage vs GCM auth failure) plus an interactive "Real-World Impact" educational panel with CBC padding oracle attack timeline.

**Architecture:** All changes in single `index.html`. Decryption stores ciphertext + GCM nonce/tag in JS variables during encryption. New educational panel uses accordion-style timeline with click-to-expand nodes. Zero new dependencies.

**Tech Stack:** HTML/CSS/JS (vanilla), WebCrypto API, Playwright (tests)

---

## Task 1: Decrypt Button + State Storage

**Files:**
- Modify: `index.html` (HTML button row + JS state variables)
- Modify: `tests/ecb-penguin.test.js`

**Step 1: Write failing tests**

Add inside the existing `test.describe('ECB Penguin Demo', ...)` block:

```js
test('Decrypt button exists and is disabled before encryption', async ({ page }) => {
    const btn = page.locator('#decryptBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
});

test('Decrypt button is enabled after encryption', async ({ page }) => {
    await page.click('#encryptBtn');
    await page.waitForFunction(
        () => document.getElementById('statusBar').textContent.includes('Done'),
        { timeout: 60000 }
    );
    const btn = page.locator('#decryptBtn');
    await expect(btn).toBeEnabled();
});
```

**Step 2: Run to verify FAIL**

```bash
npx playwright test --grep "Decrypt button"
```
Expected: 2 FAIL

**RED commit:**
```bash
git add tests/ecb-penguin.test.js
git commit -m "test: add failing tests for decrypt button state

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

**Step 3: Add Decrypt button to HTML**

In the `.btn-row` div (around line 539), add after the Reset button and before the Upload label:

```html
<button class="btn-secondary" id="decryptBtn" onclick="doDecrypt()" disabled>Decrypt</button>
```

The button row should now be:
```html
<div class="btn-row">
    <button class="btn-primary" id="encryptBtn" onclick="doEncrypt()">Encrypt</button>
    <button class="btn-secondary" id="decryptBtn" onclick="doDecrypt()" disabled>Decrypt</button>
    <button class="btn-secondary" onclick="doReset()">Reset</button>
    <label style="cursor:pointer">
        ...upload button...
    </label>
</div>
```

**Step 4: Add state variables and stub doDecrypt**

At the top of the JS `<script>` section (right after `const W = 256, H = 256;`), add:

```js
/* ─── Decryption state ────────────────────────────────────────── */
let lastEcbBytes = null;   // Uint8Array — ECB ciphertext
let lastGcmFull  = null;   // Uint8Array — GCM ciphertext WITH auth tag
let lastGcmIv    = null;   // Uint8Array(12) — GCM nonce used during encryption
```

Add a stub `doDecrypt` function (before the init block):

```js
async function doDecrypt() {
    // TODO: implement in Task 2
}
```

**Step 5: Update doEncrypt to store state and enable Decrypt button**

In `doEncrypt()`, the `encryptGCM` function currently discards the auth tag. We need to modify it to store the full ciphertext. Change the approach:

Replace the existing `encryptGCM` function entirely:

```js
async function encryptGCM(pixelData, passphrase, keySize) {
    const keyBytes = await deriveKeyBytes(passphrase, keySize);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const flat = new Uint8Array(pixelData.data.buffer);

    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, flat);
    const fullCiphertext = new Uint8Array(enc); // includes 16-byte auth tag at end

    // Store for decryption
    lastGcmFull = fullCiphertext;
    lastGcmIv = iv;

    // Return pixel-length slice for display
    return fullCiphertext.slice(0, flat.length);
}
```

In `doEncrypt()`, after the ECB encryption line `const ecbBytes = await encryptECB(origData, pass, keySize);`, add:

```js
lastEcbBytes = ecbBytes;
```

At the end of `doEncrypt()` (before re-enabling the encrypt button), add:

```js
document.getElementById('decryptBtn').disabled = false;
```

In `doReset()`, add:

```js
lastEcbBytes = null;
lastGcmFull = null;
lastGcmIv = null;
document.getElementById('decryptBtn').disabled = true;
```

**Step 6: Run tests to verify PASS**

```bash
npx playwright test --grep "Decrypt button"
```
Expected: 2 PASS

Also run full suite:
```bash
npx playwright test --grep "ECB Penguin Demo"
```
Expected: all PASS

**GREEN commit:**
```bash
git add index.html tests/ecb-penguin.test.js
git commit -m "feat: add decrypt button with state storage

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: ECB Decryption Function

**Files:**
- Modify: `index.html`
- Modify: `tests/ecb-penguin.test.js`

**Step 1: Write failing test**

Add inside `test.describe('ECB Penguin Demo', ...)`:

```js
test('Decrypt with correct key restores ECB canvas to original', async ({ page }) => {
    // Capture original pixels
    const origPixels = await canvasPixels(page, 'canvasOrig');

    await page.click('#encryptBtn');
    await page.waitForFunction(
        () => document.getElementById('statusBar').textContent.includes('Done'),
        { timeout: 60000 }
    );

    await page.click('#decryptBtn');
    await page.waitForFunction(
        () => document.getElementById('statusBar').textContent.includes('Decrypt'),
        { timeout: 60000 }
    );

    const ecbDecrypted = await canvasPixels(page, 'canvasECB');
    expect(ecbDecrypted).toEqual(origPixels);
});
```

**Step 2: Run to verify FAIL**

```bash
npx playwright test --grep "Decrypt with correct key restores ECB"
```

**RED commit:**
```bash
git add tests/ecb-penguin.test.js
git commit -m "test: add failing test for ECB decryption with correct key

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

**Step 3: Implement decryptECB and doDecrypt**

Add `decryptECB` function after `encryptGCM`:

```js
/* ─── AES-ECB decryption ──────────────────────────────────────── */
async function decryptECB(encBytes, passphrase, keySize) {
    const keyBytes = await deriveKeyBytes(passphrase, keySize);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']
    );

    const zeroIV = new Uint8Array(16);
    const promises = [];

    for (let i = 0; i < encBytes.length; i += 16) {
        // To decrypt single ECB block via CBC: we must provide a 32-byte input
        // (the 16-byte ciphertext block + 16-byte PKCS7 padding block)
        // But WebCrypto AES-CBC decrypt expects padded input.
        // Simpler: encrypt with the *same* key and check, or use the raw block approach.
        //
        // Actually: AES-CBC decrypt of a single block with zero IV = AES-ECB decrypt.
        // But WebCrypto expects PKCS7 padding on decrypt, which our ECB blocks don't have.
        // Workaround: use encrypt in reverse — decrypt by re-encrypting? No.
        //
        // Correct approach: Create a 2-block ciphertext where block[0] = zeroIV XOR'd
        // and block[1] = our target. This is complex.
        //
        // Simplest WebCrypto approach: import as 'raw' AES key, use SubtleCrypto
        // with AES-CBC and a crafted input.
        //
        // Actually the simplest: use AES-CBC decrypt with zero IV on (block + padding_block).
        // We need to append a valid PKCS7 padding block.
        // For AES-CBC with zero IV: decrypt(ct_block + padding_block) = plaintext_block
        // The padding block when encrypted with this key after the data block.
        //
        // Even simpler: just encrypt a zero block to get the "padding ciphertext",
        // then append that to each block before decrypting.

        // Workaround: For each 16-byte ciphertext block, we can recover plaintext
        // by: encrypt a 16-byte block of 0x10 (PKCS7 padding for 16 bytes) to get
        // the encrypted padding, then decrypt [ciphertext_block + encrypted_padding]
        // Actually this still doesn't work cleanly.

        // Best approach for WebCrypto: use raw AES key with a different API.
        // WebCrypto doesn't expose raw AES block operations.
        // 
        // PRACTICAL SOLUTION: Since we stored lastEcbBytes (the ciphertext) and we know
        // the original was encrypted with AES-CBC zero-IV per block, we can decrypt by:
        // For each block: create a 2-block input = [zero_block, ciphertext_block]
        // Decrypt with AES-CBC, zero IV → output block 1 = AES_decrypt(ciphertext_block) XOR zero_block
        //                                  output block 0 = AES_decrypt(zero_block) XOR IV
        // Wait, that's not right either.
        //
        // Let's think about this differently:
        // Encryption was: for each plaintext block P_i:
        //   C_i = first 16 bytes of AES-CBC-encrypt(key, zeroIV, P_i)
        //   AES-CBC with 1 block and zero IV: C_i = AES_encrypt(key, P_i XOR 0) = AES_encrypt(key, P_i)
        //   This is just ECB.
        //
        // Decryption: P_i = AES_decrypt(key, C_i)
        // With AES-CBC decrypt, zero IV, we need PKCS7-padded input.
        // Input = C_i (16 bytes). AES-CBC will try to decrypt and remove padding.
        // The decrypted block = AES_decrypt(key, C_i) XOR IV = AES_decrypt(key, C_i) XOR 0 = AES_decrypt(key, C_i)
        // = P_i (the original plaintext block)
        // The problem: WebCrypto will then check PKCS7 padding on P_i, which is random pixel data,
        // and will likely throw a padding error.
        //
        // SOLUTION: Use AES-CBC encrypt in the REVERSE direction.
        // To get AES_decrypt(key, C_i), we can't use WebCrypto's decrypt without padding.
        // BUT: we can use a mathematical trick.
        //
        // AES-CBC encrypt of 1 block with IV = C_i:
        //   output = AES_encrypt(key, plaintext XOR C_i)
        // If plaintext = 0: output = AES_encrypt(key, C_i)  ← not what we want
        //
        // REAL SOLUTION: Use AES-CTR mode for decryption.
        // AES-CTR encrypt = AES-CTR decrypt (symmetric).
        // CTR with counter = 0: keystream_block = AES_encrypt(key, 0)
        // ciphertext = plaintext XOR keystream_block
        // This is NOT the same as ECB.
        //
        // ACTUAL WORKING SOLUTION:
        // WebCrypto AES-CBC decrypt DOES work if we handle padding correctly.
        // We encrypted each block as: encrypt(key, zeroIV, P_i) → 32 bytes (16 bytes cipher + 16 bytes padding)
        // To decrypt, we need those same 32 bytes as input to decrypt().
        // But we only stored the first 16 bytes (the actual ciphertext).
        // 
        // We need to reconstruct the padding block.
        // The padding block when encrypting 16 bytes with PKCS7 = 16 bytes of 0x10.
        // AES-CBC encrypt of [P_i] (16 bytes) with zero IV:
        //   Block 0: C_0 = AES_encrypt(key, P_i XOR 0) = AES_encrypt(key, P_i)
        //   Block 1 (padding): C_1 = AES_encrypt(key, [0x10]*16 XOR C_0)
        // So C_1 depends on C_0, which is what we stored.
        //
        // To decrypt: we need [C_0, C_1] where C_1 = AES_encrypt(key, [0x10]*16 XOR C_0)
        // We CAN compute C_1! We have the key and C_0.
        //
        // Step 1: Compute padding_plain = XOR([0x10]*16, C_i)
        // Step 2: C_1 = AES-ECB-encrypt(key, padding_plain) = first 16 bytes of AES-CBC-encrypt(key, C_i as IV, [0x10]*16)
        //   Actually simpler: C_1 = AES-CBC-encrypt with IV=C_i on the padding block [0x10]*16
        //   = first 16 bytes of encrypt({name:'AES-CBC', iv: C_i}, key, [0x10]*16)
        //
        // This is getting complex. Let me use the simplest correct approach:

        const block = encBytes.slice(i, i + 16);
        
        // Compute the encrypted padding block (C_1)
        const paddingPlain = new Uint8Array(16).fill(16); // PKCS7 padding for empty
        const encPadding = await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv: block }, // Use ciphertext block as IV
            cryptoKey,
            paddingPlain
        );
        
        // Now create the full 32-byte ciphertext: [block, encPadding_first_16]
        const fullBlock = new Uint8Array(32);
        fullBlock.set(block, 0);
        fullBlock.set(new Uint8Array(encPadding).slice(0, 16), 16);
        
        promises.push(
            crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: zeroIV },
                cryptoKey,
                fullBlock
            )
        );
    }

    const results = await Promise.all(promises);
    const out = new Uint8Array(encBytes.length);
    results.forEach((dec, idx) => {
        out.set(new Uint8Array(dec).slice(0, 16), idx * 16);
    });

    return out;
}
```

WAIT — that's way too complex. Let me simplify.

**Much simpler approach**: Since `AES-CBC encrypt(key, zeroIV, singleBlock)` = `AES-ECB encrypt(key, block)`, we can just **re-encrypt with the same key and compare**. But that's not decryption.

**SIMPLEST CORRECT APPROACH**: Use `AES-CTR` mode. AES-CTR with a fixed counter = XOR with a fixed keystream. This isn't ECB either.

**ACTUALLY SIMPLEST**: We don't need WebCrypto `decrypt()` at all. For ECB, if you have the key, just re-derive the mapping. Since ECB is deterministic: `encrypt(key, block) = ciphertext`, we can build a reverse lookup. But with 2^128 possible blocks this is infeasible.

**THE REAL SIMPLEST APPROACH**: Store the original pixel data during encryption. ECB decryption with the correct key = return stored original. ECB decryption with wrong key = re-encrypt the ciphertext with the wrong key (producing double-encrypted garbage). Wait, that's not decryption either.

OK — the truly correct and simple approach for WebCrypto ECB decryption:

```js
async function decryptECB(encBytes, passphrase, keySize) {
    const keyBytes = await deriveKeyBytes(passphrase, keySize);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']
    );

    const zeroIV = new Uint8Array(16);
    const out = new Uint8Array(encBytes.length);

    for (let i = 0; i < encBytes.length; i += 16) {
        const block = encBytes.slice(i, i + 16);

        // To decrypt a single ECB block via AES-CBC:
        // We need to feed WebCrypto a properly padded ciphertext.
        // Encrypt the PKCS7 padding block (16 bytes of 0x10) using the ciphertext
        // block as the IV — this produces the second ciphertext block that WebCrypto
        // expects for proper padding.
        const pad = new Uint8Array(16).fill(16);
        const encPad = await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv: block },
            cryptoKey,
            pad
        );
        const ct = new Uint8Array(32);
        ct.set(block, 0);
        ct.set(new Uint8Array(encPad).slice(0, 16), 16);

        const dec = await crypto.subtle.decrypt(
            { name: 'AES-CBC', iv: zeroIV },
            cryptoKey,
            ct
        );
        out.set(new Uint8Array(dec).slice(0, 16), i);
    }

    return out;
}
```

Hmm, this is sequential and slow for 16,384 blocks. Let's batch the padding computation. Actually, let me use a completely different approach that's both simple AND fast:

**FASTEST APPROACH**: Use AES-CTR mode as a raw AES block cipher. Not correct for ECB semantics.

**FINAL APPROACH — parallel, correct**:

```js
async function decryptECB(encBytes, passphrase, keySize) {
    const keyBytes = await deriveKeyBytes(passphrase, keySize);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']
    );

    const zeroIV = new Uint8Array(16);
    const pad16 = new Uint8Array(16).fill(16);
    const promises = [];

    for (let i = 0; i < encBytes.length; i += 16) {
        const block = encBytes.slice(i, i + 16);
        promises.push(
            crypto.subtle.encrypt({ name: 'AES-CBC', iv: block }, cryptoKey, pad16)
                .then(encPad => {
                    const ct = new Uint8Array(32);
                    ct.set(block, 0);
                    ct.set(new Uint8Array(encPad).slice(0, 16), 16);
                    return crypto.subtle.decrypt({ name: 'AES-CBC', iv: zeroIV }, cryptoKey, ct);
                })
        );
    }

    const results = await Promise.all(promises);
    const out = new Uint8Array(encBytes.length);
    results.forEach((dec, idx) => out.set(new Uint8Array(dec).slice(0, 16), idx * 16));
    return out;
}
```

Replace the stub `doDecrypt` with:

```js
async function doDecrypt() {
    if (!lastEcbBytes) return;
    const pass = sanitizeKey(document.getElementById('keyInput').value);
    const keySize = parseInt(document.getElementById('keySize').value);
    const btn = document.getElementById('decryptBtn');

    btn.disabled = true;
    btn.textContent = '…';
    setStatus('Decrypting ECB…');

    try {
        // ECB decryption — always "succeeds" (no authentication)
        const ecbDec = await decryptECB(lastEcbBytes, pass, keySize);
        renderBytes(document.getElementById('canvasECB'), ecbDec);

        // Check if it matches original
        const origCtx = document.getElementById('canvasOrig').getContext('2d');
        const origData = new Uint8Array(origCtx.getImageData(0, 0, W, H).data.buffer);
        const ecbMatch = ecbDec.every((b, i) => b === origData[i]);

        if (ecbMatch) {
            document.getElementById('ecbFoot').innerHTML =
                '<span style="color:var(--success)">Decrypted — matches original! Correct key reverses ECB.</span>';
        } else {
            document.getElementById('ecbFoot').innerHTML =
                '<strong style="color:var(--danger)">Wrong key — ECB decrypted to garbage. No error, no warning. Silent failure.</strong>';
        }

        // GCM decryption — fails with wrong key (authentication)
        setStatus('Decrypting GCM…');
        try {
            const gcmDec = await decryptGCM(lastGcmFull, pass, keySize, lastGcmIv);
            renderBytes(document.getElementById('canvasGCM'), gcmDec);
            document.getElementById('gcmFoot').innerHTML =
                '<span style="color:var(--success)">Decrypted — matches original! GCM verified authenticity.</span>';
            // Remove auth failure overlay if present
            const overlay = document.getElementById('gcmAuthOverlay');
            if (overlay) overlay.style.display = 'none';
        } catch (e) {
            // GCM auth failure — wrong key or tampered ciphertext
            const ctx = document.getElementById('canvasGCM').getContext('2d');
            ctx.clearRect(0, 0, W, H);
            // Show auth failure overlay
            document.getElementById('gcmAuthOverlay').style.display = 'flex';
            document.getElementById('gcmFoot').innerHTML =
                '<strong style="color:var(--danger)">GCM refused to decrypt — authentication tag mismatch. Tampering or wrong key detected!</strong>';
        }

        setStatus('Decryption complete — compare ECB (silent failure) vs GCM (loud failure) with wrong key.');
    } catch (e) {
        setStatus('Error: ' + e.message);
    }

    btn.disabled = false;
    btn.textContent = 'Decrypt';
}
```

**Step 4: Run test to verify PASS**

```bash
npx playwright test --grep "Decrypt with correct key restores ECB"
```
Expected: PASS

**GREEN commit:**
```bash
git add index.html tests/ecb-penguin.test.js
git commit -m "feat: implement ECB decryption with correct/wrong key handling

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: GCM Decryption + Auth Failure Overlay

**Files:**
- Modify: `index.html`
- Modify: `tests/ecb-penguin.test.js`

**Step 1: Write failing tests**

Add inside `test.describe('ECB Penguin Demo', ...)`:

```js
test('Decrypt with correct key restores GCM canvas to original', async ({ page }) => {
    const origPixels = await canvasPixels(page, 'canvasOrig');

    await page.click('#encryptBtn');
    await page.waitForFunction(
        () => document.getElementById('statusBar').textContent.includes('Done'),
        { timeout: 60000 }
    );

    await page.click('#decryptBtn');
    await page.waitForFunction(
        () => document.getElementById('statusBar').textContent.includes('Decryption complete'),
        { timeout: 60000 }
    );

    const gcmDecrypted = await canvasPixels(page, 'canvasGCM');
    expect(gcmDecrypted).toEqual(origPixels);
});

test('Decrypt with wrong key shows GCM auth failure overlay', async ({ page }) => {
    await page.click('#encryptBtn');
    await page.waitForFunction(
        () => document.getElementById('statusBar').textContent.includes('Done'),
        { timeout: 60000 }
    );

    // Change the passphrase to a wrong key
    await page.fill('#keyInput', 'WrongKeyEntirely');

    await page.click('#decryptBtn');
    await page.waitForFunction(
        () => document.getElementById('statusBar').textContent.includes('Decryption complete'),
        { timeout: 60000 }
    );

    // GCM auth overlay should be visible
    await expect(page.locator('#gcmAuthOverlay')).toBeVisible();
});
```

**Step 2: Run to verify FAIL**

```bash
npx playwright test --grep "Decrypt with correct key restores GCM|wrong key shows GCM"
```

**RED commit:**
```bash
git add tests/ecb-penguin.test.js
git commit -m "test: add failing tests for GCM decryption and auth failure

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

**Step 3: Add GCM auth failure overlay HTML**

Inside the GCM panel (the third `.panel` div), add after the `<canvas>` and before the `.panel-foot`:

```html
<div id="gcmAuthOverlay" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(248,81,73,0.85);display:none;flex-direction:column;align-items:center;justify-content:center;z-index:2;">
    <div style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:0.3rem;">AUTHENTICATION FAILED</div>
    <div style="font-size:0.7rem;color:#ffcdd2;">Wrong key or tampered ciphertext</div>
</div>
```

Make the GCM panel `position: relative` so the overlay positions correctly. Add to the CSS:

```css
.panel { position: relative; }
```

**Step 4: Implement decryptGCM function**

Add after `decryptECB`:

```js
/* ─── AES-GCM decryption ──────────────────────────────────────── */
async function decryptGCM(fullCiphertext, passphrase, keySize, iv) {
    const keyBytes = await deriveKeyBytes(passphrase, keySize);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']
    );

    // This will throw OperationError if key is wrong (auth tag mismatch)
    const dec = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        fullCiphertext
    );
    return new Uint8Array(dec);
}
```

Note: `doDecrypt()` (from Task 2) already calls this and handles the error. The GCM auth overlay and footer messages are already wired up in `doDecrypt()`.

**Step 5: Update doReset to hide overlay**

In `doReset()`, add:

```js
const overlay = document.getElementById('gcmAuthOverlay');
if (overlay) overlay.style.display = 'none';
```

**Step 6: Run tests to verify PASS**

```bash
npx playwright test --grep "Decrypt with correct key restores GCM|wrong key shows GCM"
```
Expected: 2 PASS

Full suite:
```bash
npx playwright test --grep "ECB Penguin Demo"
```
Expected: all PASS

**GREEN commit:**
```bash
git add index.html tests/ecb-penguin.test.js
git commit -m "feat: implement GCM decryption with auth failure overlay

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Real-World Impact Educational Panel

**Files:**
- Modify: `index.html`
- Modify: `tests/ecb-penguin.test.js`

**Step 1: Write failing tests**

Add inside the existing `test.describe('Educational Panels', ...)`:

```js
test('Real-world impact panel is visible', async ({ page }) => {
    await expect(page.locator('#realWorldImpact')).toBeVisible();
});

test('Timeline nodes are clickable and expand details', async ({ page }) => {
    const firstNode = page.locator('.tl-node').first();
    await firstNode.click();
    const detail = page.locator('.tl-detail.tl-open');
    await expect(detail).toHaveCount(1);
});

test('Clicking different timeline node switches expanded detail', async ({ page }) => {
    const nodes = page.locator('.tl-node');
    await nodes.nth(0).click();
    await expect(page.locator('.tl-detail.tl-open')).toHaveCount(1);
    
    await nodes.nth(2).click();
    await expect(page.locator('.tl-detail.tl-open')).toHaveCount(1);
    // First should be closed, third open
    const openId = await page.locator('.tl-detail.tl-open').getAttribute('id');
    expect(openId).toContain('2'); // 0-indexed, third node = tl2
});
```

**Step 2: Run to verify FAIL**

```bash
npx playwright test --grep "Real-world impact|Timeline nodes"
```

**RED commit:**
```bash
git add tests/ecb-penguin.test.js
git commit -m "test: add failing tests for real-world impact panel

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

**Step 3: Add HTML for timeline panel**

Insert after the `#ecbVsGcm` panel closing `</div>`, before `#statsBox`:

```html
<!-- ── Panel 4: Real-World Impact ── -->
<div class="edu-panel" id="realWorldImpact">
    <div class="edu-panel-title">Real-World Impact — Why This Matters</div>
    <div class="edu-panel-body">
        <p class="edu-desc">The encryption mode your product uses determines its security grade. Here's how the industry evolved from broken to battle-tested.</p>

        <div class="tl-track">
            <div class="tl-line"></div>

            <div class="tl-node tl-node-danger" onclick="tlToggle(0)" id="tlNode0">
                <div class="tl-dot"></div>
                <div class="tl-label">ECB</div>
                <div class="tl-year">1970s</div>
            </div>

            <div class="tl-node tl-node-warn" onclick="tlToggle(1)" id="tlNode1">
                <div class="tl-dot"></div>
                <div class="tl-label">CBC</div>
                <div class="tl-year">1996</div>
            </div>

            <div class="tl-node tl-node-attack" onclick="tlToggle(2)" id="tlNode2">
                <div class="tl-dot"></div>
                <div class="tl-label">Attacks</div>
                <div class="tl-year">2011–2019</div>
            </div>

            <div class="tl-node tl-node-safe" onclick="tlToggle(3)" id="tlNode3">
                <div class="tl-dot"></div>
                <div class="tl-label">GCM</div>
                <div class="tl-year">2008+</div>
            </div>
        </div>

        <!-- Expandable detail panels -->
        <div class="tl-detail" id="tlDetail0">
            <h4>ECB — Never Used in Any Internet Protocol</h4>
            <p>ECB is so fundamentally broken that <strong>no version of SSL or TLS has ever used it</strong>. The protocol designers skipped it entirely. Qualys SSL Labs doesn't even test for ECB — there's nothing to test.</p>
            <p><strong>NIST IR 8459 (2024)</strong> proposes formally retiring ECB as a confidentiality mode. <strong>OWASP</strong> states plainly: "ECB should not be used."</p>
            <p class="tl-takeaway">If a product encrypts data with ECB mode, it has a fundamental design flaw — not a configuration issue.</p>
        </div>

        <div class="tl-detail" id="tlDetail1">
            <h4>CBC — Better, But Vulnerable to Padding Attacks</h4>
            <p>CBC mode chains blocks together, hiding patterns that ECB leaks. But it introduced a new weakness: <strong>padding verification</strong>.</p>
            <p>After decryption, the receiver checks if the PKCS#7 padding is valid — the last N bytes should all equal N. If the server responds differently to "bad padding" vs "bad data" — even through <strong>timing differences as small as microseconds</strong> — an attacker can flip ciphertext bits and observe the response to <strong>deduce the plaintext byte by byte</strong>, without ever knowing the key.</p>
            <p>Think of it like a lock that says "almost right" when you guess wrong — an attacker uses those hints to find the combination.</p>
            <p class="tl-takeaway">Products using TLS 1.0–1.2 with CBC cipher suites should be assessed for padding oracle mitigations.</p>
        </div>

        <div class="tl-detail" id="tlDetail2">
            <h4>The Kill Chain: Four Attacks That Ended CBC</h4>
            <div class="tl-attacks">
                <div class="tl-attack">
                    <span class="tl-attack-year">2011</span>
                    <span class="tl-attack-name">BEAST</span>
                    <span class="tl-attack-desc">Exploited predictable IVs in TLS 1.0 CBC to decrypt HTTPS cookies in real time.</span>
                </div>
                <div class="tl-attack">
                    <span class="tl-attack-year">2013</span>
                    <span class="tl-attack-name">Lucky13</span>
                    <span class="tl-attack-desc">Used microsecond timing differences in padding verification to extract plaintext — affected every TLS library.</span>
                </div>
                <div class="tl-attack">
                    <span class="tl-attack-year">2014</span>
                    <span class="tl-attack-name">POODLE</span>
                    <span class="tl-attack-desc">Forced a downgrade to SSL 3.0 and exploited its broken CBC padding to steal session tokens.</span>
                </div>
                <div class="tl-attack">
                    <span class="tl-attack-year">2019</span>
                    <span class="tl-attack-name">GoldenDoodle</span>
                    <span class="tl-attack-desc">Found padding oracle vulnerabilities in modern TLS stacks years after they were supposedly fixed.</span>
                </div>
            </div>
            <p class="tl-takeaway">Each attack proved CBC's padding verification is an inherent liability — patching one variant doesn't prevent the next.</p>
        </div>

        <div class="tl-detail" id="tlDetail3">
            <h4>GCM — The Modern Standard</h4>
            <p><strong>TLS 1.3 (2018) eliminated CBC entirely</strong>, requiring only AEAD modes: GCM and ChaCha20-Poly1305. Authentication and encryption are inseparable — there is no padding to attack.</p>
            <p><strong>Qualys SSL Labs</strong> requires GCM/AEAD cipher suites for an A+ grade. Without them, your grade is capped. Without TLS 1.3, you're capped at A-.</p>
            <p>GCM doesn't just keep secrets — it detects if anyone tampered with the data. The authentication tag is a cryptographic proof of integrity that fails loudly on any modification.</p>
            <p class="tl-takeaway">When evaluating products, verify they support TLS 1.3 with GCM cipher suites. Check with <a href="https://www.ssllabs.com/ssltest/" target="_blank" rel="noopener" style="color:var(--accent)">ssllabs.com/ssltest</a>.</p>
        </div>
    </div>
</div>
```

**Step 4: Add CSS for timeline**

Add inside `<style>`:

```css
/* ── Timeline (Panel 4) ── */
.tl-track {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    position: relative;
    padding: 0.5rem 0 1.5rem;
    margin-bottom: 0.5rem;
}

.tl-line {
    position: absolute;
    top: 18px;
    left: 5%;
    right: 5%;
    height: 3px;
    background: linear-gradient(to right, var(--danger), var(--warning), #e3b341, var(--success));
    border-radius: 2px;
    z-index: 0;
}

.tl-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    z-index: 1;
    gap: 0.3rem;
    transition: transform 0.15s;
}

.tl-node:hover { transform: scale(1.1); }

.tl-dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 3px solid var(--bg);
    transition: box-shadow 0.2s;
}

.tl-node-danger .tl-dot { background: var(--danger); }
.tl-node-warn .tl-dot   { background: var(--warning); }
.tl-node-attack .tl-dot  { background: #e3b341; }
.tl-node-safe .tl-dot    { background: var(--success); }

.tl-node.tl-active .tl-dot {
    box-shadow: 0 0 0 4px var(--bg), 0 0 0 6px currentColor;
}
.tl-node-danger.tl-active { color: var(--danger); }
.tl-node-warn.tl-active   { color: var(--warning); }
.tl-node-attack.tl-active  { color: #e3b341; }
.tl-node-safe.tl-active    { color: var(--success); }

.tl-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text);
}

.tl-year {
    font-size: 0.58rem;
    color: var(--muted);
}

.tl-detail {
    display: none;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    font-size: 0.82rem;
    line-height: 1.6;
    color: var(--text);
    margin-bottom: 0.5rem;
}

.tl-detail.tl-open { display: block; }

.tl-detail h4 {
    font-size: 0.85rem;
    margin-bottom: 0.6rem;
}

.tl-detail p { margin-bottom: 0.6rem; }
.tl-detail p:last-child { margin-bottom: 0; }

.tl-takeaway {
    background: var(--surface2);
    border-left: 3px solid var(--accent);
    padding: 0.5rem 0.75rem;
    border-radius: 0 6px 6px 0;
    font-size: 0.78rem;
    color: var(--accent);
}

.tl-attacks {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0.75rem 0;
}

.tl-attack {
    display: grid;
    grid-template-columns: 3.5rem 6.5rem 1fr;
    gap: 0.4rem;
    align-items: baseline;
    font-size: 0.78rem;
}

.tl-attack-year {
    color: var(--danger);
    font-weight: 700;
    font-size: 0.72rem;
}

.tl-attack-name {
    font-weight: 700;
    color: var(--warning);
}

.tl-attack-desc {
    color: var(--muted);
}
```

**Step 5: Add JS for timeline accordion**

```js
/* ─── Panel 4: Real-World Impact Timeline ─────────────────────── */
function tlToggle(idx) {
    const wasOpen = document.getElementById('tlDetail' + idx).classList.contains('tl-open');

    // Close all
    for (let i = 0; i < 4; i++) {
        document.getElementById('tlDetail' + i).classList.remove('tl-open');
        document.getElementById('tlNode' + i).classList.remove('tl-active');
    }

    // Open clicked (if it wasn't already open)
    if (!wasOpen) {
        document.getElementById('tlDetail' + idx).classList.add('tl-open');
        document.getElementById('tlNode' + idx).classList.add('tl-active');
    }
}
```

**Step 6: Run tests to verify PASS**

```bash
npx playwright test --grep "Real-world impact|Timeline nodes"
```
Expected: 3 PASS

Full suite:
```bash
npx playwright test
```
Expected: all PASS (except the 3 Netlify header tests)

**GREEN commit:**
```bash
git add index.html tests/ecb-penguin.test.js
git commit -m "feat: add real-world impact panel with interactive CBC/GCM timeline

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Final Checklist

- [ ] Decrypt button visible, disabled before encryption, enabled after
- [ ] ECB decryption with correct key restores original image
- [ ] ECB decryption with wrong key shows garbage (no error — silent failure)
- [ ] GCM decryption with correct key restores original image
- [ ] GCM decryption with wrong key shows AUTH FAILED overlay
- [ ] doReset clears decrypt state and hides overlay
- [ ] Timeline panel visible with 4 clickable nodes
- [ ] Accordion: only one detail open at a time
- [ ] Content covers: ECB (never used in TLS), CBC (padding oracle), Attacks (BEAST→GoldenDoodle), GCM (A+ grade)
- [ ] All original tests still pass
- [ ] All new tests pass
