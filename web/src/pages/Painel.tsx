import { Card, Col, Row, Select, InputNumber, Space, Table, Tag, Progress, List, Spin, Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line, CartesianGrid } from 'recharts';
import { get } from '@/lib/api';
import { brl, mesBR, num, mi, corTag, CORES, semParen } from '@/lib/fmt';

export function Kpi({ rot, val, det, tom }: { rot: string; val: React.ReactNode; det?: React.ReactNode; tom?: 'neg' | 'pos' }) {
  return <Card className={'kpi ' + (tom || '')}><div className="rot">{rot}</div><div className="val">{val}</div>{det && <div className="det">{det}</div>}</Card>;
}

export default function Painel() {
  const [sp, setSp] = useSearchParams();
  const params = Object.fromEntries(sp.entries());
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['painel', params], queryFn: () => get('/painel', params) });
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message={(q.error as Error).message} />;
  const d = q.data; const t = d.totais; const f = d.filtros;
  const resultado = t.margem_mes - t.custo_mes;
  const muda = (k: string, v: any) => { const n = new URLSearchParams(sp); n.set(k, String(v)); setSp(n); };
  const lojas = d.lojas.filter((l: any) => l.considerada);
  const anos: number[] = [...new Set<number>(d.serie.map((s: any) => s.ano))];
  const nomes: string[] = [...new Set<string>(d.serie.map((s: any) => s.nome))];
  const serie = anos.map(a => Object.fromEntries([['ano', a], ...nomes.map(n => [semParen(n), (d.serie.find((s: any) => s.nome === n && s.ano === a) || {}).valor ?? null])]));
  const encerradas = new Set(d.serie.filter((s: any) => s.situacao === 'Encerrada').map((s: any) => semParen(s.nome)));
  const maxG = d.despesas_grupo[0]?.v || 1;

  return (
    <div>
      <div className="cabeca">
        <div><h1>Painel da avaliação</h1><p>Venda média mensal de {f.ano} contra o custo mensal: despesas da versão <b>{f.versao}</b> + folha de {mesBR(f.competencia)}. Margem bruta usada: <b>{num(f.margem_pct)}%</b> (premissa; troque aqui ou em Premissas).</p></div>
        <Space wrap>
          <Select value={f.versao} onChange={v => muda('versao', v)} options={f.versoes.map((v: string) => ({ value: v, label: 'Despesas: ' + v }))} popupMatchSelectWidth={false} />
          <Select value={f.competencia} onChange={v => muda('competencia', v)} options={f.competencias.map((v: string) => ({ value: v, label: 'Folha ' + mesBR(v) }))} />
          <Select value={f.ano} onChange={v => muda('ano', v)} options={f.anos.map((v: number) => ({ value: v, label: 'Vendas ' + v }))} />
          <InputNumber value={f.margem_pct} onChange={v => v != null && muda('margem', v)} addonBefore="Margem" addonAfter="%" style={{ width: 170 }} />
        </Space>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}><Kpi rot="Venda média / mês" val={brl(t.venda_mes)} det={`${f.ano}, lojas consideradas`} /></Col>
        <Col xs={24} sm={12} xl={6}><Kpi rot="Custo fixo / mês" val={brl(t.custo_mes)} det={<>Despesas {brl(t.despesas_mes)} + folha {brl(t.folha_mes)}</>} /></Col>
        <Col xs={24} sm={12} xl={6}><Kpi rot="Resultado estimado / mês" val={brl(resultado)} tom={resultado < 0 ? 'neg' : 'pos'} det={<>Margem {brl(t.margem_mes)} − custo fixo</>} /></Col>
        <Col xs={24} sm={12} xl={6}><Link to="/dividas"><Kpi rot="Dívidas mapeadas" val={brl(t.passivo)} tom="neg" det={<>{brl(t.parcelas_mes)}/mês em parcelas · {d.pendencias.passivos} itens a verificar</>} /></Link></Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={12}><Card title="Resultado por loja (mês)" extra={<span className="dica">antes do rateio de {brl(d.custo_central)} do central</span>}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={lojas.map((l: any) => ({ nome: semParen(l.nome), v: Math.round(l.resultado_mes) }))} layout="vertical" margin={{ left: 30 }}>
              <XAxis type="number" tickFormatter={v => mil(v)} /><YAxis type="category" dataKey="nome" width={110} />
              <Tooltip formatter={(v: any) => brl(v)} /><Bar dataKey="v" name="Resultado" radius={4}>{lojas.map((l: any, i: number) => <Cell key={i} fill={l.resultado_mes < 0 ? '#d71920' : '#12805c'} />)}</Bar>
            </BarChart>
          </ResponsiveContainer></Card></Col>
        <Col xs={24} xl={12}><Card title="Dívidas por tipo" extra={<span className="dica">Ativos mapeados: {brl(t.ativo)}</span>}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart><Pie data={d.passivos.filter((p: any) => p.v > 0)} dataKey="v" nameKey="categoria" innerRadius={60} outerRadius={105} paddingAngle={1}>{d.passivos.map((_: any, i: number) => <Cell key={i} fill={CORES[i % CORES.length]} />)}</Pie>
              <Tooltip formatter={(v: any) => brl(v)} /><Legend layout="vertical" align="right" verticalAlign="middle" /></PieChart>
          </ResponsiveContainer></Card></Col>
      </Row>
      <Card title="Lojas" style={{ marginTop: 16 }} extra={<Link to="/lojas">Todas as lojas</Link>}>
        <Table rowKey="id" size="middle" pagination={false} scroll={{ x: 'max-content' }} dataSource={lojas} onRow={(l: any) => ({ onClick: () => nav('/loja/' + l.id), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Loja', dataIndex: 'nome', render: v => <b>{v}</b> },
            { title: 'Situação', dataIndex: 'situacao', render: v => <Tag color={corTag(v)}>{v}</Tag> },
            { title: 'Venda/mês', dataIndex: 'venda_mes', align: 'right', render: brl, sorter: (a: any, b: any) => a.venda_mes - b.venda_mes },
            { title: 'Despesas/mês', dataIndex: 'despesas_mes', align: 'right', render: brl },
            { title: 'Folha/mês', dataIndex: 'folha_mes', align: 'right', render: brl },
            { title: 'Custo/venda', align: 'right', render: (_: any, l: any) => l.venda_mes ? num(100 * l.custo_mes / l.venda_mes) + '%' : '—' },
            { title: 'Resultado', dataIndex: 'resultado_mes', align: 'right', render: v => <span className={v < 0 ? 'neg' : 'pos'}>{brl(v)}</span>, sorter: (a: any, b: any) => a.resultado_mes - b.resultado_mes },
            { title: 'Após rateio', dataIndex: 'resultado_apos_rateio', align: 'right', render: v => <span className={v < 0 ? 'neg' : 'pos'}>{brl(v)}</span> },
          ]} /></Card>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={14}><Card title="Venda anual por loja" extra={<span className="dica">2026 = jan–set; cinza = encerradas</span>}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={serie}><CartesianGrid stroke="#eef0f3" vertical={false} /><XAxis dataKey="ano" /><YAxis tickFormatter={v => mi(v)} width={90} /><Tooltip formatter={(v: any) => brl(v)} /><Legend />
              {nomes.map((n, i) => <Line key={n} dataKey={semParen(n)} stroke={encerradas.has(semParen(n)) ? '#c4c8cf' : CORES[i % CORES.length]} strokeWidth={2} dot={false} connectNulls />)}</LineChart>
          </ResponsiveContainer></Card></Col>
        <Col xs={24} xl={10}><Card title="Despesas por grupo (mês)" extra={<span className="dica">sem a folha</span>}>
          <List dataSource={d.despesas_grupo} renderItem={(g: any) => <List.Item extra={<b>{brl(g.v)}</b>}><div style={{ width: '100%' }}>{g.grupo}<Progress percent={Math.round(100 * g.v / maxG)} showInfo={false} strokeColor="#d71920" size="small" /></div></List.Item>} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={12}><Card title="Ações prioritárias em aberto" extra={<Link to="/e/planos_acao">Ver todas</Link>}>
          <List dataSource={d.planos_alta} renderItem={(p: any) => <List.Item extra={<Tag color={corTag(p.status)}>{p.status}</Tag>}>{p.titulo}</List.Item>} /></Card></Col>
        <Col xs={24} xl={12}><Card title="O que ainda falta levantar">
          <List>
            <List.Item extra={<Link to="/dividas"><b className="neg">{d.pendencias.passivos}</b></Link>}>Dívidas sem valor ou a verificar</List.Item>
            <List.Item extra={<Link to="/e/ativos"><b className="neg">{d.pendencias.ativos}</b></Link>}>Ativos a levantar (bancos, recebíveis, consórcios, estoque)</List.Item>
            <List.Item extra={<Link to="/e/anotacoes"><b className="neg">{d.pendencias.infos}</b></Link>}>Informações a confirmar</List.Item>
          </List></Card></Col>
      </Row>
    </div>
  );
}

const mil = (v: number) => (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + 'k';
