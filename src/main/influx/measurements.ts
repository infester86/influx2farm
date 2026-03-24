import type { AppConfig } from '../env'
import { getInfluxClient } from './client'

function escapeFluxString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function listMeasurements(
  cfg: AppConfig,
  bucket: string
): Promise<string[]> {
  const influx = getInfluxClient(cfg)
  const queryApi = influx.getQueryApi(cfg.INFLUX_ORG)
  const b = escapeFluxString(bucket)
  const flux = `from(bucket: "${b}")
  |> range(start: -100y)
  |> keep(columns: ["_measurement"])
  |> distinct(column: "_measurement")
  |> sort(columns: ["_measurement"])
`

  const names: string[] = []
  for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
    const row = tableMeta.toObject(values) as Record<string, unknown>
    const name = row._measurement ?? row._value
    if (typeof name === 'string' && name.length > 0) {
      names.push(name)
    }
  }
  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}
