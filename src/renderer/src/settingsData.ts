import raw from './generatedSettings.json'

export interface SettingSpec {
  key: string
  label: string
  desc: string
  type: string
  default: unknown
  options?: string[]
  min?: number
  max?: number
  unit?: string
  effect?: string
  restart?: string
  policy?: boolean
  secret?: boolean
  advanced?: boolean
  initialSource?: string
}

export interface SettingGroup {
  label: string
  desc: string
  settings: SettingSpec[]
}

export interface SettingSection {
  id: string
  group: string
  icon: string
  color: string
  title: string
  desc: string
  groups?: SettingGroup[]
  info?: boolean
}

export interface InfoCard {
  title: string
  icon: string
  rows: [string, string][]
  actions: [string, string][]
  danger?: boolean
}

const data = raw as unknown as { sections: SettingSection[]; infoCards: InfoCard[] }

export const settingSections = data.sections
export const infoCards = data.infoCards

export const allSettings = settingSections.flatMap((section) =>
  (section.groups ?? []).flatMap((group) =>
    group.settings.map((setting) => ({ setting, group, section }))
  )
)

export const settingMap = new Map(allSettings.map((item) => [item.setting.key, item]))

export function settingsForSection(sectionId: string): SettingSpec[] {
  const section = settingSections.find((item) => item.id === sectionId)
  return (section?.groups ?? []).flatMap((group) => group.settings)
}

export function sectionDirtyKeys(sectionId: string, values: Record<string, unknown>): string[] {
  return settingsForSection(sectionId)
    .filter((setting) => JSON.stringify(values[setting.key]) !== JSON.stringify(setting.default))
    .map((setting) => setting.key)
}
