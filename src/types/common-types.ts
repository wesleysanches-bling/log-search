export interface IErrorResponse {
  type: string;
  message?: string;
  description?: string;
}

export interface IDropdownOption {
  label: string;
  value: string;
}

export interface IPaginationMeta {
  total: number;
  page: number;
  pageSize: number;
}
