const fs = require('node:fs')
const path = require('node:path')

// WebAssembly compilation promises alone do not keep a Node process alive.
const keepAlive = setInterval(() => {}, 1000)
;(async () => {
  // This process owns one request only. Read it before initializing OCCT;
  // no project server work or stdin callbacks run in the Wasm bootstrap.
  const input = fs.readFileSync(0)
  const directory = process.argv[2]
  const factory = require(path.join(directory, 'occt-import-js.js'))
  const params = JSON.parse(fs.readFileSync(path.join(directory, 'import-params.json'), 'utf8'))
  const occt = await factory({ locateFile: (name) => path.join(directory, name) })
  const result = occt.ReadStepFile(new Uint8Array(input), params)
  process.stdout.write(JSON.stringify(result), () => clearInterval(keepAlive))
})().catch(() => {
  process.exitCode = 1
  clearInterval(keepAlive)
})
