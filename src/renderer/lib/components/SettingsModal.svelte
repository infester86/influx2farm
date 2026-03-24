<script lang="ts">
  import type { AppSettingsDto } from '../../../shared/settings'

  type Props = {
    open: boolean
    onClose: () => void
    onSaved: () => void
  }

  let { open = $bindable(false), onClose, onSaved }: Props = $props()

  let influxUrl = $state('')
  let influxOrg = $state('')
  let influxToken = $state('')
  let influxTimeoutMs = $state('')
  let loading = $state(false)
  let saving = $state(false)
  let error = $state<string | null>(null)

  async function loadForm(): Promise<void> {
    loading = true
    error = null
    try {
      const res = await window.api.getSettings()
      if (!res.ok) {
        error = res.message
        return
      }
      applyDto(res.settings)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  }

  function applyDto(s: AppSettingsDto): void {
    influxUrl = s.influxUrl
    influxOrg = s.influxOrg
    influxToken = s.influxToken
    influxTimeoutMs = s.influxTimeoutMs === null ? '' : String(s.influxTimeoutMs)
  }

  $effect(() => {
    if (open) {
      void loadForm()
    }
  })

  function close(): void {
    open = false
    onClose()
  }

  async function save(): Promise<void> {
    saving = true
    error = null
    const timeoutTrim = influxTimeoutMs.trim()
    const payload: AppSettingsDto = {
      influxUrl: influxUrl.trim(),
      influxOrg: influxOrg.trim(),
      influxToken: influxToken,
      influxTimeoutMs: timeoutTrim === '' ? null : Number(timeoutTrim)
    }
    if (payload.influxTimeoutMs !== null && Number.isNaN(payload.influxTimeoutMs)) {
      error = 'Timeout muss eine positive Zahl (ms) sein oder leer bleiben.'
      saving = false
      return
    }
    try {
      const res = await window.api.saveSettings(payload)
      if (!res.ok) {
        error = res.message
        return
      }
      open = false
      onSaved()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      saving = false
    }
  }

  function onBackdropKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      close()
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="backdrop"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) close()
    }}
    onkeydown={onBackdropKeydown}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1">
      <div class="modal__head">
        <h2 id="settings-title">Einstellungen</h2>
        <button type="button" class="icon-btn" onclick={close} aria-label="Schließen">×</button>
      </div>

      <p class="lede">
        Die Werte landen in einer <code>.env</code> im Electron-<code>userData</code>-Ordner (unter Windows typisch
        <code>%APPDATA%\influx2farm\.env</code>) und überschreiben damit eine <code>.env</code> im
        Projektverzeichnis.
      </p>

      {#if loading}
        <p class="muted">Lade…</p>
      {:else}
        <div class="fields">
          <label class="field">
            <span>Influx URL</span>
            <input type="url" bind:value={influxUrl} placeholder="http://localhost:8086" autocomplete="off" />
          </label>
          <label class="field">
            <span>Organisation</span>
            <input type="text" bind:value={influxOrg} placeholder="my-org" autocomplete="off" />
          </label>
          <label class="field">
            <span>API-Token</span>
            <input
              type="password"
              bind:value={influxToken}
              placeholder="Leer lassen = unverändert lassen"
              autocomplete="off"
            />
          </label>
          <label class="field">
            <span>Timeout (ms, optional)</span>
            <input
              type="text"
              bind:value={influxTimeoutMs}
              placeholder="z. B. 300000"
              autocomplete="off"
            />
          </label>
        </div>
      {/if}

      {#if error}
        <p class="err">{error}</p>
      {/if}

      <div class="modal__actions">
        <button type="button" class="btn ghost" onclick={close} disabled={saving}>Abbrechen</button>
        <button type="button" class="btn primary" onclick={save} disabled={loading || saving}>
          Speichern
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .modal {
    width: min(520px, 100%);
    max-height: min(90vh, 720px);
    overflow: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 18px 20px 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
  }
  .modal__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  .modal__head h2 {
    margin: 0;
    font-size: 18px;
  }
  .icon-btn {
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
  }
  .icon-btn:hover {
    color: var(--text);
    background: color-mix(in oklab, var(--accent) 12%, transparent);
  }
  .lede {
    margin: 0 0 14px;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.45;
  }
  .lede code {
    font-size: 11px;
  }
  .fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .field span {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .field input {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: color-mix(in oklab, var(--bg) 40%, var(--surface));
    color: var(--text);
    font: inherit;
  }
  .modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 18px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .err {
    margin: 10px 0 0;
    color: #fecaca;
    font-size: 13px;
  }
  .muted {
    color: var(--muted);
  }
</style>
