# Fresh Pantry - PRD

## Original Problem Statement
Build a recipe and meal planning app that creates weekly shopping lists from your recipes.

## User Requirements Evolution
1. Initial: Recipe import + shopping list generation
2. Added: Paste ingredients (AI parsing)
3. Added: Screenshot upload (AI vision extraction)
4. Added: Google Sign-In (cross-device sync)
5. Added: Pantry inventory tracking with auto-deduct
6. Added: Recipe categories (Vegan, Veggie, etc.) with manual editing
7. Added: Smart shopping lists that subtract pantry inventory

## Current Design
- **Theme**: Fresh Greens - light, calm, foody, fun
- **Primary Color**: #4A7C59 (sage green)
- **Accent Color**: #E07A5F (terracotta for alerts)
- **Typography**: Playfair Display (headings) + Manrope (body)
- **Style**: Clean cards, rounded corners, subtle shadows

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI**: OpenAI GPT-4o (vision) + GPT-5.2 (text) via Emergent LLM Key
- **Auth**: Emergent-managed Google OAuth

## Core Features (Implemented)

### Recipe Management
- [x] Manual recipe entry with ingredients and instructions
- [x] Paste ingredients - AI parses and categorizes ingredients
- [x] Screenshot upload - AI vision extracts ingredients from images
- [x] Instructions screenshot upload - AI extracts cooking steps and times
- [x] URL import (limited - works with structured recipe pages)
- [x] Recipe library with search and category filters
- [x] Recipe detail view with "I Cooked This" button
- [x] AI-generated images for each recipe
- [x] Recipe categories (Vegan, Veggie, Pescatarian, Low Fat, Quick & Easy)
- [x] Manual category editing with toggle UI
- [x] Recipe grouping by shared ingredients

### Pantry/Inventory Tracking
- [x] Track all ingredients with quantities and units
- [x] Set low-stock thresholds per item
- [x] Set typical purchase amounts
- [x] Auto-deduct ingredients when marking recipe as "cooked"
- [x] Low-stock alerts on dashboard and pantry page
- [x] Add checked shopping items to pantry after shopping

### Shopping Lists
- [x] Generate from selected recipes
- [x] AI-powered ingredient consolidation (combines quantities)
- [x] **SMART SHOPPING**: Subtracts pantry inventory from needed items
- [x] Categorized view (produce, dairy, protein, etc.)
- [x] Check off items while shopping
- [x] Add checked items to pantry
- [x] Export to clipboard or print/PDF

### Weekly Planning
- [x] Day-by-day meal planning (7 meals max per week)
- [x] Navigate between weeks
- [x] Generate shopping list from week plan
- [x] Save plans per week
- [x] Recipe selection popup with Suggested, By Ingredient, and All tabs
- [x] Meal suggestions based on pantry inventory

### User Accounts
- [x] Google Sign-In via Emergent OAuth
- [x] Data syncs across devices
- [x] Works without login (backward compatible)

## API Endpoints

### Recipes
- POST /api/recipes - Create recipe (auto-generates image + categories)
- GET /api/recipes - List recipes
- GET /api/recipes/{id} - Get recipe
- DELETE /api/recipes/{id} - Delete recipe
- PUT /api/recipes/{id}/categories - Update recipe categories
- POST /api/recipes/{id}/generate-image - Generate AI image
- POST /api/recipes/import - Import from URL
- POST /api/parse-ingredients - Parse pasted text
- POST /api/parse-image - Extract from image
- POST /api/parse-instructions-image - Extract instructions from image
- GET /api/recipes/grouped - Get recipes grouped by shared ingredients

### Pantry
- GET /api/pantry - Get pantry inventory
- POST /api/pantry/items - Add item to pantry
- PUT /api/pantry/items/{id} - Update item
- DELETE /api/pantry/items/{id} - Remove item
- POST /api/pantry/cook - Deduct ingredients for recipe
- GET /api/pantry/low-stock - Get low stock alerts
- POST /api/pantry/add-from-shopping - Add checked shopping items

### Shopping List
- GET /api/shopping-list - Get current list
- POST /api/shopping-list/generate - Generate smart list (subtracts pantry)
- PUT /api/shopping-list - Update list
- POST /api/shopping-list/add-item - Add custom item
- DELETE /api/shopping-list/item/{id} - Remove item

### Weekly Plan
- GET /api/weekly-plan - Get plan for week
- POST /api/weekly-plan - Save week plan
- GET /api/weekly-plan/all - Get all plans

### Meal Suggestions
- GET /api/suggestions/meals - AI-powered meal suggestions based on pantry

### Auth
- POST /api/auth/session - Create session from OAuth
- GET /api/auth/me - Get current user
- POST /api/auth/logout - Logout

## Prioritized Backlog

### P1 (Important) - Future
- [ ] Drag & drop in weekly planner
- [ ] Recipe scaling (adjust servings in planner context)
- [ ] Expiry date tracking for pantry items
- [ ] Smart shopping suggestions based on usage patterns

### P2 (Nice to Have)
- [ ] Favorite recipes
- [ ] Email shopping list
- [ ] PWA support for mobile
- [ ] Barcode scanning for pantry
- [ ] Recipe sharing

## Tech Notes
- Image parsing uses GPT-5.1 (vision model) via ImageContent class
- Text parsing uses GPT-5.2
- All AI via Emergent LLM Key - no user API keys needed
- MongoDB with user_id scoping for multi-tenant support

## Changelog

### 2025-02-08 (Session 2)
- **Fixed**: Manual recipe re-categorization UI - Added edit button with pencil icon next to category badges, category toggle chips with icons, Save/Cancel functionality
- **Fixed**: Screenshot upload UX confusion - Added helper text "Upload an image above to enable extraction" when no image selected
- **Implemented**: Smart Shopping List - Now subtracts pantry inventory from generated shopping lists. Shows "have X in pantry" in the source field when adjusting quantities

### 2025-02-08 (Session 1)
- **Added**: AI-generated images for recipes
- **Improved**: Meal suggestions show ALL recipes with missing ingredients highlighted
- **Added**: Group recipes by shared ingredients
- **Improved**: Shopping list consolidation (combines quantities)
- **Added**: Auto-calculate cooking time from instructions
- **Added**: 7 meals per week limit on Weekly Planner
- **Added**: Instructions image upload with step extraction
- **Fixed**: Screenshot upload feature
- **Fixed**: Null value handling for ingredients
- **Updated**: Vision model from GPT-4o to GPT-5.1
