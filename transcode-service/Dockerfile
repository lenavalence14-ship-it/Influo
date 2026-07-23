# Image Node légère + FFmpeg installé via apt.
# Nécessaire car FFmpeg n'est pas un package npm : c'est un binaire système,
# donc Render doit builder une image Docker qui l'installe (impossible sur le
# plan "Node" natif de Render qui ne permet pas d'installer des paquets apt).
FROM node:22-slim

RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

EXPOSE 10000

CMD ["node", "server.js"]
