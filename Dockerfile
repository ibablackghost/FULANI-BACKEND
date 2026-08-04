# Fulani Backend — Strapi 5 production image (Railway / Docker)
# Debian slim: plus fiable que Alpine (sharp / native modules)

# ---------- Build ----------
FROM node:20-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    git \
    libvips-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/app

COPY package.json package-lock.json ./
RUN npm config set fetch-retry-maxtimeout 600000 -g \
  && npm ci

COPY . .

ARG STRAPI_ADMIN_BACKEND_URL
ENV STRAPI_ADMIN_BACKEND_URL=${STRAPI_ADMIN_BACKEND_URL}
ENV NODE_ENV=production

RUN npm run build \
  && npm prune --omit=dev

# ---------- Runtime ----------
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libvips42 \
    wget \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

WORKDIR /opt/app

COPY --from=build /opt/app ./

RUN mkdir -p /opt/app/public/uploads \
  && chown -R node:node /opt/app

USER node
EXPOSE 1337

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:${PORT}/_health || exit 1

CMD ["npm", "run", "start"]
