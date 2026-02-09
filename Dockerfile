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

# Nginx config - proxy /api to backend
RUN rm /etc/nginx/sites-enabled/default
COPY <<EOF /etc/nginx/sites-enabled/default
server {
    listen 8080;
    
    location / {
        root /var/www/html;
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Startup script
COPY <<EOF /start.sh
#!/bin/bash
set -e
nginx
cd /app/backend
exec uvicorn server:app --host 127.0.0.1 --port 8001
EOF
RUN chmod +x /start.sh

EXPOSE 8080
CMD ["/start.sh"]
