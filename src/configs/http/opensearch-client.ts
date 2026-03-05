import axios, { type AxiosInstance } from 'axios';
import { OPENSEARCH_BASE_URL } from '@/constants/common';

class OpenSearchClient {
  private api: AxiosInstance;

  constructor(baseURL: string) {
    this.api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public getInstance(): AxiosInstance {
    return this.api;
  }

  public setAuthHeader(username: string, password: string): void {
    const token = btoa(`${username}:${password}`);
    this.api.defaults.headers.common['Authorization'] = `Basic ${token}`;
  }

  public clearAuthHeader(): void {
    delete this.api.defaults.headers.common['Authorization'];
  }
}

const openSearchClient = new OpenSearchClient(OPENSEARCH_BASE_URL);

export default openSearchClient;
