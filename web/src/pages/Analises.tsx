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
