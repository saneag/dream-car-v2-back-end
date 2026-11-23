FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p uploads && chown -R node:node /app/uploads
USER node
EXPOSE 5000
CMD ["node", "index.js"]
