# Download API for vid2tune. Build from the repo root:
#   docker build -f server/Dockerfile -t vid2tune-api .
#   docker run -d -p 8787:8787 -e ALLOWED_ORIGINS=https://vid2tune.com --restart unless-stopped vid2tune-api
FROM node:20-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl \
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server/server.mjs ./server.mjs
USER node
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server.mjs"]
