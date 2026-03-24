import type { AppConfig } from '../env'
import { getInfluxClient } from './client'

export async function listBuckets(cfg: AppConfig): Promise<string[]> {
  const influx = getInfluxClient(cfg)
  const queryApi = influx.getQueryApi(cfg.INFLUX_ORG)
  const flux = `
buckets()
  |> keep(columns: ["name"])
  |> sort(columns: ["name"])
`

  const names: string[] = []
  for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
    const row = tableMeta.toObject(values) as Record<string, unknown>
    const n = row.name
    if (typeof n === 'string' && n.length > 0) {
      names.push(n)
    }
  }
  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}
