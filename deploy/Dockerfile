FROM node:22-alpine AS build
WORKDIR /build
COPY . .
ARG VITE_GLOB_API_URL=/api
ENV VITE_GLOB_API_URL=${VITE_GLOB_API_URL}
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com \
    npm_config_registry=https://registry.npmmirror.com
RUN corepack enable \
    && corepack prepare pnpm@11.16.0 --activate \
    && pnpm install --frozen-lockfile \
    && pnpm -F @vben/web-antd build

FROM nginx:alpine
COPY --from=build /build/apps/web-antd/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
