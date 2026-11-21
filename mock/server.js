/**
 * 纯前端预览（Mock API）：`npm run dev:mock` 时由 vite.config.ts 的 mockServer 插件加载，
 * 接管所有 /api/* 请求，无需启动后端即可预览画面。
 * 数据保存在内存里，PUT/POST 会真实修改状态（重启 dev server 才重置）。
 * 未匹配的端点返回 404 并在终端打印路径，按需在 routes 表里补充。
 */

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const mondayOf = (s) => {
  const d = new Date(s + 'T00:00:00')
  const wd = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (wd - 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const weekdayOf = (s) => {
  const d = new Date(s + 'T00:00:00').getDay()
  return d === 0 ? 7 : d
}

/* ---------- 内存数据 ---------- */

const user = { id: 1, name: '演示老师', role: 'teacher', schoolId: 1 }

const klass = {
  id: 1,
  name: '三年二班',
  grade: '三年级',
  teacher_name: '演示老师',
  student_pass_hash: null,
  subjects: ['语文', '数学', '英语', '科学', '体育', '美术'],
  quote_config: null,
}

const students = [
  '陈一诺',
  '王子涵',
  '李思远',
  '赵雨桐',
  '刘浩然',
  '孙可欣',
  '周子墨',
  '林晓彤',
].map((name, i) => ({ id: i + 1, name, seq: i + 1, pinyin_initial: name[0], active: 1 }))

const teachers = [{ id: 1, name: '演示老师', role: 'teacher', is_owner: 1 }]

// 考勤：key = `${student_id}|${slot}|${day}`（present 不落盘）
const attendanceMap = new Map()
function seedAttendance() {
  const today = todayStr()
  const put = (sid, slot, status, note = '') => attendanceMap.set(`${sid}|${slot}|${today}`, { student_id: sid, slot, status, note })
  put(2, 'morning', 'late', '迟到 10 分钟')
  put(3, 'morning', 'leave')
  put(5, 'noon', 'violate', '课间打闹')
  put(8, 'morning', 'absent')
}
seedAttendance()

let hwTasks = [
  { day: todayStr(), subject: '语文', content: '生字表抄写一遍，家长签字' },
  { day: todayStr(), subject: '数学', content: '练习册第 32~33 页' },
]
let hwRecords = [
  { day: todayStr(), subject: '语文', title: '生字抄写', missing: [4, 7], deleted: false },
]

const timetable = [
  { weekday: 1, period: 1, subject: '语文', teacher: '演示老师' },
  { weekday: 1, period: 2, subject: '数学', teacher: '演示老师' },
  { weekday: 1, period: 3, subject: '英语', teacher: '外教 Amy' },
  { weekday: 1, period: 4, subject: '体育', teacher: '强教练' },
  { weekday: 2, period: 1, subject: '数学', teacher: '演示老师' },
  { weekday: 2, period: 2, subject: '语文', teacher: '演示老师' },
  { weekday: 2, period: 3, subject: '科学', teacher: '演示老师' },
  { weekday: 2, period: 4, subject: '美术', teacher: '林老师' },
  { weekday: 3, period: 1, subject: '英语', teacher: '外教 Amy' },
  { weekday: 3, period: 2, subject: '语文', teacher: '演示老师' },
  { weekday: 3, period: 3, subject: '数学', teacher: '演示老师' },
  { weekday: 3, period: 4, subject: '体育', teacher: '强教练' },
  { weekday: 4, period: 1, subject: '语文', teacher: '演示老师' },
  { weekday: 4, period: 2, subject: '英语', teacher: '外教 Amy' },
  { weekday: 4, period: 3, subject: '数学', teacher: '演示老师' },
  { weekday: 4, period: 4, subject: '科学', teacher: '演示老师' },
  { weekday: 5, period: 1, subject: '数学', teacher: '演示老师' },
  { weekday: 5, period: 2, subject: '语文', teacher: '演示老师' },
  { weekday: 5, period: 3, subject: '美术', teacher: '林老师' },
  { weekday: 5, period: 4, subject: '班会', teacher: '演示老师' },
]

const DUTY_ROLES = ['黑板', '讲台', '地面', '走廊', '窗台', '图书角']
function dutyMembers(day) {
  const wd = weekdayOf(day)
  // 简单轮换：每天 3 人，按 weekday 偏移取学生
  return [0, 1, 2].map((i) => {
    const s = students[(wd * 3 + i) % students.length]
    return { student_id: s.id, name: s.name, role: DUTY_ROLES[i % DUTY_ROLES.length] }
  })
}

function collectReport(from, to) {
  const days = []
  for (let d = new Date(from + 'T00:00:00'); d <= new Date(to + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  const agg = new Map(students.map((s) => [s.id, { leave: 0, late: 0, absent: 0, violate: 0, total: 0 }]))
  for (const [key, r] of attendanceMap) {
    const day = key.split('|')[2]
    if (!days.includes(day) || r.status === 'present') continue
    const a = agg.get(r.student_id)
    if (!a) continue
    if (['leave', 'late', 'absent', 'violate'].includes(r.status)) {
      a[r.status]++
      a.total++
    }
  }
  return {
    from,
    to,
    total_students: students.length,
    attendance: students.map((s) => ({ seq: s.seq, name: s.name, ...agg.get(s.id) })),
    violations: [...attendanceMap.values()]
      .filter((r) => r.status === 'violate')
      .map((r) => ({ day: todayStr(), name: students.find((s) => s.id === r.student_id)?.name ?? '', slot: r.slot, note: r.note })),
    leave_names: [...attendanceMap.values()].filter((r) => r.status === 'leave').map((r) => students.find((s) => s.id === r.student_id)?.name ?? ''),
    leaves: [],
    homework: hwRecords
      .filter((r) => !r.deleted)
      .flatMap((r) =>
        r.missing.map((sid) => ({ name: students.find((s) => s.id === sid)?.name ?? '', count: 1, detail: [`${r.day} ${r.subject}`] })),
      ),
  }
}

/* ---------- 路由表 ---------- */

const ok = { ok: true }

// 顺序匹配；:name 为路径参数，?a=b 为查询匹配标记（不参与路径匹配）
const routes = [
  ['POST', /^\/api\/auth\/login$/, () => ({ token: 'mock-token', user })],
  ['POST', /^\/api\/auth\/logout$/, () => ok],
  ['POST', /^\/api\/auth\/password$/, () => ok],
  ['GET', /^\/api\/auth\/me$/, () => ({ user })],

  ['GET', /^\/api\/ai\/status$/, () => ({ enabled: true })],
  ['GET', /^\/api\/push\/config$/, () => ({ enabled: false })],

  ['GET', /^\/api\/classes$/, () => ({ classes: [klass] })],
  ['GET', /^\/api\/classes\/(\d+)$/, () => ({ class: klass, students, teachers })],

  // 考勤
  ['GET', /^\/api\/classes\/(\d+)\/attendance$/, (m, q) => ({
    day: q.get('day') ?? todayStr(),
    records: [...attendanceMap.values()]
      .filter((r) => r.status !== 'present')
      .map((r) => ({ ...r, name: students.find((s) => s.id === r.student_id)?.name ?? '' })),
  })],
  ['PUT', /^\/api\/classes\/(\d+)\/attendance$/, (m, q, body) => {
    for (const e of body.entries ?? []) {
      const key = `${e.student_id}|${e.slot}|${body.day}`
      if (e.status === 'present') attendanceMap.delete(key)
      else attendanceMap.set(key, { student_id: e.student_id, slot: e.slot, status: e.status, note: e.note ?? '' })
    }
    return { ...ok, saved: (body.entries ?? []).length }
  }],
  ['POST', /^\/api\/classes\/(\d+)\/attendance\/insights$/, () => ({
    items: [
      { level: 'warn', text: '王 Z 同学本周连续 2 天迟到，建议与家长沟通作息。' },
      { level: 'info', text: '其余同学出勤稳定，保持现状即可。' },
    ],
  })],

  // 作业
  ['GET', /^\/api\/classes\/(\d+)\/hw-tasks$/, (m, q) => ({
    tasks: hwTasks.filter((t) => t.day >= (q.get('from') ?? '') && t.day <= (q.get('to') ?? '9999')),
  })],
  ['PUT', /^\/api\/classes\/(\d+)\/hw-tasks$/, (m, q, body) => {
    hwTasks = hwTasks.filter((t) => !(t.day === body.day && t.subject === body.subject))
    if (body.content) hwTasks.push({ day: body.day, subject: body.subject, content: body.content })
    return ok
  }],
  ['GET', /^\/api\/classes\/(\d+)\/hw-records$/, () => ({ records: hwRecords.filter((r) => !r.deleted) })],
  ['PUT', /^\/api\/classes\/(\d+)\/hw-records$/, (m, q, body) => {
    hwRecords = hwRecords.filter((r) => !(r.day === body.day && r.subject === body.subject))
    hwRecords.push({ day: body.day, subject: body.subject, title: body.title ?? '', missing: body.missing ?? [], deleted: false })
    return ok
  }],

  // 值日 / 课表
  ['GET', /^\/api\/classes\/(\d+)\/duty\/today$/, (m, q) => {
    const day = todayStr()
    return { day, weekday: weekdayOf(day), members: dutyMembers(day) }
  }],
  ['GET', /^\/api\/classes\/(\d+)\/duty$/, () => {
    const week = mondayOf(todayStr())
    const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      members: dutyMembers(week).map((mem, i) => ({ ...mem, role: DUTY_ROLES[(weekday + i) % DUTY_ROLES.length] })),
    }))
    return { week_start: week, days }
  }],
  ['GET', /^\/api\/classes\/(\d+)\/timetable$/, () => ({ timetable })],
  ['GET', /^\/api\/classes\/(\d+)\/timetable\/today$/, () => {
    const day = todayStr()
    return { day, weekday: weekdayOf(day), periods: timetable.filter((t) => t.weekday === weekdayOf(day)) }
  }],

  // 周报 + AI 总结（延迟 600ms 模拟 AI 生成）
  ['GET', /^\/api\/classes\/(\d+)\/report$/, (m, q) => collectReport(q.get('from') ?? mondayOf(todayStr()), q.get('to') ?? todayStr())],
  ['POST', /^\/api\/classes\/(\d+)\/report\/summary$/, () => new Promise((resolve) =>
    setTimeout(() => resolve({
      text: '本周班级整体运转平稳。出勤方面，全班 8 名同学无旷课，王 Z 同学有 2 次迟到需关注，李 S 同学请假 1 天已正常返园。作业方面，本周语文抄写作业有 2 名同学未按时上交，已当面提醒并要求补交。整体来看同学们精神面貌良好，课堂纪律较上周有进步。请各位家长周末协助检查孩子作业完成情况，并帮助孩子养成早睡早起的好习惯。感谢各位家长的配合！',
    }), 600)),
  ],
]

/* ---------- 中间件 ---------- */

export function mockApiHandler() {
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://mock.local')
    if (!url.pathname.startsWith('/api/')) return next()

    for (const [method, re, handler] of routes) {
      if (req.method !== method) continue
      const m = url.pathname.match(re)
      if (!m) continue
      let body = null
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        for await (const chunk of req) body = (body ?? '') + chunk
        try {
          body = body ? JSON.parse(body) : {}
        } catch {
          body = {}
        }
      }
      try {
        const result = await handler(m, url.searchParams, body)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(result))
      } catch (e) {
        console.error(`[mock] handler error ${req.method} ${url.pathname}:`, e)
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: String(e) }))
      }
      return
    }

    console.warn(`[mock] 未匹配的端点（请在 mock/server.js routes 中补充）: ${req.method} ${url.pathname}`)
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'mock 未实现该端点' }))
  }
}
