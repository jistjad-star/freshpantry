from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from bs4 import BeautifulSoup
from emergentintegrations.llm.chat import LlmChat, UserMessage
import base64
import re

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

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    user_id: Optional[str] = None
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
    user_id: Optional[str] = None
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
    user_id: Optional[str] = None
    week_start: str
    days: List[WeeklyPlanDay] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WeeklyPlanCreate(BaseModel):
    week_start: str
    days: List[WeeklyPlanDay]

# ============== PANTRY/INVENTORY MODELS ==============

class PantryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    quantity: float
    unit: str
    category: str = "other"
    min_threshold: float = 0  # Alert when below this
    typical_purchase: float = 0  # Suggested buy amount
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expiry_date: Optional[str] = None

class Pantry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    items: List[PantryItem] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PantryItemCreate(BaseModel):
    name: str
    quantity: float
    unit: str
    category: str = "other"
    min_threshold: float = 0
    typical_purchase: float = 0
    expiry_date: Optional[str] = None

class PantryItemUpdate(BaseModel):
    quantity: Optional[float] = None
    min_threshold: Optional[float] = None
    typical_purchase: Optional[float] = None
    expiry_date: Optional[str] = None

class CookRecipeRequest(BaseModel):
    recipe_id: str
    servings_multiplier: float = 1.0

class ParseIngredientsRequest(BaseModel):
    recipe_name: str
    ingredients_text: str
    instructions_text: Optional[str] = ""

class ParseIngredientsResponse(BaseModel):
    ingredients: List[Ingredient]
    instructions: List[str]

class ImageParseResponse(BaseModel):
    ingredients_text: str
    ingredients: List[Ingredient]

# ============== AUTH HELPER FUNCTIONS ==============

async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token (cookie or header)"""
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        return None
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    # Check expiry
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        return None
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

async def get_user_id_or_none(request: Request) -> Optional[str]:
    """Get user_id if logged in, otherwise None (for backward compatibility)"""
    user = await get_current_user(request)
    return user.user_id if user else None

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

async def extract_ingredients_from_image(image_base64: str) -> tuple[str, List[Ingredient]]:
    """Use AI vision to extract ingredients from an image"""
    if not EMERGENT_LLM_KEY:
        logger.warning("No EMERGENT_LLM_KEY found")
        return "", []
    
    try:
        # Use GPT-4o for vision (gpt-5.2 may not support vision)
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"image-parse-{uuid.uuid4()}",
            system_message="""You are a helpful assistant that extracts recipe ingredients from images.
            Look carefully at the image and extract ALL text related to ingredients.
            Parse each ingredient into structured format.
            
            Return as JSON with format:
            {
                "raw_text": "all the ingredient text you can see",
                "ingredients": [
                    {"name": "ingredient name", "quantity": "amount", "unit": "unit", "category": "category"}
                ]
            }
            
            Categories: produce, dairy, protein, grains, pantry, spices, frozen, other
            
            Return ONLY valid JSON, no markdown code blocks."""
        ).with_model("openai", "gpt-4o")
        
        # Create message with image using proper format
        user_message = UserMessage(
            text="Extract all ingredients from this recipe image. List every ingredient you can see with quantities and units.",
            image_url=f"data:image/png;base64,{image_base64}"
        )
        
        response = await chat.send_message(user_message)
        logger.info(f"Vision API response: {response[:500] if response else 'Empty'}")
        
        # Parse response
        import json
        clean_response = response.strip()
        
        # Remove markdown code blocks if present
        if "```json" in clean_response:
            clean_response = clean_response.split("```json")[1].split("```")[0]
        elif "```" in clean_response:
            parts = clean_response.split("```")
            if len(parts) >= 2:
                clean_response = parts[1]
        
        clean_response = clean_response.strip()
        
        # Try to parse JSON
        try:
            data = json.loads(clean_response)
        except json.JSONDecodeError:
            # Try to find JSON object in response
            start = clean_response.find("{")
            end = clean_response.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(clean_response[start:end])
            else:
                logger.error(f"Could not parse JSON from response: {clean_response}")
                return "", []
        
        raw_text = data.get("raw_text", "")
        ingredients_data = data.get("ingredients", [])
        
        # Ensure all required fields exist
        ingredients = []
        for ing in ingredients_data:
            ingredients.append(Ingredient(
                name=ing.get("name", "Unknown"),
                quantity=str(ing.get("quantity", "")),
                unit=ing.get("unit", ""),
                category=ing.get("category", "other")
            ))
        
        logger.info(f"Extracted {len(ingredients)} ingredients from image")
        return raw_text, ingredients
    except Exception as e:
        logger.error(f"Error extracting from image: {e}", exc_info=True)
        return "", []

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
            
            recipe_data = {
                'name': '',
                'description': '',
                'ingredients_text': '',
                'instructions_text': '',
                'image_url': None,
                'source_url': url
            }
            
            title_selectors = ['h1', '.recipe-title', '[data-test-id="recipe-name"]', '.recipe-name']
            for selector in title_selectors:
                title_elem = soup.select_one(selector)
                if title_elem:
                    recipe_data['name'] = title_elem.get_text(strip=True)
                    break
            
            desc_selectors = ['.recipe-description', '[data-test-id="recipe-description"]', 'meta[name="description"]']
            for selector in desc_selectors:
                desc_elem = soup.select_one(selector)
                if desc_elem:
                    if desc_elem.name == 'meta':
                        recipe_data['description'] = desc_elem.get('content', '')
                    else:
                        recipe_data['description'] = desc_elem.get_text(strip=True)
                    break
            
            ing_selectors = ['.ingredients', '[data-test-id="ingredients"]', '.recipe-ingredients', '.ingredient-list']
            for selector in ing_selectors:
                ing_elem = soup.select_one(selector)
                if ing_elem:
                    recipe_data['ingredients_text'] = ing_elem.get_text('\n', strip=True)
                    break
            
            if not recipe_data['ingredients_text']:
                ing_items = soup.select('li[class*="ingredient"], .ingredient-item')
                if ing_items:
                    recipe_data['ingredients_text'] = '\n'.join([item.get_text(strip=True) for item in ing_items])
            
            inst_selectors = ['.instructions', '[data-test-id="instructions"]', '.recipe-instructions', '.directions']
            for selector in inst_selectors:
                inst_elem = soup.select_one(selector)
                if inst_elem:
                    recipe_data['instructions_text'] = inst_elem.get_text('\n', strip=True)
                    break
            
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

# ============== AUTH ROUTES ==============

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent auth to get user data
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        auth_data = auth_response.json()
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    email = auth_data.get("email")
    name = auth_data.get("name")
    picture = auth_data.get("picture")
    session_token = auth_data.get("session_token")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        # Create new user
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    # Store session
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    
    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user from session"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ============== API ROUTES ==============

@api_router.get("/")
async def root():
    return {"message": "The Emerald Pantry API - Wicked good shopping lists!"}

# ---- Parse Ingredients Routes ----

@api_router.post("/parse-ingredients", response_model=ParseIngredientsResponse)
async def parse_ingredients(data: ParseIngredientsRequest):
    """Parse pasted ingredient text using AI"""
    ingredients = []
    instructions = []
    
    if data.ingredients_text.strip():
        ingredients = await parse_ingredients_with_ai(data.ingredients_text, data.recipe_name or "Recipe")
    
    if data.instructions_text and data.instructions_text.strip():
        raw_instructions = data.instructions_text.strip()
        steps = re.split(r'\n+|\d+\.\s*', raw_instructions)
        instructions = [step.strip() for step in steps if step.strip()]
    
    return ParseIngredientsResponse(ingredients=ingredients, instructions=instructions)

@api_router.post("/parse-image", response_model=ImageParseResponse)
async def parse_image(file: UploadFile = File(...)):
    """Extract ingredients from an uploaded image using AI vision"""
    # Read and encode image
    contents = await file.read()
    image_base64 = base64.b64encode(contents).decode('utf-8')
    
    # Extract ingredients
    raw_text, ingredients = await extract_ingredients_from_image(image_base64)
    
    return ImageParseResponse(ingredients_text=raw_text, ingredients=ingredients)

# ---- Recipe Routes ----

@api_router.post("/recipes", response_model=Recipe)
async def create_recipe(recipe_data: RecipeCreate, request: Request):
    """Create a new recipe"""
    user_id = await get_user_id_or_none(request)
    
    recipe = Recipe(**recipe_data.model_dump(), user_id=user_id)
    doc = recipe.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.recipes.insert_one(doc)
    return recipe

@api_router.post("/recipes/import", response_model=Recipe)
async def import_recipe(import_data: RecipeImport, request: Request):
    """Import a recipe from URL"""
    user_id = await get_user_id_or_none(request)
    scraped = await scrape_recipe_from_url(import_data.url)
    
    if not scraped['name']:
        scraped['name'] = "Imported Recipe"
    
    ingredients = []
    if scraped['ingredients_text']:
        ingredients = await parse_ingredients_with_ai(scraped['ingredients_text'], scraped['name'])
    
    instructions = []
    if scraped['instructions_text']:
        instructions = [step.strip() for step in scraped['instructions_text'].split('\n') if step.strip()]
    
    recipe = Recipe(
        name=scraped['name'],
        description=scraped['description'],
        ingredients=ingredients,
        instructions=instructions,
        source_url=scraped['source_url'],
        image_url=scraped['image_url'],
        user_id=user_id
    )
    
    doc = recipe.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.recipes.insert_one(doc)
    return recipe

@api_router.get("/recipes", response_model=List[Recipe])
async def get_recipes(request: Request):
    """Get all recipes (for logged in user or all if not logged in)"""
    user_id = await get_user_id_or_none(request)
    
    # If user is logged in, show their recipes. Otherwise show all (backward compat)
    query = {"user_id": user_id} if user_id else {}
    recipes = await db.recipes.find(query, {"_id": 0}).to_list(1000)
    
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
async def delete_recipe(recipe_id: str, request: Request):
    """Delete a recipe"""
    user_id = await get_user_id_or_none(request)
    
    # If logged in, only delete user's recipes
    query = {"id": recipe_id}
    if user_id:
        query["user_id"] = user_id
    
    result = await db.recipes.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"message": "Recipe deleted successfully"}

# ---- Shopping List Routes ----

@api_router.post("/shopping-list/generate", response_model=ShoppingList)
async def generate_shopping_list(data: ShoppingListGenerate, request: Request):
    """Generate a shopping list from selected recipes"""
    user_id = await get_user_id_or_none(request)
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
    
    if items:
        items = await consolidate_ingredients_with_ai(items)
    
    shopping_list = ShoppingList(items=items, user_id=user_id)
    doc = shopping_list.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    # Delete old list for this user
    delete_query = {"user_id": user_id} if user_id else {"user_id": None}
    await db.shopping_lists.delete_many(delete_query)
    await db.shopping_lists.insert_one(doc)
    
    return shopping_list

@api_router.get("/shopping-list", response_model=Optional[ShoppingList])
async def get_shopping_list(request: Request):
    """Get the current shopping list"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    shopping_list = await db.shopping_lists.find_one(query, {"_id": 0})
    
    if shopping_list:
        if isinstance(shopping_list.get('created_at'), str):
            shopping_list['created_at'] = datetime.fromisoformat(shopping_list['created_at'])
        if isinstance(shopping_list.get('updated_at'), str):
            shopping_list['updated_at'] = datetime.fromisoformat(shopping_list['updated_at'])
    return shopping_list

@api_router.put("/shopping-list", response_model=ShoppingList)
async def update_shopping_list(data: ShoppingListUpdate, request: Request):
    """Update the shopping list"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    shopping_list = await db.shopping_lists.find_one(query, {"_id": 0})
    
    if not shopping_list:
        raise HTTPException(status_code=404, detail="No shopping list found")
    
    shopping_list['items'] = [item.model_dump() for item in data.items]
    shopping_list['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.shopping_lists.update_one(query, {"$set": shopping_list})
    
    if isinstance(shopping_list.get('created_at'), str):
        shopping_list['created_at'] = datetime.fromisoformat(shopping_list['created_at'])
    if isinstance(shopping_list.get('updated_at'), str):
        shopping_list['updated_at'] = datetime.fromisoformat(shopping_list['updated_at'])
    
    return shopping_list

@api_router.post("/shopping-list/add-item", response_model=ShoppingList)
async def add_custom_item(item: ShoppingListItem, request: Request):
    """Add a custom item to the shopping list"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    shopping_list = await db.shopping_lists.find_one(query, {"_id": 0})
    
    if not shopping_list:
        shopping_list = ShoppingList(items=[], user_id=user_id).model_dump()
        shopping_list['created_at'] = shopping_list['created_at'].isoformat() if hasattr(shopping_list['created_at'], 'isoformat') else shopping_list['created_at']
        shopping_list['updated_at'] = shopping_list['updated_at'].isoformat() if hasattr(shopping_list['updated_at'], 'isoformat') else shopping_list['updated_at']
        await db.shopping_lists.insert_one(shopping_list)
    
    shopping_list['items'].append(item.model_dump())
    shopping_list['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.shopping_lists.update_one(query, {"$set": shopping_list})
    
    if isinstance(shopping_list.get('created_at'), str):
        shopping_list['created_at'] = datetime.fromisoformat(shopping_list['created_at'])
    if isinstance(shopping_list.get('updated_at'), str):
        shopping_list['updated_at'] = datetime.fromisoformat(shopping_list['updated_at'])
    
    return shopping_list

@api_router.delete("/shopping-list/item/{item_id}")
async def delete_shopping_item(item_id: str, request: Request):
    """Delete an item from the shopping list"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    shopping_list = await db.shopping_lists.find_one(query, {"_id": 0})
    
    if not shopping_list:
        raise HTTPException(status_code=404, detail="No shopping list found")
    
    shopping_list['items'] = [item for item in shopping_list['items'] if item['id'] != item_id]
    shopping_list['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.shopping_lists.update_one(query, {"$set": shopping_list})
    return {"message": "Item deleted successfully"}

# ---- Weekly Plan Routes ----

@api_router.post("/weekly-plan", response_model=WeeklyPlan)
async def save_weekly_plan(data: WeeklyPlanCreate, request: Request):
    """Save or update the weekly meal plan"""
    user_id = await get_user_id_or_none(request)
    
    plan = WeeklyPlan(**data.model_dump(), user_id=user_id)
    doc = plan.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    # Delete old plan for this week/user
    delete_query = {"week_start": data.week_start}
    if user_id:
        delete_query["user_id"] = user_id
    await db.weekly_plans.delete_many(delete_query)
    await db.weekly_plans.insert_one(doc)
    
    return plan

@api_router.get("/weekly-plan", response_model=Optional[WeeklyPlan])
async def get_weekly_plan(request: Request, week_start: Optional[str] = None):
    """Get the weekly meal plan"""
    user_id = await get_user_id_or_none(request)
    
    query = {}
    if week_start:
        query["week_start"] = week_start
    if user_id:
        query["user_id"] = user_id
    
    plan = await db.weekly_plans.find_one(query, {"_id": 0}, sort=[("created_at", -1)])
    if plan:
        if isinstance(plan.get('created_at'), str):
            plan['created_at'] = datetime.fromisoformat(plan['created_at'])
    return plan

@api_router.get("/weekly-plan/all", response_model=List[WeeklyPlan])
async def get_all_weekly_plans(request: Request):
    """Get all weekly plans"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {}
    plans = await db.weekly_plans.find(query, {"_id": 0}).to_list(100)
    
    for plan in plans:
        if isinstance(plan.get('created_at'), str):
            plan['created_at'] = datetime.fromisoformat(plan['created_at'])
    return plans

# ---- Pantry/Inventory Routes ----

@api_router.get("/pantry")
async def get_pantry(request: Request):
    """Get the user's pantry inventory"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry:
        # Create empty pantry
        pantry = Pantry(user_id=user_id).model_dump()
        pantry['created_at'] = pantry['created_at'].isoformat()
        pantry['updated_at'] = pantry['updated_at'].isoformat()
        await db.pantry.insert_one(pantry)
    
    # Convert dates
    if isinstance(pantry.get('created_at'), str):
        pantry['created_at'] = datetime.fromisoformat(pantry['created_at'])
    if isinstance(pantry.get('updated_at'), str):
        pantry['updated_at'] = datetime.fromisoformat(pantry['updated_at'])
    for item in pantry.get('items', []):
        if isinstance(item.get('last_updated'), str):
            item['last_updated'] = datetime.fromisoformat(item['last_updated'])
    
    return pantry

@api_router.post("/pantry/items")
async def add_pantry_item(item_data: PantryItemCreate, request: Request):
    """Add a new item to the pantry"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry:
        pantry = Pantry(user_id=user_id).model_dump()
        pantry['created_at'] = pantry['created_at'].isoformat()
        pantry['updated_at'] = pantry['updated_at'].isoformat()
    
    # Check if item already exists (by name and unit)
    existing_idx = None
    for i, existing in enumerate(pantry.get('items', [])):
        if existing['name'].lower() == item_data.name.lower() and existing['unit'] == item_data.unit:
            existing_idx = i
            break
    
    new_item = PantryItem(**item_data.model_dump()).model_dump()
    new_item['last_updated'] = new_item['last_updated'].isoformat()
    
    if existing_idx is not None:
        # Update existing item quantity
        pantry['items'][existing_idx]['quantity'] += item_data.quantity
        pantry['items'][existing_idx]['last_updated'] = datetime.now(timezone.utc).isoformat()
        if item_data.min_threshold:
            pantry['items'][existing_idx]['min_threshold'] = item_data.min_threshold
        if item_data.typical_purchase:
            pantry['items'][existing_idx]['typical_purchase'] = item_data.typical_purchase
    else:
        pantry['items'].append(new_item)
    
    pantry['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.pantry.update_one(query, {"$set": pantry}, upsert=True)
    
    return {"message": "Item added to pantry", "item": new_item}

@api_router.put("/pantry/items/{item_id}")
async def update_pantry_item(item_id: str, update_data: PantryItemUpdate, request: Request):
    """Update a pantry item"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry:
        raise HTTPException(status_code=404, detail="Pantry not found")
    
    # Find and update the item
    item_found = False
    for item in pantry['items']:
        if item['id'] == item_id:
            if update_data.quantity is not None:
                item['quantity'] = update_data.quantity
            if update_data.min_threshold is not None:
                item['min_threshold'] = update_data.min_threshold
            if update_data.typical_purchase is not None:
                item['typical_purchase'] = update_data.typical_purchase
            if update_data.expiry_date is not None:
                item['expiry_date'] = update_data.expiry_date
            item['last_updated'] = datetime.now(timezone.utc).isoformat()
            item_found = True
            break
    
    if not item_found:
        raise HTTPException(status_code=404, detail="Item not found in pantry")
    
    pantry['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.pantry.update_one(query, {"$set": pantry})
    
    return {"message": "Item updated"}

@api_router.delete("/pantry/items/{item_id}")
async def delete_pantry_item(item_id: str, request: Request):
    """Remove an item from the pantry"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry:
        raise HTTPException(status_code=404, detail="Pantry not found")
    
    pantry['items'] = [item for item in pantry['items'] if item['id'] != item_id]
    pantry['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.pantry.update_one(query, {"$set": pantry})
    return {"message": "Item removed from pantry"}

@api_router.post("/pantry/cook")
async def cook_recipe(data: CookRecipeRequest, request: Request):
    """Deduct ingredients from pantry when cooking a recipe"""
    user_id = await get_user_id_or_none(request)
    
    # Get the recipe
    recipe = await db.recipes.find_one({"id": data.recipe_id}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Get the pantry
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry:
        pantry = Pantry(user_id=user_id).model_dump()
        pantry['created_at'] = pantry['created_at'].isoformat()
        pantry['updated_at'] = pantry['updated_at'].isoformat()
    
    # Deduct ingredients
    deducted = []
    missing = []
    
    for recipe_ing in recipe.get('ingredients', []):
        found = False
        for pantry_item in pantry['items']:
            # Match by name (case-insensitive, partial match)
            if recipe_ing['name'].lower() in pantry_item['name'].lower() or pantry_item['name'].lower() in recipe_ing['name'].lower():
                # Try to parse quantity
                try:
                    recipe_qty = float(recipe_ing['quantity']) * data.servings_multiplier
                except (ValueError, TypeError):
                    recipe_qty = 1 * data.servings_multiplier
                
                pantry_item['quantity'] = max(0, pantry_item['quantity'] - recipe_qty)
                pantry_item['last_updated'] = datetime.now(timezone.utc).isoformat()
                deducted.append({
                    "name": pantry_item['name'],
                    "deducted": recipe_qty,
                    "remaining": pantry_item['quantity']
                })
                found = True
                break
        
        if not found:
            missing.append(recipe_ing['name'])
    
    pantry['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.pantry.update_one(query, {"$set": pantry}, upsert=True)
    
    return {
        "message": f"Cooked {recipe['name']}",
        "deducted": deducted,
        "missing_ingredients": missing
    }

@api_router.get("/pantry/low-stock")
async def get_low_stock_items(request: Request):
    """Get items that are below their minimum threshold"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry:
        return {"low_stock_items": [], "suggested_shopping": []}
    
    low_stock = []
    suggested_shopping = []
    
    for item in pantry.get('items', []):
        if item['quantity'] <= item.get('min_threshold', 0):
            low_stock.append(item)
            suggested_shopping.append({
                "name": item['name'],
                "current": item['quantity'],
                "unit": item['unit'],
                "suggested_buy": item.get('typical_purchase', 1) or 1,
                "category": item.get('category', 'other')
            })
    
    return {
        "low_stock_items": low_stock,
        "suggested_shopping": suggested_shopping
    }

@api_router.post("/pantry/add-from-shopping")
async def add_from_shopping_list(request: Request):
    """Add checked shopping list items to pantry"""
    user_id = await get_user_id_or_none(request)
    
    # Get shopping list
    query = {"user_id": user_id} if user_id else {"user_id": None}
    shopping_list = await db.shopping_lists.find_one(query, {"_id": 0})
    
    if not shopping_list:
        return {"message": "No shopping list found", "added": 0}
    
    # Get or create pantry
    pantry = await db.pantry.find_one(query, {"_id": 0})
    if not pantry:
        pantry = Pantry(user_id=user_id).model_dump()
        pantry['created_at'] = pantry['created_at'].isoformat()
        pantry['updated_at'] = pantry['updated_at'].isoformat()
    
    added_count = 0
    
    # Add checked items to pantry
    for item in shopping_list.get('items', []):
        if item.get('checked', False):
            # Try to parse quantity
            try:
                qty = float(item['quantity'])
            except (ValueError, TypeError):
                qty = 1
            
            # Check if item exists in pantry
            existing_idx = None
            for i, pantry_item in enumerate(pantry['items']):
                if pantry_item['name'].lower() == item['name'].lower():
                    existing_idx = i
                    break
            
            if existing_idx is not None:
                pantry['items'][existing_idx]['quantity'] += qty
                pantry['items'][existing_idx]['last_updated'] = datetime.now(timezone.utc).isoformat()
            else:
                new_item = PantryItem(
                    name=item['name'],
                    quantity=qty,
                    unit=item.get('unit', ''),
                    category=item.get('category', 'other'),
                    typical_purchase=qty
                ).model_dump()
                new_item['last_updated'] = new_item['last_updated'].isoformat()
                pantry['items'].append(new_item)
            
            added_count += 1
    
    pantry['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.pantry.update_one(query, {"$set": pantry}, upsert=True)
    
    return {"message": f"Added {added_count} items to pantry", "added": added_count}

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
