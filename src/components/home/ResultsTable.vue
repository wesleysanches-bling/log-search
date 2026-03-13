<script setup lang="ts">
  import { ref } from 'vue';
  import DataTable from 'primevue/datatable';
  import Column from 'primevue/column';
  import Button from 'primevue/button';
  import Menu from 'primevue/menu';

  import { formatDateTime } from '@/utils/formatters/date-formatter';
  import { exportAsCSV, exportAsJSON } from '@/utils/export-utils';

  import type { ILogEntryParsed } from '@/types/opensearch-types';
  import type { MenuItem } from 'primevue/menuitem';

  const props = defineProps<{
    results: ILogEntryParsed[];
    totalHits: number;
    searchDuration: number;
    isSearching: boolean;
  }>();

  const emit = defineEmits<{
    viewDetails: [log: ILogEntryParsed];
  }>();

  const expandedRows = ref({});
  const exportMenu = ref();

  const exportMenuItems: MenuItem[] = [
    {
      label: 'Exportar como CSV',
      icon: 'pi pi-file',
      command: () => exportAsCSV(props.results),
    },
    {
      label: 'Exportar como JSON',
      icon: 'pi pi-file-export',
      command: () => exportAsJSON(props.results),
    },
  ];

  function toggleExportMenu(event: Event) {
    exportMenu.value.toggle(event);
  }

  const STATUS_MAP: Record<string, { label: string; class: string }> = {
    '0': { label: 'OK', class: 'bg-green-100 text-green-700' },
    '1': { label: 'AVISO', class: 'bg-amber-100 text-amber-700' },
    '2': { label: 'ERRO', class: 'bg-red-100 text-red-700' },
  };

  function getStatusBadge(log: ILogEntryParsed) {
    const rawStatus = String(log.status ?? '');

    if (STATUS_MAP[rawStatus]) return STATUS_MAP[rawStatus];

    const finalStatus = log.dataParsed?.final_status;
    if (finalStatus) {
      const fs = String(finalStatus).toUpperCase();
      if (fs.includes('ERRO')) return { label: fs, class: 'bg-red-100 text-red-700' };
      if (fs.includes('SUCESSO') || fs === 'OK') return { label: fs, class: 'bg-green-100 text-green-700' };
      return { label: fs, class: 'bg-blue-100 text-blue-700' };
    }

    return { label: rawStatus || '-', class: 'bg-slate-100 text-slate-600' };
  }

  function truncateText(text: string, max = 60): string {
    if (!text) return '-';
    return text.length > max ? text.substring(0, max) + '...' : text;
  }
</script>

<template>
  <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
      <div class="flex items-center gap-2">
        <i class="pi pi-list text-slate-600" />
        <h2 class="text-base font-semibold text-slate-700">Resultados</h2>
      </div>
      <div v-if="totalHits > 0" class="flex items-center gap-3 text-sm text-slate-500">
        <span>
          <strong class="text-slate-700">{{ totalHits }}</strong> registros encontrados
        </span>
        <span class="text-slate-300">|</span>
        <span>{{ searchDuration }}ms</span>
        <span class="text-slate-300">|</span>
        <Button
          icon="pi pi-download"
          label="Exportar"
          text
          size="small"
          severity="secondary"
          :disabled="results.length === 0"
          @click="toggleExportMenu"
        />
        <Menu ref="exportMenu" :model="exportMenuItems" popup />
      </div>
    </div>

    <DataTable
      v-model:expanded-rows="expandedRows"
      :value="results"
      :loading="isSearching"
      paginator
      :rows="20"
      :rows-per-page-options="[10, 20, 50, 100]"
      striped-rows
      removable-sort
      data-key="_id"
      empty-message="Nenhum log encontrado. Ajuste os filtros e tente novamente."
      class="text-sm"
    >
      <Column field="date" header="Data/Hora" sortable style="min-width: 170px">
        <template #body="slotProps">
          <span class="whitespace-nowrap font-mono text-xs">
            {{ formatDateTime(slotProps.data.date) }}
          </span>
        </template>
      </Column>

      <Column field="action" header="Ação" sortable style="min-width: 250px">
        <template #body="slotProps">
          <span class="text-slate-700" :title="slotProps.data.action">
            {{ truncateText(slotProps.data.action) }}
          </span>
        </template>
      </Column>

      <Column header="Empresa/ID" style="min-width: 150px">
        <template #body="slotProps">
          <span class="font-mono text-xs text-slate-600">
            {{ slotProps.data.userIdentifier?.value || '-' }}
          </span>
        </template>
      </Column>

      <Column header="Status" style="min-width: 120px">
        <template #body="slotProps">
          <span
            class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
            :class="getStatusBadge(slotProps.data).class"
          >
            {{ getStatusBadge(slotProps.data).label }}
          </span>
        </template>
      </Column>

      <Column header="Transação" style="min-width: 150px">
        <template #body="slotProps">
          <span class="font-mono text-xs text-slate-500">
            {{ truncateText(slotProps.data.transaction, 20) }}
          </span>
        </template>
      </Column>

      <Column header="" style="width: 80px">
        <template #body="slotProps">
          <Button
            icon="pi pi-search-plus"
            text
            rounded
            severity="info"
            size="small"
            aria-label="Ver detalhes"
            @click="emit('viewDetails', slotProps.data)"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>
