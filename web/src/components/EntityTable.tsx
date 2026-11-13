import { useMemo, useState } from 'react';
import { Table, Input, Select, Button, Space, Tag, Typography } from 'antd';
import { PlusOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Field } from '@/lib/api';
import { useAuth, useLista, useMeta, useRefs, podeEditar } from '@/lib/store';
import { brl2, num, dataBR, mesBR, corTag } from '@/lib/fmt';
import EntityForm from './EntityForm';

interface Props { ent: string; filtroFixo?: Record<string, any>; titulo?: string; descricao?: React.ReactNode; colunas?: string[]; compacto?: boolean }

export function useFmtCampo() {
  const refs = useRefs();
  return (f: Field, v: any): React.ReactNode => {
    if (v == null || v === '') return <span style={{ color: '#b0b5be' }}>—</span>;
    switch (f.type) {
      case 'money': return brl2(v);
      case 'number': return num(v, 2);
      case 'int': return f.name === 'ano' ? v : num(v);
      case 'date': return dataBR(v);
      case 'month': return mesBR(v);
      case 'bool': return v ? 'Sim' : 'Não';
      case 'ref': return refs.nome(f.ref, v);
      case 'select': return <Tag color={corTag(v)}>{v}</Tag>;
      default: return String(v);
    }
  };
}

export default function EntityTable({ ent, filtroFixo = {}, titulo, descricao, colunas, compacto }: Props) {
  const meta = useMeta();
  const user = useAuth(s => s.user);
  const refs = useRefs();
  const fmt = useFmtCampo();
  const nav = useNavigate();
  const lista = useLista(ent, filtroFixo);
  const [q, setQ] = useState('');
  const chave = 'filtros:' + ent + JSON.stringify(filtroFixo);
  const [filtros, setFiltros] = useState<Record<string, any>>(() => { try { return JSON.parse(localStorage.getItem(chave) || '{}'); } catch { return {}; } });
  const [form, setForm] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const e = meta.data?.entities[ent];
  const rows = lista.data || [];

  const cols = useMemo(() => !e ? [] : (colunas ? colunas.map(n => e.fields.find(f => f.name === n)!).filter(Boolean) : e.fields.filter(f => f.list)), [e, colunas]);
  const filtraveis = useMemo(() => !e ? [] : e.fields.filter(f => (f.type === 'select' || f.type === 'ref' || f.name === 'ano' || f.name === 'competencia') && f.list && !(f.name in filtroFixo)), [e, filtroFixo]);
  const txt = (f: Field, v: any) => f.type === 'ref' ? refs.nome(f.ref, v) : v;

  const filtrados = useMemo(() => {
    if (!e) return [];
    const ql = q.toLowerCase();
    return rows.filter(r => Object.entries(filtros).every(([k, v]) => v == null || v === '' || String(r[k] ?? '') === String(v)))
      .filter(r => !ql || e.fields.some(f => String(txt(f, r[f.name]) ?? '').toLowerCase().includes(ql)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filtros, q, e, refs.unidades, refs.fornecedores]);

  if (!e) return null;
  const isNum = (f: Field) => ['money', 'number', 'int'].includes(f.type) && f.name !== 'ano';
  const podeEscrever = podeEditar(user) && !(ent === 'parametros' && user?.papel !== 'admin');

  const setFiltro = (k: string, v: any) => { const n = { ...filtros, [k]: v }; setFiltros(n); try { localStorage.setItem(chave, JSON.stringify(n)); } catch { /* ok */ } };

  const exportaCSV = () => {
    const cab = e.fields.map(f => f.label);
    const linhas = filtrados.map(r => e.fields.map(f => { let v = txt(f, r[f.name]); if (v == null) v = ''; if (typeof v === 'number') v = String(v).replace('.', ','); return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'));
    const blob = new Blob(['﻿' + [cab.join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${ent}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const columns = cols.map(f => ({
    key: f.name, dataIndex: f.name, title: f.label, align: (isNum(f) ? 'right' : 'left') as 'right' | 'left',
    render: (v: any) => fmt(f, v),
    sorter: (a: any, b: any) => { const va = txt(f, a[f.name]), vb = txt(f, b[f.name]); if (va == null) return -1; if (vb == null) return 1; return typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt', { numeric: true }); },
    ellipsis: f.type === 'longtext',
  }));
  const somas = cols.map(f => f.sum ? filtrados.reduce((s, r) => s + (Number(r[f.name]) || 0), 0) : null);

  return (
    <div>
      {titulo && <div className="cabeca"><div><h1 className={compacto ? 'h2' : ''}>{titulo}</h1>{descricao && <p>{descricao}</p>}</div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={exportaCSV}>Exportar CSV</Button>
          {podeEscrever && <Button icon={<UploadOutlined />} onClick={() => nav('/importar?tabela=' + ent)}>Importar planilha</Button>}
          {podeEscrever && <Button type="primary" icon={<PlusOutlined />} onClick={() => setForm({ open: true, id: null })}>Novo</Button>}
        </Space></div>}
      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search allowClear placeholder="Buscar…" value={q} onChange={ev => setQ(ev.target.value)} style={{ width: 240 }} />
        {filtraveis.map(f => {
          const vals = [...new Set(rows.map(r => r[f.name]).filter(v => v != null && v !== ''))];
          vals.sort((a, b) => String(txt(f, a)).localeCompare(String(txt(f, b)), 'pt', { numeric: true }) * (f.name === 'ano' || f.type === 'month' ? -1 : 1));
          return <Select key={f.name} allowClear placeholder={f.label} value={filtros[f.name] ?? undefined} onChange={v => setFiltro(f.name, v)} style={{ minWidth: 160 }}
            options={vals.map(v => ({ value: v, label: f.type === 'month' ? mesBR(v) : String(txt(f, v)) }))} popupMatchSelectWidth={false} />;
        })}
      </Space>
      <Table rowKey="id" size="middle" loading={lista.isLoading} dataSource={filtrados} columns={columns} scroll={{ x: 'max-content' }}
        pagination={filtrados.length > 50 ? { pageSize: 50, showSizeChanger: true } : false}
        onRow={r => ({ onClick: () => setForm({ open: true, id: r.id }), style: { cursor: 'pointer' } })}
        summary={() => somas.some(v => v != null) ? <Table.Summary fixed><Table.Summary.Row>{cols.map((f, i) => <Table.Summary.Cell key={f.name} index={i} align={isNum(f) ? 'right' : 'left'}><b>{i === 0 ? 'Total' : somas[i] != null ? (f.type === 'money' ? brl2(somas[i]) : num(somas[i])) : ''}</b></Table.Summary.Cell>)}</Table.Summary.Row></Table.Summary> : null} />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{filtrados.length} de {rows.length} registros</Typography.Text>
      <EntityForm ent={ent} entity={e} id={form.id} preset={filtroFixo} open={form.open} onClose={() => setForm({ open: false, id: null })} />
    </div>
  );
}
