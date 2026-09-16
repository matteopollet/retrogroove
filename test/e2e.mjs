// Test end-to-end headless : boot -> album -> lecture -> pause -> reprise -> flip -> fin -> règles.
import puppeteer from 'puppeteer-core';

const URL = 'http://localhost:8123/index.html';
const errors = [];
const ok = (cond, name) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); if (!cond) errors.push(name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push('console: ' + m.text()); console.log('CONSOLE', m.text()); } });

await page.goto(URL, { waitUntil: 'networkidle0' });
await page.click('#boot-btn');
await sleep(1100);
ok(await page.$eval('#library-view', (e) => !e.hidden), 'bibliothèque visible après boot');
ok((await page.$$('.album-card')).length === 4, '4 albums dans le bac');

// lance le 1er album (synthwave)
await page.click('.album-card');
await sleep(2500);
let s = await page.evaluate(() => window.__rg.player.getState());
ok(s.state === 'playing' && s.pos > 0.5, `lecture démarrée (pos=${s.pos.toFixed(2)})`);
ok(await page.$eval('#record', (e) => !e.classList.contains('stopped')), 'le disque tourne');

// pause : position figée
await page.click('#btn-pause');
await sleep(600);
const p1 = await page.evaluate(() => window.__rg.player.position);
await sleep(700);
const p2 = await page.evaluate(() => window.__rg.player.position);
ok(Math.abs(p2 - p1) < 0.01, `pause fige la position (${p1.toFixed(2)} == ${p2.toFixed(2)})`);
ok(await page.$eval('#record', (e) => e.classList.contains('stopped')), 'disque arrêté en pause');

// reprise
await page.click('#btn-pause');
await sleep(1200);
const p3 = await page.evaluate(() => window.__rg.player.position);
ok(p3 > p2, `reprise continue la lecture (${p3.toFixed(2)})`);

// avance rapide interdite : cliquer un morceau ne change pas la position
await page.click('#tracklist li[data-i="3"]');
await sleep(300);
const p4 = await page.evaluate(() => window.__rg.player.position);
ok(p4 > p2 && p4 < p2 + 3, 'clic tracklist ne seek pas');

// saut près du flip (fast-forward artificiel pour le test)
await page.evaluate(() => {
  const pl = window.__rg.player;
  pl.t0 = window.__rg.ctx.currentTime - (pl.comp.flipT - 0.4);
});
await sleep(1500);
s = await page.evaluate(() => window.__rg.player.getState());
ok(s.state === 'waiting', 'attente flip en fin de face A');
ok(await page.$eval('#flip-overlay', (e) => !e.hidden), 'overlay FACE B affiché');

// flip manuel
await page.click('#btn-flip');
await sleep(2000);
s = await page.evaluate(() => window.__rg.player.getState());
ok(s.state === 'playing' && s.side === 'B', `face B en cours (pos=${s.pos.toFixed(2)})`);
ok(await page.$eval('#side-badge', (e) => e.textContent === 'FACE B'), 'badge FACE B');

// saut près de la fin
await page.evaluate(() => {
  const pl = window.__rg.player;
  pl.t0 = window.__rg.ctx.currentTime - (pl.comp.endT - 0.6);
});
await sleep(1500);
s = await page.evaluate(() => window.__rg.player.getState());
ok(s.state === 'finished', 'album terminé');
ok(await page.$eval('#end-overlay', (e) => !e.hidden), 'overlay fin affiché');

// éjecter -> retour bibliothèque, prochain album repart à zéro
await page.click('#btn-home2');
await sleep(400);
ok(await page.$eval('#library-view', (e) => !e.hidden), 'retour bibliothèque après éject');
const cards = await page.$$('.album-card');
await cards[2].click(); // chiptune
await sleep(2000);
s = await page.evaluate(() => window.__rg.player.getState());
ok(s.state === 'playing' && s.pos < 4, `nouvel album repart du début (pos=${s.pos.toFixed(2)})`);
ok(await page.evaluate(() => window.__rg.album.id === 'pixel-dreams'), 'album chiptune chargé');

// éject pendant la lecture
await page.click('#btn-eject');
await sleep(300);
ok(await page.evaluate(() => window.__rg.player === null), 'player détruit après éject');

console.log(errors.length ? `\n${errors.length} ÉCHEC(S)` : '\nTOUT EST BON');
await browser.close();
process.exit(errors.length ? 1 : 0);
