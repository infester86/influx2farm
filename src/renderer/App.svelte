<script lang="ts">
  import { onMount } from 'svelte'
  import ExportForm from './lib/components/ExportForm.svelte'
  import SettingsModal from './lib/components/SettingsModal.svelte'

  let buckets = $state<string[]>([])
  let loadError = $state<string | null>(null)
  let settingsOpen = $state(false)

  async function refreshBuckets(): Promise<void> {
    loadError = null
    try {
      buckets = await window.api.listBuckets()
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e)
      buckets = []
    }
  }

  onMount(() => {
    void refreshBuckets()
    return window.api.onOpenSettings(() => {
      settingsOpen = true
    })
  })
</script>

<main class="shell">
  <header class="hero">
    <div class="hero__row">
      <div>
        <h1>Influx2Farm</h1>
        <p>
          InfluxDB v2 Rohdaten als CSV exportieren — Verbindung konfigurierbar unter
          <strong>Datei → Einstellungen</strong> (<kbd>Ctrl</kbd>+<kbd>,</kbd>).
        </p>
      </div>
      <button
        type="button"
        class="btn ghost settings-btn"
        onclick={() => {
          settingsOpen = true
        }}
      >
        Einstellungen
      </button>
    </div>
  </header>

  <ExportForm {buckets} configError={loadError} />

  <SettingsModal
    bind:open={settingsOpen}
    onClose={() => {
      settingsOpen = false
    }}
    onSaved={() => {
      void refreshBuckets()
    }}
  />
</main>

<style>
  .shell {
    max-width: 920px;
    margin: 0 auto;
    padding: 28px 20px 40px;
  }
  .hero h1 {
    margin: 0 0 8px;
    font-size: 28px;
    letter-spacing: -0.02em;
  }
  .hero p {
    margin: 0;
    color: var(--muted);
    line-height: 1.5;
  }
  .hero__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
  }
  .settings-btn {
    flex-shrink: 0;
  }
  kbd {
    font-size: 0.85em;
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: color-mix(in oklab, var(--surface) 80%, #000);
  }
</style>
