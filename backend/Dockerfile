# Build stage
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Pre-install Playwright browsers in the build stage for caching
RUN npx playwright install chromium 2>/dev/null || true

# Test stage — run: docker build --target test -t backend-test . && docker run --rm backend-test
FROM build AS test
CMD ["npm", "test"]

# Production stage
FROM node:18-alpine

# Chromium for Puppeteer chart screenshots
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CHROMIUM_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

EXPOSE 3000
EXPOSE 3002

CMD ["npm", "run", "start:prod"]
