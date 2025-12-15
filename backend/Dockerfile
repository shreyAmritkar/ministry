# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies like nodemon)
RUN npm ci

# Copy application code
COPY . .

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs && \
    chown -R expressjs:nodejs /app

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && \
    chown -R expressjs:nodejs /app/uploads

USER expressjs

EXPOSE 5000

# Use npm start for production
CMD ["npm", "start"]