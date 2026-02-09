# Fresh Pantry 🥬

A recipe and meal planning app that creates weekly shopping lists from your recipes.

## Features
- 📝 Recipe management with AI-powered ingredient parsing
- 🗓️ Weekly meal planner
- 🛒 Smart shopping list generation
- 💰 UK supermarket cost estimates
- ⭐ Recipe reviews and ratings
- 🥘 AI meal suggestions based on pantry items

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI, Python
- **Database**: MongoDB
- **AI**: OpenAI GPT-4o

## Environment Variables Required

| Variable | Service | Description |
|----------|---------|-------------|
| `MONGO_URL` | Backend | MongoDB connection string |
| `DB_NAME` | Backend | Database name (default: freshpantry) |
| `OPENAI_API_KEY` | Backend | OpenAI API key for AI features |
| `CORS_ORIGINS` | Backend | Allowed origins for CORS |
| `REACT_APP_BACKEND_URL` | Frontend | Backend API URL |

## Deploy to DigitalOcean

### 1. Get MongoDB Atlas (Free)
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a free M0 cluster
3. Create a database user with password
4. Network Access → Add IP `0.0.0.0/0`
5. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/freshpantry`

### 2. Get OpenAI API Key
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Add billing/credits

### 3. Deploy on DigitalOcean App Platform
1. Fork this repo to your GitHub
2. Go to [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
3. Create App → Select your forked repo
4. DigitalOcean will detect the Dockerfile
5. Add Environment Variables:
   - `MONGO_URL` = your MongoDB Atlas connection string
   - `OPENAI_API_KEY` = your OpenAI API key
   - `DB_NAME` = freshpantry
   - `CORS_ORIGINS` = *
6. Deploy!

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create backend/.env
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=freshpantry
OPENAI_API_KEY=sk-your-key-here
CORS_ORIGINS=http://localhost:3000
EOF

uvicorn server:app --reload --port 8001
```

### Frontend
```bash
cd frontend
yarn install

# Create frontend/.env
cat > .env << EOF
REACT_APP_BACKEND_URL=http://localhost:8001
EOF

yarn start
```

## License
MIT
