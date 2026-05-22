import { create } from 'zustand'
import { smtpAPI, campaignsAPI, contactsAPI, analyticsAPI, queueAPI } from '../services/api'

const useAppStore = create((set) => ({
  // SMTP
  smtps: [],
  smtpsLoading: false,
  fetchSMTPs: async (search, status) => {
    set({ smtpsLoading: true })
    try {
      const { data } = await smtpAPI.list(search, status)
      set({ smtps: Array.isArray(data) ? data : [] })
    } catch {
      set({ smtps: [] })
    } finally {
      set({ smtpsLoading: false })
    }
  },

  // Campaigns
  campaigns: [],
  campaignsLoading: false,
  fetchCampaigns: async (params) => {
    set({ campaignsLoading: true })
    try {
      const { data } = await campaignsAPI.list(params)
      set({ campaigns: Array.isArray(data) ? data : [] })
    } catch {
      set({ campaigns: [] })
    } finally {
      set({ campaignsLoading: false })
    }
  },

  // Contacts
  contactLists: [],
  contactListsLoading: false,
  fetchContactLists: async () => {
    set({ contactListsLoading: true })
    try {
      const { data } = await contactsAPI.lists()
      set({ contactLists: Array.isArray(data) ? data : [] })
    } catch {
      set({ contactLists: [] })
    } finally {
      set({ contactListsLoading: false })
    }
  },

  // Analytics
  dashboardStats: null,
  dashboardLoading: false,
  fetchDashboard: async () => {
    set({ dashboardLoading: true })
    try {
      const { data } = await analyticsAPI.dashboard()
      set({ dashboardStats: data })
    } catch {
      set({ dashboardStats: null })
    } finally {
      set({ dashboardLoading: false })
    }
  },

  // Queue
  queueStats: null,
  queueLoading: false,
  fetchQueueStats: async () => {
    set({ queueLoading: true })
    try {
      const { data } = await queueAPI.stats()
      set({ queueStats: data })
    } catch {
      set({ queueStats: null })
    } finally {
      set({ queueLoading: false })
    }
  },
}))

export default useAppStore
