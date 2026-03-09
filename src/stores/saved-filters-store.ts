import { defineStore } from 'pinia';

import type {
  ISearchFilters,
  ISavedFilter,
  ISavedFilterTag,
  IOpenSearchResponse,
} from '@/types/opensearch-types';
import type { IInsightResult } from '@/types/insights-types';

interface ISavedFiltersState {
  filters: ISavedFilter[];
}

async function apiSave(filter: ISavedFilter) {
  await fetch('/api/storage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filter),
  });
}

async function apiUpdate(filter: ISavedFilter) {
  await fetch(`/api/storage/${filter.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filter),
  });
}

async function apiDelete(id: string) {
  await fetch(`/api/storage/${id}`, { method: 'DELETE' });
}

async function apiLoadAll(): Promise<ISavedFilter[]> {
  const res = await fetch('/api/storage');
  if (!res.ok) return [];
  return res.json();
}

export const useSavedFiltersStore = defineStore('saved-filters', {
  state: (): ISavedFiltersState => ({
    filters: [],
  }),

  getters: {
    sortedFilters(): ISavedFilter[] {
      return [...this.filters].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    },

    count(): number {
      return this.filters.length;
    },
  },

  actions: {
    async loadFromDisk() {
      this.filters = await apiLoadAll();
    },

    async saveFilter(
      name: string,
      filters: ISearchFilters,
      results?: IOpenSearchResponse,
      insights?: IInsightResult,
      tags?: ISavedFilterTag[],
    ): Promise<ISavedFilter> {
      const now = new Date().toISOString();
      const saved: ISavedFilter = {
        id: crypto.randomUUID(),
        name,
        filters: { ...filters },
        results,
        insights,
        tags,
        totalHits: results?.hits?.total?.value,
        searchDuration: results?.took,
        createdAt: now,
        updatedAt: now,
      };
      this.filters.push(saved);
      await apiSave(saved);
      return saved;
    },

    async updateFilter(id: string, name: string, filters: ISearchFilters) {
      const index = this.filters.findIndex((f) => f.id === id);
      if (index === -1) return;
      this.filters[index] = {
        ...this.filters[index],
        name,
        filters: { ...filters },
        updatedAt: new Date().toISOString(),
      };
      await apiUpdate(this.filters[index]);
    },

    async deleteFilter(id: string) {
      this.filters = this.filters.filter((f) => f.id !== id);
      await apiDelete(id);
    },

    exportFilter(id: string): string | null {
      const filter = this.filters.find((f) => f.id === id);
      if (!filter) return null;
      return JSON.stringify(filter, null, 2);
    },

    exportAll(): string {
      return JSON.stringify(this.filters, null, 2);
    },

    async importFilters(json: string): Promise<number> {
      const parsed = JSON.parse(json);
      const items: ISavedFilter[] = Array.isArray(parsed) ? parsed : [parsed];
      let imported = 0;

      for (const item of items) {
        if (!item.name || !item.filters) continue;
        const exists = this.filters.some((f) => f.id === item.id);
        if (!exists) {
          const saved: ISavedFilter = {
            ...item,
            id: item.id || crypto.randomUUID(),
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString(),
          };
          this.filters.push(saved);
          await apiSave(saved);
          imported++;
        }
      }

      return imported;
    },
  },
});
