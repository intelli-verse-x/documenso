FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.js tools.js ./
ENV NODE_ENV=production
EXPOSE 3030
USER node
CMD ["node", "server.js"]
