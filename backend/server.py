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
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
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

# Recipe categories
RECIPE_CATEGORIES = ["vegan", "vegetarian", "pescatarian", "low-fat", "quick-easy", "comfort-food", "healthy", "family-friendly"]

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
    categories: List[str] = []  # vegan, vegetarian, pescatarian, low-fat, quick-easy
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
    categories: List[str] = []
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
    instructions_text: str = ""
    instructions: List[str] = []

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

def suggest_recipe_categories(ingredients: List[dict], prep_time: str = "", cook_time: str = "") -> List[str]:
    """Suggest recipe categories based on ingredients and cooking time"""
    categories = []
    ingredient_names = [ing.get('name', '').lower() for ing in ingredients]
    all_ingredients = ' '.join(ingredient_names)
    
    # Meat/fish detection
    meat_keywords = ['chicken', 'beef', 'pork', 'lamb', 'bacon', 'sausage', 'ham', 'turkey', 'duck', 'meat', 'steak']
    fish_keywords = ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'seafood', 'crab', 'lobster', 'anchov', 'mackerel', 'trout']
    dairy_keywords = ['milk', 'cheese', 'cream', 'butter', 'yogurt', 'yoghurt']
    egg_keywords = ['egg']
    
    has_meat = any(kw in all_ingredients for kw in meat_keywords)
    has_fish = any(kw in all_ingredients for kw in fish_keywords)
    has_dairy = any(kw in all_ingredients for kw in dairy_keywords)
    has_egg = any(kw in all_ingredients for kw in egg_keywords)
    
    # Vegan: no meat, fish, dairy, eggs
    if not has_meat and not has_fish and not has_dairy and not has_egg:
        categories.append('vegan')
        categories.append('vegetarian')
    # Vegetarian: no meat, no fish
    elif not has_meat and not has_fish:
        categories.append('vegetarian')
    # Pescatarian: has fish but no meat
    elif has_fish and not has_meat:
        categories.append('pescatarian')
    
    # Quick & Easy: based on cooking time
    def parse_time_minutes(time_str: str) -> int:
        if not time_str:
            return 0
        time_str = time_str.lower()
        minutes = 0
        if 'min' in time_str:
            try:
                minutes = int(''.join(filter(str.isdigit, time_str.split('min')[0])))
            except:
                pass
        if 'hour' in time_str or 'hr' in time_str:
            try:
                hours = int(''.join(filter(str.isdigit, time_str.split('hour')[0].split('hr')[0])))
                minutes += hours * 60
            except:
                pass
        return minutes
    
    total_time = parse_time_minutes(prep_time) + parse_time_minutes(cook_time)
    if total_time > 0 and total_time <= 30:
        categories.append('quick-easy')
    
    # Low-fat detection (no cream, no butter, no fried)
    high_fat_keywords = ['cream', 'butter', 'fried', 'oil', 'lard', 'bacon']
    if not any(kw in all_ingredients for kw in high_fat_keywords):
        categories.append('low-fat')
    
    return categories

async def generate_recipe_image(recipe_name: str, ingredients: List[dict]) -> str:
    """Generate an AI image for a recipe"""
    if not EMERGENT_LLM_KEY:
        logger.warning("No EMERGENT_LLM_KEY found for image generation")
        return ""
    
    try:
        # Create a descriptive prompt for the food image
        ingredient_names = [ing.get('name', '') for ing in ingredients[:5]]
        ingredients_text = ", ".join(ingredient_names) if ingredient_names else ""
        
        prompt = f"Professional food photography of {recipe_name}, a delicious home-cooked dish"
        if ingredients_text:
            prompt += f" featuring {ingredients_text}"
        prompt += ". Appetizing, well-plated, natural lighting, top-down or 45-degree angle, clean white plate, rustic wooden table background."
        
        logger.info(f"Generating image for recipe: {recipe_name}")
        
        image_gen = OpenAIImageGeneration(api_key=EMERGENT_LLM_KEY)
        images = await image_gen.generate_images(
            prompt=prompt,
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            # Convert to base64 data URL
            image_base64 = base64.b64encode(images[0]).decode('utf-8')
            image_url = f"data:image/png;base64,{image_base64}"
            logger.info(f"Successfully generated image for {recipe_name}")
            return image_url
        
        return ""
    except Exception as e:
        logger.error(f"Error generating recipe image: {e}", exc_info=True)
        return ""

async def extract_ingredients_from_image(image_base64: str) -> tuple[str, List[Ingredient]]:
    """Use AI vision to extract ingredients from an image"""
    if not EMERGENT_LLM_KEY:
        logger.warning("No EMERGENT_LLM_KEY found")
        return "", []
    
    try:
        # Use GPT-5.1 for vision (recommended vision model)
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
        ).with_model("openai", "gpt-5.1")
        
        # Create image content using ImageContent class for base64 encoded images
        image_content = ImageContent(image_base64=image_base64)
        
        # Create message with image attachment using file_contents
        user_message = UserMessage(
            text="Extract all ingredients from this recipe image. List every ingredient you can see with quantities and units.",
            file_contents=[image_content]
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
        
        # Ensure all required fields exist and handle null values
        ingredients = []
        for ing in ingredients_data:
            # Handle null/None values by converting to empty strings
            name = ing.get("name") or "Unknown"
            quantity = ing.get("quantity")
            unit = ing.get("unit")
            category = ing.get("category") or "other"
            
            # Convert None to empty string for quantity and unit
            quantity_str = str(quantity) if quantity is not None else ""
            unit_str = str(unit) if unit is not None else ""
            
            ingredients.append(Ingredient(
                name=name,
                quantity=quantity_str,
                unit=unit_str,
                category=category
            ))
        
        logger.info(f"Extracted {len(ingredients)} ingredients from image")
        return raw_text, ingredients
    except Exception as e:
        logger.error(f"Error extracting from image: {e}", exc_info=True)
        return "", []

async def extract_instructions_from_image(image_base64: str) -> tuple[str, List[str], str, str]:
    """Use AI vision to extract cooking instructions from an image"""
    if not EMERGENT_LLM_KEY:
        logger.warning("No EMERGENT_LLM_KEY found")
        return "", [], "", ""
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"instructions-parse-{uuid.uuid4()}",
            system_message="""You are a helpful assistant that extracts cooking instructions from images.
            Look carefully at the image and extract ALL cooking steps/instructions.
            Also estimate the prep time and cook time based on the steps.
            
            Return as JSON with format:
            {
                "raw_text": "all the instruction text you can see",
                "instructions": ["Step 1 text", "Step 2 text", "Step 3 text", ...],
                "prep_time": "estimated prep time (e.g., '15 min', '20 min')",
                "cook_time": "estimated cook time (e.g., '30 min', '45 min')"
            }
            
            Each instruction should be a complete step. Remove step numbers from the text.
            Estimate prep_time based on chopping, mixing, preparation steps.
            Estimate cook_time based on baking, cooking, simmering steps.
            Return ONLY valid JSON, no markdown code blocks."""
        ).with_model("openai", "gpt-5.1")
        
        image_content = ImageContent(image_base64=image_base64)
        
        user_message = UserMessage(
            text="Extract all cooking instructions from this recipe image. List every step in order. Also estimate prep time and cook time.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        logger.info(f"Instructions Vision API response: {response[:500] if response else 'Empty'}")
        
        import json
        clean_response = response.strip()
        
        if "```json" in clean_response:
            clean_response = clean_response.split("```json")[1].split("```")[0]
        elif "```" in clean_response:
            parts = clean_response.split("```")
            if len(parts) >= 2:
                clean_response = parts[1]
        
        clean_response = clean_response.strip()
        
        try:
            data = json.loads(clean_response)
        except json.JSONDecodeError:
            start = clean_response.find("{")
            end = clean_response.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(clean_response[start:end])
            else:
                logger.error(f"Could not parse JSON from instructions response: {clean_response}")
                return "", [], "", ""
        
        raw_text = data.get("raw_text", "")
        instructions = data.get("instructions", [])
        prep_time = data.get("prep_time", "")
        cook_time = data.get("cook_time", "")
        
        # Ensure all instructions are strings
        instructions = [str(inst) for inst in instructions if inst]
        
        logger.info(f"Extracted {len(instructions)} instructions from image, prep: {prep_time}, cook: {cook_time}")
        return raw_text, instructions, prep_time, cook_time
    except Exception as e:
        logger.error(f"Error extracting instructions from image: {e}", exc_info=True)
        return "", [], "", ""

async def suggest_meals_from_pantry(pantry_items: List[dict], recipes: List[dict]) -> List[dict]:
    """Use AI to suggest meals based on available pantry ingredients"""
    if not EMERGENT_LLM_KEY or not pantry_items or not recipes:
        return []
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"meal-suggest-{uuid.uuid4()}",
            system_message="""You are a helpful meal planning assistant.
            Given a list of pantry items and available recipes, suggest which recipes can be made.
            Consider partial matches - a recipe is still good if most ingredients are available.
            
            Return as JSON array with format:
            [
                {
                    "recipe_id": "the recipe id",
                    "recipe_name": "recipe name",
                    "match_percentage": 85,
                    "available_ingredients": ["ingredient1", "ingredient2"],
                    "missing_ingredients": ["ingredient3"],
                    "recommendation": "Great choice! Only missing one item."
                }
            ]
            
            Sort by match_percentage descending. Include all recipes with at least 50% match.
            Return ONLY valid JSON, no markdown code blocks."""
        ).with_model("openai", "gpt-5.2")
        
        # Format pantry items
        pantry_text = "\n".join([f"- {item.get('name', '')} ({item.get('quantity', '')} {item.get('unit', '')})" for item in pantry_items])
        
        # Format recipes
        recipes_text = ""
        for r in recipes:
            ing_list = ", ".join([ing.get('name', '') for ing in r.get('ingredients', [])])
            recipes_text += f"\nRecipe ID: {r.get('id')}\nName: {r.get('name')}\nIngredients: {ing_list}\n"
        
        user_message = UserMessage(
            text=f"""My pantry has:
{pantry_text}

Available recipes:
{recipes_text}

Suggest ALL recipes, even if missing several ingredients. Include recipes with at least 20% match.
Clearly list what ingredients are missing for each recipe.
Sort by match percentage (highest first)."""
        )
        
        response = await chat.send_message(user_message)
        
        import json
        clean_response = response.strip()
        
        if "```json" in clean_response:
            clean_response = clean_response.split("```json")[1].split("```")[0]
        elif "```" in clean_response:
            parts = clean_response.split("```")
            if len(parts) >= 2:
                clean_response = parts[1]
        
        clean_response = clean_response.strip()
        
        try:
            suggestions = json.loads(clean_response)
        except json.JSONDecodeError:
            start = clean_response.find("[")
            end = clean_response.rfind("]") + 1
            if start >= 0 and end > start:
                suggestions = json.loads(clean_response[start:end])
            else:
                return []
        
        return suggestions
    except Exception as e:
        logger.error(f"Error suggesting meals: {e}", exc_info=True)
        return []

def normalize_ingredient_name(name: str) -> str:
    """Normalize ingredient name for matching"""
    # Remove common variations and plurals
    name = name.lower().strip()
    # Remove common prefixes/suffixes
    for word in ['fresh ', 'dried ', 'chopped ', 'diced ', 'minced ', 'sliced ', 'whole ', 'ground ']:
        name = name.replace(word, '')
    # Simple plural handling
    if name.endswith('es') and len(name) > 3:
        name = name[:-2]
    elif name.endswith('s') and len(name) > 2:
        name = name[:-1]
    return name.strip()

def parse_quantity(qty_str: str) -> float:
    """Parse quantity string to float"""
    if not qty_str:
        return 1.0
    qty_str = qty_str.strip().lower()
    # Handle fractions
    fractions = {'1/4': 0.25, '1/3': 0.33, '1/2': 0.5, '2/3': 0.67, '3/4': 0.75}
    for frac, val in fractions.items():
        if frac in qty_str:
            qty_str = qty_str.replace(frac, str(val))
    # Handle mixed numbers like "1 1/2"
    try:
        parts = qty_str.split()
        total = 0
        for part in parts:
            if '/' in part:
                num, denom = part.split('/')
                total += float(num) / float(denom)
            else:
                total += float(part)
        return total if total > 0 else 1.0
    except:
        return 1.0

def consolidate_items_locally(items: List[ShoppingListItem]) -> List[ShoppingListItem]:
    """Consolidate shopping list items without AI"""
    # Group by normalized name and unit
    grouped = {}
    for item in items:
        key = (normalize_ingredient_name(item.name), item.unit.lower().strip())
        if key not in grouped:
            grouped[key] = {
                'name': item.name,
                'quantity': 0,
                'unit': item.unit,
                'category': item.category,
                'sources': []
            }
        grouped[key]['quantity'] += parse_quantity(item.quantity)
        if item.recipe_source and item.recipe_source not in grouped[key]['sources']:
            grouped[key]['sources'].append(item.recipe_source)
    
    # Convert back to list
    consolidated = []
    for (norm_name, unit), data in grouped.items():
        # Format quantity nicely
        qty = data['quantity']
        if qty == int(qty):
            qty_str = str(int(qty))
        else:
            qty_str = f"{qty:.1f}".rstrip('0').rstrip('.')
        
        consolidated.append(ShoppingListItem(
            name=data['name'],
            quantity=qty_str,
            unit=data['unit'],
            category=data['category'],
            recipe_source=', '.join(data['sources']) if data['sources'] else None
        ))
    
    # Sort by category
    category_order = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'spices', 'frozen', 'other']
    consolidated.sort(key=lambda x: (category_order.index(x.category) if x.category in category_order else 99, x.name))
    
    return consolidated

async def consolidate_ingredients_with_ai(items: List[ShoppingListItem]) -> List[ShoppingListItem]:
    """Use AI to consolidate similar ingredients, with local fallback"""
    if len(items) < 2:
        return items
    
    # First try local consolidation (faster and more reliable)
    consolidated = consolidate_items_locally(items)
    
    # If we reduced the list significantly, use local results
    if len(consolidated) < len(items) * 0.8:
        logger.info(f"Local consolidation: {len(items)} -> {len(consolidated)} items")
        return consolidated
    
    # Otherwise try AI for smarter consolidation
    if not EMERGENT_LLM_KEY:
        return consolidated
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"consolidate-{uuid.uuid4()}",
            system_message="""You are a helpful assistant that consolidates shopping list items.
            Combine similar ingredients and ADD their quantities together.
            Example: "2 cups flour" + "1 cup flour" = "3 cups flour"
            Example: "1 onion" + "2 onions" = "3 onions"
            
            IMPORTANT: Add quantities together, don't just list them separately!
            Keep items organized by category.
            
            Return ONLY a valid JSON array with these fields for each item:
            - id: string (generate new UUID)
            - name: string (the ingredient name)
            - quantity: string (the TOTAL combined quantity)
            - unit: string
            - category: one of: produce, dairy, protein, grains, pantry, spices, frozen, other
            - checked: false
            - recipe_source: string (list all source recipes) or null
            
            No markdown or explanation, just the JSON array."""
        ).with_model("openai", "gpt-5.2")
        
        items_text = "\n".join([f"- {item.quantity} {item.unit} {item.name} (from: {item.recipe_source or 'manual'})" for item in items])
        
        user_message = UserMessage(
            text=f"Consolidate these shopping list items by combining quantities of the same ingredient:\n\n{items_text}"
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
        ai_consolidated = [ShoppingListItem(**item) for item in consolidated_data]
        logger.info(f"AI consolidation: {len(items)} -> {len(ai_consolidated)} items")
        return ai_consolidated
    except Exception as e:
        logger.error(f"Error consolidating ingredients with AI: {e}")
        return consolidated  # Fall back to local consolidation

async def scrape_recipe_from_url(url: str) -> dict:
    """Scrape recipe data from recipe URLs"""
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
    return {"message": "Fresh Pantry API - Your kitchen companion!"}

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

@api_router.post("/parse-instructions-image")
async def parse_instructions_image(file: UploadFile = File(...)):
    """Extract cooking instructions from an uploaded image using AI vision"""
    contents = await file.read()
    image_base64 = base64.b64encode(contents).decode('utf-8')
    
    raw_text, instructions, prep_time, cook_time = await extract_instructions_from_image(image_base64)
    
    return {
        "instructions_text": raw_text, 
        "instructions": instructions,
        "prep_time": prep_time,
        "cook_time": cook_time
    }

# ---- Meal Suggestions Route ----

@api_router.get("/suggestions/meals")
async def get_meal_suggestions(request: Request):
    """Get meal suggestions based on pantry inventory"""
    user_id = await get_user_id_or_none(request)
    
    # Get pantry items
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry or not pantry.get('items'):
        return {"suggestions": [], "message": "Add items to your pantry first!"}
    
    # Get recipes
    recipe_query = {"user_id": user_id} if user_id else {}
    recipes = await db.recipes.find(recipe_query, {"_id": 0}).to_list(100)
    
    if not recipes:
        return {"suggestions": [], "message": "Add some recipes first!"}
    
    # Get AI suggestions
    suggestions = await suggest_meals_from_pantry(pantry['items'], recipes)
    
    return {"suggestions": suggestions, "message": f"Found {len(suggestions)} recipes you can make!"}

@api_router.get("/recipes/grouped")
async def get_recipes_grouped_by_ingredients(request: Request):
    """Get recipes grouped by shared ingredients"""
    user_id = await get_user_id_or_none(request)
    
    recipe_query = {"user_id": user_id} if user_id else {}
    recipes = await db.recipes.find(recipe_query, {"_id": 0}).to_list(100)
    
    if not recipes:
        return {"groups": [], "message": "Add some recipes first!"}
    
    # Build ingredient -> recipes mapping
    ingredient_to_recipes = {}
    for recipe in recipes:
        for ing in recipe.get('ingredients', []):
            ing_name = normalize_ingredient_name(ing.get('name', ''))
            if ing_name:
                if ing_name not in ingredient_to_recipes:
                    ingredient_to_recipes[ing_name] = []
                ingredient_to_recipes[ing_name].append({
                    'id': recipe['id'],
                    'name': recipe['name']
                })
    
    # Find shared ingredients (appear in 2+ recipes)
    shared_ingredients = {
        ing: recipes_list 
        for ing, recipes_list in ingredient_to_recipes.items() 
        if len(recipes_list) >= 2
    }
    
    # Sort by number of recipes sharing the ingredient
    sorted_shared = sorted(
        shared_ingredients.items(), 
        key=lambda x: len(x[1]), 
        reverse=True
    )[:20]  # Top 20 shared ingredients
    
    # Build recipe groups
    groups = []
    seen_recipe_pairs = set()
    
    for ing_name, recipe_list in sorted_shared:
        recipe_ids = tuple(sorted([r['id'] for r in recipe_list]))
        if recipe_ids not in seen_recipe_pairs:
            seen_recipe_pairs.add(recipe_ids)
            groups.append({
                'shared_ingredient': ing_name.title(),
                'recipes': recipe_list,
                'count': len(recipe_list)
            })
    
    return {
        "groups": groups[:10],  # Top 10 groups
        "total_recipes": len(recipes),
        "message": f"Found {len(groups)} ingredient groups across {len(recipes)} recipes"
    }

# ---- Recipe Routes ----

@api_router.post("/recipes", response_model=Recipe)
async def create_recipe(recipe_data: RecipeCreate, request: Request):
    """Create a new recipe with AI-generated image and auto-suggested categories"""
    user_id = await get_user_id_or_none(request)
    
    # Generate AI image if no image provided
    image_url = recipe_data.image_url
    ingredients_dict = [ing.model_dump() if hasattr(ing, 'model_dump') else ing for ing in recipe_data.ingredients]
    
    if not image_url and recipe_data.ingredients:
        image_url = await generate_recipe_image(recipe_data.name, ingredients_dict)
    
    # Auto-suggest categories if none provided
    categories = recipe_data.categories
    if not categories and recipe_data.ingredients:
        categories = suggest_recipe_categories(
            ingredients_dict, 
            recipe_data.prep_time or "", 
            recipe_data.cook_time or ""
        )
    
    recipe_dict = recipe_data.model_dump()
    recipe_dict['image_url'] = image_url
    recipe_dict['categories'] = categories
    
    recipe = Recipe(**recipe_dict, user_id=user_id)
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

class UpdateCategoriesRequest(BaseModel):
    categories: List[str]

@api_router.put("/recipes/{recipe_id}/categories")
async def update_recipe_categories(recipe_id: str, request_data: UpdateCategoriesRequest):
    """Update recipe categories"""
    recipe = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Validate categories
    valid_categories = [cat for cat in request_data.categories if cat in RECIPE_CATEGORIES]
    
    await db.recipes.update_one(
        {"id": recipe_id},
        {"$set": {"categories": valid_categories}}
    )
    
    return {"categories": valid_categories, "message": "Categories updated!"}

@api_router.post("/recipes/{recipe_id}/generate-image")
async def generate_image_for_recipe(recipe_id: str):
    """Generate an AI image for an existing recipe"""
    recipe = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Generate image
    ingredients = recipe.get('ingredients', [])
    image_url = await generate_recipe_image(recipe['name'], ingredients)
    
    if not image_url:
        raise HTTPException(status_code=500, detail="Failed to generate image")
    
    # Update recipe with new image
    await db.recipes.update_one(
        {"id": recipe_id},
        {"$set": {"image_url": image_url}}
    )
    
    return {"image_url": image_url, "message": "Image generated successfully!"}

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
    """Generate a smart shopping list from selected recipes, subtracting pantry inventory"""
    user_id = await get_user_id_or_none(request)
    items = []
    
    # Collect all ingredients from recipes
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
    
    # Consolidate duplicate ingredients
    if items:
        items = await consolidate_ingredients_with_ai(items)
    
    # Get pantry inventory to subtract from shopping list
    pantry_query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(pantry_query, {"_id": 0})
    pantry_items = pantry.get('items', []) if pantry else []
    
    # Build a lookup of pantry items by normalized name
    pantry_lookup = {}
    for pi in pantry_items:
        norm_name = normalize_ingredient_name(pi.get('name', ''))
        if norm_name:
            pantry_lookup[norm_name] = {
                'quantity': pi.get('quantity', 0),
                'unit': pi.get('unit', '')
            }
    
    # Smart subtraction: reduce needed quantities based on pantry stock
    smart_items = []
    for item in items:
        norm_name = normalize_ingredient_name(item.name)
        pantry_match = pantry_lookup.get(norm_name)
        
        if pantry_match and pantry_match['quantity'] > 0:
            needed_qty = parse_quantity(item.quantity)
            pantry_qty = pantry_match['quantity']
            
            # Calculate how much more we need to buy
            remaining_need = needed_qty - pantry_qty
            
            if remaining_need > 0:
                # Still need to buy some
                if remaining_need == int(remaining_need):
                    qty_str = str(int(remaining_need))
                else:
                    qty_str = f"{remaining_need:.1f}".rstrip('0').rstrip('.')
                
                smart_items.append(ShoppingListItem(
                    name=item.name,
                    quantity=qty_str,
                    unit=item.unit,
                    category=item.category,
                    recipe_source=f"{item.recipe_source} (have {pantry_qty} {pantry_match['unit']})" if item.recipe_source else f"Have {pantry_qty} in pantry"
                ))
            # else: we have enough in pantry, skip this item
        else:
            # Not in pantry, add full amount
            smart_items.append(item)
    
    shopping_list = ShoppingList(items=smart_items, user_id=user_id)
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
        new_pantry = Pantry(user_id=user_id).model_dump()
        new_pantry['created_at'] = new_pantry['created_at'].isoformat()
        new_pantry['updated_at'] = new_pantry['updated_at'].isoformat()
        await db.pantry.insert_one(new_pantry)
        # Re-fetch without _id
        pantry = await db.pantry.find_one(query, {"_id": 0})
    
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
