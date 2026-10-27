# Cloud

Páginas móveis de verificação e recuperação consentida pelo OAuth2 oficial do Discord. Este diretório é independente da loja antiga na raiz do repositório.

## Arquitetura

- Vercel (`valtrexapplications.vercel.app`, com `systembux.vercel.app` preservado): página React/Vite e proxy HTTPS `/api/*`.
- Supabase `zx-sparkle-cart`: tabelas `valtrex_*` isoladas e Edge Function `valtrex-cloud`.
- Bots hospedados em qualquer provedor: consultam verificações e tarefas de recuperação a cada 45 segundos e executam somente ações autorizadas pela API oficial do Discord.

Nenhum processo Discord permanente roda na Vercel. Tokens OAuth de membros que consentiram com `guilds.join` são cifrados no backend e retidos por até 90 dias. O Client Secret também fica cifrado e não retorna nas respostas da API. A chave de cada bot fica no seu armazenamento local restrito ou no ambiente do bot.

## Login único do portal

O botão **Continuar com Discord** em `/dashboard` usa o Client ID público
`1506929376967790752` da aplicação ValtrexApplications. O proprietário deve
cadastrar exatamente `https://valtrexapplications.vercel.app/api/auth/discord/callback`
em Discord Developer Portal → OAuth2 → Redirects e salvar o Client Secret em
Supabase → projeto `zx-sparkle-cart` → Edge Functions → Secrets, com o nome
`VALTREX_PORTAL_CLIENT_SECRET`, ou na configuração cifrada da aplicação Manager
via API administrativa autenticada. O backend nunca devolve o valor salvo.
`VALTREX_PORTAL_CLIENT_ID` é opcional se a aplicação mudar.
O login pede somente o scope `identify`; o backend filtra cada aplicação pelo
ID Discord autenticado. A entrada antiga por ID de bot permanece numa seção
recolhida para compatibilidade com links anteriores.

O Manager envia um catálogo sem tokens ou arquivos de clientes a cada dois
minutos para `/api/manager/sync`, autenticado pelo token do próprio bot e
validado pela API oficial do Discord. A troca no banco é atômica para remover
vínculos antigos em mudanças de proprietário. Bots com Cloud configurado podem
ser gerenciados no painel; os demais mostram plano e tipo de aplicação.

## Configuração por aplicação

1. Inicie o bot atualizado. Ele registra sua própria aplicação na ponte usando o token de bot já configurado, validado pela API oficial do Discord. A chave de integração é individual e é salva em arquivo local com permissão restrita. `VALTREX_CLOUD_API_KEY` é opcional para instalações com provisionamento próprio.
2. O bot acessa `valtrexapplications.vercel.app`. Configure `VALTREX_CLOUD_URL` apenas se usar outro domínio. O armazenamento local do bot precisa persistir entre reinícios.
3. No `/painel` do bot, abra ValtrexCloud → Autenticação e informe o **Client ID da própria aplicação** e seu **Client Secret**. O bot envia o secret diretamente ao backend; não o grava localmente. Quando configurado dentro de um servidor e ainda não há servidor principal, o painel associa esse servidor à aplicação. Confira o servidor exibido antes de publicar a verificação.
4. Cadastre exatamente a Redirect URI mostrada pelo painel em Discord Developer Portal → OAuth2 → Redirects. Na instalação padrão: `https://valtrexapplications.vercel.app/api/auth/discord/callback`.
5. Configure o servidor principal, um cargo abaixo do cargo máximo do bot e o canal de logs. O bot precisa de **Gerenciar Cargos** para conceder o cargo. Em Autenticação, use **Publicar Verificar** e escolha o canal. O bot publica um embed com o botão **Verificar** e atualiza a própria mensagem quando possível. Ao clicar, cada pessoa recebe uma resposta privada com seu próprio botão **Autorizar no Discord**. Esse botão leva diretamente a `discord.com/oauth2/authorize`; o Discord exige esse segundo clique para abrir uma URL individual criada após a interação.
6. A verificação solicita `identify` e `guilds.join` no Discord. A página explica o consentimento para recuperação; após o callback, o backend registra a verificação, cifra os tokens autorizados e o bot concede o cargo quando permitido.
7. Gifts são separados. O proprietário cria quantos links quiser, respeitando expiração e limites individuais. `/g/:token` solicita login do proprietário com `identify guilds`; em seguida, ele escolhe um servidor administrado por sua conta, instala o bot pelo OAuth oficial com a permissão **Criar Convite**, informa o ID e a quantidade de membros consentidos. O backend exige a presença recente do bot com essa permissão no destino, reserva o pedido e fornece progresso real. Ingressos recusados ou membros já presentes aparecem separadamente.

O Gerador usa um botão com URL direta `discord.com/oauth2/authorize`, emitida para o usuário que escolheu o produto. Essa URL é válida por 10 minutos. O callback confirma a identidade Discord, consome o estado uma vez e então registra o consentimento. Após a autorização, o usuário volta ao comando e solicita o produto; a barra do bot só chega a 100% quando a DM é enviada.

Gifts criados antes de R14 continuam no modo antigo de verificação (`identify`) para não invalidar links já compartilhados. Gifts novos são de recuperação. O painel indica o tipo de cada link.

O Discord pode recusar ingressos por revogação de consentimento, rate limit, restrições de conta ou servidor. A quantidade solicitada é um teto, não uma garantia de ingresso. O bot não adiciona usuários que nunca autorizaram a aplicação.

## Privacidade e segurança

- As tabelas novas têm RLS ativado e nenhum acesso para `anon`/`authenticated`.
- A Edge Function expõe publicamente apenas páginas de Gift/verificação e início/callback OAuth. O setup exige sessão `HttpOnly` vinculada ao Gift e ao proprietário. Administração e fila do bot exigem chave por aplicação.
- A chave do bot nunca vai para o frontend; o Client Secret nunca retorna na API.
- `state` OAuth e cookie verificador são aleatórios, expiram em 10 minutos e o state é consumido uma vez. A sessão de setup expira em 1 hora. Cookies são `HttpOnly`, `Secure` e `SameSite=Lax`.
- O preview assinado expira em 15 minutos, não consome Gift e não inicia OAuth.
- Há limite básico por minuto em auth, callback, setup e administração. O POST de recuperação verifica Origin, sessão, dono, guild administrada, bot conectado e quantidade consentida.
- O Client Secret e token do Gift são cifrados com uma chave derivada da credencial interna de serviço do Supabase. **Antes de girar essa credencial, os dados cifrados precisam ser migrados**. A credencial de serviço não é enviada ao navegador ou aos bots.

## Testes e build

```sh
npm ci
npm run build
npm test
```

O fluxo OAuth real só pode ser verificado após cadastrar o Client Secret e a Redirect URI no Discord Developer Portal. Um teste de ingresso real requer ao menos um membro com consentimento, um servidor de destino administrado pelo proprietário e o bot instalado nesse servidor.

## Cloud R65 — portal atualizado

O nome público padrão é **Cloud**. Para trocar por outra marca, configure `VITE_PUBLIC_BRAND` e faça um novo build. As URLs do OAuth, os nomes das tabelas e o endpoint da Edge Function conservam os identificadores existentes para manter compatibilidade. A loja SystemBux é um projeto separado.

A interface usa grafite e verde-água, com opções locais de cor (verde-água, azul ou âmbar), densidade, exibição em cards/lista, avisos e redução de movimento. Preferências ficam somente neste navegador, sem credenciais. A página de aplicações oferece busca por nome/ID, filtro de plano e ordenação; a atividade permite pesquisar eventos, filtrar por data e exportar somente data/evento em CSV. A aparência pública de cada aplicação tem paletas e ajuste de arredondamento, salvos pelo backend existente.

O painel mostra apenas dados retornados pela sessão autorizada. O controle de processo e a renovação dos bots continuam na central do Manager no Discord. O login, a autorização OAuth e o consentimento usam os endpoints existentes. Não há acesso administrativo por dados inventados.

Validação: `npm test` compila e testa o portal e o fluxo OAuth. A verificação no navegador usou respostas locais simuladas para testar os dez menus, filtros, preferências persistentes, exportação CSV, gravação com CSRF, Gifts, saída com falha, desktop e celular. Isso não substitui a autorização real de uma conta Discord em produção.

## Cloud R66 — interface monocromática

A revisão R66 substitui as camadas visuais anteriores por um sistema em preto, branco e cinza. Ícones decorativos e ações usam SVGs com a mesma grade de 24 pixels. O painel tem temas escuro, claro e do sistema, navegação inferior no celular, menu completo e busca rápida por Ctrl+K/Command+K.

Novas opções: favoritos de aplicações, filtro por favoritos, paginação de 12 itens, avisos de vencimento no cabeçalho, privacidade para IDs nas listagens, horários locais ou UTC, busca/filtro de Gifts e cópia dos links filtrados, filtro de atividade por intervalo e limpeza dos filtros. Preferências e favoritos são locais ao navegador e não incluem credenciais. As APIs de dados e autorização existentes continuam responsáveis por toda operação remota.

Os dados da área autenticada foram verificados com respostas simuladas no navegador. Foram conferidas as dez seções em quatro larguras (320, 390, 768 e 1440 px), as páginas públicas nessas larguras, a paginação, os favoritos, o atalho de busca, os temas, a privacidade de IDs, a exportação de atividade e o consentimento da verificação. `npm test` também compila o site e executa os testes de dados e segurança OAuth. O login completo de uma conta real Discord não faz parte dessa simulação.
