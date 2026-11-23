import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const binary = process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron'
const electron = resolve('node_modules/electron/dist', binary)
if (!existsSync(resolve('out/main/index.js'))) {
  console.error('未找到构建产物：请先运行 npm run build')
  process.exit(1)
}
const child = spawn(electron, [resolve('.')], { stdio: 'inherit', env, cwd: process.cwd() })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
