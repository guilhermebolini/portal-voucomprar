// Metadados das entidades: geram as tabelas MySQL, a API e as telas do portal.
// Tipos: text, longtext, int, number, money, date, month, select, ref, bool

const SITUACAO_VER = ['A verificar', 'Confirmado'];

// As cinco grandezas do portal: custo operacional (mensal) + quatro tipos de dívida.
const GRANDEZAS_DIVIDA = ['Pessoas', 'Fornecedores', 'Imóvel', 'Governo', 'Outros'];
const TIPOS_DIVIDA = {
  Pessoas: ['Salários atrasados', 'Rescisões', 'Acordos trabalhistas / processos', 'FGTS', 'INSS', 'Outros com pessoas'],
  Fornecedores: ['Mercadoria - fábrica', 'Mercadoria - representante', 'Fornecedores'],
  'Imóvel': ['Aluguel atrasado', 'Acordo de imóvel', 'IPTU / condomínio'],
  Governo: ['Impostos', 'Multas', 'Dívida fiscal / parcelamento'],
  Outros: ['Bancos / empréstimos', 'Consórcios', 'Outros'],
};
// nomes antigos de categoria -> tipo novo
const TIPO_ANTIGO = {
  'Trabalhista - salários atrasados': 'Salários atrasados', 'Trabalhista - rescisões': 'Rescisões',
  'Trabalhista - acordos/processos': 'Acordos trabalhistas / processos', 'Aluguéis': 'Aluguel atrasado',
  'Bancos/Empréstimos': 'Bancos / empréstimos',
};
const entities = {
  unidades: {
    label: 'Lojas e setores', singular: 'Unidade', display: 'nome', order: 'tipo DESC, nome',
    fields: [
      { name: 'codigo', label: 'Código', type: 'text', required: true, list: true },
      { name: 'nome', label: 'Nome', type: 'text', required: true, list: true },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['Loja', 'Centro de custo'], list: true },
      { name: 'situacao', label: 'Situação', type: 'select', options: ['Em operação', 'Encerrada', 'A confirmar'], list: true },
      { name: 'razao_social', label: 'Razão social', type: 'text' },
      { name: 'cnpj', label: 'CNPJ', type: 'text', list: true },
      { name: 'inscricao_estadual', label: 'Inscrição estadual', type: 'text' },
      { name: 'inscricao_municipal', label: 'Inscrição municipal', type: 'text' },
      { name: 'cnpj_anterior', label: 'CNPJ anterior (AISMA)', type: 'text' },
      { name: 'ie_anterior', label: 'IE anterior', type: 'text' },
      { name: 'telefone', label: 'Telefone', type: 'text' },
      { name: 'email', label: 'E-mail', type: 'text' },
      { name: 'codigo_alterdata', label: 'Código empresa Alterdata', type: 'text', help: 'Código da empresa/loja no iShop. Usado para casar as importações.' },
      { name: 'bairro', label: 'Bairro', type: 'text', list: true },
      { name: 'endereco', label: 'Endereço', type: 'text' },
      { name: 'area_m2', label: 'Área (m²)', type: 'number' },
      { name: 'gerente', label: 'Gerente / responsável', type: 'text', list: true },
      { name: 'headcount_informado', label: 'Nº pessoas (informado)', type: 'int', list: true },
      { name: 'observacoes', label: 'Observações', type: 'longtext' },
    ],
  },
  vendas: {
    label: 'Vendas', singular: 'Registro de venda', display: 'descricao', order: 'ano DESC, unidade_id',
    fields: [
      { name: 'unidade_id', label: 'Loja', type: 'ref', ref: 'unidades', list: true, required: true },
      { name: 'periodo', label: 'Período', type: 'select', options: ['Ano', 'Mês', 'Dia'], list: true, required: true },
      { name: 'ano', label: 'Ano', type: 'int', list: true, required: true },
      { name: 'mes', label: 'Mês', type: 'int', list: true },
      { name: 'data', label: 'Data', type: 'date', list: true },
      { name: 'meses', label: 'Meses cobertos', type: 'int', help: 'Para período Ano: 12, ou 9 se for jan–set.' },
      { name: 'valor', label: 'Venda líquida (R$)', type: 'money', list: true, sum: true },
      { name: 'atendimentos_mes', label: 'Atendimentos/mês', type: 'int', list: true },
      { name: 'ticket_medio', label: 'Ticket médio (R$)', type: 'money', list: true },
      { name: 'descricao', label: 'Descrição', type: 'text', list: true },
      { name: 'fonte', label: 'Fonte', type: 'text', list: true },
    ],
  },
  potencial: {
    label: 'Potencial de venda', singular: 'Potencial', display: 'unidade_id', order: 'venda_2022 DESC',
    fields: [
      { name: 'unidade_id', label: 'Loja', type: 'ref', ref: 'unidades', list: true, required: true },
      { name: 'venda_2022', label: 'Venda 2022 (R$/ano)', type: 'money', list: true, sum: true },
      { name: 'venda_2025', label: 'Venda 2025 (R$/ano)', type: 'money', list: true, sum: true },
      { name: 'compativel_min', label: 'Compatível com mercado, mín. (R$/ano)', type: 'money', list: true, sum: true },
      { name: 'compativel_max', label: 'Compatível com mercado, máx. (R$/ano)', type: 'money', list: true, sum: true },
      { name: 'meta_comprador', label: 'Meta do comprador (R$/ano)', type: 'money', list: true, sum: true, help: 'Sua meta realista de venda para a loja.' },
      { name: 'premissas', label: 'Premissas', type: 'longtext' },
      { name: 'fonte', label: 'Fonte', type: 'text' },
    ],
  },
  despesas: {
    label: 'Despesas', singular: 'Despesa', display: 'linha', order: 'versao, unidade_id, grupo, linha',
    fields: [
      { name: 'unidade_id', label: 'Loja / setor', type: 'ref', ref: 'unidades', list: true },
      { name: 'grupo', label: 'Grupo', type: 'select', options: ['Ocupação', 'Utilidades', 'Manutenção', 'Marketing', 'Sistemas e TI', 'Embalagem e limpeza', 'Pessoal (outros)', 'Financeiro', 'Impostos', 'Outros'], list: true, required: true },
      { name: 'linha', label: 'Linha de despesa', type: 'text', list: true, required: true },
      { name: 'valor_mensal', label: 'Valor mensal (R$)', type: 'money', list: true, sum: true },
      { name: 'versao', label: 'Versão / fonte', type: 'select', options: ['Financeiro out/26', 'Evidência BPO', 'Informado Guilherme', 'Ajustado (comprador)'], list: true, required: true, help: 'O painel calcula com uma versão por vez.' },
      { name: 'competencia', label: 'Competência', type: 'month', list: true },
      { name: 'recorrente', label: 'Recorrente', type: 'bool' },
      { name: 'observacoes', label: 'Observações', type: 'longtext' },
    ],
  },
  imoveis: {
    label: 'Imóveis e aluguéis', singular: 'Imóvel', display: 'unidade_id', order: 'unidade_id',
    fields: [
      { name: 'unidade_id', label: 'Loja', type: 'ref', ref: 'unidades', list: true, required: true },
      { name: 'locador', label: 'Locador / imobiliária', type: 'text', list: true },
      { name: 'valor_aluguel', label: 'Aluguel informado (R$)', type: 'money', list: true, sum: true },
      { name: 'valor_evidencia_bpo', label: 'Aluguel na evidência BPO (R$)', type: 'money', list: true, sum: true },
      { name: 'iptu_mensal', label: 'IPTU mensal (R$)', type: 'money' },
      { name: 'condominio', label: 'Condomínio (R$)', type: 'money' },
      { name: 'inicio_contrato', label: 'Início do contrato', type: 'date' },
      { name: 'fim_contrato', label: 'Fim do contrato', type: 'date', list: true },
      { name: 'indice_reajuste', label: 'Índice de reajuste', type: 'text' },
      { name: 'garantia', label: 'Garantia (fiador, caução...)', type: 'text' },
      { name: 'meses_atraso', label: 'Meses em atraso', type: 'int', list: true },
      { name: 'valor_em_atraso', label: 'Valor em atraso (R$)', type: 'money', list: true, sum: true },
      { name: 'situacao', label: 'Situação', type: 'select', options: ['Em dia', 'Atrasado', 'Em negociação', 'A verificar'], list: true },
      { name: 'observacoes', label: 'Observações', type: 'longtext' },
      { name: 'fonte', label: 'Fonte', type: 'text' },
    ],
  },
  colaboradores: {
    label: 'Colaboradores', singular: 'Colaborador', display: 'nome', order: 'nome',
    fields: [
      { name: 'nome', label: 'Nome', type: 'text', list: true, required: true },
      { name: 'matricula', label: 'Matrícula', type: 'text', list: true },
      { name: 'cargo', label: 'Cargo / função', type: 'text', list: true },
      { name: 'unidade_id', label: 'Lotação principal', type: 'ref', ref: 'unidades', list: true },
      { name: 'rateio', label: 'Rateio entre lojas', type: 'text', list: true },
      { name: 'salario', label: 'Salário (R$)', type: 'money', list: true, sum: true },
      { name: 'admissao', label: 'Admissão', type: 'date' },
      { name: 'situacao', label: 'Situação', type: 'select', options: ['Ativo', 'Afastado', 'Desligado', 'A confirmar'], list: true },
      { name: 'salario_atrasado', label: 'Salário em atraso (R$)', type: 'money', list: true, sum: true },
      { name: 'rescisao_estimada', label: 'Rescisão estimada (R$)', type: 'money', list: true, sum: true },
      { name: 'observacoes', label: 'Observações', type: 'longtext' },
      { name: 'fonte', label: 'Fonte', type: 'text' },
    ],
  },
  folha: {
    label: 'Folha de pagamento', singular: 'Lançamento de folha', display: 'grupo', order: 'competencia DESC, unidade_id, grupo',
    fields: [
      { name: 'competencia', label: 'Competência', type: 'month', list: true, required: true },
      { name: 'unidade_id', label: 'Loja / setor', type: 'ref', ref: 'unidades', list: true },
      { name: 'grupo', label: 'Grupo', type: 'select', options: ['Salários', 'Encargos', 'FGTS', 'INSS', 'Horas extras', 'Faltas', 'Passagem / VT', 'Vales e adiantamentos', 'Empréstimos consignados', 'Salário família / pensão', 'Bonificação', 'Contribuição negocial', 'Quebra de caixa', 'Benefícios', 'Ajuste', 'Férias', '13º salário', 'Multa FGTS', 'Rescisões', 'Pró-labore', 'Outros'], list: true, required: true },
      { name: 'valor', label: 'Valor (R$)', type: 'money', list: true, sum: true },
      { name: 'status', label: 'Pagamento', type: 'select', options: ['Pago', 'Em aberto', 'Parcial', 'A confirmar'], list: true },
      { name: 'fonte', label: 'Fonte', type: 'text', list: true },
      { name: 'observacoes', label: 'Observações', type: 'longtext' },
    ],
  },
  quadro: {
    label: 'Quadro de cargos', singular: 'Cargo', display: 'cargo', order: 'unidade_id, salario_base DESC',
    fields: [
      { name: 'unidade_id', label: 'Loja / setor', type: 'ref', ref: 'unidades', list: true, required: true },
      { name: 'cargo', label: 'Cargo', type: 'text', list: true, required: true },
      { name: 'quantidade', label: 'Quantidade', type: 'int', list: true, sum: true },
      { name: 'salario_base', label: 'Salário base (R$)', type: 'money', list: true, sum: true },
      { name: 'colaborador', label: 'Ocupante', type: 'text', list: true },
      { name: 'fonte', label: 'Fonte', type: 'text' },
      { name: 'observacoes', label: 'Observações', type: 'longtext' },
    ],
  },
  fornecedores: {
    label: 'Fornecedores', singular: 'Fornecedor', display: 'nome', order: 'nome',
    fields: [
      { name: 'nome', label: 'Nome', type: 'text', list: true, required: true },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['Representante', 'Fábrica', 'Distribuidor', 'Prestador de serviço', 'A classificar'], list: true },
      { name: 'representante', label: 'Representante', type: 'text', list: true },
      { name: 'marcas', label: 'Marcas / fábricas', type: 'text', list: true },
      { name: 'cnpj', label: 'CNPJ', type: 'text' },
      { name: 'contato', label: 'Contato', type: 'text', list: true },
      { name: 'telefone', label: 'Telefone', type: 'text' },
      { name: 'email', label: 'E-mail', type: 'text' },
      { name: 'essencial', label: 'Essencial para o mix', type: 'bool', list: true },
      { name: 'observacoes', label: 'Observações', type: 'longtext' },
    ],
  },
  passivos: {
    label: 'Dívidas', singular: 'Dívida', display: 'descricao', order: "FIELD(grandeza,'Pessoas','Fornecedores','Imóvel','Governo','Outros'), categoria, valor_atual DESC",
    fields: [
      { name: 'grandeza', label: 'Grandeza', type: 'select', options: GRANDEZAS_DIVIDA, list: true, required: true, help: 'Pessoas, Fornecedores, Imóvel ou Governo. Aluguel do mês não entra aqui: é custo operacional (Despesas).' },
      { name: 'categoria', label: 'Tipo', type: 'select', options: Object.values(TIPOS_DIVIDA).flat(), dependeDe: 'grandeza', opcoesPor: TIPOS_DIVIDA, list: true, required: true },
      { name: 'credor', label: 'Credor', type: 'text', list: true },
      { name: 'representante', label: 'Representante', type: 'text', list: true, help: 'Para dívidas com fornecedor: quem representa a empresa.' },
      { name: 'fornecedor_id', label: 'Fornecedor (se houver)', type: 'ref', ref: 'fornecedores' },
      { name: 'unidade_id', label: 'Loja (se houver)', type: 'ref', ref: 'unidades' },
      { name: 'descricao', label: 'Descrição', type: 'text', list: true },
      { name: 'valor_original', label: 'Valor original (R$)', type: 'money', sum: true },
      { name: 'valor_atual', label: 'Saldo atual (R$)', type: 'money', list: true, sum: true },
      { name: 'parcela_mensal', label: 'Parcela mensal (R$)', type: 'money', list: true, sum: true },
      { name: 'parcelas_restantes', label: 'Parcelas restantes', type: 'int' },
      { name: 'vencimento', label: 'Vencimento', type: 'date' },
      { name: 'situacao', label: 'Situação', type: 'select', options: ['Em aberto', 'Em negociação', 'Parcelado', 'Pago', 'A verificar', 'Substituído'], list: true, help: 'Pago e Substituído não entram no total.' },
      { name: 'prioridade', label: 'Prioridade', type: 'select', options: ['Alta', 'Média', 'Baixa'], list: true },
      { name: 'fonte', label: 'Fonte', type: 'text' },
      { name: 'observacoes', label: 'Observações', type: 'longtext' },
    ],
  },
  ativos: {
    label: 'Ativos', singular: 'Ativo', display: 'descricao', order: 'categoria',
    fields: [
      { name: 'categoria', label: 'Categoria', type: 'select', options: ['Saldo bancário', 'Contas a receber (cartões)', 'Títulos', 'Consórcios', 'Estoque', 'Imobilizado', 'Outros'], list: true, required: true },
      { name: 'descricao', label: 'Descrição', type: 'text', list: true },
      { name: 'unidade_id', label: 'Loja (se houver)', type: 'ref', ref: 'unidades', list: true },
      { name: 'valor', label: 'Valor (R$)', type: 'money', list: true, sum: true },
      { name: 'data_base', label: 'Data-base', type: 'date', list: true },
      { name: 'situacao', label: 'Situação', type: 'select', options: ['Confirmado', 'Estimado', 'A levantar'], list: true },
      { name: 'fonte', label: 'Fonte', type: 'text' },
      { name: 'observacoes', label: 'Observações', type: 'longtext' },
    ],
  },
  planos_acao: {
    label: 'Planos de ação', singular: 'Ação', display: 'titulo', order: "FIELD(status,'Em andamento','A fazer','Bloqueado','Concluído'), FIELD(prioridade,'Alta','Média','Baixa'), id",
    fields: [
      { name: 'titulo', label: 'Ação', type: 'text', list: true, required: true },
      { name: 'area', label: 'Área', type: 'select', options: ['Imóveis', 'Pessoal', 'Fornecedores', 'Impostos', 'Custo operacional', 'Financeiro', 'Consórcios', 'Taxas', 'Vendas', 'Sistemas/Alterdata', 'Jurídico', 'Outros'], list: true },
      { name: 'unidade_id', label: 'Loja (se houver)', type: 'ref', ref: 'unidades' },
      { name: 'prioridade', label: 'Prioridade', type: 'select', options: ['Alta', 'Média', 'Baixa'], list: true },
      { name: 'status', label: 'Status', type: 'select', options: ['A fazer', 'Em andamento', 'Bloqueado', 'Concluído'], list: true },
      { name: 'responsavel', label: 'Responsável', type: 'text', list: true },
      { name: 'prazo', label: 'Prazo', type: 'date', list: true },
      { name: 'impacto_mensal', label: 'Impacto mensal (R$)', type: 'money', list: true, sum: true, help: 'Economia ou ganho mensal esperado (+) ou custo (−).' },
      { name: 'impacto_unico', label: 'Impacto único (R$)', type: 'money', sum: true },
      { name: 'descricao', label: 'Detalhes', type: 'longtext' },
    ],
  },
  anotacoes: {
    label: 'Informações levantadas', singular: 'Informação', display: 'item', order: 'topico, id',
    fields: [
      { name: 'topico', label: 'Tópico', type: 'select', options: ['Geral', 'Vendas', 'Pessoal', 'Fornecedores', 'Imóveis', 'Financeiro', 'Impostos', 'Sistemas', 'Outros'], list: true },
      { name: 'item', label: 'Item', type: 'text', list: true, required: true },
      { name: 'informacao', label: 'Informação / valor', type: 'text', list: true },
      { name: 'status', label: 'Status', type: 'select', options: SITUACAO_VER, list: true },
      { name: 'fonte', label: 'Fonte', type: 'text', list: true },
      { name: 'observacoes', label: 'Observações', type: 'longtext' },
    ],
  },
  parametros: {
    label: 'Premissas', singular: 'Premissa', display: 'chave', order: 'chave',
    fields: [
      { name: 'chave', label: 'Chave', type: 'text', list: true, required: true },
      { name: 'valor', label: 'Valor', type: 'text', list: true },
      { name: 'descricao', label: 'Descrição', type: 'longtext', list: true },
    ],
  },
};

const SQLTYPE = {
  text: 'VARCHAR(255)', longtext: 'TEXT', int: 'INT', number: 'DECIMAL(14,2)', money: 'DECIMAL(16,2)',
  date: 'DATE', month: 'VARCHAR(7)', select: 'VARCHAR(80)', ref: 'INT', bool: 'TINYINT(1)',
};

function ddl() {
  const out = [];
  for (const [name, e] of Object.entries(entities)) {
    const cols = ['id INT AUTO_INCREMENT PRIMARY KEY'];
    for (const f of e.fields) cols.push(`\`${f.name}\` ${SQLTYPE[f.type]} NULL`);
    cols.push('criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'atualizado_por VARCHAR(120) NULL');
    for (const f of e.fields) if (f.type === 'ref') cols.push(`INDEX (\`${f.name}\`)`);
    out.push(`CREATE TABLE IF NOT EXISTS \`${name}\` (${cols.join(', ')}) DEFAULT CHARSET=utf8mb4`);
  }
  out.push(`CREATE TABLE IF NOT EXISTS usuarios (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(160) UNIQUE, nome VARCHAR(120), senha_hash VARCHAR(255), papel VARCHAR(20) DEFAULT 'editor', ativo TINYINT(1) DEFAULT 1, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP) DEFAULT CHARSET=utf8mb4`);
  out.push(`CREATE TABLE IF NOT EXISTS senha_tokens (id INT AUTO_INCREMENT PRIMARY KEY, usuario_id INT, token_hash CHAR(64), tipo VARCHAR(20), expira_em DATETIME, usado_em DATETIME NULL, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(token_hash)) DEFAULT CHARSET=utf8mb4`);
  out.push(`CREATE TABLE IF NOT EXISTS auditoria (id INT AUTO_INCREMENT PRIMARY KEY, entidade VARCHAR(60), registro_id INT, acao VARCHAR(20), usuario VARCHAR(160), dados JSON NULL, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(entidade, registro_id)) DEFAULT CHARSET=utf8mb4`);
  out.push(`CREATE TABLE IF NOT EXISTS importacoes (id INT AUTO_INCREMENT PRIMARY KEY, tipo VARCHAR(60), arquivo VARCHAR(255), linhas INT, usuario VARCHAR(160), resumo TEXT, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP) DEFAULT CHARSET=utf8mb4`);
  out.push(`CREATE TABLE IF NOT EXISTS alterdata_bruto (id INT AUTO_INCREMENT PRIMARY KEY, importacao_id INT, linha JSON, INDEX(importacao_id)) DEFAULT CHARSET=utf8mb4`);
  return out;
}

// Para bancos já criados: adiciona colunas novas sem perder dados
async function migrate(pool) {
  for (const s of ddl()) await pool.query(s);
  const [rows] = await pool.query('SELECT TABLE_NAME t, COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()');
  const have = new Set(rows.map(r => r.t + '.' + r.c));
  for (const [name, e] of Object.entries(entities))
    for (const f of e.fields)
      if (!have.has(name + '.' + f.name)) await pool.query(`ALTER TABLE \`${name}\` ADD COLUMN \`${f.name}\` ${SQLTYPE[f.type]} NULL`);
}

// Reclassifica dívidas antigas nas grandezas (roda a cada início; só mexe no que está sem grandeza ou com nome antigo).
async function reclassifica(pool) {
  for (const [a, n] of Object.entries(TIPO_ANTIGO)) await pool.query('UPDATE passivos SET categoria = ? WHERE categoria = ?', [n, a]);
  for (const [g, tipos] of Object.entries(TIPOS_DIVIDA)) {
    await pool.query(`UPDATE passivos SET grandeza = ? WHERE (grandeza IS NULL OR grandeza = '') AND categoria IN (${tipos.map(() => '?').join(',')})`, [g, ...tipos]);
  }
  await pool.query("UPDATE passivos SET grandeza = 'Outros' WHERE grandeza IS NULL OR grandeza = ''");
}

module.exports = { entities, migrate, reclassifica, GRANDEZAS_DIVIDA, TIPOS_DIVIDA };
