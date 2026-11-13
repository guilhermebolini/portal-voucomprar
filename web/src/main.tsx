import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntApp, Spin } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import './index.css';
import { carregaEstado, useAuth } from '@/lib/store';
import AppLayout from '@/components/AppLayout';
import { Login, Esqueci, Redefinir, Configurar } from '@/pages/Auth';
import Painel from '@/pages/Painel';
import { Lojas, Loja } from '@/pages/Lojas';
import { Dividas, Potencial, Previsao } from '@/pages/Analises';
import { Entidade, Importar, Historico, Usuarios, Conta } from '@/pages/Admin';

dayjs.locale('pt-br');
const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

function Protegido({ children, admin }: { children: React.ReactNode; admin?: boolean }) {
  const { user, carregado } = useAuth();
  const loc = useLocation();
  if (!carregado) return <div className="boot"><Spin /></div>;
  if (!user) return <Navigate to="/login" replace state={{ de: loc.pathname }} />;
  if (admin && user.papel !== 'admin') return <Navigate to="/painel" replace />;
  return <>{children}</>;
}

function Raiz() {
  const carregado = useAuth(s => s.carregado);
  useEffect(() => { carregaEstado().catch(() => useAuth.getState().set({ carregado: true })); }, []);
  if (!carregado) return <div className="boot"><Spin /></div>;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/esqueci" element={<Esqueci />} />
      <Route path="/redefinir" element={<Redefinir />} />
      <Route path="/configurar" element={<Configurar />} />
      <Route element={<Protegido><AppLayout /></Protegido>}>
        <Route path="/painel" element={<Painel />} />
        <Route path="/lojas" element={<Lojas />} />
        <Route path="/loja/:id" element={<Loja />} />
        <Route path="/dividas" element={<Dividas />} />
        <Route path="/potencial" element={<Potencial />} />
        <Route path="/previsao" element={<Previsao />} />
        <Route path="/importar" element={<Importar />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/usuarios" element={<Protegido admin><Usuarios /></Protegido>} />
        <Route path="/conta" element={<Conta />} />
        <Route path="/e/:ent" element={<Entidade />} />
      </Route>
      <Route path="*" element={<Navigate to="/painel" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={ptBR} theme={{
      token: { colorPrimary: '#d71920', colorLink: '#d71920', fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif', borderRadius: 8, colorBgLayout: '#f5f6f8' },
      components: { Menu: { darkItemBg: '#16181d', darkSubMenuItemBg: '#16181d', darkItemSelectedBg: '#d71920', darkGroupTitleColor: '#8a8f99' }, Layout: { siderBg: '#16181d' } },
    }}>
      <AntApp>
        <QueryClientProvider client={qc}>
          <BrowserRouter><Raiz /></BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
