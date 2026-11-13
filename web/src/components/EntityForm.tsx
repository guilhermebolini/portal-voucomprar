import { useEffect, useState } from 'react';
import { Drawer, Form, Input, InputNumber, Select, DatePicker, Button, Popconfirm, Space, Alert, Typography, Spin } from 'antd';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { get, post, put, del, type Entity, type Field } from '@/lib/api';
import { useAuth, useRefs, podeEditar } from '@/lib/store';
import { dataHora } from '@/lib/fmt';

interface Props { ent: string; entity: Entity; id: number | null; preset?: Record<string, any>; open: boolean; onClose: () => void; onSaved?: () => void }

export default function EntityForm({ ent, entity, id, preset = {}, open, onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [hist, setHist] = useState<any[]>([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const user = useAuth(s => s.user);
  const refs = useRefs();
  const qc = useQueryClient();
  const ro = !podeEditar(user) || (ent === 'parametros' && user?.papel !== 'admin');

  useEffect(() => {
    if (!open) return;
    setErro(''); form.resetFields();
    const preenche = (reg: any) => {
      const v: any = {};
      for (const f of entity.fields) {
        const x = reg[f.name];
        if (x == null) continue;
        if (f.type === 'date') v[f.name] = dayjs(x);
        else if (f.type === 'month') v[f.name] = dayjs(x + '-01');
        else v[f.name] = x;
      }
      form.setFieldsValue(v);
    };
    if (id) {
      setCarregando(true);
      get(`/e/${ent}/${id}`).then(r => { preenche(r); setHist(r._historico || []); }).catch(e => setErro(e.message)).finally(() => setCarregando(false));
    } else { setHist([]); preenche(preset); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id, ent]);

  const salvar = async () => {
    try {
      const vals = await form.validateFields();
      const body: any = {};
      for (const f of entity.fields) {
        let x = vals[f.name];
        if (x === undefined) x = null;
        if (x && f.type === 'date') x = x.format('YYYY-MM-DD');
        if (x && f.type === 'month') x = x.format('YYYY-MM');
        body[f.name] = x;
      }
      setSalvando(true);
      if (id) await put(`/e/${ent}/${id}`, body); else await post(`/e/${ent}`, body);
      qc.invalidateQueries();
      onSaved?.(); onClose();
    } catch (e: any) { if (e?.message) setErro(e.message); } finally { setSalvando(false); }
  };
  const excluir = async () => {
    try { await del(`/e/${ent}/${id}`); qc.invalidateQueries(); onSaved?.(); onClose(); } catch (e: any) { setErro(e.message); }
  };

  // opções que dependem de outro campo (ex.: o Tipo da dívida depende da Grandeza)
  const dep = entity?.fields.find(f => f.dependeDe)?.dependeDe;
  const valorDep = Form.useWatch(dep || '__nada__', form);
  const opcoes = (f: Field) => (f.dependeDe && f.opcoesPor && valorDep && f.opcoesPor[valorDep]) ? f.opcoesPor[valorDep] : f.options!;
  const input = (f: Field) => {
    switch (f.type) {
      case 'select': return <Select allowClear showSearch options={opcoes(f).map(o => ({ value: o, label: o }))} />;
      case 'ref': return <Select allowClear showSearch optionFilterProp="label" options={(f.ref === 'unidades' ? refs.unidades : refs.fornecedores).map((o: any) => ({ value: o.id, label: o.nome || o.codigo }))} />;
      case 'longtext': return <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} />;
      case 'bool': return <Select allowClear options={[{ value: 1, label: 'Sim' }, { value: 0, label: 'Não' }]} />;
      case 'date': return <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />;
      case 'month': return <DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} />;
      case 'money': return <InputNumber style={{ width: '100%' }} prefix="R$" decimalSeparator="," step={100} />;
      case 'number': return <InputNumber style={{ width: '100%' }} decimalSeparator="," />;
      case 'int': return <InputNumber style={{ width: '100%' }} precision={0} />;
      default: return <Input />;
    }
  };
  const largo = (f: Field) => f.type === 'longtext' || ['titulo', 'nome', 'endereco', 'descricao'].includes(f.name);

  return (
    <Drawer open={open} onClose={onClose} width={640} destroyOnHidden
      title={<div>{id ? (ro ? '' : 'Editar ') + entity.singular : 'Novo: ' + entity.singular}<div style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>{entity.label}{id ? ' · #' + id : ''}</div></div>}
      footer={<div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>{id && !ro && <Popconfirm title="Excluir este registro?" description="A exclusão fica no histórico." okText="Excluir" cancelText="Cancelar" onConfirm={excluir}><Button danger>Excluir</Button></Popconfirm>}</div>
        <Space><Button onClick={onClose}>{ro ? 'Fechar' : 'Cancelar'}</Button>{!ro && <Button type="primary" loading={salvando} onClick={salvar}>Salvar</Button>}</Space></div>}>
      {erro && <Alert type="error" message={erro} showIcon style={{ marginBottom: 16 }} />}
      <Spin spinning={carregando}>
        <Form form={form} layout="vertical" disabled={ro} requiredMark>
          <div className="duas">
            {entity.fields.map(f => (
              <Form.Item key={f.name} name={f.name} label={f.label} extra={f.help} rules={f.required ? [{ required: true, message: 'Obrigatório' }] : []} style={largo(f) ? { gridColumn: '1 / -1' } : undefined}>
                {input(f)}
              </Form.Item>
            ))}
          </div>
        </Form>
        {hist.length > 0 && <div style={{ marginTop: 8 }}><Typography.Text strong>Histórico</Typography.Text>
          {hist.map((h, i) => <div key={i} style={{ fontSize: 12, color: '#6b7280' }}>{h.acao} por {h.usuario} em {dataHora(h.criado_em)}</div>)}</div>}
      </Spin>
    </Drawer>
  );
}
