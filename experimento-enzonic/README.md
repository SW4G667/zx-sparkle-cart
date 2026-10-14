# Zenyx Cloud Desktop V2 — experimento Enzonic

Auditoria iniciada em 13/10/2026 (UTC), com verificações adicionais em 14/10/2026, apenas na ramificação experimento-desktop-enzonic-20261013. Nenhuma credencial está neste repositório.

## Estado verificado

| Componente | Estado | Evidência e limite |
| --- | --- | --- |
| Auditoria A e B | FUNCIONANDO | Scripts executados dentro de ambos os contêineres; cotas e imagens consultadas na API do painel. |
| Desktop Linux em A | FUNCIONANDO dentro do contêiner | TigerVNC, JWM e xterm ativos; [captura real](desktop/screenshot-real.png) feita no display :5. |
| Visual e gerenciador de arquivos | FUNCIONANDO dentro do contêiner | [Desktop com tema](desktop/screenshot-themed-real.png) e [PCManFM aberto](desktop/screenshot-files-real.png) capturados no servidor A. |
| Firefox ESR em português | FUNCIONANDO dentro do contêiner, com limitação de segurança | [Captura real de example.org via HTTPS](desktop/screenshot-browser-real.png); isolamento Landlock protegeu a senha VNC. O sandbox interno do Firefox precisou ser desativado. |
| noVNC em A | INSTALADO | HTTP 200 e upgrade WebSocket 101 no endereço interno 127.0.0.1:50130. |
| Desktop no navegador Android | BLOQUEADO | O domínio legado deu `ERR_CONNECTION_RESET` no Chrome; o novo endereço HTTPS gerenciado `vmcomputer.enzonic.dev` responde 502 porque a origem na porta 50130 ainda não é alcançada. |
| Painel em B | PREPARADO | Login e sessão testados localmente. A consulta HTTPS externa a B recebeu reset antes da resposta HTTP; o painel ainda não foi ativado no servidor. |
| Flatpak de usuário | INSTALADO | Flatpak 1.14.10 e bubblewrap 0.8.0 executaram sem bibliotecas faltantes; a criação efetiva do sandbox bubblewrap falhou por falta de permissão de montagem. |
| Sober | BLOQUEADO | A consulta assinada ao Flathub falhou na configuração GPG; além disso, o contêiner negou a montagem de namespace exigida pelo bubblewrap. |
| Cordial em A/B | BLOQUEADO | A versão 0.27 não roda diretamente no Debian 12 dos servidores: `cordial-run` requer GLIBC_2.38 e o sistema fornece 2.36. A interface e o Vulkan por CPU foram testados apenas em um contêiner local Ubuntu 24.04. |
| Vulkan por software local | FUNCIONANDO no teste local | `vkcube` renderizou pelo llvmpipe no Xvfb; isso não mede o desempenho do Roblox nem comprova funcionamento na Enzonic. |
| Roblox jogável | BLOQUEADO | Nenhum cliente Roblox foi instalado, renderizado ou testado em uma experiência. |

As fases B, C e D não cumprem seus critérios finais de aprovação. A imagem prova uma sessão Linux gráfica real no servidor A. O acesso pelo celular ainda não foi comprovado.

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

[bootstrap.py](desktop/bootstrap.py) instala TigerVNC, JWM, xterm, noVNC, websockify e bibliotecas gráficas no diretório do usuário. [browser_bootstrap.py](desktop/browser_bootstrap.py) extrai Firefox ESR, tradução pt-BR e PCManFM sem root. [session.py](desktop/session.py) inicia 854 × 480 × 16 bits. O VNC aceita conexões só em loopback na porta 5905; o noVNC atende na alocação 50130. Logs ficam em ~/.zenyx/logs. O encerramento sinaliza os subprocessos.

O [tema JWM](desktop/jwmrc) usa [papel de parede](desktop/wallpaper.png), menu e barra com atalhos reais para navegador, arquivos e terminal. O Firefox abre sob demanda, mantendo a sessão inicial leve. A [página inicial](desktop/welcome.html) explica o uso do ambiente e contém links de navegação. Os atalhos da barra têm 46 px de altura; a interação por toque no Android permanece sem teste por causa do HTTPS 503.

O Xserver Debian embute o caminho /usr/bin/xkbcomp, indisponível na imagem. O script ajusta uma cópia privada de Xtigervnc para apontar ao xkbcomp extraído no espaço do usuário. A cópia original permanece intacta.

A [captura inicial](desktop/screenshot-real.png) mostra terminal, janela e barra do JWM; a [captura atual](desktop/screenshot-themed-real.png) mostra o tema novo. A instalação inicial usou cerca de 60 a 96 MB de RAM. Com Firefox, PCManFM e uma página HTTPS abertos, uma medição posterior pela API registrou 432,4 MiB de RAM, 847 MiB de disco e 0,22% de CPU. Durante a abertura, o cgroup registrou 568.471.552 bytes de RAM. São medições pontuais, sem Roblox.

### Navegador e limitação do sandbox

O Firefox ESR e PCManFM abriram janelas reais no display VNC. A [captura de arquivos](desktop/screenshot-files-real.png) mostra PCManFM. A [captura do navegador](desktop/screenshot-browser-real.png) mostra `https://example.org` renderizado e os menus em português brasileiro. O acesso HTTPS externo foi comprovado no navegador do contêiner; o acesso remoto a esse navegador pelo celular continua bloqueado.

Sem ajuste, o processo de conteúdo do Firefox cai com `Sandbox: chroot: EPERM` e sinal 11. Com `MOZ_DISABLE_CONTENT_SANDBOX=1`, ele renderiza páginas. O bubblewrap não conseguiu montar namespace (`Failed to make / slave: Permission denied`). O kernel ofereceu Landlock ABI 8. [browser_guard.py](desktop/browser_guard.py) aplica regras antes de iniciar o Firefox e exige que o processo não consiga ler `~/.zenyx/private/vnc.passwd` nem `~/.zenyx/private/vnc-login.txt`, enquanto consegue ler a própria página inicial. Se essa verificação falhar, o navegador não inicia. Seus dados ficam em `~/.zenyx/firefox-home`. Essa proteção de arquivos **não equivale ao sandbox interno do Firefox**; o aviso de segurança visível no navegador é legítimo. Não use o navegador para contas sensíveis neste ambiente.

O teste local fechou e reabriu conexões VNC, e o processo permaneceu ativo. O armazenamento persistiu entre reinícios manuais. Reconexão via Android, suspensão automática e disponibilidade contínua não foram testadas.

Após a falha 502, o código de [session.py](desktop/session.py) passou a verificar HTTP e WebSocket antes de aprovar a inicialização e a cada 10 segundos durante a sessão. Se o websockify sair ou falhar três verificações seguidas, apenas esse processo é reiniciado, com limite de três reinícios em 60 segundos; o VNC e o JWM são preservados. Um teste local com processos e respostas HTTP/WebSocket simulados cobriu recuperação e limite de tentativas. **Essa correção ainda não foi implantada em A e não comprova solução do 502 do túnel.**

No primeiro início, [session.py](desktop/session.py) gera uma senha VNC aleatória, salva-a uma única vez em `/home/container/.zenyx/private/vnc-login.txt` com permissão 0600 e a reutiliza após reinícios. Ela não aparece no console nem nos logs. O proprietário pode lê-la no **Pterodactyl → servidor A → Arquivos → `.zenyx/private/vnc-login.txt`**. Para escolher outra, pare a sessão, substitua o conteúdo desse arquivo por exatamente oito caracteres ASCII imprimíveis, mantenha o usuário do contêiner como proprietário e a permissão 0600, e reinicie. Se o editor alterar a permissão, restaure 0600 antes de iniciar; o script recusa arquivos com permissão incorreta. Não publique a senha. O VNC clássico considera apenas oito caracteres; acesso público requer HTTPS e autenticação adicional.

## Painel JavaScript

[server.js](panel/server.js) e [index.js](panel/index.js) formam o painel Node sem dependências npm. No primeiro início, ele gera uma senha aleatória, salva somente o hash scrypt em ~/.zenyx-panel/auth.json e guarda a senha inicial em ~/.zenyx-panel/primeiro-acesso.txt. Ambos os arquivos usam modo 0600. A senha não aparece no console. Cookies de sessão são Secure, HttpOnly e SameSite=Strict; a sessão pode ser encerrada e expira após 12 horas. Há limite de tentativas de login.

O painel consulta o HTTPS do desktop e apresenta indisponibilidade real quando ele responde 503. Não exibe CPU, RAM ou FPS fictícios. Login, cookie, senha incorreta, logout e estado indisponível passaram em teste HTTP local. Ele não foi ativado em B enquanto a senha SFTP publicada continuar válida. Uma consulta via proxy de saída deste ambiente a zenyx-desktop-v2.enzonic.dev respondeu 503 durante um teste com servidor HTTP de prova ativo.

## Roblox e gráficos

A possui SSE4.1 e SSE4.2 e permite namespace de usuário. Com Mesa por software, glxinfo informou llvmpipe, OpenGL 4.5 e perfil OpenGL ES 3.2. eglinfo saiu com código 1; o resultado GLX não comprova que a interface Sober abriria. Não há GPU física.

[Sober](https://vinegarhq.org/Sober/Installation.html#requirements) exige Linux x86-64, SSE4.1 e OpenGL ES 3.0 e é distribuído por Flatpak. Flatpak e bubblewrap exibiram versão, mas a consulta assinada ao Flathub terminou em “No GPG signatures found” após tentar iniciar /usr/bin/gpg-agent, ausente na imagem sem root. Uma tentativa real de iniciar o isolamento bubblewrap terminou em `Failed to make / slave: Permission denied`, e `unshare -Urm true` terminou em `cannot change root filesystem propagation: Permission denied`. A verificação de assinatura não foi desligada. O aplicativo, sua interface e experiências Roblox não foram testados.

[Cordial](https://luohoa97.github.io/cordial/) pode detectar Vulkan por software. Em um contêiner **local** Ubuntu 24.04 limitado a 2 CPUs e 4 GiB, sem `/dev/dri`, instalamos o pacote oficial Cordial 0.27.0 para amd64 (SHA-256 `edf01f89b0ee725fee9d309d25e1ebdaa1e453f28515d46c4df6685a593cbe82`). O [diagnóstico local completo](desktop/diagnostics-cordial-local.txt) aceitou o llvmpipe como dispositivo Vulkan de CPU, com aviso explícito de que Roblox seria muito lento, além de apontar falta de áudio e D-Bus. A [interface do Cordial aberta](desktop/screenshot-cordial-launcher-local.png) e uma [cena Vulkan real renderizada pelo llvmpipe](desktop/screenshot-vulkan-local.png) foram capturadas no Xvfb. O processo Cordial usava cerca de 282 MiB de RSS e o Xvfb 66 MiB em uma medição sem jogo.

O botão de instalação chegou à tela [“No Roblox build found”](desktop/screenshot-cordial-download-local.png). O download automático falhou ao alcançar `api.pureapk.com`; a consulta HTTP externa recebeu uma página Cloudflare 403 (“Sorry, you have been blocked”), inclusive com os cabeçalhos esperados pelo cliente. Não removemos a verificação de assinatura nem importamos um APK não verificado. A [documentação de instalação do Cordial](https://raw.githubusercontent.com/luohoa97/cordial/main/docs/install.md) permite importar manualmente um APK Roblox assinado com `lib/x86_64/libroblox.so` ou `base.apk` acompanhado de `split_config.x86_64.apk`. Um APK extraído de celular ARM comum não satisfaz essa arquitetura. Não há APK x86_64 disponível neste experimento.

Isso ainda não instala Cordial na Enzonic: o `cordial-run` 0.27.0 referencia obrigatoriamente `GLIBC_2.38` (verificado com `objdump -T`), enquanto ambos os servidores usam Debian 12 com glibc 2.36. O pacote também precisa de bibliotecas gráficas adicionais. O teste local de Ubuntu 24.04 demonstra apenas que a interface e Vulkan por CPU abrem; não houve execução do cliente Roblox, carregamento de experiência, medição de FPS nem teste no celular. GPU física continua ausente nos servidores.

## Segurança e bloqueio externo

A chave de API exposta foi revogada e passou a responder 401. A senha SFTP também foi exposta; o usuário decidiu trocá-la depois dos testes, portanto ela não foi usada. Não ativar o painel com credenciais reais até essa rotação. Nenhum segredo está em código, commits, captura ou neste relatório.

O acesso público pelo domínio legado falhou em três caminhos: no Chrome Android do proprietário, `astrosallers.enzonic.dev/vnc.html` mostrou `ERR_CONNECTION_RESET`; em um Sandbox Vercel temporário na região `gru1`, HTTPS dos subdomínios legados A e B foi redefinido durante a conexão (`curl` 35) e HTTP também foi redefinido (`curl` 56), ambos antes de receber resposta HTTP; pelo proxy de saída deste ambiente, as consultas devolveram HTTP 503 com `upstream connect error or disconnect/reset before headers`. No mesmo Sandbox, `https://panel.enzonic.com/` respondeu 200, funcionando como controle de conectividade. O Sandbox foi parado após a medição.

Um print do painel enviado pelo proprietário mostra `astrosallers.enzonic.dev` como subdomínio ativo da alocação principal `127.0.0.1:50130`; outro mostra o servidor A ligado há quase 12 horas e o diagnóstico interno com HTTP e upgrade WebSocket funcionando na porta 50130. Isso localiza a falha **fora do serviço HTTP interno**, mas ainda não revela se o reset ocorre na borda do domínio ou na rota até o nó. É preciso examinar o mapeamento com o provedor. Não usar túneis para contornar limites do provedor.

O [código público atual da aba Rede](https://panel.enzonic.com/build/assets/NetworkContainer-BV-OtHD2.js) revelou dois fluxos distintos: o subdomínio antigo usa `/subdomain`, enquanto o botão **“Obter endereço enzonic.dev”** oferece um endereço gerenciado do tipo **“HTTPS website”** via `/custom-domains`. A interface descreve HTTP simples em `0.0.0.0:50130`, com HTTPS e WebSockets gerenciados pela Enzonic. Criar um endereço gerenciado é separado da exclusão do subdomínio antigo. Não há evidência suficiente para afirmar que o domínio legado possui rota HTTPS.

O proprietário criou **`vmcomputer.enzonic.dev`** por esse fluxo gratuito em 14/10/2026. A verificação do painel marcou DNS e rota Cloudflare Tunnel como concluídos, mas mostrou “HTTPS is ready, but nothing answers on port 50130” e depois “Too Many Attempts”. A consulta pública ao novo `https://vmcomputer.enzonic.dev/vnc.html` chegou à Cloudflare e devolveu HTTP 502, enquanto o domínio legado sofria reset. Conforme a [documentação da Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/troubleshooting/), 502 nessa configuração significa que o túnel não conseguiu conectar ao serviço de origem.

O proprietário então reiniciou A uma vez. Em capturas com 30–43 segundos de atividade, o Console **voltou a registrar** `http_loopback:true`, `websocket_upgrade:true`, `websockify_running:true` e `web_port:50130`. No mesmo período o Chrome mostrou Cloudflare 502 “Host Error” para `vmcomputer.enzonic.dev`; a consulta pública posterior também continuou em 502. Assim, o problema não se explica apenas pelo tempo de atividade anterior. A ligação entre o túnel gerenciado e a porta publicada precisa ser verificada pelo provedor. O diagnóstico interno é pontual e não prova que o processo continuou escutando em todos os instantes; a correção de monitoramento descrita acima ainda não está no servidor A.

Mensagem técnica pronta para o suporte da Enzonic (ainda **não enviada**): “Olá. No servidor 575d4dae, alocação principal `127.0.0.1:50130`, criei o endereço HTTPS gerenciado `vmcomputer.enzonic.dev`. A interface marca DNS e Cloudflare Tunnel concluídos, mas informa ‘nothing answers on port 50130’. Reiniciei o servidor; com menos de um minuto de atividade o aplicativo registrou HTTP 200 e upgrade WebSocket 101 em `127.0.0.1:50130`; o código configura bind em `0.0.0.0:50130`. Mesmo assim, o endereço HTTPS continuou retornando Cloudflare 502 Host Error. Poderiam verificar o URL de origem do túnel, o namespace/rede em que ele roda e o mapeamento da alocação `127.0.0.1:50130` até o contêiner? Não alterem outros servidores ou aplicações. Se essa alocação não puder ser alcançada pelo HTTPS gerenciado, indiquem a alocação gratuita correta.”

## Prévia visual e controles — 14/10/2026

O [tema claro inspirado na organização do Windows 11](desktop/jwmrc-win11), os [ícones e papel de parede originais](desktop/assets/win11/generate.py) e o [visor móvel](desktop/mobile.html) foram preparados. A prévia em Docker usa Debian 12, JWM, TigerVNC, noVNC, Firefox ESR pt-BR, PCManFM e xterm. Ela é um desktop Linux real; não é uma simulação HTML nem é o servidor Enzonic.

O contêiner local abriu a sessão 854 × 480 × 16 bits. [Captura real do Firefox nessa sessão](desktop/screenshot-win11-browser-local.png) e [captura do noVNC em formato paisagem de celular](desktop/screenshot-win11-mobile-local.png). Em Chromium automatizado, a página `mobile.html` conectou por WebSocket/VNC sem erro de JavaScript. Mouse e toque abriram o menu JWM; o mouse abriu xterm; o teclado do visor enviou `TOQUE_OK` ao xterm; a API de tela cheia retornou ativa. Após fechar a conexão e criar outra, o texto permaneceu na mesma janela, comprovando reconexão enquanto o contêiner continuou ativo. O noVNC traduz toque longo ou dois dedos em clique direito, conforme o código da versão 1.3 usada no teste; o clique direito não foi validado em hardware Android real.

O [instalador do tema](desktop/install_theme.py) copia os arquivos apenas para o diretório do usuário do servidor A e guarda o JWM anterior. Foi testado em HOME temporário. Ele **não foi executado na Enzonic**: a chave de API exposta foi revogada, a senha SFTP exposta ainda aguarda rotação e o acesso público apresentou reset no Android. A sessão antiga em A mantém o visual anterior. Com o tema implantado e a rota validada, o visor será `https://astrosallers.enzonic.dev/mobile.html`; esse endereço **não está funcional agora**.

A Vercel conectada contém `zenyxapplications`, que publica outro repositório e outro aplicativo. Para testar a rota sem alterar esse aplicativo, foi criado o projeto separado `zenyx-desktop-v2`, ainda **sem implantação**. Seu Sandbox de diagnóstico ficou ativo por cerca de 106 segundos e foi parado. Vercel Functions no plano gratuito não oferecem uma sessão gráfica contínua com GPU, nem resolvem a conexão externa com a Enzonic que também falhou a partir do Sandbox. A Hugging Face conectada permite apenas leitura de repositórios; o único Space encontrado, `china12n/007-ai-agent-runtime`, é outro projeto. A [documentação atual de Spaces](https://huggingface.co/docs/hub/spaces-overview) informa que criar um Space Docker requer plano pago. Nenhum desses serviços foi apresentado como um PC funcional, nem houve implantação neles.

O objetivo de Roblox segue bloqueado: não há GPU em A/B, o Flatpak/Sober não iniciou, o Cordial atual não roda diretamente no Debian 12 e o download automático do APK x86_64 assinado falhou no teste local. Nenhuma experiência foi carregada; a meta de 50 a 70 FPS não foi medida e não pode ser prometida. O tema e o visor não alteram esses requisitos. A rota HTTPS e a rotação de credenciais são pendências para o acesso público seguro; a viabilidade de Roblox também depende de um runtime gráfico aceito pelo contêiner.

Fontes: [termos da Enzonic](https://enzonic.com/legal/terms), [Sober](https://sober.vinegarhq.org/), [requisitos do Sober](https://vinegarhq.org/Sober/Installation.html#requirements) e [Cordial](https://luohoa97.github.io/cordial/).
