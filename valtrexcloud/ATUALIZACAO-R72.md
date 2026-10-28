# Cloud e Manager R72 — seleção de servidores e administração no site

## Administração no navegador

O comando `/site` foi aposentado. A área **Administração** aparece somente para os IDs administrativos configurados no Manager. O backend confere essa permissão em cada operação; ser proprietário de um bot não concede acesso à administração do projeto.

A área reúne atualização individual de bots, teste de servidores, configuração GoatPay, notificações, atendimento da plataforma, endereço do site e OAuth. Operações que dependem do Manager entram numa fila cifrada e aparecem como concluídas somente após confirmação. O Manager R72 precisa estar online para executá-las. O site não recebe o token Discord do Manager pelo navegador.

O token recebido no novo `.env` pertence ao Manager `1564896147699400744`. Essa identidade foi validada pela API oficial do Discord e passou a ser reconhecida no backend do projeto original. A credencial em si não foi colocada no código nem nos pacotes públicos. Projetos com um ID diferente configurado explicitamente continuam restritos à própria identidade.

O `/site` já registrado no servidor atual do Manager foi removido pela API do Discord. O patch também o exclui da coleção de comandos para impedir que volte após reinício. Os comandos operacionais anteriores do Manager permanecem disponíveis.

## Escolha de hospedagem

Os produtos Sallers e Buxx mantêm preferência por Python e JavaScript, respectivamente. O Buxx também considera os servidores Enzonic JavaScript quando a XSystem está ocupada. Os provedores compatíveis são avaliados antes da contingência ShardCloud.

O Manager pode descobrir servidores adicionais já pertencentes às contas Client API autorizadas. A descoberta consulta a lista de servidores; não compra planos nem cria servidores. Servidores suspensos, alheios à conta ou com runtime não confirmado são recusados. Só uma seleção confirmada é persistida no cadastro privado. `HOST_AUTO_DISCOVER=false` desativa a descoberta.

A autenticação recusada em um slot, um processo ocupado ou falta de RAM não bloqueiam outro servidor elegível. Falhas temporárias de leitura são repetidas mesmo quando outra conta respondeu, mas não tem memória para o bot. Um upload possivelmente aceito interrompe a contingência para evitar aplicações duplicadas e preservar o pedido pago.

As reservas de memória consideram a identidade física do servidor, inclusive quando o mesmo servidor aparece em slots diferentes. Repetir uma credencial não cria capacidade. Não foram reduzidas as reservas dos bots para forçar implantação em planos insuficientes.

## Verificações com as credenciais recebidas

| Destino | Resultado observado |
| --- | --- |
| Enzonic Python, slot 1 | Client API, arquivos e supervisor confirmados após repetição de leitura transitória; limite de 4096 MB |
| Enzonic JavaScript, slot 2 | Client API, arquivos e supervisor confirmados; limite de 3584 MB |
| XSystem, slot 1 | API autenticada, servidor ligado; sem supervisor reconhecido para compartilhar esse processo |
| Discloud, slots 1 e 2 | Contas autenticadas; cada uma informou 100 MB, insuficientes para a reserva atual de 350 MB por bot |
| PhanomCloud, slot 1 | API retornou HTTP 401 para a chave e o modo de autenticação fornecidos |
| Altare | SFTP preenchido; memória contratada não informada e login SFTP não confirmado nesta rede |

A conta Enzonic também listou dois servidores adicionais: um JavaScript com 512 MB, abaixo da reserva atual com supervisor, e outro cujo runtime não foi confirmado. Isso não significa que ambos possam receber qualquer bot.

Esses testes foram de leitura: não enviaram aplicações nem reiniciaram bots de clientes. Capacidade real depende de RAM livre, reservas, runtime, política de isolamento e disponibilidade do provedor. Não há confirmação de funcionamento de uma credencial recusada ou incompleta.

## Pagamentos

Na área **Administração → Gateway**, informe a API Key GoatPay, escolha o estado e salve. Ativar exige que o Manager confirme a conta por uma consulta de saldo. Salvar/desativar não cria cobrança. A chave trafega cifrada na fila e nunca aparece no histórico público das operações.

O arquivo recebido mantém `GOATPAY_API_KEY` vazio. Não foi inventada uma chave nem feita uma cobrança de teste. ZPay continua sem integração ativa por falta de contrato de API confirmado. Credenciais IMAP ausentes também não são preenchidas com valores fictícios.

## Instalação

Instale o Manager R72 ou aplique seu patch sobre R71. O patch preserva `.env`, configurações e bancos; o ZIP configurado privado inclui o `.env` recebido, organizado sem substituir os valores preenchidos. Não publique esse ZIP.

O frontend e a Edge Function são publicados separadamente. A função desta revisão é a versão 21. A migração `20261028074946_manager_web_controls.sql` já foi aplicada no projeto original; não a reaplique nesse banco. Instalações próprias devem aplicar a migração antes da função e da interface.

O site continua em https://valtrexapplications.vercel.app. A área de administração substitui o fluxo de `/site`; atualização de bots é feita por **Administração → Bots e servidores**. O Manager precisa da atualização para consultar a fila e executar essas operações.
