# Domínio próprio e segurança — R89

## O que a R89 protege

- O frontend recebe CSP que permite scripts da própria aplicação, estilos necessários aos temas e imagens HTTPS, de arquivo e de prévia. Scripts arbitrários, plugins e incorporação do site por iframe ficam bloqueados.
- Há `nosniff`, política de referência sem envio da URL anterior, HTTPS persistente e bloqueio de câmera, microfone, localização e Payment Request, que este site não utiliza.
- APIs e a página do painel recebem `Cache-Control: private, no-store`. O backend mantém suas verificações de sessão, proprietário, permissões e CSRF; um cabeçalho `Host` enviado pelo cliente não escolhe o domínio do site.
- Domínios configurados precisam ser origens HTTPS públicas sem credenciais, porta alternativa, caminho, consulta ou fragmento. Uma configuração inválida não entra nos links públicos e usa o domínio padrão.
- Cookies malformados são recusados sem virar erro interno. Cookies de login continuam com `Secure`, `HttpOnly`, `SameSite=Lax` e sem compartilhamento automático entre domínios.
- A administração mostra o endereço e o retorno do Discord confirmados pelo backend e permite copiá-los. O comando “Endereço do site no Manager” configura o endereço usado pelo Manager; ele não registra domínio nem cria DNS.

Essas medidas complementam a autenticação e os limites existentes. Não representam garantia de ausência absoluta de falhas. Nenhum bloqueio amplo de IP, navegador ou país foi ativado no firewall.

## Conectar um domínio depois

Não é necessário comprar ou transferir o registro do domínio para conectar um domínio que você já possui. Quando escolher um domínio:

1. Adicione o domínio ao projeto correto da Vercel que serve este site. Use os registros DNS e a verificação mostrados pela Vercel para **esse domínio**. Não reutilize um IP ou CNAME genérico encontrado em outro projeto.
2. No provedor DNS atual, altere somente os registros necessários. Preserve MX, SPF, DKIM, DMARC, verificações e serviços de outros subdomínios. Não troque os nameservers sem levar os registros existentes.
3. Aguarde a confirmação de DNS, propriedade e certificado HTTPS pela Vercel. Uma alteração salva no DNS não prova que a propagação e o certificado terminaram.
4. Configure no backend Supabase, como secret da função `valtrex-cloud`:

   ```text
   VALTREX_CLOUD_PUBLIC_URL=https://seu-dominio.com
   ```

5. Configure no frontend Vercel e refaça o build:

   ```text
   VITE_PUBLIC_SITE_URL=https://seu-dominio.com
   ```

   Isso atualiza as URLs canônicas, os metadados de compartilhamento, `robots.txt` e `sitemap.xml`. O frontend continua chamando `/api` no próprio domínio; preserve a reescrita para a função Supabase em `vercel.json`.

6. No Discord Developer Portal, adicione o retorno exato:

   ```text
   https://seu-dominio.com/api/auth/discord/callback
   ```

   Faça isso na aplicação do portal e nas aplicações dos bots que usam verificação/recuperação. O endereço também aparece em **Administração → Site e OAuth → Domínio e conexão segura**. O domínio não substitui Client ID ou Client Secret.

7. Publique o frontend e a função com essas configurações. Abra o site pelo novo domínio, faça login e confira aparência, imagem, Gift, prévia e verificação. O navegador pode pedir um novo login porque os cookies não são compartilhados entre domínios.
8. Depois da conferência, atualize o endereço usado pelo Manager na administração e sincronize as configurações dos bots. Mantenha o domínio anterior ligado durante a transição para os links antigos continuarem chegando ao mesmo backend. Se desejar redirecionar o domínio anterior, configure um redirecionamento específico daquele host na Vercel, preservando caminho e parâmetros.

## IA hospedada ao trocar o domínio

`VALTREX_CLOUD_AI_ISSUER` é independente de `VALTREX_CLOUD_PUBLIC_URL`. O emissor padrão continua sendo `https://valtrexapplications.vercel.app`, que já é confiado pelo Space atual. Trocar somente o domínio do site não muda a identidade assinada da IA.

Mantenha o domínio anterior da identidade da IA acessível enquanto o Space usa seu endpoint de chave pública. Se também quiser trocar a identidade da IA, configure o mesmo novo emissor e o endpoint correspondente no Space e em `VALTREX_CLOUD_AI_ISSUER`, teste a assinatura e só então encerre a identidade antiga. Alterar apenas um dos lados interrompe a autorização do modelo.

## Verificação e limites desta entrega

Foram exercitados o domínio personalizado, o início OAuth e seu retorno, a recusa de origens e CSRF incorretos, a assinatura da IA com emissor independente e a geração de metadados. O navegador é verificado com os mesmos cabeçalhos da configuração de produção.

Nenhum domínio novo foi fornecido nesta tarefa; portanto não houve registro, mudança de DNS nem validação de certificado de um domínio novo. A configuração padrão permanece válida. Em produção, confira também `/api/health`, o certificado e os cabeçalhos depois da publicação.
