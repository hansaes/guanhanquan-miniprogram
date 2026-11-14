FROM node:22-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY cloudfunctions/api/ /app/cloudfunctions/api/
COPY contracts/ /app/contracts/
RUN mkdir -p /app/server/uploads && chown -R node:node /app/server/uploads
USER node
ENV NODE_ENV=production HOST=0.0.0.0
EXPOSE 3001
CMD ["node", "index.cjs"]
