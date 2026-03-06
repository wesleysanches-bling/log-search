export interface ILibraryDocument {
  id: string;
  name: string;
  originalName: string;
  format: string;
  sizeBytes: number;
  chunksCount: number;
  uploadedAt: string;
  indexed: boolean;
}

export interface ILibraryStats {
  totalDocuments: number;
  totalChunks: number;
  formats: Record<string, number>;
  lastIndexedAt: string | null;
}

export interface ILibrarySearchResult {
  content: string;
  source: string;
  score: number;
}
