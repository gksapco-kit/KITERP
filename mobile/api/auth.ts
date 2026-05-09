import apiClient from './client'
import type { Token, User, Customer } from '../types'

export const authApi = {
  // Vendor/Admin auth
  vendorLogin: async (email: string, password: string): Promise<Token> => {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)
    const res = await apiClient.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
  vendorMe: async (): Promise<User> => {
    const res = await apiClient.get('/auth/me')
    return res.data
  },

  // Customer auth
  customerRegister: async (data: { full_name: string; email: string; password: string }): Promise<Customer> => {
    const res = await apiClient.post('/store/auth/register', data)
    return res.data
  },
  customerLogin: async (email: string, password: string): Promise<Token> => {
    const res = await apiClient.post('/store/auth/login', { email, password })
    return res.data
  },
  customerMe: async (): Promise<Customer> => {
    const res = await apiClient.get('/store/auth/me')
    return res.data
  },
}
