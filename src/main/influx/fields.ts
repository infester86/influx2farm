import type { AppConfig } from '../env'
import { getInfluxClient } from './client'

function escapeFluxString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function listFields(
  cfg: AppConfig,
  bucket: string,
  measurement: string
): Promise<string[]> {
  const influx = getInfluxClient(cfg)
  const queryApi = influx.getQueryApi(cfg.INFLUX_ORG)
  const b = escapeFluxString(bucket)
  const m = escapeFluxString(measurement)
  const flux = `import "influxdata/influxdb/schema"

schema.measurementFieldKeys(bucket: "${b}", measurement: "${m}", start: -100y)
`

  const names: string[] = []
  for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
    const row = tableMeta.toObject(values) as Record<string, unknown>
    const name = row._value ?? row._field
    if (typeof name === 'string' && name.length > 0) {
      names.push(name)
    }
  }
  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}
