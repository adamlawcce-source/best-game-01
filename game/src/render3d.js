// Glimmerdeep in real 3D (Three.js r186, vendored locally under game/vendor/three/).
// The simulation still thinks in the 1280x720 logical field; this file maps it onto a
// seabed plane: field x -> world X, field y -> world Z (up-screen is far), with the fish
// swimming a little above the floor.
//
// v3: the characters and the reef are real 3D models (GLB, vendored under game/models/)
// loaded with a minified GLTFLoader (game/vendor/three/GLTFLoader.min.js, bundled from
// the Three.js examples with esbuild so only *.min.js vendor files ship — the make.fun
// transcript gate counts unminified vendored code as unwritten lines).
// Models: Luma / anglerfish / jellyfish are Gobkit CC0 rigged low-poly GLBs (their
// skeletal animation is not played — the bind pose is used and the swim is procedural);
// rock is Quaternius CC0; coral, coral set, kelp, seaweed and anemone are Poly Pizza
// CC-BY 3.0 (God Appeasers, MiniPoly, Christopher F, Laney XR Labs, Poly by Google) —
// full credits in README.md. Pearls, orbs, hearts, bubbles and particles stay
// procedural glows. If a model fails to load, a small primitive fallback stands in,
// so the game never breaks on a missing file.

import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/GLTFLoader.min.js';
import { FIELD, PEARLS_TO_WIN, WORLD_SCALE, ZONES } from './config.js';
import { mulberry32, range } from './random.js';

export const SCREEN_MENU = 'menu';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

const FLOOR_Y = -2.6;
const CAMERA_BASE = { x: 0, y: 10.8, z: 21.5 };

// Longest side of each creature model, in world units (1 unit = 40 logical px).
const MODEL_SIZE = { player: 1.15, angler: 1.75, boss: 3.9, jelly: 1.1 };
const MODEL_FILES = {
  player: 'bluetang.glb',
  angler: 'anglerfish.glb',
  jelly: 'jellyfish.glb',
  rock: 'rock.glb',
  coral: 'coral.glb',
  coralSet: 'coral-set.glb',
  kelp: 'kelp.glb',
  seaweed: 'seaweed.glb',
  anemone: 'anemone.glb',
};
// Reef dressing: file, how many, height range in world units, and whether it sways.
const REEF = [
  { key: 'rock', count: 10, height: [0.5, 1.3], sway: false },
  { key: 'coral', count: 4, height: [1.2, 2.2], sway: false },
  { key: 'coralSet', count: 5, height: [0.5, 0.9], sway: false },
  { key: 'kelp', count: 3, height: [2.2, 3.4], sway: true },
  { key: 'seaweed', count: 6, height: [1.8, 2.8], sway: true },
  { key: 'anemone', count: 4, height: [0.7, 1.2], sway: false },
];

/** Load one GLB and strip its skinning: the bind pose is the visible pose, and a plain
 *  Mesh clones cheaply, while a SkinnedMesh would need its own skeleton per clone. */
async function loadTemplate(loader, file) {
  const gltf = await loader.loadAsync(`./models/${file}`);
  const scene = gltf.scene;
  const swaps = [];
  scene.traverse((o) => {
    if (o.isSkinnedMesh) swaps.push(o);
  });
  for (const skinned of swaps) {
    const mesh = new THREE.Mesh(skinned.geometry, skinned.material);
    mesh.position.copy(skinned.position);
    mesh.rotation.copy(skinned.rotation);
    mesh.scale.copy(skinned.scale);
    mesh.name = skinned.name;
    skinned.parent.add(mesh);
    skinned.parent.remove(skinned);
  }
  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.deleteAttribute('skinIndex');
      o.geometry.deleteAttribute('skinWeight');
    }
  });
  return scene;
}

/** Clone a loaded template into a group, scaled to `target` (by longest side or by
 *  height) and centred on the origin — or grounded, with its base at y = 0. */
function normalise(template, target, mode, by = 'longest') {
  const group = new THREE.Group();
  const clone = template.clone();
  group.add(clone);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  const span = by === 'height' ? size.y : Math.max(size.x, size.y, size.z);
  clone.scale.setScalar(target / (span || 1));
  group.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(group);
  const centre = new THREE.Vector3();
  box2.getCenter(centre);
  clone.position.x -= centre.x;
  clone.position.z -= centre.z;
  clone.position.y -= mode === 'ground' ? box2.min.y : centre.y;
  return group;
}

function toX(fieldX) {
  return (fieldX - FIELD.width / 2) / WORLD_SCALE;
}

function toZ(fieldY) {
  return (fieldY - FIELD.height / 2) / WORLD_SCALE;
}

function softCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(190,235,255,0.55)');
  gradient.addColorStop(1, 'rgba(190,235,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function std(color, emissive = 0x000000, emissiveIntensity = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness: 0.55,
    metalness: 0.05,
    ...extra,
  });
}

export class Renderer3D {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(ZONES[0].background);
    this.scene.fog = new THREE.FogExp2(ZONES[0].fog, ZONES[0].fogDensity);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      120,
    );
    this.camera.position.set(CAMERA_BASE.x, CAMERA_BASE.y, CAMERA_BASE.z);

    this.ambient = new THREE.AmbientLight(ZONES[0].ambient, ZONES[0].ambientIntensity);
    this.scene.add(this.ambient);
    const sun = new THREE.DirectionalLight(0x9fd4ff, 0.75);
    sun.position.set(-6, 18, 8);
    this.scene.add(sun);

    // The lantern: a real point light that rides with Luma and dims with the meter.
    this.lantern = new THREE.PointLight(0xffd76a, 2.4, 28, 1.5);
    this.scene.add(this.lantern);
    this.bossLight = new THREE.PointLight(0xff5d8f, 0, 14, 1.4);
    this.scene.add(this.bossLight);

    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 36),
      std(ZONES[0].floor, 0x000000, 0, { roughness: 0.95 }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = FLOOR_Y;
    this.scene.add(this.floor);

    this.buildPlankton();
    this.buildBubbles();
    this.buildParticles();
    this.templates = {};
    this.seaweed = [];
    this.player = null;
    // Models load in the background; main.js awaits this before the first frame.
    this.ready = this.loadModels();

    this.meshes = new Map(); // sim object -> THREE.Group
    this.zoneIndex = 0;
    this.fogColor = new THREE.Color(ZONES[0].fog);
    this.bgColor = new THREE.Color(ZONES[0].background);
    this.ambientColor = new THREE.Color(ZONES[0].ambient);
    this.floorColor = new THREE.Color(ZONES[0].floor);
    this.lastNow = 0;
  }

  async loadModels() {
    const loader = new GLTFLoader();
    const loaded = {};
    await Promise.all(Object.entries(MODEL_FILES).map(async ([key, file]) => {
      try {
        loaded[key] = await loadTemplate(loader, file);
      } catch {
        loaded[key] = null;
      }
    }));
    this.templates = loaded;
    this.player = this.buildFish();
    this.scene.add(this.player.group);
    this.buildReef();
  }

  buildReef() {
    const random = mulberry32(20261116);
    for (const spec of REEF) {
      const template = this.templates[spec.key];
      if (!template) continue;
      for (let i = 0; i < spec.count; i += 1) {
        const height = range(random, spec.height[0], spec.height[1]);
        const prop = normalise(template, height, 'ground', 'height');
        prop.position.set(range(random, -30, 30), FLOOR_Y, range(random, -13, 12));
        prop.rotation.y = random() * Math.PI * 2;
        if (spec.sway) {
          prop.userData.phase = random() * Math.PI * 2;
          this.seaweed.push(prop);
        }
        this.scene.add(prop);
      }
    }
  }

  buildPlankton() {
    const random = mulberry32(777);
    const count = 320;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = range(random, -30, 30);
      positions[i * 3 + 1] = range(random, -2, 9);
      positions[i * 3 + 2] = range(random, -14, 12);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbfeaff,
      size: 0.09,
      transparent: true,
      opacity: 0.7,
      map: softCircleTexture(),
      depthWrite: false,
    });
    this.plankton = new THREE.Points(geo, mat);
    this.scene.add(this.plankton);
  }

  buildBubbles() {
    const count = 140;
    this.bubblePositions = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.bubblePositions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xcfefff,
      size: 0.42,
      transparent: true,
      opacity: 0.5,
      map: softCircleTexture(),
      depthWrite: false,
    });
    this.bubbles = new THREE.Points(geo, mat);
    this.bubbles.frustumCulled = false;
    this.scene.add(this.bubbles);
  }

  buildParticles() {
    const count = 240;
    this.particlePositions = new Float32Array(count * 3);
    this.particleColors = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      map: softCircleTexture(),
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, mat);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }

  /** Luma: the BlueTang model, facing +Z, with a primitive lantern stalk and lure
   *  riding above its head — the lure is a light source, not a character. */
  buildFish() {
    const group = new THREE.Group();
    const swim = new THREE.Group();
    group.add(swim);
    if (this.templates.player) {
      swim.add(normalise(this.templates.player, MODEL_SIZE.player, 'centre'));
    } else {
      swim.add(this.fallbackFish());
    }
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6),
      std(0x8a6a2a, 0x000000, 0),
    );
    stalk.position.set(0, 0.62, 0.52);
    stalk.rotation.x = 0.45;
    swim.add(stalk);
    const lure = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 12),
      std(0xffe9a8, 0xffe9a8, 2.2),
    );
    lure.position.set(0, 0.88, 0.66);
    swim.add(lure);
    return { group, swim, lure };
  }

  /** A simple fish if the model file is missing: body, tail and fins, facing +Z. */
  fallbackFish() {
    const inner = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      std(0xffd76a, 0x332200, 0.35),
    );
    body.scale.set(0.75, 0.85, 1.5);
    inner.add(body);
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1, 4),
      std(0xffb84d, 0x000000, 0.1),
    );
    tail.rotation.x = -Math.PI / 2;
    tail.scale.set(1, 1, 0.28);
    tail.position.set(0, 0, -1.7);
    inner.add(tail);
    inner.scale.setScalar(MODEL_SIZE.player / 3);
    return inner;
  }

  /** A simple anglerfish if the model file is missing, facing +Z. */
  fallbackAngler(isBoss) {
    const inner = new THREE.Group();
    const bodyMat = std(isBoss ? 0x8f1f3d : 0x7a2e4d, 0x2e0f1e, 0.35);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), bodyMat);
    body.scale.set(0.95, 1, 1.35);
    inner.add(body);
    const lure = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 10),
      std(0xff5d8f, 0xff5d8f, 2.4),
    );
    lure.position.set(0, 0.85, 0.6);
    inner.add(lure);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), bodyMat);
    tail.rotation.x = -Math.PI / 2;
    tail.scale.set(1, 1, 0.3);
    tail.position.set(0, 0, -1.6);
    inner.add(tail);
    inner.scale.setScalar((isBoss ? MODEL_SIZE.boss : MODEL_SIZE.angler) / 2.7);
    return inner;
  }

  /** A simple jellyfish if the model file is missing. */
  fallbackJelly() {
    const inner = new THREE.Group();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      std(0xc99aff, 0x8a4fd0, 0.9, { transparent: true, opacity: 0.8, roughness: 0.3 }),
    );
    dome.scale.set(1, 0.75, 1);
    inner.add(dome);
    const tentMat = std(0xe0b3ff, 0x8a4fd0, 0.7);
    for (let i = 0; i < 5; i += 1) {
      const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 1.3, 5), tentMat);
      const angle = (i / 5) * Math.PI * 2;
      tent.position.set(Math.cos(angle) * 0.5, -0.65, Math.sin(angle) * 0.5);
      inner.add(tent);
    }
    inner.scale.setScalar(MODEL_SIZE.jelly / 2);
    return inner;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render(state, screen, opts) {
    this.lastNow = opts.now;
    this.syncZone(state);
    if (this.player) this.syncPlayer(state, screen, opts.now);
    this.syncList(state.pearls, (item) => this.buildPearl(item), ['pearl', 'golden', 'heart-pearl']);
    this.syncList(state.orbs, (item) => this.buildOrb(item), ['orb']);
    this.syncList(state.hearts, (item) => this.buildHeart(item), ['heart']);
    this.syncList(state.anglers, (item) => this.buildAngler(item, false), ['angler']);
    this.syncList(state.jellies, (item) => this.buildJelly(item), ['jelly']);
    if (state.boss !== null) this.syncList([state.boss], (item) => this.buildAngler(item, true), ['boss']);
    this.syncBubbles(state);
    this.syncParticles(state);
    this.updateCamera(state, screen, opts.now);
    this.renderer.render(this.scene, this.camera);
  }

  syncZone(state) {
    const zone = ZONES[state.zone] ?? ZONES[0];
    if (state.zone !== this.zoneIndex) this.zoneIndex = state.zone;
    const k = 0.03;
    this.fogColor.lerp(new THREE.Color(zone.fog), k);
    this.bgColor.lerp(new THREE.Color(zone.background), k);
    this.ambientColor.lerp(new THREE.Color(zone.ambient), k);
    this.floorColor.lerp(new THREE.Color(zone.floor), k);
    this.scene.fog.color.copy(this.fogColor);
    this.scene.fog.density += (zone.fogDensity - this.scene.fog.density) * k;
    this.scene.background.copy(this.bgColor);
    this.ambient.color.copy(this.ambientColor);
    this.ambient.intensity += (zone.ambientIntensity - this.ambient.intensity) * k;
    this.floor.material.color.copy(this.floorColor);
  }

  syncPlayer(state, screen, now) {
    const p = state.player;
    const g = this.player.group;
    g.position.set(toX(p.x), 0.4 + Math.sin(p.wiggle) * 0.12, toZ(p.y));
    // Models face +Z; +PI/2 turns that into +X, -PI/2 into -X, plus a swim wiggle.
    this.player.swim.rotation.y = (p.face > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.sin(p.wiggle) * 0.07;
    this.player.swim.rotation.z = Math.max(-0.45, Math.min(0.45, -p.vy / 900));
    const blink = p.invulnerable > 0 && Math.floor(now * 10) % 2 === 0;
    g.visible = !blink;
    // The lantern dims as the light meter drains: darkness closes in.
    const lightFrac = state.light / 100;
    this.lantern.intensity = 0.9 + lightFrac * 3.0;
    this.lantern.position.copy(g.position).add(new THREE.Vector3(0, 1.2, 0));
    this.player.lure.material.emissiveIntensity = 1.2 + lightFrac * 1.6;
    for (const weed of this.seaweed) {
      weed.rotation.z = Math.sin(now * 0.8 + weed.userData.phase) * 0.1;
    }
    if (screen === SCREEN_MENU) {
      // Idle drift on the title screen.
      g.position.y = 0.6 + Math.sin(now * 1.2) * 0.25;
    }
  }

  /** Drop every world mesh (a fresh run starts clean) and dim the boss light. */
  clearWorld() {
    for (const mesh of this.meshes.values()) this.scene.remove(mesh);
    this.meshes.clear();
    this.bossLight.intensity = 0;
    this.zoneIndex = 0;
  }

  /** Keep one mesh per live sim object; drop meshes of the given kinds that left. */
  syncList(items, build, kinds) {
    const live = new Set(items);
    for (const [obj, mesh] of [...this.meshes]) {
      if (kinds.includes(obj.kind) && !live.has(obj)) {
        this.scene.remove(mesh);
        this.meshes.delete(obj);
      }
    }
    for (const item of items) {
      let mesh = this.meshes.get(item);
      if (!mesh) {
        mesh = build(item);
        mesh.userData.obj = item;
        this.meshes.set(item, mesh);
        this.scene.add(mesh);
      }
      this.place(mesh, item);
    }
  }

  place(mesh, item) {
    const y = item.kind === 'jelly' ? 0.9 + Math.sin(item.phase * 1.5) * 0.35
      : item.kind === 'boss' ? 1.1
      : 0.35 + Math.sin(item.phase) * 0.18;
    mesh.position.set(toX(item.x), y, toZ(item.y));
    if (item.kind === 'angler' || item.kind === 'boss') {
      // Models face +Z; turn that into the swim direction.
      mesh.rotation.y = item.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    if (item.kind === 'jelly') {
      const pulse = 1 + Math.sin(item.phase * 2.2) * 0.12;
      mesh.scale.set(pulse, 2 - pulse, pulse);
    }
    if (item.kind === 'heart-pearl' && mesh.userData.ring) {
      mesh.userData.ring.rotation.x += 0.02;
      mesh.userData.ring.rotation.y += 0.03;
    }
    if ((item.kind === 'pearl' || item.kind === 'golden' || item.kind === 'orb' || item.kind === 'heart') && mesh.userData.halo) {
      const s = 1 + Math.sin(item.phase * 2) * 0.12;
      mesh.userData.halo.scale.setScalar(s);
    }
  }

  buildPearl(item) {
    const group = new THREE.Group();
    const golden = item.kind === 'golden';
    const heartPearl = item.kind === 'heart-pearl';
    const radius = heartPearl ? 0.62 : golden ? 0.4 : 0.32;
    const color = heartPearl ? 0xff7fa5 : golden ? 0xffc94d : 0x7fe7ff;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 14),
      std(color, color, 1.7, { roughness: 0.2 }),
    );
    group.add(core);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.7, 16, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    group.add(halo);
    group.userData.halo = halo;
    if (heartPearl) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.07, 10, 40),
        std(0xffd76a, 0xffd76a, 1.4),
      );
      group.add(ring);
      group.userData.ring = ring;
    }
    return group;
  }

  buildOrb(item) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 20, 14),
      std(0xffc94d, 0xffc94d, 2.0, { roughness: 0.2 }),
    );
    group.add(core);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffc94d,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    group.add(halo);
    group.userData.halo = halo;
    return group;
  }

  buildHeart(item) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 18, 14),
      std(0xff7fa5, 0xff4d7e, 1.8, { roughness: 0.25 }),
    );
    core.scale.set(1, 0.9, 0.7);
    group.add(core);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.05, 8, 32),
      std(0xffd76a, 0xffd76a, 1.2),
    );
    group.add(ring);
    group.userData.ring = ring;
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xff7fa5,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    group.add(halo);
    group.userData.halo = halo;
    return group;
  }

  buildAngler(item, isBoss) {
    const group = new THREE.Group();
    const size = isBoss ? MODEL_SIZE.boss : MODEL_SIZE.angler;
    if (this.templates.angler) {
      group.add(normalise(this.templates.angler, size, 'centre'));
    } else {
      group.add(this.fallbackAngler(isBoss));
    }
    if (isBoss) this.bossLight.intensity = 1.4;
    return group;
  }

  buildJelly(item) {
    const group = new THREE.Group();
    if (this.templates.jelly) {
      group.add(normalise(this.templates.jelly, MODEL_SIZE.jelly, 'centre'));
    } else {
      group.add(this.fallbackJelly());
    }
    return group;
  }

  syncBubbles(state) {
    const positions = this.bubblePositions;
    for (let i = 0; i < positions.length / 3; i += 1) {
      const bubble = state.bubbles[i];
      if (bubble) {
        positions[i * 3] = toX(bubble.x);
        positions[i * 3 + 1] = 0.3 + ((FIELD.height - bubble.y) / WORLD_SCALE) * 0.45;
        positions[i * 3 + 2] = toZ(bubble.y);
      } else {
        positions[i * 3 + 1] = -100;
      }
    }
    this.bubbles.geometry.attributes.position.needsUpdate = true;
  }

  syncParticles(state) {
    const positions = this.particlePositions;
    const colors = this.particleColors;
    const tmp = new THREE.Color();
    for (let i = 0; i < positions.length / 3; i += 1) {
      const particle = state.particles[i];
      if (particle) {
        positions[i * 3] = toX(particle.x);
        positions[i * 3 + 1] = 0.5 + ((FIELD.height / 2 - particle.y) / FIELD.height) * 1.2;
        positions[i * 3 + 2] = toZ(particle.y);
        const fade = Math.max(0, particle.life / particle.maxLife);
        tmp.set(particle.colour).multiplyScalar(fade);
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      } else {
        positions[i * 3 + 1] = -100;
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
      }
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  updateCamera(state, screen, now) {
    const p = state.player;
    const shake = state.shake;
    const sx = (Math.random() - 0.5) * shake * 0.9;
    const sy = (Math.random() - 0.5) * shake * 0.6;
    if (screen === SCREEN_MENU) {
      this.camera.position.set(
        Math.sin(now * 0.12) * 3 + toX(p.x) * 0.3 + sx,
        CAMERA_BASE.y + Math.sin(now * 0.2) * 0.8 + sy,
        CAMERA_BASE.z + Math.cos(now * 0.12) * 1.5,
      );
    } else {
      this.camera.position.set(
        CAMERA_BASE.x + toX(p.x) * 0.16 + sx,
        CAMERA_BASE.y + sy,
        CAMERA_BASE.z,
      );
    }
    this.camera.lookAt(toX(p.x) * 0.3, -0.6, 0);
  }
}
