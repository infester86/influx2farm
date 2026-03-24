import fs from 'fs'
import path from 'path'
import { config as loadDotenv, parse as parseDotenv } from 'dotenv'
import { z } from 'zod'
import { app } from 'electron'

export const envSchema = z.object({
  INFLUX_URL: z.string().url(),
  INFLUX_TOKEN: z.string().min(1),
  INFLUX_ORG: z.string().min(1),
  INFLUX_TIMEOUT_MS: z.coerce.number().positive().optional()
})

export type AppConfig = z.infer<typeof envSchema>

/** Reihenfolge: App-Daten zuerst (Einstellungen aus der UI), dann Projektordner, dann portable EXE. */
function candidateEnvPaths(): string[] {
  const list: string[] = []
  try {
    list.push(path.join(app.getPath('userData'), '.env'))
  } catch {
    // app nicht bereit
  }
  list.push(path.join(process.cwd(), '.env'))
  try {
    if (app.isPackaged) {
      list.push(path.join(path.dirname(process.execPath), '.env'))
    }
  } catch {
    // ignore
  }
  return list
}

export function getUserDataEnvPath(): string {
  return path.join(app.getPath('userData'), '.env')
}

export function parseEnvFileAt(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {}
  }
  return parseDotenv(fs.readFileSync(filePath, 'utf8'))
}

function formatEnvLine(key: string, value: string): string {
  if (/[\n\r#]/.test(value) || /^\s/.test(value) || /\s$/.test(value)) {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `${key}="${escaped}"`
  }
  return `${key}=${value}`
}

export function writeAppEnvFile(cfg: AppConfig): void {
  const p = getUserDataEnvPath()
  const lines: string[] = [
    formatEnvLine('INFLUX_URL', cfg.INFLUX_URL),
    formatEnvLine('INFLUX_TOKEN', cfg.INFLUX_TOKEN),
    formatEnvLine('INFLUX_ORG', cfg.INFLUX_ORG)
  ]
  if (cfg.INFLUX_TIMEOUT_MS !== undefined) {
    lines.push(formatEnvLine('INFLUX_TIMEOUT_MS', String(cfg.INFLUX_TIMEOUT_MS)))
  }
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, `${lines.join('\n')}\n`, 'utf8')
  loadDotenv({ path: p, override: true })
}

export function loadEnv(): AppConfig {
  const tried: string[] = []
  for (const p of candidateEnvPaths()) {
    tried.push(p)
    if (fs.existsSync(p)) {
      loadDotenv({ path: p, override: true })
      break
    }
  }

  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors
    throw new Error(
      `Invalid or missing .env configuration. Tried: ${tried.join(', ')}. Issues: ${JSON.stringify(issues)}`
    )
  }

  return parsed.data
}
