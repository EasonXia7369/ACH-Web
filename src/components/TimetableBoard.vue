<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { get, put } from '@/api'
import { useClassStore } from '@/stores/class'
import Icon from '@/components/Icon.vue'

const props = defineProps<{ classId: number }>()
const store = useClassStore()

const WD = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const MAX_PERIOD = 12

const weekday = ref(1)
const rows = ref<Array<{ period: number; subject: string; teacher: string }>>(
  Array.from({ length: 8 }, (_, i) => ({ period: i + 1, subject: '', teacher: '' })),
)
const loading = ref(false)
const saving = ref(false)
const toastMsg = ref('')
const loadError = ref('')

function toast(msg: string) {
  toastMsg.value = msg
  setTimeout(() => (toastMsg.value = ''), 2200)
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await get<{ timetable: Array<{ weekday: number; period: number; subject: string; teacher: string }> }>(
      `/api/classes/${props.classId}/timetable`,
    )
    const day = res.timetable.filter((r) => r.weekday === weekday.value)
    const maxP = day.reduce((m, r) => Math.max(m, r.period), 8)
    rows.value = Array.from({ length: Math.max(8, Math.min(12, maxP)) }, (_, i) => {
      const hit = day.find((r) => r.period === i + 1)
      return { period: i + 1, subject: hit?.subject ?? '', teacher: hit?.teacher ?? '' }
    })
  } catch (e: any) {
    loadError.value = e.message ?? '课表加载失败'
    rows.value = Array.from({ length: 8 }, (_, i) => ({ period: i + 1, subject: '', teacher: '' }))
  } finally {
    loading.value = false
  }
}

watch([weekday, () => props.classId], load, { immediate: true })

async function save() {
  saving.value = true
  try {
    const periods = rows.value.filter((r) => r.subject.trim())
    await put(`/api/classes/${props.classId}/timetable`, { weekday: weekday.value, periods })
    toast(`周${WD[weekday.value - 1]}课表已保存（${periods.length} 节）`)
  } catch (e: any) {
    toast(e.message)
  } finally {
    saving.value = false
  }
}

function addRow() {
  if (rows.value.length < MAX_PERIOD) {
    rows.value.push({ period: rows.value.length + 1, subject: '', teacher: '' })
  }
}

const filledCount = computed(() => rows.value.filter((r) => r.subject.trim()).length)
</script>

<template>
  <div class="glass pad">
    <div class="daybar">
      <button
        v-for="(d, i) in WD"
        :key="d"
        class="gmini day-btn"
        :class="{ on: weekday === i + 1 }"
        @click="weekday = i + 1"
      >
        {{ d }}
      </button>
      <span class="foot-note" style="margin-left: auto">{{ filledCount }} 节</span>
    </div>

    <div v-if="loading" class="empty">加载中…</div>
    <div v-if="loadError" class="err" style="margin-bottom: 10px">{{ loadError }}（请确认后端已启动且迁移已应用）</div>
    <div v-else class="rows">
      <div v-for="(r, i) in rows" :key="r.period" class="row">
        <span class="period num">{{ r.period }}</span>
        <input v-model="r.subject" class="ginput" placeholder="科目（留空 = 无课）" maxlength="8" />
        <input v-model="r.teacher" class="ginput" placeholder="任课老师（可选）" maxlength="12" />
        <button v-if="i === rows.length - 1 && rows.length < MAX_PERIOD" class="gmini" @click="addRow">
          ＋节
        </button>
      </div>
    </div>

    <div class="acts">
      <button class="gbtn primary" :disabled="saving" @click="save">
        <Icon name="check" :size="15" /> 保存周{{ WD[weekday - 1].slice(1) }}课表
      </button>
    </div>
    <p class="foot-note" style="margin: 8px 2px 0">
      科目留空即视为无课；保存后大板「今日课程」卡片与周报会同步使用。
    </p>
  </div>

  <div v-if="toastMsg" class="gtoast">{{ toastMsg }}</div>
</template>

<style scoped>
.pad {
  padding: 16px 18px;
}
.daybar {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.day-btn.on {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.period {
  width: 30px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--field);
  color: var(--muted);
  font-weight: 600;
  flex: none;
}
.row .ginput:nth-of-type(1) {
  flex: 1;
}
.row .ginput:nth-of-type(2) {
  width: 160px;
  flex: none;
}
.acts {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}
</style>
