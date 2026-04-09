# Design: Decryption Feature + Real-World Impact Educational Panel

**Date:** 2026-04-08
**Project:** ECB Penguin (`index.html`, Netlify)

---

## 1. Decrypt Button & Flow

### UI Placement
- New **Decrypt** button (secondary style) in the existing button row, between Encrypt and Reset
- Disabled on page load; enabled only after encryption has been performed
- Disabled again after reset

### Correct-Key Decryption
- User clicks Decrypt with same passphrase used for encryption
- ECB canvas reverts to original Tux image
- GCM canvas reverts to original Tux image
- Status: "Decrypted — identical to original. Encryption is reversible with the correct key."
- Panel footers update to confirm successful decryption

### Wrong-Key Decryption
- User manually changes the passphrase, clicks Decrypt
- **ECB**: Produces garbage — different scrambled pixels (not the original, not the ciphertext). ECB silently "decrypts" to wrong data with no error. Footer: "Wrong key — ECB decrypts silently to garbage. No way to detect the error."
- **GCM**: WebCrypto throws `OperationError` (auth tag mismatch). Canvas shows nothing / error state. Footer: "Wrong key — GCM refused to decrypt. The authentication tag detected tampering or wrong key."
- Status bar explains the difference between ECB (silent failure) and GCM (loud failure)

### Stored State for Decryption
Since the canvas only stores pixel-length bytes (no auth tag), we must store:
- `lastEcbBytes` — Uint8Array of ECB ciphertext (from canvas or direct)
- `lastGcmFull` — full GCM ciphertext INCLUDING the 16-byte auth tag
- `lastGcmIv` — the 12-byte random nonce used during GCM encryption
- `lastKeySize` — the key size used during encryption (for display)

These are stored as module-level JS variables, set during `doEncrypt()`, cleared during `doReset()`.

---

## 2. Decryption Functions

### decryptECB(encBytes, passphrase, keySize)
- Derive key via `deriveKeyBytes(passphrase, keySize)`
- Import as AES-CBC
- For each 16-byte block: decrypt with zero IV (mirrors the encryption trick)
- WebCrypto `decrypt()` with AES-CBC on single blocks = ECB decryption
- Returns Uint8Array of decrypted bytes
- **Never fails** — any key produces output (this is ECB's weakness: no authentication)

### decryptGCM(fullCiphertext, passphrase, keySize, iv)
- Derive key via `deriveKeyBytes(passphrase, keySize)`
- Import as AES-GCM
- Decrypt full ciphertext (which includes auth tag) with stored IV
- On success: returns Uint8Array of decrypted bytes
- **On wrong key**: `crypto.subtle.decrypt()` throws `OperationError` — catch it and return null
- The caller renders an error state on the GCM canvas

---

## 3. doDecrypt() Orchestration

```
1. Read current passphrase from #keyInput (may differ from encryption passphrase)
2. Read keySize from #keySize
3. Disable Decrypt button, set status "Decrypting..."
4. Decrypt ECB: decryptECB(lastEcbBytes, pass, keySize) → always succeeds
5. Render ECB result on canvasECB via renderBytes()
6. Decrypt GCM: decryptGCM(lastGcmFull, pass, keySize, lastGcmIv)
   - If success → render on canvasGCM
   - If OperationError → render error state (red border, "AUTH FAILED" overlay)
7. Update footers with educational messages
8. Update status bar
9. Re-enable Decrypt button
```

---

## 4. Educational Panel: Real-World Impact

### Placement
After the existing ECB vs GCM Data Flow panel (#ecbVsGcm), before #statsBox.

### Content Structure — Interactive Timeline

Title: **"Real-World Impact — Why This Matters"**

A horizontal timeline with 4 clickable nodes:

**Node 1: ECB (1970s–present)**
- "So insecure it was never used in any internet security protocol"
- TLS/SSL skipped ECB entirely from day one
- NIST IR 8459 (2024) proposes formal retirement for confidentiality
- OWASP: "ECB should not be used"

**Node 2: CBC (SSL 3.0, 1996 → TLS 1.2)**
- Replaced ECB but introduced a new attack surface: padding verification
- Padding oracle attacks exploit timing differences in padding validation
- Attacker flips ciphertext bits, observes server response → decrypts byte-by-byte without the key
- Plain English: "Imagine a lock that tells you 'almost right' when you guess wrong — an attacker can use those hints to find the combination"

**Node 3: The Attacks (2011–2019)**
- BEAST (2011): Exploited predictable IVs in TLS 1.0 CBC
- Lucky13 (2013): Timing side-channel in CBC padding verification
- POODLE (2014): Forced downgrade to SSL 3.0 CBC, exploited padding
- GoldenDoodle (2019): Padding oracle in modern TLS stacks
- Each attack: 1-sentence plain English explanation + year

**Node 4: GCM / AEAD (TLS 1.2+, mandatory TLS 1.3)**
- Authentication and encryption are inseparable — no padding to attack
- Qualys SSL Labs requires GCM/AEAD for A+ grade
- TLS 1.3 (2018) eliminated CBC entirely
- "The lock doesn't just keep secrets — it also detects if anyone tampered with it"

### Interaction
- Click a timeline node → expands its detail panel below
- Only one node expanded at a time (accordion)
- Subtle animation: node glows when active

### Visual Style
- Matches existing dark theme
- Timeline line with colored dots: red (ECB), orange (CBC), yellow (attacks), green (GCM)
- Uses existing CSS variables

---

## 5. GCM Auth Failure Visual

When GCM decryption fails (wrong key):
- Canvas gets a semi-transparent red overlay
- Text overlay: "AUTHENTICATION FAILED"
- Subtitle: "GCM detected wrong key or tampered data"
- CSS: absolutely positioned over the canvas, red background with 0.85 opacity

---

## 6. File Changes

| File | Change |
|------|--------|
| `index.html` | Add Decrypt button, decryptECB/decryptGCM functions, doDecrypt orchestrator, stored state variables, educational panel #4, GCM auth failure overlay, CSS for timeline |
| `tests/ecb-penguin.test.js` | Tests for decrypt with correct key, decrypt with wrong key (ECB garbage, GCM failure), educational panel visibility, timeline interaction |
