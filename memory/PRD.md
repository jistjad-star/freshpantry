# Fresh Pantry - PRD

## Original Problem Statement
Build a recipe and meal planning app that creates weekly shopping lists from your recipes.

## Current Features (All Implemented)

### Recipe Management
- [x] Manual recipe entry
- [x] AI ingredient parsing from pasted text
- [x] AI ingredient extraction from screenshots
- [x] AI instruction extraction from screenshots
- [x] Recipe editing after creation
- [x] Recipe categories (Vegan, Veggie, Pescatarian, Low Fat, Quick & Easy)
- [x] Manual category editing
- [x] AI-generated recipe images
- [x] Recipe sharing via unique shareable links
- [x] **Star Reviews** - Users can rate recipes 1-5 stars with optional comments
- [x] **Sort by Popularity** - Recipe library can be sorted by rating (Top Rated, Newest, Default)
- [x] **Favorites System** - Heart recipes and filter to show only favorites

### Pantry Management
- [x] Track ingredients with quantities
- [x] Auto-deduct when cooking recipes ("I Cooked This" feature)
- [x] Low-stock alerts (staples only)
- [x] Save button for editing pantry item quantities

### Meal Planning
- [x] Weekly planner (7 days)
- [x] "Add to Planner" button on recipe pages
- [x] Recipe selection popup with 3 tabs (Suggested, By Ingredient, All)
- [x] Servings display in planner

### AI Meal Suggestions  
- [x] Suggestions based on pantry ingredients
- [x] Match percentage and missing ingredients shown
- [x] **AI Recipe Generator** - Create new recipes from pantry only

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
- Backend: FastAPI, MongoDB
- AI: OpenAI GPT-5.2 + gpt-image-1 via Emergent LLM Key
- Auth: Google Sign-In via Emergent OAuth

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
- P1: Drag-and-drop weekly planner
- P2: Expiry date tracking
- P2: Recipe sharing links
- P2: PWA support
- P2: Scan receipt to pantry

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
