# 低级钩子与输入设备触发器：功能类与实例设计（v0.1）

> 问题：低级钩子（键盘、鼠标等输入设备）作为触发器，功能类与实例应该怎么设计？
>
> 结论：不要把“一个快捷键/一个手势”做成一个类。拆成四层：
>
> **InputDeviceClass（设备） → InputSourceClass（采集机制） → InputPatternClass（识别模式） → InputBindingInstance（绑定目标）**
>
> 低级钩子只是 **InputSourceClass** 的一种实现；它只负责把原始输入规范化成 `InputEvent`，不负责业务动作。

---

## 0. 一句话结论

```text
输入设备
  → InputSourceInstance（WH_KEYBOARD_LL / WH_MOUSE_LL / Raw Input / RegisterHotKey / Gamepad / HID）
  → InputEvent（规范化事件）
  → InputPatternInstance（快捷键 / 序列 / 长按 / 手势 / 滚轮 / 触控 / 摇杆）
  → InputMatch（识别结果）
  → InputBindingInstance（作用域 + 条件 + 目标）
  → PointInstance / FlowInstance / SurfaceInstance / BodyInstance / SkillInstance
```

- **设备**：键盘、鼠标、触控板、笔、手柄、HID。
- **采集机制**：低级钩子、Raw Input、RegisterHotKey、轮询、Pointer/HID。
- **识别模式**：chord、sequence、hold、gesture、wheel、swipe、axis。
- **绑定实例**：source + pattern + target + scope + priority + suppression。

---

## 1. 为什么必须拆开

如果做成：

```text
class CtrlAltE
class MouseLDR
class X1Hold
```

会爆炸：

- 每个快捷键一个类。
- 每个手势一个类。
- 同一个手势换目标要新建类。
- 同一个目标换按键要新建类。
- 无法复用识别算法。

正确拆法：

```text
InputSourceClass: input.source.mouse.lowlevel
  instance: mouse.right@r1

InputPatternClass: input.pattern.mouse.gesture
  instance: mouse.gesture.ldr@r1

InputBindingInstance: input.binding.mouse.ldr-github@r1
  source: mouse.right@r1
  pattern: mouse.gesture.ldr@r1
  target: inst.site-github@r1
```

新增一个手势只是新的 **pattern instance**；换目标只是新的 **binding instance**。

---

## 2. 对象模型

### 2.1 InputDeviceClass / Instance

```ts
type InputDeviceClass = {
  id: string;                    // input.device.mouse
  version: string;
  capabilities: ("keys" | "buttons" | "wheel" | "axes" | "touch" | "pressure" | "hid")[];
};

type InputDeviceInstance = {
  id: string;                    // input.device.mouse.logitech-g502
  deviceClassId: string;
  deviceClassVersion: string;
  vendorId?: number;
  productId?: number;
  path?: string;                 // Raw Input device path
  capabilities: string[];
  revision: number;
};
```

设备实例是可选的；P0 可以只用“通用键盘/鼠标”，P1 再做 per-device。

### 2.2 InputSourceClass / Instance

```ts
type InputSourceClass = {
  id: string;                    // input.source.mouse.lowlevel
  version: string;
  mechanism: "lowlevel_hook" | "raw_input" | "register_hotkey" | "poll" | "pointer" | "hid";
  supports: ("down" | "up" | "move" | "wheel" | "axis" | "touch" | "pressure" | "suppress")[];
};

type InputSourceInstance = {
  id: string;                    // input.source.mouse.lowlevel.right
  sourceClassId: string;
  sourceClassVersion: string;
  deviceRef?: string;            // 可选：特定设备
  params: {
    buttonFilter?: "left" | "right" | "middle" | "x1" | "x2";
    keyFilter?: string[];
    ignoreInjected?: boolean;
    suppress?: "pass" | "owned_button" | "remap_table";
    queueCapacity?: number;
    rawInputFallback?: boolean;
  };
  revision: number;
  enabled: boolean;
};
```

### 2.3 InputPatternClass / Instance

```ts
type InputPatternClass = {
  id: string;                    // input.pattern.mouse.gesture
  version: string;
  kind: "key_chord" | "key_sequence" | "hold" | "double_tap" | "mouse_button" | "mouse_chord"
      | "wheel" | "mouse_gesture" | "drag" | "region" | "touch_swipe" | "pinch" | "pen_pressure"
      | "gamepad_button" | "gamepad_axis" | "hid_report";
};

type InputPatternInstance = {
  id: string;                    // input.pattern.mouse.gesture.ldr
  patternClassId: string;
  patternClassVersion: string;
  params: Record<string, unknown>;
  revision: number;
};
```

### 2.4 InputBindingInstance

```ts
type InputTarget =
  | { kind: "point"; id: string; revision: number }
  | { kind: "flow"; id: string; revision: number }
  | { kind: "surface"; id: string; revision: number }
  | { kind: "body"; id: string; revision: number }
  | { kind: "field"; id: string; revision: number }
  | { kind: "skill"; id: string; revision: number };

type InputBindingInstance = {
  id: string;                    // input.binding.mouse.ldr-github
  sourceRef: string;             // input.source.mouse.lowlevel.right@r1
  patternRef: string;            // input.pattern.mouse.gesture.ldr@r1
  target: InputTarget;           // inst.site-github@r1

  scope: {
    app?: string;                // chrome.exe
    device?: string;             // mouse.logitech-g502
    user?: string;
    session?: string;
  };

  conditions?: {
    foregroundApp?: string[];
    windowClass?: string[];
    timeRange?: string;
    powerState?: "ac" | "battery" | "any";
    permission?: string;
  };

  phase: "down" | "up" | "repeat" | "hold_start" | "hold_end" | "done" | "axis";
  suppression: "pass" | "owned_button" | "remap_table" | "suppress_on_match";
  priority: number;
  enabled: boolean;
  revision: number;
};
```

---

## 3. 功能类目录

### 3.1 设备类

| Class | 职责 | 实例示例 |
|---|---|---|
| `input.device.keyboard` | 键盘设备描述 | `keyboard.builtin`、`keyboard.external` |
| `input.device.mouse` | 鼠标设备描述 | `mouse.logitech-g502`、`mouse.trackpad` |
| `input.device.touchpad` | 精密触控板 | `touchpad.precision` |
| `input.device.pen` | 笔/触控笔 | `pen.surface-pen` |
| `input.device.gamepad` | 手柄 | `gamepad.xbox`、`gamepad.dualsense` |
| `input.device.hid` | 通用 HID | `hid.custom-controller` |

### 3.2 采集机制类

| Class | 机制 | 能力 | 实例示例 |
|---|---|---|---|
| `input.source.keyboard.lowlevel` | `WH_KEYBOARD_LL` | 全局按键、可抑制、可看注入 | `physical`、`ignore-injected`、`remap-layer` |
| `input.source.keyboard.raw` | Raw Input | 高频、按设备、不可抑制 | `per-device`、`gaming` |
| `input.source.hotkey` | `RegisterHotKey` | 全局快捷键、不抑制 | `global`、`app-scoped` |
| `input.source.mouse.lowlevel` | `WH_MOUSE_LL` | 全局鼠标、可抑制、手势 | `right`、`x1`、`wheel`、`chord` |
| `input.source.mouse.raw` | Raw Input | 高频、按设备、不可抑制 | `high-frequency`、`per-device` |
| `input.source.touchpad.raw` | Precision Touchpad / HID | 多指手势 | `three-finger`、`four-finger` |
| `input.source.pen.pointer` | Pointer Input | 笔压、倾斜、桶键 | `barrel`、`eraser` |
| `input.source.gamepad.poll` | XInput / GameInput | 按钮、摇杆、扳机 | `xinput`、`hid` |
| `input.source.hid.raw` | HID Report | 自定义设备 | `custom-controller` |

### 3.3 识别模式类

| Class | 识别 | 实例示例 |
|---|---|---|
| `input.pattern.key.chord` | 组合键 | `Ctrl+Alt+E`、`Win+Shift+S` |
| `input.pattern.key.sequence` | 按键序列 | `g g`、`Ctrl+K Ctrl+S` |
| `input.pattern.key.hold` | 长按 | `CapsLock hold 500ms` |
| `input.pattern.key.double-tap` | 双击键 | `Ctrl double` |
| `input.pattern.mouse.button` | 单键 | `right click`、`middle click`、`x1` |
| `input.pattern.mouse.chord` | 多键组合 | `left+right`、`right+x1` |
| `input.pattern.mouse.wheel` | 滚轮 | `wheel up`、`wheel down`、`horizontal` |
| `input.pattern.mouse.gesture` | 方向手势 | `LDR`、`UD`、`RL` |
| `input.pattern.mouse.drag` | 拖拽 | `right drag`、`middle drag` |
| `input.pattern.mouse.region` | 屏幕区域/热角 | `top-left corner`、`edge` |
| `input.pattern.touch.swipe` | 触控板滑动 | `3-finger up`、`4-finger left` |
| `input.pattern.touch.pinch` | 捏合/旋转 | `pinch in`、`rotate` |
| `input.pattern.pen.pressure` | 笔压/倾斜 | `barrel + drag`、`pressure > 0.7` |
| `input.pattern.gamepad.button` | 手柄按钮 | `LB+RB`、`Guide` |
| `input.pattern.gamepad.axis` | 摇杆/扳机 | `LS up`、`RT > 0.8` |
| `input.pattern.hid.report` | HID 报告 | `report[0] == 0x01` |

### 3.4 绑定与运行

| Class | 职责 |
|---|---|
| `input.binding` | source + pattern + target + scope + conditions + priority |
| `input.run` | 一次触发记录：eventIds / pattern / target / latency / suppressed / status |

---

## 4. 实例目录

### 4.1 键盘

```text
input.source.keyboard.lowlevel.physical@r1
  ignoreInjected=true · suppress=pass · queueCapacity=4096

input.source.keyboard.lowlevel.ignore-injected@r1
  ignoreInjected=true · suppress=pass

input.source.keyboard.lowlevel.remap-layer@r1
  ignoreInjected=true · suppress=remap_table

input.source.keyboard.raw.per-device@r1
  device=keyboard.external · suppress=none

input.source.hotkey.global@r1
  mechanism=register_hotkey · suppress=none

input.pattern.key.chord.ctrl-alt-e@r1
  keys=[Ctrl,Alt,E] · phase=down

input.pattern.key.sequence.gg@r1
  keys=[G,G] · timeoutMs=600

input.pattern.key.hold.capslock@r1
  key=CapsLock · holdMs=500 · phase=hold_start

input.pattern.key.double-tap.ctrl@r1
  key=Ctrl · maxGapMs=280
```

### 4.2 鼠标 / 手势

```text
input.source.mouse.lowlevel.right@r1
  buttonFilter=right · ignoreInjected=true · suppress=owned_button

input.source.mouse.lowlevel.x1@r1
  buttonFilter=x1 · ignoreInjected=true · suppress=owned_button

input.source.mouse.lowlevel.wheel@r1
  buttonFilter=wheel · ignoreInjected=true · suppress=pass

input.source.mouse.raw.high-frequency@r1
  device=mouse.logitech-g502 · suppress=none

input.pattern.mouse.button.right@r1
  button=right · phase=down

input.pattern.mouse.button.x1-hold@r1
  button=x1 · holdMs=450 · phase=hold_start

input.pattern.mouse.chord.left-right@r1
  buttons=[left,right] · maxGapMs=80

input.pattern.mouse.wheel.up@r1
  direction=up · step=1

input.pattern.mouse.gesture.ldr@r1
  pattern=LDR · dirs8=true · minSegmentPx=30 · minTotalPx=60
  timeoutMs=2000 · dragSuppressPx=400 · confirmSteps=2 · fuzzy=false

input.pattern.mouse.drag.right@r1
  button=right · minDistancePx=24 · phase=done

input.pattern.mouse.region.top-left@r1
  region=top-left · edgePx=8 · dwellMs=120
```

### 4.3 触控板 / 笔 / 手柄

```text
input.source.touchpad.raw.three-finger@r1
  fingers=3 · suppress=pass

input.pattern.touch.swipe.up-3@r1
  fingers=3 · direction=up · minDistancePx=80

input.source.pen.pointer.barrel@r1
  button=barrel · pressure=true

input.pattern.pen.pressure.barrel-drag@r1
  button=barrel · minPressure=0.3 · minDistancePx=40

input.source.gamepad.poll.xinput@r1
  api=xinput · deadzone=0.18

input.pattern.gamepad.button.lb-rb@r1
  buttons=[LB,RB] · holdMs=0

input.pattern.gamepad.axis.left-stick-up@r1
  axis=LSY · threshold=0.7 · holdMs=120
```

### 4.4 绑定实例

| Binding | source | pattern | target |
|---|---|---|---|
| `input.binding.key.ctrl-alt-e` | `keyboard.lowlevel.physical` | `key.chord.ctrl-alt-e` | `inst.site-github@r1` (Flow) |
| `input.binding.key.ctrl-shift-v` | `hotkey.global` | `key.chord.ctrl-shift-v` | `surface.paste-preview@r1` (Surface) |
| `input.binding.key.caps-hold` | `keyboard.lowlevel.physical` | `key.hold.capslock` | `surface.quick-launch@r1` (Surface) |
| `input.binding.mouse.ldr` | `mouse.lowlevel.right` | `mouse.gesture.ldr` | `inst.ensure-vpn-ask@r2` (Flow) |
| `input.binding.mouse.x1-hold` | `mouse.lowlevel.x1` | `mouse.button.x1-hold` | `body.quick-launch.dock@r1` (Body) |
| `input.binding.touch.3-up` | `touchpad.raw.three-finger` | `touch.swipe.up-3` | `surface.launch-dock@r1` (Surface) |
| `input.binding.pen.barrel-drag` | `pen.pointer.barrel` | `pen.pressure.barrel-drag` | `surface.ocr-result@r1` (Surface) |
| `input.binding.gamepad.lb-rb` | `gamepad.poll.xinput` | `gamepad.button.lb-rb` | `field.prefill.ocr-language@r1` (Field) |
| `input.binding.hid.custom` | `hid.raw.custom-controller` | `hid.report.button-1` | `flow.obs.start@r1` (Flow) |

> 目标可以是点/线/面/体/场/skill 实例；绑定实例必须锁目标 revision。

---

## 5. InputEvent 规范化

低级钩子回调里**不要做业务匹配**。先把原始事件压成固定大小结构，入无锁环形队列：

```rust
#[derive(Clone, Copy)]
pub struct InputEvent {
    pub id: u64,
    pub source_id: u32,
    pub device_id: u32,
    pub kind: InputKind,        // Key / Button / Wheel / Move / Axis / Touch / Pen / Hid
    pub code: u32,              // VK / scanCode / button / axis / report id
    pub phase: Phase,           // Down / Up / Repeat / Move / Done / Cancel / Hold
    pub modifiers: u8,          // Ctrl / Alt / Shift / Win
    pub flags: u8,              // Injected / LowerIl / Extended / Fake
    pub x: i32,
    pub y: i32,
    pub dx: i32,
    pub dy: i32,
    pub wheel: i16,
    pub pressure: u16,
    pub ts_ms: i64,
}
```

`InputEvent` 里不要放 `String`、`Vec`、`serde_json::Value`。  
回调里不分配、不写盘、不 IPC、不 await。

---

## 6. 低级钩子的实现约束

### 6.1 键盘

```text
SetWindowsHookExW(WH_KEYBOARD_LL, KeyboardProc, hInstance, 0)
```

`KeyboardProc` 里：

- `code == HC_ACTION` 才处理。
- `KBDLLHOOKSTRUCT` 带 `vkCode`、`scanCode`、`flags`、`time`。
- `LLKHF_INJECTED` / `LLKHF_LOWER_IL_INJECTED`：决定是否忽略注入事件。
- 返回 `1` 表示吞掉，`CallNextHookEx` 表示放行。

### 6.2 鼠标

```text
SetWindowsHookExW(WH_MOUSE_LL, MouseProc, hInstance, 0)
```

`MSLLHOOKSTRUCT` 带 `pt`、`mouseData`、`flags`、`time`。

消息：

- `WM_MOUSEMOVE`
- `WM_LBUTTONDOWN/UP`
- `WM_RBUTTONDOWN/UP`
- `WM_MBUTTONDOWN/UP`
- `WM_XBUTTONDOWN/UP`
- `WM_MOUSEWHEEL`
- `WM_MOUSEHWHEEL`

`LLMHF_INJECTED`：避免自己 `SendInput` 造成循环。

### 6.3 300ms 生存线

Windows 的 `LowLevelHooksTimeout` 默认 **300ms**；回调超时多次后，系统可能静默摘钩。  
所以：

- 回调 P99 < 1ms。
- 只入队，不做匹配。
- 复杂手势/序列/绑定在 worker 线程做。
- 钩子线程必须有消息循环。
- 安装失败/被摘钩要有 watchdog 重装与诊断。

### 6.4 Raw Input 什么时候用

- 高频鼠标移动/游戏鼠标。
- 需要 per-device 区分。
- 不需要抑制。
- 触控板/笔/手柄的原始 HID 数据。

`WH_MOUSE_LL` 适合“需要抑制 + 手势按钮”；Raw Input 适合“高频 + 不抑制”。

### 6.5 RegisterHotKey 什么时候用

- 简单全局组合键。
- 不需要 key up / 长按 / 序列。
- 不需要抑制。
- 比 LL 钩子更稳，冲突由系统返回。

### 6.6 其他输入

- 触控板：Precision Touchpad / HID，多指手势。
- 笔：Pointer Input，压力/倾斜/桶键/橡皮擦。
- 手柄：XInput / GameInput / HID；轮询或 raw report。
- HID：自定义 report，需要 device path + report descriptor。

---

## 7. 识别与匹配

### 7.1 键盘

```text
Chord:    Ctrl+Alt+E
Sequence: G G
Hold:     CapsLock 500ms
Double:   Ctrl Ctrl
```

### 7.2 鼠标

```text
Button:   right / middle / x1 / x2
Chord:    left+right / right+x1
Wheel:    up / down / horizontal
Gesture:  LDR / UD / RL
Drag:     right drag > 24px
Region:   top-left corner dwell 120ms
```

### 7.3 触控/笔/手柄

```text
Touch:    3-finger swipe up / 4-finger tap / pinch
Pen:      barrel + drag / pressure > 0.7 / eraser
Gamepad:  LB+RB / LS up / RT > 0.8
HID:      report[0] == 0x01
```

### 7.4 匹配优先级

```text
1. source 匹配：device / button / key filter
2. pattern 匹配：exact > fuzzy
3. scope：app-specific > device-specific > global
4. conditions：foreground / time / power / permission
5. priority：数值大者优先
6. 仍并列 → 歧义选择器，不静默取第一条
```

---

## 8. 抑制策略（最危险的部分）

| 策略 | 行为 | 适用 | 风险 |
|---|---|---|---|
| `pass` | 只观察，不吞 | 大多数快捷键/手势 | 低 |
| `owned_button` | 吞掉专用手势键 | 右键/X1 手势 | 右键原生菜单丢失 |
| `remap_table` | 同步查表吞掉/替换 | 键位重映射 | 需要固定表，不能异步 |
| `suppress_on_match` | 匹配时吞 | 简单 chord | 复杂 pattern 无法同步判断 |
| `replay` | 不匹配时回放 | 高级场景 | 易循环/顺序错乱，P2 |

### 铁律

- **低级钩子回调里不能 await / 读盘 / IPC / 模型推理。**
- **不要全局吞键盘**；只吞用户明确拥有的键/按钮。
- **手势键默认用 `owned_button`**；如果用户要求保留右键，用 `pass` + 非抑制手势。
- **不要承诺异步 `suppress_on_match`**；匹配不在回调线程。
- **注入事件默认忽略**；否则 `SendInput` 可能自触发。
- **UAC/安全桌面收不到**；不要用于提权/登录场景。
- **反作弊/游戏可能屏蔽**；提供 Raw Input/系统快捷键 fallback。

---

## 9. 运行时

```text
Hook thread (message loop)
  → KeyboardProc / MouseProc
  → fixed-size InputEvent
  → lock-free ring buffer
  → worker thread
      → active source instances
      → pattern instances
      → InputMatch
      → binding resolution
      → target dispatch
  → InputRun audit
```

`InputRun`：

```ts
type InputRun = {
  id: string;
  bindingId: string;
  bindingRevision: number;
  eventIds: number[];
  pattern: string;
  target: InputTarget;
  suppressed: boolean;
  latencyMs: number;
  status: "ok" | "blocked" | "failed" | "needs_approval";
  error?: string;
};
```

---

## 10. 测试与指标

### 必测

- 注入事件被忽略（`SendInput` 不自触发）。
- 钩子回调 P99 < 1ms；队列不丢事件。
- 钩子被系统摘掉后 watchdog 能重装。
- UAC/安全桌面不触发，UI 有提示。
- 游戏 Raw Input 下 LL 钩子失效，fallback 可用。
- 手势 vs 拖拽：单段 > 400px 判拖拽。
- 多显示器/DPI 坐标正确。
- 同一 binding 多目标冲突按 priority/歧义处理。
- 抑制模式不会吞掉普通打字。
- `owned_button` 模式下右键菜单丢失有明确提示/fallback。

### 指标

```text
callback_p99_us
queue_drop_rate
hook_reinstall_count
trigger_latency_p95_ms
false_trigger_rate
suppression_leak_rate
binding_conflict_count
```

---

## 11. 优先级

### P0

- `input.source.keyboard.lowlevel`
- `input.source.mouse.lowlevel`
- `input.source.hotkey`
- `input.pattern.key.chord`
- `input.pattern.mouse.button`
- `input.pattern.mouse.gesture`
- `input.binding`
- `input.run`
- 注入过滤、300ms 约束、watchdog、scope/priority

### P1

- `input.pattern.key.sequence`
- `input.pattern.key.hold`
- `input.pattern.mouse.chord`
- `input.pattern.mouse.wheel`
- `input.source.mouse.raw`
- `input.source.keyboard.raw`
- 触控板三指/四指
- 手柄按钮/轴
- app-specific scope / conditions

### P2

- 笔压/倾斜
- 自定义 HID
- MIDI
- per-device 设备实例
- `suppress_on_match` / replay
- 手势市场 / 触发器市场
- 学习用户快捷键

---

## 12. 反模式

- ❌ 一个快捷键一个类。
- ❌ 一个手势一个类。
- ❌ 在钩子回调里做手势识别/绑定解析。
- ❌ 在钩子回调里读文件/发 HTTP/调用模型。
- ❌ 全局吞键盘。
- ❌ 默认忽略注入标志。
- ❌ 用 LL 钩子实现简单热键（应用 `RegisterHotKey`）。
- ❌ 用 LL 钩子做高频鼠标采样（应用 Raw Input）。
- ❌ 让 `TriggerEvent` 直接携带 `action_id`（应由 binding 层决定目标）。
- ❌ 绑定不带 target revision。
- ❌ 多个绑定同分时按列表顺序取第一条。

---

## 13. 参考

- LowLevelKeyboardProc: https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc
- LowLevelMouseProc: https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelmouseproc
- SetWindowsHookEx: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowshookexa
- Hooks Overview: https://learn.microsoft.com/en-us/windows/win32/winmsg/about-hooks
- Global hooks getting lost / LowLevelHooksTimeout: https://learn.microsoft.com/en-us/archive/blogs/alejacma/global-hooks-getting-lost-on-windows-7
- Using Raw Input: https://learn.microsoft.com/en-us/windows/win32/inputdev/using-raw-input
- RegisterHotKey: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey

---

## 14. 一句话总结

**低级钩子是输入源，不是业务动作。**

```text
InputDeviceClass → InputSourceClass → InputPatternClass → InputBindingInstance → Target
```

键盘/鼠标/触控/笔/手柄/HID 都是设备；LL 钩子/Raw Input/RegisterHotKey 是采集机制；chord/sequence/hold/gesture 是识别模式；binding 才决定“触发哪个点/线/面/体/场/skill 实例”。
