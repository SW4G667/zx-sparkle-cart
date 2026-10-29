# Cloud — atualização R77

## Suporte organizado em tabelas

- **Administração → Atendimentos**: tabela dos tickets da plataforma, com cliente, aplicação, assunto, estado, atualização e botão **Conversar**. Busca, filtros, indicadores de novas mensagens e paginação ajudam a encontrar cada atendimento.
- **Suporte da plataforma → Meus tickets de suporte**: o cliente vê o atendimento da aplicação e abre a conversa pela tabela. O primeiro envio cria o ticket; novas mensagens reabrem um atendimento encerrado, preservando o histórico.
- **Tickets de clientes**: os atendimentos sincronizados do Discord também usam tabela, com prioridade e acesso à conversa. As respostas seguem pelo bot ou webhook já configurado nas preferências de atendimento.
- Ao alternar tickets, os rascunhos ficam guardados na memória desta página. Recarregar ou sair da página descarta os rascunhos que ainda não foram enviados. O envio usa o identificador do ticket escolhido, ignora respostas de consultas antigas e conserva a solicitação para uma repetição segura após falha de rede.
- A confirmação de uma resposta ao Discord continua dependendo do bot. O site diferencia **na fila** de **entregue**.
- A consulta lista até 50 atendimentos recentes da plataforma e 100 tickets recentes do Discord. Há 12 linhas por página e carregamento de mensagens anteriores nas conversas. A atualização automática ocorre enquanto a página está visível.

## Loja

- Catálogo em cards ou tabela, com preferência de visualização salva neste navegador.
- Busca por nome, descrição ou identificador; filtros por entrega e estado; ordenação e paginação.
- Prévia do produto, edição, criação de cópia e histórico das alterações.
- Modelos de produto e configuração opcional da primeira opção, incluindo preço. A duplicação copia a apresentação; estoque privado não é copiado.
- Produtos em criação aparecem como pendentes. Uma falha de envio conserva o formulário, e a repetição da mesma solicitação não cria outro produto.
- O catálogo não inventa preços nem estoque que não estejam disponíveis na integração. Uma alteração só aparece como sincronizada após confirmação pelo bot.
- Aplicações Buxx continuam abrindo o editor específico de Robux.

## Publicação e instalação

Esta versão atualiza o frontend Cloud e a função Supabase `valtrex-cloud`, preservando a autenticação existente. Não requer migração do banco nem reinstalação do Manager, Sallers ou Buxx para usar as novas telas.

O ZIP inclui os fontes, testes e a compilação estática em `dist`. Use `npm ci`, `npm test` e `npm run build` para verificar o projeto localmente. Configure as variáveis privadas somente no servidor; credenciais não fazem parte do pacote.

Os testes locais de conversas e criação de produtos usam dados isolados e não enviam mensagens a clientes reais. A verificação pública da publicação confere o carregamento, as rotas de login, o redirecionamento ao Discord e as barreiras de autenticação.
