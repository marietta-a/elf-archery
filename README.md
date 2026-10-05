# Elf Archery

Hands-first WebXR archery game for Meta Quest (Meta VR Start Developer Competition 2026, Gaming track).
A kneeling elven archer (procedural, rebuilt from my own reference art: long golden hair, silver circlet and pauldrons, green cape, tall pointed ears) loosens arrows through
the egg-shaped cutout of a swinging target card.

## Motivation

Meneldor is my favorite character from *The Faraway Paladin*, a Japanese animated series I love. He is a
half-elf archer, gruff on the outside and fiercely loyal underneath, and watching him shoot is a big reason
the show stuck with me. Bow and arrow is also my favorite weapon in any game I play, so when I saw the Meta VR
Start Developer Competition, the idea was obvious: build a small game around the kind of archer he is.

The "hands-first" rule of the competition made it even better. An archer's whole craft lives in the hands:
you pinch the string, pull it back, hold your breath, and let go. In VR with hand tracking that is exactly
what you do. There are no controllers to learn and nothing between you and the bow, so drawing and releasing
feels like the real thing, and you can play it comfortably seated.

I wanted the game to be easy to pick up and hard to put down:

- **One simple skill: timing.** A target card swings on a chain, with an egg-shaped cutout in it. You line up
  the shot and decide *when* to release. That suits hand tracking well, because the challenge is in the
  release, not in fiddly 3D aiming.
- **Every shot should feel good.** CLIP and PERFECT ratings, streaks that climb a musical scale, a charged
  Overdrive bolt, and unlockable bows and themes give each arrow a payoff.
- **A character to root for.** The elf in front of you is my tribute to Meneldor: a gruff, kneeling half-elf
  ranger who draws as you draw and reacts to every hit and miss. He is an original design inspired by that
  archer archetype, not a copy of the show's character.

## How it was built

Built with [Claude Code](https://claude.com/claude-code) from a written game design (the timing-shot archery
spec) plus the competition requirements, iterating in a desktop browser and checking behaviour with
scripted playthroughs.

- **Stack:** plain JavaScript modules and [three.js](https://threejs.org) (WebXR, `XRHandModelFactory` for the
  player's hands). No bundler and no build step; three.js and the hand models are installed locally with npm,
  so it also runs offline once served.
- **Input:** WebXR `select` events, which fire on a hand-tracking pinch, drive draw and release. The same
  pinch ray presses in-world menu buttons. Mouse and Space provide a desktop fallback for development.
- **Character:** the elf is assembled from primitives (spheres, cones, cylinders) to match three reference views (front, side, back): long golden hair with front braids, silver circlet with an emerald, layered silver pauldrons, green bodice over a brown corset, green cape, leather bracers and thigh-high boots with silver knee guards. Arms use two-bone IK to follow the bow hand and the drawn string; ears, blinking, eyebrows and mouth shapes drive expression, and the body turns to face the player when celebrating or reacting.
- **Gameplay model:** the card hangs on a pendulum whose period, arc and cutout size scale with the stage.
  Each shot is tested at the exact moment the arrow tip crosses the card plane, using the card's position at
  that sub-frame time and an ellipse test in the card's tilted frame. That gives Perfect, Clip or Miss.
- **UI:** canvas-textured world-space panels (HUD, arrows/overdrive, bow and theme shop) with ray-picked
  buttons, so the same code serves mouse and hand pointer.
- **Effects and audio:** one instanced, camera-facing particle system (sparks, confetti, vortex through the
  hole, debris) and Web Audio synthesis for every sound, with pitch tied to the streak.
- **Comfort and performance:** flat-shaded low-poly scenery, instanced trees and particles, no camera shake in
  VR (only the gantry shakes), and a recenter that fits the lane to the player's seated eye height.
- **Verification:** run in the browser with scripted "good" and "bad" shooters to exercise hits, misses, stage
  progression, overdrive, shop purchases and game over. The Quest hand-tracking path has not yet been tested
  on a headset.

## Run

```bash
npm install     # already done if node_modules exists
npm start       # http://localhost:8080
```

- **Desktop:** hold mouse / Space to draw, release to shoot. Click menu buttons with the mouse.
- **Quest (hand tracking):** WebXR needs HTTPS or localhost.
  - USB: `adb reverse tcp:8080 tcp:8080`, then open `http://localhost:8080` in the Quest browser and press **Enter VR**.
  - Or tunnel: `npx localtunnel --port 8080` and open the https URL on the headset.
  - Turn on Hand Tracking in Quest settings. **Pinch & hold** to draw, **release** to shoot; pinch the pointer ray to press menu buttons.
- Press **RECENTER** in the menu to fit the lane to your seated eye height and facing direction.

## Gameplay

- Aim is fixed on the reticle; the swinging card's cutout crosses it. Time your release (arrow flight is ~0.13 s).
- Through the middle = **PERFECT SHOT** (100% fit), grazing the rim = **CLIP!** (90-99%, streak continues), hitting solid card = miss (3 arrows per run).
- Streak builds coins and climbs a musical scale. Every hit charges **OVERDRIVE**; when full, the next shot is a massive bolt that always counts as a perfect fit and shatters the card.
- Every 3 hits advances the stage: the card swings about 12% faster each stage (5.0 s per swing down to 1.7 s), with a wider arc and smaller cutout.
- **Ten environments, one per stage** (cycling after that): Training Meadow, Iron Target Range, Whispering Woods, Windy Ridge, Clockwork Yard, Moonlit Archery, Dragon's Gate, Storm Bastion, Crystal Vault, Mythic Range. Each has its own sky, fog, lighting, trees, ambient effects (petals, fireflies, leaves, steam, embers, rain with lightning, sparkles) and props (gears, lava pools, crystals, light pillars, moon and stars) that fade in as you advance.
- **Shoot the glowing orbs for upgrades.** Orbs drift across the lane in front of the card; any arrow that passes through one collects it, even if the shot misses the card:
  - **Triple Shot:** next 3 shots fire 3 arrows, and the best one counts.
  - **Steady Hands:** the cutout counts as 50% bigger for 4 shots.
  - **Hourglass:** the swing slows to about half speed for 10 seconds.
  - **Extra Arrow:** +1 arrow (up to 5).
  - **Golden Arrow:** next 3 shots pay triple coins.
  - **Overcharge:** +3 Overdrive.
- **Arrows visibly evolve with your streak:** 3 in a row = warm glow, 6 = fire trail, 10 = storm (blue-white sparks and a long glow). Upgrade orbs change the arrow too: Golden Arrow turns it gold, Steady Hands wraps it in a blue aura, and Triple Shot shows three arrows on the string. The elf also glows in the color of whatever upgrade is active.
- Shop (in-game panel): Elven Longbow, Steampunk Ballista, Laser Crossbow, Arcane Bow; Medieval / Sci-Fi theme packs; elf outfits (Forest Ranger, Royal Guard, Shadow Hunter, Golden Paladin with a halo). Progress is saved in localStorage.

## Layout

| File | Purpose |
| --- | --- |
| `src/main.js` | game loop, scoring, input (mouse/keys/XR pinch), UI panels, effects |
| `src/elf.js` | procedural elf character (IK arms, expressions, ears, bow handling) |
| `src/weapons.js` | bow + arrow models per weapon / pack |
| `src/card.js` | shield / data-cube target card and chain |
| `src/world.js` | scenery (environment-aware), gantry, egg station, layout constants |
| `src/env.js` | the ten stage environments and their ambient particle recipes |
| `src/audio.js` | synthesized SFX (no audio assets) |
| `src/particles.js`, `src/panel.js` | instanced particles, canvas UI panels |

## Armory (accessible collection view)

From the menu, **ARMORY** opens one large screen that shows everything you can collect, with a picture of each item:
**Bows**, **Arrows** (arrow packs with their target card, plus the streak arrows), **Outfits** (your elf wearing each one)
and **Upgrades** (the glowing orbs). Select a card to read its name, status and description; one big button buys or equips it.

Accessibility choices: large text and large hit targets; status is always spelled out with words and symbols
(a check mark for EQUIPPED, a padlock with the price for locked), never by colour alone; high-contrast dark panels;
a **TEXT SIZE** toggle (scales the screen up), an optional **VOICE** toggle that reads each item aloud
(uses the browser's speech synthesis, where available), and keyboard control on desktop
(arrow keys pick, 1-4 switch tabs, Enter buys/equips, Esc goes back). Purchases need a deliberate second press:
selecting a card never spends coins.

## Using a real 3D character (.glb)

The default character is the built-in procedural elf. A real model is only used when you open the game with `?art=1` (for example `http://localhost:8080/?art=1`). The procedural elf can only approximate painted reference art; to use a faithful model:

1. Generate or commission a 3D model from the front / side / back views in `assets/elf-views/` using an
   image-to-3D tool that accepts several views (for example Tripo, Meshy, Rodin or Hunyuan3D), or have a 3D artist make it.
   Export it as **glTF binary (.glb)**, Y-up. Check the tool's license terms for commercial use / competition entry.
2. Save it as `assets/models/elf.glb`. The game loads it automatically and replaces the procedural elf; if the file is
   missing, the procedural elf is used.
3. The model is auto-scaled to about 1.15 m (so her head stays below a seated player's eye line), stood on the plinth
   and turned to face the lane. If it has animation clips, one named like "idle" or "stand" (otherwise the first) loops.
   The bow, string, arrows, glow and halo are still drawn by the game.
   The game only accepts `elf.glb` if it contains a **skinned mesh** (or is a flat image card). Otherwise it ignores
   the file and shows the cutout art from `assets/models/elf-card-front.webp` / `elf-card-back.webp` instead.
4. **Flat image cards are supported too** (a thin slab textured with the art, like `assets/models/elf.glb` with a front
   and a back image). The game fixes the squashed aspect and upside-down texture those exports have, cuts out the
   transparent background, shows her back while aiming (the player stands behind her) and flips to her front when she
   reacts. She stands beside the lane; the bow is drawn separately. Outfit recolors become a light tint on a card.
5. A static model will not move its arms; for the draw/release animation the model needs a rig, and the arm and head
   bones then need to be wired to the bow (ask for that as a follow-up).

## Notes

- All art and audio are generated in code, so there are no asset licenses to track.
- Hand tracking has no haptics; the haptic hooks fire on controllers/phones only, and audio carries the feedback on Quest hands.
- Camera shake is desktop-only; in VR only the gantry shakes slightly (comfort).
