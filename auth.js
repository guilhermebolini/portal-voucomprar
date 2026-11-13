'use strict';
// Login por e-mail + senha, recuperação de senha por e-mail, convites e papéis.
// Papéis: admin (tudo + usuários), editor (consulta e edita dados), leitor (só consulta).
const crypto = require('crypto');
let nodemailer = null; try { nodemailer = require('nodemailer'); } catch (e) { /* opcional */ }

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE = 'vc_sess';
const SESSION_DAYS = 7;
const PAPEIS = ['admin', 'editor', 'leitor'];

// ---- senha (scrypt) ----
function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(senha, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}
function confereSenha(senha, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, s, h] = stored.split('$');
  const calc = crypto.scryptSync(senha, Buffer.from(s, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(calc, Buffer.from(h, 'hex'));
}
function senhaFraca(s) {
  if (typeof s !== 'string' || s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return 'Use letras e números na senha.';
  return null;
}

// ---- sessão (cookie assinado) ----
const b64 = s => Buffer.from(s).toString('base64url');
function assina(payload) {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function verifica(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const exp = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}
function cookies(req) {
  const out = {}; (req.headers.cookie || '').split(';').forEach(c => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return out;
}
const versaoSenha = hash => crypto.createHash('sha256').update(hash || '').digest('hex').slice(0, 12);
function setSessao(req, res, u) {
  const token = assina({ uid: u.id, v: versaoSenha(u.senha_hash), exp: Date.now() + SESSION_DAYS * 864e5 });
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`);
}

// ---- limite de tentativas ----
const tentativas = new Map();
function limitado(chave, max = 8, janelaMs = 15 * 60e3) {
  const agora = Date.now();
  const lst = (tentativas.get(chave) || []).filter(t => agora - t < janelaMs);
  lst.push(agora); tentativas.set(chave, lst);
  return lst.length > max;
}

// ---- e-mail ----
const smtpUser = () => process.env.SMTP_USER || 'naoresponda@bolinao.com.br';
function smtpConfigurado() { return !!(nodemailer && process.env.SMTP_PASS); }
async function enviaEmail(para, assunto, html) {
  if (!smtpConfigurado()) { console.log(`[email não configurado] para=${para} assunto=${assunto}`); return false; }
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com', port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: smtpUser(), pass: process.env.SMTP_PASS },
  });
  await t.sendMail({ from: process.env.SMTP_FROM || `Portal Vou Comprar <${smtpUser()}>`, to: para, subject: assunto, html });
  return true;
}
function baseUrl(req) { return process.env.APP_URL || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}`; }
function emailHtml(titulo, texto, link, botao) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1b1b1b">
  <h2 style="margin:0 0 12px">${titulo}</h2><p style="line-height:1.5">${texto}</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#d71920;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${botao}</a></p>
  <p style="font-size:12px;color:#666">Se o botão não funcionar, copie este endereço: ${link}</p>
  <p style="font-size:12px;color:#666">Portal Vou Comprar · acesso restrito</p></div>`;
}

async function criaToken(pool, usuarioId, tipo, horas) {
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await pool.query('INSERT INTO senha_tokens (usuario_id, token_hash, tipo, expira_em) VALUES (?,?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))', [usuarioId, hash, tipo, horas]);
  return token;
}

const normEmail = e => String(e || '').trim().toLowerCase();
const emailValido = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const publico = u => ({ id: u.id, email: u.email, nome: u.nome, papel: u.papel });

function routes(app, pool, wrap) {
  app.get('/api/auth/estado', wrap(async (req, res) => {
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM usuarios');
    let user = null;
    const p = verifica(cookies(req)[COOKIE]);
    if (p) {
      const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [p.uid]);
      if (rows.length && versaoSenha(rows[0].senha_hash) === p.v) user = publico(rows[0]);
    }
    res.json({ precisa_configurar: n === 0, user, email_ativo: smtpConfigurado() });
  }));

  // Primeiro acesso: cria o administrador. Exige o SETUP_TOKEN (variável de ambiente) e só funciona sem nenhum usuário.
  app.post('/api/auth/configurar', wrap(async (req, res) => {
    const { token, nome, email, senha } = req.body || {};
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM usuarios');
    if (n > 0) return res.status(400).json({ erro: 'O portal já foi configurado. Use o login.' });
    if (!process.env.SETUP_TOKEN || limitado('setup:' + req.ip, 10) || typeof token !== 'string' || token.length !== process.env.SETUP_TOKEN.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(process.env.SETUP_TOKEN)))
      return res.status(403).json({ erro: 'Link de primeiro acesso inválido.' });
    const em = normEmail(email);
    if (!emailValido(em)) return res.status(400).json({ erro: 'E-mail inválido.' });
    const fraca = senhaFraca(senha); if (fraca) return res.status(400).json({ erro: fraca });
    const h = hashSenha(senha);
    const [r] = await pool.query('INSERT INTO usuarios (email, nome, senha_hash, papel) VALUES (?,?,?,?)', [em, String(nome || '').slice(0, 120), h, 'admin']);
    setSessao(req, res, { id: r.insertId, senha_hash: h });
    res.json({ ok: true });
  }));

  app.post('/api/auth/login', wrap(async (req, res) => {
    const em = normEmail(req.body && req.body.email); const senha = req.body && req.body.senha;
    if (limitado('login:' + req.ip) || limitado('login:' + em, 8)) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde 15 minutos.' });
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [em]);
    if (!rows.length || !confereSenha(String(senha || ''), rows[0].senha_hash)) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    setSessao(req, res, rows[0]);
    res.json({ ok: true, user: publico(rows[0]) });
  }));

  app.post('/api/auth/sair', (req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  });

  app.post('/api/auth/esqueci', wrap(async (req, res) => {
    const em = normEmail(req.body && req.body.email);
    if (limitado('esqueci:' + req.ip, 5) || limitado('esqueci:' + em, 3, 60 * 60e3)) return res.status(429).json({ erro: 'Muitas solicitações. Tente mais tarde.' });
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [em]);
    if (rows.length) {
      const token = await criaToken(pool, rows[0].id, 'reset', 2);
      const link = `${baseUrl(req)}/redefinir?token=${token}`;
      await enviaEmail(em, 'Redefinir sua senha · Portal Vou Comprar', emailHtml('Redefinir senha', 'Recebemos um pedido para redefinir a sua senha do Portal Vou Comprar. O link vale por 2 horas.', link, 'Criar nova senha')).catch(e => console.error('email', e.message));
    }
    res.json({ ok: true, mensagem: 'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.' });
  }));

  app.post('/api/auth/redefinir', wrap(async (req, res) => {
    const { token, senha } = req.body || {};
    if (limitado('redef:' + req.ip, 10)) return res.status(429).json({ erro: 'Muitas tentativas.' });
    const fraca = senhaFraca(senha); if (fraca) return res.status(400).json({ erro: fraca });
    const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
    const [rows] = await pool.query('SELECT * FROM senha_tokens WHERE token_hash = ? AND usado_em IS NULL AND expira_em > UTC_TIMESTAMP()', [hash]);
    if (!rows.length) return res.status(400).json({ erro: 'Link inválido ou expirado. Peça um novo.' });
    const h = hashSenha(senha);
    await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [h, rows[0].usuario_id]);
    await pool.query('UPDATE senha_tokens SET usado_em = UTC_TIMESTAMP() WHERE usuario_id = ? AND usado_em IS NULL', [rows[0].usuario_id]);
    const [u] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [rows[0].usuario_id]);
    setSessao(req, res, u[0]);
    res.json({ ok: true });
  }));

  // ---- área logada: conta e usuários ----
  const requer = requireUser(pool);
  app.post('/api/conta/senha', wrap(requer), wrap(async (req, res) => {
    const { atual, nova } = req.body || {};
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.user.id]);
    if (!confereSenha(String(atual || ''), rows[0].senha_hash)) return res.status(400).json({ erro: 'Senha atual incorreta.' });
    const fraca = senhaFraca(nova); if (fraca) return res.status(400).json({ erro: fraca });
    const h = hashSenha(nova);
    await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [h, req.user.id]);
    setSessao(req, res, { id: req.user.id, senha_hash: h });
    res.json({ ok: true });
  }));

  const soAdmin = (req, res, next) => req.user.papel === 'admin' ? next() : res.status(403).json({ erro: 'Só o administrador.' });
  app.get('/api/usuarios', wrap(requer), soAdmin, wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT id, email, nome, papel, ativo, criado_em, (senha_hash IS NULL) pendente FROM usuarios ORDER BY id');
    res.json({ usuarios: rows, email_ativo: smtpConfigurado() });
  }));

  app.post('/api/usuarios', wrap(requer), soAdmin, wrap(async (req, res) => {
    const em = normEmail(req.body.email); const papel = PAPEIS.includes(req.body.papel) ? req.body.papel : 'leitor';
    if (!emailValido(em)) return res.status(400).json({ erro: 'E-mail inválido.' });
    const [ex] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [em]);
    if (ex.length) return res.status(400).json({ erro: 'Esse e-mail já tem acesso.' });
    const [r] = await pool.query('INSERT INTO usuarios (email, nome, papel, senha_hash) VALUES (?,?,?,NULL)', [em, String(req.body.nome || '').slice(0, 120), papel]);
    const token = await criaToken(pool, r.insertId, 'convite', 72);
    const link = `${baseUrl(req)}/redefinir?token=${token}&convite=1`;
    const enviado = await enviaEmail(em, 'Convite · Portal Vou Comprar', emailHtml('Você foi convidado', `${req.user.nome || req.user.email} liberou seu acesso ao Portal Vou Comprar. Crie sua senha pelo botão abaixo (vale por 3 dias).`, link, 'Criar minha senha')).catch(() => false);
    res.json({ ok: true, enviado, link });
  }));

  app.put('/api/usuarios/:id', wrap(requer), soAdmin, wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id && (req.body.papel && req.body.papel !== 'admin' || req.body.ativo === 0)) return res.status(400).json({ erro: 'Você não pode tirar o seu próprio acesso de administrador.' });
    const upd = {};
    if (PAPEIS.includes(req.body.papel)) upd.papel = req.body.papel;
    if (req.body.ativo === 0 || req.body.ativo === 1) upd.ativo = req.body.ativo;
    if (req.body.nome !== undefined) upd.nome = String(req.body.nome).slice(0, 120);
    if (Object.keys(upd).length) await pool.query('UPDATE usuarios SET ? WHERE id = ?', [upd, id]);
    res.json({ ok: true });
  }));

  // gera um novo link de criação/redefinição de senha (útil se o e-mail não chegar)
  app.post('/api/usuarios/:id/link', wrap(requer), soAdmin, wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ erro: 'Não encontrado' });
    const token = await criaToken(pool, rows[0].id, 'reset', 72);
    const link = `${baseUrl(req)}/redefinir?token=${token}`;
    const enviado = await enviaEmail(rows[0].email, 'Criar/redefinir senha · Portal Vou Comprar', emailHtml('Acesso ao Portal Vou Comprar', 'Use o botão abaixo para criar uma nova senha (vale por 3 dias).', link, 'Criar senha')).catch(() => false);
    res.json({ ok: true, enviado, link });
  }));
}

function requireUser(pool) {
  return async (req, res, next) => {
    const p = verifica(cookies(req)[COOKIE]);
    if (!p) return res.status(401).json({ erro: 'Faça login.' });
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [p.uid]);
    if (!rows.length || versaoSenha(rows[0].senha_hash) !== p.v) return res.status(401).json({ erro: 'Sessão expirada. Faça login.' });
    req.user = publico(rows[0]);
    // escrita só para editor/admin (as rotas checam detalhes)
    next();
  };
}

module.exports = { routes, requireUser };
