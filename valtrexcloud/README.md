# ValtrexCloud

Página móvel de verificação oficial do Discord. Este diretório é independente da loja antiga na raiz do repositório.

## Arquitetura

- Vercel (`systembux.vercel.app`): página React/Vite e proxy HTTPS `/api/*`.
- Supabase `zx-sparkle-cart`: tabelas `valtrex_*` isoladas e Edge Function `valtrex-cloud`.
- Bots hospedados em qualquer provedor: consultam verificações pendentes a cada 45 segundos e concedem cargo pela API oficial do Discord.

Nenhum processo Discord permanente roda na Vercel. Nenhum token OAuth de usuário é persistido. O Client Secret fica cifrado no backend e não retorna nas respostas da API. A chave de cada bot fica somente no ambiente do bot.

## Configuração por aplicação

1. Provisione um tenant usando o **ID da aplicação Discord** e uma chave aleatória com pelo menos 32 caracteres. Grave somente `SHA-256(chave)` em `public.valtrex_tenants.bot_key_hash`. Não reutilize a chave entre aplicações.
2. Configure `VALTREX_CLOUD_API_KEY` no ambiente da aplicação bot. A aplicação deve possuir uma linha própria na tabela. Opcionalmente configure `VALTREX_CLOUD_URL` se usar outro domínio.
3. No `/painel` do bot, abra ValtrexCloud → Autenticação e informe o **Client ID da própria aplicação** e seu **Client Secret**. O bot envia o secret diretamente ao backend; não o grava localmente.
4. Cadastre exatamente `https://systembux.vercel.app/api/auth/discord/callback` em Discord Developer Portal → OAuth2 → Redirects.
5. Configure o servidor principal, um cargo abaixo do cargo máximo do bot e o canal de logs. O bot precisa de **Gerenciar Cargos**. O escopo OAuth solicitado ao visitante é apenas `identify` para ler o ID da conta após consentimento. `guilds.join` não é solicitado nem executado.
6. Personalize a aparência e crie um Gift. O link gerado pode ser compartilhado. O uso é contado uma vez por conta Discord e Gift; limites são verificados atomicamente no banco.

O servidor de backup é somente uma configuração preparatória. Restauração de membros não foi ativada: exige consentimento específico para `guilds.join`, retenção protegida de tokens e autorização do bot no servidor de destino. O painel não afirma que ela esteja ativa.

## Privacidade e segurança

- As tabelas novas têm RLS ativado e nenhum acesso para `anon`/`authenticated`.
- A Edge Function permite acesso público apenas ao Gift e ao início/callback OAuth. Administração e fila do bot exigem chave por aplicação.
- A chave do bot nunca vai para o frontend; o Client Secret nunca retorna na API.
- `state` e cookie de sessão são aleatórios, têm prazo de 10 minutos e são consumidos uma vez. O cookie é `HttpOnly`, `Secure` e `SameSite=Lax`.
- O preview assinado expira em 15 minutos, não consome Gift e não inicia OAuth.
- Há limite básico por minuto em auth, callback e administração.
- O Client Secret e token do Gift são cifrados com uma chave derivada da credencial interna de serviço do Supabase. **Antes de girar essa credencial, os dados cifrados precisam ser migrados**. A credencial de serviço não é enviada ao navegador ou aos bots.

## Testes e build

```sh
npm ci
npm run build
```

Os testes automatizados da UI e da API devem ser executados antes de cada nova publicação. O fluxo OAuth real só pode ser verificado após cadastrar o Client Secret e a Redirect URI no Discord Developer Portal.
