import axios from 'axios';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  r => r,
  err => {
    const status = err.response?.status;
    const msg = err.response?.data?.erro || err.message || 'Erro';
    if (status === 401 && !String(err.config?.url || '').startsWith('/auth')) {
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    return Promise.reject(new Error(msg));
  },
);

export const get = async <T = any>(url: string, params?: any) => (await api.get<T>(url, { params })).data;
export const post = async <T = any>(url: string, body?: any) => (await api.post<T>(url, body)).data;
export const put = async <T = any>(url: string, body?: any) => (await api.put<T>(url, body)).data;
export const del = async <T = any>(url: string) => (await api.delete<T>(url)).data;

// ---- tipos dos metadados ----
export type FieldType = 'text' | 'longtext' | 'int' | 'number' | 'money' | 'date' | 'month' | 'select' | 'ref' | 'bool';
export interface Field { name: string; label: string; type: FieldType; options?: string[]; ref?: 'unidades' | 'fornecedores'; list?: boolean; required?: boolean; sum?: boolean; help?: string }
export interface Entity { label: string; singular: string; display: string; order?: string; fields: Field[] }
export interface User { id: number; email: string; nome: string; papel: 'admin' | 'editor' | 'leitor' }
export interface Meta { entities: Record<string, Entity>; user: User }
