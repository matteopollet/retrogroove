import { makeRng } from './prng.js';

// Chaque album est une "graine" : la musique est composée de façon déterministe
// par le moteur (engine.js). Pas de fichiers audio — tout est synthétisé en direct.
export const ALBUMS = [
  {
    id: 'neon-horizons',
    title: 'Horizons Néon',
    artist: 'Neon Coastliner',
    year: 1986,
    seed: 861986,
    style: 'synthwave',
    bpm: 104,
    rootMidi: 45, // La2
    scale: [0, 2, 3, 5, 7, 8, 10], // la mineur naturel
    warmth: 9000,
    crackle: 0.22,
    mix: { kick: 0.95, snare: 0.5, hat: 0.2, bass: 0.42, pad: 0.5, arp: 0.26, lead: 0.34, keys: 0, pluck: 0, shimmer: 0, drone: 0 },
    palette: ['#ff2e88', '#ff9a3c', '#2b1055', '#7597de'],
    tracks: ['Autoroute Crépuscule', 'Chrome & Velours', 'Laser Paradiso', 'Néon sur la Ville', 'Vitesse Infinie', 'Dernier Boulevard', 'Aurore Synthétique'],
  },
  {
    id: 'midnight-tape',
    title: 'Ruban de Minuit',
    artist: 'Cassette Club',
    year: 1979,
    seed: 7912,
    style: 'lofi',
    bpm: 78,
    rootMidi: 41, // Fa2
    scale: [0, 2, 3, 5, 7, 8, 10],
    warmth: 5200,
    crackle: 0.5,
    swing: 0.14,
    mix: { kick: 0.8, snare: 0.42, hat: 0.18, bass: 0.38, pad: 0.22, arp: 0, lead: 0, keys: 0.42, pluck: 0.3, shimmer: 0, drone: 0 },
    palette: ['#e8b04b', '#8a5a2b', '#3b2a1a', '#d97b4f'],
    tracks: ['Café Froid', 'Pluie sur le Store', 'Side B de Ma Vie', 'Magnétique', 'Dernier Métro', 'Bande Usée'],
  },
  {
    id: 'pixel-dreams',
    title: 'Rêves de Pixels',
    artist: 'Bitwise Choir',
    year: 1989,
    seed: 0xC41989,
    style: 'chiptune',
    bpm: 142,
    rootMidi: 50, // Ré3
    scale: [0, 2, 3, 5, 7, 9, 10], // ré dorien
    warmth: 12000,
    crackle: 0.15,
    mix: { kick: 0.85, snare: 0.45, hat: 0.16, bass: 0.4, pad: 0, arp: 0.3, lead: 0.42, keys: 0, pluck: 0, shimmer: 0, drone: 0 },
    palette: ['#3ee06f', '#1a7a4a', '#0b2b1a', '#b7f542'],
    tracks: ['Niveau 1-1', 'Château de Cartouches', 'Boss Final', 'Continue?', 'High Score', 'Écran Titre', 'Warp Zone', 'Game Over (Reprise)'],
  },
  {
    id: 'solaris-drift',
    title: 'Dérive Solaire',
    artist: 'Solaris Ensemble',
    year: 1974,
    seed: 19740217,
    style: 'ambient',
    bpm: 62,
    rootMidi: 38, // Ré2
    scale: [0, 2, 4, 7, 9], // pentatonique majeure
    warmth: 7500,
    crackle: 0.3,
    mix: { kick: 0, snare: 0, hat: 0, bass: 0, pad: 0.55, arp: 0, lead: 0, keys: 0, pluck: 0.34, shimmer: 0.16, drone: 0.3 },
    palette: ['#f5d67b', '#e88b5d', '#5d3a8a', '#241a3f'],
    tracks: ['Lever de Poussière', 'Anneaux', 'Mer de Tranquillité', 'Chute Libre', 'Lumière Cendrée'],
  },
];

export function sideSplit(album) {
  return Math.floor(album.tracks.length / 2) || 1;
}

// Pochettes génératives : chaque album a son art, dessiné sur canvas.
export function drawCover(canvas, album) {
  const rng = makeRng(album.seed ^ 0xC0FFEE);
  const s = canvas.width;
  const ctx = canvas.getContext('2d');
  const [c1, c2, c3, c4] = album.palette;

  // fond dégradé
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, c3); g.addColorStop(1, c4);
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);

  if (album.style === 'synthwave') {
    // soleil strié
    const cx = s / 2, cy = s * 0.42, r = s * 0.28;
    const sg = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    sg.addColorStop(0, c2); sg.addColorStop(1, c1);
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c3;
    for (let i = 0; i < 6; i++) {
      const y = cy + r * (0.1 + i * 0.16);
      ctx.fillRect(cx - r, y, r * 2, 3 + i * 1.6);
    }
    // grille perspective
    ctx.strokeStyle = c1; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
    const hz = s * 0.62;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(cx + i * s * 0.06, hz); ctx.lineTo(cx + i * s * 0.5, s); ctx.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const y = hz + (i * i) * s * 0.008;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    }
    // étoiles
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9;
    for (let i = 0; i < 60; i++) ctx.fillRect(rng.next() * s, rng.next() * s * 0.5, 1.5, 1.5);
    ctx.globalAlpha = 1;
  } else if (album.style === 'lofi') {
    // grandes formes douces + bande magnétique
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = [c1, c2, c4][i % 3];
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(rng.next() * s, rng.next() * s, s * rng.range(0.15, 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // bobines de cassette
    ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = s * 0.02;
    for (const x of [s * 0.32, s * 0.68]) {
      ctx.beginPath(); ctx.arc(x, s * 0.55, s * 0.13, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = c1;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.save(); ctx.translate(x, s * 0.55); ctx.rotate(a);
        ctx.fillRect(-s * 0.008, -s * 0.11, s * 0.016, s * 0.09);
        ctx.restore();
      }
    }
    ctx.strokeStyle = c1; ctx.lineWidth = s * 0.015;
    ctx.beginPath(); ctx.moveTo(s * 0.32, s * 0.55);
    ctx.quadraticCurveTo(s * 0.5, s * 0.75, s * 0.68, s * 0.55); ctx.stroke();
  } else if (album.style === 'chiptune') {
    // mosaïque de pixels
    const n = 12, cell = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = rng.next();
      ctx.fillStyle = v < 0.45 ? c3 : v < 0.75 ? c2 : v < 0.93 ? c1 : c4;
      ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    }
    // vaisseau space invader au centre
    ctx.fillStyle = c3;
    const inv = [0,0,1,0,0,0,0,0,1,0,0, 0,0,0,1,0,0,0,1,0,0,0, 0,0,1,1,1,1,1,1,1,0,0, 0,1,1,0,1,1,1,1,0,1,1,0, 1,1,1,1,1,1,1,1,1,1,1,0, 1,0,1,0,0,0,0,0,1,0,1,0, 0,0,0,1,1,0,1,1,0,0,0,0];
    const px = s / 22, ox = s * 0.27, oy = s * 0.4;
    for (let i = 0; i < inv.length; i++) {
      if (inv[i]) ctx.fillRect(ox + (i % 11) * px, oy + Math.floor(i / 11) * px, px - 1, px - 1);
    }
  } else {
    // ambient : halos concentriques brumeux
    for (let i = 9; i >= 0; i--) {
      ctx.globalAlpha = 0.10 + i * 0.02;
      ctx.fillStyle = i % 2 ? c1 : c2;
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.45, s * 0.06 * (i + 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // poussières d'étoiles
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 140; i++) {
      ctx.globalAlpha = rng.next() * 0.8;
      ctx.fillRect(rng.next() * s, rng.next() * s, rng.next() * 2 + 0.5, rng.next() * 2 + 0.5);
    }
    ctx.globalAlpha = 1;
  }

  // grain vinyle sur toutes les pochettes
  const img = ctx.getImageData(0, 0, s, s);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng.next() - 0.5) * 14;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}
