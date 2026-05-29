# ============================================
# KITERP Website Builder - React/Vite
# ============================================

# ---------- Stage 1: Dependencies ----------
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

# ---------- Stage 2: Development ----------
FROM node:20-alpine AS development

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3003

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------- Stage 3: Build ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_API_URL=http://localhost:8000/api/v1
ARG VITE_PUBLIC_BASE_PATH=/
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_PUBLIC_BASE_PATH=${VITE_PUBLIC_BASE_PATH}

RUN npm run build

# ---------- Stage 4: Production (Nginx) ----------
FROM nginx:alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3003/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
