<script lang="ts">
  type Props = {
    items: string[]
    selected: string[]
    disabled?: boolean
  }

  let { items, selected = $bindable([]), disabled = false }: Props = $props()

  function selectAll(): void {
    if (disabled) return
    selected = [...items]
  }

  function clearAll(): void {
    if (disabled) return
    selected = []
  }
</script>

<div class="picker">
  <div class="picker__toolbar">
    <button type="button" class="btn ghost" {disabled} onclick={selectAll}>Alle</button>
    <button type="button" class="btn ghost" {disabled} onclick={clearAll}>Keine</button>
    <span class="muted">{selected.length} / {items.length} gewählt</span>
  </div>
  <ul class="picker__list">
    {#each items as item (item)}
      <li>
        <label class="row">
          <input type="checkbox" value={item} bind:group={selected} {disabled} />
          <span>{item}</span>
        </label>
      </li>
    {/each}
  </ul>
</div>

<style>
  .picker {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    max-height: 220px;
    display: flex;
    flex-direction: column;
  }
  .picker__toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
  }
  .picker__list {
    margin: 0;
    padding: 6px 0;
    overflow: auto;
    list-style: none;
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 6px 12px;
    cursor: pointer;
    user-select: none;
  }
  .row:hover {
    background: color-mix(in oklab, var(--accent) 8%, transparent);
  }
  .muted {
    margin-left: auto;
    color: var(--muted);
    font-size: 12px;
  }
</style>
