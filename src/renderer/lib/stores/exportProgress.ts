import { writable } from 'svelte/store'
import type { ExportProgressPayload } from '../../../shared/ipc'

export type ExportUiState =
  | { status: 'idle' }
  | { status: 'picking_path' }
  | { status: 'exporting'; rowsWritten: number; phase: ExportProgressPayload['phase'] }
  | { status: 'done'; rowsWritten: number; path: string }
  | { status: 'error'; message: string }
  | { status: 'cancelled' }

export const exportUi = writable<ExportUiState>({ status: 'idle' })

export function resetExportUi(): void {
  exportUi.set({ status: 'idle' })
}
