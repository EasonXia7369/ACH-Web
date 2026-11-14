<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useDark, useToggle } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import { useClassStore } from '@/stores/class'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const store = useClassStore()

const isDark = useDark({ storageKey: 'ark-theme' })
const toggleDark = useToggle(isDark)

const NAV = [
  { to: '/board', name: '大板', icon: 'board' },
  { to: '/attendance', name: '出勤', icon: 'attendance' },
  { to: '/homework', name: '作业', icon: 'homework' },
  { to: '/manage', name: '管理', icon: 'manage' },
]

const switching = ref(false)

async function switchClass(e: Event) {
  const id = Number((e.target as HTMLSelectElement).value)
  switching.value = true
  try {
    await store.switchTo(id)
  } finally {
    switching.value = false
  }
}

function logout() {
  auth.logout()
  store.reset()
  router.replace('/login')
}

onMounted(() => {
  if (!store.loaded) store.loadClasses().catch(() => {})
})
</script>

<template>
  <div class="shell">
    <!-- 桌面侧栏 -->
    <aside class="rail glass">
      <div class="rail-logo" title="班级中心">
        <Icon name="check" :size="20" />
      </div>
      <nav class="rail-nav">
        <RouterLink
          v-for="item in NAV"
          :key="item.to"
          :to="item.to"
          class="rail-item"
          :class="{ on: route.path.startsWith(item.to) }"
        >
          <Icon :name="item.icon" :size="20" />
          <span>{{ item.name }}</span>
        </RouterLink>
      </nav>
      <div class="rail-foot">
        <button class="rail-item" :title="isDark ? '切换浅色' : '切换深色'" @click="toggleDark()">
          <Icon :name="isDark ? 'sun' : 'moon'" :size="20" />
          <span>{{ isDark ? '浅色' : '深色' }}</span>
        </button>
        <button class="rail-item" title="退出登录" @click="logout">
          <Icon name="logout" :size="20" />
          <span>退出</span>
        </button>
      </div>
    </aside>

    <div class="main-col">
      <!-- 顶栏 -->
      <header class="topbar">
        <div class="top-left">
          <h1>{{ store.current?.name ?? '班级中心' }}</h1>
          <select
            v-if="store.classes.length > 1"
            class="gselect cls-switch"
            :value="store.current?.id"
            @change="switchClass"
          >
            <option v-for="c in store.classes" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="top-right">
          <span class="whoami">{{ auth.user?.name }}<i v-if="auth.user?.role === 'admin'">管理员</i><i v-else-if="auth.user?.role === 'student'">值日生</i></span>
          <button class="gbtn icon topbtn" :title="isDark ? '切换浅色' : '切换深色'" @click="toggleDark()">
            <Icon :name="isDark ? 'sun' : 'moon'" :size="17" />
          </button>
          <button class="gbtn icon topbtn" title="退出登录" @click="logout">
            <Icon name="logout" :size="17" />
          </button>
        </div>
      </header>

      <main class="content" :class="{ switching }">
        <RouterView />
      </main>
    </div>

    <!-- 手机底部导航 -->
    <nav class="mobilenav glass-strong">
      <RouterLink
        v-for="item in NAV"
        :key="item.to"
        :to="item.to"
        class="mobile-item"
        :class="{ on: route.path.startsWith(item.to) }"
      >
        <Icon :name="item.icon" :size="21" />
        <span>{{ item.name }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
}

/* 侧栏 */
.rail {
  position: sticky;
  top: 0;
  height: 100vh;
  width: 84px;
  flex: none;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  border-top: none;
  border-bottom: none;
  border-left: none;
  padding: 14px 10px;
  gap: 8px;
  z-index: 40;
}
.rail-logo {
  width: 44px;
  height: 44px;
  margin: 0 auto 6px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f6ef7, #2f49b2);
  color: #fff;
  display: grid;
  place-items: center;
  flex: none;
}
.rail-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}
.rail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 4px 8px;
  border-radius: var(--radius-sm);
  color: var(--muted);
  text-decoration: none;
  font-size: 11px;
  font-weight: 600;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}
.rail-item:hover {
  background: var(--field);
  color: var(--text);
}
.rail-item.on {
  background: var(--primary-soft);
  color: var(--primary);
}
.rail-foot {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 主列 */
.main-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 24px 0;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
}
.top-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.top-left h1 {
  margin: 0;
  font-size: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cls-switch {
  padding: 5px 9px;
  font-size: 12.5px;
  width: auto;
}
.top-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.topbtn {
  flex: none;
}
.whoami {
  font-size: 12.5px;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.whoami i {
  font-style: normal;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 2px 7px;
  border-radius: 999px;
}
.content {
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 14px 24px 40px;
  transition: opacity 0.15s;
}
.content.switching {
  opacity: 0.4;
  pointer-events: none;
}

/* 手机底部导航 */
.mobilenav {
  display: none;
}

@media (max-width: 860px) {
  .rail {
    display: none;
  }
  .mobilenav {
    display: flex;
    position: fixed;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    width: min(420px, calc(100vw - 20px));
    justify-content: space-around;
    padding: 6px;
    z-index: 50;
  }
  .mobile-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 14px;
    border-radius: 12px;
    color: var(--muted);
    text-decoration: none;
    font-size: 10.5px;
    font-weight: 600;
    transition: background 0.15s, color 0.15s;
  }
  .mobile-item.on {
    background: var(--primary-soft);
    color: var(--primary);
  }
  .topbar {
    padding: 12px 16px 0;
  }
  .content {
    padding: 12px 16px calc(72px + env(safe-area-inset-bottom));
  }
}
</style>
