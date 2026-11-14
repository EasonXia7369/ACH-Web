import dayjs from 'dayjs'

export const dk = (d: Date | dayjs.Dayjs = new Date()) => dayjs(d).format('YYYY-MM-DD')

export const weekdayCn = (k: string) => '周' + ['日', '一', '二', '三', '四', '五', '六'][dayjs(k).day()]

export const SLOT_LABEL: Record<string, string> = {
  morning: '早',
  noon: '中',
  evening: '晚',
}

export const STATUS_META: Record<string, { label: string; sym: string }> = {
  present: { label: '出勤', sym: '✓' },
  leave: { label: '请假', sym: '⭕' },
  late: { label: '迟到', sym: '□' },
  absent: { label: '旷课', sym: '×' },
  violate: { label: '违纪', sym: '△' },
}
