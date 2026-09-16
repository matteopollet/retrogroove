import { ALBUMS, drawCover, sideSplit } from './albums.js';
import { VinylPlayer, composeAlbum } from './engine.js';

const $ = (id) => document.getElementById(id);
const fmt = (s) => {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

let ctx = null;
let player = null;
let album = null;
let toastTimer = null;

/* ---------------- toast ---------------- */
function toast(msg, ms = 2600) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

/* ---------------- vues ---------------- */
function showLibrary() {
  teardownPlayer();
  $('player-view').hidden = true;
  $('library-view').hidden = false;
  $('flip-overlay').hidden = true;
  $('end-overlay').hidden = true;
}

function showPlayer() {
  $('library-view').hidden = true;
  $('player-view').hidden = false;
}

/* ---------------- bibliothèque ---------------- */
function buildLibrary() {
  const crate = $('crate');
  crate.innerHTML = '';
  for (const a of ALBUMS) {
    const card = document.createElement('div');
    card.className = 'album-card';
    const comp = composeAlbum(a);
    card.innerHTML = `
      <div class="card-wrap">
        <canvas width="480" height="480"></canvas>
        <div class="vinyl-peek"></div>
      </div>
      <div class="meta">
        <h3>${a.title}</h3>
        <p>${a.artist} · ${a.year} · ${a.tracks.length} titres · ${fmt(comp.endT)}</p>
      </div>`;
    drawCover(card.querySelector('canvas'), a);
    card.addEventListener('click', () => playAlbum(a));
    crate.appendChild(card);
  }
}

/* ---------------- cycle de vie du disque ---------------- */
function playAlbum(a) {
  teardownPlayer();
  album = a;
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();

  player = new VinylPlayer(ctx, a, {
    onTrack: (i) => highlightTrack(i),
    onFlipNeeded: onFlipNeeded,
    onFlipped: onFlipped,
    onFinished: onFinished,
    onPauseChange: (p) => setPausedUI(p),
    onTick: (s) => onTick(s),
  });

  // métadonnées
  $('np-title').textContent = a.title;
  $('np-artist').textContent = `${a.artist} · ${a.year}`;
  $('np-year').textContent = a.year;
  $('label-title').textContent = `${a.title} — face a`;
  $('side-badge').textContent = 'FACE A';
  const label = $('record-label');
  label.style.background = `radial-gradient(circle at 40% 35%, ${a.palette[0]}, ${a.palette[2]})`;
  drawCover($('mini-cover'), a);

  buildTracklist();
  $('total').textContent = fmt(player.comp.endT);
  $('elapsed').textContent = '0:00';
  $('flip-overlay').hidden = true;
  $('end-overlay').hidden = true;
  $('btn-pause').disabled = false;
  setPausedUI(false);

  showPlayer();
  player.start();
  setArm(-14); // l'aiguille se pose sur le sillon extérieur
  $('record').classList.remove('stopped');
  $('tonearm').classList.remove('lifted');
  toast(`♪ ${a.title} — l'aiguille est posée. Bonne écoute intégrale.`);
}

function teardownPlayer() {
  if (player) { player.stop(); player = null; }
  if (ctx && ctx.state === 'running') ctx.suspend();
}

function eject() {
  if (!player) return;
  const title = album.title;
  teardownPlayer();
  showLibrary();
  setArm(-38);
  toast(`⏏ « ${title} » éjecté. La prochaine écoute repartira du début du sillon.`, 3400);
}

/* ---------------- tracklist ---------------- */
function buildTracklist() {
  const ol = $('tracklist');
  ol.innerHTML = '';
  const split = sideSplit(album);
  let sideDone = false;
  album.tracks.forEach((title, i) => {
    if (i === split && !sideDone) {
      sideDone = true;
      const sep = document.createElement('li');
      sep.className = 'side-sep';
      sep.textContent = '—— FACE B ——';
      ol.appendChild(sep);
    }
    const li = document.createElement('li');
    const mk = player.comp.trackMarks[i];
    li.innerHTML = `<span class="num">${String(i + 1).padStart(2, '0')}</span>
      <span class="ttl">${title}</span><span class="dur">${fmt(mk.dur)}</span>`;
    li.dataset.i = i;
    li.title = 'Pas d\'avance rapide sur un vinyle.';
    li.addEventListener('click', () => {
      li.classList.remove('shake');
      void li.offsetWidth;
      li.classList.add('shake');
      toast('On n\'avance pas un vinyle — on l\'écoute.');
    });
    ol.appendChild(li);
  });
}

function highlightTrack(i) {
  document.querySelectorAll('#tracklist li[data-i]').forEach((li) => {
    const n = +li.dataset.i;
    li.classList.toggle('playing', n === i);
    li.classList.toggle('done', n < i);
  });
  $('side-badge').textContent = i < sideSplit(album) ? 'FACE A' : 'FACE B';
}

/* ---------------- transport / aiguille ---------------- */
function setArm(deg) {
  $('tonearm').style.setProperty('--arm-angle', `${deg}deg`);
}

function setPausedUI(paused) {
  $('record').classList.toggle('stopped', paused);
  $('tonearm').classList.toggle('lifted', paused);
  $('pause-icon').textContent = paused ? '►' : '❚❚';
  $('motor-led').className = paused ? 'led amber' : 'led on';
}

async function togglePause() {
  if (!player) return;
  if (player.state === 'paused') {
    await player.resume();
    toast('L\'aiguille retombe dans le sillon…');
  } else if (player.state === 'playing') {
    await player.pause();
    toast('Pause. Le disque vous attend — il ne bougera pas.');
  }
}

/* ---------------- face B / fin ---------------- */
function onFlipNeeded() {
  setArm(-38); // retour au repos
  $('tonearm').classList.add('lifted');
  $('record').classList.add('stopped');
  $('flip-overlay').hidden = false;
  $('btn-pause').disabled = true;
}

function onFlipped() {
  const rec = $('record');
  rec.classList.remove('stopped');
  $('tonearm').classList.remove('lifted');
  $('flip-overlay').hidden = true;
  $('btn-pause').disabled = false;
  $('label-title').textContent = `${album.title} — face b`;
  $('side-badge').textContent = 'FACE B';
  rec.classList.add('flipping');
  setTimeout(() => rec.classList.remove('flipping'), 950);
  setArm(-14);
  toast('Face B. On reprend là où le sillon continue.');
}

function onFinished() {
  setArm(-38);
  $('tonearm').classList.add('lifted');
  $('record').classList.add('stopped');
  $('end-overlay').hidden = false;
  $('btn-pause').disabled = true;
}

/* ---------------- boucle UI ---------------- */
function onTick(s) {
  $('elapsed').textContent = fmt(s.pos);
  // l'aiguille suit les sillons : de -14° (bord) à +22° (centre)
  if (s.state === 'playing' && s.endT > 0) {
    const p = Math.min(1, s.pos / s.endT);
    setArm(-14 + p * 36);
  }
}

function drawVu() {
  const cv = $('vu'), c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const draw = () => {
    c.clearRect(0, 0, W, H);
    // cadran
    c.strokeStyle = 'rgba(255,179,71,0.5)';
    c.lineWidth = 1;
    c.beginPath(); c.arc(W / 2, H * 0.95, H * 0.8, Math.PI, 0); c.stroke();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      const r1 = H * 0.72, r2 = H * 0.8;
      c.beginPath();
      c.moveTo(W / 2 + Math.cos(a) * r1, H * 0.95 + Math.sin(a) * r1);
      c.lineTo(W / 2 + Math.cos(a) * r2, H * 0.95 + Math.sin(a) * r2);
      c.stroke();
    }
    c.fillStyle = 'rgba(255,179,71,0.7)';
    c.font = '9px monospace'; c.textAlign = 'center';
    c.fillText('VU', W / 2, H * 0.45);

    // niveau
    let level = 0;
    if (player && player.state !== 'idle' && ctx && ctx.state === 'running') {
      const data = new Uint8Array(player.analyser.fftSize);
      player.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      level = Math.min(1, Math.sqrt(sum / data.length) * 4.2);
      level = level * 0.75 + (drawVu._l || 0) * 0.25; // inertie d'aiguille
      drawVu._l = level;
    } else {
      drawVu._l = (drawVu._l || 0) * 0.9;
      level = drawVu._l;
    }
    const a = Math.PI + level * Math.PI * 0.92 + Math.PI * 0.04;
    c.strokeStyle = '#ff7847'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(W / 2, H * 0.95);
    c.lineTo(W / 2 + Math.cos(a) * H * 0.7, H * 0.95 + Math.sin(a) * H * 0.7);
    c.stroke();
    c.fillStyle = '#ffb347';
    c.beginPath(); c.arc(W / 2, H * 0.95, 4, 0, Math.PI * 2); c.fill();
    requestAnimationFrame(draw);
  };
  draw();
}

/* ---------------- horloge ---------------- */
setInterval(() => {
  const d = new Date();
  $('clock').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}, 1000);

/* ---------------- événements ---------------- */
$('boot-btn').addEventListener('click', async () => {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  await ctx.resume();
  $('boot').classList.add('off');
  $('topbar').hidden = false;
  showLibrary();
});

$('brand').addEventListener('click', () => {
  if (player && player.state !== 'idle') eject();
  else showLibrary();
});
$('btn-pause').addEventListener('click', togglePause);
$('btn-eject').addEventListener('click', eject);
$('btn-flip').addEventListener('click', () => player?.flipSide());
$('btn-replay').addEventListener('click', () => playAlbum(album));
$('btn-home2').addEventListener('click', eject);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && player && $('player-view').hidden === false) {
    e.preventDefault();
    togglePause();
  } else if (e.key === 'f' && player?.state === 'waiting') {
    player.flipSide();
  } else if (e.key === 'Escape' && player) {
    eject();
  }
});

/* ---------------- init ---------------- */
buildLibrary();
drawVu();

// hook d'inspection (debug / tests)
window.__rg = { get player() { return player; }, get ctx() { return ctx; }, get album() { return album; } };
