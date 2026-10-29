# Cloud R76

- `/login`, `/entrar`, `/painel`, `/app`, `/auth/login` e `/dashboard/` abrem a mesma autenticação do painel. O OAuth continua no Discord, com sessão privada e CSRF.
- Temas do workspace: escuro, claro, sistema, vermelho, azul, violeta, esmeralda e alto contraste. As preferências ficam neste navegador. As paletas também podem ser aplicadas à página de verificação.
- O Buxx R76 publica uma configuração própria na área **Produtos**: preços, limites, estoque, layout de compra, calculadora e entrega. Não cria produtos do Sallers dentro do Buxx.
- Alterações usam a revisão atual e uma fila privada por aplicação. Só são concluídas após o Buxx confirmar. Alterações concorrentes no Discord exigem atualização do site.
- Reservas de pagamentos não são removidas por uma edição de estoque. Cookies Roblox, tokens, imagens locais e outras configurações são preservados.
- O Buxx deve estar atualizado, conectado ao Cloud e com o proprietário correto. Sem snapshot do bot, a página não inventa um estado de sincronização.
- Imagens do celular e cores individuais continuam disponíveis em `/botconfig`; o site oferece paletas compartilhadas para as imagens.

Backend: função `valtrex-cloud`; usa as tabelas privadas existentes. Nenhuma migração ou chave pública nova é necessária.
