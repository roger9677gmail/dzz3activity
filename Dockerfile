FROM node:20-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* env vars must be present at `next build` time so they get
# inlined into the client bundle. Cloud Build passes this via --build-arg.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib ./src/lib

EXPOSE 8080
CMD ["npm", "start"]
