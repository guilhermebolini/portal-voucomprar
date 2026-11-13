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
    nome: 'contracheques-2026-10',
    // Contracheques de out/2026 (ContraCheque.pdf): completa o cadastro dos colaboradores pela matrícula,
    // grava um contracheque por pessoa e lança na folha de out/26 (loja R3) os proventos e o FGTS.
    async rodar(conn) {
      const dados = require(path.join(__dirname, 'cargas', 'contracheques-2026-10.json'));
      const [[loja]] = await conn.query('SELECT id FROM unidades WHERE codigo = ? LIMIT 1', [dados.unidade]);
      const unidade_id = loja ? loja.id : null;
      const folha = {};
      for (const i of dados.itens) {
        const c = i.colaborador;
        const [ach] = await conn.query('SELECT id, observacoes FROM colaboradores WHERE matricula = ? OR nome = ? ORDER BY matricula = ? DESC LIMIT 1', [c.matricula, c.nome, c.matricula]);
        const obs = `Dados do contracheque ${i.contracheque.competencia} (${dados.fonte}).`;
        const reg = { ...c, unidade_id, situacao: 'Ativo', fonte: dados.fonte };
        let colaborador_id;
        if (ach.length) {
          colaborador_id = ach[0].id;
          reg.observacoes = [ach[0].observacoes, obs].filter(Boolean).join('\n');
          await conn.query('UPDATE colaboradores SET ? WHERE id = ?', [reg, colaborador_id]);
        } else {
          const [r] = await conn.query('INSERT INTO colaboradores SET ?', [{ ...reg, observacoes: obs }]);
          colaborador_id = r.insertId;
        }
        const cc = i.contracheque;
        await conn.query('DELETE FROM contracheques WHERE colaborador_id = ? AND competencia = ?', [colaborador_id, cc.competencia]);
        await conn.query('INSERT INTO contracheques SET ?', [{ ...cc, colaborador_id, unidade_id, fonte: dados.fonte }]);
        const soma = (g, v) => { if (v) folha[g] = (folha[g] || 0) + v; };
        soma('Salários', cc.salario_base); soma('Bonificação', cc.gratificacao); soma('Horas extras', cc.horas_extras);
        soma('Quebra de caixa', cc.quebra_caixa); soma('FGTS', cc.fgts);
      }
      const comp = dados.itens[0].contracheque.competencia;
      await conn.query('DELETE FROM folha WHERE competencia = ? AND fonte = ?', [comp, dados.fonte]);
      for (const [grupo, valor] of Object.entries(folha))
        await conn.query('INSERT INTO folha SET ?', [{ competencia: comp, unidade_id, grupo, valor: Math.round(valor * 100) / 100, status: 'A confirmar', fonte: dados.fonte, observacoes: `Soma dos ${dados.itens.length} contracheques de ${comp}. Proventos + FGTS; descontos do empregado não entram.` }]);
      await conn.query('INSERT INTO importacoes (tipo, arquivo, linhas, usuario) VALUES (?,?,?,?)', ['contracheques', 'ContraCheque.pdf', dados.itens.length, 'carga automática']);
      return `${dados.itens.length} contracheques`;
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
