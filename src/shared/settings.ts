export type AppSettingsDto = {
  influxUrl: string
  influxOrg: string
  influxToken: string
  influxTimeoutMs: number | null
}

export type GetSettingsResult =
  | { ok: true; settings: AppSettingsDto }
  | { ok: false; message: string }

export type SaveSettingsResult =
  | { ok: true }
  | { ok: false; message: string }
