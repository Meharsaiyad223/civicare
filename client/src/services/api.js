import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30_000,
});

export function setAuthToken(token) {
  if (token) apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete apiClient.defaults.headers.common.Authorization;
}

export function getApiError(error) {
  const apiError = error?.response?.data?.error;
  if (apiError?.details) {
    const details = Array.isArray(apiError.details)
      ? apiError.details.map((detail) => `${detail.field}: ${detail.message}`)
      : Object.entries(apiError.details).map(([field, message]) => `${field}: ${message}`);
    if (details.length) return `${apiError.message || 'Invalid fields.'} ${details.join(' · ')}`;
  }
  return apiError?.message || error?.message || 'Something went wrong. Please try again.';
}

const data = (response) => response.data.data;

export const api = {
  async checkHealth() { return data(await apiClient.get('/health')); },
  async login(credentials) { return data(await apiClient.post('/auth/login', credentials)); },
  async register(details) { return data(await apiClient.post('/auth/register', details)); },
  async me() { return data(await apiClient.get('/auth/me')); },
  async listReports(params = {}) { return data(await apiClient.get('/reports', { params })); },
  async getReport(id) { return data(await apiClient.get(`/reports/${id}`)); },
  async createReport(formData) { return data(await apiClient.post('/reports', formData)); },
  async updateReportStatus(id, status) { return data(await apiClient.patch(`/reports/${id}/status`, { status })); },
  async hotspots() { return data(await apiClient.get('/map/hotspots')); },
  async officerQueue(params = {}) { return data(await apiClient.get('/officer/queue', { params })); },
  async listContractors() { return data(await apiClient.get('/work-orders/contractors')); },
  async listWorkOrders() { return data(await apiClient.get('/work-orders')); },
  async assignWorkOrder(payload) { return data(await apiClient.post('/work-orders', payload)); },
  async completeWorkOrder(id, notes) { return data(await apiClient.patch(`/work-orders/${id}/complete`, { notes })); },
  async verifyWorkOrder(id) { return data(await apiClient.patch(`/work-orders/${id}/verify`)); },
  async createRepair(payload) { return data(await apiClient.post('/repairs', payload)); },
  async contractorQuality() { return data(await apiClient.get('/officer/contractors')); },
  async verifyHeldRepairs() { return data(await apiClient.post('/officer/repairs/verify-held')); },
  async getMemory(cellId) { return data(await apiClient.get(`/memory/${encodeURIComponent(cellId)}`)); },
  async latestWeekly() { return data(await apiClient.get('/weekly/latest')); },
  async generateWeekly() { return data(await apiClient.post('/weekly/generate')); },
};

export function assetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const origin = import.meta.env.VITE_SERVER_ORIGIN || 'http://localhost:5000';
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
