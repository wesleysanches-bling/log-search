<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useRoute } from 'vue-router';
  import DatePicker from 'primevue/datepicker';
  import InputText from 'primevue/inputtext';
  import Chips from 'primevue/chips';
  import Select from 'primevue/select';
  import Button from 'primevue/button';

  import { COMMON_ACTIONS } from '@/constants/opensearch';
  import { getStartOfDay, getEndOfDay } from '@/utils/formatters/date-formatter';
  import { useCollectionsStore } from '@/stores/collections-store';

  import type { ISearchFilters } from '@/types/opensearch-types';
  import type { IDropdownOption } from '@/types/common-types';

  const route = useRoute();
  const collectionsStore = useCollectionsStore();

  const props = defineProps<{
    isSearching: boolean;
    isConnected: boolean;
    compact?: boolean;
    searchLabel?: string;
  }>();

  const emit = defineEmits<{
    search: [filters: ISearchFilters];
    save: [filters: ISearchFilters];
  }>();

  const dateRange = ref<Date[]>([]);
  const userIdentifiers = ref<string[]>([]);
  const selectedAction = ref<string | null>(null);
  const customAction = ref('');
  const transaction = ref('');
  const freeText = ref('');
  const useCustomAction = ref(false);

  const selectedCollection = ref<string | null>(null);

  const actionOptions: IDropdownOption[] = COMMON_ACTIONS.map((action) => ({
    label: action,
    value: action,
  }));

  function handleCollectionSelect() {
    if (!selectedCollection.value) {
      userIdentifiers.value = [];
      return;
    }
    const ids = collectionsStore.getIdentifiersString(selectedCollection.value);
    userIdentifiers.value = ids.split(',').filter(Boolean);
  }

  onMounted(() => {
    collectionsStore.loadFromDisk();
    const collectionIds = route.query.collectionIds as string;
    if (collectionIds) {
      userIdentifiers.value = collectionIds.split(',').filter(Boolean);
    }
  });

  function buildFilters(): ISearchFilters | null {
    if (dateRange.value.length < 2) return null;

    const filters: ISearchFilters = {
      startDate: getStartOfDay(dateRange.value[0]),
      endDate: getEndOfDay(dateRange.value[1]),
    };

    const cleanIds = userIdentifiers.value
      .map((id) => id.trim())
      .filter(Boolean);
    if (cleanIds.length) {
      filters.userIdentifier = cleanIds.join(',');
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

    return filters;
  }

  function handleSearch() {
    const filters = buildFilters();
    if (!filters) return;
    emit('search', filters);
  }

  function handleSave() {
    const filters = buildFilters();
    if (!filters) return;
    emit('save', filters);
  }

  function handleClear() {
    dateRange.value = [];
    userIdentifiers.value = [];
    selectedAction.value = null;
    customAction.value = '';
    transaction.value = '';
    freeText.value = '';
  }

  function loadFilters(filters: ISearchFilters) {
    dateRange.value = [new Date(filters.startDate), new Date(filters.endDate)];
    userIdentifiers.value = filters.userIdentifier
      ? filters.userIdentifier.split(',').map((id) => id.trim()).filter(Boolean)
      : [];
    transaction.value = filters.transaction || '';
    freeText.value = filters.freeText || '';

    if (filters.action) {
      const isInList = COMMON_ACTIONS.includes(filters.action as (typeof COMMON_ACTIONS)[number]);
      if (isInList) {
        useCustomAction.value = false;
        selectedAction.value = filters.action;
      } else {
        useCustomAction.value = true;
        customAction.value = filters.action;
      }
    } else {
      selectedAction.value = null;
      customAction.value = '';
    }
  }

  defineExpose({ loadFilters });
</script>

<template>
  <div :class="compact ? '' : 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm'">
    <div v-if="!compact" class="mb-4 flex items-center gap-2">
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
        <label class="text-sm font-medium text-slate-600">
          ID da Empresa / Cliente
          <span
            v-if="userIdentifiers.length > 1"
            class="ml-1.5 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700"
          >
            {{ userIdentifiers.length }}
          </span>
        </label>
        <div v-if="collectionsStore.count > 0" class="mb-1">
          <Select
            v-model="selectedCollection"
            :options="collectionsStore.sortedCollections"
            option-label="name"
            option-value="id"
            placeholder="Carregar de uma coleção..."
            show-clear
            class="w-full"
            @change="handleCollectionSelect"
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <span>{{ option.name }}</span>
                <span class="text-xs text-slate-400">({{ option.identifiers.length }} IDs)</span>
              </div>
            </template>
          </Select>
        </div>
        <Chips
          v-model="userIdentifiers"
          separator=","
          placeholder="Digite o ID e pressione Enter"
          class="w-full"
          :allow-duplicate="false"
        />
        <span class="text-xs text-slate-400">
          Pressione Enter ou cole IDs separados por vírgula
        </span>
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
        :label="props.searchLabel ?? 'Buscar Logs'"
        :icon="compact ? 'pi pi-chart-bar' : 'pi pi-search'"
        :loading="isSearching"
        :disabled="dateRange.length < 2 || !isConnected"
        :size="compact ? undefined : 'large'"
        @click="handleSearch"
      />
      <Button
        v-if="!compact"
        label="Salvar Filtro"
        icon="pi pi-bookmark"
        severity="secondary"
        outlined
        :disabled="dateRange.length < 2"
        @click="handleSave"
      />
      <Button
        label="Limpar"
        icon="pi pi-times"
        severity="secondary"
        text
        @click="handleClear"
      />
      <span v-if="!isConnected" class="ml-auto text-sm text-amber-600">
        <i class="pi pi-info-circle mr-1" />
        Conecte-se primeiro para buscar
      </span>
    </div>
  </div>
</template>
