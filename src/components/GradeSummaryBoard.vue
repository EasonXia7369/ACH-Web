<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { get } from '@/api'
import Icon from '@/components/Icon.vue'

/**
 * 年级只读汇总（年级主任 / 校管理员 / 平台超管）：
 * 选年级 → 各班当日出勤对比 + 今日作业一览。所有数据服务端聚合，本组件零写入。
 */

interface GradeItem {
  id: number
  name: string
  school_name: string
  class_count: number
}
interface ClassSummary {
  id: number
  name: string
  teacher_name: string
  student_count: number
  present: number
  leave: number
  late: number
  absent: number
  violate: number
  tasks: Array<{ subject: string; content: string }>
}

const grades = ref<GradeItem[]>([])
const gradeId = ref<number | null>(null)
const day = ref(dayjs().format('YYYY-MM-DD'))
const loading = ref(false)
const summary = ref<ClassSummary[] | null>(null)

const ZH: Record<string, string> = { leave: '请假', late: '迟到', absent: '旷课', violate: '违纪' }

async function loadGrades() {
  grades.value = (await get<{ grades: GradeItem[] }>('/api/grades/mine')).grades
  if (grades.value.length && gradeId.value == null) {
    gradeId.value = grades.value[0].id
  }
}

async function loadSummary() {
  if (!gradeId.value) return
  loading.value = true
  try {
    const res = await get<{ classes: ClassSummary[] }>(
      `/api/grades/${gradeId.value}/summary?day=${day.value}`,
    )
    summary.value = res.classes
  } catch {
    summary.value = null
  } finally {
    loading.value = false
  }
}

function shiftDay(n: number) {
  day.value = dayjs(day.value).add(n, 'day').format('YYYY-MM-DD')
}

function onDateChange(e: Event) {
  day.value = (e.target as HTMLInputElement).value || day.value
}

onMounted(loadGrades)
watch(gradeId, loadSummary, { immediate: true })
watch(day, loadSummary)
</script>

<template>
  <div>
    <div class="gseg-wrap">
      <div v-if="grades.length > 1" class="gseg">
        <button
          v-for="g in grades"
          :key="g.id"
          :class="{ on: gradeId === g.id }"
          @click="gradeId = g.id"
        >{{ g.name }}<i v-if="g.school_name" class="school-tag">{{ g.school_name }}</i></button>
      </div>
      <div class="datebar">
        <button class="gmini" @click="shiftDay(-1)">‹</button>
        <input class="ginput" type="date" :value="day" @change="onDateChange" />
        <button class="gmini" @click="day = dayjs().format('YYYY-MM-DD')">今天</button>
      </div>
    </div>

    <p v-if="!grades.length" class="foot-note" style="margin-top: 12px">
      你还没有可查看的年级：年级主任由管理员在「学校管理」中指派。
    </p>

    <div v-else-if="summary" class="glass pad" style="margin-top: 12px">
      <div v-if="loading" class="foot-note">加载中…</div>
      <template v-else>
        <table class="gtable">
          <thead>
            <tr>
              <th>班级</th>
              <th>班主任</th>
              <th>应到</th>
              <th style="color: var(--present)">实到</th>
              <th style="color: var(--leave)">请假</th>
              <th style="color: var(--late)">迟到</th>
              <th style="color: var(--absent)">旷课</th>
              <th style="color: var(--violate)">违纪</th>
              <th>今日作业</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cl in summary" :key="cl.id">
              <td><b>{{ cl.name }}</b></td>
              <td>{{ cl.teacher_name }}</td>
              <td>{{ cl.student_count }}</td>
              <td>{{ cl.present }}</td>
              <td>{{ cl.leave }}</td>
              <td>{{ cl.late }}</td>
              <td>{{ cl.absent }}</td>
              <td>{{ cl.violate }}</td>
              <td class="tasks-cell">
                <span v-if="cl.tasks.length">
                  <span v-for="t in cl.tasks" :key="t.subject" class="task-chip" :title="t.content">
                    <Icon name="homework" :size="12" /> {{ t.subject }}
                  </span>
                </span>
                <span v-else class="foot-note">未布置</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="foot-note" style="margin: 10px 0 0">
          考勤按「天」口径统计（同班同学生同状态算一次）；作业为所选日期单日数据。只读汇总，如需修改请进入对应班级。
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.gseg-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.datebar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.datebar .ginput {
  padding: 6px 10px;
  width: auto;
}
.school-tag {
  font-style: normal;
  font-size: 10px;
  color: var(--faint);
  margin-left: 4px;
}
.tasks-cell {
  text-align: left !important;
  max-width: 260px;
}
.task-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  margin-right: 4px;
}
</style>
