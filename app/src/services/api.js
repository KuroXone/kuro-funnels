import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// SMTP
export const smtpAPI = {
  list: (search, status) => api.get('/smtp/', { params: { search: search || undefined, status: status || undefined } }),
  create: (data) => api.post('/smtp/', data),
  update: (id, data) => api.put(`/smtp/${id}`, data),
  delete: (id) => api.delete(`/smtp/${id}`),
  test: (id) => api.post(`/smtp/${id}/test`),
  toggle: (id) => api.patch(`/smtp/${id}/toggle`),
  stats: (id) => api.get(`/smtp/${id}/stats`),
  overview: () => api.get('/smtp/overview/all'),
}

// Campaigns
export const campaignsAPI = {
  list: (params) => api.get('/campaigns/', { params }),
  create: (data) => api.post('/campaigns/', data),
  get: (id) => api.get(`/campaigns/${id}`),
  update: (id, data) => api.put(`/campaigns/${id}`, data),
  delete: (id) => api.delete(`/campaigns/${id}`),
  send: (id) => api.post(`/campaigns/${id}/send`),
  pause: (id) => api.post(`/campaigns/${id}/pause`),
  testEmail: (id, data) => api.post(`/campaigns/${id}/test-email`, data),
}

// Contacts
export const contactsAPI = {
  lists: () => api.get('/contacts/lists'),
  createList: (data) => api.post('/contacts/lists', data),
  deleteList: (id) => api.delete(`/contacts/lists/${id}`),
  contacts: (listId, params) => api.get(`/contacts/lists/${listId}/contacts`, { params }),
  addContact: (listId, data) => api.post(`/contacts/lists/${listId}/contacts`, data),
  deleteContact: (listId, contactId) => api.delete(`/contacts/lists/${listId}/contacts/${contactId}`),
  importCSV: (listId, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/contacts/lists/${listId}/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  suppression: () => api.get('/contacts/suppression'),
}

// Analytics
export const analyticsAPI = {
  dashboard: () => api.get('/analytics/dashboard'),
  campaign: (id) => api.get(`/analytics/campaigns/${id}`),
  timeline: (days) => api.get('/analytics/timeline', { params: { days } }),
}

// Queue
export const queueAPI = {
  stats: () => api.get('/queue/stats'),
  items: (params) => api.get('/queue/items', { params }),
  retryFailed: (campaignId) => api.post('/queue/retry-failed', null, { params: { campaign_id: campaignId } }),
}

// Templates
export const templatesAPI = {
  list: (params) => api.get('/templates/', { params }),
  create: (data) => api.post('/templates/', data),
  get: (id) => api.get(`/templates/${id}`),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  seedDefaults: () => api.post('/templates/seed-defaults'),
}

// Domains
export const domainsAPI = {
  list: () => api.get('/domains/'),
  create: (data) => api.post('/domains/', data),
  get: (id) => api.get(`/domains/${id}`),
  update: (id, data) => api.patch(`/domains/${id}`, data),
  delete: (id) => api.delete(`/domains/${id}`),
  verify: (id) => api.post(`/domains/${id}/verify`),
  provision: (id) => api.post(`/domains/${id}/provision`),
  getDnsRecords: (id) => api.get(`/domains/${id}/dns-records`),
  getRecordStatuses: (id) => api.get(`/domains/${id}/records`),
  regenerateDkim: (id) => api.post(`/domains/${id}/regenerate-dkim`),
  setDefault: (id) => api.post(`/domains/${id}/set-default`),
  enableWarmup: (id) => api.post(`/warmup/${id}/enable`),
  disableWarmup: (id) => api.post(`/warmup/${id}/disable`),
  getSmtpLinks: (id) => api.get(`/domains/${id}/smtp-links`),
  addSmtpLink: (id, smtpId, isPrimary) => api.post(`/domains/${id}/smtp-links`, null, { params: { smtp_id: smtpId, is_primary: isPrimary } }),
  removeSmtpLink: (id, smtpId) => api.delete(`/domains/${id}/smtp-links/${smtpId}`),
}

// Warmup
export const warmupAPI = {
  list: () => api.get('/warmup/'),
  schedule: () => api.get('/warmup/schedule'),
  enable: (id) => api.post(`/warmup/${id}/enable`),
  disable: (id) => api.post(`/warmup/${id}/disable`),
  advance: (id) => api.post(`/warmup/${id}/advance`),
  progress: (id) => api.get(`/warmup/${id}/progress`),
}

// SMTP Health
export const smtpHealthAPI = {
  all: () => api.get('/smtp-health/'),
  get: (id) => api.get(`/smtp-health/${id}`),
  recalculate: (id) => api.post(`/smtp-health/${id}/recalculate`),
  summary: () => api.get('/smtp-health/overview/summary'),
}

// Users (admin)
export const usersAPI = {
  list: () => api.get('/users/'),
  toggleUser: (id) => api.patch(`/users/${id}/toggle`),
  updateProfile: (data) => api.put('/users/me', data),
  changePassword: (current, next) => api.put('/users/me/password', null, { params: { current_password: current, new_password: next } }),
}

export default api
