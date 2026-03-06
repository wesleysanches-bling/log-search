import { HttpLibraries } from '@/configs';

import type { ILibraryDocument, ILibraryStats, ILibrarySearchResult } from '@/types/libraries-types';
import type { IErrorResponse } from '@/types/common-types';

interface IListResponse {
  documents: ILibraryDocument[];
  stats: ILibraryStats;
}

function handleError(error: unknown, fallbackMessage: string): never {
  const axiosError = error as { response?: { data?: { error?: string } } };
  if (axiosError?.response?.data?.error) {
    throw { type: 'error', message: axiosError.response.data.error } as IErrorResponse;
  }
  throw { type: 'error', message: fallbackMessage } as IErrorResponse;
}

export const LibrariesService = {
  list: async (): Promise<IListResponse> => {
    return HttpLibraries.get('/')
      .then((res) => res.data)
      .catch((err) => handleError(err, 'Falha ao listar documentos'));
  },

  upload: async (file: File): Promise<{ ok: boolean; document: ILibraryDocument }> => {
    const formData = new FormData();
    formData.append('file', file);

    return HttpLibraries.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
      .then((res) => res.data)
      .catch((err) => handleError(err, 'Falha ao fazer upload do documento'));
  },

  delete: async (id: string): Promise<void> => {
    return HttpLibraries.delete(`/${id}`)
      .then((res) => res.data)
      .catch((err) => handleError(err, 'Falha ao deletar documento'));
  },

  preview: async (id: string): Promise<{ text: string; totalLength: number }> => {
    return HttpLibraries.get(`/${id}/preview`)
      .then((res) => res.data)
      .catch((err) => handleError(err, 'Falha ao carregar preview'));
  },

  reindex: async (): Promise<{ ok: boolean; totalChunks: number }> => {
    return HttpLibraries.post('/reindex')
      .then((res) => res.data)
      .catch((err) => handleError(err, 'Falha ao reindexar documentos'));
  },

  search: async (query: string, topK = 5): Promise<ILibrarySearchResult[]> => {
    return HttpLibraries.post('/search', { query, topK })
      .then((res) => res.data.results)
      .catch((err) => handleError(err, 'Falha na busca vetorial'));
  },
};
