import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export function playIsland({ canvas, container, signal }, world) {
  const { camera, state, tick, setWeather, setHour, site } = world
  const controls = new OrbitControls(camera, canvas)
  controls.target.set(site.x, site.y + 9, site.z)
  controls.enableDamping = true; controls.dampingFactor = 0.055
  controls.minDistance = 12; controls.maxDistance = 520
  controls.maxPolarAngle = Math.PI * 0.495; controls.minPolarAngle = 0.06
  controls.zoomSpeed = 0.85; controls.panSpeed = 0.75; controls.rotateSpeed = 0.55
  controls.update(); controls.saveState()

  const hud = document.createElement('div')
  hud.innerHTML = `
    <style>
      .island-ui{position:absolute;inset:0;pointer-events:none;color:#f7f4ec;font-family:Inter,"Microsoft YaHei",system-ui,sans-serif;text-shadow:0 1px 8px #00141d99;user-select:none}
      .island-ui *{box-sizing:border-box}.island-top{position:absolute;left:28px;right:28px;top:24px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
      .island-title{font-size:12px;letter-spacing:.24em;font-weight:650;text-transform:uppercase}.island-sub{margin-top:7px;font-size:11px;letter-spacing:.09em;color:#f7f4ecbb}
      .island-status{padding:9px 13px;border:1px solid #ffffff26;border-radius:99px;background:#061c2852;backdrop-filter:blur(12px);font-size:11px;letter-spacing:.08em;white-space:nowrap}
      .island-panel{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:min(780px,calc(100% - 32px));padding:13px 15px 12px;border:1px solid #ffffff26;border-radius:18px;background:linear-gradient(135deg,#071b29c9,#10252ab0);box-shadow:0 14px 50px #00101842;backdrop-filter:blur(18px) saturate(1.25);pointer-events:auto}
      .island-row{display:flex;align-items:center;gap:8px}.island-row+.island-row{margin-top:10px}.island-spacer{flex:1}
      .island-ui .island-btn{appearance:none;border:1px solid #ffffff24!important;border-radius:10px;background:#ffffff0b!important;color:#f7f4ec!important;padding:8px 13px;font-family:inherit;font-size:12px;font-weight:600;letter-spacing:.04em;cursor:pointer;transition:background .2s,border-color .2s,color .2s,transform .15s}
      .island-ui .island-btn:hover{background:#ffffff1c!important;border-color:#ffffff55!important;color:white!important}.island-ui .island-btn:active{transform:translateY(1px)}.island-ui .island-btn.active{color:#14282a!important;background:#f3d6a3!important;border-color:#ffe1ae!important;text-shadow:none}
      .island-btn.icon{padding:8px 10px;min-width:38px}.island-label{font-size:11px;color:#f7f4ecae;white-space:nowrap;letter-spacing:.04em}.island-time{font-variant-numeric:tabular-nums;color:#ffe0a9;min-width:47px}
      .island-slider{flex:1;min-width:100px;height:4px;accent-color:#f3d6a3;cursor:pointer}.island-help{position:absolute;left:50%;bottom:128px;transform:translateX(-50%);font-size:11px;letter-spacing:.06em;color:#ffffffa6;white-space:nowrap}
      .island-vignette{position:absolute;inset:0;box-shadow:inset 0 0 130px #00111f36;pointer-events:none}
      @media(max-width:640px){.island-top{left:18px;right:18px;top:18px}.island-status{display:none}.island-panel{bottom:14px;padding:11px}.island-btn{padding:8px 9px;font-size:11px}.island-help{bottom:139px;font-size:9px}.island-row{flex-wrap:wrap}.island-label.auto-label{display:none}}
    </style>
    <div class="island-ui">
      <div class="island-vignette"></div>
      <div class="island-top"><div><div class="island-title">ISLA DEL FARO · 热带海岛</div><div class="island-sub">REAL-TIME FFT OCEAN / PROCEDURAL WORLD</div></div><div class="island-status" data-status>晴天 · 日落</div></div>
      <div class="island-help">左键环绕 · 右键平移 · 滚轮缩放 · 1 / 2 / 3 切换天气 · R 复位</div>
      <div class="island-panel">
        <div class="island-row">
          <button class="island-btn active" data-weather="sunny" title="快捷键 1">晴天</button>
          <button class="island-btn" data-weather="storm" title="快捷键 2">暴雨</button>
          <button class="island-btn" data-weather="night" title="快捷键 3">夜晚</button>
          <span class="island-spacer"></span>
          <button class="island-btn" data-auto>昼夜流转：关</button>
          <button class="island-btn icon" data-pause title="空格：暂停或继续">暂停</button>
          <button class="island-btn icon" data-reset title="R：复位镜头">复位</button>
        </div>
        <div class="island-row"><span class="island-label">光照时间</span><span class="island-label island-time" data-time>17:39</span><input class="island-slider" data-hour type="range" min="0" max="23.99" step="0.01" value="17.65" aria-label="一天中的时间"><span class="island-label auto-label">拖拽可改变太阳、天空与海面反射</span></div>
      </div>
    </div>`
  container.append(hud)
  const $ = selector => hud.querySelector(selector), buttons = [...hud.querySelectorAll('[data-weather]')]
  const timeLabel = $('[data-time]'), hourSlider = $('[data-hour]'), status = $('[data-status]'), autoButton = $('[data-auto]'), pauseButton = $('[data-pause]')
  function weather(name) { setWeather(name); syncButtons(); canvas.focus() }
  function syncButtons() {
    for (const b of buttons) { const active = b.dataset.weather === state.weather; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)) }
    autoButton.textContent = `昼夜流转：${state.auto ? '开' : '关'}`; autoButton.classList.toggle('active', state.auto)
    pauseButton.textContent = state.paused ? '继续' : '暂停'; pauseButton.classList.toggle('active', state.paused)
    status.textContent = ({ sunny: '晴天 · 动态日落', storm: '暴雨 · 强风浪', night: '夜晚 · 灯塔导航' })[state.weather]
  }
  for (const b of buttons) b.addEventListener('click', () => weather(b.dataset.weather), { signal })
  autoButton.addEventListener('click', () => { state.auto = !state.auto; if (state.weather === 'night') setWeather('sunny'); syncButtons() }, { signal })
  pauseButton.addEventListener('click', () => { state.paused = !state.paused; syncButtons() }, { signal })
  $('[data-reset]').addEventListener('click', () => { controls.reset(); canvas.focus() }, { signal })
  hourSlider.addEventListener('input', () => { if (state.weather === 'night') setWeather('sunny'); setHour(hourSlider.value); syncButtons() }, { signal })
  canvas.addEventListener('pointerdown', () => canvas.focus(), { signal })
  canvas.addEventListener('keydown', event => {
    if (event.code === 'Digit1') weather('sunny')
    else if (event.code === 'Digit2') weather('storm')
    else if (event.code === 'Digit3') weather('night')
    else if (event.code === 'KeyR') controls.reset()
    else if (event.code === 'Space') { event.preventDefault(); state.paused = !state.paused; syncButtons() }
  }, { signal })
  syncButtons()
  let elapsed = 0, uiClock = 0
  return {
    update(dt) {
      if (!state.paused) elapsed += dt
      controls.update(); tick(elapsed, state.paused ? 0 : dt, camera)
      uiClock += dt
      if (uiClock > 0.15) {
        uiClock = 0; const h = Math.floor(state.hour) % 24, m = Math.floor((state.hour % 1) * 60)
        timeLabel.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        if (document.activeElement !== hourSlider) hourSlider.value = state.hour
      }
    },
    dispose() { controls.dispose(); hud.remove() },
  }
}
