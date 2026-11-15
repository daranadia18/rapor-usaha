# Web app Rapor Usaha (statis + API) untuk dijalankan di Docker tanpa Node di komputer.
# Dipakai service "web" di docker-compose.yml (profile "lengkap"). Produksi tetap di Vercel.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY vercel.json ./
COPY api ./api
COPY public ./public
COPY scripts ./scripts
USER node
EXPOSE 3000
CMD ["node", "scripts/dev-server.js"]
