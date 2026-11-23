import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const mode = process.argv[2] === 'preview' ? 'preview' : 'dev'
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const cli = resolve('node_modules/electron-vite/bin/electron-vite.js')
const child = spawn(process.execPath, [cli, mode], { stdio: 'inherit', env, cwd: process.cwd() })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
