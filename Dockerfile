FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner
RUN apk add --no-cache python3 make g++

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib ./src/lib

RUN mkdir -p /app/data && node scripts/seed.js

EXPOSE 8080
CMD ["npm", "start"]
