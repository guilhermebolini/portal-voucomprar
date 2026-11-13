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
