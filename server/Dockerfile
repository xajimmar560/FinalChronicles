FROM node:18-alpine

WORKDIR /app

# install production dependencies from root package.json
COPY package*.json ./
RUN npm install --production

# copy only backend source
COPY server ./server

EXPOSE 3001

CMD ["node", "server/server.js"]
