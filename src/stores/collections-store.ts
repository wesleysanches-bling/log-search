import { defineStore } from 'pinia';

import type { ICollection } from '@/types/opensearch-types';

interface ICollectionsState {
  collections: ICollection[];
}

async function apiLoadAll(): Promise<ICollection[]> {
  const res = await fetch('/api/collections');
  if (!res.ok) return [];
  return res.json();
}

async function apiSave(collection: ICollection) {
  await fetch('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(collection),
  });
}

async function apiUpdate(collection: ICollection) {
  await fetch(`/api/collections/${collection.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(collection),
  });
}

async function apiDelete(id: string) {
  await fetch(`/api/collections/${id}`, { method: 'DELETE' });
}

export const useCollectionsStore = defineStore('collections', {
  state: (): ICollectionsState => ({
    collections: [],
  }),

  getters: {
    sortedCollections(): ICollection[] {
      return [...this.collections].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    },

    count(): number {
      return this.collections.length;
    },
  },

  actions: {
    async loadFromDisk() {
      this.collections = await apiLoadAll();
    },

    async createCollection(
      name: string,
      identifiers: string[],
      description?: string,
    ): Promise<ICollection> {
      const now = new Date().toISOString();
      const collection: ICollection = {
        id: crypto.randomUUID(),
        name,
        description,
        identifiers: [...new Set(identifiers)],
        createdAt: now,
        updatedAt: now,
      };
      this.collections.push(collection);
      await apiSave(collection);
      return collection;
    },

    async updateCollection(id: string, updates: Partial<Pick<ICollection, 'name' | 'description' | 'identifiers'>>) {
      const index = this.collections.findIndex((c) => c.id === id);
      if (index === -1) return;

      const existing = this.collections[index];
      this.collections[index] = {
        ...existing,
        ...updates,
        identifiers: updates.identifiers
          ? [...new Set(updates.identifiers)]
          : existing.identifiers,
        updatedAt: new Date().toISOString(),
      };
      await apiUpdate(this.collections[index]);
    },

    async deleteCollection(id: string) {
      this.collections = this.collections.filter((c) => c.id !== id);
      await apiDelete(id);
    },

    getIdentifiersString(id: string): string {
      const collection = this.collections.find((c) => c.id === id);
      return collection ? collection.identifiers.join(',') : '';
    },
  },
});
