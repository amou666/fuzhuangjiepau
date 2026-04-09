FROM node:20-alpine

WORKDIR /app

# Install OpenSSL and MySQL client for Prisma
RUN apk add --no-cache openssl mysql-client

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads/clothing uploads/models uploads/scenes uploads/results uploads/upscaled

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port
EXPOSE 3001

# Start command
CMD ["/app/start.sh"]
