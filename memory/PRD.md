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
- [x] Recipe categories (Vegan, Veggie, Pescatarian, Low Fat, Quick & Easy, Can be Vegan)
- [x] **Make Vegan conversion** - AI button converts any recipe to vegan with plant-based substitutes
- [x] **Make Vegetarian conversion** - AI button converts meat/fish recipes to vegetarian
- [x] **Meal type filters** - Breakfast, Lunch, Dinner, Snack filters in recipe library
- [x] **Source filter** - Filter recipes by source (Own Recipe, Green Chef, Gousto, etc.)
- [x] Manual category editing
- [x] **Photo choice dropdown** - AI Generate, Upload My Photo, or No Photo (Select dropdown)
- [x] AI-generated recipe images (stored as base64 for permanent access)
- [x] **Star Reviews** - Users can rate recipes 1-5 stars with optional comments
- [x] **Sort by Popularity** - Recipe library can be sorted by rating (Top Rated, Newest, Default)
- [x] **Favorites System** - Heart recipes and filter to show only favorites
- [x] **Select All for Export** - Button to select all visible recipes for sharing

### Cocktails Section (NEW)
- [x] **Cocktails navigation** - Dedicated "Cocktails" link in header navigation
- [x] **Cocktails page** - Filterable list of cocktail recipes with search
- [x] **Alcoholic/Non-Alcoholic filter** - Toggle buttons to filter by alcohol content
- [x] **Add Cocktail** - Button links to Add Recipe page with cocktail mode pre-selected
- [x] **Meal/Cocktail toggle** - Recipe type selector on Add Recipe page
- [x] **Alcoholic checkbox** - "Contains alcohol" toggle when adding cocktails
- [x] **URL param support** - ?type=cocktail auto-selects cocktail mode

### Copyright-Safe Private Sharing
- [x] **Private Import Links** - Single-use, 15-minute tokens (not persistent URLs)
- [x] **AI Instruction Rewriting** - Original wording generated from step graph
- [x] **N-gram Compliance Check** - Blocks 8+ word matches, target ≤0.15 overall overlap
- [x] **Safe Fields Only** - Shares ingredients (facts) + rewritten instructions only
- [x] **No Third-Party Images** - Imported recipes have no images (user adds their own)
- [x] **Domain Quotas** - Per-site limits to respect database rights
- [x] **Legal UX** - Privacy-focused import page with copyright notices

### Pantry Management
- [x] Track ingredients with quantities
- [x] Auto-deduct when cooking recipes ("I Cooked This" feature)
- [x] Low-stock alerts (staples only)
- [x] Save button for editing pantry item quantities
- [x] **Custom alerts per item** - Bell icon to set low stock threshold for any item
- [x] **Add Essentials** - Quick-add 15 common pantry staples with pre-set alerts
- [x] **Sell-by date tracking** - Set expiry dates on items with colored status badges
- [x] **Expiry alerts** - Red (expired/today), orange (1-3 days), amber (4-7 days)
- [x] **Receipt Scanning** - Upload photo/PDF of receipt to extract items with AI
- [x] **Barcode scanning** - Scan product barcodes to look up and add items
- [x] **Fill level prompt** - Select how full an item is when adding via barcode
- [x] **Merge Duplicates** - Button to consolidate duplicate pantry items
- [x] **Filter Low Stock** (NEW) - Toggle to show only low stock items
- [x] **Select Items** (NEW) - Checkboxes on each pantry item for selection
- [x] **Select All / Low Stock** (NEW) - Buttons to quickly select all or only low stock items
- [x] **Export to Shopping List** (NEW) - Add selected items to shopping list with one click

### Dashboard
- [x] **Expiry Notification Banner** - Shows expired and expiring items with colored badges
- [x] **"Use Now" button** - Links to meal suggestions that use expiring items
- [x] **Expiring stat card** - Shows count of expiring items in dashboard stats

### Meal Planning
- [x] Weekly planner (7 days)
- [x] **Multiple recipes per day** - Up to 4 meals per day (breakfast, lunch, dinner, snack)
- [x] "Add to Planner" button on recipe pages
- [x] Recipe selection popup with 3 tabs (Suggested, By Ingredient, All)
- [x] **"Use expiring items" toggle** - Filter suggestions to prioritize expiring ingredients
- [x] Servings display in planner
- [x] **Servings adjustment** - Adjust servings when adding recipes to planner
- [x] **Surprise Me** - Auto-populate the week with suggested meals
- [x] **Meal click actions** - Clicking a planned meal shows "I Cooked It" or "Go to Recipe" options
- [x] "I Cooked This" feature - Deducts ingredients from pantry

### AI Meal Suggestions  
- [x] Suggestions based on pantry ingredients
- [x] Match percentage and missing ingredients shown
- [x] **AI Recipe Generator** - Create new recipes from pantry only
- [x] **Smart ingredient grouping** - Recipes scored by shared ingredients (2+) with other recipes
- [x] **"Use Expiring" filter** - Prioritize recipes using ingredients expiring within 7 days
- [x] **Expiring ingredients display** - Shows which expiring items each recipe uses
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
- [x] **Check All / Uncheck All** - Buttons to quickly check/uncheck all items
- [x] **Add from Pantry Low Stock** (NEW) - Pantry items can be exported to shopping list

## Tech Stack
- Frontend: React 19, Tailwind CSS, Shadcn/UI
- Backend: FastAPI, MongoDB, Motor (async)
- AI: OpenAI SDK (GPT-4o for text/vision, DALL-E for images)
- Auth: Custom Google OAuth 2.0 (Authlib)
- Deployment: DigitalOcean App Platform (Dockerfile)

## API Endpoints
- GET /api/cocktails - Get all cocktail recipes with optional ?alcoholic=true/false filter (NEW)
- POST /api/shopping-list/add-items - Add multiple items to shopping list (NEW)
- PUT /api/recipes/{id} - Update recipe
- POST /api/recipes/export - Export selected recipes
- POST /api/recipes/import-batch - Import recipes from JSON
- POST /api/suggestions/generate-recipe - AI recipe from pantry
- GET /api/shopping-list/estimate-costs - UK supermarket pricing
- GET /api/recipes?sort_by=popularity - Get recipes sorted by rating
- GET /api/recipes/{id}/reviews - Get reviews for a recipe
- POST /api/recipes/{id}/reviews - Add a review to a recipe
- GET /api/pantry/expiring-soon - Get items expiring within N days
- POST /api/pantry/scan-receipt - Scan receipt image/PDF to extract items
- POST /api/pantry/add-from-receipt - Add extracted items to pantry
- GET /api/pantry/barcode/{barcode} - Look up product by barcode
- POST /api/pantry/consolidate - Merge duplicate pantry items
- POST /api/recipes/share - Create private import token
- GET /api/recipes/shared/{token} - Get minimal share preview
- POST /api/recipes/import-shared/{token} - Import safe fields only
- POST /api/recipes/{recipe_id}/make-vegan - Convert recipe to vegan with AI
- POST /api/recipes/{recipe_id}/make-vegetarian - Convert recipe to vegetarian with AI

## Changelog

### 2025-02-11 (Session 9 - Current)
- **Added**: Cocktails section - New dedicated page for cocktail recipes
- **Added**: Cocktails navigation link in header
- **Added**: Meal/Cocktail toggle on Add Recipe page
- **Added**: "Contains alcohol" checkbox when adding cocktails
- **Added**: GET /api/cocktails endpoint with alcoholic filter
- **Added**: Pantry "Filter Low Stock" toggle button
- **Added**: Pantry item selection checkboxes
- **Added**: "Select All" and "Select Low Stock" buttons
- **Added**: "Export to List" button - adds selected pantry items to shopping list
- **Added**: POST /api/shopping-list/add-items endpoint for bulk adding items

### 2025-02-11 (Session 8)
- **Added**: "Make Vegan" button on recipe detail page - AI converts all animal products to plant-based alternatives
- **Added**: "Make Vegetarian" button on recipe detail page - AI converts meat/fish to vegetarian substitutes
- **Fixed**: Route registration order in server.py - API endpoints now properly registered
- **Fixed**: Backend returns full updated recipe data after conversion for proper UI refresh

### 2025-02-10 (Session 7)
- **MAJOR**: Copyright-safe private recipe sharing system
  - AI rewrites instructions from step graph with original wording
  - N-gram compliance checks (8-gram < 0.01, overall ≤ 0.15)
  - Single-use, 15-minute import tokens (not persistent URLs)
  - Only safe fields shared: ingredients (facts) + rewritten instructions
  - No third-party images transferred - user adds their own photos
  - Domain quotas to respect database rights
  - Privacy-focused import UI with legal notices
- **Added**: Dashboard expiry notification banner - Shows expired/expiring items with colored badges
- **Added**: "Use Now" button to link directly to meal suggestions using expiring items
- **Added**: "Expiring" stat card on dashboard showing count of items expiring soon
- **Added**: Receipt scanning feature - Upload photo/PDF of supermarket receipt
- **Added**: AI-powered item extraction from receipts using GPT-4o vision
- **Added**: Bulk add extracted items to pantry with selection checkboxes
- **Fixed**: Vision API integration - Updated to use FileContent with content_type='image'
- **Verified**: Select All in recipe library, Check All in shopping list, expiring ingredients display

### 2025-02-10 (Session 6)
- **FIXED**: Photo Choice dropdown now visible immediately on Add Recipe page (was hidden until after parsing)
- **FIXED**: Recipe grouping now shows only recipe pairs sharing 2+ ingredients (not single-ingredient groups)
- **FIXED**: AI images use proper OpenAI SDK
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
- P0: **Backend Refactoring** - server.py is >4500 lines and URGENTLY needs to be split into modules (routes, models, services)
- P1: Drag-and-drop weekly planner
- P1: Fix PDF upload issues (environment API key configuration)
- P1: Improve fuzzy matching for pantry consolidation and ingredient matching
- P2: Whisk.com Integration for direct "add to basket"
- P2: PWA support
- P2: Push notifications for expiring items

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
  "recipe_type": "meal",  // "meal" or "cocktail" (NEW)
  "is_alcoholic": true,   // For cocktails only (NEW)
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

### pantry_items
```json
{
  "id": "uuid",
  "name": "string",
  "quantity": 2.5,
  "unit": "L",
  "category": "dairy",
  "min_threshold": 0.5,
  "typical_purchase": 2,
  "expiry_date": "2025-02-15",
  "last_updated": "datetime"
}
```
