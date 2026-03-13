<script setup lang="ts">
  import { ref, watch } from 'vue';
  import Dialog from 'primevue/dialog';
  import InputText from 'primevue/inputtext';
  import Button from 'primevue/button';

  import { useSavedFiltersStore } from '@/stores/saved-filters-store';

  import type {
    ISearchFilters,
    IOpenSearchResponse,
    ISavedFilterTag,
  } from '@/types/opensearch-types';
  import type { IInsightResult } from '@/types/insights-types';

  const props = defineProps<{
    visible: boolean;
    filters: ISearchFilters | null;
    results: IOpenSearchResponse | null;
    insights: IInsightResult | null;
  }>();

  const emit = defineEmits<{
    'update:visible': [value: boolean];
    saved: [];
  }>();

  const savedFiltersStore = useSavedFiltersStore();
  const filterName = ref('');
  const tags = ref<ISavedFilterTag[]>([]);
  const newTagKey = ref('');
  const newTagValue = ref('');

  watch(
    () => props.visible,
    (val) => {
      if (val) {
        filterName.value = '';
        tags.value = [];
        newTagKey.value = '';
        newTagValue.value = '';
      }
    },
  );

  function handleAddTag() {
    const key = newTagKey.value.trim();
    const value = newTagValue.value.trim();
    if (!key || !value) return;
    tags.value.push({ key, value });
    newTagKey.value = '';
    newTagValue.value = '';
  }

  function handleRemoveTag(index: number) {
    tags.value.splice(index, 1);
  }

  function handleSave() {
    if (!filterName.value.trim() || !props.filters) return;
    savedFiltersStore.saveFilter(
      filterName.value.trim(),
      props.filters,
      props.results ?? undefined,
      props.insights ?? undefined,
      tags.value.length > 0 ? [...tags.value] : undefined,
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
    if (filters.userIdentifier) {
      const ids = filters.userIdentifier.split(',');
      parts.push(ids.length > 1 ? `Empresas: ${ids.length} selecionadas` : `Empresa: ${ids[0]}`);
    }
    if (filters.action) parts.push(`Ação: ${filters.action}`);
    if (filters.transaction) parts.push(`Transação: ${filters.transaction}`);
    if (filters.freeText) parts.push(`Busca livre: ${filters.freeText}`);
    return parts;
  }

  const tagSuggestions = ['Jira', 'Ticket', 'Sprint', 'Responsável', 'Descrição', 'Prioridade'];
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Salvar Filtro"
    :style="{ width: '540px' }"
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

      <!-- Insights indicator -->
      <div v-if="insights" class="rounded-md border border-violet-100 bg-violet-50 p-3">
        <span class="block text-xs font-medium uppercase text-violet-600">
          Insights da IA incluídos
        </span>
        <p class="mt-1 text-sm text-violet-700">
          <i class="pi pi-sparkles mr-1" />
          A análise da IA ({{ insights.severity }}) será salva junto com o filtro.
        </p>
      </div>

      <!-- Tags / Metadata -->
      <div class="rounded-md border border-slate-200 bg-white p-3">
        <span class="mb-2 block text-xs font-medium uppercase text-slate-400">
          Informações adicionais (opcional)
        </span>

        <div v-if="tags.length" class="mb-3 space-y-1.5">
          <div
            v-for="(tag, idx) in tags"
            :key="idx"
            class="flex items-center gap-2 rounded bg-slate-50 px-2.5 py-1.5"
          >
            <span class="text-xs font-semibold text-slate-500">{{ tag.key }}:</span>
            <span class="flex-1 text-sm text-slate-700">{{ tag.value }}</span>
            <button
              class="text-slate-300 transition-colors hover:text-red-500"
              @click="handleRemoveTag(idx)"
            >
              <i class="pi pi-times text-xs" />
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <InputText
            v-model="newTagKey"
            placeholder="Chave (ex: Jira)"
            class="w-1/3 text-sm"
            size="small"
            :suggestions="tagSuggestions"
          />
          <InputText
            v-model="newTagValue"
            placeholder="Valor (ex: PROJ-1234)"
            class="flex-1 text-sm"
            size="small"
            @keyup.enter="handleAddTag"
          />
          <Button
            icon="pi pi-plus"
            size="small"
            severity="secondary"
            outlined
            :disabled="!newTagKey.trim() || !newTagValue.trim()"
            @click="handleAddTag"
          />
        </div>

        <div v-if="!tags.length" class="mt-2 flex flex-wrap gap-1">
          <button
            v-for="suggestion in tagSuggestions"
            :key="suggestion"
            class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
            @click="newTagKey = suggestion"
          >
            {{ suggestion }}
          </button>
        </div>
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
