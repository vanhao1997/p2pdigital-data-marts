FROM node:22-alpine AS build

WORKDIR /app
COPY . .

ENV NODE_ENV=production
ENV DOCS_SITE=https://docs.p2pdigital.io.vn
ENV DOCS_BASE=

# Static-site tooling is required in the build stage.
RUN npm ci --include=dev
RUN npm run build:docs

FROM nginx:alpine

COPY --from=build /app/apps/docs/dist /usr/share/nginx/html
COPY apps/docs/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
