import * as THREE from 'three'
import { enableToneMapping } from './environment/tonemap.js'
import { createSky } from './environment/sky.js'
import { createTerrain } from './environment/terrain.js'
import { createRocks } from './environment/rocks.js'
import { createOcean } from './environment/ocean.js'
import { createGrass } from './environment/grass.js'
import { createBirds } from './environment/birds.js'
import { bindParams, excludeFromFraming } from './kit/edit3d.js'
import { playIsland } from './game.js'

const WEATHER = {
  sunny: { clouds: 0.28, wind: 7, waves: 0.78, rain: 0, storm: 0, night: 0 },
  storm: { clouds: 0.84, wind: 18, waves: 1.25, rain: 1, storm: 1, night: 0 },
  night: { clouds: 0.16, wind: 5, waves: 0.58, rain: 0, storm: 0, night: 1 },
}

function rng(seed = 1) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}

function findSite(T) {
  const b = T.bounds, size = b.maxX - b.minX
  let best = null, bestScore = -Infinity
  for (let j = 0; j < 70; j++) for (let i = 0; i < 70; i++) {
    const x = b.minX + size * (0.15 + 0.7 * (i + 0.5) / 70)
    const z = b.minZ + size * (0.15 + 0.7 * (j + 0.5) / 70)
    const h = T.heightAt(x, z) - T.seaLevel, d = T.shoreAt(x, z)
    let s = T.slopeAt(x, z)
    for (const [dx, dz] of [[7, 0], [-7, 0], [0, 7], [0, -7]]) s = Math.max(s, T.slopeAt(x + dx, z + dz))
    const score = -s * 30 - Math.abs(d - 62) / 24 - Math.abs(h - 9) / 4 - (h < 4 ? 12 : 0)
    if (score > bestScore) { bestScore = score; best = { x, z } }
  }
  const e = 25, { x, z } = best
  const gx = T.shoreAt(x + e, z) - T.shoreAt(x - e, z), gz = T.shoreAt(x, z + e) - T.shoreAt(x, z - e)
  const gl = Math.hypot(gx, gz) || 1
  return { x, z, y: T.heightAt(x, z), seaward: new THREE.Vector3(-gx / gl, 0, -gz / gl) }
}

function noiseTexture() {
  const random = rng(91), size = 64, data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const v = 180 + Math.floor(random() * 65)
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(5, 10)
  tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true
  return tex
}

function mesh(geometry, material, parent, position = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material); m.position.set(...position); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m
}

function createLighthouse() {
  const group = new THREE.Group(); group.name = '守望者灯塔'
  const stucco = new THREE.MeshStandardMaterial({ name: '灯塔 · 石灰灰泥', color: '#ddd4c4', roughness: 0.88, map: noiseTexture() })
  const red = new THREE.MeshStandardMaterial({ name: '灯塔 · 朱砂红涂层', color: '#8d251e', roughness: 0.56 })
  const metal = new THREE.MeshStandardMaterial({ name: '灯塔 · 深色金属', color: '#252c30', roughness: 0.36, metalness: 0.72 })
  const stone = new THREE.MeshStandardMaterial({ name: '灯塔 · 基石', color: '#77736b', roughness: 0.94 })
  const glass = new THREE.MeshPhysicalMaterial({ name: '灯塔 · 灯室玻璃', color: '#b9d7dd', roughness: 0.08, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide })
  const lampMat = new THREE.MeshStandardMaterial({ name: '灯塔 · 暖白灯芯', color: '#fff0c2', emissive: '#ffb13b', emissiveIntensity: 2.8, roughness: 0.25 })
  mesh(new THREE.CylinderGeometry(3.65, 4.1, 0.85, 48), stone, group, [0, 0.42, 0])
  mesh(new THREE.CylinderGeometry(2.15, 3.08, 16, 64), stucco, group, [0, 8.75, 0])
  const radiusAt = y => 3.08 + (2.15 - 3.08) * ((y - 0.75) / 16)
  for (const [bottom, top] of [[4.1, 6.25], [10.15, 12.3]]) {
    mesh(new THREE.CylinderGeometry(radiusAt(top) + 0.025, radiusAt(bottom) + 0.025, top - bottom, 64), red, group, [0, (bottom + top) / 2, 0])
  }
  const door = mesh(new THREE.BoxGeometry(1.45, 2.55, 0.22), metal, group, [0, 2.02, 3.0]); door.rotation.x = -0.035
  for (const y of [7.9, 13.65]) {
    mesh(new THREE.BoxGeometry(0.82, 1.35, 0.18), metal, group, [0, y, radiusAt(y) + 0.02])
    mesh(new THREE.BoxGeometry(0.5, 1.03, 0.2), glass, group, [0, y, radiusAt(y) + 0.13])
  }
  mesh(new THREE.CylinderGeometry(3.55, 3.15, 0.45, 64), stone, group, [0, 16.85, 0])
  mesh(new THREE.CylinderGeometry(2.18, 2.18, 0.28, 48), metal, group, [0, 17.18, 0])
  mesh(new THREE.CylinderGeometry(2.0, 2.0, 3.1, 32, 1, true), glass, group, [0, 18.8, 0])
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2
    mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.15, 8), metal, group, [Math.sin(a) * 2.02, 18.8, Math.cos(a) * 2.02])
  }
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.2, 6), metal, group, [Math.sin(a) * 3.25, 17.55, Math.cos(a) * 3.25])
  }
  for (const y of [17.1, 18.05]) {
    const rail = mesh(new THREE.TorusGeometry(3.25, 0.045, 6, 64), metal, group, [0, y, 0]); rail.rotation.x = Math.PI / 2
  }
  const dome = mesh(new THREE.SphereGeometry(2.35, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), red, group, [0, 20.35, 0]); dome.scale.y = 0.62
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.15, 8), metal, group, [0, 21.65, 0])
  mesh(new THREE.SphereGeometry(0.17, 12, 8), metal, group, [0, 22.25, 0])
  const lamp = mesh(new THREE.SphereGeometry(0.48, 20, 12), lampMat, group, [0, 18.8, 0]); lamp.castShadow = false
  const point = new THREE.PointLight('#ffbd62', 0, 45, 1.6); point.position.set(0, 18.8, 0); point.name = '灯塔暖光'; group.add(point)
  const spot = new THREE.SpotLight('#ffd895', 0, 240, 0.105, 0.65, 1.1); spot.position.set(0, 18.8, 0); spot.name = '旋转导航灯'; group.add(spot, spot.target)
  const beamMat = new THREE.MeshBasicMaterial({ name: '灯塔 · 体积光束', color: '#ffd99a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  const beamPivot = new THREE.Group(); beamPivot.position.y = 18.8; group.add(beamPivot)
  const beamGeo = new THREE.ConeGeometry(10, 105, 32, 1, true); beamGeo.translate(0, -52.5, 0)
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.rotation.z = -Math.PI / 2; beamPivot.add(beam)
  const beamBack = new THREE.Mesh(beamGeo, beamMat); beamBack.rotation.z = Math.PI / 2; beamPivot.add(beamBack)
  excludeFromFraming(beam, beamBack)
  return { group, update(t, night, storm) {
    const power = Math.max(night, storm * 0.42)
    point.intensity = 125 * power; spot.intensity = 2200 * power
    lampMat.emissiveIntensity = 0.6 + 4 * power; beamMat.opacity = 0.12 * power
    beamPivot.rotation.y = t * 0.32
    const a = -beamPivot.rotation.y
    spot.target.position.set(-Math.cos(a) * 110, 14, Math.sin(a) * 110)
  } }
}

function frondGeometry() {
  const pos = [], col = [], idx = []
  const push = (x, y, z, shade) => { pos.push(x, y, z); col.push(0.12 * shade, 0.37 * shade, 0.095 * shade); return pos.length / 3 - 1 }
  const segments = 15
  for (let i = 0; i < segments; i++) {
    const t = i / segments, t2 = (i + 1) / segments, z = t * 5.4, z2 = t2 * 5.4
    const y = -1.65 * t * t, y2 = -1.65 * t2 * t2, width = Math.sin(Math.PI * Math.pow(t, 0.72)) * 0.82 * (1 - t * 0.35)
    for (const side of [-1, 1]) {
      const a = push(0, y, z, 0.9 + t * 0.25), b = push(side * width, y - 0.14 - t * 0.12, z - 0.32, 0.78 + t * 0.3), c = push(side * width * 0.78, y2 - 0.12, z2 - 0.18, 1.0), d = push(0, y2, z2, 0.95)
      idx.push(a, b, d, b, c, d)
    }
    const a = push(-0.035, y + 0.025, z, 1.15), b = push(0.035, y + 0.025, z, 1.15), c = push(0.02, y2 + 0.025, z2, 1.1), d = push(-0.02, y2 + 0.025, z2, 1.1)
    idx.push(a, b, d, b, c, d)
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g
}

function trunkGeometry(height, leanX, leanZ, random) {
  const pos = [], colors = [], idx = [], rings = 18, sides = 10
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, r = 0.29 - t * 0.13 + Math.sin(t * 45) * 0.012
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * Math.PI * 2
      pos.push(Math.cos(a) * r + leanX * t * t, height * t, Math.sin(a) * r + leanZ * t * t)
      const shade = 0.67 + 0.19 * Math.sin(t * 92) + random() * 0.08
      colors.push(0.43 * shade, 0.32 * shade, 0.21 * shade)
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < sides; i++) { const a = j * (sides + 1) + i, b = a + sides + 1; idx.push(a, b, a + 1, b, b + 1, a + 1) }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setIndex(idx); g.computeVertexNormals(); return g
}

function createPalms(terrain, placements) {
  const group = new THREE.Group(); group.name = '风动椰林'
  const trunkMat = new THREE.MeshStandardMaterial({ name: '椰树 · 环纹树干', roughness: 0.95, vertexColors: true })
  const leafMat = new THREE.MeshStandardMaterial({ name: '椰树 · 羽状叶片', roughness: 0.76, vertexColors: true, side: THREE.DoubleSide })
  const coconutMat = new THREE.MeshStandardMaterial({ name: '椰树 · 椰子', color: '#514525', roughness: 0.9 })
  const random = rng(73), trees = [], frondsPer = 11
  const leaves = new THREE.InstancedMesh(frondGeometry(), leafMat, placements.length * frondsPer); leaves.castShadow = true; leaves.receiveShadow = true; leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(leaves)
  const coconuts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 9, 7), coconutMat, placements.length * 3); coconuts.castShadow = true; group.add(coconuts)
  const dummy = new THREE.Object3D(), euler = new THREE.Euler(), q = new THREE.Quaternion()
  placements.forEach((p, i) => {
    const h = p.height, leanX = Math.cos(p.lean) * h * 0.12, leanZ = Math.sin(p.lean) * h * 0.12
    const trunk = mesh(trunkGeometry(h, leanX, leanZ, random), trunkMat, group, [p.x, p.y, p.z]); trunk.name = `椰树干 ${i + 1}`
    trees.push({ ...p, h, leanX, leanZ, phase: random() * 10 })
    for (let j = 0; j < frondsPer; j++) leaves.setColorAt(i * frondsPer + j, new THREE.Color().setHSL(0.27 + random() * 0.045, 0.65, 0.48 + random() * 0.14))
    for (let j = 0; j < 3; j++) { dummy.position.set(p.x + leanX + Math.sin(j * 2.1) * 0.32, p.y + h - 0.32 - j * 0.08, p.z + leanZ + Math.cos(j * 2.1) * 0.32); dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); coconuts.setMatrixAt(i * 3 + j, dummy.matrix) }
  })
  return { group, update(t, wind, amount) {
    for (let i = 0; i < trees.length; i++) {
      const p = trees[i], sway = Math.sin(t * 0.72 + p.phase) * 0.055 * amount * (0.5 + wind / 16)
      const gust = Math.sin(t * 1.9 + p.phase * 2.3) * 0.018 * amount * wind / 10
      for (let j = 0; j < frondsPer; j++) {
        const a = j / frondsPer * Math.PI * 2 + p.phase
        dummy.position.set(p.x + p.leanX + sway * p.h * 0.12, p.y + p.h, p.z + p.leanZ + gust * p.h * 0.1)
        euler.set(-0.12 - (j % 3) * 0.13 + sway * 2.2 + gust * Math.sin(a), a, sway * Math.cos(a) + gust, 'YXZ'); q.setFromEuler(euler)
        dummy.quaternion.copy(q); const s = p.scale * (0.88 + (j % 4) * 0.045); dummy.scale.set(s, s, s); dummy.updateMatrix(); leaves.setMatrixAt(i * frondsPer + j, dummy.matrix)
      }
    }
    leaves.instanceMatrix.needsUpdate = true
  } }
}

function createRain() {
  const count = 1800, positions = new Float32Array(count * 6), random = rng(818), drops = []
  for (let i = 0; i < count; i++) drops.push({ x: (random() - 0.5) * 120, y: random() * 65, z: (random() - 0.5) * 120, speed: 32 + random() * 25 })
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
  const material = new THREE.LineBasicMaterial({ name: '暴雨 · 雨线', color: '#b8d2df', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  const object = new THREE.LineSegments(geometry, material); object.frustumCulled = false; object.visible = false
  return { object, update(dt, camera, amount, wind) {
    object.visible = amount > 0.015; material.opacity = amount * 0.48; if (!object.visible) return
    for (let i = 0; i < count; i++) {
      const d = drops[i]; d.y -= d.speed * dt; d.x += wind * dt * 0.42
      if (d.y < -8) { d.y += 68; d.x = (random() - 0.5) * 120; d.z = (random() - 0.5) * 120 }
      if (d.x > 65) d.x -= 130
      const k = i * 6, x = camera.position.x + d.x, y = camera.position.y - 18 + d.y, z = camera.position.z + d.z
      positions[k] = x; positions[k + 1] = y; positions[k + 2] = z
      positions[k + 3] = x - wind * 0.045; positions[k + 4] = y + 1.7; positions[k + 5] = z
    }
    geometry.attributes.position.needsUpdate = true
  } }
}

export async function createScene({ asset }) {
  enableToneMapping({ curve: 'aces' })
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(43, 1, 0.2, 60000); scene.add(camera)
  const params = { hour: 17.65, clouds: 0.28, wind: 7, waveScale: 0.78, palmWind: 1 }
  const state = { weather: 'sunny', hour: params.hour, auto: false, paused: false, current: { ...WEATHER.sunny }, flash: 0 }
  const sky = createSky({ hour: params.hour, clouds: params.clouds, below: 'sea' })
  const sun = new THREE.DirectionalLight('#ffffff', 3); sun.name = '落日主光'; sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 1400 }); sun.shadow.normalBias = 0.045; scene.add(sun, sun.target)
  let terrain = createTerrain({ preset: 'island', seed: 14, grassCover: true, heightScale: 0.82 })
  const site = findSite(terrain), s = site.seaward, side = new THREE.Vector3(-s.z, 0, s.x), rotation = Math.atan2(s.x, s.z)
  const pad = { x: site.x, z: site.z, width: 15, depth: 15, angle: -rotation }, probe = terrain
  terrain = createTerrain({ preset: 'island', seed: 14, grassCover: true, heightScale: 0.82, material: probe.material, pads: [pad] }); probe.dispose(true); site.y = terrain.pads[0].y
  const at = (along, across) => ({ x: site.x + s.x * along + side.x * across, z: site.z + s.z * along + side.z * across })
  sun.target.position.set(site.x, site.y + 6, site.z)
  const grass = createGrass({ heightTexture: terrain.heightTexture, bounds: terrain.bounds, height: 0.72, density: 0.72, radius: 78, dryness: 0.32, seed: 8 }); terrain.setMeadowColor(grass.groundColor)
  const ocean = createOcean({ windSpeed: params.wind, waveScale: params.waveScale, windDirection: 38, swellDirection: 32, seabed: terrain, time: 12, deepColor: '#082c3b', scatterColor: '#238b83' })
  const rocks = createRocks({ heightAt: terrain.heightAt, mask: terrain.boulderAt, area: { x: site.x, z: site.z, radius: 250 }, count: 115, sizeRange: [0.55, 4.4], seed: 34 })
  const lighthouse = createLighthouse(); lighthouse.group.position.set(site.x, site.y, site.z); lighthouse.group.rotation.y = rotation
  const random = rng(511), placements = []
  for (let tries = 0; tries < 500 && placements.length < 22; tries++) {
    const along = -125 + random() * 150, across = (random() - 0.5) * 190, p = at(along, across), y = terrain.heightAt(p.x, p.z)
    if (y - terrain.seaLevel < 2.2 || terrain.slopeAt(p.x, p.z) > 0.34 || Math.hypot(p.x - site.x, p.z - site.z) < 18) continue
    if (placements.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 8)) continue
    placements.push({ ...p, y, height: 8.5 + random() * 6, scale: 0.75 + random() * 0.35, lean: rotation + (random() - 0.5) * 1.2 })
  }
  const palms = createPalms(terrain, placements), rain = createRain()
  const birds = createBirds({ count: 16, area: { ...at(85, 0), radius: 125 }, height: [12, 34], heightAt: terrain.heightAt, seed: 7 })
  const lightning = new THREE.DirectionalLight('#c9dcff', 0); lightning.position.set(site.x - 100, site.y + 250, site.z - 180); lightning.name = '暴雨闪电'; scene.add(lightning)
  scene.add(terrain.mesh, grass.object, ocean.mesh, rocks.group, lighthouse.group, palms.group, rain.object, birds.object)
  sky.applyTo(scene, { sun, targets: [ocean] })
  excludeFromFraming(terrain.mesh, ocean.mesh, rocks.group, palms.group, grass.object, birds.object, rain.object, sky.object)
  camera.position.set(site.x - s.x * 45 + side.x * 85, site.y + 32, site.z - s.z * 45 + side.z * 85)
  camera.lookAt(site.x, site.y + 9, site.z)
  asset.register('scene', scene, { name: '热带海岛' }); asset.register('camera_main', camera, { name: '电影主镜头' })
  asset.register('sky', sky.object, { name: '动态天空' }); asset.register('terrain', terrain.mesh, { name: '海岛与沙滩' }); asset.register('ocean', ocean.mesh, { name: 'FFT 海浪' })
  asset.register('lighthouse', lighthouse.group, { name: '守望者灯塔' }); asset.register('palms', palms.group, { name: '风动椰林' }); asset.register('rocks', rocks.group, { name: '海岸礁石' })
  asset.register('grass', grass.object, { name: '海岛草地' }); asset.register('birds', birds.object, { name: '海鸥' }); asset.register('rain', rain.object, { name: '暴雨雨幕' })
  const off = bindParams(asset, 'environment', params, {
    hour: { type: 'number', label: '时间（小时）', min: 0, max: 24, step: 0.05 },
    clouds: { type: 'number', label: '云量', min: 0, max: 1, step: 0.02 },
    wind: { type: 'number', label: '晴天风速（m/s）', min: 1, max: 20, step: 0.5 },
    waveScale: { type: 'number', label: '基础浪高倍数', min: 0.1, max: 2, step: 0.05 },
    palmWind: { type: 'number', label: '椰叶风摆幅度', min: 0, max: 2.5, step: 0.05 },
  }, p => { state.hour = p.hour; sky.setHour(p.hour); sky.set({ clouds: p.clouds }); ocean.setWaves({ windSpeed: p.wind, waveScale: p.waveScale }) }, { name: '海岛环境', objectId: 'sky' })
  let envClock = 0
  function tick(t, dt, viewCamera) {
    if (!state.paused) {
      if (state.auto && state.weather !== 'night') state.hour = (state.hour + dt * 0.025) % 24
      const k = 1 - Math.exp(-dt * 1.7), target = WEATHER[state.weather]
      for (const key of ['clouds', 'wind', 'waves', 'rain', 'storm', 'night']) state.current[key] += (target[key] - state.current[key]) * k
      envClock += dt
      if (envClock > 0.25) {
        envClock = 0; params.hour = state.hour; sky.setHour(state.hour); sky.set({ clouds: state.current.clouds })
        ocean.setWaves({ windSpeed: state.current.wind, waveScale: state.current.waves, choppiness: 1.2 + state.current.storm * 0.65, foam: 0.9 + state.current.storm * 0.5 })
      }
      if (state.current.storm > 0.72 && Math.random() < dt * 0.16) state.flash = 1
      state.flash = Math.max(0, state.flash - dt * 4.8)
    }
    const c = state.current
    sun.intensity = sky.sunIntensity * (1 - c.storm * 0.74); scene.environmentIntensity = (1.22 - c.storm * 0.62) * (1 - c.night * 0.18)
    lightning.intensity = state.flash * state.flash * 8 * c.storm
    ocean.update(12 + t); terrain.update(t); grass.update(t); palms.update(t, c.wind, params.palmWind); birds.update(t); sky.update(t)
    lighthouse.update(t, c.night, c.storm); if (viewCamera) rain.update(dt, viewCamera, c.rain, c.wind)
  }
  function setWeather(weather) {
    if (!WEATHER[weather]) return
    state.weather = weather
    if (weather === 'night') { state.hour = 23; state.auto = false }
    else if (weather === 'storm') { state.hour = 12.5; state.auto = false }
    else state.hour = 17.65
  }
  function setHour(hour) { state.hour = THREE.MathUtils.clamp(Number(hour), 0, 24) % 24; params.hour = state.hour }
  tick(0, 0, camera)
  scene.userData.site = site
  return {
    scene, camera,
    play: context => playIsland(context, { camera, state, tick, setWeather, setHour, site }),
    dispose() {
      off(); const resources = new Set(); scene.traverse(o => { if (o.geometry) resources.add(o.geometry); for (const m of [o.material].flat()) if (m) { resources.add(m); if (m.map) resources.add(m.map) } })
      for (const r of resources) r.dispose(); ocean.dispose(); sky.dispose()
    },
  }
}
