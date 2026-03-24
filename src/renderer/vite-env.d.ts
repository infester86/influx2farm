/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { ElectronApi } from '../shared/electron-api'

declare global {
  interface Window {
    api: ElectronApi
  }
}

export {}
