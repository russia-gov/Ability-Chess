#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const indexPath = path.resolve(process.argv[2] || 'index.html');
const root = path.dirname(indexPath);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = http.createServer((request, response) => {
  let relative = decodeURIComponent(String(request.url || '/').split('?')[0]);
  if (relative === '/') relative = `/${path.basename(indexPath)}`;
  const file = path.resolve(root, `.${relative}`);
  if ((!file.startsWith(`${root}${path.sep}`) && file !== root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(response);
});

(async () => {
  let browser;
  const pageErrors = [];
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));

    await page.goto(`http://127.0.0.1:${port}/${path.basename(indexPath)}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.sidebar-profile-link').first().click();
    await page.locator('#memberModal:not([hidden])').waitFor();
    if (!(await page.locator('#memberEmail').isVisible()) || !(await page.locator('#memberSignInBtn').isVisible())) {
      throw new Error('Signed-out account controls did not become visible.');
    }

    await page.route('**/rest/v1/rpc/**', async route => {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      const profile = {
        id: 'browser-smoke-owner', username: 'browser_owner', display_name: 'Browser Owner',
        is_owner: true, is_staff: false, games_played: 0, wins: 0, losses: 0, draws: 0,
        bullet_rating: 1200, blitz_rating: 1200, rapid_rating: 1200
      };
      const body = name === 'ability_chess_get_my_profile_v2' || name === 'ability_chess_profile_extras' ? [profile]
        : name === 'ability_chess_get_my_ratings' ? [{ bullet_rating: 1200, blitz_rating: 1200, rapid_rating: 1200 }]
        : name === 'ability_chess_get_my_challenge_inbox_key' ? 'browser-smoke-key'
        : [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.evaluate(() => localStorage.setItem('abilityChessMemberSession', JSON.stringify({
      access_token: 'browser-smoke-token', refresh_token: 'browser-smoke-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600
    })));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.admin-nav-btn').first().waitFor({ state: 'visible' });
    await page.locator('.admin-nav-btn').first().click();
    await page.locator('#adminScreen.active').waitFor();
    await page.locator('[data-admin-management="directory"]').click();
    await page.locator('#adminManagementFrame:not([hidden])').waitFor();
    const directoryUrl = await page.locator('#adminManagementFrame').getAttribute('src');
    if (directoryUrl !== 'admin-directory.html?embedded=1') throw new Error(`Unexpected directory URL: ${directoryUrl}`);
    await page.locator('[data-admin-management="reports"]').click();
    const reportUrl = await page.locator('#adminManagementFrame').getAttribute('src');
    if (reportUrl !== 'dm-safety.html?embedded=1#reports') throw new Error(`Unexpected reports URL: ${reportUrl}`);
    if (pageErrors.length) throw new Error(`Browser errors:\n${pageErrors.join('\n')}`);
    console.log('Account sign-in and admin directory/report browser smoke passed');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});

