import axios, { type AxiosInstance } from 'axios';

class InsightsClient {
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

const insightsClient = new InsightsClient('/api/insights');

export default insightsClient;
