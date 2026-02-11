# Fresh Pantry 🥬

A recipe and meal planning app that creates weekly shopping lists from your recipes.

## Features
- 📝 Recipe management with AI-powered ingredient parsing
- 🍹 Cocktails section with alcoholic/non-alcoholic filtering
- 🗓️ Weekly meal planner with "Surprise Me" auto-populate
- 🛒 Smart shopping list generation (subtracts pantry items)
- 💰 UK supermarket cost estimates
- ⭐ Recipe reviews and ratings
- 🥘 AI meal suggestions based on pantry items
- 📸 Barcode scanning for pantry items
- 🧾 Receipt scanning (image/PDF) to add pantry items
- 🔄 "I Cooked This" to deduct ingredients from pantry
- 🥗 "Make Vegan/Vegetarian" AI recipe conversion
- 📦 Pantry with expiry tracking and low-stock alerts

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI, Python
- **Database**: MongoDB
- **AI**: OpenAI GPT-4o (text & images)
- **Auth**: Google OAuth 2.0

## Environment Variables Required

| Variable | Service | Description |
|----------|---------|-------------|
| `MONGO_URL` | Backend | MongoDB connection string |
| `DB_NAME` | Backend | Database name (default: freshpantry) |
| `OPENAI_API_KEY` | Backend | OpenAI API key for AI features |
| `GOOGLE_CLIENT_ID` | Backend | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Backend | Google OAuth client secret |
| `APP_URL` | Backend | Your app's URL (e.g., https://your-app.ondigitalocean.app) |
| `SECRET_KEY` | Backend | Secret key for session encryption |
| `REACT_APP_BACKEND_URL` | Frontend (build arg) | Backend API URL (leave empty for same-domain) |

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
3. Add billing/credits (~$5-10 is enough to start)

### 3. Set Up Google OAuth (Required for Login)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Set **Authorized JavaScript origins**:
   - `https://your-app-name.ondigitalocean.app`
7. Set **Authorized redirect URIs**:
   - `https://your-app-name.ondigitalocean.app/api/auth/google/callback`
8. Copy the **Client ID** and **Client Secret**

### 4. Deploy on DigitalOcean App Platform
1. Fork this repo to your GitHub
2. Go to [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
3. Create App → Select your forked repo
4. DigitalOcean will detect the Dockerfile
5. Add **Environment Variables**:
   ```
   MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/freshpantry
   DB_NAME=freshpantry
   OPENAI_API_KEY=sk-your-openai-key
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   APP_URL=https://your-app-name.ondigitalocean.app
   SECRET_KEY=generate-a-random-32-char-string
   ```
6. Note: Leave `REACT_APP_BACKEND_URL` empty (frontend and backend are same domain)
7. Deploy!

### 5. After First Deploy
1. Copy your DigitalOcean app URL
2. Update Google OAuth redirect URIs with the actual URL
3. Update `APP_URL` environment variable with the actual URL
4. Redeploy

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
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
APP_URL=http://localhost:3000
SECRET_KEY=dev-secret-key-for-local-only
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

## API Documentation
Once running, visit `/docs` for interactive Swagger API documentation.

## License
MIT
