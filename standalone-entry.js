import * as THREE from 'three'
import { createScene } from './src/scene.js'

// 单文件分享版：不需要 Edit3D、服务器、CDN 或任何外部资源。
async function main() {
const mount = document.getElementById('app')
const overlay = document.getElementById('interface')
const loading = document.getElementById('loading')
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping // 环境模块在着色器中执行 ACES 曲线
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.domElement.tabIndex = 0
renderer.domElement.setAttribute('aria-label', '交互式三维热带海岛')
mount.append(renderer.domElement)

// 复用场景源码；编辑器注册在分享版中是无操作接口。
const asset = { register() {}, registerParams() {}, subscribe() { return () => {} } }
const runtime = await createScene({ asset })
const { scene, camera } = runtime
camera.aspect = window.innerWidth / window.innerHeight
camera.updateProjectionMatrix()
const abort = new AbortController()
const session = runtime.play({ canvas: renderer.domElement, container: overlay, signal: abort.signal })

function resize() {
  const width = window.innerWidth, height = window.innerHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}
window.addEventListener('resize', resize, { signal: abort.signal })

const clock = new THREE.Clock()
let firstFrame = true
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.06)
  session.update(dt)
  renderer.setRenderTarget(null) // 天空环境预烘焙后，必须明确恢复默认帧缓冲
  renderer.render(scene, camera)
  if (firstFrame) {
    firstFrame = false
    loading.classList.add('done')
    setTimeout(() => loading.remove(), 650)
  }
})

window.addEventListener('pagehide', event => {
  if (event.persisted) return
  abort.abort()
  renderer.setAnimationLoop(null)
  session.dispose()
  runtime.dispose()
  renderer.dispose()
}, { signal: abort.signal })

// 研究入口：浏览器控制台可查看实时场景、相机和渲染器。
window.__island = { scene, camera, renderer, runtime, session, THREE }
}

main().catch(error => {
  const panel = document.getElementById('error')
  panel.style.display = 'block'
  panel.textContent = `场景启动失败：\n${error.stack || error}`
})
