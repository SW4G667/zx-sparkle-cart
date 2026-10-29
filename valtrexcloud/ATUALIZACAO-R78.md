# Cloud R78 — IA hospedada

Em **Inteligência artificial**, a área **IA hospedada · Hugging Face** permite configurar atendimento em tickets, conversa em canais e resumo para a equipe. A opção aparece bloqueada até o administrador liberar a aplicação pelo Manager R78.

Há prompts separados para cada função, ativação por recurso, canais permitidos, resposta somente quando mencionado, escolha entre texto e embed, nome, rodapé e cor lateral opcional. O teste da resposta acontece no site, sem envio ao Discord.

O Manager controla a autorização. O backend confere a assinatura ativa, o proprietário, os recursos liberados e a revogação. Ao assumir um ticket, o bot pausa a resposta automática e envia um resumo em embed. Os templates R78 dos bots são necessários para esse comportamento.

O serviço foi integrado ao Space existente `china12n/007-ai-agent-runtime`, com rotas isoladas em `/cloud-support`. As mensagens usam somente geração de texto, sem acesso a pagamentos, comandos, navegador ou outros atendimentos. As autorizações são assinadas e têm validade curta; chaves dos bots e chaves privadas não são enviadas ao Space nem ao navegador.

O backend requer a migração `20261029171034_cloud_ai_access_r78.sql`, incluída no pacote em `supabase/migrations/`. Na publicação atual, a migração e a função já estão aplicadas. As tabelas novas têm RLS e acesso restrito ao servidor.

As tabelas de suporte e as melhorias da loja R77 permanecem disponíveis. As APIs próprias de IA já configuradas pelo cliente continuam disponíveis.
