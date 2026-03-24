import fs from 'fs'
import { finished } from 'node:stream/promises'
import { format } from 'fast-csv'
import type { AppConfig } from '../env'
import { getInfluxClient } from './client'
import type { ExportProgressPayload } from '../../shared/ipc'

function escapeFluxString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildMeasurementFilter(measurements: string[]): string {
  if (measurements.length === 0) {
    throw new Error('At least one measurement is required')
  }
  return measurements
    .map((m) => `r._measurement == "${escapeFluxString(m)}"`)
    .join(' or ')
}

function buildFieldFilter(fields: string[]): string {
  if (fields.length === 0) {
    throw new Error('At least one field is required when filtering fields')
  }
  return fields.map((f) => `r._field == "${escapeFluxString(f)}"`).join(' or ')
}

export type ExportCsvOptions = {
  bucket: string
  measurements: string[]
  /** If set and non-empty, only these `_field` values are exported (across chosen measurements). */
  fields?: string[]
  start: string
  stop: string
  filePath: string
  onProgress: (p: ExportProgressPayload) => void
  isCancelled: () => boolean
}

const PROGRESS_EVERY_ROWS = 5000
const PROGRESS_MIN_MS = 250

export async function exportMeasurementsToCsv(
  cfg: AppConfig,
  opts: ExportCsvOptions
): Promise<{ rowsWritten: number }> {
  const { bucket, measurements, fields, start, stop, filePath, onProgress, isCancelled } = opts
  const influx = getInfluxClient(cfg)
  const queryApi = influx.getQueryApi(cfg.INFLUX_ORG)

  const fieldPipe =
    fields && fields.length > 0
      ? `
  |> filter(fn: (r) => ${buildFieldFilter(fields)})`
      : ''

  const flux = `
from(bucket: "${escapeFluxString(bucket)}")
  |> range(start: time(v: "${escapeFluxString(start)}"), stop: time(v: "${escapeFluxString(stop)}"))
  |> filter(fn: (r) => ${buildMeasurementFilter(measurements)})${fieldPipe}
`

  const writeStream = fs.createWriteStream(filePath, { flags: 'w' })
  await new Promise<void>((resolve, reject) => {
    writeStream.once('error', reject)
    writeStream.once('open', () => resolve())
  })

  const csvStream = format({ headers: false, quoteColumns: true })
  csvStream.pipe(writeStream)

  let rowsWritten = 0
  let headerSignature = ''
  let lastProgressAt = 0

  const maybeReport = (phase: ExportProgressPayload['phase'], force = false) => {
    const now = Date.now()
    if (
      force ||
      rowsWritten % PROGRESS_EVERY_ROWS === 0 ||
      now - lastProgressAt >= PROGRESS_MIN_MS
    ) {
      lastProgressAt = now
      onProgress({ rowsWritten, phase })
    }
  }

  try {
    onProgress({ rowsWritten: 0, phase: 'query' })
    for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
      if (isCancelled()) {
        break
      }

      const labels = tableMeta.columns.map((c) => c.label)
      const sig = labels.join('\0')
      if (sig !== headerSignature) {
        headerSignature = sig
        csvStream.write(labels)
        maybeReport('write', true)
      }

      const obj = tableMeta.toObject(values) as Record<string, unknown>
      const row = labels.map((h) => {
        const v = obj[h]
        if (v === null || v === undefined) {
          return ''
        }
        return String(v)
      })
      csvStream.write(row)
      rowsWritten += 1
      maybeReport('write')
    }

    maybeReport('write', true)
  } finally {
    csvStream.end()
    await finished(writeStream)
  }

  if (isCancelled()) {
    try {
      fs.unlinkSync(filePath)
    } catch {
      // ignore
    }
    throw new Error('Export cancelled')
  }

  return { rowsWritten }
}
