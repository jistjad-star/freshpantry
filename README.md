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
- **AI**: OpenAI GPT-5.2

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB (local or Atlas)

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create backend/.env
MONGO_URL=mongodb://localhost:27017
DB_NAME=freshpantry
EMERGENT_LLM_KEY=your_openai_key
CORS_ORIGINS=http://localhost:3000

# Run
uvicorn server:app --reload --port 8001
```

### Frontend Setup
```bash
cd frontend
yarn install

# Create frontend/.env
REACT_APP_BACKEND_URL=http://localhost:8001

# Run
yarn start
```

## Deployment

### DigitalOcean App Platform
1. Fork this repository
2. Connect to DigitalOcean App Platform
3. Import the `app.yaml` configuration
4. Set environment variables:
   - `MONGO_URL`: Your MongoDB Atlas connection string
   - `EMERGENT_LLM_KEY`: Your OpenAI API key

### Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `MONGO_URL` | Backend | MongoDB connection string |
| `DB_NAME` | Backend | Database name (default: freshpantry) |
| `EMERGENT_LLM_KEY` | Backend | OpenAI API key |
| `CORS_ORIGINS` | Backend | Allowed origins for CORS |
| `REACT_APP_BACKEND_URL` | Frontend | Backend API URL |

## License
MIT
