import { pinyin } from 'pinyin-pro'

/** 取姓名的拼音首字母（按姓），如 陈一 → C；非中文返回首字符大写 */
export function pinyinInitial(name: string): string {
  const first = name.trim().charAt(0)
  if (!first) return ''
  if (!/[\u4e00-\u9fa5]/.test(first)) return first.toUpperCase()
  const s = pinyin(first, { pattern: 'first', toneType: 'none', type: 'array' })[0]
  return (s ?? first).toUpperCase()
}

/** 学生记录的首字母：优先用云端存的，若存的是汉字（历史脏数据）则现场换算 */
export function initialOf(s: { pinyin_initial?: string; name: string }): string {
  const v = s.pinyin_initial ?? ''
  return /^[A-Z]/.test(v) ? v : pinyinInitial(s.name)
}
