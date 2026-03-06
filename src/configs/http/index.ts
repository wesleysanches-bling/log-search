import openSearchClient from './opensearch-client';
import insightsClient from './insights-client';
import librariesClient from './libraries-client';

const HttpOpenSearch = openSearchClient.getInstance();
const HttpInsights = insightsClient.getInstance();
const HttpLibraries = librariesClient.getInstance();

export {
  HttpOpenSearch,
  openSearchClient,
  HttpInsights,
  insightsClient,
  HttpLibraries,
  librariesClient,
};
