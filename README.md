# Glimmerdeep 3D — best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/adamlawcce-source/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/adamlawcce-source/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Luma the lantern fish, in real 3D. Swim through the Shallow Reef, the Deep Trench and the Abyss, gather 30 pearls before the lamp runs dry, and steal the Heart of the Deep from the giant anglerfish guarding it. Three.js r186 vendored locally (no CDN, no network), a lantern that is a genuine point light fading with the meter, Shift dash, golden pearls, heart pickups, a combo multiplier, jellyfish, zone fog, bubbles, particles and synthesised WebAudio — the whole game runs offline from static files.

The fish, enemies and reef are real 3D models (GLB files under `game/models/`), loaded with a minified GLTFLoader. Pearls, orbs, hearts, bubbles and particles stay procedural glows.

## 3D model credits

- Luma (BlueTang), anglerfish and jellyfish — Gobkit Free Animal Pack, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (gobkit.com)
- Rock — Quaternius via Poly Pizza, CC0 1.0
- Coral (`underwater_enviro_coral`, God Appeasers), Coral Reef Set4 (MiniPoly), Kelp (Christopher F), Seaweed (Laney XR Labs), Anemone (Poly by Google) — Poly Pizza, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)

## Play it

```sh
python3 -m http.server 8080 --directory game
```

Open http://localhost:8080 in a desktop browser. Enter or click to dive, Arrow keys or WASD (or hold the mouse) to swim, Shift to dash, P to pause, M to mute, R to dive again.

---

<sub>Entered on [make.fun](https://make.fun/?ref=eenffswd&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
