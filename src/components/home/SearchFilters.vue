<script setup lang="ts">
  import { ref } from 'vue';
  import DatePicker from 'primevue/datepicker';
  import InputText from 'primevue/inputtext';
  import Select from 'primevue/select';
  import Button from 'primevue/button';

  import { COMMON_ACTIONS } from '@/constants/opensearch';
  import { getStartOfDay, getEndOfDay } from '@/utils/formatters/date-formatter';

  import type { ISearchFilters } from '@/types/opensearch-types';
  import type { IDropdownOption } from '@/types/common-types';

  defineProps<{
    isSearching: boolean;
    isConnected: boolean;
  }>();

  const emit = defineEmits<{
    search: [filters: ISearchFilters];
  }>();

  const dateRange = ref<Date[]>([]);
  const userIdentifier = ref('');
  const selectedAction = ref<string | null>(null);
  const customAction = ref('');
  const transaction = ref('');
  const freeText = ref('');
  const useCustomAction = ref(false);

  const actionOptions: IDropdownOption[] = COMMON_ACTIONS.map((action) => ({
    label: action,
    value: action,
  }));

  function handleSearch() {
    if (dateRange.value.length < 2) return;

    const filters: ISearchFilters = {
      startDate: getStartOfDay(dateRange.value[0]),
      endDate: getEndOfDay(dateRange.value[1]),
    };

    if (userIdentifier.value.trim()) {
      filters.userIdentifier = userIdentifier.value.trim();
    }

    const actionValue = useCustomAction.value ? customAction.value.trim() : selectedAction.value;
    if (actionValue) {
      filters.action = actionValue;
    }

    if (transaction.value.trim()) {
      filters.transaction = transaction.value.trim();
    }

    if (freeText.value.trim()) {
      filters.freeText = freeText.value.trim();
    }

    emit('search', filters);
  }

  function handleClear() {
    dateRange.value = [];
    userIdentifier.value = '';
    selectedAction.value = null;
    customAction.value = '';
    transaction.value = '';
    freeText.value = '';
  }
</script>

<template>
  <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div class="mb-4 flex items-center gap-2">
      <i class="pi pi-filter text-slate-600" />
      <h2 class="text-base font-semibold text-slate-700">Filtros de Busca</h2>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div class="flex flex-col gap-1.5 lg:col-span-2">
        <label class="text-sm font-medium text-slate-600">
          Período
          <span class="text-red-500">*</span>
        </label>
        <DatePicker
          v-model="dateRange"
          selection-mode="range"
          date-format="dd/mm/yy"
          placeholder="Selecione o período"
          show-icon
          show-button-bar
          :manual-input="false"
          class="w-full"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-slate-600">ID da Empresa / Cliente</label>
        <InputText
          v-model="userIdentifier"
          placeholder="Ex: 14879277031"
          class="w-full"
          @keyup.enter="handleSearch"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-slate-600">Ação (Action)</label>
          <button
            class="text-xs text-primary-600 hover:underline"
            @click="useCustomAction = !useCustomAction"
          >
            {{ useCustomAction ? 'Usar lista' : 'Digitar manualmente' }}
          </button>
        </div>
        <Select
          v-if="!useCustomAction"
          v-model="selectedAction"
          :options="actionOptions"
          option-label="label"
          option-value="value"
          placeholder="Selecione uma ação"
          show-clear
          class="w-full"
        />
        <InputText
          v-else
          v-model="customAction"
          placeholder="Digite a ação"
          class="w-full"
          @keyup.enter="handleSearch"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-slate-600">ID da Transação</label>
        <InputText
          v-model="transaction"
          placeholder="Cole o transaction ID"
          class="w-full"
          @keyup.enter="handleSearch"
        />
      </div>

      <div class="flex flex-col gap-1.5 lg:col-span-2">
        <label class="text-sm font-medium text-slate-600">Busca Livre</label>
        <InputText
          v-model="freeText"
          placeholder="URL, texto, destino... Ex: account.pagcerto.com.br"
          class="w-full"
          @keyup.enter="handleSearch"
        />
        <span class="text-xs text-slate-400">
          Busca em: data, integration.out.url, statusMessage, host
        </span>
      </div>
    </div>

    <div class="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
      <Button
        label="Buscar Logs"
        icon="pi pi-search"
        :loading="isSearching"
        :disabled="dateRange.length < 2 || !isConnected"
        size="large"
        @click="handleSearch"
      />
      <Button
        label="Limpar"
        icon="pi pi-times"
        severity="secondary"
        outlined
        @click="handleClear"
      />
      <span v-if="!isConnected" class="text-sm text-amber-600">
        <i class="pi pi-info-circle mr-1" />
        Conecte-se primeiro para buscar
      </span>
    </div>
  </div>
</template>
