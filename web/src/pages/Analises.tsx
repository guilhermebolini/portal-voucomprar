import { Card, Col, Row, Tabs, Alert, Spin, Select, Space, Table, List } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { get } from '@/lib/api';
import { brl, mi, mesBR, semParen } from '@/lib/fmt';
import { useLista, useMeta, useRefs } from '@/lib/store';
import EntityTable from '@/components/EntityTable';
import EntityForm from '@/components/EntityForm';
import { Kpi } from './Painel';

const GRUPOS: [string, string, string[] | null][] = [
  ['todas', 'Todas', null],
  ['fornecedores', 'Fornecedores', ['Fornecedores']],
  ['pessoas', 'Pessoas e trabalhistas', ['Trabalhista - salários atrasados', 'Trabalhista - rescisões', 'Trabalhista - acordos/processos', 'FGTS', 'INSS']],
  ['alugueis', 'Aluguéis', ['Aluguéis']],
  ['impostos', 'Impostos', ['Impostos']],
  ['bancos', 'Bancos e consórcios', ['Bancos/Empréstimos', 'Consórcios']],
  ['outros', 'Outros', ['Outros']],
];

export function Dividas() {
  const [sp, setSp] = useSearchParams();
  const aba = sp.get('aba') || 'todas';
  const l = useLista('passivos');
  useRefs();
  const all = l.data || [];
  const ativo = (x: any) => !['Pago', 'Substituído'].includes(x.situacao);
  const soma = (cats: string[] | null) => all.filter(x => ativo(x) && (!cats || cats.includes(x.categoria))).reduce((s, x) => s + (Number(x.valor_atual ?? x.valor_original) || 0), 0);
  const parc = all.filter(ativo).reduce((s, x) => s + (Number(x.parcela_mensal) || 0), 0);
  const cats = (GRUPOS.find(g => g[0] === aba) || GRUPOS[0])[2];
  return (
    <div>
      <div className="cabeca"><div><h1>Dívidas e passivos</h1><p>Tudo o que a empresa deve: fornecedores (representantes e fábricas), pessoas (salários, rescisões, acordos, FGTS, INSS), aluguéis, impostos e bancos. Itens "Pago" e "Substituído" não somam.</p></div></div>
      <Row gutter={[16, 16]}>
        {GRUPOS.slice(1, 5).map(([k, t, c]) => <Col xs={24} sm={12} xl={6} key={k}><a onClick={() => setSp({ aba: k })}><Kpi rot={t} val={brl(soma(c))} det={`${all.filter(x => ativo(x) && c!.includes(x.categoria)).length} itens`} /></a></Col>)}
      </Row>
      <Alert style={{ marginTop: 16 }} type="warning" showIcon message={<>Total mapeado: <b>{brl(soma(null))}</b> · parcelas mensais: <b>{brl(parc)}</b> · {all.filter(x => x.situacao === 'A verificar').length} itens ainda "A verificar" (vários sem valor).</>} />
      <Tabs style={{ marginTop: 8 }} activeKey={aba} onChange={k => setSp({ aba: k })} items={GRUPOS.map(([k, t]) => ({ key: k, label: t }))} />
      {!cats ? <EntityTable ent="passivos" titulo="Todas as dívidas" compacto />
        : cats.map(c => <div key={c} style={{ marginBottom: 28 }}><EntityTable ent="passivos" filtroFixo={{ categoria: c }} titulo={c} compacto /></div>)}
    </div>
  );
}

export function Potencial() {
  const l = useLista('potencial'); const refs = useRefs();
  const dados = (l.data || []).map(p => ({ nome: semParen(refs.nome('unidades', p.unidade_id)), 'Venda 2022': p.venda_2022, 'Venda 2025': p.venda_2025, 'Mercado (mín.)': p.compativel_min, 'Mercado (máx.)': p.compativel_max, 'Meta do comprador': p.meta_comprador }));
  return (
    <div>
      <div className="cabeca"><div><h1>Potencial de venda</h1><p>Quanto cada ponto comporta pelo mercado (BPO: venda de 2022 × variação do segmento no RJ × IPCA). Preencha a <b>Meta do comprador</b> com a sua meta realista. Referência de mercado, não projeção.</p></div></div>
      <Card><ResponsiveContainer width="100%" height={360}>
        <BarChart data={dados}><CartesianGrid stroke="#eef0f3" vertical={false} /><XAxis dataKey="nome" /><YAxis tickFormatter={v => mi(v)} width={90} /><Tooltip formatter={(v: any) => mi(v)} /><Legend />
          <Bar dataKey="Venda 2022" fill="#c4c8cf" /><Bar dataKey="Venda 2025" fill="#16181d" /><Bar dataKey="Mercado (mín.)" fill="#f2a0a3" /><Bar dataKey="Mercado (máx.)" fill="#d71920" /><Bar dataKey="Meta do comprador" fill="#12805c" />
        </BarChart></ResponsiveContainer></Card>
      <div style={{ marginTop: 16 }}><EntityTable ent="potencial" titulo="Tabela" compacto /></div>
    </div>
  );
}

export function Previsao() {
  const [sp, setSp] = useSearchParams();
  const params = Object.fromEntries(sp.entries());
  const meta = useMeta();
  const [ed, setEd] = useState<number | null>(null);
  const q = useQuery({ queryKey: ['previsao', params], queryFn: () => get('/previsao', params) });
  const pd = useQuery({ queryKey: ['painel', {}], queryFn: () => get('/painel') });
  if (q.isLoading || pd.isLoading || !meta.data) return <Spin />;
  const d = q.data; const f = pd.data.filtros;
  const muda = (k: string, v: any) => { const n = new URLSearchParams(sp); n.set(k, String(v)); setSp(n); };
  const semPrazo = d.sem_prazo.reduce((s: number, x: any) => s + (Number(x.saldo) || 0), 0);
  const graf = d.meses.map((m: any) => ({ mes: mesBR(m.mes), Despesas: m.despesas, Folha: m.folha + m.decimo_terceiro, Parcelas: m.parcelamentos, Vencimentos: m.vencimentos }));
  return (
    <div>
      <div className="cabeca"><div><h1>Previsão de saídas</h1><p>Quanto sai do caixa por mês: despesas recorrentes (versão <b>{d.versao}</b>) + folha ({mesBR(d.competencia)}) + 13º em dezembro + parcelas de dívidas parceladas + dívidas com vencimento. Para uma dívida entrar aqui, preencha <b>parcela mensal</b> e <b>parcelas restantes</b>, ou o <b>vencimento</b>.</p></div>
        <Space wrap>
          <Select value={d.versao} onChange={v => muda('versao', v)} options={f.versoes.map((v: string) => ({ value: v, label: 'Despesas: ' + v }))} popupMatchSelectWidth={false} />
          <Select value={d.competencia} onChange={v => muda('competencia', v)} options={f.competencias.map((v: string) => ({ value: v, label: 'Folha ' + mesBR(v) }))} />
          <Select value={Number(params.meses || 12)} onChange={v => muda('meses', v)} options={[6, 12, 18, 24, 36].map(m => ({ value: m, label: m + ' meses' }))} />
        </Space></div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Kpi rot="Saída média / mês" val={brl(d.total / d.meses.length)} det={`${d.meses.length} meses: ${brl(d.total)}`} /></Col>
        <Col xs={24} md={8}><Kpi rot="Recorrente fixo / mês" val={brl(d.meses[0].despesas + d.meses[0].folha)} det={`Despesas ${brl(d.meses[0].despesas)} + folha ${brl(d.meses[0].folha)}`} /></Col>
        <Col xs={24} md={8}><Kpi rot="Dívidas sem prazo definido" tom="neg" val={brl(semPrazo)} det={`${d.sem_prazo.length} itens fora da previsão`} /></Col>
      </Row>
      <Card style={{ marginTop: 16 }}><ResponsiveContainer width="100%" height={340}>
        <BarChart data={graf}><CartesianGrid stroke="#eef0f3" vertical={false} /><XAxis dataKey="mes" /><YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'k'} /><Tooltip formatter={(v: any) => brl(v)} /><Legend />
          <Bar dataKey="Despesas" stackId="s" fill="#16181d" /><Bar dataKey="Folha" stackId="s" fill="#6b7280" /><Bar dataKey="Parcelas" stackId="s" fill="#d71920" /><Bar dataKey="Vencimentos" stackId="s" fill="#f59e0b" />
        </BarChart></ResponsiveContainer></Card>
      <Card title="Mês a mês" style={{ marginTop: 16 }}>
        <Table rowKey="mes" size="small" pagination={false} scroll={{ x: 'max-content' }} dataSource={d.meses}
          expandable={{ rowExpandable: (m: any) => m.detalhe.length > 0, expandedRowRender: (m: any) => m.detalhe.map((x: any, i: number) => <div key={i}>{x.tipo === 'parcela' ? 'Parcela' : 'Vencimento'}: {x.credor} · {brl(x.valor)}{x.sem_fim ? ' (sem nº de parcelas definido)' : ''}</div>) }}
          columns={[{ title: 'Mês', dataIndex: 'mes', render: mesBR }, ...['despesas', 'folha', 'decimo_terceiro', 'parcelamentos', 'vencimentos'].map(k => ({ title: { despesas: 'Despesas', folha: 'Folha', decimo_terceiro: '13º', parcelamentos: 'Parcelas', vencimentos: 'Vencimentos' }[k], dataIndex: k, align: 'right' as const, render: (v: number) => v ? brl(v) : '—' })), { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <b>{brl(v)}</b> }]} />
      </Card>
      <Card title="Dívidas sem parcela nem vencimento" style={{ marginTop: 16 }} extra={<span className="dica">clique para definir parcela ou vencimento</span>}>
        <List dataSource={d.sem_prazo} renderItem={(x: any) => <List.Item style={{ cursor: 'pointer' }} onClick={() => setEd(x.id)} extra={<b>{brl(x.saldo)}</b>}>{x.categoria} · {x.credor || x.descricao}</List.Item>} />
      </Card>
      <EntityForm ent="passivos" entity={meta.data.entities.passivos} id={ed} open={ed != null} onClose={() => { setEd(null); q.refetch(); }} />
    </div>
  );
}
