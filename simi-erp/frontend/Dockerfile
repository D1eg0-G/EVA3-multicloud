FROM node:18-alpine

LABEL maintainer="Grupo SIMI ERP"
LABEL description="Frontend ERP Farmacia SIMI — Node.js + Express"

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80/health || exit 1

CMD ["node", "src/index.js"]