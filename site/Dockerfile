# Static marketing site for canopydata.app
# Build context: the repository root (matches `railway up`, which uploads the
# repo root; the canopy-site service sets RAILWAY_DOCKERFILE_PATH=site/Dockerfile)
FROM nginx:alpine

WORKDIR /usr/share/nginx/html
RUN rm -rf ./*

COPY site/index.html .
COPY site/assets ./assets

COPY site/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
