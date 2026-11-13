'use strict';
// Carga inicial: só roda com o banco vazio. Dados vindos das planilhas da pasta LOJAS VOU COMPRAR.
const data = require('./seed.json');
const { entities } = require('./schema');

async function run(pool) {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM unidades');
  if (n > 0) return;
  console.log('Carregando dados iniciais...');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ins = async (ent, row) => {
      const fields = new Set(entities[ent].fields.map(f => f.name));
      const clean = {}; for (const [k, v] of Object.entries(row)) if (fields.has(k) && v !== undefined) clean[k] = v;
      clean.atualizado_por = 'carga inicial';
      const [r] = await conn.query(`INSERT INTO \`${ent}\` SET ?`, [clean]);
      return r.insertId;
    };
    const U = {}; for (const u of data.unidades) U[u.codigo] = await ins('unidades', u);
    const Fo = {}; for (const f of data.fornecedores) Fo[f.nome] = await ins('fornecedores', f);
    const withU = r => { const o = { ...r }; if (o.unidade) o.unidade_id = U[o.unidade] || null; delete o.unidade; if (o.fornecedor) o.fornecedor_id = Fo[o.fornecedor] || null; delete o.fornecedor; return o; };
    for (const ent of ['despesas', 'imoveis', 'folha', 'colaboradores', 'quadro', 'passivos', 'ativos', 'vendas', 'potencial', 'planos_acao', 'anotacoes', 'parametros'])
      for (const r of data[ent] || []) await ins(ent, withU(r));
    await conn.commit();
    console.log('Carga inicial concluída');
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}
module.exports = { run };
