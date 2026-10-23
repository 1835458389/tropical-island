import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('.', import.meta.url))
const output = resolve(root, '../tropical-island.html')
const result = await build({
  entryPoints: [resolve(root, 'standalone-entry.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  minify: false,
  write: false,
  legalComments: 'inline',
})
const code = result.outputFiles[0].text.replaceAll('</script', '<\\/script')
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>热带海岛 · Three.js 单文件版</title>
<style>
html,body,#app,#interface{width:100%;height:100%;margin:0;overflow:hidden}
html,body,#app{background:#06131d}
body{position:fixed;inset:0}#app{position:absolute;inset:0}#app canvas{display:block;width:100%;height:100%;outline:none}
#interface{position:absolute;inset:0;pointer-events:none}
#loading{position:fixed;inset:0;z-index:20;display:grid;place-items:center;background:radial-gradient(circle at 50% 38%,#173b4b,#06131d 70%);color:#f4dfb7;font:500 13px system-ui;letter-spacing:.18em;transition:opacity .6s;pointer-events:none}
#loading.done{opacity:0}#loading span:after{content:'';display:block;width:120px;height:1px;margin:18px auto;background:linear-gradient(90deg,transparent,#f4dfb7,transparent);animation:pulse 1.4s infinite}
@keyframes pulse{50%{transform:scaleX(.35);opacity:.35}}
#error{display:none;position:fixed;inset:20px;z-index:30;padding:24px;background:#241516;color:#ffd8cd;font:14px/1.7 monospace;white-space:pre-wrap;overflow:auto}
</style>
</head>
<body>
<div id="app"></div><div id="interface"></div>
<div id="loading"><span>正在生成海岛与海浪</span></div><pre id="error"></pre>
<script>
window.addEventListener('error',function(e){var el=document.getElementById('error');el.style.display='block';el.textContent='场景启动失败：\\n'+(e.error&&e.error.stack||e.message)});
window.addEventListener('unhandledrejection',function(e){var el=document.getElementById('error');el.style.display='block';el.textContent='场景启动失败：\\n'+(e.reason&&e.reason.stack||e.reason)});
</script>
<script>
${code}
</script>
</body></html>`
await writeFile(output, html)
console.log(`${output} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`)
