import type { LauncherAPI } from '../../preload/index'

declare global {
  interface Window {
    launcher: LauncherAPI
  }
}

export {}
