# Portal Vercel de acesso ao desktop

Este diretório é um projeto Vercel independente, sem dependências de execução. Configure **Root Directory** como `experimento-enzonic/vercel` em um projeto Vercel próprio do experimento. A página é um portal de estado; ela não contém um sistema operacional ou um desktop simulado.

`/api/status` faz uma única requisição GET a `https://vmcomputer.enzonic.dev/vnc.html`, com limite de 4,5 segundos. Apenas HTTP 200 habilita o botão que abre essa mesma página. HTTP 502/503/504, redefinição de conexão, timeout e respostas inesperadas são apresentados separadamente. O resultado não contém CPU, RAM ou FPS inferidos. A verificação HTTP não comprova que a conexão VNC, Roblox ou jogos funcionem.

O portal não controla os servidores, não recebe senhas e não armazena credenciais. A autenticação VNC ocorre na página de destino. A implantação não torna o backend Enzonic disponível; o acesso depende da rota pública da Enzonic responder e da sessão gráfica estar ativa.

Para desenvolvimento local, sirva os arquivos estáticos deste diretório e a função `api/status.js` conforme a documentação de Vercel Functions. Nenhuma chave de API é necessária para consultar o estado público.
