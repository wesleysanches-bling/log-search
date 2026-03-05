<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import InputText from 'primevue/inputtext';
  import Password from 'primevue/password';
  import Button from 'primevue/button';
  import { useCredentialsStore } from '@/stores/credentials-store';

  const credentialsStore = useCredentialsStore();

  const username = ref(credentialsStore.username);
  const password = ref(credentialsStore.password);

  const emit = defineEmits<{
    connected: [];
  }>();

  function handleConnect() {
    if (!username.value || !password.value) return;
    credentialsStore.setCredentials(username.value, password.value);
    emit('connected');
  }

  function handleDisconnect() {
    password.value = '';
    credentialsStore.clearCredentials();
  }

  onMounted(() => {
    if (credentialsStore.username) {
      username.value = credentialsStore.username;
    }
  });
</script>

<template>
  <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div class="mb-4 flex items-center gap-2">
      <i class="pi pi-lock text-slate-600" />
      <h2 class="text-base font-semibold text-slate-700">Credenciais OpenSearch</h2>
      <span
        v-if="credentialsStore.isAuthenticated"
        class="ml-2 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"
      >
        Conectado
      </span>
    </div>

    <div class="flex flex-wrap items-end gap-4">
      <div class="flex min-w-[200px] flex-1 flex-col gap-1.5">
        <label for="username" class="text-sm font-medium text-slate-600">Usuário</label>
        <InputText
          id="username"
          v-model="username"
          placeholder="wesley.sanches"
          :disabled="credentialsStore.isAuthenticated"
          class="w-full"
        />
      </div>

      <div class="flex min-w-[200px] flex-1 flex-col gap-1.5">
        <label for="password" class="text-sm font-medium text-slate-600">Senha</label>
        <Password
          id="password"
          v-model="password"
          :feedback="false"
          :disabled="credentialsStore.isAuthenticated"
          toggle-mask
          class="w-full"
          input-class="w-full"
          @keyup.enter="handleConnect"
        />
      </div>

      <div class="flex gap-2">
        <Button
          v-if="!credentialsStore.isAuthenticated"
          label="Conectar"
          icon="pi pi-sign-in"
          :disabled="!username || !password"
          @click="handleConnect"
        />
        <Button
          v-else
          label="Desconectar"
          icon="pi pi-sign-out"
          severity="secondary"
          outlined
          @click="handleDisconnect"
        />
      </div>
    </div>
  </div>
</template>
