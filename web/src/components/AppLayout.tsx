import { useState } from 'react';
import { Layout, Menu, Drawer, Button, Tag, Grid } from 'antd';
import { MenuOutlined, DashboardOutlined, ShopOutlined, LineChartOutlined, AlertOutlined, TeamOutlined, DollarOutlined, HomeOutlined, IdcardOutlined, ApartmentOutlined, RiseOutlined, AimOutlined, CheckSquareOutlined, BankOutlined, FileSearchOutlined, DatabaseOutlined, UploadOutlined, SettingOutlined, HistoryOutlined, UserOutlined, LogoutOutlined, SolutionOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { post } from '@/lib/api';
import { useAuth, PAPEL } from '@/lib/store';

const grupos = [
  { key: 'g1', label: 'Visão geral', children: [['/painel', 'Painel', <DashboardOutlined />], ['/lojas', 'Lojas', <ShopOutlined />], ['/previsao', 'Previsão de saídas', <LineChartOutlined />]] },
  { key: 'g2', label: 'Dívidas', children: [['/dividas', 'Dívidas e passivos', <AlertOutlined />], ['/e/fornecedores', 'Fornecedores', <SolutionOutlined />]] },
  { key: 'g3', label: 'Custos', children: [['/e/despesas', 'Despesas', <DollarOutlined />], ['/e/folha', 'Folha de pagamento', <TeamOutlined />], ['/e/imoveis', 'Imóveis e aluguéis', <HomeOutlined />], ['/e/colaboradores', 'Colaboradores', <IdcardOutlined />], ['/e/quadro', 'Quadro de cargos', <ApartmentOutlined />]] },
  { key: 'g4', label: 'Vendas', children: [['/e/vendas', 'Vendas', <RiseOutlined />], ['/potencial', 'Potencial de venda', <AimOutlined />]] },
  { key: 'g5', label: 'Gestão', children: [['/e/planos_acao', 'Planos de ação', <CheckSquareOutlined />], ['/e/ativos', 'Ativos', <BankOutlined />], ['/e/anotacoes', 'Informações levantadas', <FileSearchOutlined />], ['/e/unidades', 'Cadastro de lojas', <DatabaseOutlined />]] },
  { key: 'g6', label: 'Dados', children: [['/importar', 'Importar planilha', <UploadOutlined />], ['/e/parametros', 'Premissas', <SettingOutlined />], ['/historico', 'Histórico', <HistoryOutlined />]] },
] as const;

export function Marca({ claro = true }: { claro?: boolean }) {
  return <div className="marca"><img src="/logo.svg" alt="" /><span style={{ color: claro ? '#fff' : 'inherit' }}>Vou Comprar<small>Portal de avaliação</small></span></div>;
}

export default function AppLayout() {
  const user = useAuth(s => s.user);
  const set = useAuth(s => s.set);
  const nav = useNavigate();
  const loc = useLocation();
  const [aberto, setAberto] = useState(false);
  const telas = Grid.useBreakpoint();
  const mobile = !telas.lg;

  const items: any[] = grupos.map(g => ({ type: 'group', key: g.key, label: g.label, children: g.children.map(([k, l, i]) => ({ key: k, label: l, icon: i })) }));
  if (user?.papel === 'admin') items.push({ type: 'group', key: 'g7', label: 'Acesso', children: [{ key: '/usuarios', label: 'Usuários', icon: <UserOutlined /> }] });
  const sel = items.flatMap(g => g.children).map((c: any) => c.key).filter((k: string) => loc.pathname === k || loc.pathname.startsWith(k + '/')).sort((a: string, b: string) => b.length - a.length)[0]
    || (loc.pathname.startsWith('/loja/') ? '/lojas' : '');

  const sair = async () => { await post('/auth/sair'); set({ user: null }); nav('/login'); };
  const menu = (
    <div className="lateral">
      <Marca />
      <Menu theme="dark" mode="inline" selectedKeys={[sel]} items={items} onClick={i => { nav(i.key); setAberto(false); }} />
      <div className="rodape">
        <div>{user?.nome || user?.email}</div>
        <Tag style={{ margin: '4px 0 8px' }}>{PAPEL[user?.papel || 'leitor']}</Tag>
        <div><Button size="small" type="link" style={{ color: '#fff', padding: 0 }} onClick={() => { nav('/conta'); setAberto(false); }}>Minha conta</Button> · <Button size="small" type="link" style={{ color: '#fff', padding: 0 }} icon={<LogoutOutlined />} onClick={sair}>Sair</Button></div>
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {mobile ? (
        <>
          <div className="topo-mobile"><Marca /><Button type="text" icon={<MenuOutlined style={{ color: '#fff', fontSize: 20 }} />} onClick={() => setAberto(true)} /></div>
          <Drawer open={aberto} onClose={() => setAberto(false)} placement="left" width={270} styles={{ body: { padding: 0, background: '#16181d' }, header: { display: 'none' } }}>{menu}</Drawer>
        </>
      ) : (
        <Layout.Sider width={250} style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', background: '#16181d' }}>{menu}</Layout.Sider>
      )}
      <Layout.Content className="principal"><Outlet /></Layout.Content>
    </Layout>
  );
}
