/**
 * 真实实现登记表（渲染层与主进程共用，不能 import electron）。
 *
 * 这里列出的 classId 在 src/main/capabilities.ts 里有真正的副作用实现；
 * 其余类跑的是 layerStore 的模拟 runner，UI 必须标成「模拟」，不能让用户误以为能用。
 * capabilities.ts 用 ImplementedClassId 作为 CAPABILITIES 的键类型，
 * 因此两边少了/多了实现都会在 typecheck 阶段报错。
 */
export const IMPLEMENTED_CLASS_IDS = [
  'win.clipboard.get',
  'text.template',
  'file.write',
  'notify.toast',
  'win.http.request',
  'win.screen.capture'
] as const

export type ImplementedClassId = (typeof IMPLEMENTED_CLASS_IDS)[number]

/** 便于在 Inspector 里说明"这个类真的在做什么" */
export const IMPL_SUMMARY: Record<ImplementedClassId, string> = {
  'win.clipboard.get': 'Electron clipboard.readText / readImage',
  'text.template': '纯函数：把 {{input}} 替换为上游输出',
  'file.write': 'node:fs writeFile / appendFile（~ 展开为主目录）',
  'notify.toast': 'Electron Notification',
  'win.http.request': 'fetch + 10s 超时\n返回 HTTP 状态码与字节数',
  'win.screen.capture': 'desktopCapturer 枚举屏幕源'
}

const IMPLEMENTED = new Set<string>(IMPLEMENTED_CLASS_IDS)

export function hasRealImpl(classId: string): boolean {
  return IMPLEMENTED.has(classId)
}
