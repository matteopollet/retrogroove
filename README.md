# RETROGROOVE

Lecteur vinyle **« album intégral »** — site statique, zéro dépendance runtime.
Toute la musique est synthétisée en direct via Web Audio API : chaque album est
composé de façon déterministe à partir d'une graine (`js/engine.js`).

## Règle de la maison

Un album se joue en entier, comme un vinyle :

- pas de skip, pas de seek ;
- pause autorisée (aiguille levée, position figée via `AudioContext.suspend()`) ;
- quitter / éjecter / changer de disque = retour au début du sillon ;
- interlude obligatoire « retourner le disque » entre la face A et la face B.

## Lancer

```sh
python3 -m http.server 8123   # ou n'importe quel serveur statique
# http://localhost:8123
```

## Tester

```sh
npm install
node test/e2e.mjs   # nécessite google-chrome
```

Couvre : boot, lecture, pause/reprise, interdiction de seek, flip face B,
fin d'album, éject = redémarrage à zéro.

## Structure

| Fichier        | Rôle                                                        |
| -------------- | ----------------------------------------------------------- |
| `js/prng.js`   | PRNG seedé (mulberry32)                                     |
| `js/albums.js` | catalogue + pochettes génératives (canvas)                  |
| `js/engine.js` | `composeAlbum()` (pur) + `VinylPlayer` (synthèse, scheduler) |
| `js/app.js`    | vues, transport, VU-mètre, raccourcis clavier               |

Raccourcis : `Espace` = pause, `F` = flip, `Échap` = éject.

## Licence

Distribué sous [GPL-3.0-or-later](LICENSE) — © 2026 Mattéo Pollet.
