import { useMemo, useState } from 'react';
import { Card, Select, Upload, Button, InputNumber, Alert, Table, Form, Input, Space, Tag, Spin, Radio, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { get, post, put, type Field } from '@/lib/api';
import { useAuth, useMeta, PAPEL } from '@/lib/store';
import { dataHora } from '@/lib/fmt';
import EntityTable from '@/components/EntityTable';
import EntityForm from '@/components/EntityForm';

const DESC: Record<string, string> = {
  despesas: 'Cada linha de despesa por loja. A versão separa as fontes (planilha FINANCEIRO de out/26, evidência da BPO, o que você informou) e permite montar um cenário ajustado do comprador.',
  folha: 'Lançamentos de folha por competência e loja (salários, FGTS, INSS, benefícios…).',
  imoveis: 'Contratos de aluguel, valor informado x evidência e atrasos por loja.',
  colaboradores: 'Pessoas, lotação e rateio entre lojas. Registre salários atrasados e rescisão estimada por pessoa.',
  contracheques: 'Contracheques por pessoa e competência: proventos, descontos, líquido, FGTS e as verbas linha a linha.',
  quadro: 'Cargos e salários base por loja (planilha FINANCEIRO, out/26).',
  fornecedores: 'Representantes e fábricas. As dívidas ficam em Dívidas e passivos, ligadas ao fornecedor.',
  vendas: 'Venda líquida por loja: anual (histórico da BPO), mensal ou diária (importações do Alterdata).',
  planos_acao: 'O que precisa ser feito antes e depois da compra. Acompanhe prioridade, responsável, prazo e status.',
  ativos: 'Saldos, recebíveis, consórcios, estoque. Entram no índice de liquidez.',
  anotacoes: 'Informações levantadas nas conversas e planilhas, com a fonte e se já foram confirmadas.',
  unidades: 'Lojas e centros de custo, com CNPJ, endereço e código do Alterdata (usado nas importações).',
  parametros: 'Premissas usadas nos cálculos do painel. Só o administrador altera.',
  passivos: 'Todas as dívidas. A tela Dívidas e passivos mostra separado por tipo.',
  potencial: 'Potencial de venda por loja.',
};

export function Entidade() {
  const { ent = '' } = useParams();
  const meta = useMeta();
  if (!meta.data) return <Spin />;
  const e = meta.data.entities[ent];
  if (!e) return <p>Página não encontrada.</p>;
  return <EntityTable key={ent} ent={ent} titulo={e.label} descricao={DESC[ent]} />;
}

// Vendas saíram do portal por enquanto (pedido do Guilherme em 13/11). O back-end continua aceitando.
const OCULTAS = ['vendas', 'potencial'];

export function Importar() {
  const [sp] = useSearchParams();
  const meta = useMeta(); const user = useAuth(s => s.user); const qc = useQueryClient();
  const [ent, setEnt] = useState(sp.get('tabela') || 'despesas');
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null); const [arq, setArq] = useState('');
  const [aba, setAba] = useState(''); const [cab, setCab] = useState(1);
  const [mapa, setMapa] = useState<Record<string, number | undefined>>({});
  const [periodo, setPeriodo] = useState('Dia'); const [versao, setVersao] = useState('');
  const [res, setRes] = useState<{ tipo: 'success' | 'warning' | 'error'; msg: React.ReactNode } | null>(null); const [load, setLoad] = useState(false);
  const hist = useQuery({ queryKey: ['importacoes'], queryFn: () => get('/importacoes') });

  const { heads, dados } = useMemo(() => {
    if (!wb || !aba) return { heads: [] as string[], dados: [] as any[][] };
    const mat: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, raw: true, defval: null, blankrows: false });
    const h = (mat[cab - 1] || []).map((x: any, i: number) => x == null || x === '' ? 'Coluna ' + (i + 1) : String(x).trim());
    return { heads: h, dados: mat.slice(cab).filter(r => r.some(c => c != null && c !== '')) };
  }, [wb, aba, cab]);

  const alvo: Partial<Field>[] = ent === '__vendas'
    ? [{ name: 'loja', label: 'Loja (nome, código Alterdata ou CNPJ)', required: true }, { name: 'data', label: 'Data', type: 'date' }, { name: 'ano', label: 'Ano' }, { name: 'mes', label: 'Mês' }, { name: 'valor', label: 'Venda líquida', required: true }, { name: 'atendimentos', label: 'Atendimentos' }, { name: 'ticket', label: 'Ticket médio' }, { name: 'descricao', label: 'Descrição' }]
    : meta.data?.entities[ent]?.fields || [];

  const palpite = useMemo(() => {
    const norm = (s: any) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const m: Record<string, number | undefined> = {};
    for (const f of alvo) {
      const alvos = [f.name, f.label, ...(f.name === 'unidade_id' || f.name === 'loja' ? ['loja', 'empresa', 'filial', 'unidade'] : []), ...(f.name === 'valor' || f.name === 'valor_mensal' ? ['valor', 'total', 'vendaliquida', 'venda'] : [])].map(norm).filter(Boolean);
      const i = heads.findIndex(h => alvos.some(a => norm(h) === a || norm(h).includes(a)));
      m[f.name!] = i >= 0 ? i : undefined;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heads, ent]);
  const mapaAtual = { ...palpite, ...mapa };

  const ler = async (file: File) => {
    const w = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    setWb(w); setArq(file.name); setAba(w.SheetNames[0]); setMapa({}); setRes(null);
    return false;
  };
  const toData = (v: any) => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`; }
    if (typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(v)) { const [dd, mm, yy] = v.slice(0, 10).split('/'); return `${yy}-${mm}-${dd}`; }
    return v;
  };
  const importar = async () => {
    const tipos: Record<string, string> = Object.fromEntries(alvo.map(f => [f.name, f.type || '']));
    const linhas = dados.map(r => { const o: any = {}; for (const [k, i] of Object.entries(mapaAtual)) { if (i == null) continue; let v = r[i]; if (tipos[k] === 'date') v = toData(v); if (tipos[k] === 'month') { v = toData(v); if (v) v = String(v).slice(0, 7); } if (v instanceof Date) v = v.toISOString().slice(0, 10); o[k] = v; } return o; });
    setLoad(true); setRes(null);
    try {
      if (ent === '__vendas') {
        const bruto = dados.map(row => Object.fromEntries(heads.map((h, i) => [h, row[i] instanceof Date ? row[i].toISOString().slice(0, 10) : row[i]])));
        const r = await post('/importar/vendas', { arquivo: arq, linhas, bruto, periodo });
        setRes({ tipo: r.sem_loja.length ? 'warning' : 'success', msg: <>{r.resumo}{r.sem_loja.length > 0 && <><br />Cadastre o código Alterdata dessas lojas em Cadastro de lojas e importe de novo.</>}</> });
      } else {
        if (versao) linhas.forEach(l => { if (!l.versao) l.versao = versao; });
        const r = await post('/importar/tabela/' + ent, { arquivo: arq, linhas, substituir_versao: versao || null });
        setRes({ tipo: r.erros.length ? 'warning' : 'success', msg: <>{r.ok} linhas importadas.{r.erros.map((e: string, i: number) => <div key={i}>{e}</div>)}</> });
      }
      qc.invalidateQueries();
    } catch (e: any) { setRes({ tipo: 'error', msg: e.message }); } finally { setLoad(false); }
  };

  if (!meta.data) return <Spin />;
  const ents = Object.entries(meta.data.entities).filter(([k]) => k !== 'parametros' || user?.papel === 'admin');
  return (
    <div>
      <div className="cabeca"><div><h1>Importar planilha</h1><p>Suba um Excel (.xlsx/.xls) ou CSV, escolha o destino e diga qual coluna é qual. Serve para atualizar despesas, folha, dívidas etc. e para receber os exports do Alterdata (Quadro de Venda Diária, BI Documentos) enquanto o acesso ao banco não sai.</p></div></div>
      <Card>
        <Form layout="vertical"><div className="duas">
          <Form.Item label="Destino"><Select value={ent} onChange={v => { setEnt(v); setMapa({}); }} showSearch optionFilterProp="label" options={ents.filter(([k]) => !OCULTAS.includes(k)).map(([k, e]) => ({ value: k, label: e.label }))} /></Form.Item>
          <Form.Item label="Arquivo"><Upload.Dragger accept=".xlsx,.xls,.csv" maxCount={1} beforeUpload={ler} showUploadList={false}><p className="ant-upload-drag-icon"><InboxOutlined /></p><p>{arq || 'Clique ou arraste a planilha'}</p></Upload.Dragger></Form.Item>
          {wb && <Form.Item label="Aba"><Select value={aba} onChange={v => { setAba(v); setMapa({}); }} options={wb.SheetNames.map(n => ({ value: n, label: n }))} /></Form.Item>}
          {wb && <Form.Item label="Linha do cabeçalho"><InputNumber min={1} value={cab} onChange={v => { setCab(v || 1); setMapa({}); }} /></Form.Item>}
        </div></Form>
        {wb && <>
          <h3>Colunas</h3>
          <p className="dica">{dados.length} linhas encontradas. Deixe em branco o que não existe. Lojas e fornecedores são reconhecidos pelo nome, código ou CNPJ.</p>
          <div className="mapa-col">
            {alvo.map(f => <><label key={'l' + f.name}>{f.label}{f.required ? ' *' : ''}</label>
              <Select key={'s' + f.name} allowClear value={mapaAtual[f.name!]} onChange={v => setMapa(m => ({ ...m, [f.name!]: v }))} options={heads.map((h, i) => ({ value: i, label: h }))} placeholder="—" /></>)}
          </div>
          {ent === '__vendas' && <Form.Item label="Cada linha é" style={{ marginTop: 16 }} extra="Importar de novo o mesmo período da mesma loja substitui a importação anterior."><Radio.Group value={periodo} onChange={e => setPeriodo(e.target.value)} options={['Dia', 'Mês', 'Ano']} /></Form.Item>}
          {ent === 'despesas' && <Form.Item label="Versão destas despesas" style={{ marginTop: 16 }} extra="Se a planilha não tiver a coluna Versão, todas as linhas recebem esta. Se essa versão já existir, ela é substituída."><Input value={versao} onChange={e => setVersao(e.target.value)} placeholder="ex.: Financeiro nov/26" style={{ maxWidth: 320 }} /></Form.Item>}
          <Button type="primary" style={{ marginTop: 16 }} loading={load} onClick={importar}>Importar {dados.length} linhas</Button>
        </>}
        {res && <Alert style={{ marginTop: 16 }} type={res.tipo} message={res.msg} showIcon />}
      </Card>
      <Card title="Importações feitas" style={{ marginTop: 16 }}>
        <Table rowKey="id" size="small" loading={hist.isLoading} dataSource={hist.data || []} pagination={false} scroll={{ x: 'max-content' }}
          columns={[{ title: '#', dataIndex: 'id' }, { title: 'Quando', dataIndex: 'criado_em', render: dataHora }, { title: 'Destino', dataIndex: 'tipo' }, { title: 'Arquivo', dataIndex: 'arquivo' }, { title: 'Usuário', dataIndex: 'usuario' }, { title: 'Resumo', dataIndex: 'resumo' }]} />
      </Card>
    </div>
  );
}

export function Historico() {
  const meta = useMeta();
  const q = useQuery({ queryKey: ['auditoria'], queryFn: () => get('/auditoria') });
  const [ed, setEd] = useState<{ ent: string; id: number } | null>(null);
  return (
    <div>
      <div className="cabeca"><div><h1>Histórico de alterações</h1><p>Últimas 300 inclusões, edições e exclusões, com quem fez.</p></div></div>
      <Table rowKey="id" size="small" loading={q.isLoading} dataSource={q.data || []} scroll={{ x: 'max-content' }} pagination={{ pageSize: 50 }}
        columns={[
          { title: 'Quando', dataIndex: 'criado_em', render: dataHora },
          { title: 'Usuário', dataIndex: 'usuario' },
          { title: 'Ação', dataIndex: 'acao', render: v => <Tag color={v === 'excluiu' ? 'red' : v === 'criou' ? 'green' : 'blue'}>{v}</Tag> },
          { title: 'Tabela', dataIndex: 'entidade', render: v => meta.data?.entities[v]?.label || v },
          { title: 'Registro', render: (_: any, r: any) => r.acao === 'excluiu' ? '#' + r.registro_id : <a onClick={() => setEd({ ent: r.entidade, id: r.registro_id })}>#{r.registro_id}</a> },
          { title: 'Mudanças', dataIndex: 'dados', render: (v: any, r: any) => { if (r.acao !== 'editou') return ''; try { const d = typeof v === 'string' ? JSON.parse(v) : v; return <div style={{ fontSize: 12 }}>{Object.entries(d || {}).map(([k, x]: any) => <div key={k}>{k}: {String(x.de ?? '—')} → {String(x.para ?? '—')}</div>)}</div>; } catch { return ''; } } },
        ]} />
      {ed && meta.data && <EntityForm ent={ed.ent} entity={meta.data.entities[ed.ent]} id={ed.id} open onClose={() => setEd(null)} />}
    </div>
  );
}

export function Usuarios() {
  const q = useQuery({ queryKey: ['usuarios'], queryFn: () => get('/usuarios') });
  const me = useAuth(s => s.user);
  const [link, setLink] = useState<{ enviado: boolean; link: string } | null>(null);
  const [form] = Form.useForm(); const [load, setLoad] = useState(false);
  const convidar = async (v: any) => { setLoad(true); try { const r = await post('/usuarios', v); setLink(r); form.resetFields(); q.refetch(); } catch (e: any) { message.error(e.message); } finally { setLoad(false); } };
  const altera = async (id: number, body: any) => { try { await put('/usuarios/' + id, body); q.refetch(); message.success('Alterado'); } catch (e: any) { message.error(e.message); } };
  const gerar = async (id: number) => { const r = await post(`/usuarios/${id}/link`); setLink(r); };
  return (
    <div>
      <div className="cabeca"><div><h1>Usuários</h1><p><b>Administrador</b>: tudo, inclusive usuários e premissas. <b>Editor</b>: consulta e altera dados. <b>Leitor</b>: só consulta.</p></div></div>
      {q.data && !q.data.email_ativo && <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="O envio de e-mail ainda não está ligado (falta SMTP_PASS no hPanel). Ao convidar, copie o link gerado e mande pelo WhatsApp." />}
      <Card title="Convidar">
        <Form form={form} layout="inline" onFinish={convidar} initialValues={{ papel: 'editor' }} style={{ rowGap: 12 }}>
          <Form.Item name="nome" rules={[{ required: true, message: 'Nome' }]}><Input placeholder="Nome" /></Form.Item>
          <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'E-mail' }]}><Input placeholder="E-mail" style={{ width: 240 }} /></Form.Item>
          <Form.Item name="papel"><Select style={{ width: 150 }} options={['editor', 'leitor', 'admin'].map(p => ({ value: p, label: PAPEL[p] }))} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={load}>Convidar</Button>
        </Form>
      </Card>
      {link && <Alert style={{ marginTop: 16 }} type={link.enviado ? 'success' : 'warning'} showIcon closable onClose={() => setLink(null)} message={link.enviado ? 'E-mail enviado. Link também abaixo (vale 3 dias, uso único):' : 'E-mail não enviado. Mande este link (vale 3 dias, uso único):'} description={<Input readOnly value={link.link} onFocus={e => e.target.select()} />} />}
      <Table style={{ marginTop: 16 }} rowKey="id" loading={q.isLoading} dataSource={q.data?.usuarios || []} pagination={false} scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Nome', dataIndex: 'nome' }, { title: 'E-mail', dataIndex: 'email' },
          { title: 'Papel', dataIndex: 'papel', render: (v, u: any) => <Select value={v} disabled={u.id === me?.id} onChange={p => altera(u.id, { papel: p })} style={{ width: 150 }} options={['admin', 'editor', 'leitor'].map(p => ({ value: p, label: PAPEL[p] }))} /> },
          { title: 'Situação', render: (_: any, u: any) => u.pendente ? <Tag color="gold">Convite pendente</Tag> : u.ativo ? <Tag color="green">Ativo</Tag> : <Tag>Desativado</Tag> },
          { title: '', render: (_: any, u: any) => <Space><Button size="small" onClick={() => gerar(u.id)}>Link de senha</Button>{u.id !== me?.id && <Button size="small" onClick={() => altera(u.id, { ativo: u.ativo ? 0 : 1 })}>{u.ativo ? 'Desativar' : 'Reativar'}</Button>}</Space> },
        ]} />
    </div>
  );
}

export function Conta() {
  const me = useAuth(s => s.user); const [form] = Form.useForm();
  const salvar = async (v: any) => { try { await post('/conta/senha', v); message.success('Senha alterada'); form.resetFields(); } catch (e: any) { message.error(e.message); } };
  return (
    <div>
      <div className="cabeca"><div><h1>Minha conta</h1><p>{me?.email} · {PAPEL[me?.papel || 'leitor']}</p></div></div>
      <Card title="Trocar senha" style={{ maxWidth: 460 }}>
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Form.Item name="atual" label="Senha atual" rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item>
          <Form.Item name="nova" label="Nova senha" rules={[{ required: true }, { min: 8, message: 'Mínimo de 8 caracteres' }, { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: 'Use letras e números' }]}><Input.Password autoComplete="new-password" /></Form.Item>
          <Button type="primary" htmlType="submit">Salvar</Button>
        </Form>
      </Card>
    </div>
  );
}
