<script setup lang="ts">
  import { computed } from 'vue';
  import Dialog from 'primevue/dialog';
  import Tag from 'primevue/tag';
  import Button from 'primevue/button';

  import { formatDateTime } from '@/utils/formatters/date-formatter';

  import type { ILogEntryParsed } from '@/types/opensearch-types';

  const props = defineProps<{
    log: ILogEntryParsed | null;
    visible: boolean;
  }>();

  const emit = defineEmits<{
    'update:visible': [value: boolean];
  }>();

  const formattedData = computed(() => {
    if (!props.log?.dataParsed) return null;
    return JSON.stringify(props.log.dataParsed, null, 2);
  });

  const rawData = computed(() => {
    if (!props.log?.data) return null;
    return typeof props.log.data === 'string' ? props.log.data : JSON.stringify(props.log.data);
  });

  const allFields = computed(() => {
    if (!props.log) return [];
    const excludeKeys = ['date', 'action', 'transaction', 'status', 'data', 'userIdentifier', '_id', 'dataParsed'];
    return Object.entries(props.log)
      .filter(([key]) => !excludeKeys.includes(key))
      .map(([key, value]) => ({
        key,
        value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '-'),
      }));
  });

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Detalhes do Log"
    :style="{ width: '75vw', maxWidth: '1000px' }"
    :dismissable-mask="true"
    @update:visible="emit('update:visible', $event)"
  >
    <template v-if="log">
      <div class="space-y-5">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="rounded-md border border-slate-100 bg-slate-50 p-3">
            <span class="text-xs font-medium uppercase text-slate-400">Data/Hora</span>
            <p class="mt-1 font-mono text-sm text-slate-700">
              {{ formatDateTime(log.date) }}
            </p>
          </div>

          <div class="rounded-md border border-slate-100 bg-slate-50 p-3">
            <span class="text-xs font-medium uppercase text-slate-400">Status</span>
            <div class="mt-1">
              <Tag :value="log.status || '-'" />
            </div>
          </div>

          <div class="rounded-md border border-slate-100 bg-slate-50 p-3 md:col-span-2">
            <span class="text-xs font-medium uppercase text-slate-400">Ação</span>
            <p class="mt-1 text-sm text-slate-700">{{ log.action || '-' }}</p>
          </div>

          <div class="rounded-md border border-slate-100 bg-slate-50 p-3">
            <span class="text-xs font-medium uppercase text-slate-400">Empresa/ID</span>
            <p class="mt-1 font-mono text-sm text-slate-700">
              {{ log.userIdentifier?.value || '-' }}
            </p>
          </div>

          <div class="rounded-md border border-slate-100 bg-slate-50 p-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium uppercase text-slate-400">Transação</span>
              <Button
                v-if="log.transaction"
                icon="pi pi-copy"
                text
                rounded
                size="small"
                severity="secondary"
                @click="copyToClipboard(log.transaction)"
              />
            </div>
            <p class="mt-1 break-all font-mono text-xs text-slate-700">
              {{ log.transaction || '-' }}
            </p>
          </div>
        </div>

        <div v-if="allFields.length > 0">
          <h3 class="mb-2 text-sm font-semibold text-slate-600">Campos Adicionais</h3>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div
              v-for="field in allFields"
              :key="field.key"
              class="rounded-md border border-slate-100 bg-slate-50 p-3"
            >
              <span class="text-xs font-medium uppercase text-slate-400">{{ field.key }}</span>
              <p class="mt-1 break-all text-xs text-slate-700">{{ field.value }}</p>
            </div>
          </div>
        </div>

        <div v-if="formattedData">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-600">
              Dados (JSON Parseado)
            </h3>
            <Button
              icon="pi pi-copy"
              label="Copiar"
              text
              size="small"
              severity="secondary"
              @click="copyToClipboard(formattedData)"
            />
          </div>
          <pre
            class="max-h-[400px] overflow-auto rounded-md border border-slate-200 bg-slate-900 p-4 text-xs leading-relaxed text-green-400"
          >{{ formattedData }}</pre>
        </div>

        <div v-else-if="rawData">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-600">Dados (Raw)</h3>
            <Button
              icon="pi pi-copy"
              label="Copiar"
              text
              size="small"
              severity="secondary"
              @click="copyToClipboard(rawData)"
            />
          </div>
          <pre
            class="max-h-[400px] overflow-auto rounded-md border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700"
          >{{ rawData }}</pre>
        </div>
      </div>
    </template>
  </Dialog>
</template>
