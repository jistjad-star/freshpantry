# Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ ./
ARG REACT_APP_BACKEND_URL
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

# Nginx config
RUN echo 'server { \n\
    listen 8080; \n\
    location / { \n\
        root /var/www/html; \n\
        try_files $uri $uri/ /index.html; \n\
    } \n\
    location /api { \n\
        proxy_pass http://127.0.0.1:8001; \n\
        proxy_set_header Host $host; \n\
        proxy_set_header X-Real-IP $remote_addr; \n\
    } \n\
}' > /etc/nginx/sites-available/default

# Start script
RUN echo '#!/bin/bash \n\
nginx \n\
cd /app/backend && uvicorn server:app --host 127.0.0.1 --port 8001' > /start.sh && chmod +x /start.sh

EXPOSE 8080
CMD ["/start.sh"]
