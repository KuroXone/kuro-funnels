import { create } from 'zustand'
import { authAPI } from '../services/api'

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  init: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return set({ loading: false })
    try {
      const { data } = await authAPI.me()
      set({ user: data, isAuthenticated: true, loading: false })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ loading: false })
    }
  },

  login: async (email, password) => {
    const { data } = await authAPI.login(email, password)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ user: data.user, isAuthenticated: true })
    return data
  },

  register: async (formData) => {
    const { data } = await authAPI.register(formData)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ user: data.user, isAuthenticated: true })
    return data
  },

  logout: async () => {
    try { await authAPI.logout() } catch {}
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },
}))

export default useAuthStore
