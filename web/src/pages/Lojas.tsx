import { Card, Col, Row, Tag, Spin, Tabs, Button, Descriptions } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { get } from '@/lib/api';
import { brl, mi, corTag } from '@/lib/fmt';
import { useMeta } from '@/lib/store';
import EntityTable from '@/components/EntityTable';
import EntityForm from '@/components/EntityForm';

export function Lojas() {
  const q = useQuery({ queryKey: ['painel', {}], queryFn: () => get('/painel') });
  if (q.isLoading) return <Spin />;
  const d = q.data;
  const linha = (r: string, v: React.ReactNode) => <div className="linha"><span>{r}</span><b>{v}</b></div>;
  return (
    <div>
      <div className="cabeca"><div><h1>Lojas</h1><p>Resumo de cada loja. Abra uma loja para ver vendas, despesas, folha, imóvel, pessoas, dívidas e ações dela.</p></div></div>
      <Row gutter={[16, 16]}>
        {d.lojas.map((l: any) => (
          <Col xs={24} md={12} xl={8} key={l.id}><Link to={'/loja/' + l.id}><Card hoverable title={l.nome} extra={<Tag color={corTag(l.situacao)}>{l.situacao}</Tag>}>
            {linha(`Venda/mês (${d.filtros.ano})`, brl(l.venda_mes))}
            {linha('Custo/mês', brl(l.custo_mes))}
            {linha('Resultado/mês', <span className={l.resultado_mes < 0 ? 'neg' : 'pos'}>{brl(l.resultado_mes)}</span>)}
            {l.potencial && linha('Potencial (mercado)', `${mi(l.potencial.compativel_min)} a ${mi(l.potencial.compativel_max)}`)}
          </Card></Link></Col>
        ))}
      </Row>
      <h2 style={{ margin: '28px 0 12px' }}>Centros de custo</h2>
      <Row gutter={[16, 16]}>
        {d.centros.map((c: any) => <Col xs={24} md={12} xl={6} key={c.id}><Link to={'/loja/' + c.id}><Card hoverable title={c.nome}>{linha('Custo/mês', brl(c.custo_mes))}</Card></Link></Col>)}
      </Row>
    </div>
  );
}

const ABAS: [string, string][] = [['vendas', 'Vendas'], ['despesas', 'Despesas'], ['folha', 'Folha'], ['imoveis', 'Imóvel e aluguel'], ['quadro', 'Quadro de cargos'], ['colaboradores', 'Colaboradores'], ['passivos', 'Dívidas'], ['potencial', 'Potencial'], ['planos_acao', 'Ações'], ['ativos', 'Ativos']];

export function Loja() {
  const { id } = useParams(); const uid = Number(id);
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const meta = useMeta();
  const [ed, setEd] = useState(false);
  const q = useQuery({ queryKey: ['unidade', uid], queryFn: () => get('/unidade/' + uid) });
  if (q.isLoading || !meta.data) return <Spin />;
  const d = q.data; const u = d.unidade;
  const aba = sp.get('aba') || 'vendas';
  return (
    <div>
      <div className="cabeca"><div><Button type="link" style={{ padding: 0 }} onClick={() => nav('/lojas')}>← Lojas</Button><h1>{u.nome}</h1>{u.observacoes && <p>{u.observacoes}</p>}</div>
        <Button onClick={() => setEd(true)}>Editar cadastro</Button></div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }} items={[
          ['Código', u.codigo], ['Situação', <Tag color={corTag(u.situacao)}>{u.situacao}</Tag>], ['Razão social', u.razao_social], ['CNPJ', u.cnpj], ['CNPJ anterior', u.cnpj_anterior], ['Inscrição estadual', u.inscricao_estadual],
          ['Endereço', u.endereco], ['Gerente', u.gerente], ['E-mail', u.email], ['Telefone', u.telefone], ['Código Alterdata', u.codigo_alterdata], ['Área', u.area_m2 ? u.area_m2 + ' m²' : null],
        ].filter(([, v]) => v).map(([k, v], i) => ({ key: i, label: k as string, children: v as React.ReactNode }))} />
      </Card>
      <Tabs activeKey={aba} onChange={k => setSp({ aba: k })} items={ABAS.map(([k, t]) => ({ key: k, label: `${t} (${(d[k] || []).length})` }))} />
      <EntityTable key={aba} ent={aba} filtroFixo={{ unidade_id: uid }} titulo={meta.data.entities[aba].label} compacto />
      <EntityForm ent="unidades" entity={meta.data.entities.unidades} id={uid} open={ed} onClose={() => { setEd(false); q.refetch(); }} />
    </div>
  );
}
