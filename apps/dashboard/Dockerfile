# Build stage
FROM node:20-alpine as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# We need VITE_ env vars at build time for Vite to bake them into the JS
# But in some cloud environments, we might want to use a script to replace them at runtime
# For now, we'll assume they are provided during the build or use a flexible approach.
ARG VITE_API_URL
ARG VITE_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_KEY=$VITE_API_KEY

RUN npm run build

# Production stage
FROM nginx:stable-alpine as production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy custom nginx config if needed, or just use default
# EXPOSE 80 (Standard port, but some clouds use $PORT)
# Railway/Render usually detect the port or allow setting it.

CMD ["nginx", "-g", "daemon off;"]
