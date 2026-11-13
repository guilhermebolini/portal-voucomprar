'use strict';
/* Portal Vou Comprar · front-end sem build (JS puro). */
const S = { meta: null, user: null, cache: {}, charts: [] };
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => v == null || v === '' || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 });
const brl2 = v => v == null || v === '' || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v, d = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d });
const mi = v => v == null ? '—' : 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + ' mi';
const dataBR = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';
const mesBR = m => { if (!m) return '—'; const [y, mm] = String(m).split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(mm) - 1] + '/' + String(y).slice(2); };

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2600); }

async function api(url, opts = {}) {
  const r = await fetch(url, { credentials: 'same-origin', headers: opts.body ? { 'Content-Type': 'application/json' } : {}, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let data = null; try { data = await r.json(); } catch (e) { /* vazio */ }
  if (r.status === 401 && !url.startsWith('/api/auth')) { S.user = null; location.hash = '#/login'; throw new Error('Faça login'); }
  if (!r.ok) throw new Error((data && data.erro) || 'Erro ' + r.status);
  return data;
}

function hashParams() { const q = location.hash.split('?')[1] || ''; return Object.fromEntries(new URLSearchParams(q)); }
const PAPEL = { admin: 'Administrador', editor: 'Editor', leitor: 'Leitor' };
const podeEditar = () => S.user && S.user.papel !== 'leitor';

// ============ AUTENTICAÇÃO ============
function telaAuth(titulo, sub, corpo) {
  $('#app').innerHTML = `<div class="auth">
    <div class="auth-lado"><div class="marca"><img src="/logo.svg" alt=""><span>Vou Comprar<small>Portal de avaliação</small></span></div>
      <div><h1>Os números da rede, num lugar só.</h1><p>Lojas, dívidas, folha, aluguéis, despesas, vendas e planos de ação para a avaliação do negócio.</p></div>
      <p style="font-size:12px">Acesso restrito. Dados confidenciais.</p></div>
    <div class="auth-form"><div class="auth-box"><h2>${titulo}</h2><p class="sub">${sub}</p><div id="auth-msg"></div>${corpo}</div></div></div>`;
}
const authMsg = (txt, tipo = 'erro') => { $('#auth-msg').innerHTML = txt ? `<div class="${tipo}">${esc(txt)}</div>` : ''; };

function pagLogin() {
  telaAuth('Entrar', 'Use seu e-mail e senha.', `<form id="f">
    <div class="campo"><label>E-mail</label><input type="email" name="email" autocomplete="username" required autofocus></div>
    <div class="campo"><label>Senha</label><input type="password" name="senha" autocomplete="current-password" required></div>
    <button class="btn prim" style="width:100%;justify-content:center">Entrar</button>
    <p style="text-align:center;margin-top:16px"><a href="#/esqueci">Esqueci minha senha</a></p></form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    try { const r = await api('/api/auth/login', { method: 'POST', body: fd }); S.user = r.user; S.meta = null; location.hash = '#/painel'; } catch (err) { authMsg(err.message); }
  };
}
function pagEsqueci() {
  telaAuth('Recuperar senha', 'Informe seu e-mail. Enviamos um link para criar uma nova senha.', `<form id="f">
    <div class="campo"><label>E-mail</label><input type="email" name="email" required autofocus></div>
    <button class="btn prim" style="width:100%;justify-content:center">Enviar link</button>
    <p style="text-align:center;margin-top:16px"><a href="#/login">Voltar ao login</a></p></form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault();
    try { const r = await api('/api/auth/esqueci', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); authMsg(r.mensagem, 'ok'); } catch (err) { authMsg(err.message); }
  };
}
function pagRedefinir() {
  const p = hashParams(); const convite = p.convite === '1';
  telaAuth(convite ? 'Criar sua senha' : 'Nova senha', 'Mínimo de 8 caracteres, com letras e números.', `<form id="f">
    <div class="campo"><label>Nova senha</label><input type="password" name="senha" autocomplete="new-password" required autofocus></div>
    <div class="campo"><label>Repita a senha</label><input type="password" name="senha2" autocomplete="new-password" required></div>
    <button class="btn prim" style="width:100%;justify-content:center">Salvar e entrar</button></form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    if (fd.senha !== fd.senha2) return authMsg('As senhas não conferem.');
    try { await api('/api/auth/redefinir', { method: 'POST', body: { token: p.token, senha: fd.senha } }); S.meta = null; location.hash = '#/painel'; } catch (err) { authMsg(err.message); }
  };
}
function pagConfigurar() {
  const p = hashParams();
  telaAuth('Primeiro acesso', 'Cadastre o administrador do portal. Este link só funciona uma vez.', `<form id="f">
    <div class="campo"><label>Seu nome</label><input type="text" name="nome" required autofocus></div>
    <div class="campo"><label>E-mail de login</label><input type="email" name="email" required></div>
    <div class="campo"><label>Senha</label><input type="password" name="senha" autocomplete="new-password" required><span class="ajuda">Mínimo de 8 caracteres, com letras e números.</span></div>
    <button class="btn prim" style="width:100%;justify-content:center">Criar administrador</button></form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    try { await api('/api/auth/configurar', { method: 'POST', body: { ...fd, token: p.token } }); S.meta = null; location.hash = '#/painel'; } catch (err) { authMsg(err.message); }
  };
}

// ============ LAYOUT ============
const MENU = [
  ['Visão geral', [['painel', 'Painel'], ['lojas', 'Lojas'], ['previsao', 'Previsão de saídas']]],
  ['Dívidas', [['dividas', 'Dívidas e passivos'], ['e/fornecedores', 'Fornecedores']]],
  ['Custos', [['e/despesas', 'Despesas'], ['e/folha', 'Folha de pagamento'], ['e/imoveis', 'Imóveis e aluguéis'], ['e/colaboradores', 'Colaboradores'], ['e/quadro', 'Quadro de cargos']]],
  ['Vendas', [['e/vendas', 'Vendas'], ['potencial', 'Potencial de venda']]],
  ['Gestão', [['e/planos_acao', 'Planos de ação'], ['e/ativos', 'Ativos'], ['e/anotacoes', 'Informações levantadas'], ['e/unidades', 'Cadastro de lojas']]],
  ['Dados', [['importar', 'Importar planilha'], ['e/parametros', 'Premissas'], ['historico', 'Histórico de alterações']]],
];
function layout(rota) {
  const admin = S.user.papel === 'admin';
  const menu = MENU.map(([g, itens]) => `<h6>${g}</h6>` + itens.map(([r, t]) => `<a href="#/${r}" class="${rota === r || rota.startsWith(r + '/') ? 'ativo' : ''}">${t}</a>`).join('')).join('')
    + (admin ? `<a href="#/usuarios" class="${rota === 'usuarios' ? 'ativo' : ''}">Usuários</a>` : '');
  $('#app').innerHTML = `<div class="topo-mobile"><div class="marca"><img src="/logo.svg" alt="">Vou Comprar</div><button id="abre-menu" aria-label="Menu">☰</button></div>
  <div class="layout"><nav class="lateral" id="lateral"><div class="marca"><img src="/logo.svg" alt=""><span>Vou Comprar<small>Portal de avaliação</small></span></div>${menu}
    <div class="rodape">${esc(S.user.nome || S.user.email)}<br><span class="tag">${PAPEL[S.user.papel]}</span><br><a href="#/conta" style="color:#fff">Minha conta</a> · <a href="#" id="sair" style="color:#fff">Sair</a></div></nav>
  <main class="principal" id="main"></main></div>`;
  $('#abre-menu').onclick = () => $('#lateral').classList.toggle('aberta');
  $('#lateral').onclick = e => { if (e.target.tagName === 'A') $('#lateral').classList.remove('aberta'); };
  $('#sair').onclick = async e => { e.preventDefault(); await api('/api/auth/sair', { method: 'POST' }); S.user = null; location.hash = '#/login'; };
  return $('#main');
}
function limpaCharts() { S.charts.forEach(c => c.destroy()); S.charts = []; }
function chart(el, cfg) { if (!window.Chart) return; Chart.defaults.font.family = 'Inter, system-ui, sans-serif'; Chart.defaults.color = '#6b7280'; S.charts.push(new Chart(el, cfg)); }
const CORES = ['#d71920', '#16181d', '#2563eb', '#12805c', '#b26b00', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#9ca3af', '#f59e0b', '#475569'];

// ============ DADOS ============
async function lista(ent, q = '') { return api(`/api/e/${ent}${q ? '?' + q : ''}`); }
async function unidades(force) { if (!S.cache.unidades || force) S.cache.unidades = await lista('unidades'); return S.cache.unidades; }
async function fornecedores(force) { if (!S.cache.fornecedores || force) S.cache.fornecedores = await lista('fornecedores'); return S.cache.fornecedores; }
async function refOpts(ref) { return ref === 'unidades' ? unidades() : fornecedores(); }
function refNome(ref, id) { const l = S.cache[ref] || []; const r = l.find(x => x.id === id); return r ? (r.nome || r.codigo) : (id ? '#' + id : ''); }

function fmtCampo(f, v) {
  if (v == null || v === '') return '<span class="vazio">—</span>';
  switch (f.type) {
    case 'money': return brl2(v);
    case 'number': return num(v, 2);
    case 'int': return f.name === 'ano' ? v : num(v);
    case 'date': return dataBR(v);
    case 'month': return mesBR(v);
    case 'bool': return v ? 'Sim' : 'Não';
    case 'ref': return esc(refNome(f.ref, v));
    case 'select': return `<span class="tag ${corTag(v)}">${esc(v)}</span>`;
    default: return esc(v);
  }
}
function corTag(v) {
  if (/^(Alta|Atrasado|A verificar|A levantar|Em aberto|Bloqueado|Encerrada)$/.test(v)) return 'vermelho';
  if (/^(Pago|Em dia|Concluído|Confirmado|Em operação|Ativo)$/.test(v)) return 'verde';
  if (/^(Média|Em negociação|Parcelado|A confirmar|Em andamento|Estimado|Parcial)$/.test(v)) return 'ambar';
  return '';
}

// ============ FORMULÁRIO (modal) ============
async function abreForm(ent, id, preset = {}, aoSalvar) {
  const e = S.meta.entities[ent];
  let reg = { ...preset };
  if (id) reg = await api(`/api/e/${ent}/${id}`);
  for (const f of e.fields) if (f.type === 'ref') await refOpts(f.ref);
  const ro = !podeEditar() || (ent === 'parametros' && S.user.papel !== 'admin');
  const campo = f => {
    const v = reg[f.name]; const req = f.required ? ' required' : ''; const dis = ro ? ' disabled' : '';
    let inp;
    if (f.type === 'select') inp = `<select name="${f.name}"${req}${dis}><option value=""></option>${f.options.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}${v && !f.options.includes(v) ? `<option selected>${esc(v)}</option>` : ''}</select>`;
    else if (f.type === 'ref') inp = `<select name="${f.name}"${req}${dis}><option value=""></option>${(S.cache[f.ref] || []).map(o => `<option value="${o.id}"${o.id === v ? ' selected' : ''}>${esc(o.nome || o.codigo)}</option>`).join('')}</select>`;
    else if (f.type === 'longtext') inp = `<textarea name="${f.name}"${dis}>${esc(v)}</textarea>`;
    else if (f.type === 'bool') inp = `<select name="${f.name}"${dis}><option value=""></option><option value="1"${v === 1 ? ' selected' : ''}>Sim</option><option value="0"${v === 0 ? ' selected' : ''}>Não</option></select>`;
    else {
      const t = { int: 'number', number: 'number', money: 'number', date: 'date', month: 'month' }[f.type] || 'text';
      const step = f.type === 'int' ? '1' : 'any';
      inp = `<input type="${t}" name="${f.name}" value="${esc(v)}"${t === 'number' ? ` step="${step}"` : ''}${req}${dis}>`;
    }
    const largo = f.type === 'longtext' || f.name === 'titulo' || f.name === 'nome' || f.name === 'endereco' ? ' style="grid-column:1/-1"' : '';
    return `<div class="campo"${largo}><label>${esc(f.label)}${f.required ? ' *' : ''}</label>${inp}${f.help ? `<span class="ajuda">${esc(f.help)}</span>` : ''}</div>`;
  };
  const hist = (reg._historico || []).map(h => `${h.acao} por ${esc(h.usuario)} em ${dataBR(h.criado_em)} ${String(h.criado_em).slice(11, 16)}`).join('<br>');
  $('#modal-root').innerHTML = `<div class="modal-fundo"><div class="modal"><h2>${id ? (ro ? '' : 'Editar ') + esc(e.singular) : 'Novo: ' + esc(e.singular)}</h2>
    <p class="dica">${esc(e.label)}${id ? ' · #' + id : ''}</p><div id="form-msg"></div>
    <form id="mf"><div class="duas">${e.fields.map(campo).join('')}</div>
    ${hist ? `<div class="historico"><b>Histórico</b><br>${hist}</div>` : ''}
    <div class="rodape"><div>${id && !ro ? '<button type="button" class="btn perigo" id="excluir">Excluir</button>' : ''}</div>
    <div class="acoes"><button type="button" class="btn" id="fechar">${ro ? 'Fechar' : 'Cancelar'}</button>${ro ? '' : '<button class="btn prim">Salvar</button>'}</div></div></form></div></div>`;
  const fecha = () => { $('#modal-root').innerHTML = ''; };
  $('#fechar').onclick = fecha;
  $('.modal-fundo').onclick = ev => { if (ev.target.classList.contains('modal-fundo')) fecha(); };
  if ($('#excluir')) $('#excluir').onclick = async () => {
    if (!confirm('Excluir este registro? A exclusão fica registrada no histórico.')) return;
    try { await api(`/api/e/${ent}/${id}`, { method: 'DELETE' }); fecha(); toast('Excluído'); S.cache[ent] = null; aoSalvar && aoSalvar(); } catch (err) { $('#form-msg').innerHTML = `<div class="erro">${esc(err.message)}</div>`; }
  };
  $('#mf').onsubmit = async ev => {
    ev.preventDefault();
    const body = {}; for (const f of e.fields) { const el = ev.target.elements[f.name]; if (el) body[f.name] = el.value; }
    try {
      if (id) await api(`/api/e/${ent}/${id}`, { method: 'PUT', body }); else await api(`/api/e/${ent}`, { method: 'POST', body });
      fecha(); toast('Salvo'); S.cache[ent] = null; aoSalvar && aoSalvar();
    } catch (err) { $('#form-msg').innerHTML = `<div class="erro">${esc(err.message)}</div>`; }
  };
}

// ============ TABELA GENÉRICA ============
async function tabelaEntidade(el, ent, { filtroFixo = {}, titulo, descricao, colunas, esconderFiltros = false, aoMudar } = {}) {
  const e = S.meta.entities[ent];
  for (const f of e.fields) if (f.type === 'ref') await refOpts(f.ref);
  const cols = colunas ? colunas.map(n => e.fields.find(f => f.name === n)).filter(Boolean) : e.fields.filter(f => f.list);
  const filtraveis = e.fields.filter(f => (f.type === 'select' || f.type === 'ref' || f.name === 'ano' || f.name === 'competencia') && f.list && !(f.name in filtroFixo));
  const st = { q: '', f: {}, ord: null, dir: 1 };
  const chave = 'filtros:' + ent; try { Object.assign(st.f, JSON.parse(localStorage.getItem(chave) || '{}')); } catch (err) { /* ok */ }
  let rows = [];
  el.innerHTML = `${titulo ? `<div class="cabeca"><div><h1>${esc(titulo)}</h1>${descricao ? `<p>${descricao}</p>` : ''}</div><div class="acoes">
    <button class="btn" data-x="csv">Exportar CSV</button>${podeEditar() && !(ent === 'parametros' && S.user.papel !== 'admin') ? `<button class="btn" data-x="imp">Importar planilha</button><button class="btn prim" data-x="novo">+ Novo</button>` : ''}</div></div>` : ''}
    ${esconderFiltros ? '' : `<div class="filtros"><input type="search" placeholder="Buscar…" data-x="q">${filtraveis.map(f => `<select data-f="${f.name}"><option value="">${esc(f.label)}: todos</option></select>`).join('')}</div>`}
    <div class="tabela-wrap"><table><thead></thead><tbody></tbody><tfoot></tfoot></table></div><p class="dica" data-x="cont"></p>`;
  const carrega = async () => { rows = await lista(ent, new URLSearchParams(filtroFixo).toString()); preencheFiltros(); render(); };
  const preencheFiltros = () => {
    for (const sel of $$('select[data-f]', el)) {
      const f = e.fields.find(x => x.name === sel.dataset.f);
      const vals = [...new Set(rows.map(r => r[f.name]).filter(v => v != null && v !== ''))].sort((a, b) => f.type === 'ref' ? refNome(f.ref, a).localeCompare(refNome(f.ref, b)) : String(b).localeCompare(String(a), 'pt', { numeric: true }) * (f.type === 'select' ? -1 : 1));
      sel.innerHTML = `<option value="">${esc(f.label)}: todos</option>` + vals.map(v => `<option value="${esc(v)}"${String(st.f[f.name] ?? '') === String(v) ? ' selected' : ''}>${f.type === 'ref' ? esc(refNome(f.ref, v)) : f.type === 'month' ? mesBR(v) : esc(v)}</option>`).join('');
    }
  };
  const filtrados = () => {
    const q = st.q.toLowerCase();
    let r = rows.filter(x => Object.entries(st.f).every(([k, v]) => v === '' || v == null || String(x[k] ?? '') === String(v)));
    if (q) r = r.filter(x => cols.concat(e.fields).some(f => String(f.type === 'ref' ? refNome(f.ref, x[f.name]) : x[f.name] ?? '').toLowerCase().includes(q)));
    if (st.ord) { const f = e.fields.find(z => z.name === st.ord); r = [...r].sort((a, b) => { const va = f.type === 'ref' ? refNome(f.ref, a[st.ord]) : a[st.ord], vb = f.type === 'ref' ? refNome(f.ref, b[st.ord]) : b[st.ord]; if (va == null) return 1; if (vb == null) return -1; return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt', { numeric: true })) * st.dir; }); }
    return r;
  };
  const render = () => {
    const r = filtrados();
    const isNum = f => ['money', 'number', 'int'].includes(f.type) && f.name !== 'ano';
    $('thead', el).innerHTML = `<tr>${cols.map(f => `<th class="${isNum(f) ? 'num' : ''}" data-o="${f.name}">${esc(f.label)}${st.ord === f.name ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr>`;
    $('tbody', el).innerHTML = r.map(x => `<tr class="clicavel" data-id="${x.id}">${cols.map(f => `<td class="${isNum(f) ? 'num' : ''}">${fmtCampo(f, x[f.name])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="vazio">Nenhum registro.</td></tr>`;
    const somas = cols.map(f => f.sum ? r.reduce((s, x) => s + (Number(x[f.name]) || 0), 0) : null);
    $('tfoot', el).innerHTML = somas.some(v => v != null) ? `<tr>${cols.map((f, i) => `<td class="${isNum(f) ? 'num' : ''}">${i === 0 ? 'Total' : somas[i] != null ? (f.type === 'money' ? brl2(somas[i]) : num(somas[i])) : ''}</td>`).join('')}</tr>` : '';
    $('[data-x=cont]', el).textContent = `${r.length} de ${rows.length} registros`;
    $$('th[data-o]', el).forEach(th => th.onclick = () => { st.dir = st.ord === th.dataset.o ? -st.dir : 1; st.ord = th.dataset.o; render(); });
    $$('tbody tr[data-id]', el).forEach(tr => tr.onclick = () => abreForm(ent, Number(tr.dataset.id), {}, async () => { await carrega(); aoMudar && aoMudar(); }));
  };
  const q = $('[data-x=q]', el); if (q) q.oninput = () => { st.q = q.value; render(); };
  $$('select[data-f]', el).forEach(sel => sel.onchange = () => { st.f[sel.dataset.f] = sel.value; try { localStorage.setItem(chave, JSON.stringify(st.f)); } catch (err) { /* ok */ } render(); });
  const novo = $('[data-x=novo]', el); if (novo) novo.onclick = () => abreForm(ent, null, { ...filtroFixo }, async () => { await carrega(); aoMudar && aoMudar(); });
  const imp = $('[data-x=imp]', el); if (imp) imp.onclick = () => { location.hash = '#/importar?tabela=' + ent; };
  const csv = $('[data-x=csv]', el); if (csv) csv.onclick = () => exportaCSV(e, filtrados(), ent);
  await carrega();
  return { recarrega: carrega };
}

function exportaCSV(e, rows, nome) {
  const cab = e.fields.map(f => f.label);
  const linhas = rows.map(r => e.fields.map(f => { let v = r[f.name]; if (f.type === 'ref') v = refNome(f.ref, v); if (v == null) v = ''; if (typeof v === 'number') v = String(v).replace('.', ','); return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'));
  const blob = new Blob(['﻿' + [cab.join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${nome}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

// ============ PÁGINAS ============
const DESC = {
  despesas: 'Cada linha de despesa por loja. Use a <b>versão</b> para comparar fontes (planilha FINANCEIRO de out/26, evidência da BPO, o que você informou) ou montar um cenário ajustado do comprador.',
  folha: 'Lançamentos de folha por competência e loja (salários, encargos, FGTS, INSS, benefícios…).',
  imoveis: 'Contratos de aluguel, valores informados x evidência e atrasos por loja.',
  colaboradores: 'Pessoas, lotação e rateio entre lojas. Registre salários atrasados e rescisão estimada por pessoa.',
  quadro: 'Cargos e salários base por loja (planilha FINANCEIRO, out/26).',
  fornecedores: 'Representantes e fábricas. As dívidas ficam em Dívidas e passivos, ligadas ao fornecedor.',
  vendas: 'Venda líquida por loja: anual (histórico da BPO), mensal ou diária (importações do Alterdata).',
  planos_acao: 'O que precisa ser feito antes da compra e depois dela. Ordene por prioridade e acompanhe o status.',
  ativos: 'Saldos, recebíveis, consórcios, estoque. Entram no índice de liquidez.',
  anotacoes: 'Informações soltas levantadas nas conversas e planilhas, com a fonte e se já foram confirmadas.',
  unidades: 'Lojas e centros de custo, com CNPJ, endereço e código do Alterdata (usado nas importações).',
  parametros: 'Premissas usadas nos cálculos do painel. Só o administrador altera.',
  ativos_: '',
};

async function pagEntidade(main, ent) {
  const e = S.meta.entities[ent];
  if (!e) { main.innerHTML = '<p>Página não encontrada.</p>'; return; }
  await tabelaEntidade(main, ent, { titulo: e.label, descricao: DESC[ent] });
}

async function pagPainel(main) {
  const p = hashParams();
  const d = await api('/api/painel?' + new URLSearchParams(p).toString());
  await unidades();
  const t = d.totais;
  const resultado = t.margem_mes - t.custo_mes;
  const f = d.filtros;
  main.innerHTML = `<div class="cabeca"><div><h1>Painel da avaliação</h1><p>Venda média mensal de ${f.ano} contra o custo mensal (despesas da versão <b>${esc(f.versao)}</b> + folha de ${mesBR(f.competencia)}). Margem bruta usada: <b>${num(f.margem_pct)}%</b> (premissa, troque em Premissas ou aqui).</p></div>
    <div class="acoes"><select id="p-versao">${f.versoes.map(v => `<option${v === f.versao ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
    <select id="p-comp">${f.competencias.map(v => `<option value="${v}"${v === f.competencia ? ' selected' : ''}>Folha ${mesBR(v)}</option>`).join('')}</select>
    <select id="p-ano">${f.anos.map(v => `<option${v === f.ano ? ' selected' : ''}>${v}</option>`).join('')}</select>
    <input id="p-margem" type="number" step="1" value="${num(f.margem_pct)}" style="width:90px" title="Margem bruta %"></div></div>
  <div class="grade g4">
    <div class="card kpi"><div class="rot">Venda média / mês</div><div class="val">${brl(t.venda_mes)}</div><div class="det">${f.ano}, lojas em operação</div></div>
    <div class="card kpi"><div class="rot">Custo fixo / mês</div><div class="val">${brl(t.custo_mes)}</div><div class="det">Despesas ${brl(t.despesas_mes)} + folha ${brl(t.folha_mes)}</div></div>
    <div class="card kpi ${resultado < 0 ? 'neg' : 'pos'}"><div class="rot">Resultado estimado / mês</div><div class="val">${brl(resultado)}</div><div class="det">Margem ${brl(t.margem_mes)} − custo fixo</div></div>
    <div class="card kpi neg"><div class="rot">Dívidas mapeadas</div><div class="val">${brl(t.passivo)}</div><div class="det">${brl(t.parcelas_mes)}/mês em parcelas · ${d.pendencias.passivos} itens a verificar</div></div>
  </div>
  <div class="grade g2 mt">
    <div class="card"><h3>Resultado por loja (mês)</h3><p class="sub">Margem bruta − despesas − folha da loja, antes do rateio do custo central (${brl(d.custo_central)}/mês de site, DP, ADM, logística).</p><div class="canvas-box"><canvas id="c-lojas"></canvas></div></div>
    <div class="card"><h3>Dívidas por tipo</h3><p class="sub">Saldo atual (ou original) sem os pagos/substituídos. Ativos mapeados: ${brl(t.ativo)}${t.liquidez != null ? ` · liquidez ${num(t.liquidez, 2)}` : ''}.</p><div class="canvas-box"><canvas id="c-div"></canvas></div></div>
  </div>
  <div class="card mt"><h3>Lojas</h3><p class="sub">Lojas em operação ou com custo na versão escolhida. Clique numa loja para ver tudo dela. As demais estão em <a href="#/lojas">Lojas</a>.</p><div class="tabela-wrap"><table><thead><tr><th>Loja</th><th>Situação</th><th class="num">Venda/mês</th><th class="num">Despesas/mês</th><th class="num">Folha/mês</th><th class="num">Custo/venda</th><th class="num">Resultado</th><th class="num">Após rateio</th></tr></thead><tbody>
  ${d.lojas.filter(l => l.considerada).map(l => `<tr class="clicavel" onclick="location.hash='#/loja/${l.id}'"><td><b>${esc(l.nome)}</b></td><td>${fmtCampo({ type: 'select' }, l.situacao)}</td><td class="num">${brl(l.venda_mes)}</td><td class="num">${brl(l.despesas_mes)}</td><td class="num">${brl(l.folha_mes)}</td><td class="num">${l.venda_mes ? num(100 * l.custo_mes / l.venda_mes, 0) + '%' : '—'}</td><td class="num ${l.resultado_mes < 0 ? 'neg' : 'pos'}">${brl(l.resultado_mes)}</td><td class="num ${l.resultado_apos_rateio < 0 ? 'neg' : 'pos'}">${l.resultado_apos_rateio != null ? brl(l.resultado_apos_rateio) : '—'}</td></tr>`).join('')}
  </tbody></table></div></div>
  <div class="grade g2 mt">
    <div class="card"><h3>Venda anual por loja</h3><p class="sub">R$ por ano. 2026 = jan–set (BPO); pontos cinza são lojas encerradas.</p><div class="canvas-box"><canvas id="c-serie"></canvas></div></div>
    <div class="card"><h3>Despesas por grupo (mês)</h3><p class="sub">Versão ${esc(f.versao)}, sem a folha.</p><ul class="lista-simples">${d.despesas_grupo.map(g => `<li><span>${esc(g.grupo)}<div class="barra"><i style="width:${Math.round(100 * g.v / (d.despesas_grupo[0].v || 1))}%"></i></div></span><b>${brl(g.v)}</b></li>`).join('')}</ul></div>
  </div>
  <div class="grade g2 mt">
    <div class="card"><h3>Ações prioritárias em aberto</h3><p class="sub">${d.planos.map(p => `${esc(p.status)}: ${p.n}`).join(' · ')}</p><ul class="lista-simples">${d.planos_alta.map(p => `<li><a href="#/e/planos_acao" style="color:inherit">${esc(p.titulo)}</a><span class="tag ${corTag(p.status)}">${esc(p.status)}</span></li>`).join('')}</ul></div>
    <div class="card"><h3>O que ainda falta levantar</h3><ul class="lista-simples">
      <li><span>Dívidas sem valor ou a verificar</span><a href="#/dividas"><b>${d.pendencias.passivos}</b></a></li>
      <li><span>Ativos a levantar (bancos, recebíveis, consórcios, estoque)</span><a href="#/e/ativos"><b>${d.pendencias.ativos}</b></a></li>
      <li><span>Informações a confirmar</span><a href="#/e/anotacoes"><b>${d.pendencias.infos}</b></a></li></ul></div>
  </div>`;
  const muda = () => { location.hash = '#/painel?' + new URLSearchParams({ versao: $('#p-versao').value, competencia: $('#p-comp').value, ano: $('#p-ano').value, margem: $('#p-margem').value }).toString(); };
  ['#p-versao', '#p-comp', '#p-ano', '#p-margem'].forEach(s => $(s).onchange = muda);
  const lojasG = d.lojas.filter(l => l.resultado_mes != null && l.considerada);
  chart($('#c-lojas'), { type: 'bar', data: { labels: lojasG.map(l => l.nome.replace(/ \(.*\)/, '')), datasets: [{ label: 'Resultado/mês', data: lojasG.map(l => Math.round(l.resultado_mes)), backgroundColor: lojasG.map(l => l.resultado_mes < 0 ? '#d71920' : '#12805c'), borderRadius: 4 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => brl(c.raw) } } }, scales: { x: { ticks: { callback: v => brl(v) } } } } });
  chart($('#c-div'), { type: 'doughnut', data: { labels: d.passivos.map(p => p.categoria), datasets: [{ data: d.passivos.map(p => p.v), backgroundColor: CORES }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: c => c.label + ': ' + brl(c.raw) } } } } });
  const anos = [...new Set(d.serie.map(s => s.ano))]; const nomes = [...new Set(d.serie.map(s => s.nome))];
  chart($('#c-serie'), { type: 'line', data: { labels: anos, datasets: nomes.map((n, i) => { const enc = d.serie.find(s => s.nome === n).situacao === 'Encerrada'; return { label: n.replace(/ \(.*\)/, ''), data: anos.map(a => (d.serie.find(s => s.nome === n && s.ano === a) || {}).valor ?? null), borderColor: enc ? '#c4c8cf' : CORES[i % CORES.length], backgroundColor: enc ? '#c4c8cf' : CORES[i % CORES.length], tension: .25, borderWidth: 2 }; }) }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + brl(c.raw) } } }, scales: { y: { ticks: { callback: v => mi(v) } } } } });
}

async function pagLojas(main) {
  const d = await api('/api/painel');
  const cards = d.lojas.map(l => `<a class="card" href="#/loja/${l.id}" style="color:inherit;display:block">
    <div style="display:flex;justify-content:space-between;gap:8px"><h3>${esc(l.nome)}</h3>${fmtCampo({ type: 'select' }, l.situacao)}</div>
    <p class="sub">${esc(l.codigo)}</p>
    <ul class="lista-simples"><li><span>Venda/mês (${d.filtros.ano})</span><b>${brl(l.venda_mes)}</b></li><li><span>Custo/mês</span><b>${brl(l.custo_mes)}</b></li><li><span>Resultado/mês</span><b class="${l.resultado_mes < 0 ? 'neg' : 'pos'}">${brl(l.resultado_mes)}</b></li>
    ${l.potencial ? `<li><span>Potencial (mercado)</span><b>${mi(l.potencial.compativel_min)} a ${mi(l.potencial.compativel_max)}</b></li>` : ''}</ul></a>`).join('');
  const centros = d.centros.map(c => `<a class="card" href="#/loja/${c.id}" style="color:inherit;display:block"><h3>${esc(c.nome)}</h3><p class="sub">Centro de custo</p><ul class="lista-simples"><li><span>Custo/mês</span><b>${brl(c.custo_mes)}</b></li></ul></a>`).join('');
  main.innerHTML = `<div class="cabeca"><div><h1>Lojas</h1><p>Resumo de cada loja. Abra uma loja para ver vendas, despesas, folha, imóvel, pessoas, dívidas e ações dela.</p></div></div>
    <div class="grade g3">${cards}</div><h2 style="margin:28px 0 12px;font-size:18px">Centros de custo</h2><div class="grade g4">${centros}</div>`;
}

async function pagLoja(main, id) {
  const d = await api('/api/unidade/' + id);
  await unidades(); await fornecedores();
  const u = d.unidade;
  const blocos = [['vendas', 'Vendas'], ['despesas', 'Despesas'], ['folha', 'Folha'], ['imoveis', 'Imóvel e aluguel'], ['quadro', 'Quadro de cargos'], ['colaboradores', 'Colaboradores'], ['passivos', 'Dívidas ligadas à loja'], ['potencial', 'Potencial'], ['planos_acao', 'Ações'], ['ativos', 'Ativos']];
  const ab = hashParams().aba || 'vendas';
  main.innerHTML = `<div class="cabeca"><div><p><a href="#/lojas">← Lojas</a></p><h1>${esc(u.nome)}</h1><p>${[u.codigo, u.razao_social, u.cnpj && 'CNPJ ' + u.cnpj, u.endereco, u.gerente && 'Gerente: ' + u.gerente].filter(Boolean).map(esc).join(' · ')}</p>${u.observacoes ? `<p>${esc(u.observacoes)}</p>` : ''}</div>
    <div class="acoes"><button class="btn" id="ed-u">Editar cadastro</button></div></div>
    <div class="abas">${blocos.map(([k, t]) => `<a href="#/loja/${id}?aba=${k}" class="${ab === k ? 'ativo' : ''}">${t} (${(d[k] || []).length})</a>`).join('')}</div><div id="aba"></div>`;
  $('#ed-u').onclick = () => abreForm('unidades', u.id, {}, () => { S.cache.unidades = null; route(); });
  await tabelaEntidade($('#aba'), ab, { filtroFixo: { unidade_id: id }, titulo: S.meta.entities[ab].label + ' · ' + u.nome });
}

async function pagDividas(main) {
  const abas = [['todas', 'Todas', null], ['fornecedores', 'Fornecedores', ['Fornecedores']], ['pessoas', 'Pessoas e trabalhistas', ['Trabalhista - salários atrasados', 'Trabalhista - rescisões', 'Trabalhista - acordos/processos', 'FGTS', 'INSS']], ['alugueis', 'Aluguéis', ['Aluguéis']], ['impostos', 'Impostos', ['Impostos']], ['bancos', 'Bancos e consórcios', ['Bancos/Empréstimos', 'Consórcios']], ['outros', 'Outros', ['Outros']]];
  const ab = hashParams().aba || 'todas';
  const all = await lista('passivos'); await fornecedores(); await unidades();
  const ativo = x => !['Pago', 'Substituído'].includes(x.situacao);
  const soma = cats => all.filter(x => ativo(x) && (!cats || cats.includes(x.categoria))).reduce((s, x) => s + (Number(x.valor_atual ?? x.valor_original) || 0), 0);
  const parc = all.filter(ativo).reduce((s, x) => s + (Number(x.parcela_mensal) || 0), 0);
  main.innerHTML = `<div class="cabeca"><div><h1>Dívidas e passivos</h1><p>Tudo o que a empresa deve: fornecedores (representantes e fábricas), pessoas (salários, rescisões, acordos, FGTS, INSS), aluguéis, impostos e bancos. Itens "Pago" e "Substituído" não somam.</p></div></div>
    <div class="grade g4">${abas.slice(1, 5).map(([k, t, c]) => `<a class="card kpi" href="#/dividas?aba=${k}" style="color:inherit"><div class="rot">${t}</div><div class="val">${brl(soma(c))}</div><div class="det">${all.filter(x => ativo(x) && c.includes(x.categoria)).length} itens</div></a>`).join('')}</div>
    <div class="aviso mt">Total mapeado: <b>${brl(soma(null))}</b> · parcelas mensais: <b>${brl(parc)}</b> · ${all.filter(x => x.situacao === 'A verificar').length} itens ainda "A verificar" (vários sem valor).</div>
    <div class="abas mt">${abas.map(([k, t]) => `<a href="#/dividas?aba=${k}" class="${ab === k ? 'ativo' : ''}">${t}</a>`).join('')}</div><div id="lst"></div>`;
  const cats = (abas.find(a => a[0] === ab) || abas[0])[2];
  const box = $('#lst');
  if (!cats) return tabelaEntidade(box, 'passivos', { titulo: 'Todas as dívidas', aoMudar: () => route() });
  // filtra por várias categorias: monta várias tabelas pequenas se houver mais de uma
  box.innerHTML = cats.map((c, i) => `<div id="cat${i}" style="margin-bottom:24px"></div>`).join('');
  for (const [i, c] of cats.entries()) await tabelaEntidade($('#cat' + i), 'passivos', { filtroFixo: { categoria: c }, titulo: c, aoMudar: () => route() });
}

async function pagPotencial(main) {
  const pot = await lista('potencial'); await unidades();
  main.innerHTML = `<div class="cabeca"><div><h1>Potencial de venda</h1><p>Quanto cada ponto comporta pelo mercado (BPO: venda de 2022 × variação do segmento no RJ × IPCA). Use a coluna <b>Meta do comprador</b> para a sua meta realista. Não é projeção.</p></div></div>
    <div class="card"><div class="canvas-box" style="height:360px"><canvas id="c-pot"></canvas></div></div><div id="tab" class="mt"></div>`;
  const nomes = pot.map(p => refNome('unidades', p.unidade_id).replace(/ \(.*\)/, ''));
  chart($('#c-pot'), { type: 'bar', data: { labels: nomes, datasets: [
    { label: 'Venda 2022', data: pot.map(p => p.venda_2022), backgroundColor: '#c4c8cf' },
    { label: 'Venda 2025', data: pot.map(p => p.venda_2025), backgroundColor: '#16181d' },
    { label: 'Mercado (mín.)', data: pot.map(p => p.compativel_min), backgroundColor: '#f2a0a3' },
    { label: 'Mercado (máx.)', data: pot.map(p => p.compativel_max), backgroundColor: '#d71920' },
    { label: 'Meta do comprador', data: pot.map(p => p.meta_comprador), backgroundColor: '#12805c' }] },
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ': ' + mi(c.raw) } } }, scales: { y: { ticks: { callback: v => mi(v) } } } } });
  await tabelaEntidade($('#tab'), 'potencial', { titulo: 'Tabela', aoMudar: () => route() });
}

async function pagPrevisao(main) {
  const p = hashParams();
  const d = await api('/api/previsao?' + new URLSearchParams(p).toString());
  const pd = await api('/api/painel');
  main.innerHTML = `<div class="cabeca"><div><h1>Previsão de saídas</h1><p>Quanto sai do caixa por mês: despesas recorrentes (versão <b>${esc(d.versao)}</b>) + folha (${mesBR(d.competencia)}) + 13º em dezembro + parcelas de dívidas parceladas + dívidas com vencimento marcado. Para uma dívida entrar aqui, preencha <b>parcela mensal</b> e <b>parcelas restantes</b>, ou o <b>vencimento</b>.</p></div>
    <div class="acoes"><select id="pv-v">${pd.filtros.versoes.map(v => `<option${v === d.versao ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select><select id="pv-c">${pd.filtros.competencias.map(v => `<option value="${v}"${v === d.competencia ? ' selected' : ''}>Folha ${mesBR(v)}</option>`).join('')}</select>
    <select id="pv-m">${[6, 12, 18, 24, 36].map(m => `<option value="${m}"${String(m) === String(p.meses || 12) ? ' selected' : ''}>${m} meses</option>`).join('')}</select></div></div>
    <div class="grade g3"><div class="card kpi"><div class="rot">Saída média / mês</div><div class="val">${brl(d.total / d.meses.length)}</div><div class="det">${d.meses.length} meses: ${brl(d.total)}</div></div>
    <div class="card kpi"><div class="rot">Recorrente fixo / mês</div><div class="val">${brl(d.meses[0].despesas + d.meses[0].folha)}</div><div class="det">Despesas ${brl(d.meses[0].despesas)} + folha ${brl(d.meses[0].folha)}</div></div>
    <div class="card kpi neg"><div class="rot">Dívidas sem prazo definido</div><div class="val">${brl(d.sem_prazo.reduce((s, x) => s + (Number(x.saldo) || 0), 0))}</div><div class="det">${d.sem_prazo.length} itens fora da previsão</div></div></div>
    <div class="card mt"><div class="canvas-box" style="height:340px"><canvas id="c-prev"></canvas></div></div>
    <div class="card mt"><h3>Mês a mês</h3><div class="tabela-wrap"><table><thead><tr><th>Mês</th><th class="num">Despesas</th><th class="num">Folha</th><th class="num">13º</th><th class="num">Parcelas</th><th class="num">Vencimentos</th><th class="num">Total</th></tr></thead><tbody>
    ${d.meses.map(m => `<tr title="${esc(m.detalhe.map(x => x.credor + ': ' + brl(x.valor)).join(' | '))}"><td>${mesBR(m.mes)}</td><td class="num">${brl(m.despesas)}</td><td class="num">${brl(m.folha)}</td><td class="num">${m.decimo_terceiro ? brl(m.decimo_terceiro) : '—'}</td><td class="num">${m.parcelamentos ? brl(m.parcelamentos) : '—'}</td><td class="num">${m.vencimentos ? brl(m.vencimentos) : '—'}</td><td class="num"><b>${brl(m.total)}</b></td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card mt"><h3>Dívidas sem parcela nem vencimento</h3><p class="sub">Defina parcela ou vencimento para que entrem na previsão.</p><ul class="lista-simples">${d.sem_prazo.map(x => `<li><a href="#" data-id="${x.id}">${esc(x.categoria)} · ${esc(x.credor || x.descricao || '')}</a><b>${brl(x.saldo)}</b></li>`).join('') || '<li>Nenhuma.</li>'}</ul></div>`;
  const muda = () => { location.hash = '#/previsao?' + new URLSearchParams({ versao: $('#pv-v').value, competencia: $('#pv-c').value, meses: $('#pv-m').value }); };
  ['#pv-v', '#pv-c', '#pv-m'].forEach(s => $(s).onchange = muda);
  $$('a[data-id]', main).forEach(a => a.onclick = ev => { ev.preventDefault(); abreForm('passivos', Number(a.dataset.id), {}, route); });
  chart($('#c-prev'), { type: 'bar', data: { labels: d.meses.map(m => mesBR(m.mes)), datasets: [
    { label: 'Despesas', data: d.meses.map(m => m.despesas), backgroundColor: '#16181d', stack: 's' },
    { label: 'Folha', data: d.meses.map(m => m.folha + m.decimo_terceiro), backgroundColor: '#6b7280', stack: 's' },
    { label: 'Parcelas', data: d.meses.map(m => m.parcelamentos), backgroundColor: '#d71920', stack: 's' },
    { label: 'Vencimentos', data: d.meses.map(m => m.vencimentos), backgroundColor: '#f59e0b', stack: 's' }] },
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ': ' + brl(c.raw) } } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: v => brl(v) } } } } });
}

// ---- Importação de planilha ----
async function pagImportar(main) {
  const p = hashParams();
  const ents = Object.entries(S.meta.entities).filter(([k]) => k !== 'parametros' || S.user.papel === 'admin');
  const hist = await api('/api/importacoes');
  main.innerHTML = `<div class="cabeca"><div><h1>Importar planilha</h1><p>Suba um Excel (.xlsx/.xls) ou CSV, escolha a tabela de destino e diga qual coluna é qual. Serve para atualizar despesas, folha, dívidas etc. e para receber os exports do Alterdata (Quadro de Venda Diária, BI Documentos) enquanto o acesso direto ao banco não sai.</p></div></div>
  <div class="card"><div class="duas">
    <div class="campo"><label>Destino</label><select id="im-ent"><option value="__vendas">Vendas do Alterdata (por loja e data)</option>${ents.map(([k, e]) => `<option value="${k}"${p.tabela === k ? ' selected' : ''}>${esc(e.label)}</option>`).join('')}</select></div>
    <div class="campo"><label>Arquivo</label><input type="file" id="im-arq" accept=".xlsx,.xls,.csv"></div>
    <div class="campo"><label>Aba</label><select id="im-aba"></select></div>
    <div class="campo"><label>Linha do cabeçalho</label><input type="number" id="im-cab" value="1" min="1"></div></div>
    <div id="im-map"></div><div id="im-msg"></div></div>
  <div class="card mt"><h3>Importações feitas</h3><div class="tabela-wrap"><table><thead><tr><th>#</th><th>Quando</th><th>Destino</th><th>Arquivo</th><th>Usuário</th><th>Resumo</th></tr></thead><tbody>${hist.map(h => `<tr><td>${h.id}</td><td>${dataBR(h.criado_em)} ${String(h.criado_em).slice(11, 16)}</td><td>${esc(h.tipo)}</td><td>${esc(h.arquivo)}</td><td>${esc(h.usuario)}</td><td>${esc(h.resumo)}</td></tr>`).join('') || '<tr><td colspan="6" class="vazio">Nenhuma ainda.</td></tr>'}</tbody></table></div></div>`;
  if (!p.tabela) $('#im-ent').value = '__vendas';
  let wb = null, nomeArq = '';
  const lerAba = () => {
    if (!wb) return;
    const ws = wb.Sheets[$('#im-aba').value];
    const cab = Math.max(1, Number($('#im-cab').value || 1));
    const mat = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    const heads = (mat[cab - 1] || []).map((h, i) => h == null || h === '' ? 'Coluna ' + (i + 1) : String(h).trim());
    const dados = mat.slice(cab).filter(r => r.some(c => c != null && c !== ''));
    montaMapa(heads, dados);
  };
  const montaMapa = (heads, dados) => {
    const ent = $('#im-ent').value;
    const alvo = ent === '__vendas'
      ? [{ name: 'loja', label: 'Loja (nome, código Alterdata ou CNPJ)', required: true }, { name: 'data', label: 'Data' }, { name: 'ano', label: 'Ano' }, { name: 'mes', label: 'Mês' }, { name: 'valor', label: 'Venda líquida', required: true }, { name: 'atendimentos', label: 'Atendimentos' }, { name: 'ticket', label: 'Ticket médio' }, { name: 'descricao', label: 'Descrição' }]
      : S.meta.entities[ent].fields;
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const palpite = f => { const alvos = [f.name, f.label, ...(f.name === 'unidade_id' || f.name === 'loja' ? ['loja', 'empresa', 'filial', 'unidade'] : []), ...(f.name === 'valor' || f.name === 'valor_mensal' ? ['valor', 'total', 'vendaliquida', 'venda'] : [])].map(norm); return heads.findIndex(h => alvos.some(a => a && (norm(h) === a || norm(h).includes(a)))); };
    $('#im-map').innerHTML = `<h3 style="margin-top:6px">Colunas</h3><p class="dica">${dados.length} linhas encontradas. Deixe em branco o que não existe na planilha. Para lojas e fornecedores, o nome, código ou CNPJ é reconhecido automaticamente.</p>
      <div class="mapa-col">${alvo.map(f => { const g = palpite(f); return `<label>${esc(f.label)}${f.required ? ' *' : ''}</label><select data-m="${f.name}"><option value="">—</option>${heads.map((h, i) => `<option value="${i}"${i === g ? ' selected' : ''}>${esc(h)}</option>`).join('')}</select>`; }).join('')}</div>
      ${ent === '__vendas' ? `<div class="campo mt"><label>Cada linha é</label><select id="im-per"><option>Dia</option><option>Mês</option><option>Ano</option></select><span class="ajuda">Importar de novo o mesmo período da mesma loja substitui a importação anterior.</span></div>` : ''}
      ${ent === 'despesas' ? `<div class="campo mt"><label>Versão destas despesas</label><input type="text" id="im-versao" placeholder="ex.: Financeiro nov/26"><span class="ajuda">Se a planilha não tiver a coluna Versão, todas as linhas recebem esta. Se já existir essa versão, ela é substituída.</span></div>` : ''}
      <div class="acoes mt"><button class="btn prim" id="im-ok">Importar ${dados.length} linhas</button></div>`;
    $('#im-ok').onclick = async () => {
      const mapa = {}; $$('[data-m]').forEach(s => { if (s.value !== '') mapa[s.dataset.m] = Number(s.value); });
      const conv = v => v instanceof Date ? v.toISOString().slice(0, 10) : v;
      const toData = v => { if (typeof v === 'number' && v > 20000 && v < 80000) { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`; } if (typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(v)) { const [dd, mm, yy] = v.slice(0, 10).split('/'); return `${yy}-${mm}-${dd}`; } return conv(v); };
      const tipos = ent === '__vendas' ? { data: 'date' } : Object.fromEntries(S.meta.entities[ent].fields.map(f => [f.name, f.type]));
      const linhas = dados.map(r => { const o = {}; for (const [k, i] of Object.entries(mapa)) { let v = r[i]; if (tipos[k] === 'date') v = toData(v); if (tipos[k] === 'month') { v = toData(v); if (v) v = String(v).slice(0, 7); } o[k] = v; } return o; });
      try {
        $('#im-ok').disabled = true;
        let r;
        if (ent === '__vendas') {
          const bruto = dados.map(row => Object.fromEntries(heads.map((h, i) => [h, conv(row[i])])));
          r = await api('/api/importar/vendas', { method: 'POST', body: { arquivo: nomeArq, linhas, bruto, periodo: $('#im-per').value } });
          $('#im-msg').innerHTML = `<div class="${r.sem_loja.length ? 'aviso' : 'ok'} mt">${esc(r.resumo)}${r.sem_loja.length ? '<br>Cadastre o <b>código Alterdata</b> dessas lojas em Cadastro de lojas e importe de novo.' : ''}</div>`;
        } else {
          const versao = $('#im-versao') && $('#im-versao').value.trim();
          if (versao) linhas.forEach(l => { if (!l.versao) l.versao = versao; });
          r = await api('/api/importar/tabela/' + ent, { method: 'POST', body: { arquivo: nomeArq, linhas, substituir_versao: versao || null } });
          $('#im-msg').innerHTML = `<div class="${r.erros.length ? 'aviso' : 'ok'} mt">${r.ok} linhas importadas.${r.erros.length ? '<br>' + r.erros.map(esc).join('<br>') : ''}</div>`;
          S.cache[ent] = null;
        }
      } catch (err) { $('#im-msg').innerHTML = `<div class="erro mt">${esc(err.message)}</div>`; } finally { $('#im-ok').disabled = false; }
    };
  };
  $('#im-arq').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return; nomeArq = f.name;
    if (!window.XLSX) return $('#im-msg').innerHTML = '<div class="erro">Leitor de planilhas ainda carregando, tente de novo.</div>';
    wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
    $('#im-aba').innerHTML = wb.SheetNames.map(n => `<option>${esc(n)}</option>`).join('');
    lerAba();
  };
  $('#im-aba').onchange = lerAba; $('#im-cab').onchange = lerAba; $('#im-ent').onchange = lerAba;
}

async function pagHistorico(main) {
  const rows = await api('/api/auditoria');
  main.innerHTML = `<div class="cabeca"><div><h1>Histórico de alterações</h1><p>Últimas 300 inclusões, edições e exclusões, com quem fez.</p></div></div>
  <div class="tabela-wrap"><table><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Tabela</th><th>Registro</th><th>Mudanças</th></tr></thead><tbody>
  ${rows.map(r => { let det = ''; try { const d = typeof r.dados === 'string' ? JSON.parse(r.dados) : r.dados; if (r.acao === 'editou' && d) det = Object.entries(d).map(([k, v]) => `${k}: ${esc(v.de)} → ${esc(v.para)}`).join('<br>'); } catch (e) { /* ok */ }
    return `<tr><td>${dataBR(r.criado_em)} ${String(r.criado_em).slice(11, 16)}</td><td>${esc(r.usuario)}</td><td>${esc(r.acao)}</td><td>${esc((S.meta.entities[r.entidade] || {}).label || r.entidade)}</td><td>${r.acao === 'excluiu' ? '#' + r.registro_id : `<a href="#" data-e="${r.entidade}" data-id="${r.registro_id}">#${r.registro_id}</a>`}</td><td style="font-size:12px">${det}</td></tr>`; }).join('') || '<tr><td colspan="6" class="vazio">Nada ainda.</td></tr>'}
  </tbody></table></div>`;
  $$('a[data-e]', main).forEach(a => a.onclick = ev => { ev.preventDefault(); abreForm(a.dataset.e, Number(a.dataset.id)); });
}

async function pagUsuarios(main) {
  const d = await api('/api/usuarios');
  main.innerHTML = `<div class="cabeca"><div><h1>Usuários</h1><p>Quem acessa o portal. <b>Administrador</b>: tudo, inclusive usuários e premissas. <b>Editor</b>: consulta e altera dados. <b>Leitor</b>: só consulta.</p></div></div>
  ${d.email_ativo ? '' : '<div class="aviso">O envio de e-mail ainda não está ligado. Ao convidar alguém, copie o link gerado e mande pelo WhatsApp.</div>'}
  <div class="card"><h3>Convidar</h3><form id="conv" class="duas" style="align-items:end">
    <div class="campo"><label>Nome</label><input type="text" name="nome" required></div><div class="campo"><label>E-mail</label><input type="email" name="email" required></div>
    <div class="campo"><label>Papel</label><select name="papel"><option value="editor">Editor</option><option value="leitor">Leitor</option><option value="admin">Administrador</option></select></div>
    <div class="campo"><button class="btn prim">Convidar</button></div></form><div id="conv-msg"></div></div>
  <div class="tabela-wrap mt"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Situação</th><th></th></tr></thead><tbody>
  ${d.usuarios.map(u => `<tr><td>${esc(u.nome)}</td><td>${esc(u.email)}</td><td><select data-papel="${u.id}"${u.id === S.user.id ? ' disabled' : ''}>${['admin', 'editor', 'leitor'].map(p => `<option value="${p}"${p === u.papel ? ' selected' : ''}>${PAPEL[p]}</option>`).join('')}</select></td>
    <td>${u.pendente ? '<span class="tag ambar">Convite pendente</span>' : u.ativo ? '<span class="tag verde">Ativo</span>' : '<span class="tag">Desativado</span>'}</td>
    <td class="acoes"><button class="btn peq" data-link="${u.id}">Link de senha</button>${u.id === S.user.id ? '' : `<button class="btn peq" data-ativo="${u.id}" data-v="${u.ativo ? 0 : 1}">${u.ativo ? 'Desativar' : 'Reativar'}</button>`}</td></tr>`).join('')}
  </tbody></table></div><div id="link-msg" class="mt"></div>`;
  const mostraLink = (r, alvo) => { $(alvo).innerHTML = `<div class="${r.enviado ? 'ok' : 'aviso'}">${r.enviado ? 'E-mail enviado.' : 'E-mail não enviado.'} Link (vale 3 dias, uso único):<br><input type="text" readonly value="${esc(r.link)}" onclick="this.select()"></div>`; };
  $('#conv').onsubmit = async ev => { ev.preventDefault(); try { const r = await api('/api/usuarios', { method: 'POST', body: Object.fromEntries(new FormData(ev.target)) }); await pagUsuarios(main); mostraLink(r, '#link-msg'); } catch (err) { $('#conv-msg').innerHTML = `<div class="erro mt">${esc(err.message)}</div>`; } };
  $$('[data-papel]', main).forEach(s => s.onchange = async () => { try { await api('/api/usuarios/' + s.dataset.papel, { method: 'PUT', body: { papel: s.value } }); toast('Papel alterado'); } catch (err) { toast(err.message); } });
  $$('[data-ativo]', main).forEach(b => b.onclick = async () => { await api('/api/usuarios/' + b.dataset.ativo, { method: 'PUT', body: { ativo: Number(b.dataset.v) } }); pagUsuarios(main); });
  $$('[data-link]', main).forEach(b => b.onclick = async () => { const r = await api(`/api/usuarios/${b.dataset.link}/link`, { method: 'POST' }); mostraLink(r, '#link-msg'); });
}

async function pagConta(main) {
  main.innerHTML = `<div class="cabeca"><div><h1>Minha conta</h1><p>${esc(S.user.email)} · ${PAPEL[S.user.papel]}</p></div></div>
  <div class="card" style="max-width:460px"><h3>Trocar senha</h3><div id="c-msg"></div><form id="cf">
  <div class="campo"><label>Senha atual</label><input type="password" name="atual" required autocomplete="current-password"></div>
  <div class="campo"><label>Nova senha</label><input type="password" name="nova" required autocomplete="new-password"><span class="ajuda">Mínimo de 8 caracteres, com letras e números.</span></div>
  <button class="btn prim">Salvar</button></form></div>`;
  $('#cf').onsubmit = async ev => { ev.preventDefault(); try { await api('/api/conta/senha', { method: 'POST', body: Object.fromEntries(new FormData(ev.target)) }); $('#c-msg').innerHTML = '<div class="ok">Senha alterada.</div>'; ev.target.reset(); } catch (err) { $('#c-msg').innerHTML = `<div class="erro">${esc(err.message)}</div>`; } };
}

// ============ ROTEADOR ============
async function route() {
  limpaCharts(); $('#modal-root').innerHTML = '';
  const h = (location.hash.replace(/^#\/?/, '') || 'painel').split('?')[0];
  const publicas = { login: pagLogin, esqueci: pagEsqueci, redefinir: pagRedefinir, configurar: pagConfigurar };
  if (publicas[h]) {
    if (h === 'login' || h === 'configurar') { const est = await api('/api/auth/estado'); if (est.user) { location.hash = '#/painel'; return; } if (h === 'login' && est.precisa_configurar && !hashParams().token) { telaAuth('Portal ainda não configurado', 'Use o link de primeiro acesso que você recebeu.', ''); return; } }
    return publicas[h]();
  }
  if (!S.user) { const est = await api('/api/auth/estado'); if (!est.user) { location.hash = '#/login'; return; } S.user = est.user; }
  if (!S.meta) S.meta = await api('/api/meta');
  const main = layout(h);
  main.innerHTML = '<p class="dica">Carregando…</p>';
  try {
    if (h === 'painel') await pagPainel(main);
    else if (h === 'lojas') await pagLojas(main);
    else if (h.startsWith('loja/')) await pagLoja(main, Number(h.split('/')[1]));
    else if (h === 'dividas') await pagDividas(main);
    else if (h === 'potencial') await pagPotencial(main);
    else if (h === 'previsao') await pagPrevisao(main);
    else if (h === 'importar') await pagImportar(main);
    else if (h === 'historico') await pagHistorico(main);
    else if (h === 'usuarios') await pagUsuarios(main);
    else if (h === 'conta') await pagConta(main);
    else if (h.startsWith('e/')) await pagEntidade(main, h.slice(2));
    else main.innerHTML = '<p>Página não encontrada.</p>';
  } catch (err) { main.innerHTML = `<div class="erro">${esc(err.message)}</div>`; }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);
