# Fulani Backend — Strapi 5 production image (Railway / Docker)
# Multi-stage: build admin + server, then slim runtime

# ---------- Build ----------
FROM node:20-alpine AS build

RUN apk update && apk add --no-cache \
  build-base gcc autoconf automake zlib-dev libpng-dev bash vips-dev git \
  > /dev/null 2>&1

WORKDIR /opt/
COPY package.json package-lock.json ./
RUN npm install -g node-gyp
RUN npm config set fetch-retry-maxtimeout 600000 -g && npm ci

ENV PATH=/opt/node_modules/.bin:$PATH
WORKDIR /opt/app
COPY . .

# Optional: bake admin API URL at build time (Railway can pass as build arg)
ARG STRAPI_ADMIN_BACKEND_URL
ENV STRAPI_ADMIN_BACKEND_URL=${STRAPI_ADMIN_BACKEND_URL}

ENV NODE_ENV=production
RUN npm run build

# ---------- Runtime ----------
FROM node:20-alpine

RUN apk add --no-cache vips-dev wget

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

WORKDIR /opt/
COPY --from=build /opt/package.json /opt/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

ENV PATH=/opt/node_modules/.bin:$PATH
WORKDIR /opt/app
COPY --from=build /opt/app ./

RUN mkdir -p /opt/app/public/uploads \
  && chown -R node:node /opt/app

USER node
EXPOSE 1337

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:${PORT}/_health || exit 1

CMD ["npm", "run", "start"]
