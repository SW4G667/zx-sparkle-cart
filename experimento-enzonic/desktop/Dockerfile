# Opcional: requer que o provedor permita trocar a imagem Docker do servidor.
# Nao transforma um egg Python restrito em VPS.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates tini dbus-x11 xvfb openbox tint2 xterm x11vnc \
    novnc websockify x11-xserver-utils mesa-utils libgl1-mesa-dri \
    python3 procps fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/share/novnc/vnc.html /usr/share/novnc/index.html \
    && useradd -m -u 10001 desktop \
    && mkdir -p /opt/desktop /home/desktop/.vnc \
    && chown -R desktop:desktop /home/desktop

COPY start.sh /opt/desktop/start.sh
RUN chmod 755 /opt/desktop/start.sh
USER desktop
WORKDIR /home/desktop
ENV HOME=/home/desktop DISPLAY=:5 PORT=8080
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/desktop/start.sh"]
