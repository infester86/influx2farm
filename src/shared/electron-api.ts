import type { ExportCsvParams, ExportProgressPayload } from './ipc'
import type { AppSettingsDto, GetSettingsResult, SaveSettingsResult } from './settings'

export type ExportResult =
  | { ok: true; path: string; rowsWritten: number }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'error'; message: string }

export interface ElectronApi {
  listBuckets: () => Promise<string[]>
  listMeasurements: (bucket: string) => Promise<string[]>
  listFields: (bucket: string, measurement: string) => Promise<string[]>
  exportCsv: (params: ExportCsvParams) => Promise<ExportResult>
  cancelExport: () => Promise<{ ok: true }>
  onExportProgress: (cb: (p: ExportProgressPayload) => void) => () => void
  getSettings: () => Promise<GetSettingsResult>
  saveSettings: (settings: AppSettingsDto) => Promise<SaveSettingsResult>
  onOpenSettings: (cb: () => void) => () => void
}
