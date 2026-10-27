# Cloud R68 — rendimentos e atendimento

## Rendimentos

A aba Rendimentos e o resumo no início mostram, por aplicação:

- Receita confirmada, pedidos distintos, unidades vendidas e ticket médio.
- Pendências de entrega registradas pelo bot, aprovações manuais, histórico sem classificação, estornos e descontos.
- Gráfico diário com seleção de dia, períodos de 7/30/90 dias ou datas personalizadas de até 366 dias, fuso Brasília ou UTC.
- Ranking de até 12 produtos por receita, formas de pagamento e os 100 registros mais recentes do período com busca, filtro de classificação e exportação CSV.
- Data da sincronização, quantidade de registros na origem, alterações pendentes e registros inválidos não importados.

Os resumos são calculados no banco sobre todo o período sincronizado, sem limitar a soma aos 100 registros recentes. Pedidos com mais de um item são contados uma vez. O worker evita duplicatas e reenvia um lote cuja confirmação falhou. Os bots enviam até 100 alterações por ciclo de aproximadamente 45 segundos; históricos grandes aparecem como importação em andamento.

Aprovações manuais e registros antigos sem evidência suficiente ficam separados dos confirmados. Nas vendas Python, novas compras registram a origem da aprovação no histórico. Compras antigas sem esse marcador podem aparecer sem classificação. No bot de Robux, pedidos aprovados pelas rotas de gateway preservadas no histórico podem ser confirmados; estatísticas antigas genéricas sem origem ficam sem classificação. Estornos aparecem quando o estado correspondente está salvo no bot; o portal não consulta bancos para descobrir novos estornos.

Receita não é lucro, saldo bancário ou valor disponível para saque. Esta integração não recebe custos nem taxas e não calcula esses valores. Os históricos já sincronizados são preservados no portal mesmo após a limpeza de carrinhos no bot. Dados privados de compradores, credenciais, IDs de pagamento e conteúdos de estoque não são enviados pelo worker financeiro.

## Chat do site ligado ao Manager

Cada aplicação possui um atendimento privado do proprietário. A conversa permite assunto, histórico paginado, mensagem de até 2.000 caracteres, confirmação de envio, leitura pela equipe, preservação do texto em falhas e reabertura ao enviar nova mensagem após encerramento. A atualização ocorre a cada 15 segundos quando a aba está visível; não é um indicador de equipe online nem uma promessa de resposta imediata.

No Manager atualizado:

- `/site chamados`: lista os últimos atendimentos.
- `/site conversa id`: lê as últimas mensagens. Textos longos são resumidos no Discord.
- `/site responder id mensagem`: salva uma resposta para o usuário no site.
- `/site encerrar id`: encerra o atendimento. Nova mensagem do proprietário reabre.
- `/site canal-suporte canal`: configura um canal privado da equipe para avisos; omita o canal para desativar. Avisos são consultados a cada minuto e não repetem a mesma atualização após reinício do Manager.

Somente administradores do Manager executam esses comandos. No backend, a identidade do Manager é validada no Discord; proprietários não podem se passar pela equipe nem consultar outra aplicação. As mensagens são texto, sem interpretação de HTML.

## Instalação e publicação

O frontend e a função Supabase deste projeto são publicados separadamente do processo do Manager. Instale o Manager R68 ou aplique o patch sobre o R67. Use `/sync` para atualizar os comandos e `/site atualizar-bot` para atualizar cada bot existente. Os ZIPs-fonte atualizados dos dois bots estão no Manager. Confira em Rendimentos a data da sincronização; um bot antigo ou offline não é apresentado como faturamento zero.

A migração `20261027164848_finance_support_chat.sql` cria quatro tabelas e duas funções SQL com `security invoker`, RLS e acesso exclusivo pelo backend. Ela já foi aplicada no projeto original: não a reaplique nesse banco. Para instalação própria, publique a migração, a Edge Function e os rewrites do frontend seguindo a configuração existente.

As capturas entregues usam valores e conversas demonstrativos. Nenhum faturamento de cliente foi inventado no site publicado.
