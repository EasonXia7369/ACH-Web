<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { get, post, put, del } from '@/api'
import { saveFile } from '@/utils/platform'
import { useAuthStore } from '@/stores/auth'
import { useClassStore } from '@/stores/class'
import StudentsManager from '@/components/StudentsManager.vue'
import TimetableBoard from '@/components/TimetableBoard.vue'
import DutyBoard from '@/components/DutyBoard.vue'
import AuditPanel from '@/components/AuditPanel.vue'
import Icon from '@/components/Icon.vue'
import QRCode from 'qrcode'

const route = useRoute()
const auth = useAuthStore()
const store = useClassStore()

const isAdmin = computed(() => auth.user?.role === 'admin')
const isStudent = computed(() => auth.user?.role === 'student')

/* 协作教师管理 */
const addTeacherId = ref<number | null>(null)
const availableTeachers = ref<Array<{ id: number; name: string }>>([])

async function refreshAvailableTeachers() {
  if (!store.current) return
  availableTeachers.value = (
    await get<{ teachers: Array<{ id: number; name: string }> }>(
      `/api/classes/${store.current.id}/available-teachers`,
    )
  ).teachers
}

async function addTeacher() {
  if (!addTeacherId.value || !store.current) return
  try {
    await post(`/api/classes/${store.current.id}/teachers`, { user_id: addTeacherId.value })
    toastMsg.value = '已添加协作教师'
    setTimeout(() => (toastMsg.value = ''), 2200)
    addTeacherId.value = null
    await refreshAvailableTeachers()
    await store.switchTo(store.current.id)
  } catch (e: any) {
    toastMsg.value = e.message
    setTimeout(() => (toastMsg.value = ''), 2600)
  }
}

async function removeTeacher(t: { id: number; name: string }) {
  if (!confirm(`移除协作教师 ${t.name}？其历史操作记录保留。`)) return
  try {
    await del(`/api/classes/${store.current!.id}/teachers/${t.id}`)
    await refreshAvailableTeachers()
    await store.switchTo(store.current!.id)
  } catch (e: any) {
    toastMsg.value = e.message
    setTimeout(() => (toastMsg.value = ''), 2600)
  }
}

type Tab = 'students' | 'timetable' | 'duty' | 'settings' | 'audit' | 'accounts' | 'invites' | 'import'
const tabs = computed<Array<{ key: Tab; label: string; icon: string }>>(() => {
  const base: Array<{ key: Tab; label: string; icon: string }> = [
    { key: 'students', label: '名单', icon: 'users' },
    { key: 'timetable', label: '课程表', icon: 'calendar' },
    { key: 'duty', label: '值日表', icon: 'calendar' },
    { key: 'settings', label: '班级设置', icon: 'settings' },
    { key: 'audit', label: '修改日志', icon: 'clock' },
  ]
  if (isAdmin.value) {
    base.push({ key: 'accounts', label: '账号', icon: 'users' })
    base.push({ key: 'invites', label: '邀请码', icon: 'lock' })
    base.push({ key: 'import', label: '数据导入', icon: 'download' })
  }
  return base
})
const tab = ref<Tab>((route.query.tab as Tab) ?? 'students')

/* 班级设置 */
const stuPass = ref('')
const subjectsText = ref('')
const toastMsg = ref('')

/* 班级重命名 */
const clsNameDraft = ref('')
const clsGradeDraft = ref('')

/* 修改我的密码 */
const oldPass = ref('')
const newPass = ref('')
const newPass2 = ref('')

/* 备份/恢复 */
const restoreInput = ref<HTMLInputElement | null>(null)

/* 家长链接（班主任） */
const parentKey = ref('')
const parentLink = ref('')
const parentQr = ref('')

async function genParentLink() {
  if (!store.current) return
  try {
    const res = await post<{ key: string }>('/api/classes/' + store.current.id + '/parent-link', {})
    parentKey.value = res.key
    parentLink.value = 'https://ach.macrostar.top/parent/' + res.key
    parentQr.value = await QRCode.toDataURL(parentLink.value, { width: 320, margin: 2 })
    toast('家长链接已生成')
  } catch (e: any) {
    toast(e.message)
  }
}

async function copyParentLink() {
  try {
    await navigator.clipboard.writeText(parentLink.value)
    toast('链接已复制')
  } catch {
    toast('复制失败，请手动选择链接')
  }
}

async function refreshParentLink() {
  if (!store.current) return
  try {
    const detail = await get<any>('/api/classes/' + store.current.id)
    const k = detail.class?.parent_key ?? detail.parent_key ?? null
    if (k) {
      parentKey.value = k
      parentLink.value = 'https://ach.macrostar.top/parent/' + k
      parentQr.value = await QRCode.toDataURL(parentLink.value, { width: 320, margin: 2 })
    } else {
      parentKey.value = ''
      parentLink.value = ''
      parentQr.value = ''
    }
  } catch {
    /* ignore */
  }
}

const quickPhrasesText = ref('')

async function saveQuickPhrases() {
  const phrases = quickPhrasesText.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  if (phrases.length > 20) {
    toast('最多 20 条')
    return
  }
  try {
    await put('/api/classes/' + store.current!.id + '/quick-phrases', { phrases })
    toast('快捷短语已保存')
  } catch (e: any) {
    toast(e.message)
  }
}

async function initSettings() {
  subjectsText.value = store.current?.subjects.join('、') ?? ''
  stuPass.value = ''
  clsNameDraft.value = store.current?.name ?? ''
  clsGradeDraft.value = store.current?.grade ?? ''
  oldPass.value = ''
  newPass.value = ''
  newPass2.value = ''
  // 寄语来源
  let qc: any = store.current?.quote_config
  if (typeof qc === 'string') {
    try {
      qc = JSON.parse(qc)
    } catch {
      qc = null
    }
  }
  quoteSource.value = qc?.source === 'hitokoto' ? 'hitokoto' : 'builtin'
  quoteCats.value = Array.isArray(qc?.cats) ? [...qc.cats] : ['i', 'd']
  quoteMaxLength.value = Number(qc?.max_length) || 30
  quoteRefresh.value = Number(qc?.refresh_minutes) || 0
  if (store.current) {
    try {
      const qp = await get<{ phrases: string[] }>('/api/classes/' + store.current.id + '/quick-phrases')
      quickPhrasesText.value = qp.phrases.join('\n')
    } catch {
      quickPhrasesText.value = ''
    }
  }
}

/* 每日寄语来源（内置诗词 / 一言接口） */
const HITOKOTO_CATS: Array<{ code: string; label: string }> = [
  { code: 'a', label: '动画' },
  { code: 'b', label: '漫画' },
  { code: 'c', label: '游戏' },
  { code: 'd', label: '文学' },
  { code: 'e', label: '原创' },
  { code: 'f', label: '网络' },
  { code: 'h', label: '影视' },
  { code: 'i', label: '诗词' },
  { code: 'j', label: '网易云' },
  { code: 'k', label: '哲学' },
  { code: 'l', label: '抖机灵' },
]
const quoteSource = ref<'builtin' | 'hitokoto'>('builtin')
const quoteCats = ref<string[]>(['i', 'd'])
const quoteMaxLength = ref(30)
/** 一言切换周期（分钟），0 = 每天一条 */
const quoteRefresh = ref(0)
const QUOTE_REFRESH_OPTIONS = [
  { value: 0, label: '每天一条' },
  { value: 10, label: '每 10 分钟' },
  { value: 30, label: '每 30 分钟' },
  { value: 45, label: '每 45 分钟（一节课）' },
  { value: 60, label: '每 1 小时' },
  { value: 120, label: '每 2 小时' },
]

function toggleQuoteCat(code: string) {
  const i = quoteCats.value.indexOf(code)
  if (i >= 0) quoteCats.value.splice(i, 1)
  else quoteCats.value.push(code)
}

async function saveQuoteConfig() {
  if (quoteSource.value === 'hitokoto' && !quoteCats.value.length) {
    toast('至少选择一个句子分类')
    return
  }
  try {
    const res = await put<{ config: any }>(`/api/classes/${store.current!.id}/quote-config`, {
      source: quoteSource.value,
      cats: quoteCats.value,
      max_length: quoteMaxLength.value,
      refresh_minutes: quoteRefresh.value,
    })
    if (store.current) store.current.quote_config = JSON.stringify(res.config)
    toast(quoteSource.value === 'hitokoto' ? '已切换为一言接口，回到大板即生效' : '已切换为内置诗词')
  } catch (e: any) {
    toast(e.message)
  }
}

async function saveClassInfo() {
  try {
    await put(`/api/classes/${store.current!.id}`, {
      name: clsNameDraft.value.trim(),
      grade: clsGradeDraft.value.trim(),
    })
    if (store.current) {
      store.current.name = clsNameDraft.value.trim()
      store.current.grade = clsGradeDraft.value.trim()
    }
    await store.loadClasses()
    toast('班级信息已保存')
  } catch (e: any) {
    toast(e.message)
  }
}

async function changeMyPassword() {
  if (newPass.value.length < 4) {
    toast('新密码至少 4 位')
    return
  }
  if (newPass.value !== newPass2.value) {
    toast('两次新密码不一致')
    return
  }
  try {
    await post('/api/auth/password', { old: oldPass.value, new: newPass.value })
    oldPass.value = ''
    newPass.value = ''
    newPass2.value = ''
    toast('密码已修改')
  } catch (e: any) {
    toast(e.message)
  }
}

async function downloadBackup() {
  const cid = store.current!.id
  const data = await get<any>(`/api/classes/${cid}/backup`)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  await saveFile(`班级备份_${data.class.name}_${new Date().toISOString().slice(0, 10)}.json`, blob)
  toast('备份已下载')
}

async function onRestoreFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const json = JSON.parse(await file.text())
    if (
      !confirm(
        `恢复将覆盖「${store.current?.name}」的全部名单、考勤、作业、日志数据（替换为备份内容），且不可撤销。确定继续？`,
      )
    ) {
      return
    }
    const res = await put<any>(`/api/classes/${store.current!.id}/restore`, json)
    toast(
      `已恢复：学生 ${res.counts.students}、考勤 ${res.counts.attendance}、请假 ${res.counts.leaves}、作业 ${res.counts.homework_records}`,
    )
    await store.loadClasses()
  } catch (err: any) {
    toast(err.message)
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function saveStuPass() {
  try {
    await put(`/api/classes/${store.current!.id}/student-pass`, { password: stuPass.value })
    toast('学生密码已保存')
    stuPass.value = ''
  } catch (e: any) {
    toast(e.message)
  }
}

async function clearStuPass() {
  if (!confirm('清除学生密码后，一体机将无法解锁登记，确定吗？')) return
  await put(`/api/classes/${store.current!.id}/student-pass`, { password: null })
  toast('学生密码已清除')
}

async function saveSubjects() {
  const subjects = subjectsText.value.split(/[,，、\s]+/).filter(Boolean)
  try {
    await put(`/api/classes/${store.current!.id}/subjects`, { subjects })
    if (store.current) store.current.subjects = subjects
    toast('科目已保存')
  } catch (e: any) {
    toast(e.message)
  }
}

function toast(msg: string) {
  toastMsg.value = msg
  setTimeout(() => (toastMsg.value = ''), 2200)
}

/* 创建班级 */
const showCreate = ref(false)
const newName = ref('')
const newGrade = ref('')
const createError = ref('')

async function createClass() {
  createError.value = ''
  if (!newName.value.trim()) return
  try {
    await post('/api/classes', { name: newName.value.trim(), grade: newGrade.value.trim() })
    newName.value = ''
    newGrade.value = ''
    showCreate.value = false
    await store.loadClasses()
  } catch (e: any) {
    createError.value = e.message
  }
}

/* 邀请码（admin） */
interface Invite {
  code: string
  role: string
  used_at: string | null
  expires_at: string
  used_by_name: string | null
}
const invites = ref<Invite[]>([])
const inviteRole = ref<'teacher' | 'admin'>('teacher')
const createdInvite = ref<{ code: string; role: string } | null>(null)

async function refreshInvites() {
  invites.value = (await get<{ invites: Invite[] }>('/api/admin/invites')).invites
}

async function genInvite() {
  const res = await post<{ code: string; role: string }>('/api/admin/invites', {
    role: inviteRole.value,
    days: 30,
  })
  createdInvite.value = res
  await refreshInvites()
}

/* 数据导入（admin） */
const fileInput = ref<HTMLInputElement | null>(null)
const importResult = ref('')
const importError = ref('')

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  importResult.value = ''
  importError.value = ''
  try {
    const res = await post<any>('/api/admin/import-legacy', JSON.parse(await file.text()))
    importResult.value = `导入成功：${res.studentCount} 名学生，考勤 ${res.attendanceRows} 条，作业记录 ${res.hwRecordRows} 条，作业布置 ${res.hwTaskRows} 条，日志 ${res.logRows} 条`
    await store.loadClasses()
  } catch (e: any) {
    importError.value = e.message
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}

/* 创建教师账号（admin） */
const newTName = ref('')
const newTPass = ref('')

async function createTeacher() {
  if (!newTName.value.trim() || !newTPass.value) {
    toast('姓名和密码必填')
    return
  }
  try {
    await post('/api/admin/users', { name: newTName.value.trim(), password: newTPass.value })
    toast('教师账号「' + newTName.value.trim() + '」已创建，请将密码告知老师')
    newTName.value = ''
    newTPass.value = ''
    await refreshAdminUsers()
  } catch (e: any) {
    toast(e.message)
  }
}

/* 账号管理（admin）：列表 / 重置密码 / 班级转让 */
interface AdminUser {
  id: number
  name: string
  role: string
  class_count: number
}
const adminUsers = ref<AdminUser[]>([])
const resetTarget = ref<AdminUser | null>(null)
const resetPw = ref('')

async function refreshAdminUsers() {
  adminUsers.value = (await get<{ users: AdminUser[] }>('/api/admin/users')).users
}

async function resetPassword() {
  if (!resetTarget.value) return
  if (resetPw.value.length < 4) {
    toast('密码至少 4 位')
    return
  }
  await post('/api/admin/users/' + resetTarget.value.id + '/reset-password', { password: resetPw.value })
  toast('已重置 ' + resetTarget.value.name + ' 的密码')
  resetTarget.value = null
  resetPw.value = ''
}

const transferClass = ref<{ id: number; name: string } | null>(null)
const transferTo = ref<number | null>(null)

async function doTransfer() {
  if (!transferClass.value || !transferTo.value) return
  await post('/api/admin/classes/' + transferClass.value.id + '/transfer', { teacher_id: transferTo.value })
  toast('班级已转让')
  transferClass.value = null
  transferTo.value = null
  await store.loadClasses()
}

onMounted(() => {
  initSettings()
  if (isAdmin.value) {
    refreshInvites()
    refreshAdminUsers()
  }
  refreshParentLink()
})
</script>

<template>
  <!-- 无班级：先创建 -->
  <div v-if="!store.current" class="glass pad empty-box">
    <template v-if="store.loaded">
      <h2>还没有班级</h2>
      <p class="foot-note">先创建你的班级，然后在「名单」里添加学生。</p>
      <button class="gbtn primary" @click="showCreate = true">＋ 创建班级</button>
    </template>
    <p v-else class="empty">加载中…</p>
  </div>

  <template v-else>
    <div class="gseg manage-tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        :class="{ on: tab === t.key }"
        @click="tab = t.key; initSettings()"
      >
        <Icon :name="t.icon" :size="14" />
        {{ t.label }}
      </button>
    </div>

    <StudentsManager v-if="tab === 'students'" />
    <TimetableBoard v-else-if="tab === 'timetable'" :class-id="store.current.id" />
    <DutyBoard v-else-if="tab === 'duty'" :class-id="store.current.id" />

    <div v-else-if="tab === 'settings'" class="glass pad">
      <h3 class="sec-title">班级信息</h3>
      <div class="row">
        <input v-model="clsNameDraft" class="ginput" style="flex: 1" placeholder="班级名称" maxlength="20" />
        <input v-model="clsGradeDraft" class="ginput" style="width: 120px" placeholder="年级" maxlength="10" />
        <button class="gbtn primary" @click="saveClassInfo">保存</button>
      </div>

      <h3 class="sec-title" style="margin-top: 20px">学生密码（教室一体机登记用）</h3>
      <div class="row">
        <input
          v-model="stuPass"
          class="ginput"
          style="flex: 1"
          type="password"
          placeholder="至少 4 位"
          autocomplete="new-password"
        />
        <button class="gbtn primary" @click="saveStuPass">保存</button>
      </div>
      <button class="gmini danger" style="margin-top: 8px" @click="clearStuPass">清除学生密码</button>

      <h3 class="sec-title" style="margin-top: 20px">协作教师</h3>
      <p class="foot-note" style="margin: 0 0 8px">协作教师与本班班主任权限相同，都可编辑考勤、作业与消息。</p>
      <div class="acct-list">
        <div v-for="t in store.teachers" :key="t.id" class="acct-row">
          <b>{{ t.name }}</b>
          <span class="role-tag">{{ t.is_owner ? '班主任' : '协作教师' }}</span>
          <button v-if="!t.is_owner" class="gmini danger" @click="removeTeacher(t)">移除</button>
        </div>
      </div>
      <div class="row" style="margin-top: 10px">
        <select v-model.number="addTeacherId" class="gselect" style="flex: 1">
          <option :value="null" disabled>选择要添加的教师</option>
          <option v-for="t in availableTeachers" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <button class="gbtn" :disabled="!addTeacherId" @click="addTeacher">添加</button>
      </div>

      <h3 class="sec-title" style="margin-top: 20px">每日寄语来源</h3>
      <p class="foot-note" style="margin: 0 0 8px">大板寄语卡的句子来源。内置为精选古诗词（按日期轮换）；一言接口来自 hitokoto.cn，切换周期可调。</p>
      <div class="gseg">
        <button :class="{ on: quoteSource === 'builtin' }" @click="quoteSource = 'builtin'">内置诗词</button>
        <button :class="{ on: quoteSource === 'hitokoto' }" @click="quoteSource = 'hitokoto'">一言接口</button>
      </div>
      <div v-if="quoteSource === 'hitokoto'" style="margin-top: 10px">
        <p class="foot-note" style="margin: 0 0 6px">句子分类（可多选）：</p>
        <div class="cat-grid">
          <button
            v-for="cat in HITOKOTO_CATS"
            :key="cat.code"
            class="gmini"
            :class="{ on: quoteCats.includes(cat.code) }"
            @click="toggleQuoteCat(cat.code)"
          >{{ cat.label }}</button>
        </div>
        <div class="row" style="margin-top: 10px; align-items: center">
          <span class="foot-note">最大长度（10–100 字）：</span>
          <input v-model.number="quoteMaxLength" class="ginput" type="number" min="10" max="100" style="width: 90px" />
        </div>
        <div class="row" style="margin-top: 10px; align-items: center">
          <span class="foot-note">切换周期：</span>
          <select v-model.number="quoteRefresh" class="gselect" style="width: auto">
            <option v-for="opt in QUOTE_REFRESH_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
      <button class="gbtn primary" style="margin-top: 12px" @click="saveQuoteConfig">保存寄语设置</button>

      <h3 class="sec-title" style="margin-top: 20px">家长视图（只读链接）</h3>
      <p class="foot-note" style="margin: 0 0 8px">家长打开链接可查看脱敏后的今日作业/课程/出勤与本周汇总（学生姓名仅显示姓氏和拼音首字母）。聊天消息不对家长开放。</p>
      <div v-if="parentQr" class="parent-box">
        <img :src="parentQr" alt="家长视图二维码" class="parent-qr" />
        <div style="flex: 1; min-width: 0">
          <input class="ginput" style="width: 100%" readonly :value="parentLink" @focus="($event.target as HTMLInputElement).select()" />
          <div style="display: flex; gap: 8px; margin-top: 8px">
            <button class="gmini" @click="copyParentLink">复制链接</button>
            <button class="gmini" @click="genParentLink">重新生成（旧链接失效）</button>
          </div>
        </div>
      </div>
      <button v-else class="gbtn" @click="genParentLink">生成家长链接与二维码</button>

      <h3 class="sec-title" style="margin-top: 20px">快捷短语（一行一条，消息板块使用）</h3>
      <textarea v-model="quickPhrasesText" class="gtextarea" style="width: 100%" rows="4" placeholder="作业收齐了&#10;请求老师来教室&#10;一切正常"></textarea>
      <button class="gbtn" style="margin-top: 10px" @click="saveQuickPhrases">保存快捷短语</button>

      <h3 class="sec-title" style="margin-top: 20px">作业科目（顿号/逗号分隔）</h3>
      <textarea v-model="subjectsText" class="gtextarea" style="width: 100%" rows="3"></textarea>
      <button class="gbtn primary" style="margin-top: 10px" @click="saveSubjects">保存科目</button>

      <template v-if="!isStudent">
        <h3 class="sec-title" style="margin-top: 20px">修改我的密码</h3>
        <div class="row" style="flex-wrap: wrap">
          <input v-model="oldPass" class="ginput" style="flex: 1; min-width: 120px" type="password" placeholder="原密码" autocomplete="current-password" />
          <input v-model="newPass" class="ginput" style="flex: 1; min-width: 120px" type="password" placeholder="新密码（至少 4 位）" autocomplete="new-password" />
          <input v-model="newPass2" class="ginput" style="flex: 1; min-width: 120px" type="password" placeholder="确认新密码" autocomplete="new-password" />
          <button class="gbtn primary" @click="changeMyPassword">修改</button>
        </div>
      </template>

      <h3 class="sec-title" style="margin-top: 20px">数据备份与恢复</h3>
      <div class="row">
        <button class="gbtn" @click="downloadBackup"><Icon name="download" :size="15" /> 下载备份 JSON</button>
        <input ref="restoreInput" type="file" accept=".json" hidden @change="onRestoreFile" />
        <button class="gbtn danger" @click="restoreInput?.click()"><Icon name="upload" :size="15" /> 从备份恢复…</button>
      </div>
      <p class="foot-note" style="margin: 8px 0 0">
        备份包含本班全部名单、考勤、请假、作业、值日与日志；恢复会用备份内容覆盖当前班级数据，不可撤销。
      </p>
    </div>

    <div v-else-if="tab === 'audit'">
      <AuditPanel :class-id="store.current.id" />
    </div>

    <template v-else-if="tab === 'accounts'">
      <div class="glass pad">
        <h3 class="sec-title">创建教师账号（密码直接告知老师）</h3>
        <div class="acct-row" style="border: none">
          <input v-model="newTName" class="ginput" style="flex: 1; min-width: 140px" placeholder="教师姓名，如：李老师" maxlength="20" />
          <input v-model="newTPass" class="ginput" style="width: 160px" type="password" placeholder="初始密码" />
          <button class="gbtn primary" @click="createTeacher">创建</button>
        </div>
        <h3 class="sec-title" style="margin-top: 16px">账号列表</h3>
        <p class="foot-note" style="margin: 0 0 10px">重置密码后该账号所有会话立即下线，需要用新密码重新登录。</p>
        <div class="acct-list">
          <div v-for="u in adminUsers" :key="u.id" class="acct-row">
            <b>{{ u.name }}</b>
            <span class="role-tag">{{ u.role === 'admin' ? '管理员' : '教师' }}</span>
            <span class="foot-note">{{ u.class_count }} 个班</span>
            <button class="gmini" @click="resetTarget = u; resetPw = ''">重置密码</button>
          </div>
        </div>
        <div v-if="resetTarget" class="reset-box">
          <span>为 <b>{{ resetTarget.name }}</b> 设置新密码：</span>
          <input v-model="resetPw" class="ginput" style="width: 180px" type="password" placeholder="至少 4 位" />
          <button class="gbtn primary" @click="resetPassword">确认重置</button>
          <button class="gmini" @click="resetTarget = null">取消</button>
        </div>
      </div>

      <div class="glass pad" style="margin-top: 12px">
        <h3 class="sec-title">班级转让</h3>
        <p class="foot-note" style="margin: 0 0 10px">把班级的班主任改另一位教师（原班主任失去该班管理权）。</p>
        <div v-for="c in store.classes" :key="c.id" class="acct-row">
          <b>{{ c.name }}</b>
          <span class="foot-note">现任：{{ c.teacher_name }}</span>
          <button class="gmini" @click="transferClass = { id: c.id, name: c.name }; transferTo = null">转让</button>
        </div>
        <div v-if="transferClass" class="reset-box">
          <span>「{{ transferClass.name }}」转让给：</span>
          <select v-model.number="transferTo" class="gselect" style="width: 160px">
            <option :value="null" disabled>选择教师</option>
            <option v-for="u in adminUsers.filter((x) => x.role === 'teacher')" :key="u.id" :value="u.id">
              {{ u.name }}
            </option>
          </select>
          <button class="gbtn primary" @click="doTransfer">确认转让</button>
          <button class="gmini" @click="transferClass = null">取消</button>
        </div>
      </div>
    </template>

    <template v-else-if="tab === 'invites'">
      <div class="glass pad">
        <h3 class="sec-title">生成邀请码（30 天有效）</h3>
        <div class="row">
          <select v-model="inviteRole" class="gselect">
            <option value="teacher">教师（班主任）</option>
            <option value="admin">管理员</option>
          </select>
          <button class="gbtn primary" @click="genInvite">生成</button>
        </div>
        <p v-if="createdInvite" class="ok-text" style="margin: 10px 0 0">
          新邀请码：<b class="code">{{ createdInvite.code }}</b>
        </p>
      </div>
      <div class="glass pad" style="margin-top: 12px">
        <h3 class="sec-title">邀请码记录</h3>
        <div class="inv-list">
          <div v-for="i in invites" :key="i.code" class="inv-row">
            <b class="code">{{ i.code }}</b>
            <span>{{ i.role === 'teacher' ? '教师' : '管理员' }}</span>
            <span
              :class="i.used_at ? 'used' : new Date(i.expires_at) < new Date() ? 'used' : 'ok-text'"
            >
              {{ i.used_at ? `已使用（${i.used_by_name}）` : new Date(i.expires_at) < new Date() ? '已过期' : '可用' }}
            </span>
            <span class="foot-note">{{ i.expires_at.slice(0, 10) }}</span>
          </div>
          <p v-if="!invites.length" class="empty">还没有生成过邀请码</p>
        </div>
      </div>
    </template>

    <template v-else-if="tab === 'import'">
      <div class="glass pad">
        <h3 class="sec-title">导入旧系统数据</h3>
        <p class="foot-note" style="margin: 0 0 12px">
          在浏览器打开项目里的 tools/export-legacy.html，输入旧系统的同步码导出 JSON，然后在这里导入。同一同步码只能导入一次。
        </p>
        <input ref="fileInput" type="file" accept=".json" hidden @change="onFile" />
        <button class="gbtn" @click="fileInput?.click()">选择导出的 JSON 文件</button>
        <p v-if="importResult" class="ok-text" style="margin: 10px 0 0">{{ importResult }}</p>
        <p v-if="importError" class="err" style="margin: 10px 0 0">{{ importError }}</p>
      </div>
    </template>
  </template>

  <!-- 创建班级弹窗 -->
  <Teleport to="body">
    <div v-if="showCreate" class="gbackdrop" @click.self="showCreate = false">
      <div class="gpop">
        <h3 class="sec-title">创建班级</h3>
        <label class="flabel">班级名称</label>
        <input v-model="newName" class="ginput" style="width: 100%" placeholder="例如 高一(3)班" maxlength="20" />
        <label class="flabel">年级（可选）</label>
        <input v-model="newGrade" class="ginput" style="width: 100%" placeholder="例如 高一" maxlength="10" />
        <p v-if="createError" class="err">{{ createError }}</p>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px">
          <button class="gbtn" @click="showCreate = false">取消</button>
          <button class="gbtn primary" @click="createClass">创建</button>
        </div>
      </div>
    </div>
  </Teleport>

  <div v-if="toastMsg" class="gtoast">{{ toastMsg }}</div>
</template>

<style scoped>
.pad {
  padding: 16px 18px;
}
.manage-tabs {
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.manage-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.row .gbtn,
.row .gmini {
  flex: none;
}
.row .gselect {
  min-width: 120px;
  max-width: 100%;
}
.flabel {
  display: block;
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 600;
  margin: 10px 0 5px;
}
.code {
  letter-spacing: 1.5px;
  font-size: 15px;
}
.used {
  color: var(--faint);
}
.inv-list {
  display: flex;
  flex-direction: column;
}
.inv-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 2px;
  border-bottom: 1px solid var(--line-soft);
  font-size: 13px;
}
.empty-box {
  text-align: center;
  padding: 48px 16px;
}
.empty-box h2 {
  margin: 0 0 6px;
}
.empty-box .foot-note {
  margin: 0 0 16px;
}
.acct-list {
  display: flex;
  flex-direction: column;
}
.acct-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 2px;
  border-bottom: 1px solid var(--line-soft);
  font-size: 13px;
  flex-wrap: wrap;
}
.role-tag {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 2px 8px;
  border-radius: 999px;
}
.reset-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--field);
  border-radius: 10px;
  font-size: 13px;
  flex-wrap: wrap;
}
.parent-box {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.cat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.parent-qr {
  width: min(160px, 40vw);
  height: auto;
  border-radius: 12px;
  background: #fff;
  padding: 6px;
  flex: none;
}
</style>
