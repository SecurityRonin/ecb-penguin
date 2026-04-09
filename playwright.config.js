import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    use: {
        baseURL: 'http://localhost:3007',
        headless: true,
    },
    webServer: {
        command: 'python3 -m http.server 3007 --directory web',
        port: 3007,
        reuseExistingServer: true,
        timeout: 10000,
    },
});
