# Fresh Pantry - PRD

## Original Problem Statement
Build a recipe and meal planning app that creates weekly shopping lists from your recipes.

## Current Features (All Implemented)

### Recipe Management
- [x] Manual recipe entry
- [x] AI ingredient parsing from pasted text
- [x] AI ingredient extraction from screenshots
- [x] AI instruction extraction from screenshots
- [x] **Separate ingredient/instruction inputs** - Paste method has two text areas to prevent mixing
- [x] Recipe editing after creation
- [x] Recipe categories (Vegan, Veggie, Pescatarian, Low Fat, Quick & Easy)
- [x] **Meal type filters** - Breakfast, Lunch, Dinner, Snack filters in recipe library
- [x] **Source filter** - Filter recipes by source (Own Recipe, Green Chef, Gousto, etc.)
- [x] Manual category editing
- [x] **Photo choice dropdown** - AI Generate, Upload My Photo, or No Photo (Select dropdown)
- [x] AI-generated recipe images (stored as base64 for permanent access)
- [x] Recipe sharing via unique shareable links
- [x] **Image transfer on import** - Images converted to base64 when importing shared recipes
- [x] **Star Reviews** - Users can rate recipes 1-5 stars with optional comments
- [x] **Sort by Popularity** - Recipe library can be sorted by rating (Top Rated, Newest, Default)
- [x] **Favorites System** - Heart recipes and filter to show only favorites

### Pantry Management
- [x] Track ingredients with quantities
- [x] Auto-deduct when cooking recipes ("I Cooked This" feature)
- [x] Low-stock alerts (staples only)
- [x] Save button for editing pantry item quantities
- [x] **Custom alerts per item** - Bell icon to set low stock threshold for any item
- [x] **Add Essentials** - Quick-add 15 common pantry staples with pre-set alerts
- [x] **Sell-by date tracking** - Set expiry dates on items with colored status badges
- [x] **Expiry alerts** - Red (expired/today), orange (1-3 days), amber (4-7 days)

### Meal Planning
- [x] Weekly planner (7 days)
- [x] **Multiple recipes per day** - Up to 4 meals per day (breakfast, lunch, dinner, snack)
- [x] "Add to Planner" button on recipe pages
- [x] Recipe selection popup with 3 tabs (Suggested, By Ingredient, All)
- [x] **"Use expiring items" toggle** - Filter suggestions to prioritize expiring ingredients
- [x] Servings display in planner
- [x] "I Cooked This" feature - Deducts ingredients from pantry

### AI Meal Suggestions  
- [x] Suggestions based on pantry ingredients
- [x] Match percentage and missing ingredients shown
- [x] **AI Recipe Generator** - Create new recipes from pantry only
- [x] **Smart ingredient grouping** - Recipes scored by shared ingredients (2+) with other recipes
- [x] **"Use Expiring" filter** - Prioritize recipes using ingredients expiring within 7 days
- [x] Recommendation messages based on match quality and efficiency

### Shopping List
- [x] Smart generation (subtracts pantry inventory)
- [x] Ingredient consolidation
- [x] Category grouping
- [x] **UK Cost Estimates** with supermarket comparison
- [x] Best value shop recommendation (Tesco, Sainsbury's, Aldi, Lidl, Asda, Morrisons)
- [x] Export to clipboard/PDF
- [x] **Supermarket Quick Search Links** - Shop individual items at supermarket websites
- [x] **Shop All Button** - Open all unchecked items in chosen supermarket (multiple tabs)
- [x] **Edit Item Quantity** - Inline editing of quantity/unit after list generation

## Tech Stack
- Frontend: React 19, Tailwind CSS, Shadcn/UI
- Backend: FastAPI, MongoDB, Motor (async)
- AI: OpenAI SDK (GPT-4o-mini for text, DALL-E for images)
- Auth: Custom Google OAuth 2.0 (Authlib)
- Deployment: DigitalOcean App Platform (Dockerfile)

## API Endpoints
- PUT /api/recipes/{id} - Update recipe
- POST /api/recipes/export - Export selected recipes
- POST /api/recipes/import-batch - Import recipes from JSON
- POST /api/suggestions/generate-recipe - AI recipe from pantry
- GET /api/shopping-list/estimate-costs - UK supermarket pricing
- GET /api/recipes?sort_by=popularity - Get recipes sorted by rating
- GET /api/recipes/{id}/reviews - Get reviews for a recipe
- POST /api/recipes/{id}/reviews - Add a review to a recipe

## Changelog

### 2025-02-10 (Session 6 - Current)
- **FIXED**: Photo Choice dropdown now visible immediately on Add Recipe page (was hidden until after parsing)
- **FIXED**: Recipe grouping now shows only recipe pairs sharing 2+ ingredients (not single-ingredient groups)
- **FIXED**: AI images use Emergent integrations library properly (OpenAIImageGeneration, LlmChat classes)
- **Added**: "Use expiring items" toggle in Weekly Planner Suggested tab
- **Fixed**: Images stored as base64 data URLs for permanent access (prevents CDN expiry)

### 2025-02-09 (Session 4)
- **Fixed**: Deployment CORS issue - Added regex for Emergent domains to allow credentials
- **Added**: Star review system - Users can rate recipes 1-5 stars with comments
- **Added**: Popularity sort - Recipe library can sort by Top Rated, Newest, Default
- **Added**: Rating display on recipe cards in library view

### 2025-02-08 (Session 3)
- **Added**: Recipe editing page (`/recipes/{id}/edit`)
- **Added**: "Add to Planner" button on recipe detail
- **Added**: Recipe export/import (JSON files for sharing)
- **Added**: AI Recipe Generator from pantry ingredients
- **Added**: UK Cost Estimates for shopping lists
- **Added**: Best value shop recommendation
- **Fixed**: Pantry item editing (added Save button)
- **Improved**: Meal suggestions show available ingredients
- **Improved**: Servings display in weekly planner

### 2025-02-08 (Session 2)
- Category editing UI
- Screenshot upload helper text
- Smart shopping list (pantry subtraction)

### 2025-02-08 (Session 1)
- AI-generated images
- Recipe grouping by ingredients
- Shopping list consolidation
- Weekly planner improvements

## Future Tasks
- P1: **Backend Refactoring** - server.py is >2500 lines and needs to be split into modules (routes, models, services)
- P1: Drag-and-drop weekly planner
- P2: Expiry date tracking for pantry items
- P2: Whisk.com Integration for direct "add to basket"
- P2: PWA support
- P2: Scan receipt to pantry (OCR)

## DB Schema

### recipes collection
```json
{
  "id": "uuid",
  "user_id": "string",
  "name": "string",
  "description": "string",
  "servings": 2,
  "prep_time": "string",
  "cook_time": "string",
  "ingredients": [...],
  "instructions": [...],
  "categories": ["vegan", "quick-easy"],
  "image_url": "string",
  "average_rating": 4.5,
  "review_count": 10,
  "created_at": "datetime"
}
```

### reviews collection
```json
{
  "id": "uuid",
  "recipe_id": "string",
  "user_id": "string",
  "user_name": "string",
  "rating": 5,
  "comment": "string",
  "created_at": "datetime"
}
```
