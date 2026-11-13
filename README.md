# Portal Vou Comprar

Portal de avaliação da rede Vou Comprar (voucomprar.bolinao.com.br). Node.js (Express) + MySQL, front-end em JS puro (`public/`).

- `schema.js`: tabelas e campos (geram banco, API e telas).
- `seed.json`: carga inicial gerada das planilhas da pasta LOJAS VOU COMPRAR (só roda com banco vazio).
- `auth.js`: login por e-mail, recuperação de senha, convites, papéis (admin, editor, leitor).

Variáveis de ambiente: `DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD` (criadas pela Hostinger), `SESSION_SECRET`, `SETUP_TOKEN` (link de primeiro acesso), `APP_URL`, `SMTP_PASS` (+ opcionais `SMTP_USER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`), `QIVE_API_ID`, `QIVE_API_KEY`.
