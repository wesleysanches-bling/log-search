import { defineStore } from 'pinia';
import { openSearchClient } from '@/configs';
import { OPENSEARCH_DEFAULT_USER } from '@/constants/common';

interface ICredentialsState {
  username: string;
  password: string;
  isAuthenticated: boolean;
}

export const useCredentialsStore = defineStore('credentials', {
  state: (): ICredentialsState => ({
    username: OPENSEARCH_DEFAULT_USER || '',
    password: '',
    isAuthenticated: false,
  }),

  getters: {
    hasCredentials(): boolean {
      return !!this.username && !!this.password;
    },
  },

  actions: {
    setCredentials(username: string, password: string) {
      this.username = username;
      this.password = password;
      this.isAuthenticated = true;
      openSearchClient.setAuthHeader(username, password);
    },

    clearCredentials() {
      this.password = '';
      this.isAuthenticated = false;
      openSearchClient.clearAuthHeader();
    },
  },

  persist: {
    pick: ['username'],
  },
});
