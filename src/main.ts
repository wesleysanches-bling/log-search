import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { VueQueryPlugin } from '@tanstack/vue-query';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';

import App from './App.vue';
import router from './router';

import 'primeicons/primeicons.css';
import './style.css';

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App);

app.use(pinia);
app.use(VueQueryPlugin);
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark-mode',
    },
  },
});
app.use(ToastService);
app.use(ConfirmationService);

app.mount('#app');
