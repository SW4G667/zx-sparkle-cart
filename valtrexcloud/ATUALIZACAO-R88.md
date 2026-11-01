# Atualização R88

## Imagens pela galeria

Na Aparência pública, use **Escolher da galeria**, **Trocar imagem** e **Remover imagem** para logo, banner, fundo da página e fundo do carregamento. A prévia é imediata após o envio. Clique em **Salvar aparência** para confirmar; remover limpa a imagem da configuração, preservando arquivos que outros Gifts ou produtos ainda possam usar.

O mesmo seletor atende banners de Gifts e produtos e a imagem do atendimento. JPG, PNG e WebP são preparados no navegador, com até 2.048 pixels no lado maior. A entrada aceita até 15 MB; o arquivo enviado precisa ter até 3 MB. GIFs mantêm a animação e aceitam até 3 MB. Uma falha de envio preserva a imagem anterior.

O backend confirma sessão Discord, proprietário da aplicação, origem e CSRF antes de gravar. Aceita somente imagens raster com assinatura compatível, nomes imutáveis por hash e pastas por aplicação. Limites: 100 arquivos e 64 MB por aplicação. SVG e gravação direta anônima não são permitidos. O bucket `cloud-public-media` é público para exibir as imagens das páginas; a função usa sua credencial de servidor para gravar. A função cria o bucket na primeira utilização se ele estiver ausente.

## Personalidade da IA

A IA hospedada recebe a personalidade geral, as instruções específicas para conversa ou ticket e as referências da loja. Por exemplo: “Você é Luna, uma personagem feminina que conversa de forma simpática”. Configurar uma personagem não habilita ações de pagamento, estoque ou execução de comandos. Permissões do Manager e do canal continuam sendo verificadas.

O prompt específico complementa o geral e tem prioridade em caso de conflito. O atendimento humano, a revogação da permissão e os resumos de tickets continuam preservados. O modelo pode ter limitações e o Hugging Face pode demorar a iniciar.

Para os bots já instalados, aplique o Manager R88 e use **Atualizar código** em cada aplicação. Os bots passam a responder sem os avisos contraditórios da antiga IA e exibem 👑 na descrição de `/panel`. Reiniciar sozinho não distribui arquivos novos.

## Instalação do site em outro ambiente

1. Extraia `CLOUD_SITE_R88.zip`, preserve as variáveis do seu ambiente e execute `npm ci` e `npm test`.
2. Publique `supabase/functions/valtrex-cloud/index.ts` como a função `valtrex-cloud`. Ela usa autenticação própria, incluindo OAuth e rotas públicas, portanto a verificação de JWT da plataforma permanece desativada como na versão anterior.
3. Em um projeto novo, aplique o esquema e as migrações anteriores na ordem documentada no README. R88 não adiciona tabelas nem altera o esquema. A credencial `SUPABASE_SERVICE_ROLE_KEY` fica somente no backend.
4. Publique o frontend Vite com saída `dist`, preservando as rotas de `vercel.json` e o domínio configurado no OAuth Discord.

O relatório da entrega informa separadamente o que foi publicado no ambiente original e o que depende de instalar os ZIPs.
