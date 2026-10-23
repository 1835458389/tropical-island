import { mountProjectEditor, createHttpPersistence } from '@edit3d/sdk/editor'
import { createProject } from './project.js'

async function main() {
  await mountProjectEditor({
    persistence: createHttpPersistence(),
    container: document.getElementById('app'),
    project: await createProject(),
  })
}
main().catch((error) => {
  document.getElementById('app').textContent = `Edit3D 启动失败：${error.message}`
  console.error(error)
})
