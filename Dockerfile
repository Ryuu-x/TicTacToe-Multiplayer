# Build stage for client
FROM node:20-alpine AS client-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy server package files and install dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

# Copy server source code
COPY server/ ./

# Copy built client
WORKDIR /app
COPY --from=client-build /app/client/build ./client/build

# Copy root package.json for the start script
COPY package.json ./

WORKDIR /app/server

EXPOSE 4000

CMD ["node", "index.js"]
