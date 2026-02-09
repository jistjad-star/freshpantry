# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
COPY frontend/yarn.lock ./
RUN yarn install
COPY frontend/ ./
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
RUN yarn build

# Production image
FROM python:3.11-slim
WORKDIR /app

# Install nginx
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Copy backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/

# Copy frontend build
COPY --from=frontend-build /app/frontend/build /var/www/html

# Copy config files
COPY nginx.conf /etc/nginx/sites-enabled/default
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080
CMD ["/start.sh"]
