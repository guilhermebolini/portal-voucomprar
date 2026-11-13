'use strict';
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { entities, migrate } = require('./schema');
const auth = require('./auth');
const seed = require('./seed');

const PORT = process.env.PORT || 3000;

function dbConfig() {
  if (process.env.DATABASE_URL && !process.env.DB_USER) return { uri: process.env.DATABASE_URL.replace('@localhost', '@127.0.0.1') };
  return {
    host: (!process.env.DB_HOST || process.env.DB_HOST === 'localhost') ? '127.0.0.1' : process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
}
const pool = mysql.createPool({ ...dbConfig(), waitForConnections: true, connectionLimit: 5, dateStrings: true, decimalNumbers: true, charset: 'utf8mb4' });

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Autenticação ----------
auth.routes(app, pool, wrap);

// Tudo abaixo de /api exige login
app.use('/api', wrap(auth.requireUser(pool)));

app.get('/api/meta', (req, res) => {
  res.json({ entities, user: req.user });
});

// ---------- CRUD genérico ----------
function entityOr404(req, res) {
  const e = entities[req.params.ent];
  if (!e) { res.status(404).json({ erro: 'Entidade desconhecida' }); return null; }
  return e;
}

function coerce(f, v) {
  if (v === '' || v === undefined || v === null) return null;
  switch (f.type) {
    case 'int': case 'ref': { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }
    case 'number': case 'money': {
      if (typeof v === 'string') v = v.replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
      const n = Number(v); return Number.isFinite(n) ? n : null;
    }
    case 'bool': return v === true || v === 1 || v === '1' || v === 'true' || v === 'Sim' ? 1 : 0;
    case 'date': return String(v).slice(0, 10);
    case 'month': return String(v).slice(0, 7);
    default: return String(v).slice(0, f.type === 'longtext' ? 20000 : 255);
  }
}

function pickData(e, body) {
  const data = {};
  for (const f of e.fields) if (Object.prototype.hasOwnProperty.call(body, f.name)) data[f.name] = coerce(f, body[f.name]);
  return data;
}

async function audit(entidade, id, acao, user, dados) {
  await pool.query('INSERT INTO auditoria (entidade, registro_id, acao, usuario, dados) VALUES (?,?,?,?,?)', [entidade, id, acao, user.email, JSON.stringify(dados || null)]);
}

app.get('/api/e/:ent', wrap(async (req, res) => {
  const e = entityOr404(req, res); if (!e) return;
  const where = []; const args = [];
  for (const f of e.fields) {
    const v = req.query[f.name];
    if (v !== undefined && v !== '') {
      if (v === '__null') where.push(`\`${f.name}\` IS NULL`);
      else { where.push(`\`${f.name}\` = ?`); args.push(v); }
    }
  }
  if (req.query.q) {
    const txt = e.fields.filter(f => ['text', 'longtext', 'select'].includes(f.type));
    if (txt.length) { where.push('(' + txt.map(f => `\`${f.name}\` LIKE ?`).join(' OR ') + ')'); txt.forEach(() => args.push('%' + req.query.q + '%')); }
  }
  const sql = `SELECT * FROM \`${req.params.ent}\`${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${e.order || 'id'} LIMIT 5000`;
  const [rows] = await pool.query(sql, args);
  res.json(rows);
}));

app.get('/api/e/:ent/:id', wrap(async (req, res) => {
  const e = entityOr404(req, res); if (!e) return;
  const [rows] = await pool.query(`SELECT * FROM \`${req.params.ent}\` WHERE id = ?`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Não encontrado' });
  const [hist] = await pool.query('SELECT acao, usuario, criado_em FROM auditoria WHERE entidade = ? AND registro_id = ? ORDER BY id DESC LIMIT 30', [req.params.ent, req.params.id]);
  res.json({ ...rows[0], _historico: hist });
}));

function canWrite(req, res, ent) {
  if (req.user.papel === 'leitor') { res.status(403).json({ erro: 'Seu acesso é só de leitura.' }); return false; }
  if (ent === 'parametros' && req.user.papel !== 'admin') { res.status(403).json({ erro: 'Só o administrador altera premissas.' }); return false; }
  return true;
}

function missingRequired(e, data, isNew) {
  return e.fields.filter(f => f.required && (isNew ? data[f.name] == null : (Object.prototype.hasOwnProperty.call(data, f.name) && data[f.name] == null))).map(f => f.label);
}

app.post('/api/e/:ent', wrap(async (req, res) => {
  const e = entityOr404(req, res); if (!e) return;
  if (!canWrite(req, res, req.params.ent)) return;
  const data = pickData(e, req.body || {});
  const miss = missingRequired(e, data, true);
  if (miss.length) return res.status(400).json({ erro: 'Preencha: ' + miss.join(', ') });
  data.atualizado_por = req.user.email;
  const [r] = await pool.query(`INSERT INTO \`${req.params.ent}\` SET ?`, [data]);
  await audit(req.params.ent, r.insertId, 'criou', req.user, data);
  res.json({ id: r.insertId });
}));

app.put('/api/e/:ent/:id', wrap(async (req, res) => {
  const e = entityOr404(req, res); if (!e) return;
  if (!canWrite(req, res, req.params.ent)) return;
  const data = pickData(e, req.body || {});
  const miss = missingRequired(e, data, false);
  if (miss.length) return res.status(400).json({ erro: 'Preencha: ' + miss.join(', ') });
  if (!Object.keys(data).length) return res.json({ ok: true });
  const [old] = await pool.query(`SELECT * FROM \`${req.params.ent}\` WHERE id = ?`, [req.params.id]);
  if (!old.length) return res.status(404).json({ erro: 'Não encontrado' });
  data.atualizado_por = req.user.email;
  await pool.query(`UPDATE \`${req.params.ent}\` SET ? WHERE id = ?`, [data, req.params.id]);
  const antes = {}; for (const k of Object.keys(data)) if (k !== 'atualizado_por' && String(old[0][k]) !== String(data[k])) antes[k] = { de: old[0][k], para: data[k] };
  await audit(req.params.ent, Number(req.params.id), 'editou', req.user, antes);
  res.json({ ok: true });
}));

app.delete('/api/e/:ent/:id', wrap(async (req, res) => {
  const e = entityOr404(req, res); if (!e) return;
  if (!canWrite(req, res, req.params.ent)) return;
  const [old] = await pool.query(`SELECT * FROM \`${req.params.ent}\` WHERE id = ?`, [req.params.id]);
  if (!old.length) return res.status(404).json({ erro: 'Não encontrado' });
  await pool.query(`DELETE FROM \`${req.params.ent}\` WHERE id = ?`, [req.params.id]);
  await audit(req.params.ent, Number(req.params.id), 'excluiu', req.user, old[0]);
  res.json({ ok: true });
}));

app.get('/api/auditoria', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, entidade, registro_id, acao, usuario, dados, criado_em FROM auditoria ORDER BY id DESC LIMIT 300');
  res.json(rows);
}));

// ---------- Painel ----------
async function params() {
  const [rows] = await pool.query('SELECT chave, valor FROM parametros');
  const p = {}; rows.forEach(r => { p[r.chave] = r.valor; });
  return p;
}

app.get('/api/painel', wrap(async (req, res) => {
  const p = await params();
  const versao = req.query.versao || p.versao_despesas || 'Financeiro out/26';
  const comp = req.query.competencia || p.competencia_folha || '2026-10';
  const ano = Number(req.query.ano || p.ano_base_vendas || 2026);
  const margem = Number(String(req.query.margem || p.margem_bruta_pct || 50).replace(',', '.')) / 100;

  const [unid] = await pool.query('SELECT id, codigo, nome, tipo, situacao FROM unidades ORDER BY nome');
  const [vend] = await pool.query("SELECT unidade_id, SUM(valor) v, MAX(meses) m FROM vendas WHERE periodo='Ano' AND ano=? GROUP BY unidade_id", [ano]);
  const [vmes] = await pool.query("SELECT unidade_id, SUM(valor) v, COUNT(DISTINCT mes) m FROM vendas WHERE periodo='Mês' AND ano=? GROUP BY unidade_id", [ano]);
  const [desp] = await pool.query('SELECT unidade_id, SUM(valor_mensal) v FROM despesas WHERE versao=? GROUP BY unidade_id', [versao]);
  const [despG] = await pool.query('SELECT grupo, SUM(valor_mensal) v FROM despesas WHERE versao=? GROUP BY grupo ORDER BY v DESC', [versao]);
  const [fol] = await pool.query('SELECT unidade_id, SUM(valor) v FROM folha WHERE competencia=? GROUP BY unidade_id', [comp]);
  const [pot] = await pool.query('SELECT unidade_id, compativel_min, compativel_max, meta_comprador, venda_2022, venda_2025 FROM potencial');
  const by = (rows, k = 'v') => Object.fromEntries(rows.map(r => [r.unidade_id ?? 'null', r[k]]));
  const V = by(vend), VM = Object.fromEntries(vend.map(r => [r.unidade_id, r.m])), VMes = Object.fromEntries(vmes.map(r => [r.unidade_id, r])), D = by(desp), F = by(fol);
  const P = Object.fromEntries(pot.map(r => [r.unidade_id, r]));

  const lojas = []; const centros = [];
  for (const u of unid) {
    let vendaMes = null;
    if (VMes[u.id] && VMes[u.id].m) vendaMes = VMes[u.id].v / VMes[u.id].m;
    else if (V[u.id] != null) vendaMes = V[u.id] / (VM[u.id] || 12);
    const row = { ...u, venda_mes: vendaMes, despesas_mes: D[u.id] || 0, folha_mes: F[u.id] || 0, potencial: P[u.id] || null };
    row.custo_mes = row.despesas_mes + row.folha_mes;
    row.margem_mes = vendaMes != null ? vendaMes * margem : null;
    row.resultado_mes = vendaMes != null ? row.margem_mes - row.custo_mes : null;
    (u.tipo === 'Loja' ? lojas : centros).push(row);
  }
  const semUnidade = (D.null || 0) + (F.null || 0);
  const lojasAtivas = lojas.filter(l => l.situacao === 'Em operação' || l.custo_mes > 0);
  lojasAtivas.forEach(l => { l.considerada = true; });
  const sum = (a, k) => a.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const custoCentral = sum(centros, 'custo_mes') + semUnidade;
  const vendaTotal = sum(lojasAtivas, 'venda_mes');
  // rateio do custo central proporcional à venda
  for (const l of lojasAtivas) {
    l.rateio_central = vendaTotal ? custoCentral * (l.venda_mes || 0) / vendaTotal : 0;
    l.resultado_apos_rateio = l.resultado_mes != null ? l.resultado_mes - l.rateio_central : null;
  }

  const [pas] = await pool.query("SELECT categoria, SUM(COALESCE(valor_atual, valor_original, 0)) v, SUM(COALESCE(parcela_mensal,0)) parcela, COUNT(*) n, SUM(COALESCE(valor_atual, valor_original) IS NULL) sem_valor FROM passivos WHERE COALESCE(situacao,'') NOT IN ('Pago','Substituído') GROUP BY categoria ORDER BY v DESC");
  const [atv] = await pool.query("SELECT categoria, SUM(COALESCE(valor,0)) v, COUNT(*) n, SUM(valor IS NULL) sem_valor FROM ativos GROUP BY categoria ORDER BY v DESC");
  const [planos] = await pool.query('SELECT status, COUNT(*) n FROM planos_acao GROUP BY status');
  const [planosAlta] = await pool.query("SELECT id, titulo, area, status, prazo, responsavel FROM planos_acao WHERE prioridade='Alta' AND status <> 'Concluído' ORDER BY FIELD(status,'Em andamento','Bloqueado','A fazer'), prazo IS NULL, prazo LIMIT 8");
  const [serie] = await pool.query("SELECT v.ano, u.nome, u.situacao, v.valor, v.meses FROM vendas v JOIN unidades u ON u.id = v.unidade_id WHERE v.periodo='Ano' ORDER BY v.ano, u.nome");
  const [versoes] = await pool.query('SELECT DISTINCT versao FROM despesas WHERE versao IS NOT NULL ORDER BY versao');
  const [comps] = await pool.query('SELECT DISTINCT competencia FROM folha WHERE competencia IS NOT NULL ORDER BY competencia DESC');
  const [anos] = await pool.query("SELECT DISTINCT ano FROM vendas WHERE ano IS NOT NULL ORDER BY ano DESC");
  const [pend] = await pool.query("SELECT (SELECT COUNT(*) FROM passivos WHERE situacao='A verificar') passivos, (SELECT COUNT(*) FROM ativos WHERE situacao='A levantar') ativos, (SELECT COUNT(*) FROM anotacoes WHERE status='A verificar') infos");

  const passivoTotal = sum(pas, 'v'); const ativoTotal = sum(atv, 'v');
  res.json({
    filtros: { versao, competencia: comp, ano, margem_pct: margem * 100, versoes: versoes.map(r => r.versao), competencias: comps.map(r => r.competencia), anos: anos.map(r => r.ano) },
    lojas, centros, custo_central: custoCentral, sem_unidade: semUnidade,
    totais: {
      venda_mes: vendaTotal, despesas_mes: sum(lojasAtivas, 'despesas_mes') + sum(centros, 'despesas_mes') + (D.null || 0),
      folha_mes: sum(lojasAtivas, 'folha_mes') + sum(centros, 'folha_mes') + (F.null || 0),
      custo_mes: sum(lojasAtivas, 'custo_mes') + custoCentral,
      margem_mes: vendaTotal * margem,
      passivo: passivoTotal, ativo: ativoTotal, parcelas_mes: sum(pas, 'parcela'),
      liquidez: passivoTotal ? ativoTotal / passivoTotal : null,
    },
    despesas_grupo: despG, passivos: pas, ativos: atv, planos, planos_alta: planosAlta, serie, pendencias: pend[0],
  });
}));

// Visão consolidada de uma unidade
app.get('/api/unidade/:id', wrap(async (req, res) => {
  const id = req.params.id; const out = {};
  const [u] = await pool.query('SELECT * FROM unidades WHERE id = ?', [id]);
  if (!u.length) return res.status(404).json({ erro: 'Não encontrado' });
  out.unidade = u[0];
  for (const [name, e] of Object.entries(entities)) {
    if (name === 'unidades') continue;
    if (!e.fields.some(f => f.name === 'unidade_id')) continue;
    const [rows] = await pool.query(`SELECT * FROM \`${name}\` WHERE unidade_id = ? ORDER BY ${e.order || 'id'}`, [id]);
    out[name] = rows;
  }
  res.json(out);
}));

// ---------- Previsão de saídas (despesas recorrentes + folha + parcelamentos) ----------
app.get('/api/previsao', wrap(async (req, res) => {
  const p = await params();
  const versao = req.query.versao || p.versao_despesas || 'Financeiro out/26';
  const comp = req.query.competencia || p.competencia_folha || '2026-10';
  const meses = Math.min(36, Math.max(1, Number(req.query.meses || 12)));
  const ini = req.query.inicio || new Date().toISOString().slice(0, 7);
  const [[{ d }]] = await pool.query('SELECT COALESCE(SUM(valor_mensal),0) d FROM despesas WHERE versao=? AND COALESCE(recorrente,1)=1', [versao]);
  const [[{ f }]] = await pool.query('SELECT COALESCE(SUM(valor),0) f FROM folha WHERE competencia=?', [comp]);
  const [[{ sal }]] = await pool.query("SELECT COALESCE(SUM(valor),0) sal FROM folha WHERE competencia=? AND grupo='Salários'", [comp]);
  const [dg] = await pool.query('SELECT grupo, SUM(valor_mensal) v FROM despesas WHERE versao=? AND COALESCE(recorrente,1)=1 GROUP BY grupo ORDER BY v DESC', [versao]);
  const [pas] = await pool.query("SELECT id, categoria, credor, descricao, parcela_mensal, parcelas_restantes, vencimento, COALESCE(valor_atual, valor_original) saldo FROM passivos WHERE COALESCE(situacao,'') NOT IN ('Pago','Substituído')");
  const [y0, m0] = ini.split('-').map(Number);
  const lista = [];
  for (let i = 0; i < meses; i++) {
    const dt = new Date(Date.UTC(y0, m0 - 1 + i, 1));
    const ym = dt.toISOString().slice(0, 7);
    const item = { mes: ym, despesas: d, folha: f, decimo_terceiro: 0, parcelamentos: 0, vencimentos: 0, detalhe: [] };
    if (ym.endsWith('-12')) item.decimo_terceiro = sal; // estimativa: 13º ≈ 1 salário-base do mês
    for (const x of pas) {
      if (x.parcela_mensal && (x.parcelas_restantes == null || i < x.parcelas_restantes)) {
        item.parcelamentos += Number(x.parcela_mensal);
        item.detalhe.push({ id: x.id, tipo: 'parcela', credor: x.credor || x.categoria, valor: Number(x.parcela_mensal), sem_fim: x.parcelas_restantes == null });
      } else if (!x.parcela_mensal && x.vencimento && x.vencimento.slice(0, 7) === ym && x.saldo) {
        item.vencimentos += Number(x.saldo);
        item.detalhe.push({ id: x.id, tipo: 'vencimento', credor: x.credor || x.categoria, valor: Number(x.saldo) });
      }
    }
    item.total = item.despesas + item.folha + item.decimo_terceiro + item.parcelamentos + item.vencimentos;
    lista.push(item);
  }
  const semPrazo = pas.filter(x => !x.parcela_mensal && !x.vencimento).map(x => ({ id: x.id, categoria: x.categoria, credor: x.credor, descricao: x.descricao, saldo: x.saldo }));
  res.json({ versao, competencia: comp, despesas_grupo: dg, meses: lista, sem_prazo: semPrazo, total: lista.reduce((s, x) => s + x.total, 0) });
}));

// ---------- Importação genérica de planilha para qualquer tabela ----------
app.post('/api/importar/tabela/:ent', wrap(async (req, res) => {
  const e = entityOr404(req, res); if (!e) return;
  if (!canWrite(req, res, req.params.ent)) return;
  const { linhas, arquivo, substituir_versao } = req.body || {};
  if (!Array.isArray(linhas) || !linhas.length) return res.status(400).json({ erro: 'Nenhuma linha' });
  const [unid] = await pool.query('SELECT id, codigo, nome, codigo_alterdata, cnpj FROM unidades');
  const [forn] = await pool.query('SELECT id, nome FROM fornecedores');
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const acha = (lst, v) => { const k = norm(v); if (!k) return null; const d = String(v).replace(/\D/g, ''); return (lst.find(u => String(u.id) === String(v) || norm(u.codigo) === k || norm(u.nome) === k || norm(u.codigo_alterdata) === k || (d.length >= 8 && String(u.cnpj || '').replace(/\D/g, '') === d)) || lst.find(u => k.length > 3 && norm(u.nome).includes(k)) || {}).id || null; };
  const conn = await pool.getConnection(); let ok = 0; const erros = [];
  try {
    await conn.beginTransaction();
    if (substituir_versao && req.params.ent === 'despesas') await conn.query('DELETE FROM despesas WHERE versao = ?', [String(substituir_versao)]);
    for (const [i, l] of linhas.entries()) {
      const data = {};
      for (const f of e.fields) {
        if (!(f.name in l)) continue;
        if (f.type === 'ref') data[f.name] = acha(f.ref === 'unidades' ? unid : forn, l[f.name]);
        else data[f.name] = coerce(f, l[f.name]);
      }
      const miss = missingRequired(e, data, true);
      if (miss.length) { erros.push(`Linha ${i + 2}: falta ${miss.join(', ')}`); continue; }
      data.atualizado_por = req.user.email;
      await conn.query(`INSERT INTO \`${req.params.ent}\` SET ?`, [data]); ok++;
    }
    await conn.query('INSERT INTO importacoes (tipo, arquivo, linhas, usuario, resumo) VALUES (?,?,?,?,?)', [req.params.ent, String(arquivo || '').slice(0, 250), ok, req.user.email, `${ok} linhas em ${e.label}${erros.length ? '; ' + erros.length + ' com erro' : ''}`]);
    await conn.commit();
  } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
  res.json({ ok, erros: erros.slice(0, 50) });
}));

// ---------- Importação (exports do Alterdata / planilhas) ----------
app.post('/api/importar/vendas', wrap(async (req, res) => {
  if (req.user.papel === 'leitor') return res.status(403).json({ erro: 'Sem permissão' });
  const { arquivo, linhas, bruto, periodo } = req.body || {};
  if (!Array.isArray(linhas) || !linhas.length) return res.status(400).json({ erro: 'Nenhuma linha para importar' });
  const [unid] = await pool.query('SELECT id, codigo, nome, codigo_alterdata, cnpj FROM unidades');
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const digits = s => String(s || '').replace(/\D/g, '');
  const find = key => {
    const k = norm(key), d = digits(key);
    return unid.find(u => (u.codigo_alterdata && norm(u.codigo_alterdata) === k) || (d.length >= 8 && digits(u.cnpj) === d) || norm(u.codigo) === k || norm(u.nome) === k || norm(u.nome).startsWith(k) || (k.length > 3 && norm(u.nome).includes(k)));
  };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [imp] = await conn.query('INSERT INTO importacoes (tipo, arquivo, linhas, usuario) VALUES (?,?,?,?)', ['vendas', String(arquivo || '').slice(0, 250), linhas.length, req.user.email]);
    const impId = imp.insertId;
    if (Array.isArray(bruto)) for (let i = 0; i < bruto.length; i += 500) {
      const chunk = bruto.slice(i, i + 500).map(r => [impId, JSON.stringify(r)]);
      await conn.query('INSERT INTO alterdata_bruto (importacao_id, linha) VALUES ?', [chunk]);
    }
    let ok = 0; const semLoja = new Set(); let subst = 0;
    const per = ['Dia', 'Mês', 'Ano'].includes(periodo) ? periodo : 'Dia';
    for (const l of linhas) {
      const u = find(l.loja);
      if (!u) { semLoja.add(String(l.loja)); continue; }
      const valor = coerce({ type: 'money' }, l.valor);
      if (valor == null) continue;
      let data = l.data ? String(l.data).slice(0, 10) : null;
      let ano = l.ano ? Number(l.ano) : (data ? Number(data.slice(0, 4)) : null);
      let mes = l.mes ? Number(l.mes) : (data ? Number(data.slice(5, 7)) : null);
      if (!ano) continue;
      // substitui o mesmo período da mesma loja vindo de importação anterior
      const [del] = await conn.query("DELETE FROM vendas WHERE unidade_id=? AND periodo=? AND ano=? AND (mes <=> ?) AND (data <=> ?) AND fonte LIKE 'Importação%'", [u.id, per, ano, per === 'Ano' ? null : mes, per === 'Dia' ? data : null]);
      subst += del.affectedRows;
      await conn.query('INSERT INTO vendas SET ?', [{ unidade_id: u.id, periodo: per, ano, mes: per === 'Ano' ? null : mes, data: per === 'Dia' ? data : null, meses: per === 'Ano' ? 12 : null, valor, atendimentos_mes: coerce({ type: 'int' }, l.atendimentos), ticket_medio: coerce({ type: 'money' }, l.ticket), descricao: l.descricao || null, fonte: `Importação #${impId} (${String(arquivo || '').slice(0, 120)})`, atualizado_por: req.user.email }]);
      ok++;
    }
    const resumo = `${ok} linhas importadas, ${subst} substituídas${semLoja.size ? '. Lojas não reconhecidas: ' + [...semLoja].slice(0, 20).join(', ') : ''}`;
    await conn.query('UPDATE importacoes SET resumo=? WHERE id=?', [resumo, impId]);
    await conn.commit();
    res.json({ ok, substituidas: subst, sem_loja: [...semLoja], resumo, importacao: impId });
  } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
}));

app.get('/api/importacoes', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM importacoes ORDER BY id DESC LIMIT 100');
  res.json(rows);
}));

// ---------- Front-end ----------
const DIST = path.join(__dirname, 'web', 'dist');
app.use('/assets', express.static(path.join(DIST, 'assets'), { maxAge: '30d', immutable: true }));
app.use(express.static(DIST, { maxAge: 0, index: false }));
app.get(/^\/(?!api\/).*/, (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(DIST, 'index.html')); });

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro no servidor: ' + (err.sqlMessage || err.message) });
});

(async () => {
  try {
    await migrate(pool);
    await seed.run(pool);
    console.log('Banco pronto');
  } catch (e) { console.error('Falha ao preparar o banco:', e); }
  app.listen(PORT, () => console.log('Portal Vou Comprar na porta ' + PORT));
})();
