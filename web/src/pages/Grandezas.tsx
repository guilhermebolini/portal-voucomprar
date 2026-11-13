import { Card, Col, Row, Tabs, Spin, Alert, Table, Tag } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { brl, mesBR, corTag, semParen } from '@/lib/fmt';
import { OPERACIONAL, DIVIDAS } from '@/lib/grandezas';
import EntityTable from '@/components/EntityTable';
import { Kpi, usePainel, FiltrosCusto, Barras } from './Painel';

function useAba(padrao: string) {
  const [sp, setSp] = useSearchParams();
  return [sp.get('aba') || padrao, (k: string) => { const n = new URLSearchParams(sp); n.set('aba', k); setSp(n, { replace: true }); }] as const;
}

export function Operacional() {
  const { q, muda } = usePainel();
  const [aba, setAba] = useAba('despesas');
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message={(q.error as Error).message} />;
  const d = q.data; const f = d.filtros; const op = d.operacional;
  return (
    <div>
      <div className="cabeca"><div><h1>{OPERACIONAL.titulo}</h1><p>{OPERACIONAL.descricao}</p></div><FiltrosCusto f={f} muda={muda} /></div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Kpi rot="Custo operacional / mês" val={brl(op.total)} det={`${f.versao} + folha ${mesBR(f.competencia)}`} /></Col>
        <Col xs={24} md={8}><Kpi rot="Despesas / mês" val={brl(op.despesas)} det={`${op.por_grupo.reduce((s: number, g: any) => s + g.itens, 0)} linhas de despesa`} /></Col>
        <Col xs={24} md={8}><Kpi rot="Folha / mês" val={brl(op.folha)} det={`Competência ${mesBR(f.competencia)}`} /></Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}><Card title="Por grupo" style={{ height: '100%' }}>
          <Barras cor={OPERACIONAL.cor} itens={[{ rot: 'Folha de pagamento', valor: op.folha }, ...op.por_grupo.map((g: any) => ({ rot: g.grupo, valor: g.valor }))].sort((a, b) => b.valor - a.valor)} />
        </Card></Col>
        <Col xs={24} lg={12}><Card title="Por loja / setor" style={{ height: '100%' }}>
          <Table rowKey={r => String(r.id)} size="small" pagination={false} dataSource={op.por_loja} scroll={{ x: 'max-content' }}
            columns={[
              { title: 'Loja / setor', dataIndex: 'nome', render: (v: string, r: any) => <>{semParen(v)} {r.situacao && r.situacao !== 'Em operação' ? <Tag color={corTag(r.situacao)}>{r.situacao}</Tag> : null}</> },
              { title: 'Despesas', dataIndex: 'despesas', align: 'right', render: brl },
              { title: 'Folha', dataIndex: 'folha', align: 'right', render: brl },
              { title: 'Total/mês', dataIndex: 'total', align: 'right', render: (v: number) => <b>{brl(v)}</b> },
            ]} />
        </Card></Col>
      </Row>
      <Tabs style={{ marginTop: 16 }} activeKey={aba} onChange={setAba} items={[
        { key: 'despesas', label: 'Despesas', children: <EntityTable key={f.versao} ent="despesas" filtroFixo={{ versao: f.versao }} titulo={`Linhas de despesa · ${f.versao}`} compacto descricao="Cada linha é um custo mensal. Troque a versão no alto da página para ver o financeiro, o BPO ou os seus números." /> },
        { key: 'folha', label: 'Folha de pagamento', children: <EntityTable key={f.competencia} ent="folha" filtroFixo={{ competencia: f.competencia }} titulo={`Folha de pagamento · ${mesBR(f.competencia)}`} compacto descricao="Valores da folha por loja e grupo (salários, encargos, benefícios). Troque a competência no alto da página." /> },
        { key: 'imoveis', label: 'Aluguéis', children: <EntityTable ent="imoveis" titulo="Imóveis e aluguéis" compacto descricao="Contratos de aluguel de cada ponto. O aluguel do mês é custo operacional." /> },
      ]} />
    </div>
  );
}

const EXTRAS: Record<string, { key: string; label: string; ent: string; titulo: string; descricao: string }[]> = {
  Pessoas: [
    { key: 'folha', label: 'Folha do mês', ent: 'folha', titulo: 'Folha de pagamento', descricao: 'Referência do custo mensal com pessoas. Soma no custo operacional, não nas dívidas.' },
    { key: 'colaboradores', label: 'Colaboradores', ent: 'colaboradores', titulo: 'Colaboradores', descricao: 'Quem trabalha em cada loja, cargo e salário.' },
  ],
  Fornecedores: [{ key: 'cadastro', label: 'Cadastro de fornecedores', ent: 'fornecedores', titulo: 'Fornecedores', descricao: 'Fábricas e representantes, contato e marcas.' }],
  'Imóvel': [{ key: 'imoveis', label: 'Imóveis e contratos', ent: 'imoveis', titulo: 'Imóveis e aluguéis', descricao: 'Contrato, proprietário e valor do aluguel de cada ponto.' }],
  Governo: [],
};

export function Divida({ chave }: { chave: string }) {
  const g = DIVIDAS.find(x => x.chave === chave)!;
  const { q } = usePainel();
  const [aba, setAba] = useAba('dividas');
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message={(q.error as Error).message} />;
  const x = q.data.dividas[chave];
  return (
    <div>
      <div className="cabeca"><div><h1>{g.titulo}</h1><p>{g.descricao}</p></div></div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Kpi rot="Total devido" tom="neg" val={brl(x.total)} det={`${x.itens} ${x.itens === 1 ? 'item' : 'itens'} em aberto`} /></Col>
        <Col xs={24} md={8}><Kpi rot="Parcelas / mês" val={brl(x.parcelas)} det="Dívidas já parceladas" /></Col>
        <Col xs={24} md={8}><Kpi rot="A verificar" val={x.a_verificar} det={x.sem_valor ? `${x.sem_valor} ainda sem valor` : 'Todos com valor'} /></Col>
      </Row>
      {x.tipos.length > 0 && <Card title="Por tipo" style={{ marginTop: 16 }}>
        <Barras cor={g.cor} itens={x.tipos.map((t: any) => ({ rot: t.tipo, valor: t.valor, extra: <span className="dica"> · {t.itens} {t.itens === 1 ? 'item' : 'itens'}{t.sem_valor ? `, ${t.sem_valor} sem valor` : ''}</span> }))} />
      </Card>}
      <Tabs style={{ marginTop: 16 }} activeKey={aba} onChange={setAba} items={[
        { key: 'dividas', label: 'Dívidas', children: <EntityTable ent="passivos" filtroFixo={{ grandeza: chave }} titulo={`Dívidas com ${g.titulo.toLowerCase()}`} compacto descricao='Clique numa linha para editar. "Pago" e "Substituído" não somam no total.' /> },
        ...EXTRAS[chave].map(e => ({ key: e.key, label: e.label, children: <EntityTable ent={e.ent} titulo={e.titulo} descricao={e.descricao} compacto /> })),
      ]} />
    </div>
  );
}
