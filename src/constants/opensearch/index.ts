export { LogStatus, SearchField } from './opensearch-enums';

export const COMMON_ACTIONS = [
  'ShopeeProcessFbsInvoices::processFbsAction',
  'API - Request',
  'API - Response',
  'Webhook - Received',
  'Webhook - Processed',
  'Job - Started',
  'Job - Completed',
  'Job - Failed',
] as const;
