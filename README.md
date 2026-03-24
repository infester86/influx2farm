# Influx2Farm

Desktop-App (Electron + Vite + Svelte 5 + TypeScript) zum Export von InfluxDB-v2-Rohdaten als CSV. Zugangsdaten werden nur im **Main-Prozess** aus einer **`.env`**-Datei geladen.

## Voraussetzungen

- Node.js 20+ (empfohlen: aktuelle LTS)
- Windows 10/11 zum Erzeugen der `.exe`

## Einrichtung

1. Repository klonen bzw. Ordner öffnen.
2. Abhängigkeiten installieren:

```bash
npm install
```

3. `.env` anlegen (Vorlage: [`.env.example`](.env.example)):

```env
INFLUX_URL=http://localhost:8086
INFLUX_TOKEN=…
INFLUX_ORG=…
```

4. Entwicklung starten:

```bash
npm run dev
```

## Einstellungen in der App

Unter **Datei → Einstellungen…** (oder **Strg+,**) bzw. dem Button **Einstellungen** kannst du URL, Organisation, Token und optionalen HTTP-Timeout setzen. Sie werden als `.env` im Electron-**userData**-Ordner gespeichert (Windows typisch `%APPDATA%\influx2farm\.env`). Diese Datei hat **Vorrang** vor einer `.env` im Projektordner.

Leeres Token-Feld beim Speichern bedeutet: vorhandenes Token aus der App-`.env` beibehalten.

## Produktions-Build (Windows)

1. App bauen und Installer + portable EXE erzeugen:

```bash
npm run build
```

Die Konfiguration setzt `signAndEditExecutable: false`, damit der Build auf Windows ohne Code-Signing-Toolchain und ohne Symlink-Rechte (Entwickler-Modus) durchläuft. Für die Auslieferung kannst du später echtes Signing ergänzen.

2. Ausgabe liegt unter `release/` (u. a. NSIS-Setup und portable `Influx2Farm … .exe`).

Nur Vite/Electron-Build ohne Installer:

```bash
npm run build:app
```

## GitHub Build fuer EXE

Es gibt einen GitHub-Actions-Workflow unter `.github/workflows/build-windows-exe.yml`.

- Trigger: `push` auf `main`, Pull Requests auf `main`, manuell via `workflow_dispatch`
- Ergebnis: Windows-Build inkl. EXE-Dateien als Artifact `influx2farm-windows-release`

## `.env` in der gebauten App

Es wird nacheinander die **erste vorhandene** Datei geladen:

1. `userData` (z. B. `%APPDATA%\\influx2farm\\.env`) — inkl. per UI gespeicherte Einstellungen
2. Aktuelles Arbeitsverzeichnis (`process.cwd()`)
3. Neben der ausführbaren Datei (`<Installationsordner>\\.env`), wenn die App gepackt ist

## Architektur (Kurz)

- **Renderer (Svelte):** nur UI und IPC; keine DB-Secrets.
- **Main:** `dotenv`, Zod-Validierung, Influx-Client, Flux-Streaming, CSV-Schreiben per Stream (`fast-csv` + `fs.createWriteStream`), Fortschritt per IPC-Events.

## Typprüfung

```bash
npm run typecheck
```
