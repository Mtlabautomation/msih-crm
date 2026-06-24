# MSIH CRM V1.0 — Dockerfile
# Run the CRM in a container — no Node.js install needed on your host
# Usage: docker compose up --build
# Then open http://localhost:3000

FROM node:20-alpine

# Install bun for faster installs (optional)
RUN npm install -g bun

WORKDIR /app

# Copy package files first (better caching)
COPY package.json bun.lock* package-lock.json* ./
COPY prisma ./prisma

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the source
COPY . .

# Generate Prisma client + push schema + seed
RUN npx prisma generate
RUN npx prisma db push || true
RUN npx tsx prisma/seed.ts || true
RUN npx tsx prisma/seed-extras.ts || true

# Build the Next.js app
RUN npm run build || true

# Expose port
EXPOSE 3000

# Start the dev server (use "npm start" for production)
CMD ["npm", "run", "dev"]
