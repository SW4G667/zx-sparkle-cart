# Cloud R67

## Novidades

- Produtos: criação e edição de nome, descrição e tipo de entrega no site. Fila persistente por aplicação, confirmação do bot e detecção de alterações concorrentes no Discord.
- Catálogo atualizado a cada ciclo de aproximadamente 45 segundos do bot. O site mostra a última sincronização e as solicitações pendentes; um bot antigo ou offline não é informado como atualizado.
- Estoques, preços das opções, cupons e dados de compradores permanecem no armazenamento do bot. Produtos novos começam sem opções: configure os preços/opções e publique pelo painel do produto no Discord. No bot de Robux, republique a mensagem do produto para refletir as alterações em mensagens antigas.
- Notificações enviadas pelo Manager: para todos os proprietários ou uma conta específica, com validade, link opcional e marcação individual de leitura. Consulta no site a cada minuto.
- Carregamento da verificação: painel transparente por padrão, imagem HTTPS opcional, posição, escurecimento e velocidade de animação de 3 a 12 segundos. O movimento não representa uma porcentagem de verificação. Respeita a preferência do sistema por movimento reduzido.
- Navegação com histórico entre seções, acesso rápido à loja no celular e busca por páginas/aplicações.

## Ativação no Manager e bots existentes

1. Instale o Manager R67 ou o patch R67 sobre o R64, preservando seu `.env`, `config.json` e bancos.
2. Inicie o Manager e use `/sync` se `/site` ainda não aparecer.
3. Abra `/site painel`. `/site link` valida um domínio Cloud já publicado e o salva no Manager; não altera DNS nem cria um novo domínio. Se `VALTREX_CLOUD_URL` estiver definida no host, ela tem prioridade.
4. Para cada bot existente, use `/site atualizar-bot id:<ID gerenciado>`. A atualização é individual e reinicia apenas essa aplicação quando o host permite. Bots suspensos não são atualizados por este comando.
5. No bot, mantenha o Cloud habilitado e vinculado ao proprietário pelo painel Cloud. Em Produtos no site, confira a data de sincronização. Novas aplicações já recebem os módulos R67 pelo Manager atualizado.
6. `/site notificar` publica um aviso. `/site avisos` lista IDs e `/site arquivar` retira um aviso. O backend valida o token do Manager no Discord.
7. `/site autenticacao` abre um formulário privado para o Client Secret de uma aplicação já vinculada. O backend valida a credencial no Discord antes de salvá-la cifrada. Não troca o Client ID global da plataforma. A variável `VALTREX_PORTAL_CLIENT_SECRET`, quando definida, tem prioridade no login geral; o comando informa essa condição.

## Publicação própria

Use `npm ci`, `npm test` e publique `dist` na Vercel com os rewrites de `vercel.json`. A Edge Function fica em `supabase/functions/valtrex-cloud/index.ts`. A migração em `supabase/migrations/20261027113524_workspace_products_notices.sql` cria quatro tabelas com RLS e acesso apenas por `service_role`; usuários acessam os dados pela sessão Discord e autorização de proprietário no backend.

A migração e a função R67 já foram publicadas no Cloud configurado neste projeto. Não reaplique a migração manualmente nesse banco. Para uma instalação independente, configure os secrets existentes da função e o Redirect URI do Discord para o domínio de destino. Nunca exponha a chave de serviço no frontend.

## Verificação desta entrega

- Build Vite e 20 testes Node do site/API.
- 9 testes do worker Python e 8 do worker JavaScript: idempotência, preservação de estoque/cupons/preços, conflito e falha de gravação.
- 6 testes adicionais do Manager, além da suíte de regressão existente.
- Navegador Chromium: criação pendente e confirmação simulada, CSRF, avisos/leitura, aparência salva, prévia do carregamento, transparência e movimento reduzido. Layouts em 320, 390, 768 e 1440 px.
- API publicada: 20 consultas/ações HTTP com sessão e bot de teste isolados no banco real; fixtures removidas ao final.
- As capturas do dashboard usam dados demonstrativos. Não representam compras ou bots reais.

A publicação do frontend/backend não instala automaticamente o patch dentro de um Manager ou bot já hospedado. A conexão final de cada bot depende da instalação individual e de suas credenciais válidas no Discord/host.
