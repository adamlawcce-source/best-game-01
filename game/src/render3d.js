// Glimmerdeep in real 3D (Three.js r186, vendored locally under game/vendor/three/).
// The simulation still thinks in the 1280x720 logical field; this file maps it onto a
// seabed plane: field x -> world X, field y -> world Z (up-screen is far), with the fish
// swimming a little above the floor. Every model is built from primitives with emissive
// materials — no external model, texture or sound files, so the game stays fully offline.

import * as THREE from 'three';
import { FIELD, PEARLS_TO_WIN, WORLD_SCALE, ZONES } from './config.js';
import { mulberry32, range } from './random.js';

export const SCREEN_MENU = 'menu';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

const FLOOR_Y = -2.6;
const CAMERA_BASE = { x: 0, y: 10.8, z: 21.5 };

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

    this.buildReef();
    this.buildPlankton();
    this.buildBubbles();
    this.buildParticles();
    this.player = this.buildFish();
    this.scene.add(this.player.group);

    this.meshes = new Map(); // sim object -> THREE.Group
    this.zoneIndex = 0;
    this.fogColor = new THREE.Color(ZONES[0].fog);
    this.bgColor = new THREE.Color(ZONES[0].background);
    this.ambientColor = new THREE.Color(ZONES[0].ambient);
    this.floorColor = new THREE.Color(ZONES[0].floor);
    this.lastNow = 0;
  }

  buildReef() {
    const random = mulberry32(20261116);
    this.seaweed = [];
    const rockMat = std(0x2a3f4d, 0x000000, 0, { roughness: 0.9, flatShading: true });
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 18; i += 1) {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const s = range(random, 0.7, 2.4);
      rock.scale.set(s, s * range(random, 0.5, 0.8), s);
      rock.position.set(range(random, -30, 30), FLOOR_Y + s * 0.25, range(random, -13, 13));
      rock.rotation.y = random() * Math.PI * 2;
      this.scene.add(rock);
    }
    const coralCols = [0xff7f9e, 0xff9e5e, 0xc97fff, 0x5ec8a0];
    const coralGeo = new THREE.ConeGeometry(0.7, 2.4, 7);
    for (let i = 0; i < 11; i += 1) {
      const coral = new THREE.Mesh(coralGeo, std(coralCols[i % coralCols.length], coralCols[i % coralCols.length], 0.35, { flatShading: true }));
      const s = range(random, 0.6, 1.5);
      coral.scale.set(s, s, s);
      coral.position.set(range(random, -28, 28), FLOOR_Y + 1.1 * s, range(random, -12, 9));
      coral.rotation.z = range(random, -0.15, 0.15);
      this.scene.add(coral);
    }
    const weedGeo = new THREE.ConeGeometry(0.32, 3.2, 6);
    const weedMat = std(0x1d9e78, 0x0e5f4a, 0.25);
    for (let i = 0; i < 15; i += 1) {
      const weed = new THREE.Mesh(weedGeo, weedMat);
      weed.position.set(range(random, -30, 30), FLOOR_Y + 1.5, range(random, -12, 11));
      weed.userData.phase = random() * Math.PI * 2;
      this.seaweed.push(weed);
      this.scene.add(weed);
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

  /** Luma: body, tail, fins, eyes and the lantern stalk with its glowing lure. */
  buildFish() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      std(0xffd76a, 0x332200, 0.35),
    );
    body.scale.set(1.5, 0.85, 0.75);
    group.add(body);
    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 18, 12),
      std(0xfff3c4, 0x000000, 0.1),
    );
    belly.scale.set(1.2, 0.6, 0.6);
    belly.position.set(0.1, -0.3, 0);
    group.add(belly);
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.1, 4),
      std(0xffb84d, 0x000000, 0.1),
    );
    tail.rotation.z = Math.PI / 2;
    tail.scale.set(1, 1, 0.28);
    tail.position.set(-1.85, 0, 0);
    group.add(tail);
    const fin = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.7, 4),
      std(0xffb84d, 0x000000, 0.1),
    );
    fin.position.set(-0.2, 0.85, 0);
    fin.scale.set(1, 1, 0.3);
    group.add(fin);
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6),
      std(0x8a6a2a, 0x000000, 0),
    );
    stalk.position.set(0.9, 0.75, 0);
    stalk.rotation.z = -0.5;
    group.add(stalk);
    const lure = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 12),
      std(0xffe9a8, 0xffe9a8, 2.2),
    );
    lure.position.set(1.25, 1.15, 0);
    group.add(lure);
    const eyeWhite = std(0xffffff, 0x000000, 0);
    const pupil = std(0x111111, 0x000000, 0);
    for (const side of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), eyeWhite);
      eye.position.set(0.85, 0.28, side * 0.42);
      group.add(eye);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), pupil);
      dot.position.set(0.98, 0.28, side * 0.5);
      group.add(dot);
    }
    group.scale.setScalar(0.75);
    return { group, tail, lure };
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
    this.syncPlayer(state, screen, opts.now);
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
    g.rotation.y = p.face > 0 ? 0 : Math.PI;
    g.rotation.z = Math.max(-0.45, Math.min(0.45, -p.vy / 900));
    const blink = p.invulnerable > 0 && Math.floor(now * 10) % 2 === 0;
    g.visible = !blink;
    this.player.tail.rotation.y = Math.sin(p.wiggle) * 0.45;
    // The lantern dims as the light meter drains: darkness closes in.
    const lightFrac = state.light / 100;
    this.lantern.intensity = 0.9 + lightFrac * 3.0;
    this.lantern.position.copy(g.position).add(new THREE.Vector3(0, 1.2, 0));
    this.player.lure.material.emissiveIntensity = 1.2 + lightFrac * 1.6;
    for (const weed of this.seaweed) {
      weed.rotation.z = Math.sin(now * 0.8 + weed.userData.phase) * 0.12;
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
      mesh.rotation.y = item.direction > 0 ? 0 : Math.PI;
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
    const scale = isBoss ? 1.45 : 0.65;
    const bodyMat = isBoss
      ? std(0x8f1f3d, 0x4a0f22, 0.4)
      : std(0x7a2e4d, 0x2e0f1e, 0.35);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), bodyMat);
    body.scale.set(1.35, 1, 0.95);
    group.add(body);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), bodyMat);
    jaw.scale.set(1.1, 0.55, 0.8);
    jaw.position.set(0.45, -0.45, 0);
    group.add(jaw);
    const toothMat = std(0xf4f0e6, 0x000000, 0);
    for (let i = 0; i < 5; i += 1) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 5), toothMat);
      tooth.position.set(0.95 - i * 0.28, -0.28, i % 2 === 0 ? 0.3 : -0.3);
      tooth.rotation.x = Math.PI;
      group.add(tooth);
    }
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6),
      std(0x4a1c33, 0x000000, 0),
    );
    stalk.position.set(0.7, 0.85, 0);
    stalk.rotation.z = -0.5;
    group.add(stalk);
    const lure = new THREE.Mesh(
      new THREE.SphereGeometry(isBoss ? 0.34 : 0.22, 14, 10),
      std(0xff5d8f, 0xff5d8f, 2.4),
    );
    lure.position.set(1.05, 1.2, 0);
    group.add(lure);
    const eyeMat = std(0xffffff, 0xff2a4d, 1.2);
    for (const side of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), eyeMat);
      eye.position.set(0.85, 0.3, side * 0.55);
      group.add(eye);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), bodyMat);
    tail.rotation.z = Math.PI / 2;
    tail.scale.set(1, 1, 0.3);
    tail.position.set(-1.5, 0, 0);
    group.add(tail);
    group.scale.setScalar(scale);
    if (isBoss) this.bossLight.intensity = 1.4;
    return group;
  }

  buildJelly(item) {
    const group = new THREE.Group();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      std(0xc99aff, 0x8a4fd0, 0.9, { transparent: true, opacity: 0.8, roughness: 0.3 }),
    );
    dome.scale.set(1, 0.75, 1);
    group.add(dome);
    const tentMat = std(0xe0b3ff, 0x8a4fd0, 0.7);
    for (let i = 0; i < 5; i += 1) {
      const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 1.3, 5), tentMat);
      const angle = (i / 5) * Math.PI * 2;
      tent.position.set(Math.cos(angle) * 0.5, -0.65, Math.sin(angle) * 0.5);
      group.add(tent);
    }
    group.scale.setScalar(0.55);
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
