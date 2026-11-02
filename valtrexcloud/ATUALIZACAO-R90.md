# Site R90

## Uso

O topo do painel mostra os dias restantes e o vencimento do bot selecionado, com acesso à renovação. A data é a informada pelo Manager. Aplicações sem data ficam com “Prazo não informado”.

**Central e estúdio** reúne diagnóstico, dois recibos, fontes, posição dos elementos, cores, fundos enviados pela galeria, reestoque, automações, pós-compra, estoque, versões e domínio. Alterações usam a revisão atual da configuração para impedir que uma janela antiga sobrescreva a outra. Os últimos 30 salvamentos podem ser restaurados.

**Wallet** aparece no início e no menu. Seu estado vem da aplicação: com a configuração desativada, o site mostra “Desativada” e bloqueia os saques. Ative a wallet no Manager, configure e habilite a GoatPay na aplicação. O proprietário consulta o saldo liberado e confirma valor e chave PIX antes de solicitar um saque. As taxas seguem a conta GoatPay. A chave da API permanece no bot.

O site coloca a solicitação em uma fila privada e cifrada. O bot registra a intenção antes de enviar ao gateway. Após interrupção ou demora, a conferência usa consultas pelo identificador da transferência; o envio não é repetido automaticamente. Consulte o histórico e a conta GoatPay antes de preparar outro saque. Não foi movimentado dinheiro real na homologação desta revisão.

**Dispositivos** permite desconectar as próprias sessões. Alterações de credenciais, saques, importações, restaurações e revogações usam confirmação vinculada à sessão e aos dados da ação. Configurações exportadas não incluem credenciais, pagamentos ou itens do estoque.

## Instalação própria

1. Preserve suas variáveis privadas. Execute `npm ci`, `npm test` e `npm run build`.
2. Aplique as migrações de `supabase/migrations` em ordem. A R90 acrescenta `20261102001106_operations_studio_r90.sql`.
3. Publique a função `supabase/functions/valtrex-cloud/index.ts` preservando os secrets. A autenticação das rotas é feita pela própria função; o OAuth público exige `verify_jwt=false`.
4. Publique o frontend conforme `vercel.json`. O site original já recebeu esta revisão; o ZIP é uma cópia para manutenção e instalação própria.
5. Atualize o Manager para distribuir os templates R90. Recursos do site que dependem do bot precisam que ele esteja atualizado e conectado.

## Domínio próprio

Abra **Central e estúdio → Domínio**. O assistente consulta DNS público e mostra o retorno OAuth esperado. Adicione o domínio ao projeto correto na hospedagem e use os registros DNS indicados por ela. Espere o HTTPS ficar válido, cadastre o retorno exato no Discord Developer Portal e confirme a URL pública no Manager. Preserve o endereço do serviço de IA configurado separadamente. Nenhum DNS foi alterado por esta entrega.

## Homologação

160 testes do site aprovados. Fluxos com frontend e função Edge reais, sessão e banco simulados, foram verificados em 1440 e 390 pixels: galeria, editor, importação privada, restauração, domínio, dispositivos, wallet desativada, confirmação de saque e vencimento no topo. Os cabeçalhos de produção foram usados; scripts externos foram bloqueados e recursos legítimos carregaram sem violação CSP.

As quatro novas tabelas têm RLS e acesso restrito ao serviço. As funções SQL não são executáveis por usuários anônimos. Regras de projetos e produtos externos não foram alteradas.
