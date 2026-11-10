FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# "server" = save to this server and sync across devices (see src/lib/api.ts).
ARG VITE_DATA_MODE=server
ENV VITE_DATA_MODE=$VITE_DATA_MODE
RUN npm run build

FROM nginx:1.27-alpine

ENV ADMIN_URL=manage/ \
    NGINX_ENVSUBST_FILTER=^ADMIN_URL$

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
