import { InfluxDB } from '@influxdata/influxdb-client'
import type { AppConfig } from '../env'

let client: InfluxDB | null = null
let lastConfigKey = ''

export function getInfluxClient(cfg: AppConfig): InfluxDB {
  const key = `${cfg.INFLUX_URL}|${cfg.INFLUX_TOKEN}|${cfg.INFLUX_TIMEOUT_MS ?? ''}`
  if (client && lastConfigKey === key) {
    return client
  }
  lastConfigKey = key
  client = new InfluxDB({
    url: cfg.INFLUX_URL,
    token: cfg.INFLUX_TOKEN,
    timeout: cfg.INFLUX_TIMEOUT_MS ?? 300_000
  })
  return client
}

export function resetInfluxClient(): void {
  client = null
  lastConfigKey = ''
}
