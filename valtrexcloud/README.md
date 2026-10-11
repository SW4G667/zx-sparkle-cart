# ValtrexCloud

Páginas móveis de verificação e recuperação consentida pelo OAuth2 oficial do Discord. Este diretório é independente da loja antiga na raiz do repositório.

## Arquitetura

- Vercel (`valtrexapplications.vercel.app`, com `systembux.vercel.app` preservado): página React/Vite e proxy HTTPS `/api/*`.
- Supabase `zx-sparkle-cart`: tabelas `valtrex_*` isoladas e Edge Function `valtrex-cloud`.
- Bots hospedados em qualquer provedor: consultam verificações e tarefas de recuperação a cada 45 segundos e executam somente ações autorizadas pela API oficial do Discord.

Nenhum processo Discord permanente roda na Vercel. Tokens OAuth de membros que consentiram com `guilds.join` são cifrados no backend e retidos por até 90 dias. O Client Secret também fica cifrado e não retorna nas respostas da API. A chave de cada bot fica no seu armazenamento local restrito ou no ambiente do bot.

## Configuração por aplicação

1. Inicie o bot atualizado. Ele registra sua própria aplicação na ponte usando o token de bot já configurado, validado pela API oficial do Discord. A chave de integração é individual e é salva em arquivo local com permissão restrita. `VALTREX_CLOUD_API_KEY` é opcional para instalações com provisionamento próprio.
2. O bot acessa `valtrexapplications.vercel.app`. Configure `VALTREX_CLOUD_URL` apenas se usar outro domínio. O armazenamento local do bot precisa persistir entre reinícios.
3. No `/painel` do bot, abra ValtrexCloud → Autenticação e informe o **Client ID da própria aplicação** e seu **Client Secret**. O bot envia o secret diretamente ao backend; não o grava localmente.
4. Cadastre exatamente a Redirect URI mostrada pelo painel em Discord Developer Portal → OAuth2 → Redirects. Na instalação padrão: `https://valtrexapplications.vercel.app/api/auth/discord/callback`.
5. Configure o servidor principal, um cargo abaixo do cargo máximo do bot e o canal de logs. O bot precisa de **Gerenciar Cargos** para conceder o cargo. Em Autenticação, use **Publicar Verificar** e escolha o canal. O bot publica um embed com botão de link para `/v/:applicationId` e atualiza a própria mensagem quando possível.
6. A verificação solicita `identify` e `guilds.join` no Discord. A página explica o consentimento para recuperação; após o callback, o backend registra a verificação, cifra os tokens autorizados e o bot concede o cargo quando permitido.
7. Gifts são separados. O proprietário cria quantos links quiser, respeitando expiração e limites individuais. `/g/:token` solicita login do proprietário com `identify guilds`; em seguida, ele escolhe um servidor administrado por sua conta, instala o bot pelo OAuth oficial, informa o ID e a quantidade de membros consentidos. O backend exige a presença recente do bot no destino, reserva o pedido e fornece progresso real. Ingressos recusados ou membros já presentes aparecem separadamente.

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
