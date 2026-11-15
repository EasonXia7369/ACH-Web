<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useIntervalFn } from '@vueuse/core'
import { get, put } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

import { useClassStore } from '@/stores/class'
import { dk, STATUS_META } from '@/utils/dates'
import Icon from '@/components/Icon.vue'

const router = useRouter()
const auth = useAuthStore()
const chat = useChatStore()
const store = useClassStore()

const isStudent = computed(() => auth.user?.role === 'student')
const isAdmin = computed(() => auth.user?.role === 'admin')

/* ---------- 大时钟 ---------- */
const now = ref(dayjs())
useIntervalFn(() => (now.value = dayjs()), 1000)
const clockHM = computed(() => now.value.format('HH:mm'))
const clockSS = computed(() => now.value.format('ss'))
const dateLine = computed(
  () => `${now.value.format('YYYY年M月D日')} 星期${'一二三四五六日'[now.value.day() === 0 ? 6 : now.value.day() - 1]}`,
)
const dayPart = computed(() => {
  const h = now.value.hour()
  if (h < 8) return '早晨'
  if (h < 12) return '上午'
  if (h < 14) return '中午'
  if (h < 18) return '下午'
  return '晚上'
})

/* ---------- 每日寄语 ---------- */
const QUOTES = [
  { text: '八月长江万里晴，千帆一道带风轻。', author: '崔季卿《晴江秋望》' },
  { text: '长风破浪会有时，直挂云帆济沧海。', author: '李白《行路难》' },
  { text: '黑发不知勤学早，白首方悔读书迟。', author: '颜真卿《劝学》' },
  { text: '纸上得来终觉浅，绝知此事要躬行。', author: '陆游《冬夜读书示子聿》' },
  { text: '问渠那得清如许？为有源头活水来。', author: '朱熹《观书有感》' },
  { text: '千磨万击还坚劲，任尔东西南北风。', author: '郑燮《竹石》' },
  { text: '少年易老学难成，一寸光阴不可轻。', author: '朱熹《劝学诗》' },
  { text: '不畏浮云遮望眼，自缘身在最高层。', author: '王安石《登飞来峰》' },
  { text: '会当凌绝顶，一览众山小。', author: '杜甫《望岳》' },
  { text: '宝剑锋从磨砺出，梅花香自苦寒来。', author: '《警世贤文》' },
  { text: '海阔凭鱼跃，天高任鸟飞。', author: '《古今诗话》' },
  { text: '三更灯火五更鸡，正是男儿读书时。', author: '颜真卿《劝学》' },
  { text: '随风潜入夜，润物细无声。', author: '杜甫《春夜喜雨》' },
  { text: '山重水复疑无路，柳暗花明又一村。', author: '陆游《游山西村》' },
  { text: '欲穷千里目，更上一层楼。', author: '王之涣《登鹳雀楼》' },
  { text: '沉舟侧畔千帆过，病树前头万木春。', author: '刘禹锡《酬乐天扬州初逢席上见赠》' },
  { text: '博观而约取，厚积而薄发。', author: '苏轼《稼说送张琥》' },
  { text: '旧书不厌百回读，熟读精思子自知。', author: '苏轼《送安惇秀才失解西归》' },
  { text: '莫愁前路无知己，天下谁人不识君。', author: '高适《别董大》' },
  { text: '天生我材必有用，千金散尽还复来。', author: '李白《将进酒》' },
  { text: '路漫漫其修远兮，吾将上下而求索。', author: '屈原《离骚》' },
  { text: '位卑未敢忘忧国，事定犹须待阖棺。', author: '陆游《病起书怀》' },
  { text: '书山有路勤为径，学海无涯苦作舟。', author: '韩愈' },
  { text: '业精于勤，荒于嬉；行成于思，毁于随。', author: '韩愈《进学解》' },
  { text: '绳锯木断，水滴石穿。', author: '《汉书》' },
  { text: '流水不争先，争的是滔滔不绝。', author: '《道德经》衍语' },
  { text: '千淘万漉虽辛苦，吹尽狂沙始到金。', author: '刘禹锡《浪淘沙》' },
  { text: '劝君莫惜金缕衣，劝君惜取少年时。', author: '杜秋娘《金缕衣》' },
]
const quote = computed(
  () => QUOTES[Math.floor((now.value.valueOf() / 86400000) * 2654435761) % QUOTES.length],
)

/* ---------- 数据 ---------- */
const today = dk()
const tasks = ref<Array<{ day: string; subject: string; content: string }>>([])
const attendance = ref<Array<{ student_id: number; slot: string; status: string; note: string }>>([])
const duty = ref<Array<{ student_id: number; name: string; role: string }>>([])
const periods = ref<Array<{ period: number; subject: string; teacher: string }>>([])

const slot = computed(() => {
  const h = now.value.hour()
  if (h < 12) return 'morning'
  if (h < 17) return 'noon'
  return 'evening'
})
const slotLabel = computed(() => ({ morning: '早', noon: '中', evening: '晚' })[slot.value])

const activeStudents = computed(() => store.students.filter((s) => s.active))

/** 已经过去的时段（与登记口径一致：8 点算早、12 点算中、17 点算晚） */
const elapsedSlots = computed<string[]>(() => {
  const h = now.value.hour()
  const out: string[] = []
  if (h >= 8) out.push('morning')
  if (h >= 12) out.push('noon')
  if (h >= 17) out.push('evening')
  return out.length ? out : ['morning']
})

/** 全天概况：跨已过时段聚合，人名去重；请假/旷课不计实到，迟到算到勤 */
const todaySummary = computed(() => {
  const lists = { leave: [] as string[], absent: [] as string[], late: [] as string[], violate: [] as string[] }
  const ids = new Set<string>()
  const nameOf = (sid: number) => activeStudents.value.find((s) => s.id === sid)?.name ?? `#${sid}`
  for (const a of attendance.value) {
    if (!elapsedSlots.value.includes(a.slot)) continue
    if (a.status in lists && !ids.has(`${a.status}|${a.student_id}`)) {
      ids.add(`${a.status}|${a.student_id}`)
      lists[a.status as keyof typeof lists].push(nameOf(a.student_id))
    }
  }
  const notIn = [...new Set([...lists.leave, ...lists.absent])]
  return {
    total: activeStudents.value.length,
    real: activeStudents.value.length - notIn.length,
    leave: lists.leave,
    absent: lists.absent,
    late: lists.late,
    violate: lists.violate,
    slots: elapsedSlots.value,
  }
})
const shouldCome = computed(() => todaySummary.value.total)
const actuallyCame = computed(() => todaySummary.value.real)

const summarySlotsLabel = computed(() =>
  todaySummary.value.slots.map((s) => ({ morning: '早', noon: '中', evening: '晚' })[s]).join('/') + '时段',
)
const hasExceptionNames = computed(
  () =>
    todaySummary.value.leave.length ||
    todaySummary.value.absent.length ||
    todaySummary.value.late.length ||
    todaySummary.value.violate.length,
)

async function load() {
  if (!store.current) return
  const cid = store.current.id
  const [t, a, d, tt] = await Promise.all([
    get<any>(`/api/classes/${cid}/hw-tasks?from=${today}&to=${today}`),
    get<any>(`/api/classes/${cid}/attendance?day=${today}`),
    get<any>(`/api/classes/${cid}/duty/today`),
    get<any>(`/api/classes/${cid}/timetable/today`),
  ])
  tasks.value = t.tasks
  attendance.value = a.records
  duty.value = d.members
  periods.value = tt.periods
}

watch(() => store.current?.id, load, { immediate: true })
// 其他设备变更了作业/考勤/值日 → 自动重拉
watch(() => chat.refreshTick, () => load())

/* ---------- 作业卡片墙 ---------- */
const taskOf = (subject: string) => tasks.value.find((t) => t.subject === subject)

  // 大卡只展示有内容的科目；空科目仅老师视图可见（布置入口）
  const filledTasks = computed(() =>
    (store.current?.subjects ?? [])
      .map((s) => taskOf(s))
      .filter((t): t is NonNullable<typeof t> => !!t),
  )
  const emptySubjects = computed(() => (store.current?.subjects ?? []).filter((s) => !taskOf(s)))

// 编辑器（老师/值日生均可）
  const editor = ref<{ subject: string; content: string; isNew: boolean } | null>(null)
function openEditor(subject: string) {
  const t = taskOf(subject)
  editor.value = { subject, content: t?.content ?? '', isNew: !t }
}
async function saveTask() {
  if (!editor.value) return
  await put(`/api/classes/${store.current!.id}/hw-tasks`, {
    day: today,
    subject: editor.value.subject,
    content: editor.value.content,
  })
  editor.value = null
  await load()
}

// 学生：点科目卡 → 快速登记未交
const missingMark = ref<{ subject: string; picked: Set<number> } | null>(null)
function openMissing(subject: string) {
  missingMark.value = { subject, picked: new Set() }
}
function toggleMissing(sid: number) {
  if (!missingMark.value) return
  const next = new Set(missingMark.value.picked)
  if (next.has(sid)) next.delete(sid)
  else next.add(sid)
  missingMark.value = { ...missingMark.value, picked: next }
}
async function saveMissing() {
  if (!missingMark.value) return
  await put(`/api/classes/${store.current!.id}/hw-records`, {
    day: today,
    subject: missingMark.value.subject,
    title: '',
    missing: [...missingMark.value.picked],
  })
  toast(`${missingMark.value.subject} 未交名单已保存`)
  missingMark.value = null
}


/* ---------- toast ---------- */
const toastMsg = ref('')
function toast(msg: string) {
  toastMsg.value = msg
  setTimeout(() => (toastMsg.value = ''), 2200)
}

onMounted(() => {
  if (!store.loaded) store.loadClasses().then(load).catch(() => {})
})
</script>

<template>
  <div class="board">
    <div class="board-main">
      <!-- 第一行：时钟 + 寄语 -->
      <div class="row1">
        <div class="glass clock-card">
          <div class="clock num">
            {{ clockHM }}<span class="sec">:{{ clockSS }}</span>
          </div>
          <div class="clock-meta">
            <span>{{ dateLine }}</span>
            <span class="part">{{ dayPart }} · {{ slotLabel }}时段</span>
          </div>
        </div>
        <div class="glass quote-card">
          <Icon name="quote" :size="18" class="quote-icon" />
          <p class="quote-text">{{ quote.text }}</p>
          <p class="quote-author">{{ quote.author }}</p>
        </div>
      </div>

      <!-- 作业科目卡片墙 -->
      <div class="glass wall-card">
        <div class="sec-head">
          <h2><Icon name="homework" :size="17" /> 今日作业</h2>
          <span class="hint">{{ isStudent ? '作业实时展示，点卡片上的按钮登记未交或修改' : '布置后自动放大展示；点卡片按钮登记未交或修改' }}</span>
        </div>
        <div class="wall">
          <div v-for="t in filledTasks" :key="t.subject" class="subject-card big">
            <div class="big-head">
              <span class="subject-name">{{ t.subject }}</span>
              <span class="big-acts">
                <button class="gmini" @click="openMissing(t.subject)">登记未交</button>
                <button class="gmini" @click="openEditor(t.subject)">编辑</button>
              </span>
            </div>
            <div class="subject-content big">{{ t.content }}</div>
          </div>
          <div v-if="emptySubjects.length" class="empty-row">
            <button v-for="s in emptySubjects" :key="s" class="subject-card" @click="openEditor(s)">
              <span class="subject-name">{{ s }}</span>
              <span class="subject-empty"><Icon name="plus" :size="16" /> 布置</span>
            </button>
          </div>
          <p v-if="!filledTasks.length" class="foot-note" style="margin: 0">
            今日作业待布置{{ isStudent ? '，老师布置后会实时出现在这里' : '' }}
          </p>
        </div>
      </div>
    </div>

    <!-- 右列：出勤概况 + 值日生 -->
    <div class="board-side">
      <div class="glass att-card">
        <div class="sec-head">
          <h2><Icon name="attendance" :size="17" /> 今日出勤概况</h2>
          <span class="hint">{{ summarySlotsLabel }}</span>
        </div>
        <div class="att-grid">
          <div class="att-item">
            <span class="att-num num">{{ shouldCome }}</span>
            <span class="att-label">应到</span>
          </div>
          <div class="att-item">
            <span class="att-num num c-present">{{ actuallyCame }}</span>
            <span class="att-label">实到</span>
          </div>
          <div class="att-item">
            <span class="att-num num c-leave">{{ todaySummary.leave.length }}</span>
            <span class="att-label">请假</span>
          </div>
          <div class="att-item">
            <span class="att-num num c-late">{{ todaySummary.late.length }}</span>
            <span class="att-label">迟到</span>
          </div>
          <div class="att-item">
            <span class="att-num num c-absent">{{ todaySummary.absent.length }}</span>
            <span class="att-label">旷课</span>
          </div>
          <div class="att-item">
            <span class="att-num num c-violate">{{ todaySummary.violate.length }}</span>
            <span class="att-label">违纪</span>
          </div>
        </div>
        <div v-if="hasExceptionNames" class="att-names">
          <div v-if="todaySummary.leave.length" class="name-line">
            <span class="c-leave">请假</span>{{ todaySummary.leave.join('、') }}
          </div>
          <div v-if="todaySummary.absent.length" class="name-line">
            <span class="c-absent">旷课</span>{{ todaySummary.absent.join('、') }}
          </div>
          <div v-if="todaySummary.late.length" class="name-line">
            <span class="c-late">迟到</span>{{ todaySummary.late.join('、') }}
          </div>
          <div v-if="todaySummary.violate.length" class="name-line">
            <span class="c-violate">违纪</span>{{ todaySummary.violate.join('、') }}
          </div>
        </div>
        <button v-if="!isStudent" class="gbtn" style="width: 100%" @click="router.push('/attendance')">
          去登记考勤
        </button>
        <button v-else class="gbtn primary" style="width: 100%" @click="router.push('/attendance')">
          登记本时段考勤
        </button>
      </div>

      <div class="glass tt-card">
        <div class="sec-head">
          <h2><Icon name="calendar" :size="17" /> 今日课程</h2>
        </div>
        <div v-if="periods.length" class="tt-list">
          <div v-for="p in periods" :key="p.period" class="tt-row">
            <span class="tt-p num">{{ p.period }}</span>
            <b>{{ p.subject }}</b>
            <span v-if="p.teacher" class="foot-note">{{ p.teacher }}</span>
          </div>
        </div>
        <p v-else class="none">今天没有课程安排</p>
      </div>

      <div class="glass duty-card">
        <div class="sec-head">
          <h2><Icon name="users" :size="17" /> 今日值日生</h2>
        </div>
        <div v-if="duty.length" class="duty-list">
          <span v-for="m in duty" :key="m.student_id" class="duty-tag">
            {{ m.name }}<i v-if="m.role">{{ m.role }}</i>
          </span>
        </div>
        <p v-else class="empty">今天没有安排值日</p>
        <button v-if="!isStudent" class="gmini" style="margin-top: 10px" @click="router.push('/manage')">
          调整值日表
        </button>
      </div>
    </div>
  </div>

  <!-- 作业编辑器（老师/管理员） -->
  <Teleport to="body">
    <div v-if="editor" class="gbackdrop" @click.self="editor = null">
      <div class="gpop">
        <h3 class="sec-title">布置作业 · {{ editor.subject }} · {{ today }}</h3>
        <textarea
          v-model="editor.content"
          class="gtextarea"
          style="width: 100%; min-height: 110px; margin-top: 8px"
          placeholder="如：《练习册》P32 第1-8题…"
          maxlength="300"
        ></textarea>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px">
          <button class="gbtn" @click="editor = null">取消</button>
          <button class="gbtn primary" @click="saveTask">保存</button>
        </div>
        <p class="foot-note" style="margin: 8px 0 0">内容清空后保存即删除该科作业。</p>
      </div>
    </div>
  </Teleport>

  <!-- 学生：快速登记未交 -->
  <Teleport to="body">
    <div v-if="missingMark" class="gbackdrop" @click.self="missingMark = null">
      <div class="gpop">
        <h3 class="sec-title">登记未交 · {{ missingMark.subject }} · {{ today }}</h3>
        <p class="foot-note">点姓名标记未交（红色），再点取消。</p>
        <div class="miss-grid">
          <button
            v-for="s in activeStudents"
            :key="s.id"
            class="miss-stu"
            :class="{ miss: missingMark.picked.has(s.id) }"
            @click="toggleMissing(s.id)"
          >
            {{ s.name }}
          </button>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px">
          <button class="gbtn" @click="missingMark = null">取消</button>
          <button class="gbtn primary" @click="saveMissing">
            保存（{{ missingMark.picked.size }} 人未交）
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <div v-if="toastMsg" class="gtoast">{{ toastMsg }}</div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
  align-items: start;
  animation: board-in var(--dur-med) var(--ease-spring);
}
@keyframes board-in {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: none; opacity: 1; }
}
.board-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.board-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 时钟：页面主视觉 */
.row1 {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 16px;
}
.clock-card {
  padding: 26px 28px 22px;
}
.clock {
  font-size: clamp(56px, 7vw, 84px);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--text);
}
.clock .sec {
  font-size: 0.34em;
  color: var(--faint);
  font-weight: 500;
}
.clock-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-top: 14px;
  font-size: 13.5px;
  color: var(--muted);
  flex-wrap: wrap;
}
.clock-meta .part {
  color: var(--primary);
  font-weight: 600;
  font-size: 13px;
}

/* 寄语 */
.quote-card {
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.quote-icon {
  color: var(--faint);
  margin-bottom: 10px;
}
.quote-text {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.75;
  letter-spacing: 0.02em;
}
.quote-author {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--faint);
}

/* 作业卡片墙 */
.wall-card {
  padding: 18px 20px;
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 14px;
}
.sec-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.01em;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text);
}
.hint {
  font-size: 11.5px;
  color: var(--faint);
}
.wall {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
.subject-card.big {
  padding: 16px 20px;
  cursor: default;
}
.subject-card.big:hover {
  background: var(--field);
  border-color: var(--line);
  transform: none;
  box-shadow: none;
}
.big-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}
.big-acts {
  display: flex;
  gap: 6px;
}
.subject-content.big {
  font-size: 19px;
  line-height: 1.85;
  color: var(--text);
  font-weight: 500;
  white-space: pre-wrap;
  word-break: break-word;
}
.empty-row {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.empty-row .subject-card {
  min-height: 0;
  padding: 10px 14px;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}
.subject-card {
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid var(--line);
  background: var(--field);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  min-height: 78px;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition:
    background var(--dur-fast) var(--ease-spring),
    border-color var(--dur-fast) var(--ease-spring),
    transform var(--dur-fast) var(--ease-spring),
    box-shadow var(--dur-fast) var(--ease-spring);
}
.subject-card:hover {
  background: var(--field-hover);
  border-color: var(--primary);
}
.subject-card:active {
  transform: scale(0.98);
}
.subject-name {
  font-weight: 600;
  font-size: 14px;
}
.subject-content {
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.subject-empty {
  font-size: 12px;
  color: var(--faint);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* 出勤概况 */
.att-card,
.duty-card {
  padding: 18px 20px;
}
.att-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 6px;
  margin: 6px 0 16px;
}
.att-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.att-num {
  font-size: 30px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.01em;
}
.att-label {
  font-size: 11.5px;
  color: var(--muted);
}
.c-present { color: var(--present); }
.c-leave { color: var(--leave); }
.c-late { color: var(--late); }
.c-absent { color: var(--absent); }
.c-violate { color: var(--violate); }
.att-names {
  margin: -4px 0 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.name-line {
  font-size: 12.5px;
  color: var(--text);
  line-height: 1.6;
}
.name-line > span {
  font-weight: 600;
  margin-right: 6px;
}

/* 今日课程 */
.tt-card {
  padding: 18px 20px;
}
.tt-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tt-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  padding: 6px 10px;
  background: var(--field);
  border-radius: 8px;
}
.tt-p {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: 8px;
  font-weight: 600;
  font-size: 12px;
}

/* 值日生 */
.duty-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.duty-tag {
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 11px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.duty-tag i {
  font-style: normal;
  font-size: 10.5px;
  opacity: 0.75;
}

/* 学生未交登记 */
.miss-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.miss-stu {
  padding: 10px 6px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  background: var(--field);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-spring);
}
.miss-stu.miss {
  background: var(--absent-bg);
  border-color: var(--absent);
  color: var(--absent);
  font-weight: 700;
}
.miss-stu:active {
  transform: scale(0.95);
}

@media (max-width: 980px) {
  .board {
    grid-template-columns: 1fr;
  }
  .board-side {
    order: 2;
  }
  .att-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}
@media (max-width: 560px) {
  .row1 {
    grid-template-columns: 1fr;
  }
  .att-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
