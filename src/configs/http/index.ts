import openSearchClient from './opensearch-client';
import insightsClient from './insights-client';

const HttpOpenSearch = openSearchClient.getInstance();
const HttpInsights = insightsClient.getInstance();

export { HttpOpenSearch, openSearchClient, HttpInsights, insightsClient };
