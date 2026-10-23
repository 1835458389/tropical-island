import { createScene } from './scene.js'

// Add independent scene factories here. Each receives its own SDK instance.
export function createProject() {
  return {
    id: 'tropical-island',
    name: '热带海岛 · 实时天气',
    defaultSceneId: 'main',
    scenes: [{ id: 'main', name: '守望者灯塔', createScene }],
  }
}
