<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useRoute } from 'vue-router';
  import Toast from 'primevue/toast';
  import Badge from 'primevue/badge';
  import ConfirmDialog from 'primevue/confirmdialog';
  import { useConfirm } from 'primevue/useconfirm';

  import { useSavedFiltersStore } from '@/stores/saved-filters-store';

  const route = useRoute();
  const savedFiltersStore = useSavedFiltersStore();
  const confirm = useConfirm();

  const isStandaloneServer = ref(false);

  onMounted(async () => {
    try {
      const res = await fetch('/api/server/status');
      if (res.ok) {
        const data = await res.json();
        isStandaloneServer.value = data.mode === 'standalone';
      }
    } catch {
      /* dev mode — endpoint não existe */
    }
  });

  function handleShutdown() {
    confirm.require({
      message: 'Deseja encerrar o servidor? A aplicação ficará indisponível.',
      header: 'Desligar servidor',
      icon: 'pi pi-power-off',
      acceptLabel: 'Desligar',
      rejectLabel: 'Cancelar',
      acceptClass: 'p-button-danger',
      accept: async () => {
        try {
          await fetch('/api/server/shutdown', { method: 'POST' });
        } catch {
          /* conexão fecha quando o server desliga */
        }
      },
    });
  }
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white shadow-sm">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <RouterLink to="/" class="flex items-center gap-2 transition-opacity hover:opacity-80">
            <i class="pi pi-search text-2xl text-primary-600" />
            <h1 class="text-xl font-bold text-slate-800">OpenSearch Tool</h1>
          </RouterLink>
          <span class="hidden text-sm text-slate-400 sm:inline">Busca de logs inteligente</span>
        </div>

        <nav class="flex items-center gap-1">
          <RouterLink
            to="/"
            class="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            :class="
              route.name === 'home'
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            "
          >
            <i class="pi pi-search text-xs" />
            Buscar
          </RouterLink>

          <RouterLink
            to="/dashboard"
            class="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            :class="
              route.name === 'dashboard'
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            "
          >
            <i class="pi pi-chart-bar text-xs" />
            Dashboard
          </RouterLink>

          <RouterLink
            to="/filtros-salvos"
            class="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            :class="
              route.name === 'saved-filters'
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            "
          >
            <i class="pi pi-bookmark text-xs" />
            Filtros Salvos
            <Badge
              v-if="savedFiltersStore.count > 0"
              :value="savedFiltersStore.count"
              severity="secondary"
            />
          </RouterLink>

          <RouterLink
            to="/colecoes"
            class="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            :class="
              route.name === 'collections'
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            "
          >
            <i class="pi pi-objects-column text-xs" />
            Coleções
          </RouterLink>

          <RouterLink
            to="/biblioteca"
            class="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            :class="
              route.name === 'libraries'
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            "
          >
            <i class="pi pi-book text-xs" />
            Biblioteca
          </RouterLink>

          <button
            v-if="isStandaloneServer"
            class="ml-2 flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
            title="Desligar servidor"
            @click="handleShutdown"
          >
            <i class="pi pi-power-off text-xs" />
            Desligar
          </button>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-6 py-6">
      <slot />
    </main>

    <Toast position="top-right" />
    <ConfirmDialog />
  </div>
</template>
