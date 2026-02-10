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

# Copy backend
COPY backend/requirements.txt ./
# Install emergentintegrations from private index, then other requirements
RUN pip install --no-cache-dir emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ && \
    pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/

# Copy frontend build into backend static folder
COPY --from=frontend-build /app/frontend/build ./backend/static

EXPOSE 8080
WORKDIR /app/backend
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
