import path from 'path'
import { ipcMain, dialog, type BrowserWindow } from 'electron'
import { z } from 'zod'
import {
  envSchema,
  getUserDataEnvPath,
  loadEnv,
  parseEnvFileAt,
  writeAppEnvFile
} from './env'
import { listBuckets } from './influx/buckets'
import { listMeasurements } from './influx/measurements'
import { listFields } from './influx/fields'
import { exportMeasurementsToCsv } from './influx/exportCsv'
import { resetInfluxClient } from './influx/client'
import { IPC, type ExportCsvParams, type ExportProgressPayload } from '../shared/ipc'
import type { AppSettingsDto } from '../shared/settings'

let cachedConfig: ReturnType<typeof loadEnv> | null = null

function getConfig() {
  if (!cachedConfig) {
    cachedConfig = loadEnv()
  }
  return cachedConfig
}

const exportParamsSchema = z.object({
  bucket: z.string().min(1),
  measurements: z.array(z.string().min(1)).min(1),
  fields: z.array(z.string().min(1)).optional(),
  start: z.string().min(1),
  stop: z.string().min(1),
  defaultFileName: z.string().optional()
})

const saveSettingsSchema = z.object({
  influxUrl: z.string().url(),
  influxOrg: z.string().min(1),
  influxToken: z.string(),
  influxTimeoutMs: z.union([z.number().positive(), z.null()])
})

function readMergedEnvForForm(): AppSettingsDto {
  const ud = parseEnvFileAt(getUserDataEnvPath())
  const cw = parseEnvFileAt(path.join(process.cwd(), '.env'))
  const m = { ...cw, ...ud }
  const t = m.INFLUX_TIMEOUT_MS?.trim()
  return {
    influxUrl: m.INFLUX_URL ?? '',
    influxOrg: m.INFLUX_ORG ?? '',
    influxToken: m.INFLUX_TOKEN ?? '',
    influxTimeoutMs: t && t !== '' && !Number.isNaN(Number(t)) ? Number(t) : null
  }
}

let activeCancelExport: (() => void) | null = null

/** Rich errors (e.g. Influx HTTP) may carry non-cloneable fields and break IPC rejection serialization. */
function ipcErrorMessage(e: unknown): string {
  if (e instanceof z.ZodError) {
    return e.message
  }
  if (e instanceof Error) {
    return e.message
  }
  return String(e)
}

/** Nur JSON-typische Werte zurück an den Renderer — verhindert Structured-Clone-Fehler. */
function ipcPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    cachedConfig = null
    try {
      const cfg = loadEnv()
      cachedConfig = cfg
      return ipcPlain({
        ok: true as const,
        settings: {
          influxUrl: String(cfg.INFLUX_URL),
          influxOrg: String(cfg.INFLUX_ORG),
          influxToken: String(cfg.INFLUX_TOKEN),
          influxTimeoutMs:
            cfg.INFLUX_TIMEOUT_MS === undefined ? null : Number(cfg.INFLUX_TIMEOUT_MS)
        }
      })
    } catch {
      return ipcPlain({ ok: true as const, settings: readMergedEnvForForm() })
    }
  })

  ipcMain.handle(IPC.SETTINGS_SAVE, async (_evt, raw: unknown) => {
    let body: z.infer<typeof saveSettingsSchema>
    try {
      body = saveSettingsSchema.parse(raw)
    } catch (e) {
      return ipcPlain({ ok: false as const, message: ipcErrorMessage(e) })
    }
    const prevUd = parseEnvFileAt(getUserDataEnvPath())
    let token = body.influxToken.trim()
    if (!token) {
      token = (prevUd.INFLUX_TOKEN ?? '').trim()
    }
    if (!token) {
      token = readMergedEnvForForm().influxToken.trim()
    }
    if (!token) {
      return ipcPlain({
        ok: false as const,
        message:
          'API-Token fehlt. Trage ein Token ein oder speichere zuerst eine gültige Konfiguration in der App-.env.'
      })
    }

    let cfg: ReturnType<typeof envSchema.parse>
    try {
      cfg = envSchema.parse({
        INFLUX_URL: body.influxUrl,
        INFLUX_ORG: body.influxOrg,
        INFLUX_TOKEN: token,
        INFLUX_TIMEOUT_MS: body.influxTimeoutMs === null ? undefined : body.influxTimeoutMs
      })
    } catch (e) {
      return ipcPlain({ ok: false as const, message: ipcErrorMessage(e) })
    }

    writeAppEnvFile(cfg)
    cachedConfig = null
    resetInfluxClient()
    try {
      cachedConfig = loadEnv()
    } catch (e) {
      return ipcPlain({ ok: false as const, message: ipcErrorMessage(e) })
    }
    return ipcPlain({ ok: true as const })
  })

  ipcMain.handle(IPC.LIST_BUCKETS, async () => {
    try {
      const cfg = getConfig()
      return ipcPlain(await listBuckets(cfg))
    } catch (e) {
      throw new Error(ipcErrorMessage(e))
    }
  })

  ipcMain.handle(IPC.LIST_MEASUREMENTS, async (_evt, bucket: unknown) => {
    try {
      const b = z.string().min(1).parse(bucket)
      const cfg = getConfig()
      return ipcPlain(await listMeasurements(cfg, b))
    } catch (e) {
      throw new Error(ipcErrorMessage(e))
    }
  })

  ipcMain.handle(IPC.LIST_FIELDS, async (_evt, raw: unknown) => {
    try {
      const body = z
        .object({
          bucket: z.string().min(1),
          measurement: z.string().min(1)
        })
        .parse(raw)
      const cfg = getConfig()
      return ipcPlain(await listFields(cfg, body.bucket, body.measurement))
    } catch (e) {
      throw new Error(ipcErrorMessage(e))
    }
  })

  ipcMain.handle(IPC.EXPORT_CANCEL, async () => {
    activeCancelExport?.()
    return ipcPlain({ ok: true as const })
  })

  ipcMain.handle(IPC.EXPORT_CSV, async (event, raw: unknown) => {
    let params: ExportCsvParams
    try {
      params = exportParamsSchema.parse(raw) as ExportCsvParams
    } catch (e) {
      return ipcPlain({ ok: false as const, reason: 'error' as const, message: ipcErrorMessage(e) })
    }

    const win = getWindow()
    win?.focus()

    const saveOpts = {
      title: 'CSV exportieren',
      defaultPath: params.defaultFileName ?? 'export.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    }

    let dialogResult: Awaited<ReturnType<typeof dialog.showSaveDialog>>
    try {
      dialogResult = win
        ? await dialog.showSaveDialog(win, saveOpts)
        : await dialog.showSaveDialog(saveOpts)
    } catch (e) {
      return ipcPlain({ ok: false as const, reason: 'error' as const, message: ipcErrorMessage(e) })
    }

    if (dialogResult.canceled || !dialogResult.filePath) {
      return ipcPlain({ ok: false as const, reason: 'cancelled' as const })
    }

    const targetPath = dialogResult.filePath

    let cfg: ReturnType<typeof getConfig>
    try {
      cfg = getConfig()
    } catch (e) {
      return ipcPlain({ ok: false as const, reason: 'error' as const, message: ipcErrorMessage(e) })
    }

    let cancelled = false
    activeCancelExport = () => {
      cancelled = true
    }

    const sendProgress = (payload: { rowsWritten: number; phase: 'query' | 'write' }) => {
      const phase: ExportProgressPayload['phase'] = payload.phase === 'write' ? 'write' : 'query'
      event.sender.send(
        IPC.EXPORT_PROGRESS,
        ipcPlain({ rowsWritten: Number(payload.rowsWritten), phase })
      )
    }

    try {
      const fields =
        params.fields && params.fields.length > 0 ? params.fields : undefined

      const { rowsWritten } = await exportMeasurementsToCsv(cfg, {
        bucket: params.bucket,
        measurements: params.measurements,
        fields,
        start: params.start,
        stop: params.stop,
        filePath: targetPath,
        onProgress: sendProgress,
        isCancelled: () => cancelled
      })
      sendProgress({ rowsWritten, phase: 'write' })
      return ipcPlain({
        ok: true as const,
        path: String(targetPath),
        rowsWritten: Number(rowsWritten)
      })
    } catch (e) {
      const message = ipcErrorMessage(e)
      if (message === 'Export cancelled') {
        return ipcPlain({ ok: false as const, reason: 'cancelled' as const })
      }
      return ipcPlain({ ok: false as const, reason: 'error' as const, message })
    } finally {
      activeCancelExport = null
    }
  })
}
