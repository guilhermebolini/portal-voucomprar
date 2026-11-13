// Telas de acesso no mesmo padrão dos sistemas do Bolinão: um cartão central, logo em cima,
// título curto, uma linha de ajuda e o formulário. Nada do portal aparece antes do login.
import { useEffect, useRef, useState } from 'react';
import { Form, Input, Button, Alert, Spin } from 'antd';
import type { InputRef } from 'antd';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { get, post } from '@/lib/api';
import { carregaEstado, useAuth } from '@/lib/store';

function Cartao({ titulo, sub, children }: { titulo: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  useEffect(() => { document.title = `${titulo} · Portal Vou Comprar`; }, [titulo]);
  return (
    <main className="acesso">
      <div className="acesso-cartao">
        <div className="acesso-logo"><img src="/logo.svg" alt="" /><span>Vou Comprar<small>Portal de avaliação</small></span></div>
        <h1>{titulo}</h1>
        {sub && <p className="acesso-sub">{sub}</p>}
        {children}
      </div>
      <p className="acesso-rodape">Acesso restrito. Dados confidenciais.</p>
    </main>
  );
}

const senhaRegra = [{ required: true, message: 'Informe a senha' }, { min: 8, message: 'Pelo menos 8 caracteres' }, { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: 'Use letras e números' }];
const repita = [{ required: true, message: 'Repita a senha' }, ({ getFieldValue }: any) => ({ validator: (_: any, v: string) => v === getFieldValue('senha') ? Promise.resolve() : Promise.reject(new Error('As duas senhas não são iguais')) })];

function useEntrar() {
  const nav = useNavigate(); const qc = useQueryClient(); const loc = useLocation();
  return async () => { qc.clear(); await carregaEstado(); nav((loc.state as any)?.de || '/painel', { replace: true }); };
}

export function Login() {
  const [erro, setErro] = useState(''); const [load, setLoad] = useState(false);
  const precisa = useAuth(s => s.precisaConfigurar);
  const entrar = useEntrar(); const nav = useNavigate();
  const [form] = Form.useForm(); const senhaRef = useRef<InputRef>(null);
  if (precisa) return <Cartao titulo="Portal ainda não configurado" sub="Abra o link de primeiro acesso que você recebeu para criar o administrador." />;
  const enviar = async (v: any) => {
    setErro(''); setLoad(true);
    try { await post('/auth/login', v); await entrar(); }
    catch (e: any) { setErro(e.message); setLoad(false); setTimeout(() => senhaRef.current?.select(), 0); }
  };
  return (
    <Cartao titulo="Entrar no portal" sub="Use o seu e-mail e a senha que você criou pelo convite.">
      <Form form={form} layout="vertical" onFinish={enviar} requiredMark={false} size="large" className="acesso-form">
        <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email', message: 'Informe um e-mail válido' }]}><Input autoComplete="username" autoCapitalize="off" spellCheck={false} autoFocus inputMode="email" /></Form.Item>
        <Form.Item name="senha" label="Senha" rules={[{ required: true, message: 'Informe a senha' }]}><Input.Password ref={senhaRef} autoComplete="current-password" /></Form.Item>
        {erro && <Alert type="error" message={erro} showIcon style={{ marginBottom: 16 }} />}
        <Button type="primary" htmlType="submit" block loading={load}>Entrar</Button>
        <Button type="link" block style={{ marginTop: 8 }} onClick={() => nav('/esqueci', { state: { email: form.getFieldValue('email') } })}>Esqueci minha senha</Button>
      </Form>
    </Cartao>
  );
}

export function Esqueci() {
  const loc = useLocation(); const nav = useNavigate();
  const [msg, setMsg] = useState<{ t: 'success' | 'error'; m: string } | null>(null);
  const [load, setLoad] = useState(false); const [espera, setEspera] = useState(false); const [enviado, setEnviado] = useState(false);
  const enviar = async (v: any) => {
    setLoad(true); setMsg(null);
    try { const r = await post('/auth/esqueci', v); setMsg({ t: 'success', m: r.mensagem }); setEnviado(true); setEspera(true); setTimeout(() => setEspera(false), 20000); }
    catch (e: any) { setMsg({ t: 'error', m: e.message }); }
    finally { setLoad(false); }
  };
  return (
    <Cartao titulo="Recuperar senha" sub="Enviamos um link para o seu e-mail. Por ele você cria uma senha nova.">
      <Form layout="vertical" onFinish={enviar} requiredMark={false} size="large" className="acesso-form" initialValues={{ email: (loc.state as any)?.email || '' }}>
        <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email', message: 'Informe um e-mail válido' }]}><Input autoComplete="username" autoCapitalize="off" spellCheck={false} autoFocus inputMode="email" /></Form.Item>
        {msg && <Alert type={msg.t} message={msg.m} showIcon style={{ marginBottom: 16 }} />}
        <Button type="primary" htmlType="submit" block loading={load} disabled={espera}>{enviado ? 'Enviar de novo' : 'Enviar link'}</Button>
        <Button block style={{ marginTop: 8 }} onClick={() => nav('/login')}>Voltar para entrar</Button>
      </Form>
    </Cartao>
  );
}

export function Redefinir() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const token = sp.get('token') || '';
  const [info, setInfo] = useState<{ tipo: string; nome: string; email: string } | null>(null);
  const [vencido, setVencido] = useState(''); const [erro, setErro] = useState(''); const [load, setLoad] = useState(false);
  const entrar = useEntrar();
  useEffect(() => { get('/auth/link', { token }).then(setInfo).catch((e: any) => setVencido(e.message)); }, [token]);
  if (vencido) return (
    <Cartao titulo="Link vencido" sub={vencido}>
      <Button type="primary" size="large" block style={{ marginTop: 20 }} onClick={() => nav('/esqueci', { replace: true })}>Pedir um link novo</Button>
      <Button size="large" block style={{ marginTop: 8 }} onClick={() => nav('/login', { replace: true })}>Entrar</Button>
    </Cartao>
  );
  if (!info) return <Cartao titulo="Conferindo o link…"><div style={{ textAlign: 'center', padding: 16 }}><Spin /></div></Cartao>;
  const convite = info.tipo === 'convite';
  const primeiro = (info.nome || '').split(' ')[0];
  const enviar = async (v: any) => {
    setErro(''); setLoad(true);
    try { await post('/auth/redefinir', { token, senha: v.senha }); await entrar(); }
    catch (e: any) { setErro(e.message); setLoad(false); }
  };
  return (
    <Cartao titulo={convite ? `Bem-vindo${primeiro ? ', ' + primeiro : ''}` : `Senha nova${primeiro ? ', ' + primeiro : ''}`}
      sub={<>{convite ? 'Crie a senha que você vai usar para entrar.' : 'Escolha a sua senha nova.'} Seu login: <b>{info.email}</b>.</>}>
      <Form layout="vertical" onFinish={enviar} requiredMark={false} size="large" className="acesso-form">
        <input type="text" autoComplete="username" value={info.email} hidden readOnly />
        <Form.Item name="senha" label="Nova senha" rules={senhaRegra} extra="Pelo menos 8 caracteres, com letras e números."><Input.Password autoComplete="new-password" autoFocus /></Form.Item>
        <Form.Item name="senha2" label="Repita a nova senha" dependencies={['senha']} rules={repita}><Input.Password autoComplete="new-password" /></Form.Item>
        {erro && <Alert type="error" message={erro} showIcon style={{ marginBottom: 16 }} />}
        <Button type="primary" htmlType="submit" block loading={load}>Salvar e entrar</Button>
      </Form>
    </Cartao>
  );
}

export function Configurar() {
  const [sp] = useSearchParams(); const [erro, setErro] = useState(''); const [load, setLoad] = useState(false);
  const precisa = useAuth(s => s.precisaConfigurar); const nav = useNavigate();
  const entrar = useEntrar();
  if (!precisa) return (
    <Cartao titulo="Portal já configurado" sub="O administrador já foi criado. Entre com o seu e-mail e senha.">
      <Button type="primary" size="large" block style={{ marginTop: 20 }} onClick={() => nav('/login', { replace: true })}>Entrar</Button>
    </Cartao>
  );
  const enviar = async (v: any) => {
    setErro(''); setLoad(true);
    try { await post('/auth/configurar', { nome: v.nome, email: v.email, senha: v.senha, token: sp.get('token') }); await entrar(); }
    catch (e: any) { setErro(e.message); setLoad(false); }
  };
  return (
    <Cartao titulo="Primeiro acesso" sub="Crie o administrador do portal. Este link só funciona uma vez.">
      <Form layout="vertical" onFinish={enviar} requiredMark={false} size="large" className="acesso-form">
        <Form.Item name="nome" label="Seu nome" rules={[{ required: true, message: 'Informe o nome' }]}><Input autoFocus autoComplete="name" /></Form.Item>
        <Form.Item name="email" label="E-mail de login" rules={[{ required: true, type: 'email', message: 'Informe um e-mail válido' }]}><Input autoComplete="username" autoCapitalize="off" spellCheck={false} inputMode="email" /></Form.Item>
        <Form.Item name="senha" label="Senha" rules={senhaRegra} extra="Pelo menos 8 caracteres, com letras e números."><Input.Password autoComplete="new-password" /></Form.Item>
        <Form.Item name="senha2" label="Repita a senha" dependencies={['senha']} rules={repita}><Input.Password autoComplete="new-password" /></Form.Item>
        {erro && <Alert type="error" message={erro} showIcon style={{ marginBottom: 16 }} />}
        <Button type="primary" htmlType="submit" block loading={load}>Criar administrador e entrar</Button>
      </Form>
    </Cartao>
  );
}
