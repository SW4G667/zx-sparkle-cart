# Zenyx Cloud Desktop V2 — experimento Enzonic

Auditoria realizada em 13/10/2026 (UTC) apenas na ramificação experimento-desktop-enzonic-20261013. Nenhuma credencial está neste repositório.

## Estado verificado

| Componente | Estado | Evidência e limite |
| --- | --- | --- |
| Auditoria A e B | FUNCIONANDO | Scripts executados dentro de ambos os contêineres; cotas e imagens consultadas na API do painel. |
| Desktop Linux em A | FUNCIONANDO dentro do contêiner | TigerVNC, JWM e xterm ativos; [captura real](desktop/screenshot-real.png) feita no display :5. |
| noVNC em A | INSTALADO | HTTP 200 e upgrade WebSocket 101 no endereço interno 127.0.0.1:50130. |
| Desktop no navegador Android | BLOQUEADO | O HTTPS público astrosallers.enzonic.dev/vnc.html respondeu 503 mesmo com o serviço escutando na porta alocada. |
| Painel em B | PREPARADO | Login e sessão testados localmente. O HTTPS público de B também respondeu 503 com um servidor HTTP de prova ativo. |
| Flatpak de usuário | INSTALADO | Flatpak 1.14.10 e bubblewrap 0.8.0 executaram sem bibliotecas faltantes. |
| Sober | BLOQUEADO | A consulta assinada ao Flathub falhou porque GPG procura um agente em /usr/bin, indisponível sem root. |
| Cordial | INCOMPATÍVEL com o hardware atual | O projeto exige GPU Vulkan; nenhum contêiner possui /dev/dri. |
| Roblox jogável | BLOQUEADO | Nenhum cliente Roblox foi instalado, renderizado ou testado em uma experiência. |

As fases B, C e D não cumprem seus critérios finais de aprovação. A imagem prova uma sessão Linux gráfica real no servidor A. O HTTP 503 impede vê-la no celular.

## Infraestrutura medida

| Item | Servidor A — Python | Servidor B — JavaScript |
| --- | --- | --- |
| ID | 575d4dae | edee8577 |
| Imagem | ghcr.io/parkervcp/yolks:python_3.12 | ghcr.io/parkervcp/yolks:nodejs_20 |
| Sistema | Debian 12, x86_64, Python 3.12.15 | Debian 12, x86_64, Node 20.20.2, Python 3.11.2 |
| CPU | 4 lógicos visíveis; cota de 2 núcleos | 4 lógicos visíveis; cota de 2 núcleos |
| RAM no painel | 4096 MiB, sem swap | 3584 MiB, sem swap |
| Disco no painel | 15360 MiB | 5120 MiB |
| Alocação | 127.0.0.1:50130 | 127.0.0.1:50104 |
| Permissões | UID 988; /home/container gravável; /usr e /opt somente leitura; seccomp 2 | Mesmas restrições |
| GPU | Sem /dev/dri | Sem /dev/dri |

O cgroup informou memória máxima de 4.723.834.880 bytes em A e 4.133.486.592 bytes em B. Para o planejamento, prevalecem os limites menores mostrados no painel. O tamanho do sistema de arquivos visto pelo processo representa o host e não a cota individual. Os arquivos no diretório do usuário sobreviveram a paradas e reinícios comandados pelo painel; retenção após suspensão do provedor ainda não foi comprovada.

O painel só permite imagens Python ou Node, sem Docker personalizado. Pacotes Debian foram baixados e extraídos sem root em ~/.zenyx/root. Nenhuma mudança foi feita no kernel ou em /usr.

## Desktop e reconexão

[bootstrap.py](desktop/bootstrap.py) instala TigerVNC, JWM, xterm, noVNC, websockify e bibliotecas gráficas no diretório do usuário. [session.py](desktop/session.py) inicia 854 × 480 × 16 bits. O VNC aceita conexões só em loopback na porta 5905; o noVNC atende na alocação 50130. Logs ficam em ~/.zenyx/logs. O encerramento sinaliza os subprocessos.

O Xserver Debian embute o caminho /usr/bin/xkbcomp, indisponível na imagem. O script ajusta uma cópia privada de Xtigervnc para apontar ao xkbcomp extraído no espaço do usuário. A cópia original permanece intacta.

A [captura real](desktop/screenshot-real.png) mostra terminal, janela e barra do JWM. Uma amostra de uso mediu 96.096.256 bytes de RAM; outra com noVNC ativo mediu cerca de 60 MB. Depois das bibliotecas gráficas, o disco usado estava próximo de 50 MB, sem Roblox. São medições pontuais.

O teste local fechou e reabriu conexões VNC, e o processo permaneceu ativo. O armazenamento persistiu entre reinícios manuais. Reconexão via Android, suspensão automática e disponibilidade contínua não foram testadas.

Por padrão, a senha VNC é gerada aleatoriamente a cada início e não é publicada. Após a troca da senha SFTP exposta, pode-se criar ~/.zenyx/private/vnc-login.txt com oito caracteres ASCII, propriedade do usuário do contêiner e modo 0600. O VNC clássico considera apenas oito caracteres; acesso público requer HTTPS e autenticação adicional.

## Painel JavaScript

[server.js](panel/server.js) e [index.js](panel/index.js) formam o painel Node sem dependências npm. No primeiro início, ele gera uma senha aleatória, salva somente o hash scrypt em ~/.zenyx-panel/auth.json e guarda a senha inicial em ~/.zenyx-panel/primeiro-acesso.txt. Ambos os arquivos usam modo 0600. A senha não aparece no console. Cookies de sessão são Secure, HttpOnly e SameSite=Strict; a sessão pode ser encerrada e expira após 12 horas. Há limite de tentativas de login.

O painel consulta o HTTPS do desktop e apresenta indisponibilidade real quando ele responde 503. Não exibe CPU, RAM ou FPS fictícios. Login, cookie, senha incorreta, logout e estado indisponível passaram em teste HTTP local. Ele não foi ativado em B enquanto a senha SFTP publicada continuar válida. O subdomínio zenyx-desktop-v2.enzonic.dev respondeu 503 durante um teste com servidor HTTP de prova ativo.

## Roblox e gráficos

A possui SSE4.1 e SSE4.2 e permite namespace de usuário. Com Mesa por software, glxinfo informou llvmpipe, OpenGL 4.5 e perfil OpenGL ES 3.2. eglinfo saiu com código 1; o resultado GLX não comprova que a interface Sober abriria. Não há GPU física.

[Sober](https://vinegarhq.org/Sober/Installation.html#requirements) exige Linux x86-64, SSE4.1 e OpenGL ES 3.0 e é distribuído por Flatpak. Flatpak e bubblewrap iniciaram, mas a consulta assinada ao Flathub terminou em “No GPG signatures found” após tentar iniciar /usr/bin/gpg-agent, ausente na imagem sem root. A verificação de assinatura não foi desligada. O aplicativo, sua interface e experiências Roblox não foram testados.

[Cordial](https://luohoa97.github.io/cordial/) declara necessidade de GPU Vulkan. Sem /dev/dri, o servidor não atende esse requisito de hardware.

## Segurança e bloqueio externo

A chave de API exposta foi revogada e passou a responder 401. A senha SFTP também foi exposta; o usuário decidiu trocá-la depois dos testes, portanto ela não foi usada. Não ativar o painel com credenciais reais até essa rotação. Nenhum segredo está em código, commits, captura ou neste relatório.

O bloqueio decisivo para Android é a publicação HTTPS das alocações pela Enzonic. Ambos os subdomínios responderam 503 durante servidores HTTP ativos. É preciso verificar no painel ou com o suporte por que a rota não alcança os contêineres. Não usar túneis para contornar limites do provedor.

Fontes: [termos da Enzonic](https://enzonic.com/legal/terms), [Sober](https://sober.vinegarhq.org/), [requisitos do Sober](https://vinegarhq.org/Sober/Installation.html#requirements) e [Cordial](https://luohoa97.github.io/cordial/).
