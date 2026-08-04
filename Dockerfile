# Fulani Backend — Strapi 5 production image (Railway / Docker)
# Node 22 + Debian slim (évite Alpine/musl + sharp, et EBADENGINE >=22.13)

# ---------- Build ----------
FROM node:22-bookworm-slim AS build

# Utilise les binaires précompilés de sharp (évite la compile native)
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_update_notifier=false

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    git \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/app

COPY package.json package-lock.json ./
RUN npm config set fetch-retry-maxtimeout 600000 -g \
  && npm ci \
  && npm install --os=linux --cpu=x64 sharp@0.34.5

COPY . .

ARG STRAPI_ADMIN_BACKEND_URL
ENV STRAPI_ADMIN_BACKEND_URL=${STRAPI_ADMIN_BACKEND_URL}
ENV NODE_ENV=production

RUN npm run build \
  && npm prune --omit=dev

# ---------- Runtime ----------
FROM node:22-bookworm-slim

ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV NODE_ENV=production
ENV HOST=::
ENV PORT=1337

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/app

COPY --from=build /opt/app ./

RUN mkdir -p /opt/app/public/uploads \
  && chown -R node:node /opt/app

USER node
EXPOSE 1337

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:${PORT}/health || exit 1

CMD ["npm", "run", "start"]
