# The Emerald Pantry - PRD

## Original Problem Statement
Build an app that takes Green Chef recipes and turns them into weekly shopping lists.

## User Choices
- Recipe input: Both manual entry AND URL import
- Shopping list features: Check off items, add custom items, adjust quantities, export/share options
- Authentication: Google Sign-In for cross-device sync (optional - works without login too)
- AI Features: Yes - using OpenAI GPT-5.2 for smart ingredient parsing/consolidation AND image extraction
- Design: Wicked (musical) themed - minimal, fresh, fun

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI Integration**: OpenAI GPT-5.2 via Emergent LLM Key (emergentintegrations library)
- **Auth**: Emergent-managed Google OAuth

## User Personas
1. **Home Cook**: Uses Green Chef meal kits, wants organized shopping
2. **Meal Planner**: Plans weekly meals in advance
3. **Budget Shopper**: Consolidates ingredients to minimize waste

## Core Requirements (Static)
- [x] Manual recipe entry with ingredients and instructions
- [x] URL import for recipe scraping + AI parsing
- [x] **Screenshot/Image upload** - AI extracts ingredients from photos
- [x] **Paste from Green Chef** - Copy/paste ingredients, AI parses them
- [x] Recipe library with search
- [x] Weekly meal planner (7 days)
- [x] AI-powered shopping list generation with ingredient consolidation
- [x] Categorized shopping list (produce, dairy, protein, etc.)
- [x] Check off items, add custom items
- [x] Export options (copy to clipboard, print/PDF)
- [x] **Google Sign-In** for cross-device sync
- [x] Wicked-themed dark UI design

## What's Been Implemented (Jan 2026)

### Backend (/app/backend/server.py)
- Recipe CRUD endpoints (create, read, delete)
- URL scraping with BeautifulSoup
- AI ingredient parsing with GPT-5.2
- **Image parsing endpoint** - Extract ingredients from screenshots
- Shopping list generation with AI consolidation
- Weekly plan management
- **Google OAuth** via Emergent Auth
- User sessions with 7-day expiry
- MongoDB integration with user-scoped data

### Frontend Pages
- Dashboard with hero section and quick stats
- Add Recipe with **4 tabs**:
  - Screenshot (AI vision extraction)
  - Paste Text (copy/paste from Green Chef)
  - Import URL
  - Manual entry
- Recipe Library with search
- Recipe Detail with generate list button
- Weekly Planner with day-by-day organization
- Shopping List with categories, checkboxes, export
- **Login page** with Google OAuth
- **User menu** with profile info and logout

### Design
- Wicked musical theme (Elphaba green #39ff14, Glinda pink #FFB7E3)
- Glassmorphism cards with dark backgrounds
- Playfair Display + Manrope fonts
- Glow effects and subtle animations

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Core recipe management
- [x] Shopping list generation
- [x] Basic weekly planning
- [x] Google Sign-In
- [x] Screenshot/image parsing

### P1 (Important) - Future
- [ ] Drag & drop recipes in weekly planner
- [ ] Recipe scaling (adjust servings)
- [ ] Persistent weekly plan history
- [ ] Share recipes with other users

### P2 (Nice to Have) - Future
- [ ] Recipe tags/categories
- [ ] Favorite recipes
- [ ] Email shopping list
- [ ] Dark/light mode toggle
- [ ] PWA support for mobile

## Next Tasks
1. Test image upload with actual Green Chef screenshots
2. Add drag & drop to weekly planner
3. Implement recipe scaling feature
4. Add meal type filters (breakfast, lunch, dinner)
