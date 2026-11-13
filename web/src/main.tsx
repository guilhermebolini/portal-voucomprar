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
import { Operacional, Divida } from '@/pages/Grandezas';
import { Previsao } from '@/pages/Analises';
import { Entidade, Importar, Historico, Usuarios, Conta } from '@/pages/Admin';

dayjs.locale('pt-br');
const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

function Protegido({ children, admin }: { children: React.ReactNode; admin?: boolean }) {
  const { user, carregado } = useAuth();
  const loc = useLocation();
  if (!carregado) return <div className="boot"><Spin /></div>;
  if (!user) return <Navigate to="/" replace state={{ de: loc.pathname }} />;
  if (admin && user.papel !== 'admin') return <Navigate to="/painel" replace />;
  return <>{children}</>;
}

// A primeira tela é sempre o login; quem já entrou vai direto para o painel.
function SoDeslogado({ children }: { children: React.ReactNode }) {
  const user = useAuth(s => s.user);
  return user ? <Navigate to="/painel" replace /> : <>{children}</>;
}

function Raiz() {
  const carregado = useAuth(s => s.carregado);
  useEffect(() => { carregaEstado().catch(() => useAuth.getState().set({ carregado: true })); }, []);
  if (!carregado) return <div className="boot"><Spin /></div>;
  return (
    <Routes>
      <Route path="/" element={<SoDeslogado><Login /></SoDeslogado>} />
      <Route path="/login" element={<SoDeslogado><Login /></SoDeslogado>} />
      <Route path="/esqueci" element={<Esqueci />} />
      <Route path="/redefinir" element={<Redefinir />} />
      <Route path="/configurar" element={<Configurar />} />
      <Route element={<Protegido><AppLayout /></Protegido>}>
        <Route path="/painel" element={<Painel />} />
        <Route path="/operacional" element={<Operacional />} />
        <Route path="/pessoas" element={<Divida key="p" chave="Pessoas" />} />
        <Route path="/fornecedores" element={<Divida key="f" chave="Fornecedores" />} />
        <Route path="/imovel" element={<Divida key="i" chave="Imóvel" />} />
        <Route path="/governo" element={<Divida key="g" chave="Governo" />} />
        <Route path="/previsao" element={<Previsao />} />
        <Route path="/importar" element={<Importar />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/usuarios" element={<Protegido admin><Usuarios /></Protegido>} />
        <Route path="/conta" element={<Conta />} />
        <Route path="/e/:ent" element={<Entidade />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
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
