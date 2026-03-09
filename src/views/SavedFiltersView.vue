<script setup lang="ts">
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { useToast } from 'primevue/usetoast';
  import Button from 'primevue/button';
  import InputText from 'primevue/inputtext';
  import Dialog from 'primevue/dialog';

  import { useSavedFiltersStore } from '@/stores/saved-filters-store';

  import type { ISavedFilter } from '@/types/opensearch-types';

  const router = useRouter();
  const toast = useToast();
  const savedFiltersStore = useSavedFiltersStore();

  const confirmDeleteId = ref<string | null>(null);
  const showDeleteDialog = ref(false);

  const editingId = ref<string | null>(null);
  const editingName = ref('');

  const showImportDialog = ref(false);
  const importJson = ref('');

  function handleApply(filter: ISavedFilter) {
    router.push({ name: 'home', query: { filterId: filter.id } });
  }

  function handleStartEdit(filter: ISavedFilter) {
    editingId.value = filter.id;
    editingName.value = filter.name;
  }

  async function handleSaveEdit(filter: ISavedFilter) {
    if (!editingName.value.trim()) return;
    await savedFiltersStore.updateFilter(filter.id, editingName.value.trim(), filter.filters);
    editingId.value = null;
    toast.add({ severity: 'success', summary: 'Renomeado', detail: 'Filtro atualizado.', life: 2000 });
  }

  function handleCancelEdit() {
    editingId.value = null;
  }

  function handleConfirmDelete(id: string) {
    confirmDeleteId.value = id;
    showDeleteDialog.value = true;
  }

  async function handleDelete() {
    if (confirmDeleteId.value) {
      await savedFiltersStore.deleteFilter(confirmDeleteId.value);
      toast.add({ severity: 'info', summary: 'Removido', detail: 'Filtro excluído.', life: 2000 });
    }
    showDeleteDialog.value = false;
    confirmDeleteId.value = null;
  }

  function handleExport(filter: ISavedFilter) {
    const json = savedFiltersStore.exportFilter(filter.id);
    if (!json) return;
    downloadJson(json, `filtro-${filter.name.toLowerCase().replace(/\s+/g, '-')}.json`);
  }

  function handleExportAll() {
    const json = savedFiltersStore.exportAll();
    downloadJson(json, 'filtros-salvos.json');
  }

  function downloadJson(content: string, filename: string) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!importJson.value.trim()) return;
    try {
      const count = await savedFiltersStore.importFilters(importJson.value.trim());
      toast.add({
        severity: 'success',
        summary: 'Importado',
        detail: `${count} filtro(s) importado(s).`,
        life: 3000,
      });
      showImportDialog.value = false;
      importJson.value = '';
    } catch {
      toast.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'JSON inválido. Verifique o conteúdo e tente novamente.',
        life: 4000,
      });
    }
  }

  function handleFileImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      importJson.value = (e.target?.result as string) || '';
    };
    reader.readAsText(file);
    input.value = '';
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
  }

  function buildFilterTags(filter: ISavedFilter): string[] {
    const tags: string[] = [];
    const f = filter.filters;
    if (f.userIdentifier) tags.push(`Empresa: ${f.userIdentifier}`);
    if (f.action) tags.push(`Ação: ${f.action}`);
    if (f.transaction) tags.push(`TX: ${f.transaction.substring(0, 12)}...`);
    if (f.freeText) tags.push(`Busca: ${f.freeText}`);
    if (filter.totalHits != null) tags.push(`${filter.totalHits} registros`);
    return tags;
  }
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button
          icon="pi pi-arrow-left"
          severity="secondary"
          text
          rounded
          @click="router.push({ name: 'home' })"
        />
        <div>
          <h1 class="text-xl font-bold text-slate-800">Filtros Salvos</h1>
          <p class="text-sm text-slate-500">
            {{ savedFiltersStore.count }} filtro(s) salvo(s)
          </p>
        </div>
      </div>

      <div class="flex gap-2">
        <Button
          label="Importar"
          icon="pi pi-upload"
          severity="secondary"
          outlined
          size="small"
          @click="showImportDialog = true"
        />
        <Button
          v-if="savedFiltersStore.count > 0"
          label="Exportar Todos"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          @click="handleExportAll"
        />
      </div>
    </div>

    <div v-if="savedFiltersStore.count === 0" class="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
      <i class="pi pi-bookmark mb-3 text-4xl text-slate-300" />
      <p class="text-slate-500">Nenhum filtro salvo ainda.</p>
      <p class="mt-1 text-sm text-slate-400">
        Faça uma busca na tela principal e clique em "Salvar Filtro" para guardar.
      </p>
      <Button
        label="Ir para Busca"
        icon="pi pi-search"
        class="mt-4"
        severity="secondary"
        outlined
        @click="router.push({ name: 'home' })"
      />
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="filter in savedFiltersStore.sortedFilters"
        :key="filter.id"
        class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div v-if="editingId === filter.id" class="flex items-center gap-2">
              <InputText
                v-model="editingName"
                class="flex-1"
                size="small"
                autofocus
                @keyup.enter="handleSaveEdit(filter)"
                @keyup.escape="handleCancelEdit"
              />
              <Button
                icon="pi pi-check"
                text
                rounded
                size="small"
                severity="success"
                @click="handleSaveEdit(filter)"
              />
              <Button
                icon="pi pi-times"
                text
                rounded
                size="small"
                severity="secondary"
                @click="handleCancelEdit"
              />
            </div>

            <h3 v-else class="truncate text-base font-semibold text-slate-700">
              {{ filter.name }}
            </h3>

            <div class="mt-2 flex flex-wrap gap-1.5">
              <span
                v-for="(tag, idx) in buildFilterTags(filter)"
                :key="idx"
                class="inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700"
              >
                {{ tag }}
              </span>
              <span
                v-if="filter.insights"
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="{
                  'bg-blue-50 text-blue-700': filter.insights.severity === 'info',
                  'bg-amber-50 text-amber-700': filter.insights.severity === 'warning',
                  'bg-red-50 text-red-700': filter.insights.severity === 'critical',
                }"
              >
                <i class="pi pi-sparkles text-[10px]" />
                Insight IA
              </span>
            </div>

            <div v-if="filter.tags?.length" class="mt-2 flex flex-wrap gap-1.5">
              <span
                v-for="(tag, idx) in filter.tags"
                :key="`meta-${idx}`"
                class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700"
              >
                <span class="font-semibold">{{ tag.key }}:</span>
                {{ tag.value }}
              </span>
            </div>

            <div class="mt-2 flex gap-4 text-xs text-slate-400">
              <span>
                <i class="pi pi-calendar mr-1" />
                {{ formatDate(filter.createdAt) }}
              </span>
              <span v-if="filter.updatedAt !== filter.createdAt">
                <i class="pi pi-pencil mr-1" />
                {{ formatDate(filter.updatedAt) }}
              </span>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            <Button
              icon="pi pi-play"
              label="Aplicar"
              size="small"
              @click="handleApply(filter)"
            />
            <Button
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              severity="secondary"
              aria-label="Renomear"
              @click="handleStartEdit(filter)"
            />
            <Button
              icon="pi pi-download"
              text
              rounded
              size="small"
              severity="secondary"
              aria-label="Exportar"
              @click="handleExport(filter)"
            />
            <Button
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              aria-label="Excluir"
              @click="handleConfirmDelete(filter.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <Dialog
      v-model:visible="showDeleteDialog"
      modal
      header="Excluir Filtro"
      :style="{ width: '400px' }"
    >
      <p class="text-slate-600">Tem certeza que deseja excluir este filtro? Essa ação não pode ser desfeita.</p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Cancelar" severity="secondary" text @click="showDeleteDialog = false" />
          <Button label="Excluir" icon="pi pi-trash" severity="danger" @click="handleDelete" />
        </div>
      </template>
    </Dialog>

    <!-- Import dialog -->
    <Dialog
      v-model:visible="showImportDialog"
      modal
      header="Importar Filtros"
      :style="{ width: '520px' }"
    >
      <div class="space-y-4">
        <div>
          <label class="mb-2 block text-sm font-medium text-slate-600">Arquivo JSON</label>
          <input
            type="file"
            accept=".json"
            class="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
            @change="handleFileImport"
          />
        </div>
        <div v-if="importJson" class="rounded-md border border-slate-200 bg-slate-50 p-3">
          <pre class="max-h-[200px] overflow-auto text-xs text-slate-600">{{ importJson }}</pre>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Cancelar" severity="secondary" text @click="showImportDialog = false" />
          <Button
            label="Importar"
            icon="pi pi-upload"
            :disabled="!importJson.trim()"
            @click="handleImport"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>
