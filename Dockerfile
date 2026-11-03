# --- Stage 1: Build the static frontend assets ---
FROM node:20-alpine AS builder
WORKDIR /app

# Declare the build arguments your app expects (e.g., VITE_API_URL or NEXT_PUBLIC_API_URL)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copy dependency manifests and install packages
COPY package*.json ./
RUN npm ci --production=false

# Copy all source files and build
COPY . .
RUN npm run build

# --- Stage 2: Serve with Nginx ---
FROM nginx:alpine

# Copy built assets from the builder stage to Nginx's public folder
COPY --from=builder /app/dist /usr/share/nginx/html

# (Optional) If your build folder is named .next, build, or out instead of dist, change the path above accordingly.

# Expose port 80 inside the container
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]