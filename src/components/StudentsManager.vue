<script setup lang="ts">
import { computed, ref } from 'vue'
import { get, post, put } from '@/api'
import { useClassStore } from '@/stores/class'
import { pinyinInitial, initialOf } from '@/utils/pinyin'

const store = useClassStore()

const newName = ref('')
const error = ref('')
const toastMsg = ref('')
const q = ref('')
const editId = ref<number | null>(null)
const editName = ref('')

const list = computed(() =>
  store.students.filter((s) => !q.value.trim() || s.name.includes(q.value.trim())),
)
const inactive = computed(() => store.students.filter((s) => !s.active))

function toast(msg: string) {
  toastMsg.value = msg
  setTimeout(() => (toastMsg.value = ''), 2200)
}

async function add() {
  error.value = ''
  if (!newName.value.trim()) return
  try {
    const res = await post<{ student: { id: number } }>(
      `/api/classes/${store.current!.id}/students`,
      { name: newName.value.trim(), pinyin_initial: pinyinInitial(newName.value) },
    )
    const sid = res.student.id
    // 拉一次班级详情同步本地名单
    const detail = await get<{ students: any[] }>(`/api/classes/${store.current!.id}`)
    store.students = detail.students
    newName.value = ''
    toast(`已添加（学号 ${sid}）`)
  } catch (e: any) {
    error.value = e.message
  }
}

function startEdit(s: any) {
  editId.value = s.id
  editName.value = s.name
}

async function saveEdit() {
  if (editId.value === null) return
  await put(`/api/classes/${store.current!.id}/students/${editId.value}`, {
    name: editName.value.trim(),
  })
  editId.value = null
  await refresh()
}

async function setActive(s: any, active: boolean) {
  await put(`/api/classes/${store.current!.id}/students/${s.id}`, { active })
  await refresh()
}

async function refresh() {
  const detail = await get<{ students: any[] }>(`/api/classes/${store.current!.id}`)
  store.students = detail.students
}
</script>

<template>
  <div class="glass pad">
    <div class="addrow">
      <input
        v-model="newName"
        class="ginput"
        style="flex: 1"
        placeholder="输入姓名添加学生，如：李小明"
        maxlength="20"
        @keyup.enter="add"
      />
      <button class="gbtn primary" @click="add">添加</button>
    </div>
    <p v-if="error" class="err" style="margin: 8px 0 0">{{ error }}</p>
    <div class="searchrow">
      <input v-model="q" class="ginput" style="flex: 1" type="search" placeholder="搜名单" />
      <span class="foot-note">在册 {{ store.students.filter((s) => s.active).length }} 人 · 停用 {{ inactive.length }} 人</span>
    </div>
  </div>

  <div class="glass pad" style="margin-top: 12px">
    <div class="roster">
      <div v-for="s in list" :key="s.id" class="stu-row" :class="{ off: !s.active }">
        <span class="seq num">{{ s.seq }}</span>
        <template v-if="editId === s.id">
          <input v-model="editName" class="ginput" style="flex: 1" maxlength="20" @keyup.enter="saveEdit" />
          <button class="gbtn primary" @click="saveEdit">保存</button>
          <button class="gbtn" @click="editId = null">取消</button>
        </template>
        <template v-else>
          <span class="stu-name">{{ s.name }}</span>
          <span class="stu-initial">{{ initialOf(s) }}</span>
          <span v-if="!s.active" class="off-badge">已停用</span>
          <button class="gmini" @click="startEdit(s)">改名</button>
          <button v-if="s.active" class="gmini danger" @click="setActive(s, false)">停用</button>
          <button v-else class="gmini" @click="setActive(s, true)">恢复</button>
        </template>
      </div>
    </div>
    <p class="foot-note" style="margin: 10px 2px 0">
      停用不是删除：历史考勤与作业记录保留，名单里不再显示；转学/退班用停用。
    </p>
  </div>

  <div v-if="toastMsg" class="gtoast">{{ toastMsg }}</div>
</template>

<style scoped>
.pad {
  padding: 16px 18px;
}
.addrow {
  display: flex;
  gap: 8px;
}
.searchrow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.roster {
  display: flex;
  flex-direction: column;
}
.stu-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 4px;
  border-bottom: 1px solid var(--line-soft);
}
.stu-row.off .stu-name {
  color: var(--faint);
  text-decoration: line-through;
}
.seq {
  width: 26px;
  color: var(--faint);
  font-size: 12px;
  flex: none;
}
.stu-name {
  font-size: 13.5px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}
.stu-initial {
  color: var(--faint);
  font-size: 11.5px;
  width: 24px;
  text-align: center;
  flex: none;
}
.off-badge {
  font-size: 10.5px;
  color: var(--faint);
  background: var(--field);
  padding: 2px 8px;
  border-radius: 999px;
}
.gmini.danger {
  color: var(--absent);
}
</style>
