from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx
from bs4 import BeautifulSoup
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class Ingredient(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    quantity: str
    unit: str
    category: str = "other"
    checked: bool = False

class Recipe(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = ""
    servings: int = 2
    prep_time: Optional[str] = ""
    cook_time: Optional[str] = ""
    ingredients: List[Ingredient] = []
    instructions: List[str] = []
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RecipeCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    servings: int = 2
    prep_time: Optional[str] = ""
    cook_time: Optional[str] = ""
    ingredients: List[Ingredient] = []
    instructions: List[str] = []
    image_url: Optional[str] = None

class RecipeImport(BaseModel):
    url: str

class ShoppingListItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    quantity: str
    unit: str
    category: str
    checked: bool = False
    recipe_source: Optional[str] = None

class ShoppingList(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[ShoppingListItem] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShoppingListGenerate(BaseModel):
    recipe_ids: List[str]

class ShoppingListUpdate(BaseModel):
    items: List[ShoppingListItem]

class WeeklyPlanDay(BaseModel):
    day: str
    recipe_ids: List[str] = []

class WeeklyPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    week_start: str
    days: List[WeeklyPlanDay] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WeeklyPlanCreate(BaseModel):
    week_start: str
    days: List[WeeklyPlanDay]

# ============== HELPER FUNCTIONS ==============

async def parse_ingredients_with_ai(raw_text: str, recipe_name: str) -> List[Ingredient]:
    """Use AI to parse raw ingredient text into structured data"""
    if not EMERGENT_LLM_KEY:
        logger.warning("No EMERGENT_LLM_KEY found, returning empty ingredients")
        return []
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ingredient-parse-{uuid.uuid4()}",
            system_message="""You are a helpful assistant that parses recipe ingredients into structured JSON format.
            For each ingredient, extract:
            - name: the ingredient name (e.g., "chicken breast", "olive oil")
            - quantity: the amount (e.g., "2", "1/2", "1 cup")
            - unit: the unit of measurement (e.g., "lb", "cups", "tbsp", "pieces", "" for items like "1 onion")
            - category: one of: produce, dairy, protein, grains, pantry, spices, frozen, other
            
            Return ONLY a valid JSON array, no markdown or explanation."""
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(
            text=f"Parse these ingredients from the recipe '{recipe_name}':\n\n{raw_text}"
        )
        
        response = await chat.send_message(user_message)
        
        # Parse the JSON response
        import json
        # Clean up response - remove markdown code blocks if present
        clean_response = response.strip()
        if clean_response.startswith("```"):
            clean_response = clean_response.split("```")[1]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:]
        clean_response = clean_response.strip()
        
        ingredients_data = json.loads(clean_response)
        return [Ingredient(**ing) for ing in ingredients_data]
    except Exception as e:
        logger.error(f"Error parsing ingredients with AI: {e}")
        return []

async def consolidate_ingredients_with_ai(items: List[ShoppingListItem]) -> List[ShoppingListItem]:
    """Use AI to consolidate similar ingredients"""
    if not EMERGENT_LLM_KEY or len(items) < 2:
        return items
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"consolidate-{uuid.uuid4()}",
            system_message="""You are a helpful assistant that consolidates shopping list items.
            Combine similar ingredients (e.g., "2 cups chicken broth" + "1 cup chicken broth" = "3 cups chicken broth").
            Keep items organized by category.
            
            Return ONLY a valid JSON array with these fields for each item:
            - id: string (generate new UUID)
            - name: string
            - quantity: string
            - unit: string
            - category: one of: produce, dairy, protein, grains, pantry, spices, frozen, other
            - checked: boolean (always false)
            - recipe_source: string or null
            
            No markdown or explanation, just the JSON array."""
        ).with_model("openai", "gpt-5.2")
        
        items_text = "\n".join([f"- {item.quantity} {item.unit} {item.name} (category: {item.category})" for item in items])
        
        user_message = UserMessage(
            text=f"Consolidate these shopping list items:\n\n{items_text}"
        )
        
        response = await chat.send_message(user_message)
        
        import json
        clean_response = response.strip()
        if clean_response.startswith("```"):
            clean_response = clean_response.split("```")[1]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:]
        clean_response = clean_response.strip()
        
        consolidated_data = json.loads(clean_response)
        return [ShoppingListItem(**item) for item in consolidated_data]
    except Exception as e:
        logger.error(f"Error consolidating ingredients: {e}")
        return items

async def scrape_recipe_from_url(url: str) -> dict:
    """Scrape recipe data from Green Chef or similar recipe URLs"""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client_http:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            response = await client_http.get(url, headers=headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Try to find recipe data
            recipe_data = {
                'name': '',
                'description': '',
                'ingredients_text': '',
                'instructions_text': '',
                'image_url': None,
                'source_url': url
            }
            
            # Try to get title
            title_selectors = ['h1', '.recipe-title', '[data-test-id="recipe-name"]', '.recipe-name']
            for selector in title_selectors:
                title_elem = soup.select_one(selector)
                if title_elem:
                    recipe_data['name'] = title_elem.get_text(strip=True)
                    break
            
            # Try to get description
            desc_selectors = ['.recipe-description', '[data-test-id="recipe-description"]', 'meta[name="description"]']
            for selector in desc_selectors:
                desc_elem = soup.select_one(selector)
                if desc_elem:
                    if desc_elem.name == 'meta':
                        recipe_data['description'] = desc_elem.get('content', '')
                    else:
                        recipe_data['description'] = desc_elem.get_text(strip=True)
                    break
            
            # Try to get ingredients
            ing_selectors = ['.ingredients', '[data-test-id="ingredients"]', '.recipe-ingredients', '.ingredient-list']
            for selector in ing_selectors:
                ing_elem = soup.select_one(selector)
                if ing_elem:
                    recipe_data['ingredients_text'] = ing_elem.get_text('\n', strip=True)
                    break
            
            # If no structured ingredients found, look for list items
            if not recipe_data['ingredients_text']:
                ing_items = soup.select('li[class*="ingredient"], .ingredient-item')
                if ing_items:
                    recipe_data['ingredients_text'] = '\n'.join([item.get_text(strip=True) for item in ing_items])
            
            # Try to get instructions
            inst_selectors = ['.instructions', '[data-test-id="instructions"]', '.recipe-instructions', '.directions']
            for selector in inst_selectors:
                inst_elem = soup.select_one(selector)
                if inst_elem:
                    recipe_data['instructions_text'] = inst_elem.get_text('\n', strip=True)
                    break
            
            # Try to get image
            img_selectors = ['.recipe-image img', '[data-test-id="recipe-image"]', 'meta[property="og:image"]', '.hero-image img']
            for selector in img_selectors:
                img_elem = soup.select_one(selector)
                if img_elem:
                    if img_elem.name == 'meta':
                        recipe_data['image_url'] = img_elem.get('content')
                    else:
                        recipe_data['image_url'] = img_elem.get('src') or img_elem.get('data-src')
                    break
            
            return recipe_data
    except Exception as e:
        logger.error(f"Error scraping recipe: {e}")
        raise HTTPException(status_code=400, detail=f"Could not fetch recipe from URL: {str(e)}")

# ============== API ROUTES ==============

@api_router.get("/")
async def root():
    return {"message": "The Emerald Pantry API - Wicked good shopping lists!"}

# ---- Recipe Routes ----

@api_router.post("/recipes", response_model=Recipe)
async def create_recipe(recipe_data: RecipeCreate):
    """Create a new recipe manually"""
    recipe = Recipe(**recipe_data.model_dump())
    doc = recipe.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.recipes.insert_one(doc)
    return recipe

@api_router.post("/recipes/import", response_model=Recipe)
async def import_recipe(import_data: RecipeImport):
    """Import a recipe from URL (scrape + AI parse)"""
    scraped = await scrape_recipe_from_url(import_data.url)
    
    if not scraped['name']:
        scraped['name'] = "Imported Recipe"
    
    # Parse ingredients with AI
    ingredients = []
    if scraped['ingredients_text']:
        ingredients = await parse_ingredients_with_ai(scraped['ingredients_text'], scraped['name'])
    
    # Parse instructions
    instructions = []
    if scraped['instructions_text']:
        instructions = [step.strip() for step in scraped['instructions_text'].split('\n') if step.strip()]
    
    recipe = Recipe(
        name=scraped['name'],
        description=scraped['description'],
        ingredients=ingredients,
        instructions=instructions,
        source_url=scraped['source_url'],
        image_url=scraped['image_url']
    )
    
    doc = recipe.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.recipes.insert_one(doc)
    return recipe

@api_router.get("/recipes", response_model=List[Recipe])
async def get_recipes():
    """Get all recipes"""
    recipes = await db.recipes.find({}, {"_id": 0}).to_list(1000)
    for recipe in recipes:
        if isinstance(recipe.get('created_at'), str):
            recipe['created_at'] = datetime.fromisoformat(recipe['created_at'])
    return recipes

@api_router.get("/recipes/{recipe_id}", response_model=Recipe)
async def get_recipe(recipe_id: str):
    """Get a single recipe by ID"""
    recipe = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if isinstance(recipe.get('created_at'), str):
        recipe['created_at'] = datetime.fromisoformat(recipe['created_at'])
    return recipe

@api_router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str):
    """Delete a recipe"""
    result = await db.recipes.delete_one({"id": recipe_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"message": "Recipe deleted successfully"}

# ---- Shopping List Routes ----

@api_router.post("/shopping-list/generate", response_model=ShoppingList)
async def generate_shopping_list(data: ShoppingListGenerate):
    """Generate a shopping list from selected recipes"""
    items = []
    
    for recipe_id in data.recipe_ids:
        recipe = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
        if recipe:
            for ing in recipe.get('ingredients', []):
                item = ShoppingListItem(
                    name=ing['name'],
                    quantity=ing['quantity'],
                    unit=ing['unit'],
                    category=ing.get('category', 'other'),
                    recipe_source=recipe['name']
                )
                items.append(item)
    
    # Consolidate similar ingredients using AI
    if items:
        items = await consolidate_ingredients_with_ai(items)
    
    shopping_list = ShoppingList(items=items)
    doc = shopping_list.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    # Upsert - replace existing or create new
    await db.shopping_lists.delete_many({})  # Keep only one active list
    await db.shopping_lists.insert_one(doc)
    
    return shopping_list

@api_router.get("/shopping-list", response_model=Optional[ShoppingList])
async def get_shopping_list():
    """Get the current shopping list"""
    shopping_list = await db.shopping_lists.find_one({}, {"_id": 0})
    if shopping_list:
        if isinstance(shopping_list.get('created_at'), str):
            shopping_list['created_at'] = datetime.fromisoformat(shopping_list['created_at'])
        if isinstance(shopping_list.get('updated_at'), str):
            shopping_list['updated_at'] = datetime.fromisoformat(shopping_list['updated_at'])
    return shopping_list

@api_router.put("/shopping-list", response_model=ShoppingList)
async def update_shopping_list(data: ShoppingListUpdate):
    """Update the shopping list (check items, modify quantities, etc.)"""
    shopping_list = await db.shopping_lists.find_one({}, {"_id": 0})
    if not shopping_list:
        raise HTTPException(status_code=404, detail="No shopping list found")
    
    shopping_list['items'] = [item.model_dump() for item in data.items]
    shopping_list['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.shopping_lists.update_one({}, {"$set": shopping_list})
    
    if isinstance(shopping_list.get('created_at'), str):
        shopping_list['created_at'] = datetime.fromisoformat(shopping_list['created_at'])
    if isinstance(shopping_list.get('updated_at'), str):
        shopping_list['updated_at'] = datetime.fromisoformat(shopping_list['updated_at'])
    
    return shopping_list

@api_router.post("/shopping-list/add-item", response_model=ShoppingList)
async def add_custom_item(item: ShoppingListItem):
    """Add a custom item to the shopping list"""
    shopping_list = await db.shopping_lists.find_one({}, {"_id": 0})
    if not shopping_list:
        shopping_list = ShoppingList(items=[]).model_dump()
        shopping_list['created_at'] = shopping_list['created_at'].isoformat() if hasattr(shopping_list['created_at'], 'isoformat') else shopping_list['created_at']
        shopping_list['updated_at'] = shopping_list['updated_at'].isoformat() if hasattr(shopping_list['updated_at'], 'isoformat') else shopping_list['updated_at']
        await db.shopping_lists.insert_one(shopping_list)
    
    shopping_list['items'].append(item.model_dump())
    shopping_list['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.shopping_lists.update_one({}, {"$set": shopping_list})
    
    if isinstance(shopping_list.get('created_at'), str):
        shopping_list['created_at'] = datetime.fromisoformat(shopping_list['created_at'])
    if isinstance(shopping_list.get('updated_at'), str):
        shopping_list['updated_at'] = datetime.fromisoformat(shopping_list['updated_at'])
    
    return shopping_list

@api_router.delete("/shopping-list/item/{item_id}")
async def delete_shopping_item(item_id: str):
    """Delete an item from the shopping list"""
    shopping_list = await db.shopping_lists.find_one({}, {"_id": 0})
    if not shopping_list:
        raise HTTPException(status_code=404, detail="No shopping list found")
    
    shopping_list['items'] = [item for item in shopping_list['items'] if item['id'] != item_id]
    shopping_list['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.shopping_lists.update_one({}, {"$set": shopping_list})
    return {"message": "Item deleted successfully"}

# ---- Weekly Plan Routes ----

@api_router.post("/weekly-plan", response_model=WeeklyPlan)
async def save_weekly_plan(data: WeeklyPlanCreate):
    """Save or update the weekly meal plan"""
    plan = WeeklyPlan(**data.model_dump())
    doc = plan.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    # Upsert based on week_start
    await db.weekly_plans.delete_many({"week_start": data.week_start})
    await db.weekly_plans.insert_one(doc)
    
    return plan

@api_router.get("/weekly-plan", response_model=Optional[WeeklyPlan])
async def get_weekly_plan(week_start: Optional[str] = None):
    """Get the weekly meal plan"""
    query = {"week_start": week_start} if week_start else {}
    plan = await db.weekly_plans.find_one(query, {"_id": 0}, sort=[("created_at", -1)])
    if plan:
        if isinstance(plan.get('created_at'), str):
            plan['created_at'] = datetime.fromisoformat(plan['created_at'])
    return plan

@api_router.get("/weekly-plan/all", response_model=List[WeeklyPlan])
async def get_all_weekly_plans():
    """Get all weekly plans"""
    plans = await db.weekly_plans.find({}, {"_id": 0}).to_list(100)
    for plan in plans:
        if isinstance(plan.get('created_at'), str):
            plan['created_at'] = datetime.fromisoformat(plan['created_at'])
    return plans

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
