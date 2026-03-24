export const IPC = {
  LIST_BUCKETS: 'influx:listBuckets',
  LIST_MEASUREMENTS: 'influx:listMeasurements',
  LIST_FIELDS: 'influx:listFields',
  EXPORT_CSV: 'influx:exportCsv',
  EXPORT_CANCEL: 'influx:exportCancel',
  EXPORT_PROGRESS: 'influx:exportProgress',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  APP_OPEN_SETTINGS: 'app:openSettings'
} as const

export type ExportProgressPayload = {
  rowsWritten: number
  phase: 'query' | 'write'
}

export type ExportCsvParams = {
  bucket: string
  measurements: string[]
  /** Subset of field keys; omit or leave empty to export all fields. */
  fields?: string[]
  start: string
  stop: string
  defaultFileName?: string
}
