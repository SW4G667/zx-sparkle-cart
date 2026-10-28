# Cloud R71 — IA e tickets do Discord

## Configurar a IA

Abra **Inteligência artificial** e escolha a aplicação. Configure OpenAI, Groq ou xAI/Grok, informe o identificador do modelo disponível na conta e salve sua API Key. Há instruções, referências da loja, modelos de texto, limite de tokens e criatividade. Cada provedor guarda sua própria chave.

- O campo vazio mantém a chave anterior. A opção de remover é explícita.
- As chaves ficam cifradas no backend. O site devolve somente o estado de configuração; não guarda o valor em localStorage.
- **Testar conexão salva** consulta a lista de modelos da conta, sem gerar texto. A lista não garante acesso a todos os modelos ou saldo suficiente.
- **Sugerir com IA**, dentro de um ticket, envia até 12 mensagens recentes e as referências configuradas ao provedor escolhido. A geração pode consumir créditos. O resultado é um rascunho: não é enviado automaticamente ao cliente.
- No Sallers atualizado, a configuração global de IA também é aplicada ao bot. A preferência escolhida no site não usa silenciosamente outra chave/provedor do ambiente. A ativação automática por painel de ticket permanece nas configurações de cada painel no Discord.
- No Buxx, a IA desta revisão prepara rascunhos pelo site; ela não inicia uma nova automação de respostas no Discord.

## Atendimento pelo site

**Tickets de clientes** é a caixa de entrada dos tickets criados pelo bot. O chat **Suporte da plataforma** continua sendo o atendimento do proprietário com a equipe do projeto.

Em **Preferências de atendimento**, ative a integração e escolha:

- **Pelo bot:** mensagem enviada pela conta do próprio bot.
- **Por webhook:** o bot cria um webhook no canal pai, com nome e avatar configuráveis. Não é necessário expor ou colar tokens de webhook no site.

A apresentação permite texto ou embed, nome, avatar, assinatura, rodapé, cor lateral opcional e restauração do visual. No modo bot, nome/avatar personalizam o cartão, sem renomear a conta Discord. Também há até oito respostas rápidas, consulta de 20/50/100 mensagens por ticket e opção de mostrar links de anexos.

A caixa de entrada inclui busca, filtros de abertos/fechados, histórico paginado, link para o Discord, fila de entregas, cancelamento enquanto pendente, nova tentativa de falhas confirmadas, prioridade e notas privadas. As notas não são enviadas ao Discord nem usadas na sugestão de IA. O painel é restrito ao proprietário autenticado da aplicação.

O bot consulta a integração aproximadamente a cada 15 segundos, sem sobrepor execuções. Tickets com mensagens novas recebem prioridade na sincronização; muitos tickets, limites da API ou falhas podem aumentar o intervalo. A tela consulta atualizações a cada 15 segundos enquanto visível. Não é um chat com entrega instantânea garantida.

Uma resposta fica **Entregue no Discord** somente após receber o ID da mensagem. Falha ao confirmar na API do site repete apenas a confirmação. Um resultado incerto não dispara novo envio automático. Confira o canal antes de criar outra resposta. Webhooks não são substituídos silenciosamente pelo bot se faltar permissão.

## Atualizar os bots existentes

1. Instale o Manager R71 ou aplique o patch R71 sobre R70, preservando a configuração e os bancos.
2. Use `/site atualizar-bot id:<aplicação gerenciada>` para cada bot desejado. Esse comando distribui os arquivos de código do template e reinicia somente a aplicação selecionada.
3. Confira a conexão na central e depois o estado da integração no site. Bots offline/antigos não aparecem como se já tivessem aplicado a configuração.
4. Ative a integração no site e confira as permissões no servidor Discord.

O bot precisa de Ver Canal, Ler Histórico, Enviar Mensagens e Enviar Mensagens em Tópicos, quando aplicável. Para o modo webhook, precisa de Gerenciar Webhooks no canal pai. Para sincronizar texto de clientes, habilite a Intenção de Conteúdo de Mensagens no Discord Developer Portal quando ela for exigida para a aplicação.

Só os tickets registrados no sistema do próprio bot são importados. A integração começa desativada. Ao ativar, o histórico desses tickets é disponibilizado no painel privado; desativar pausa a sincronização e os envios, sem excluir o histórico já salvo. Canais comuns não são importados. Anexos são links do Discord, não cópias dos arquivos.

## Publicação e validação

O site original e a Edge Function são publicados separadamente. A função Supabase R71 é a revisão 20. A migração `20261028061655_ai_ticket_workspace.sql` já foi aplicada no projeto original: não a reaplique nesse banco. Em instalação própria, aplique a migração antes de publicar a função e a interface. Todas as novas tabelas têm RLS e acesso direto restrito ao backend.

Validação: 68 testes do site/API, 248 do Sallers e 323 do Manager/Node, incluindo nove cenários novos do Buxx. Navegação conferida em 320/390/768/1440 pixels, com zero erros de página. O teste real da API verificou chave cifrada, histórico, notas, repetição de respostas, uma única retirada da fila por três consumidores concorrentes e confirmação idempotente. Os dados sintéticos foram removidos ao concluir.

Os testes de Discord e dos provedores de IA usam respostas controladas. Nenhuma mensagem foi enviada a clientes reais, nenhuma geração foi cobrada de uma conta e nenhum bot externo foi atualizado automaticamente nesta sessão. O envio real depende da instalação R71, do bot online e das permissões descritas.
