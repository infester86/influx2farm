import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type ExportCsvParams, type ExportProgressPayload } from '../shared/ipc'
import type { ElectronApi, ExportResult } from '../shared/electron-api'
import type { AppSettingsDto, GetSettingsResult, SaveSettingsResult } from '../shared/settings'

/**
 * IPC uses structured clone. Svelte 5 `$state` / `bind:group` values can be Proxies or
 * otherwise non-cloneable; `JSON` forces a plain JSON tree Electron can always serialize.
 */
function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function exportParamsForIpc(p: ExportCsvParams): ExportCsvParams {
  const plain: Record<string, unknown> = {
    bucket: String(p.bucket),
    measurements: Array.from(p.measurements as Iterable<unknown>, String),
    start: String(p.start),
    stop: String(p.stop)
  }
  if (p.fields && p.fields.length > 0) {
    plain.fields = Array.from(p.fields as Iterable<unknown>, String)
  }
  if (p.defaultFileName != null && String(p.defaultFileName) !== '') {
    plain.defaultFileName = String(p.defaultFileName)
  }
  return jsonClone(plain) as ExportCsvParams
}

const api: ElectronApi = {
  listBuckets: (): Promise<string[]> => ipcRenderer.invoke(IPC.LIST_BUCKETS),
  listMeasurements: (bucket: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC.LIST_MEASUREMENTS, String(bucket)),
  listFields: (bucket: string, measurement: string): Promise<string[]> =>
    ipcRenderer.invoke(
      IPC.LIST_FIELDS,
      jsonClone({ bucket: String(bucket), measurement: String(measurement) })
    ),
  exportCsv: (params: ExportCsvParams): Promise<ExportResult> =>
    ipcRenderer.invoke(IPC.EXPORT_CSV, exportParamsForIpc(params)),
  cancelExport: (): Promise<{ ok: true }> => ipcRenderer.invoke(IPC.EXPORT_CANCEL),
  onExportProgress: (cb: (p: ExportProgressPayload) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: ExportProgressPayload): void => {
      cb(jsonClone(payload))
    }
    ipcRenderer.on(IPC.EXPORT_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC.EXPORT_PROGRESS, handler)
    }
  },
  getSettings: (): Promise<GetSettingsResult> => ipcRenderer.invoke(IPC.SETTINGS_GET),
  saveSettings: (settings: AppSettingsDto): Promise<SaveSettingsResult> =>
    ipcRenderer.invoke(
      IPC.SETTINGS_SAVE,
      jsonClone({
        influxUrl: String(settings.influxUrl),
        influxOrg: String(settings.influxOrg),
        influxToken: String(settings.influxToken),
        influxTimeoutMs:
          settings.influxTimeoutMs === null || settings.influxTimeoutMs === undefined
            ? null
            : Number(settings.influxTimeoutMs)
      })
    ),
  onOpenSettings: (cb: () => void): (() => void) => {
    const handler = (): void => {
      cb()
    }
    ipcRenderer.on(IPC.APP_OPEN_SETTINGS, handler)
    return () => {
      ipcRenderer.removeListener(IPC.APP_OPEN_SETTINGS, handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
