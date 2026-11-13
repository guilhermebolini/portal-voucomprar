import { Card, Col, Row, Select, Space, Table, Tag, List, Spin, Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { get } from '@/lib/api';
import { brl, mesBR, corTag, semParen } from '@/lib/fmt';
import { OPERACIONAL, DIVIDAS } from '@/lib/grandezas';

export function Kpi({ rot, val, det, tom }: { rot: string; val: React.ReactNode; det?: React.ReactNode; tom?: 'neg' | 'pos' }) {
  return <Card className={'kpi ' + (tom || '')}><div className="rot">{rot}</div><div className="val">{val}</div>{det && <div className="det">{det}</div>}</Card>;
}

export function usePainel() {
  const [sp, setSp] = useSearchParams();
  const params = Object.fromEntries(sp.entries());
  const q = useQuery({ queryKey: ['painel', params], queryFn: () => get('/painel', params) });
  const muda = (k: string, v: any) => { const n = new URLSearchParams(sp); n.set(k, String(v)); setSp(n); };
  return { q, muda };
}

export function FiltrosCusto({ f, muda }: { f: any; muda: (k: string, v: any) => void }) {
  return (
    <Space wrap>
      <Select value={f.versao} onChange={v => muda('versao', v)} options={f.versoes.map((v: string) => ({ value: v, label: 'Despesas: ' + v }))} popupMatchSelectWidth={false} />
      <Select value={f.competencia} onChange={v => muda('competencia', v)} options={f.competencias.map((v: string) => ({ value: v, label: 'Folha ' + mesBR(v) }))} />
    </Space>
  );
}

// Barra horizontal simples: rótulo, valor e a proporção
export function Barras({ itens, cor }: { itens: { rot: string; valor: number; extra?: React.ReactNode }[]; cor: string }) {
  const max = Math.max(1, ...itens.map(i => i.valor));
  return <div>{itens.map(i => (
    <div key={i.rot} className="barra">
      <div className="barra-topo"><span>{i.rot}{i.extra}</span><b>{brl(i.valor)}</b></div>
      <div className="barra-fundo"><span style={{ width: `${(i.valor / max) * 100}%`, background: cor }} /></div>
    </div>))}</div>;
}

export default function Painel() {
  const { q, muda } = usePainel();
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message={(q.error as Error).message} />;
  const d = q.data; const f = d.filtros; const op = d.operacional;
  const outros = d.dividas.Outros;

  return (
    <div>
      <div className="cabeca">
        <div><h1>Painel</h1><p>Quanto o negócio custa por mês para ficar aberto e quanto ele deve, separado em quatro grupos: pessoas, fornecedores, imóvel e governo.</p></div>
        <FiltrosCusto f={f} muda={muda} />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Kpi rot="Custo operacional / mês" val={brl(op.total)} det={<>Despesas {brl(op.despesas)} + folha {brl(op.folha)}</>} /></Col>
        <Col xs={24} md={8}><Kpi rot="Dívidas mapeadas" tom="neg" val={brl(d.divida_total)} det={<>{d.pendencias.passivos} itens ainda a verificar</>} /></Col>
        <Col xs={24} md={8}><Kpi rot="Saída mensal comprometida" val={brl(d.saida_mes)} det={<>Custo operacional + {brl(d.parcelas_mes)} de parcelas de dívidas</>} /></Col>
      </Row>

      <div className="grandezas">
        <Link to={OPERACIONAL.rota} className="grandeza" style={{ borderTopColor: OPERACIONAL.cor }}>
          <div className="g-tit">{OPERACIONAL.titulo}</div>
          <div className="g-val">{brl(op.total)}<small>/mês</small></div>
          <div className="g-det">{OPERACIONAL.resumo}</div>
        </Link>
        {DIVIDAS.map(g => {
          const x = d.dividas[g.chave];
          return (
            <Link key={g.chave} to={g.rota} className="grandeza" style={{ borderTopColor: g.cor }}>
              <div className="g-tit">{g.titulo}</div>
              <div className="g-val">{brl(x.total)}</div>
              <div className="g-det">{x.itens} {x.itens === 1 ? 'item' : 'itens'}{x.sem_valor ? <>, <span className="neg">{x.sem_valor} sem valor</span></> : null}{x.parcelas ? <> · parcelas {brl(x.parcelas)}/mês</> : null}</div>
              <div className="g-det">{g.resumo}</div>
            </Link>
          );
        })}
      </div>
      {outros.itens > 0 && <Alert style={{ marginTop: 12 }} type="info" showIcon message={<>Há {outros.itens} {outros.itens === 1 ? 'dívida' : 'dívidas'} fora dos quatro grupos ({outros.tipos.map((t: any) => t.tipo).join(', ')}): {brl(outros.total)}. <Link to="/e/passivos">Abrir e reclassificar</Link>.</>} />}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Custo operacional por grupo" extra={<span className="dica">{f.versao} · folha {mesBR(f.competencia)}</span>} style={{ height: '100%' }}>
            <Barras cor={OPERACIONAL.cor} itens={[{ rot: 'Folha de pagamento', valor: op.folha }, ...op.por_grupo.map((g: any) => ({ rot: g.grupo, valor: g.valor }))].sort((a, b) => b.valor - a.valor)} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Custo operacional por loja / setor" style={{ height: '100%' }} extra={<Link to={OPERACIONAL.rota}>Detalhar</Link>}>
            <Table rowKey={r => String(r.id)} size="small" pagination={false} dataSource={op.por_loja} scroll={{ x: 'max-content' }}
              columns={[
                { title: 'Loja / setor', dataIndex: 'nome', render: (v: string, r: any) => <>{semParen(v)} {r.situacao && r.situacao !== 'Em operação' ? <Tag color={corTag(r.situacao)}>{r.situacao}</Tag> : null}</> },
                { title: 'Despesas', dataIndex: 'despesas', align: 'right', render: brl },
                { title: 'Folha', dataIndex: 'folha', align: 'right', render: brl },
                { title: 'Total/mês', dataIndex: 'total', align: 'right', render: (v: number) => <b>{brl(v)}</b> },
              ]} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Maiores dívidas" style={{ height: '100%' }} extra={<Link to="/e/passivos">Todas</Link>}>
            <List dataSource={d.maiores} renderItem={(x: any) => {
              const g = DIVIDAS.find(g => g.chave === x.grandeza);
              return <List.Item extra={<b>{brl(x.valor)}</b>}><span><Tag color={g?.cor}>{x.grandeza}</Tag>{x.credor || x.descricao} <span className="dica">{x.categoria}</span></span></List.Item>;
            }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Ações prioritárias em aberto" style={{ height: '100%' }} extra={<Link to="/e/planos_acao">Ver todas</Link>}>
            <List dataSource={d.planos_alta} renderItem={(p: any) => <List.Item extra={<Tag color={corTag(p.status)}>{p.status}</Tag>}>{p.titulo}</List.Item>} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
