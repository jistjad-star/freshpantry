# Fresh Pantry - PRD

## Original Problem Statement
Build a recipe and meal planning app that creates weekly shopping lists from your recipes.

## User Requirements Evolution
1. Initial: Recipe import + shopping list generation
2. Added: Paste ingredients (AI parsing)
3. Added: Screenshot upload (AI vision extraction)
4. Added: Google Sign-In (cross-device sync)
5. Added: Pantry inventory tracking with auto-deduct

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
- [x] URL import (limited - works with structured recipe pages)
- [x] Recipe library with search
- [x] Recipe detail view with "I Cooked This" button

### Pantry/Inventory Tracking
- [x] Track all ingredients with quantities and units
- [x] Set low-stock thresholds per item
- [x] Set typical purchase amounts
- [x] Auto-deduct ingredients when marking recipe as "cooked"
- [x] Low-stock alerts on dashboard and pantry page
- [x] Add checked shopping items to pantry after shopping

### Shopping Lists
- [x] Generate from selected recipes
- [x] AI-powered ingredient consolidation
- [x] Categorized view (produce, dairy, protein, etc.)
- [x] Check off items while shopping
- [x] Add checked items to pantry
- [x] Export to clipboard or print/PDF

### Weekly Planning
- [x] Day-by-day meal planning
- [x] Navigate between weeks
- [x] Generate shopping list from week plan
- [x] Save plans per week

### User Accounts
- [x] Google Sign-In via Emergent OAuth
- [x] Data syncs across devices
- [x] Works without login (backward compatible)

## API Endpoints

### Recipes
- POST /api/recipes - Create recipe
- GET /api/recipes - List recipes
- GET /api/recipes/{id} - Get recipe
- DELETE /api/recipes/{id} - Delete recipe
- POST /api/recipes/import - Import from URL
- POST /api/parse-ingredients - Parse pasted text
- POST /api/parse-image - Extract from image

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
- POST /api/shopping-list/generate - Generate from recipes
- PUT /api/shopping-list - Update list
- POST /api/shopping-list/add-item - Add custom item
- DELETE /api/shopping-list/item/{id} - Remove item

### Weekly Plan
- GET /api/weekly-plan - Get plan for week
- POST /api/weekly-plan - Save week plan
- GET /api/weekly-plan/all - Get all plans

### Auth
- POST /api/auth/session - Create session from OAuth
- GET /api/auth/me - Get current user
- POST /api/auth/logout - Logout

## Prioritized Backlog

### P1 (Important) - Future
- [ ] Drag & drop in weekly planner
- [ ] Recipe scaling (adjust servings)
- [ ] Expiry date tracking for pantry items
- [ ] Smart shopping suggestions based on usage patterns

### P2 (Nice to Have)
- [ ] Recipe tags/categories
- [ ] Favorite recipes
- [ ] Email shopping list
- [ ] PWA support for mobile
- [ ] Barcode scanning for pantry

## Tech Notes
- Image parsing uses GPT-5.1 (vision model) via ImageContent class
- Text parsing uses GPT-5.2
- All AI via Emergent LLM Key - no user API keys needed
- MongoDB with user_id scoping for multi-tenant support

## Changelog

### 2025-02-08
- **Added**: AI-generated images for recipes - when you add a recipe, an appetizing food photo is automatically generated using OpenAI GPT Image 1
- **Improved**: Meal suggestions now show ALL recipes, even with low match - clearly displays which ingredients are missing in an orange highlight box
- **Improved**: Weekly planner popup shows more suggestions with missing ingredients listed (e.g., "Missing: flour, eggs")
- **Added**: Group recipes by shared ingredients - "Group by Ingredients" button in Recipes page shows which recipes share common ingredients
- **Improved**: Shopping list consolidation - same ingredients from multiple recipes now combine quantities automatically (e.g., "2 cups flour" + "1 cup flour" = "3 cups flour")
- **Added**: Auto-calculate cooking time from instructions - AI extracts prep time and cook time when parsing instruction screenshots
- **Added**: Meal Suggestions page - AI-powered recommendations based on pantry inventory, showing match percentage and missing ingredients
- **Added**: 7 meals per week limit on Weekly Planner with visual indicator
- **Added**: "Get Suggestions" button on Planner page to quickly get meal recommendations
- **Added**: Instructions image upload - users can now upload a screenshot of cooking instructions and AI will extract the steps
- **Fixed**: Screenshot upload feature - changed from deprecated `image_url` parameter to `file_contents=[ImageContent(image_base64=...)]` in emergentintegrations library
- **Fixed**: Null value handling for ingredients without quantities
- **Updated**: Vision model from GPT-4o to GPT-5.1 (recommended vision model)
