# ============================================
# KITERP Storefront Web - React/Vite
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

EXPOSE 3002

CMD ["npm", "run", "dev:vite", "--", "--host", "0.0.0.0", "--port", "3002"]

# ---------- Stage 3: Build ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_API_URL=http://localhost:8000/api/v1
ARG VITE_PUBLIC_BASE_PATH=/
ARG VITE_BASE_DOMAIN=kiterp.com
ARG VITE_VENDOR_URL=http://localhost:3001
ARG VITE_ADMIN_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_PUBLIC_BASE_PATH=${VITE_PUBLIC_BASE_PATH}
ENV VITE_BASE_DOMAIN=${VITE_BASE_DOMAIN}
ENV VITE_VENDOR_URL=${VITE_VENDOR_URL}
ENV VITE_ADMIN_URL=${VITE_ADMIN_URL}

RUN npm run build

# ---------- Stage 4: Production (Nginx) ----------
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3002/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
