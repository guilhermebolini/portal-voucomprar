// Cargas de dados pontuais pedidas pelo Guilherme. Cada carga roda uma única vez por banco
// (fica registrada na tabela `cargas`), na subida do servidor, depois do seed.
const path = require('path');

const CARGAS = [
  {
    nome: 'fornecedores-2026-11-13',
    // Substitui TODOS os fornecedores e dívidas com fornecedores pela aba "EMPRESAS COM DIVIDA".
    async rodar(conn) {
      const dados = require(path.join(__dirname, 'cargas', 'fornecedores-2026-11-13.json'));
      await conn.query("DELETE FROM passivos WHERE grandeza = 'Fornecedores' OR categoria IN ('Fornecedores', 'Mercadoria - fábrica', 'Mercadoria - representante')");
      await conn.query('UPDATE passivos SET fornecedor_id = NULL WHERE fornecedor_id IS NOT NULL');
      await conn.query('DELETE FROM fornecedores');
      for (const i of dados.itens) {
        const [f] = await conn.query('INSERT INTO fornecedores SET ?', [{ nome: i.empresa, tipo: 'Fábrica', representante: i.representante, observacoes: dados.fonte }]);
        await conn.query('INSERT INTO passivos SET ?', [{
          grandeza: 'Fornecedores', categoria: 'Mercadoria - fábrica', credor: i.empresa, representante: i.representante,
          fornecedor_id: f.insertId, descricao: `Dívida de mercadoria${i.representante ? ' (representante ' + i.representante + ')' : ''}`,
          valor_original: i.valor, valor_atual: i.valor, situacao: 'Em aberto', fonte: dados.fonte,
        }]);
      }
      await conn.query('INSERT INTO importacoes (tipo, arquivo, linhas, usuario) VALUES (?,?,?,?)', ['fornecedores', 'PLANILHA PRINCIPAL.xlsx / EMPRESAS COM DIVIDA', dados.itens.length, 'carga automática']);
      return `${dados.itens.length} empresas`;
    },
  },
  {
    nome: 'contracheques-2026-10b',
    // Contracheques de out/2026 (pasta do Drive, 58 pessoas): completa o cadastro dos colaboradores pela matrícula
    // (ou nome), grava um contracheque por pessoa e lança na folha de out/26 só as lojas que a planilha FINANCEIRO
    // não cobre (R3), para não contar duas vezes.
    async rodar(conn) {
      const dados = require(path.join(__dirname, 'cargas', 'contracheques-2026-10.json'));
      const [unids] = await conn.query('SELECT id, codigo FROM unidades');
      const U = Object.fromEntries(unids.map(u => [u.codigo, u.id]));
      const folha = {};
      let novos = 0;
      for (const i of dados.itens) {
        const c = i.colaborador, cc = i.contracheque;
        const unidade_id = i.lotacao ? (U[i.lotacao] || null) : null;
        const [ach] = await conn.query('SELECT id, observacoes, unidade_id FROM colaboradores WHERE matricula = ? OR nome = ? ORDER BY matricula = ? DESC LIMIT 1', [c.matricula, c.nome, c.matricula]);
        const obs = `Dados do contracheque ${cc.competencia}.${cc.alertas ? ' ' + cc.alertas + '.' : ''}`;
        const reg = { ...c, fonte: dados.fonte };
        if (unidade_id) reg.unidade_id = unidade_id;
        let colaborador_id;
        if (ach.length) {
          colaborador_id = ach[0].id;
          const antes = String(ach[0].observacoes || '').split('\n').filter(l => !l.startsWith('Dados do contracheque')).join('\n');
          reg.observacoes = [antes, obs].filter(Boolean).join('\n');
          await conn.query('UPDATE colaboradores SET ? WHERE id = ?', [reg, colaborador_id]);
        } else {
          const [r] = await conn.query('INSERT INTO colaboradores SET ?', [{ ...reg, observacoes: obs }]);
          colaborador_id = r.insertId; novos++;
        }
        await conn.query('DELETE FROM contracheques WHERE colaborador_id = ? AND competencia = ?', [colaborador_id, cc.competencia]);
        await conn.query('INSERT INTO contracheques SET ?', [{ ...cc, colaborador_id, unidade_id: unidade_id || ach[0]?.unidade_id || null, fonte: dados.fonte }]);
        if (!dados.folha_so_lotacao.includes(i.lotacao)) continue;
        const f = folha[i.lotacao] ||= {};
        const soma = (g, v) => { if (v) f[g] = (f[g] || 0) + v; };
        soma('Salários', cc.salario_base); soma('Bonificação', cc.gratificacao); soma('Horas extras', cc.horas_extras);
        soma('Quebra de caixa', cc.quebra_caixa); soma('Férias', cc.ferias); soma('Benefícios', cc.outros_proventos);
        soma('Faltas', -cc.faltas_atrasos); soma('FGTS', cc.fgts);
      }
      const comp = dados.itens[0].contracheque.competencia;
      await conn.query("DELETE FROM folha WHERE competencia = ? AND fonte LIKE 'ContraCheque%'", [comp]); // lançamento da versão anterior desta carga
      await conn.query('DELETE FROM folha WHERE competencia = ? AND fonte = ?', [comp, dados.fonte]);
      for (const [loja, grupos] of Object.entries(folha))
        for (const [grupo, valor] of Object.entries(grupos))
          await conn.query('INSERT INTO folha SET ?', [{ competencia: comp, unidade_id: U[loja] || null, grupo, valor: Math.round(valor * 100) / 100, status: 'A confirmar', fonte: dados.fonte, observacoes: 'Soma dos contracheques da loja. Proventos − faltas + FGTS; descontos do empregado e salário-família não entram.' }]);
      await conn.query('INSERT INTO importacoes (tipo, arquivo, linhas, usuario) VALUES (?,?,?,?)', ['contracheques', 'Contracheques out/2026 (10 PDFs)', dados.itens.length, 'carga automática']);
      return `${dados.itens.length} contracheques, ${novos} colaboradores novos`;
    },
  },
];

async function run(pool) {
  await pool.query('CREATE TABLE IF NOT EXISTS cargas (nome VARCHAR(80) PRIMARY KEY, feita_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, resultado VARCHAR(255)) DEFAULT CHARSET=utf8mb4');
  for (const c of CARGAS) {
    const [ja] = await pool.query('SELECT 1 FROM cargas WHERE nome = ?', [c.nome]);
    if (ja.length) continue;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const r = await c.rodar(conn);
      await conn.query('INSERT INTO cargas (nome, resultado) VALUES (?, ?)', [c.nome, String(r || '').slice(0, 250)]);
      await conn.commit();
      console.log('Carga', c.nome, 'feita:', r);
    } catch (e) { await conn.rollback(); console.error('Carga', c.nome, 'falhou:', e.message); }
    finally { conn.release(); }
  }
}

module.exports = { run };
