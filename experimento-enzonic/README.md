# Experimento Enzonic: desktop Linux leve

STATUS: fonte preparada no GitHub, mas NAO instalada na Enzonic; nenhuma confirmacao de GPU ou suporte a Roblox.

## Servidor Python informado: 4 GB RAM / 15 GB SSD
1. Execute desktop/diagnostico.py usando Python para verificar ambiente sem alterar arquivos.
2. Somente se a hospedagem permitir imagens Docker personalizadas, use desktop/Dockerfile.
3. Configure VNC_PASSWORD em variavel PRIVADA; abra apenas a porta HTTP PORT autorizada pela Enzonic via HTTPS.
4. Ambiente usa Openbox, Xvfb, tint2 e noVNC; nao instala Roblox.
5. Dockerfile e start.sh sao uma proposta; exigem compilacao da imagem, dependencias e permissao no Pterodactyl.

## Servidor JavaScript informado: 3,5 GB RAM / 5 GB SSD
1. Usar Node.js 20+ com panel/server.js e panel/package.json.
2. Configurar DASHBOARD_PASSWORD e DASHBOARD_SECRET aleatorio com pelo menos 24 caracteres por variaveis PRIVADAS.
3. Configurar DESKTOP_URL apenas apos testar a URL HTTPS publica do desktop.
4. Iniciar com node server.js e PORT disponibilizada pelo Pterodactyl.
5. O painel requer login, mas o noVNC exige senha VNC separada.

## Limites
- O servidor Enzonic nao estava acessivel pela rede deste ambiente; nenhuma instalacao remota foi feita.
- Hospedagem de bot Pterodactyl nao implica root, Docker, GPU, nem permissao para servidor grafico.
- Sober e Roblox dependem de compatibilidade grafica ainda nao verificada.
- Sem volume persistente, arquivos e sessoes podem desaparecer nas reinicializacoes.
- Nunca publicar credenciais. Revogar API e SFTP compartilhadas anteriormente.
- Projeto criado em branch separada; branch main nao alterada.
