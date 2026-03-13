<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import DataTable from 'primevue/datatable';
  import Column from 'primevue/column';
  import Button from 'primevue/button';
  import InputText from 'primevue/inputtext';
  import Textarea from 'primevue/textarea';
  import Dialog from 'primevue/dialog';
  import Chips from 'primevue/chips';
  import Tag from 'primevue/tag';
  import { useToast } from 'primevue/usetoast';
  import { useRouter } from 'vue-router';

  import { useCollectionsStore } from '@/stores/collections-store';
  import { formatDateTime } from '@/utils/formatters/date-formatter';

  const toast = useToast();
  const router = useRouter();
  const collectionsStore = useCollectionsStore();

  const showDialog = ref(false);
  const editingId = ref<string | null>(null);
  const formName = ref('');
  const formDescription = ref('');
  const formIdentifiers = ref<string[]>([]);
  const bulkInput = ref('');
  const showBulkInput = ref(false);

  onMounted(() => {
    collectionsStore.loadFromDisk();
  });

  function openCreateDialog() {
    editingId.value = null;
    formName.value = '';
    formDescription.value = '';
    formIdentifiers.value = [];
    bulkInput.value = '';
    showBulkInput.value = false;
    showDialog.value = true;
  }

  function openEditDialog(id: string) {
    const col = collectionsStore.collections.find((c) => c.id === id);
    if (!col) return;
    editingId.value = id;
    formName.value = col.name;
    formDescription.value = col.description ?? '';
    formIdentifiers.value = [...col.identifiers];
    bulkInput.value = '';
    showBulkInput.value = false;
    showDialog.value = true;
  }

  function parseBulkIds() {
    const ids = bulkInput.value
      .split(/[\n,;]+/)
      .map((id) => id.trim())
      .filter(Boolean);
    const unique = [...new Set([...formIdentifiers.value, ...ids])];
    formIdentifiers.value = unique;
    bulkInput.value = '';
    showBulkInput.value = false;
  }

  async function handleSave() {
    if (!formName.value.trim() || formIdentifiers.value.length === 0) {
      toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Nome e pelo menos um ID são obrigatórios.', life: 3000 });
      return;
    }

    if (editingId.value) {
      await collectionsStore.updateCollection(editingId.value, {
        name: formName.value.trim(),
        description: formDescription.value.trim() || undefined,
        identifiers: formIdentifiers.value,
      });
      toast.add({ severity: 'success', summary: 'Atualizada', detail: 'Coleção atualizada com sucesso.', life: 3000 });
    } else {
      await collectionsStore.createCollection(
        formName.value.trim(),
        formIdentifiers.value,
        formDescription.value.trim() || undefined,
      );
      toast.add({ severity: 'success', summary: 'Criada', detail: 'Coleção criada com sucesso.', life: 3000 });
    }

    showDialog.value = false;
  }

  async function handleDelete(id: string) {
    await collectionsStore.deleteCollection(id);
    toast.add({ severity: 'info', summary: 'Removida', detail: 'Coleção removida.', life: 3000 });
  }

  function useInSearch(id: string) {
    const ids = collectionsStore.getIdentifiersString(id);
    router.push({ path: '/', query: { collectionIds: ids } });
  }
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="pi pi-objects-column text-slate-600" />
          <h2 class="text-base font-semibold text-slate-700">Coleções de IDs</h2>
          <span class="text-sm text-slate-400">
            Agrupe identificadores para usar como filtro rápido
          </span>
        </div>
        <Button
          label="Nova Coleção"
          icon="pi pi-plus"
          size="small"
          @click="openCreateDialog"
        />
      </div>

      <DataTable
        :value="collectionsStore.sortedCollections"
        striped-rows
        empty-message="Nenhuma coleção criada ainda."
        class="text-sm"
      >
        <Column field="name" header="Nome" sortable style="min-width: 200px">
          <template #body="{ data }">
            <div>
              <span class="font-medium text-slate-700">{{ data.name }}</span>
              <p v-if="data.description" class="mt-0.5 text-xs text-slate-400">
                {{ data.description }}
              </p>
            </div>
          </template>
        </Column>

        <Column header="IDs" style="min-width: 200px">
          <template #body="{ data }">
            <div class="flex flex-wrap gap-1">
              <Tag
                v-for="id in data.identifiers.slice(0, 5)"
                :key="id"
                :value="id"
                severity="secondary"
                class="text-xs"
              />
              <Tag
                v-if="data.identifiers.length > 5"
                :value="`+${data.identifiers.length - 5}`"
                severity="info"
                class="text-xs"
              />
            </div>
          </template>
        </Column>

        <Column header="Qtd" style="width: 80px">
          <template #body="{ data }">
            <span class="font-mono text-xs text-slate-500">
              {{ data.identifiers.length }}
            </span>
          </template>
        </Column>

        <Column header="Atualizado" sortable style="min-width: 150px">
          <template #body="{ data }">
            <span class="text-xs text-slate-500">
              {{ formatDateTime(data.updatedAt) }}
            </span>
          </template>
        </Column>

        <Column header="" style="width: 180px">
          <template #body="{ data }">
            <div class="flex gap-1">
              <Button
                icon="pi pi-search"
                text
                rounded
                size="small"
                severity="info"
                v-tooltip.top="'Usar na busca'"
                @click="useInSearch(data.id)"
              />
              <Button
                icon="pi pi-pencil"
                text
                rounded
                size="small"
                severity="secondary"
                v-tooltip.top="'Editar'"
                @click="openEditDialog(data.id)"
              />
              <Button
                icon="pi pi-trash"
                text
                rounded
                size="small"
                severity="danger"
                v-tooltip.top="'Excluir'"
                @click="handleDelete(data.id)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog
      v-model:visible="showDialog"
      :header="editingId ? 'Editar Coleção' : 'Nova Coleção'"
      modal
      :style="{ width: '600px' }"
    >
      <div class="space-y-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-slate-600">Nome *</label>
          <InputText
            v-model="formName"
            placeholder="Ex: Rollout Itaú - Grupo 18/02"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-slate-600">Descrição</label>
          <InputText
            v-model="formDescription"
            placeholder="Descrição opcional"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-slate-600">
              Identificadores ({{ formIdentifiers.length }})
            </label>
            <button
              class="text-xs text-primary-600 hover:underline"
              @click="showBulkInput = !showBulkInput"
            >
              {{ showBulkInput ? 'Entrada individual' : 'Colar em massa' }}
            </button>
          </div>

          <Chips
            v-if="!showBulkInput"
            v-model="formIdentifiers"
            separator=","
            placeholder="Digite o ID e pressione Enter"
            class="w-full"
            :allow-duplicate="false"
          />

          <div v-else class="space-y-2">
            <Textarea
              v-model="bulkInput"
              placeholder="Cole os IDs separados por vírgula, ponto e vírgula ou quebra de linha"
              rows="5"
              class="w-full"
            />
            <Button
              label="Adicionar IDs"
              icon="pi pi-plus"
              size="small"
              severity="secondary"
              @click="parseBulkIds"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          label="Cancelar"
          text
          severity="secondary"
          @click="showDialog = false"
        />
        <Button
          :label="editingId ? 'Salvar' : 'Criar'"
          icon="pi pi-check"
          @click="handleSave"
        />
      </template>
    </Dialog>
  </div>
</template>
