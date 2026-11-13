import { create } from 'zustand';
import { useQuery } from '@tanstack/react-query';
import { get, type Meta, type User } from './api';

interface AuthState { user: User | null; carregado: boolean; precisaConfigurar: boolean; emailAtivo: boolean; set: (p: Partial<AuthState>) => void }
export const useAuth = create<AuthState>(set => ({ user: null, carregado: false, precisaConfigurar: false, emailAtivo: false, set: p => set(p) }));

export async function carregaEstado() {
  const est = await get('/auth/estado');
  useAuth.getState().set({ user: est.user, carregado: true, precisaConfigurar: est.precisa_configurar, emailAtivo: est.email_ativo });
  return est;
}

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => get<Meta>('/meta'), staleTime: Infinity });
export const useLista = (ent: string, params: Record<string, any> = {}) =>
  useQuery({ queryKey: ['e', ent, params], queryFn: () => get<any[]>(`/e/${ent}`, params) });

export const useRefs = () => {
  const u = useLista('unidades');
  const f = useLista('fornecedores');
  const nome = (ref: string | undefined, id: any) => {
    if (id == null || id === '') return '';
    const l = (ref === 'unidades' ? u.data : f.data) || [];
    const r = l.find((x: any) => x.id === id);
    return r ? (r.nome || r.codigo) : '#' + id;
  };
  return { unidades: u.data || [], fornecedores: f.data || [], nome, carregando: u.isLoading || f.isLoading };
};

export const podeEditar = (u: User | null) => !!u && u.papel !== 'leitor';
export const PAPEL: Record<string, string> = { admin: 'Administrador', editor: 'Editor', leitor: 'Leitor' };
