FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg firefox-esr firefox-esr-l10n-pt-br fonts-dejavu-core \
    jwm novnc pcmanfm tigervnc-standalone-server tigervnc-tools websockify \
    x11-xkb-utils xterm && rm -rf /var/lib/apt/lists/*
COPY . /tmp/zenyx-source
RUN useradd -m -u 1000 -s /bin/sh container && \
    mkdir -p /home/container/assets /usr/share/novnc/zenyx && \
    cp -r /tmp/zenyx-source/desktop/assets/win11 /home/container/assets/win11 && \
    cp /tmp/zenyx-source/desktop/jwmrc-win11 /home/container/jwmrc && \
    cp /tmp/zenyx-source/desktop/welcome.html /home/container/welcome.html && \
    cp /tmp/zenyx-source/desktop/mobile.html /usr/share/novnc/mobile.html && \
    cp /tmp/zenyx-source/desktop/assets/win11/start.png /usr/share/novnc/zenyx/start.png && \
    cp /tmp/zenyx-source/preview/*.sh /home/container/ && \
    chmod 644 /usr/share/novnc/mobile.html /usr/share/novnc/zenyx/start.png && \
    chown -R container:container /home/container && rm -rf /tmp/zenyx-source
USER container
WORKDIR /home/container
ENV HOME=/home/container DISPLAY=:5
EXPOSE 7860
CMD ["sh", "/home/container/start.sh"]
