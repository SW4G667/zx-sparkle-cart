# Cloud R70 — criação de produtos e Gifts

## Produtos

O editor possui modelos, abas de informações, apresentação e opção inicial, com prévia e restauração da apresentação. Permite banner, rodapé, modelo consolidado ou com imagem separada, texto/estilo do botão, preço/estoque visíveis e cor lateral opcional.

A primeira opção pode ser criada junto do produto com nome, descrição e preço. Isso não preenche estoque automaticamente. Editar a apresentação mantém preços, opções e estoque existentes. Duplicar um produto abre um novo rascunho; não copia o estoque nem publica a vitrine por conta própria.

Os bots precisam do bridge versão 2, incluído nos templates R70. Um bot antigo recebe uma mensagem para atualizar antes de aceitar os campos novos. No Manager, use `/site atualizar-bot` para atualizar individualmente o código, preservando os dados da aplicação. A publicação da vitrine continua pelo Discord.

## Gifts

O estúdio reúne quatro modelos, prévia, lotes de 1–10 links, limites de resgates/membros, validade e personalização de textos, banner, botão e cor. Oferece edição, duplicação, ativação, paginação e exportação da página em CSV.

Um lote é salvo em uma única operação. A chave do envio é mantida durante a repetição após falha, e a API retorna os mesmos links quando o mesmo pedido é repetido. Os links criados permanecem visíveis se a atualização da listagem falhar. A edição mantém o código do link e os resgates já registrados.

## Publicação e configuração

- Interface de produção: https://valtrexapplications.vercel.app
- Vercel: projeto `systembux`, diretório raiz `valtrexcloud` no repositório existente.
- Supabase: função `valtrex-cloud`, revisão publicada 19.
- Nenhuma migração de banco foi necessária para R70. As tabelas anteriores continuam sendo usadas.
- O ZIP não contém `.env` privado, credenciais de hospedagem nem dados de clientes. Use `.env.example` para uma instalação própria e mantenha a configuração autorizada existente.

O frontend e a Edge Function são publicados separadamente. Alterar o ZIP local não substitui a função já publicada. Para desenvolvimento local, execute `npm ci` e `npm test` antes de publicar.

## Validação

47 testes do site/API, build de produção e navegação em larguras de 320, 390, 768 e 1440 pixels. O navegador verificou nova tentativa mantendo campos/chave, três links visíveis e produto com opção inicial. Nenhum erro de página foi registrado.

Na API real publicada, um tenant sintético isolado criou três links. Três repetições concorrentes retornaram os mesmos links. Listagem, edição, rejeição de limite inválido e rejeição de chamada sem autenticação passaram. Os dados sintéticos foram removidos; a consulta final confirmou zero registros desse teste. Nenhuma conta de cliente foi usada para simular compras ou faturamento.

Os testes de navegador usam autenticação e respostas controladas. A verificação real da API complementa esses testes, sem representar uma nova sessão OAuth humana ou uma cobrança real em gateway.
