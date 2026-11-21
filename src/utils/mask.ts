import { pinyin } from 'pinyin-pro'

/**
 * 姓名脱敏（与服务端 maskName 同规则）：张三 → 张S，王梦琪 → 王MQ。
 * 单字名不脱敏；非中文首字符原样返回。
 */
export function maskZh(name: string): string {
  const chars = [...name.trim()]
  if (chars.length <= 1) return name
  const given = chars.slice(1).join('')
  const initials = pinyin(given, { pattern: 'first', toneType: 'none', type: 'array' })
    .map((s) => (s || '?').toUpperCase())
    .join('')
  return chars[0] + initials
}
