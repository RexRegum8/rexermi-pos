FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Install dependencies based on the package-lock.json
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1
# Provide a dummy JWT_SECRET to allow Next.js static page collection during build time
ENV JWT_SECRET=build_time_dummy_secret_only

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Automatically leverage Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.js ./entrypoint.js
COPY --from=builder --chown=nextjs:nodejs /app/src/data/database.sqlite ./src/data/database.sqlite

# Create the data directory for the SQLite volume and set permissions
USER root
RUN mkdir -p /data && chown -R nextjs:nodejs /data

USER nextjs

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Run our custom entrypoint script which handles database seeding
CMD ["node", "entrypoint.js"]
