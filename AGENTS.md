# RETROGROOVE — lecteur vinyle "album intégral"

Site statique, zéro dépendance runtime. Toute la musique est synthétisée en
direct via Web Audio API (composition déterministe par seed dans `js/engine.js`).

## Règle produit
Un album se joue en entier, comme un vinyle : pas de skip, pas de seek.
Pause autorisée (aiguille levée, position figée via `AudioContext.suspend()`).
Quitter / éjecter / changer de disque = retour au début du sillon.
Interlude obligatoire "retourner le disque" entre face A et face B.

## Lancer
```sh
python3 -m http.server 8123   # ou n'importe quel serveur statique
# http://localhost:8123
```

## Tester
```sh
node test/e2e.mjs   # nécessite google-chrome + puppeteer-core (déjà installé)
```
Couvre : boot, lecture, pause/reprise, interdiction de seek, flip face B,
fin d'album, éject = redémarrage à zéro.

## Structure
- `js/prng.js` — PRNG seedé (mulberry32)
- `js/albums.js` — catalogue + pochettes génératives (canvas)
- `js/engine.js` — `composeAlbum()` (pur, testable en Node) + `VinylPlayer` (voix synthèse, crackle, scheduler)
- `js/app.js` — vues, transport, VU-mètre, raccourcis (Espace=pause, F=flip, Échap=éject)

## Pièges connus
- `[hidden]` doit rester `display:none !important` (les overlays en `display:flex` l'écrasent sinon).
- Dans `_tick`, sauter les événements passés AVANT de scheduler, sinon `setValueAtTime` reçoit un temps négatif après un saut de `t0`.
