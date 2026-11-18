/// <reference types="vite/client" />

/** 构建时间戳（vite define 注入，见 vite.config.ts） */
declare const __BUILD_AT__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
