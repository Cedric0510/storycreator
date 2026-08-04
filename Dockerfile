FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_BACKEND_MODE=cadarium
ARG NEXT_PUBLIC_CADARIUM_API_URL=/api/cadarium
ARG NEXT_PUBLIC_ENABLE_SELF_SIGNUP=false
ENV NEXT_PUBLIC_BACKEND_MODE=$NEXT_PUBLIC_BACKEND_MODE
ENV NEXT_PUBLIC_CADARIUM_API_URL=$NEXT_PUBLIC_CADARIUM_API_URL
ENV NEXT_PUBLIC_ENABLE_SELF_SIGNUP=$NEXT_PUBLIC_ENABLE_SELF_SIGNUP
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
