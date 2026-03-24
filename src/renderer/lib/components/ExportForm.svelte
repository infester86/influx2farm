<script lang="ts">
  import flatpickr from 'flatpickr'
  import 'flatpickr/dist/flatpickr.min.css'
  import CheckboxPicker from './CheckboxPicker.svelte'
  import { exportUi, resetExportUi } from '../stores/exportProgress'

  type Props = {
    buckets: string[]
    configError: string | null
  }

  let { buckets, configError }: Props = $props()

  let bucket = $state('')
  let measurements = $state<string[]>([])
  let selectedMeasurements = $state<string[]>([])
  let measurementsError = $state<string | null>(null)
  let loadingMeasurements = $state(false)

  let fieldNames = $state<string[]>([])
  let selectedFields = $state<string[]>([])
  let fieldsError = $state<string | null>(null)
  let loadingFields = $state(false)
  let fieldsLoadGen = 0

  let startInput = $state<HTMLInputElement | null>(null)
  let stopInput = $state<HTMLInputElement | null>(null)
  let startIso = $state('')
  let stopIso = $state('')

  let unsubscribeProgress: (() => void) | null = null

  $effect(() => {
    if (!startInput || !stopInput) {
      return
    }

    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)

    let fpStart: ReturnType<typeof flatpickr> | undefined
    let fpStop: ReturnType<typeof flatpickr> | undefined

    fpStart = flatpickr(startInput, {
      enableTime: true,
      enableSeconds: true,
      time_24hr: true,
      allowInput: true,
      dateFormat: 'Y-m-d H:i:S',
      defaultDate: startOfDay,
      onChange: (dates: Date[]) => {
        const d = dates[0]
        startIso = d ? d.toISOString() : ''
      }
    })

    fpStop = flatpickr(stopInput, {
      enableTime: true,
      enableSeconds: true,
      time_24hr: true,
      allowInput: true,
      dateFormat: 'Y-m-d H:i:S',
      defaultDate: now,
      onChange: (dates: Date[]) => {
        const d = dates[0]
        stopIso = d ? d.toISOString() : ''
      }
    })

    const d0 = fpStart.selectedDates[0]
    const d1 = fpStop.selectedDates[0]
    startIso = d0 ? d0.toISOString() : ''
    stopIso = d1 ? d1.toISOString() : ''

    return () => {
      fpStart?.destroy()
      fpStop?.destroy()
    }
  })

  $effect(() => {
    if (!bucket) {
      measurements = []
      selectedMeasurements = []
      return
    }
    loadingMeasurements = true
    measurementsError = null
    void window.api
      .listMeasurements(bucket)
      .then((list) => {
        measurements = list
        selectedMeasurements = []
      })
      .catch((e) => {
        measurements = []
        selectedMeasurements = []
        measurementsError = e instanceof Error ? e.message : String(e)
      })
      .finally(() => {
        loadingMeasurements = false
      })
  })

  $effect(() => {
    if (!bucket || selectedMeasurements.length === 0) {
      fieldNames = []
      selectedFields = []
      fieldsError = null
      loadingFields = false
      return
    }
    const gen = ++fieldsLoadGen
    loadingFields = true
    fieldsError = null
    void Promise.all(
      selectedMeasurements.map((m) => window.api.listFields(bucket, m))
    )
      .then((lists) => {
        if (gen !== fieldsLoadGen) return
        const merged = [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b))
        fieldNames = merged
        selectedFields = [...merged]
      })
      .catch((e) => {
        if (gen !== fieldsLoadGen) return
        fieldNames = []
        selectedFields = []
        fieldsError = e instanceof Error ? e.message : String(e)
      })
      .finally(() => {
        if (gen === fieldsLoadGen) {
          loadingFields = false
        }
      })
  })

  async function runExport(): Promise<void> {
    resetExportUi()
    measurementsError = null

    if (!bucket) {
      exportUi.set({ status: 'error', message: 'Bitte einen Bucket wählen.' })
      return
    }
    if (selectedMeasurements.length === 0) {
      exportUi.set({ status: 'error', message: 'Bitte mindestens ein Measurement wählen.' })
      return
    }
    if (fieldNames.length > 0 && selectedFields.length === 0) {
      exportUi.set({ status: 'error', message: 'Bitte mindestens ein Feld wählen.' })
      return
    }
    if (!startIso || !stopIso) {
      exportUi.set({ status: 'error', message: 'Bitte Start- und Endzeit setzen.' })
      return
    }
    if (new Date(startIso).getTime() >= new Date(stopIso).getTime()) {
      exportUi.set({ status: 'error', message: 'Start muss vor Ende liegen.' })
      return
    }

    unsubscribeProgress?.()
    unsubscribeProgress = window.api.onExportProgress((p) => {
      exportUi.set({ status: 'exporting', rowsWritten: p.rowsWritten, phase: p.phase })
    })

    const safeBucket = bucket.replace(/[^\w.-]+/g, '_')
    const measurementsForExport = Array.from(selectedMeasurements, String)
    const fieldsForExport =
      fieldNames.length > 0 &&
      selectedFields.length > 0 &&
      selectedFields.length < fieldNames.length
        ? Array.from(selectedFields, String)
        : undefined

    exportUi.set({ status: 'picking_path' })

    try {
      const res = await window.api.exportCsv({
        bucket: String(bucket),
        measurements: measurementsForExport,
        ...(fieldsForExport ? { fields: fieldsForExport } : {}),
        start: String(startIso),
        stop: String(stopIso),
        defaultFileName: `${safeBucket}-export.csv`
      })

      if (res.ok) {
        exportUi.set({ status: 'done', rowsWritten: res.rowsWritten, path: res.path })
      } else if (res.reason === 'cancelled') {
        exportUi.set({ status: 'cancelled' })
      } else {
        exportUi.set({ status: 'error', message: res.message })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      exportUi.set({ status: 'error', message })
    } finally {
      unsubscribeProgress?.()
      unsubscribeProgress = null
    }
  }

  async function cancelExport(): Promise<void> {
    await window.api.cancelExport()
  }
</script>

<div class="form">
  {#if configError}
    <div class="banner error">{configError}</div>
  {/if}

  <label class="field">
    <span>Bucket</span>
    <select bind:value={bucket} disabled={buckets.length === 0}>
      <option value="">— wählen —</option>
      {#each buckets as b (b)}
        <option value={b}>{b}</option>
      {/each}
    </select>
  </label>

  <div class="field">
    <span>Measurements</span>
    {#if loadingMeasurements}
      <p class="muted">Lade Measurements…</p>
    {:else if measurementsError}
      <p class="banner error tight">{measurementsError}</p>
    {:else if bucket && measurements.length === 0}
      <p class="muted">Keine Measurements gefunden.</p>
    {:else}
      <CheckboxPicker bind:selected={selectedMeasurements} items={measurements} disabled={!bucket} />
    {/if}
  </div>

  <div class="field">
    <span>Felder (_field)</span>
    {#if !bucket || selectedMeasurements.length === 0}
      <p class="muted">Zuerst Measurements wählen.</p>
    {:else if loadingFields}
      <p class="muted">Lade Felder…</p>
    {:else if fieldsError}
      <p class="banner error tight">{fieldsError}</p>
    {:else if fieldNames.length === 0}
      <p class="muted">Keine Felder gemeldet — Export ohne Feldfilter.</p>
    {:else}
      <CheckboxPicker bind:selected={selectedFields} items={fieldNames} disabled={!bucket} />
    {/if}
  </div>

  <div class="grid2">
    <label class="field">
      <span>Start</span>
      <input bind:this={startInput} type="text" placeholder="Startzeit" />
    </label>
    <label class="field">
      <span>Ende</span>
      <input bind:this={stopInput} type="text" placeholder="Endzeit" />
    </label>
  </div>

  <p class="hint">
    Zeiten werden in der lokalen Zeitzone gewählt; für Flux wird <code>toISOString()</code> (UTC) verwendet.
  </p>

  <div class="actions">
    <button
      class="btn primary"
      type="button"
      onclick={runExport}
      disabled={!!configError}
      title={configError ?? undefined}
    >
      Export starten
    </button>
    <button class="btn ghost" type="button" onclick={cancelExport}>Abbrechen</button>
  </div>

  {#if $exportUi.status === 'picking_path'}
    <p class="progress muted">
      Speichern-Dialog sollte offen sein. Kein Fenster sichtbar? In der Taskleiste nach einem weiteren
      Eintrag zu dieser App schauen oder <kbd>Alt</kbd>+<kbd>Tab</kbd>.
    </p>
  {:else if $exportUi.status === 'exporting'}
    <p class="progress">
      Schreibe CSV… <strong>{$exportUi.rowsWritten.toLocaleString()}</strong> Zeilen
      <span class="muted">({$exportUi.phase})</span>
    </p>
  {:else if $exportUi.status === 'done'}
    <p class="banner ok">
      Fertig: <strong>{$exportUi.rowsWritten.toLocaleString()}</strong> Zeilen →
      <code>{$exportUi.path}</code>
    </p>
  {:else if $exportUi.status === 'cancelled'}
    <p class="banner muted tight">Export abgebrochen.</p>
  {:else if $exportUi.status === 'error'}
    <p class="banner error">{$exportUi.message}</p>
  {/if}

</div>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field span {
    font-weight: 600;
    font-size: 13px;
    color: var(--muted);
  }
  select,
  input[type='text'] {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 720px) {
    .grid2 {
      grid-template-columns: 1fr;
    }
  }
  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .progress {
    margin: 0;
  }
  .progress kbd {
    font-size: 0.85em;
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: color-mix(in oklab, var(--surface) 80%, #000);
  }
  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
  .hint code {
    font-size: 11px;
  }
  .banner {
    margin: 0;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    font-size: 14px;
  }
  .banner.tight {
    padding: 8px 10px;
  }
  .banner.error {
    border-color: color-mix(in oklab, #f87171 55%, var(--border));
    background: color-mix(in oklab, #f87171 12%, transparent);
  }
  .banner.ok {
    border-color: color-mix(in oklab, #34d399 55%, var(--border));
    background: color-mix(in oklab, #34d399 12%, transparent);
  }
  .banner.muted {
    color: var(--muted);
  }
  .muted {
    color: var(--muted);
    font-size: 13px;
  }
</style>
