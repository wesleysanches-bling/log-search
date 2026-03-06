<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue';
  import { useToast } from 'primevue/usetoast';
  import Button from 'primevue/button';
  import Dialog from 'primevue/dialog';

  import { LibrariesService } from '@/services/libraries';

  import type { ILibraryDocument, ILibraryStats } from '@/types/libraries-types';

  const toast = useToast();

  const documents = ref<ILibraryDocument[]>([]);
  const stats = ref<ILibraryStats | null>(null);
  const isLoading = ref(false);
  const isUploading = ref(false);
  const isReindexing = ref(false);
  const isDragging = ref(false);

  const showPreviewDialog = ref(false);
  const previewDoc = ref<ILibraryDocument | null>(null);
  const previewText = ref('');
  const previewTotalLength = ref(0);
  const isLoadingPreview = ref(false);

  const showDeleteDialog = ref(false);
  const deleteTarget = ref<ILibraryDocument | null>(null);

  const acceptedFormats = '.txt,.json,.md,.pdf,.docx';

  const formatIcons: Record<string, string> = {
    '.txt': 'pi pi-file',
    '.json': 'pi pi-code',
    '.md': 'pi pi-file-edit',
    '.pdf': 'pi pi-file-pdf',
    '.docx': 'pi pi-file-word',
  };

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
  }

  async function loadDocuments() {
    isLoading.value = true;
    try {
      const data = await LibrariesService.list();
      documents.value = data.documents;
      stats.value = data.stats;
    } catch (e) {
      toast.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Falha ao carregar documentos.',
        life: 3000,
      });
    } finally {
      isLoading.value = false;
    }
  }

  async function handleUpload(files: FileList | File[]) {
    isUploading.value = true;
    let successCount = 0;

    for (const file of Array.from(files)) {
      try {
        await LibrariesService.upload(file);
        successCount++;
      } catch (e) {
        const msg = (e as { message?: string })?.message ?? 'Erro desconhecido';
        toast.add({
          severity: 'error',
          summary: `Erro: ${file.name}`,
          detail: msg,
          life: 4000,
        });
      }
    }

    if (successCount > 0) {
      toast.add({
        severity: 'success',
        summary: 'Upload concluído',
        detail: `${successCount} documento(s) indexado(s) com sucesso.`,
        life: 3000,
      });
      await loadDocuments();
    }

    isUploading.value = false;
  }

  function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      handleUpload(input.files);
      input.value = '';
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging.value = false;
    if (event.dataTransfer?.files?.length) {
      handleUpload(event.dataTransfer.files);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging.value = true;
  }

  function handleDragLeave() {
    isDragging.value = false;
  }

  async function handlePreview(doc: ILibraryDocument) {
    previewDoc.value = doc;
    previewText.value = '';
    showPreviewDialog.value = true;
    isLoadingPreview.value = true;

    try {
      const data = await LibrariesService.preview(doc.id);
      previewText.value = data.text;
      previewTotalLength.value = data.totalLength;
    } catch {
      previewText.value = 'Erro ao carregar preview.';
    } finally {
      isLoadingPreview.value = false;
    }
  }

  function handleConfirmDelete(doc: ILibraryDocument) {
    deleteTarget.value = doc;
    showDeleteDialog.value = true;
  }

  async function handleDelete() {
    if (!deleteTarget.value) return;
    try {
      await LibrariesService.delete(deleteTarget.value.id);
      toast.add({
        severity: 'info',
        summary: 'Removido',
        detail: `"${deleteTarget.value.name}" removido da biblioteca.`,
        life: 2000,
      });
      await loadDocuments();
    } catch {
      toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao remover.', life: 3000 });
    } finally {
      showDeleteDialog.value = false;
      deleteTarget.value = null;
    }
  }

  async function handleReindex() {
    isReindexing.value = true;
    try {
      const result = await LibrariesService.reindex();
      toast.add({
        severity: 'success',
        summary: 'Reindexado',
        detail: `${result.totalChunks} chunks gerados.`,
        life: 3000,
      });
      await loadDocuments();
    } catch {
      toast.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Falha ao reindexar.',
        life: 3000,
      });
    } finally {
      isReindexing.value = false;
    }
  }

  onMounted(loadDocuments);
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Biblioteca de Documentos</h1>
        <p class="text-sm text-slate-400 mt-0.5">
          Documentação de APIs e referências para enriquecer a análise da IA
        </p>
      </div>
      <Button
        v-if="documents.length > 0"
        label="Reindexar tudo"
        icon="pi pi-sync"
        size="small"
        severity="secondary"
        outlined
        :loading="isReindexing"
        @click="handleReindex"
      />
    </div>

    <!-- Stats -->
    <div v-if="stats && stats.totalDocuments > 0" class="grid grid-cols-3 gap-4">
      <div class="rounded-lg border border-slate-200 bg-white p-4 text-center">
        <p class="text-2xl font-bold text-violet-600">{{ stats.totalDocuments }}</p>
        <p class="text-xs text-slate-400">Documentos</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4 text-center">
        <p class="text-2xl font-bold text-blue-600">{{ stats.totalChunks }}</p>
        <p class="text-xs text-slate-400">Chunks vetorizados</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4 text-center">
        <p class="text-2xl font-bold text-green-600">
          {{ Object.keys(stats.formats).length }}
        </p>
        <p class="text-xs text-slate-400">Formatos</p>
      </div>
    </div>

    <!-- Upload Area -->
    <div
      class="rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer"
      :class="isDragging
        ? 'border-violet-400 bg-violet-50'
        : 'border-slate-300 bg-white hover:border-violet-300 hover:bg-slate-50'"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @click="($refs.fileInput as HTMLInputElement)?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="acceptedFormats"
        multiple
        class="hidden"
        @change="handleFileInput"
      />

      <div v-if="isUploading" class="flex flex-col items-center gap-3">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        <p class="text-sm text-violet-600">Fazendo upload e indexando...</p>
      </div>

      <div v-else class="flex flex-col items-center gap-2">
        <i class="pi pi-cloud-upload text-3xl text-slate-300" />
        <p class="text-sm text-slate-600">
          <span class="font-medium text-violet-600">Clique para selecionar</span>
          ou arraste arquivos aqui
        </p>
        <p class="text-xs text-slate-400">
          Formatos aceitos: TXT, JSON, MD, PDF, DOCX
        </p>
      </div>
    </div>

    <!-- Documents List -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
    </div>

    <div v-else-if="documents.length === 0" class="rounded-lg border border-slate-200 bg-white p-12 text-center">
      <i class="pi pi-folder-open text-4xl text-slate-200 mb-3" />
      <p class="text-sm text-slate-400">
        Nenhum documento na biblioteca. Faça upload de documentações de API para melhorar os insights da IA.
      </p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-5 py-3.5 transition-colors hover:bg-slate-50"
      >
        <i :class="formatIcons[doc.format] ?? 'pi pi-file'" class="text-xl text-slate-400" />

        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-slate-700 truncate">{{ doc.originalName }}</p>
          <div class="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
            <span>{{ formatBytes(doc.sizeBytes) }}</span>
            <span class="text-slate-200">|</span>
            <span>{{ doc.chunksCount }} chunks</span>
            <span class="text-slate-200">|</span>
            <span>{{ formatDate(doc.uploadedAt) }}</span>
          </div>
        </div>

        <span
          class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
          :class="doc.indexed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
        >
          {{ doc.indexed ? 'Indexado' : 'Pendente' }}
        </span>

        <div class="flex items-center gap-1">
          <Button
            icon="pi pi-eye"
            text
            rounded
            severity="info"
            size="small"
            title="Preview"
            @click="handlePreview(doc)"
          />
          <Button
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            size="small"
            title="Remover"
            @click="handleConfirmDelete(doc)"
          />
        </div>
      </div>
    </div>

    <!-- Preview Dialog -->
    <Dialog
      v-model:visible="showPreviewDialog"
      :header="previewDoc?.originalName ?? 'Preview'"
      modal
      :style="{ width: '700px' }"
    >
      <div v-if="isLoadingPreview" class="flex items-center justify-center py-8">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
      <div v-else>
        <pre class="max-h-96 overflow-auto rounded-lg bg-slate-50 p-4 text-xs text-slate-600 whitespace-pre-wrap">{{ previewText }}</pre>
        <p v-if="previewTotalLength > 5000" class="mt-2 text-xs text-slate-400">
          Mostrando primeiros 5.000 caracteres de {{ previewTotalLength.toLocaleString('pt-BR') }} total.
        </p>
      </div>
    </Dialog>

    <!-- Delete Dialog -->
    <Dialog
      v-model:visible="showDeleteDialog"
      header="Confirmar exclusão"
      modal
      :style="{ width: '400px' }"
    >
      <p class="text-sm text-slate-600">
        Remover <strong>{{ deleteTarget?.originalName }}</strong> da biblioteca?
        Os vetores associados também serão removidos.
      </p>
      <template #footer>
        <Button label="Cancelar" text severity="secondary" @click="showDeleteDialog = false" />
        <Button label="Remover" severity="danger" icon="pi pi-trash" @click="handleDelete" />
      </template>
    </Dialog>
  </div>
</template>
