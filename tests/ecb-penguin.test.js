import { test, expect } from '@playwright/test';

// Helper: read all pixel data from a canvas by id
async function canvasPixels(page, id) {
    return page.evaluate((canvasId) => {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    }, id);
}

// Helper: true if any RGB pixel is non-zero (ignores alpha channel)
function hasVisibleColor(pixels) {
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 0 || pixels[i + 1] > 0 || pixels[i + 2] > 0) return true;
    }
    return false;
}

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
        const csp = res.headers()['content-security-policy'];
        expect(csp).toBeTruthy();
        expect(csp).toContain("default-src 'none'");
        expect(csp).toContain("frame-ancestors 'none'");
    });
});

test.describe('ECB Penguin Demo', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait until original canvas has visible content (Tux loaded/drawn)
        await page.waitForFunction(() => {
            const c = document.getElementById('canvasOrig');
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i] > 0 || d[i + 1] > 0 || d[i + 2] > 0) return true;
            }
            return false;
        }, { timeout: 20000 });
    });

    test('ECB canvas shows non-black output after encryption', async ({ page }) => {
        await page.click('#encryptBtn');
        await page.waitForFunction(
            () => document.getElementById('statusBar').textContent.includes('Done'),
            { timeout: 60000 }
        );

        const pixels = await canvasPixels(page, 'canvasECB');
        expect(hasVisibleColor(pixels)).toBe(true);
    });

    test('GCM canvas shows non-black output after encryption', async ({ page }) => {
        await page.click('#encryptBtn');
        await page.waitForFunction(
            () => document.getElementById('statusBar').textContent.includes('Done'),
            { timeout: 60000 }
        );

        const pixels = await canvasPixels(page, 'canvasGCM');
        expect(hasVisibleColor(pixels)).toBe(true);
    });

    test('ECB and GCM produce different outputs', async ({ page }) => {
        await page.click('#encryptBtn');
        await page.waitForFunction(
            () => document.getElementById('statusBar').textContent.includes('Done'),
            { timeout: 60000 }
        );

        const ecbPixels = await canvasPixels(page, 'canvasECB');
        const gcmPixels = await canvasPixels(page, 'canvasGCM');
        expect(ecbPixels).not.toEqual(gcmPixels);
    });

    test('ECB output is distinct from the original image', async ({ page }) => {
        const origBefore = await canvasPixels(page, 'canvasOrig');

        await page.click('#encryptBtn');
        await page.waitForFunction(
            () => document.getElementById('statusBar').textContent.includes('Done'),
            { timeout: 60000 }
        );

        const ecbPixels = await canvasPixels(page, 'canvasECB');
        expect(ecbPixels).not.toEqual(origBefore);
    });

    test('Reset clears ECB and GCM canvases', async ({ page }) => {
        await page.click('#encryptBtn');
        await page.waitForFunction(
            () => document.getElementById('statusBar').textContent.includes('Done'),
            { timeout: 60000 }
        );

        await page.click('button:has-text("Reset")');

        const ecbPixels = await canvasPixels(page, 'canvasECB');
        const gcmPixels = await canvasPixels(page, 'canvasGCM');
        expect(hasVisibleColor(ecbPixels)).toBe(false);
        expect(hasVisibleColor(gcmPixels)).toBe(false);
    });

    test('Logo link points to securityronin.com', async ({ page }) => {
        const logoLink = page.locator('a[href*="securityronin.com"]');
        await expect(logoLink).toBeVisible();
        const img = logoLink.locator('img');
        await expect(img).toBeVisible();
    });

    test('sanitizeKey strips control characters', async ({ page }) => {
        const result = await page.evaluate(() => {
            // Call the sanitizeKey function directly with control chars
            return sanitizeKey('MyKey\x01\x02\x03Hello');
        });
        expect(result).toBe('MyKeyHello');
    });

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

    test('Duplicate block stats box appears after encryption', async ({ page }) => {
        await page.click('#encryptBtn');
        await page.waitForFunction(
            () => document.getElementById('statusBar').textContent.includes('Done'),
            { timeout: 60000 }
        );

        const statsVisible = await page.isVisible('#statsBox');
        expect(statsVisible).toBe(true);

        const dupes = await page.textContent('#sDupes');
        expect(parseInt(dupes.replace(/,/g, ''), 10)).toBeGreaterThan(0);
    });
});

test.describe('Educational Panels', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => {
            const c = document.getElementById('canvasOrig');
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i] > 0 || d[i+1] > 0 || d[i+2] > 0) return true;
            }
            return false;
        }, { timeout: 20000 });
    });

    test('Block anatomy panel is visible on page load', async ({ page }) => {
        await expect(page.locator('#blockAnatomy')).toBeVisible();
        await expect(page.locator('#blockAnatomy .anatomy-pixel')).toHaveCount(4);
    });

    test('Hovering anatomy pixel shows RGBA byte cells', async ({ page }) => {
        const firstPixel = page.locator('.anatomy-pixel').first();
        await firstPixel.hover();
        // After hover the pixel has visible border (accent color applied via CSS)
        await expect(firstPixel).toBeVisible();
        // Each pixel has 4 byte cells (R, G, B, A)
        const bytes = firstPixel.locator('.anatomy-byte');
        await expect(bytes).toHaveCount(4);
    });

    test('Key derivation panel is visible', async ({ page }) => {
        await expect(page.locator('#keyDerivation')).toBeVisible();
    });

    test('Key derivation step button advances highlight', async ({ page }) => {
        const btn = page.locator('#keyDeriveStep');
        await btn.click();
        const active = page.locator('.kd-stage.kd-active');
        await expect(active).toHaveCount(1);
    });

    test('Key derivation shows final key after all steps', async ({ page }) => {
        // Click through all 5 steps (indices 0-4)
        for (let i = 0; i < 5; i++) {
            await page.click('#keyDeriveStep');
        }
        const keyText = await page.textContent('#kdKey');
        // Should show hex key (32 chars for AES-128 = 16 bytes)
        expect(keyText).toMatch(/^[0-9a-f]+$/);
        expect(keyText.length).toBe(32);
    });

    test('ECB vs GCM data flow panel is visible', async ({ page }) => {
        await expect(page.locator('#ecbVsGcm')).toBeVisible();
    });

    test('ECB vs GCM step button activates two stages', async ({ page }) => {
        await page.click('#ecbGcmStep');
        // One stage active in ECB column, one in GCM column
        const ecbActive = page.locator('#ecbVsGcm .df-col:first-child .df-stage.df-active-ecb, #ecbVsGcm .df-col:first-child .df-stage.df-active-box');
        const gcmActive = page.locator('#ecbVsGcm .df-col:last-child .df-stage.df-active-gcm, #ecbVsGcm .df-col:last-child .df-stage.df-active-box');
        await expect(ecbActive).toHaveCount(1);
        await expect(gcmActive).toHaveCount(1);
    });

    test('ECB duplicate warning appears after all steps', async ({ page }) => {
        // 6 steps total
        for (let i = 0; i < 6; i++) await page.click('#ecbGcmStep');
        await expect(page.locator('#ecbDupeWarn')).toBeVisible();
        await expect(page.locator('#gcmSafeNote')).toBeVisible();
    });
});
