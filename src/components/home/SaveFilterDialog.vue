<script setup lang="ts">
  import { ref, watch } from 'vue';
  import Dialog from 'primevue/dialog';
  import InputText from 'primevue/inputtext';
  import Button from 'primevue/button';

  import { useSavedFiltersStore } from '@/stores/saved-filters-store';

  import type { ISearchFilters, IOpenSearchResponse } from '@/types/opensearch-types';

  const props = defineProps<{
    visible: boolean;
    filters: ISearchFilters | null;
    results: IOpenSearchResponse | null;
  }>();

  const emit = defineEmits<{
    'update:visible': [value: boolean];
    saved: [];
  }>();

  const savedFiltersStore = useSavedFiltersStore();
  const filterName = ref('');

  watch(
    () => props.visible,
    (val) => {
      if (val) filterName.value = '';
    },
  );

  function handleSave() {
    if (!filterName.value.trim() || !props.filters) return;
    savedFiltersStore.saveFilter(
      filterName.value.trim(),
      props.filters,
      props.results ?? undefined,
    );
    emit('saved');
    emit('update:visible', false);
  }

  function buildSummary(filters: ISearchFilters | null): string[] {
    if (!filters) return [];
    const parts: string[] = [];
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate).toLocaleDateString('pt-BR');
      const end = new Date(filters.endDate).toLocaleDateString('pt-BR');
      parts.push(`Período: ${start} - ${end}`);
    }
    if (filters.userIdentifier) parts.push(`Empresa: ${filters.userIdentifier}`);
    if (filters.action) parts.push(`Ação: ${filters.action}`);
    if (filters.transaction) parts.push(`Transação: ${filters.transaction}`);
    if (filters.freeText) parts.push(`Busca livre: ${filters.freeText}`);
    return parts;
  }
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Salvar Filtro"
    :style="{ width: '480px' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="space-y-4">
      <div class="flex flex-col gap-1.5">
        <label for="filter-name" class="text-sm font-medium text-slate-600">
          Nome do filtro
        </label>
        <InputText
          id="filter-name"
          v-model="filterName"
          placeholder="Ex: Logs PagCerto - Produção"
          class="w-full"
          autofocus
          @keyup.enter="handleSave"
        />
      </div>

      <div v-if="filters" class="rounded-md border border-slate-100 bg-slate-50 p-3">
        <span class="mb-2 block text-xs font-medium uppercase text-slate-400">
          Filtros que serão salvos
        </span>
        <ul class="space-y-1">
          <li
            v-for="(item, idx) in buildSummary(filters)"
            :key="idx"
            class="text-sm text-slate-600"
          >
            {{ item }}
          </li>
        </ul>
      </div>

      <div v-if="results" class="rounded-md border border-green-100 bg-green-50 p-3">
        <span class="block text-xs font-medium uppercase text-green-600">
          Resultados incluídos
        </span>
        <p class="mt-1 text-sm text-green-700">
          {{ results.hits?.total?.value ?? 0 }} registros ({{ results.took }}ms)
          serão salvos junto com os filtros.
        </p>
      </div>

      <div v-else class="rounded-md border border-amber-100 bg-amber-50 p-3">
        <p class="text-sm text-amber-700">
          <i class="pi pi-info-circle mr-1" />
          Nenhum resultado de busca disponível. Execute uma busca antes de salvar
          para incluir os dados.
        </p>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          label="Cancelar"
          severity="secondary"
          text
          @click="emit('update:visible', false)"
        />
        <Button
          label="Salvar"
          icon="pi pi-save"
          :disabled="!filterName.trim() || !filters"
          @click="handleSave"
        />
      </div>
    </template>
  </Dialog>
</template>
