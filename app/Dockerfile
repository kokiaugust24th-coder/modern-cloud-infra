# ビルド検証用コンテナイメージ。
# フェーズ0のデプロイ先は Cloudflare Pages(静的ホスティング)だが、
# workload-portability の要件により、同一コードベースからコンテナ
# イメージを生成できることを CI で継続的に検証する。
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
