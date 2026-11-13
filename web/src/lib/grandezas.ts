// As cinco grandezas do portal. A ordem aqui é a ordem do menu e do painel.
export interface Grandeza { chave: string; rota: string; titulo: string; resumo: string; descricao: string; cor: string }

export const OPERACIONAL: Grandeza = {
  chave: 'operacional', rota: '/operacional', titulo: 'Custo operacional', cor: '#16181d',
  resumo: 'Tudo o que custa por mês para manter o negócio aberto.',
  descricao: 'Tudo o que sai todo mês para manter o negócio funcionando: aluguel, contas de consumo, sistemas, manutenção, embalagem, marketing e a folha de pagamento. O aluguel do mês entra aqui; aluguel atrasado ou acordo de imóvel fica em Imóvel.',
};

export const DIVIDAS: Grandeza[] = [
  { chave: 'Pessoas', rota: '/pessoas', titulo: 'Pessoas', cor: '#2563eb',
    resumo: 'Acordos, rescisões, salários atrasados, FGTS e INSS.',
    descricao: 'Tudo o que se deve a pessoas: salários atrasados, rescisões, acordos e processos trabalhistas, FGTS e INSS em aberto. A folha do mês aparece aqui como referência, mas soma no custo operacional.' },
  { chave: 'Fornecedores', rota: '/fornecedores', titulo: 'Fornecedores', cor: '#d71920',
    resumo: 'Dívidas com fábricas e representantes de mercadoria.',
    descricao: 'Todas as dívidas com fornecedores de mercadoria, sejam fábricas ou representantes. O cadastro de fornecedores fica na segunda aba.' },
  { chave: 'Imóvel', rota: '/imovel', titulo: 'Imóvel', cor: '#b26b00',
    resumo: 'Aluguéis atrasados, acordos com proprietários, IPTU e condomínio.',
    descricao: 'Dívidas e acordos ligados aos imóveis: aluguel atrasado, acordos com proprietários, IPTU e condomínio em aberto. O aluguel do mês não entra aqui, porque é custo operacional.' },
  { chave: 'Governo', rota: '/governo', titulo: 'Governo', cor: '#7c3aed',
    resumo: 'Impostos, multas e dívidas fiscais.',
    descricao: 'Impostos em aberto, multas e dívidas fiscais ou parcelamentos com a Receita, o Estado e a Prefeitura.' },
];

export const TODAS = [OPERACIONAL, ...DIVIDAS];
