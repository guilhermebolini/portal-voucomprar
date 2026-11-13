import { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { post } from '@/lib/api';
import { carregaEstado, useAuth } from '@/lib/store';
import { Marca } from '@/components/AppLayout';

function Tela({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-lado">
        <Marca />
        <div><h1>Os números da rede, num lugar só.</h1><p>Lojas, dívidas, folha, aluguéis, despesas, vendas e planos de ação para a avaliação do negócio.</p></div>
        <p style={{ fontSize: 12 }}>Acesso restrito. Dados confidenciais.</p>
      </div>
      <div className="auth-form"><div className="auth-box"><h2>{titulo}</h2><p className="sub">{sub}</p>{children}</div></div>
    </div>
  );
}

const senhaRegra = [{ required: true, message: 'Informe a senha' }, { min: 8, message: 'Mínimo de 8 caracteres' }, { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: 'Use letras e números' }];

function useEntrar() {
  const nav = useNavigate(); const qc = useQueryClient();
  return async () => { qc.clear(); await carregaEstado(); nav('/painel', { replace: true }); };
}

export function Login() {
  const [erro, setErro] = useState(''); const [load, setLoad] = useState(false);
  const precisa = useAuth(s => s.precisaConfigurar);
  const entrar = useEntrar();
  if (precisa) return <Tela titulo="Portal ainda não configurado" sub="Use o link de primeiro acesso que você recebeu."><span /></Tela>;
  const enviar = async (v: any) => { setErro(''); setLoad(true); try { await post('/auth/login', v); await entrar(); } catch (e: any) { setErro(e.message); } finally { setLoad(false); } };
  return (
    <Tela titulo="Entrar" sub="Use seu e-mail e senha.">
      {erro && <Alert type="error" message={erro} showIcon style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={enviar} requiredMark={false}>
        <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email', message: 'E-mail inválido' }]}><Input size="large" autoComplete="username" autoFocus /></Form.Item>
        <Form.Item name="senha" label="Senha" rules={[{ required: true, message: 'Informe a senha' }]}><Input.Password size="large" autoComplete="current-password" /></Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={load}>Entrar</Button>
        <p style={{ textAlign: 'center', marginTop: 16 }}><Link to="/esqueci">Esqueci minha senha</Link></p>
      </Form>
    </Tela>
  );
}

export function Esqueci() {
  const [msg, setMsg] = useState<{ t: 'success' | 'error'; m: string } | null>(null); const [load, setLoad] = useState(false);
  const enviar = async (v: any) => { setLoad(true); try { const r = await post('/auth/esqueci', v); setMsg({ t: 'success', m: r.mensagem }); } catch (e: any) { setMsg({ t: 'error', m: e.message }); } finally { setLoad(false); } };
  return (
    <Tela titulo="Recuperar senha" sub="Informe seu e-mail. Enviamos um link para criar uma nova senha.">
      {msg && <Alert type={msg.t} message={msg.m} showIcon style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={enviar} requiredMark={false}>
        <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email', message: 'E-mail inválido' }]}><Input size="large" autoFocus /></Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={load}>Enviar link</Button>
        <p style={{ textAlign: 'center', marginTop: 16 }}><Link to="/login">Voltar ao login</Link></p>
      </Form>
    </Tela>
  );
}

export function Redefinir() {
  const [sp] = useSearchParams(); const [erro, setErro] = useState(''); const [load, setLoad] = useState(false);
  const entrar = useEntrar();
  const enviar = async (v: any) => { setErro(''); setLoad(true); try { await post('/auth/redefinir', { token: sp.get('token'), senha: v.senha }); await entrar(); } catch (e: any) { setErro(e.message); } finally { setLoad(false); } };
  return (
    <Tela titulo={sp.get('convite') ? 'Criar sua senha' : 'Nova senha'} sub="Mínimo de 8 caracteres, com letras e números.">
      {erro && <Alert type="error" message={erro} showIcon style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={enviar} requiredMark={false}>
        <Form.Item name="senha" label="Nova senha" rules={senhaRegra}><Input.Password size="large" autoComplete="new-password" autoFocus /></Form.Item>
        <Form.Item name="senha2" label="Repita a senha" dependencies={['senha']} rules={[{ required: true, message: 'Repita a senha' }, ({ getFieldValue }) => ({ validator: (_, v) => v === getFieldValue('senha') ? Promise.resolve() : Promise.reject(new Error('As senhas não conferem')) })]}><Input.Password size="large" autoComplete="new-password" /></Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={load}>Salvar e entrar</Button>
      </Form>
    </Tela>
  );
}

export function Configurar() {
  const [sp] = useSearchParams(); const [erro, setErro] = useState(''); const [load, setLoad] = useState(false);
  const entrar = useEntrar();
  const enviar = async (v: any) => { setErro(''); setLoad(true); try { await post('/auth/configurar', { ...v, token: sp.get('token') }); await entrar(); } catch (e: any) { setErro(e.message); } finally { setLoad(false); } };
  return (
    <Tela titulo="Primeiro acesso" sub="Cadastre o administrador do portal. Este link só funciona uma vez.">
      {erro && <Alert type="error" message={erro} showIcon style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={enviar} requiredMark={false}>
        <Form.Item name="nome" label="Seu nome" rules={[{ required: true, message: 'Informe o nome' }]}><Input size="large" autoFocus /></Form.Item>
        <Form.Item name="email" label="E-mail de login" rules={[{ required: true, type: 'email', message: 'E-mail inválido' }]}><Input size="large" autoComplete="username" /></Form.Item>
        <Form.Item name="senha" label="Senha" rules={senhaRegra} extra="Mínimo de 8 caracteres, com letras e números."><Input.Password size="large" autoComplete="new-password" /></Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={load}>Criar administrador</Button>
      </Form>
    </Tela>
  );
}
