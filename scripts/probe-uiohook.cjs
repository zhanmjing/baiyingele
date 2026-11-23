/**
 * 验证 uiohook-napi 能否在当前运行时启动全局钩子。
 *   node scripts/probe-uiohook.cjs
 *   ELECTRON_RUN_AS_NODE=1 electron.exe scripts/probe-uiohook.cjs
 * 启动后 600ms 自动停止，不会留下常驻钩子。
 */
const result = {
  runtime: { node: process.versions.node, modules: process.versions.modules, electron: process.versions.electron ?? null },
  ok: false
}

try {
  const { uIOhook } = require('uiohook-napi')
  let keyEvents = 0
  uIOhook.on('keydown', () => {
    keyEvents += 1
  })
  uIOhook.start()
  result.started = true

  setTimeout(() => {
    try {
      uIOhook.stop()
      result.stopped = true
    } catch (error) {
      result.stopError = String(error && error.message)
    }
    result.keyEvents = keyEvents
    result.ok = result.started === true && result.stopped === true
    console.log('UIOHOOK_PROBE ' + JSON.stringify(result))
    process.exit(0)
  }, 600)
} catch (error) {
  result.error = String(error && error.message)
  console.log('UIOHOOK_PROBE ' + JSON.stringify(result))
  process.exit(1)
}
