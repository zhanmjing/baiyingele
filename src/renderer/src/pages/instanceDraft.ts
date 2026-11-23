/** 新建 / 编辑实例时的表单草稿（五层共用） */
export interface InstanceDraft {
  name: string
  description: string
  params: Record<string, string>
}
