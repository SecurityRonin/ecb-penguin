# ECB Penguin — Interactive AES Encryption Demo

[![Netlify Status](https://api.netlify.com/api/v1/badges/cce51f22-2894-4e64-8d11-c24e7f70357d/deploy-status)](https://app.netlify.com/sites/ecb-penguin/deploys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/Sponsor-♥-ea4aaa?logo=github)](https://github.com/sponsors/h4x0r)

**See why Electronic Codebook (ECB) mode is broken — by encrypting the Linux Tux penguin with AES-ECB vs AES-GCM, live in your browser.**

[**Live Demo →**](https://ecb-penguin.securityronin.com)

---

## What Is This?

The ECB Penguin is one of cryptography's most famous visual demonstrations. When you encrypt an image using AES in ECB mode, the outline of the original image remains visible in the ciphertext — because identical plaintext blocks always produce identical ciphertext blocks. Flat-colored regions (sky, body, belly) encrypt to repeating patterns that preserve the spatial structure.

This interactive demo lets you **see it happen in real time**, then explore *why* it happens and what the industry does about it.

## Features

### Encrypt & Decrypt
- Encrypt Tux with **AES-ECB** (insecure) and **AES-GCM** (secure) side by side
- Decrypt with the correct key — both modes reverse perfectly
- Decrypt with the **wrong key** — ECB silently produces garbage (no error), GCM refuses entirely (authentication tag mismatch)
- Upload your own image to see how ECB leaks its structure

### Interactive Educational Panels

- **Block Anatomy** — hover to inspect the 4 RGBA bytes that make up each pixel in a 16-byte AES block
- **Key Derivation** — step through passphrase → TextEncoder (ASCII) → SHA-256 → slice → AES key
- **ECB vs GCM Data Flow** — animated side-by-side showing why identical blocks produce identical (ECB) or unique (GCM) ciphertext, with colored block grids
- **Bit Flip Attack** — click a pixel on the ECB ciphertext to flip a block, then watch: ECB corrupts only that block (the rest decrypts fine), GCM detects the tampering and refuses to decrypt at all
- **Block Heatmap** — toggle an overlay on the ECB canvas showing duplicate blocks in matching colors
- **Real-World Impact Timeline** — ECB (never used in TLS) → CBC (padding oracle attacks: BEAST, Lucky13, POODLE, GoldenDoodle) → GCM (required for Qualys SSL Labs A+ grade, mandatory in TLS 1.3)

### Security Hardened
- Content Security Policy, X-Frame-Options, X-Content-Type-Options via Netlify `_headers`
- Input sanitization (control character stripping)
- No external dependencies — zero JavaScript libraries, pure WebCrypto API

## Tech Stack

- **Frontend:** Single `index.html` — vanilla HTML/CSS/JS, no build step, no frameworks
- **Crypto:** [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) (AES-CBC for ECB simulation, AES-GCM)
- **Testing:** [Playwright](https://playwright.dev/) (29 end-to-end tests)
- **Hosting:** [Netlify](https://www.netlify.com/) (static deploy from `web/` directory)

## Run Locally

```bash
git clone https://github.com/SecurityRonin/ecb-penguin.git
cd ecb-penguin
npm install
npx playwright test
# Open web/index.html in a browser, or:
python3 -m http.server 3007 --directory web
# Visit http://localhost:3007
```

## Attribution

The ECB Penguin visual proof originated in a cryptography presentation (original presenter unknown) and was [recreated for Wikipedia](https://en.wikipedia.org/wiki/File:Tux_ecb.jpg) by user Lunkwill in January 2004. It was later [investigated and enhanced](https://words.filippo.io/the-ecb-penguin/) by Filippo Valsorda in 2013.

Tux the penguin was created by Larry Ewing using GIMP.

## License

[MIT License](https://opensource.org/licenses/MIT) — free to use, modify, and distribute.

Copyright (c) 2026 Albert Hui <albert@securityronin.com>

## Author

**Albert Hui** (法證黑客) — [Security Ronin](https://www.securityronin.com) · [linktr.ee/4n6h4x0r](https://linktr.ee/4n6h4x0r)
