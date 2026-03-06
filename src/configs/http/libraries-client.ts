import axios, { type AxiosInstance } from 'axios';

class LibrariesClient {
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
}

const librariesClient = new LibrariesClient('/api/libraries');

export default librariesClient;
