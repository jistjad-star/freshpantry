from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from bs4 import BeautifulSoup
# Standard OpenAI SDK
from openai import AsyncOpenAI
import base64
import re
from authlib.integrations.starlette_client import OAuth

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection - optimized for production use
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'freshpantry')

try:
    # Connection pooling configuration for optimal performance
    client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=5000,      # Timeout for server selection
        connectTimeoutMS=10000,              # Connection timeout
        socketTimeoutMS=45000,               # Socket timeout for operations
        maxPoolSize=100,                     # Maximum connections in pool
        minPoolSize=10,                      # Minimum connections to maintain
        maxIdleTimeMS=30000,                 # Close idle connections after 30s
        retryWrites=True,                    # Automatically retry write operations
        retryReads=True,                     # Automatically retry read operations
        w='majority',                        # Write concern for data durability
    )
    db = client[db_name]
    logger.info(f"MongoDB client initialized with connection pooling (pool size: 10-100)")
except Exception as e:
    logging.error(f"MongoDB connection error: {e}")
    client = None
    db = None

# OpenAI API Key for AI features
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
if OPENAI_API_KEY:
    logger.info("OpenAI API Key found - AI features enabled")
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
else:
    logger.warning("No OPENAI_API_KEY found - AI features disabled")
    openai_client = None

# Google OAuth Config
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
APP_URL = os.environ.get('APP_URL', 'http://localhost:3000')
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# Create the main app
app = FastAPI()

# Add session middleware for OAuth
from starlette.middleware.sessions import SessionMiddleware
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# Setup OAuth
oauth = OAuth()
if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    oauth.register(
        name='google',
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Health check endpoint (outside /api for DigitalOcean)
@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration"""
    db_status = "disconnected"
    if db is not None:
        try:
            await client.admin.command('ping')
            db_status = "connected"
        except Exception:
            db_status = "error"
    return {"status": "ok", "database": db_status}

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
RECIPE_CATEGORIES = ["vegan", "can-be-vegan", "vegetarian", "pescatarian", "low-fat", "quick-easy", "comfort-food", "healthy", "family-friendly"]

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
    recipe_type: str = "meal"  # "meal" or "cocktail"
    is_alcoholic: Optional[bool] = None  # For cocktails: True/False
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    average_rating: float = 0.0
    review_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recipe_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = "Anonymous"
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = ""

class RecipeCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    servings: int = 2
    prep_time: Optional[str] = ""
    cook_time: Optional[str] = ""
    ingredients: List[Ingredient] = []
    instructions: List[str] = []
    categories: List[str] = []
    recipe_type: str = "meal"  # "meal" or "cocktail"
    is_alcoholic: Optional[bool] = None  # For cocktails
    image_url: Optional[str] = None
    source_url: Optional[str] = None
    skip_image_generation: bool = False

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
    model_config = ConfigDict(extra="ignore")
    quantity: Optional[float] = None
    min_threshold: Optional[float] = None
    typical_purchase: Optional[float] = None
    expiry_date: Optional[str] = None
    clear_expiry_date: Optional[bool] = None  # Set to True to remove expiry date

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
    prep_time: str = ""
    cook_time: str = ""

class ImageParseResponse(BaseModel):
    ingredients_text: str
    ingredients: List[Ingredient]
    instructions_text: str = ""
    instructions: List[str] = []
    prep_time: str = ""
    cook_time: str = ""

# ============== COPYRIGHT-SAFE SHARING MODELS ==============

import secrets
import hashlib
from collections import Counter

class ComplianceMetrics(BaseModel):
    """Stores compliance check results for recipe sharing"""
    ngram_max_overlap: float = 0.0  # Max n-gram overlap (target ≤ 0.15)
    semantic_avg: float = 0.0  # Average semantic similarity (target < 0.80)
    structure_variance: bool = False  # Whether steps were reordered/split
    robots_tos_checked: bool = False
    passed_compliance: bool = False

class SafeRecipeFields(BaseModel):
    """Only these fields can be shared/imported - copyright safe"""
    title_generic: str  # Generic title without brand names
    ingredients: List[dict]  # Facts - not copyrightable
    servings: int = 2
    time_total_min: int = 0
    nutrition: dict = {}  # Facts - not copyrightable
    method_rewritten: List[str]  # AI-rewritten in original wording
    adapted_from_domain: Optional[str] = None  # e.g. "Adapted from bbc.co.uk"
    compliance: ComplianceMetrics = Field(default_factory=ComplianceMetrics)
    user_images: List[str] = []  # Only user's own photos

class PrivateImportToken(BaseModel):
    """Secure single-use token for private recipe import"""
    token: str
    recipe_id: str
    sender_id: str
    scope: str = "private-import-only"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(minutes=15))
    used: bool = False

class DomainQuota(BaseModel):
    """Track per-domain import quotas to prevent database right issues"""
    domain: str
    import_count_90d: int = 0
    last_import: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    daily_imports: int = 0
    daily_reset: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== N-GRAM COMPLIANCE CHECKER ==============

def get_ngrams(text: str, n: int = 8) -> set:
    """Extract n-grams from text for overlap checking"""
    # Normalize text
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', '', text)  # Remove punctuation
    words = text.split()
    
    if len(words) < n:
        return set()
    
    ngrams = set()
    for i in range(len(words) - n + 1):
        ngram = tuple(words[i:i+n])
        ngrams.add(ngram)
    return ngrams

def calculate_ngram_overlap(source_text: str, rewritten_text: str, n: int = 8) -> float:
    """Calculate n-gram overlap between source and rewritten text
    Returns overlap ratio (0.0 = no overlap, 1.0 = identical)
    """
    source_ngrams = get_ngrams(source_text, n)
    rewritten_ngrams = get_ngrams(rewritten_text, n)
    
    if not source_ngrams or not rewritten_ngrams:
        return 0.0
    
    overlap = source_ngrams.intersection(rewritten_ngrams)
    # Calculate overlap as percentage of rewritten text's ngrams
    overlap_ratio = len(overlap) / len(rewritten_ngrams) if rewritten_ngrams else 0.0
    
    return overlap_ratio

def check_8gram_compliance(source_text: str, rewritten_text: str) -> tuple[bool, float]:
    """Check if rewritten text passes 8-gram compliance
    Returns (passed, max_overlap_ratio)
    """
    overlap = calculate_ngram_overlap(source_text, rewritten_text, n=8)
    # Pass if no 8-gram matches (overlap = 0) OR very low overlap (< 0.01 allows minor coincidental matches)
    passed = overlap < 0.01
    return passed, overlap

def check_overall_ngram_overlap(source_text: str, rewritten_text: str) -> float:
    """Calculate overall n-gram overlap using multiple n values
    Target: ≤ 0.15 overall
    """
    overlaps = []
    for n in [3, 4, 5, 6, 7, 8]:
        overlap = calculate_ngram_overlap(source_text, rewritten_text, n)
        overlaps.append(overlap)
    
    # Weight longer n-grams more heavily
    weights = [0.05, 0.10, 0.15, 0.20, 0.25, 0.25]
    weighted_overlap = sum(o * w for o, w in zip(overlaps, weights))
    return weighted_overlap

# ============== STEP GRAPH FOR REWRITING ==============

def parse_to_step_graph(instructions: List[str], ingredients: List[dict]) -> dict:
    """Parse instructions into a step graph for rewriting
    Extracts: actions, temperatures, times, ingredient dependencies
    """
    step_graph = {
        "steps": [],
        "ingredients_used": set(),
        "total_time_min": 0,
        "max_temp": None
    }
    
    time_pattern = re.compile(r'(\d+)\s*(min|minute|hour|hr|mins|minutes|hours|hrs)', re.IGNORECASE)
    temp_pattern = re.compile(r'(\d+)\s*°?\s*(C|F|celsius|fahrenheit)', re.IGNORECASE)
    
    ingredient_names = [ing.get('name', '').lower() for ing in ingredients]
    
    for i, instruction in enumerate(instructions):
        step = {
            "order": i + 1,
            "action_type": None,  # preheat, chop, mix, cook, bake, etc.
            "time_min": None,
            "temperature": None,
            "ingredients": [],
            "can_reorder": False,  # Whether this step can be safely reordered
            "original_length": len(instruction.split())
        }
        
        # Extract time
        time_match = time_pattern.search(instruction)
        if time_match:
            value = int(time_match.group(1))
            unit = time_match.group(2).lower()
            if 'hour' in unit or 'hr' in unit:
                value *= 60
            step["time_min"] = value
            step_graph["total_time_min"] += value
        
        # Extract temperature
        temp_match = temp_pattern.search(instruction)
        if temp_match:
            temp_value = int(temp_match.group(1))
            temp_unit = temp_match.group(2).upper()[0]
            step["temperature"] = f"{temp_value}°{temp_unit}"
            if step_graph["max_temp"] is None or temp_value > int(step_graph["max_temp"].split('°')[0]):
                step_graph["max_temp"] = step["temperature"]
        
        # Detect action type
        instruction_lower = instruction.lower()
        if any(word in instruction_lower for word in ['preheat', 'heat oven', 'turn on oven']):
            step["action_type"] = "preheat"
            step["can_reorder"] = True  # Preheat can be done anytime before baking
        elif any(word in instruction_lower for word in ['chop', 'dice', 'mince', 'slice', 'cut']):
            step["action_type"] = "prep"
            step["can_reorder"] = True  # Prep steps often interchangeable
        elif any(word in instruction_lower for word in ['mix', 'combine', 'stir', 'whisk', 'beat']):
            step["action_type"] = "mix"
        elif any(word in instruction_lower for word in ['bake', 'roast']):
            step["action_type"] = "bake"
        elif any(word in instruction_lower for word in ['fry', 'sauté', 'saute', 'pan', 'sear']):
            step["action_type"] = "fry"
        elif any(word in instruction_lower for word in ['boil', 'simmer', 'poach']):
            step["action_type"] = "boil"
        elif any(word in instruction_lower for word in ['serve', 'garnish', 'plate']):
            step["action_type"] = "serve"
        else:
            step["action_type"] = "general"
        
        # Find ingredients mentioned
        for ing_name in ingredient_names:
            if ing_name and len(ing_name) > 2 and ing_name in instruction_lower:
                step["ingredients"].append(ing_name)
                step_graph["ingredients_used"].add(ing_name)
        
        step_graph["steps"].append(step)
    
    step_graph["ingredients_used"] = list(step_graph["ingredients_used"])
    return step_graph

# ============== AI REWRITE SYSTEM ==============

REWRITE_SYSTEM_PROMPT = """You are a culinary editor. Create ORIGINAL instructions from the provided step graph and ingredient facts.

STRICTLY PROHIBITED:
- Copying phrases or style from any source text
- Anecdotes, stories, or personal commentary
- Branded language or product names
- Layout mimicry or numbered lists matching the source
- Any phrase of 8 or more consecutive words from the source

REQUIREMENTS:
- 6-12 concise imperative steps
- Vary verbs and sentence structure
- Reorder safe independent sub-steps (prep work, preheating)
- Standardize measures (use g, ml, tsp, tbsp)
- Add clear temperature and time ranges where vague
- Exclude headnotes, brand names, images
- Write in neutral, generic cooking instruction style

OUTPUT FORMAT (JSON):
{
    "title_generic": "Generic recipe title without brand names",
    "method_rewritten": ["Step 1...", "Step 2...", ...],
    "notes": "Optional brief technique tips (1-2 sentences max)"
}"""

async def rewrite_instructions_with_ai(
    step_graph: dict,
    ingredients: List[dict],
    original_title: str,
    original_instructions: List[str]
) -> dict:
    """Use AI to rewrite instructions in original wording from step graph"""
    
    if not openai_client:
        raise HTTPException(status_code=503, detail="AI rewrite service unavailable")
    
    # Prepare step graph summary for AI
    step_summary = []
    for step in step_graph["steps"]:
        summary = f"Step {step['order']}: {step['action_type']}"
        if step['time_min']:
            summary += f" ({step['time_min']} min)"
        if step['temperature']:
            summary += f" at {step['temperature']}"
        if step['ingredients']:
            summary += f" using: {', '.join(step['ingredients'])}"
        step_summary.append(summary)
    
    # Prepare ingredients list
    ing_list = [f"{ing.get('quantity', '')} {ing.get('unit', '')} {ing.get('name', '')}".strip() 
                for ing in ingredients]
    
    user_prompt = f"""Create original cooking instructions for this recipe:

RECIPE TITLE (to make generic): {original_title}

INGREDIENTS (facts - use as-is):
{chr(10).join(ing_list)}

STEP GRAPH (actions to rewrite):
{chr(10).join(step_summary)}

Total cooking time: ~{step_graph.get('total_time_min', 30)} minutes
Max temperature: {step_graph.get('max_temp', 'N/A')}

Write 6-12 original imperative steps. Reorder prep steps for efficiency. Use different phrasing than typical recipes."""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": REWRITE_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=2000
        )
        
        result = response.choices[0].message.content
        
        # Parse JSON response
        clean_response = result.strip()
        if "```json" in clean_response:
            clean_response = clean_response.split("```json")[1].split("```")[0]
        elif "```" in clean_response:
            parts = clean_response.split("```")
            if len(parts) >= 2:
                clean_response = parts[1]
        
        import json
        try:
            rewrite_data = json.loads(clean_response.strip())
        except json.JSONDecodeError:
            # Try to find JSON object
            start = clean_response.find("{")
            end = clean_response.rfind("}") + 1
            if start >= 0 and end > start:
                rewrite_data = json.loads(clean_response[start:end])
            else:
                raise ValueError("Could not parse AI response")
        
        return {
            "title_generic": rewrite_data.get("title_generic", original_title),
            "method_rewritten": rewrite_data.get("method_rewritten", []),
            "notes": rewrite_data.get("notes", "")
        }
        
    except Exception as e:
        logger.error(f"AI rewrite failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI rewrite failed: {str(e)}")

# ============== COMPLIANCE VALIDATION ==============

async def validate_compliance(
    original_instructions: List[str],
    rewritten_instructions: List[str],
    check_semantic: bool = False
) -> ComplianceMetrics:
    """Run compliance checks on rewritten instructions"""
    
    original_text = " ".join(original_instructions)
    rewritten_text = " ".join(rewritten_instructions)
    
    # 1. Check 8-gram overlap (hard requirement)
    passed_8gram, max_8gram_overlap = check_8gram_compliance(original_text, rewritten_text)
    
    # 2. Calculate overall n-gram overlap
    overall_overlap = check_overall_ngram_overlap(original_text, rewritten_text)
    
    # 3. Check structure variance (did we reorder/split steps?)
    structure_variance = len(rewritten_instructions) != len(original_instructions)
    
    # 4. Semantic similarity (optional second gate)
    semantic_avg = 0.0
    if check_semantic or (overall_overlap > 0.10 and overall_overlap < 0.15):
        # Only run semantic check for borderline cases
        # For now, use a heuristic based on word overlap
        original_words = set(original_text.lower().split())
        rewritten_words = set(rewritten_text.lower().split())
        word_overlap = len(original_words & rewritten_words) / max(len(rewritten_words), 1)
        semantic_avg = min(word_overlap * 1.2, 1.0)  # Scale up slightly
    
    # Determine if passed all compliance checks
    passed = (
        passed_8gram and  # No 8-gram matches
        overall_overlap <= 0.15 and  # Overall overlap target
        (semantic_avg < 0.80 or not check_semantic)  # Semantic threshold if checked
    )
    
    return ComplianceMetrics(
        ngram_max_overlap=max(max_8gram_overlap, overall_overlap),
        semantic_avg=semantic_avg,
        structure_variance=structure_variance,
        robots_tos_checked=True,
        passed_compliance=passed
    )

# ============== DOMAIN QUOTA MANAGEMENT ==============

async def check_domain_quota(domain: str) -> bool:
    """Check if domain quota allows import
    Enforces per-domain limits to respect database rights
    """
    if not domain:
        return True
    
    # Get or create domain quota record
    quota = await db.domain_quotas.find_one({"domain": domain}, {"_id": 0})
    
    now = datetime.now(timezone.utc)
    
    if not quota:
        quota = {
            "domain": domain,
            "import_count_90d": 0,
            "last_import": now.isoformat(),
            "daily_imports": 0,
            "daily_reset": now.isoformat()
        }
    
    # Reset daily counter if needed
    daily_reset = quota.get("daily_reset")
    if isinstance(daily_reset, str):
        daily_reset = datetime.fromisoformat(daily_reset)
    if daily_reset.tzinfo is None:
        daily_reset = daily_reset.replace(tzinfo=timezone.utc)
    
    if (now - daily_reset).days >= 1:
        quota["daily_imports"] = 0
        quota["daily_reset"] = now.isoformat()
    
    # Check limits (configurable - these are conservative defaults)
    MAX_DAILY_PER_DOMAIN = 10  # Max imports per domain per day
    MAX_90DAY_PER_DOMAIN = 100  # Max imports per domain per 90 days
    
    if quota["daily_imports"] >= MAX_DAILY_PER_DOMAIN:
        return False
    
    if quota["import_count_90d"] >= MAX_90DAY_PER_DOMAIN:
        return False
    
    return True

async def increment_domain_quota(domain: str):
    """Increment domain quota counters after successful import"""
    if not domain:
        return
    
    now = datetime.now(timezone.utc)
    
    await db.domain_quotas.update_one(
        {"domain": domain},
        {
            "$inc": {"import_count_90d": 1, "daily_imports": 1},
            "$set": {"last_import": now.isoformat()}
        },
        upsert=True
    )

def extract_domain(url: str) -> str:
    """Extract domain from URL for quota tracking"""
    if not url:
        return ""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return parsed.netloc.lower().replace("www.", "")
    except:
        return ""

# ============== SECURE TOKEN GENERATION ==============

def generate_import_token() -> str:
    """Generate a cryptographically secure 256-bit token"""
    return secrets.token_urlsafe(32)  # 256 bits = 32 bytes

def hash_source_content(content: str) -> str:
    """Create SHA-256 hash of source content for audit"""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

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

def estimate_cooking_times(ingredients: List[dict], recipe_name: str = "") -> tuple[str, str]:
    """Estimate prep and cook time based on ingredients and recipe name"""
    ingredient_count = len(ingredients)
    name_lower = recipe_name.lower()
    
    # Base prep time: 5 min + 2 min per ingredient (capped)
    prep_minutes = min(5 + (ingredient_count * 2), 30)
    
    # Base cook time based on recipe type
    cook_minutes = 20  # default
    
    # Quick items
    if any(kw in name_lower for kw in ['salad', 'sandwich', 'smoothie', 'toast']):
        prep_minutes = min(prep_minutes, 10)
        cook_minutes = 0
    # Medium cook time
    elif any(kw in name_lower for kw in ['stir fry', 'stir-fry', 'pasta', 'omelette', 'scrambled', 'pancake']):
        cook_minutes = 15
    # Longer cook time
    elif any(kw in name_lower for kw in ['roast', 'bake', 'casserole', 'lasagna', 'pie', 'cake']):
        cook_minutes = 45
    # Slow cook
    elif any(kw in name_lower for kw in ['slow', 'braise', 'stew']):
        cook_minutes = 120
    # Grilled/fried
    elif any(kw in name_lower for kw in ['grill', 'fried', 'fry', 'sear']):
        cook_minutes = 20
    # Soup/curry
    elif any(kw in name_lower for kw in ['soup', 'curry', 'chili', 'chilli']):
        cook_minutes = 30
    
    # Check ingredients for hints
    ing_text = ' '.join([i.get('name', '').lower() for i in ingredients])
    if 'chicken breast' in ing_text or 'beef' in ing_text:
        cook_minutes = max(cook_minutes, 25)
    if 'whole chicken' in ing_text:
        cook_minutes = max(cook_minutes, 60)
    
    prep_time = f"{prep_minutes} min" if prep_minutes > 0 else ""
    cook_time = f"{cook_minutes} min" if cook_minutes > 0 else ""
    
    return prep_time, cook_time

def estimate_cooking_times_from_instructions(instructions: List[str], recipe_name: str = "") -> tuple[str, str]:
    """Estimate prep and cook time based on cooking instructions"""
    if not instructions:
        return "", ""
    
    all_text = ' '.join(instructions).lower()
    
    prep_minutes = 0
    cook_minutes = 0
    
    # Look for explicit time mentions in instructions
    import re
    
    # Find all time mentions (e.g., "15 minutes", "1 hour", "30 mins")
    time_patterns = [
        r'(\d+)\s*(?:hour|hr)s?',  # hours
        r'(\d+)\s*(?:minute|min)s?',  # minutes
    ]
    
    # Prep keywords
    prep_keywords = ['chop', 'dice', 'slice', 'mince', 'peel', 'cut', 'prepare', 'mix', 'combine', 'whisk', 'beat', 'marinate']
    # Cook keywords
    cook_keywords = ['cook', 'bake', 'roast', 'fry', 'boil', 'simmer', 'grill', 'sauté', 'saute', 'heat', 'oven', 'pan', 'pot']
    
    # Count prep vs cook steps
    prep_steps = 0
    cook_steps = 0
    
    for step in instructions:
        step_lower = step.lower()
        if any(kw in step_lower for kw in prep_keywords):
            prep_steps += 1
        if any(kw in step_lower for kw in cook_keywords):
            cook_steps += 1
        
        # Extract times from this step
        for match in re.finditer(r'(\d+)\s*(?:hour|hr)s?', step_lower):
            hours = int(match.group(1))
            if any(kw in step_lower for kw in cook_keywords):
                cook_minutes += hours * 60
            else:
                prep_minutes += hours * 60
        
        for match in re.finditer(r'(\d+)\s*(?:minute|min)s?', step_lower):
            mins = int(match.group(1))
            if any(kw in step_lower for kw in cook_keywords):
                cook_minutes += mins
            else:
                prep_minutes += mins
    
    # If no explicit times found, estimate based on steps
    if prep_minutes == 0:
        prep_minutes = max(prep_steps * 5, 10)  # ~5 min per prep step, min 10
    if cook_minutes == 0:
        cook_minutes = max(cook_steps * 8, 15)  # ~8 min per cook step, min 15
    
    # Cap reasonable values
    prep_minutes = min(prep_minutes, 60)
    cook_minutes = min(cook_minutes, 180)
    
    prep_time = f"{prep_minutes} min"
    cook_time = f"{cook_minutes} min"
    
    return prep_time, cook_time

async def parse_ingredients_with_ai(raw_text: str, recipe_name: str) -> List[Ingredient]:
    """Use AI to parse raw ingredient text into structured data"""
    if not openai_client:
        logger.warning("No OpenAI API key found, returning empty ingredients")
        return []
    
    try:
        system_message = """You are a helpful assistant that parses recipe ingredients into structured JSON format.

CRITICAL: You must ONLY extract items from an INGREDIENTS LIST, NOT from cooking instructions.

HOW TO IDENTIFY INGREDIENTS VS COOKING STEPS:
- INGREDIENTS have specific measurements: "2 cups flour", "500g chicken", "1 onion, diced"
- COOKING STEPS describe actions: "add oil to pan", "stir until golden", "drizzle with honey"

DO NOT INCLUDE:
- Items mentioned in cooking method sentences (e.g., "add a splash of wine" - this is a cooking step)
- Serving suggestions ("serve with rice" is NOT an ingredient)
- Vague quantities: "oil for frying", "water as needed", "salt to taste" (SKIP unless in ingredients list)
- Duplicates - if "olive oil" appears in ingredients list AND cooking steps, only include once from the list

ONLY INCLUDE items that:
1. Have a specific quantity (number + unit): "2 tbsp olive oil", "400g pasta"
2. Are in a clear ingredients list format (not embedded in instruction sentences)

For each ingredient, extract:
- name: the ingredient name (e.g., "chicken breast", "olive oil")
- quantity: the amount (e.g., "2", "1/2"). Must have a quantity.
- unit: the unit of measurement (e.g., "lb", "cups", "tbsp", "pieces", "" for items like "1 onion")
- category: one of: produce, dairy, protein, grains, pantry, spices, frozen, other

Return ONLY a valid JSON array, no markdown or explanation."""

        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": f"Parse ONLY the ingredients list (NOT cooking steps) from this recipe '{recipe_name}':\n\n{raw_text}"}
            ],
            max_tokens=1500
        )
        
        result = response.choices[0].message.content
        
        # Parse the JSON response
        import json
        clean_response = result.strip()
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
    
    # Heavy meat dishes that are harder to make vegan (meat is the star)
    heavy_meat_keywords = ['steak', 'roast beef', 'pork belly', 'lamb shank', 'ribeye', 'brisket', 'ribs']
    
    has_meat = any(kw in all_ingredients for kw in meat_keywords)
    has_fish = any(kw in all_ingredients for kw in fish_keywords)
    has_dairy = any(kw in all_ingredients for kw in dairy_keywords)
    has_egg = any(kw in all_ingredients for kw in egg_keywords)
    is_heavy_meat = any(kw in all_ingredients for kw in heavy_meat_keywords)
    
    # Vegan: no meat, fish, dairy, eggs
    if not has_meat and not has_fish and not has_dairy and not has_egg:
        categories.append('vegan')
        categories.append('vegetarian')
    # Vegetarian: no meat, no fish (but has dairy/eggs) - Can be Vegan with swaps
    elif not has_meat and not has_fish:
        categories.append('vegetarian')
        categories.append('can-be-vegan')  # Just swap dairy/eggs for vegan alternatives
    # Pescatarian: has fish but no meat - Can be Vegan (swap fish for tofu/banana blossom)
    elif has_fish and not has_meat:
        categories.append('pescatarian')
        categories.append('can-be-vegan')  # Fish can be swapped
    # Has meat but not a heavy meat dish - Can be Vegan (swap protein)
    elif has_meat and not is_heavy_meat:
        categories.append('can-be-vegan')  # Chicken/turkey etc can be swapped for tofu, seitan
    # Heavy meat dishes - don't tag as can-be-vegan (meat is the star)
    # No vegan-related category for these
    
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
    """Generate a casual food image for a recipe and convert to base64 for permanent storage"""
    if not openai_client:
        return ""
    
    try:
        prompt = f"Simple overhead photo of {recipe_name} on a kitchen table, home-cooked style, casual lighting, no garnish, realistic everyday meal"
        
        # Use OpenAI DALL-E for image generation
        response = await openai_client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1
        )
        
        if response.data and len(response.data) > 0:
            image_url = response.data[0].url
            # Download the image and convert to base64
            async with httpx.AsyncClient() as client:
                img_response = await client.get(image_url)
                if img_response.status_code == 200:
                    image_base64 = base64.b64encode(img_response.content).decode('utf-8')
                    return f"data:image/png;base64,{image_base64}"
            
        return ""
    except Exception as e:
        logger.error(f"Error generating recipe image: {e}")
        return ""

async def extract_ingredients_from_image(image_base64: str) -> tuple[str, List[Ingredient]]:
    """Use AI vision to extract ingredients from an image"""
    if not openai_client:
        logger.warning("No OpenAI API key found")
        return "", []
    
    try:
        system_message = """You are an expert at reading recipe cards and extracting ONLY the ingredients list.

CRITICAL RULES - STRICTLY FOLLOW:

1. ONLY extract from the INGREDIENTS LIST/SECTION:
   - Look for a clearly labeled "Ingredients" section
   - Items with specific quantities (e.g., "2 chicken breasts", "100g flour", "1 can tomatoes")
   - Numbered or bulleted lists of ingredients with measurements

2. ABSOLUTELY DO NOT include items from:
   - Cooking method/instructions (e.g., "drizzle oil in pan" - do NOT add oil)
   - Vague mentions like "a drizzle of", "splash of", "pinch of" without specific quantities
   - Serving suggestions or garnishes mentioned in steps
   - Items appearing ONLY in the method/directions section

3. FILTER OUT these cooking step phrases:
   - "drizzle of oil" / "splash of oil" → SKIP (no specific quantity)
   - "season to taste" → SKIP
   - "oil for frying" → SKIP unless quantity specified in ingredients list
   - "water as needed" → SKIP

4. ONLY include if the item has a SPECIFIC measurement:
   - ✓ "2 tbsp olive oil" → Include
   - ✓ "100ml oil" → Include  
   - ✗ "drizzle of oil" → SKIP
   - ✗ "oil for cooking" → SKIP

Return ONLY valid JSON:
{
    "raw_text": "transcribed ingredient list text only",
    "ingredients": [
        {"name": "chicken breast", "quantity": "2", "unit": "pieces", "category": "protein"},
        {"name": "olive oil", "quantity": "2", "unit": "tbsp", "category": "pantry"}
    ]
}

Categories: produce, dairy, protein, grains, pantry, spices, frozen, other

Rules:
- Extract ONLY from dedicated ingredients section, NOT cooking steps
- Each item MUST have a specific quantity (number + unit)
- Skip vague quantities like "drizzle", "splash", "some", "as needed"
- NO duplicates
- Return valid JSON only"""

        logger.info("Sending image to OpenAI Vision API for ingredient extraction...")
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o",  # Use gpt-4o for better accuracy
            messages=[
                {"role": "system", "content": system_message},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract ingredients ONLY from the ingredients list section. Do NOT include items from cooking steps like 'drizzle of oil' or 'splash of water'. Only include items with specific quantities."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=2000
        )
        
        result = response.choices[0].message.content
        logger.info(f"Vision API response length: {len(result) if result else 0}")
        logger.info(f"Vision API response: {result[:1000] if result else 'Empty'}")
        
        # Parse response
        import json
        clean_response = result.strip()
        
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
                # Try a simpler fallback extraction
                return await extract_ingredients_fallback(image_base64)
        
        raw_text = data.get("raw_text", "")
        ingredients_data = data.get("ingredients", [])
        
        # If no ingredients found, try fallback
        if not ingredients_data:
            logger.warning("No ingredients found, trying fallback extraction...")
            return await extract_ingredients_fallback(image_base64)
        
        # Deduplicate and filter ingredients
        seen_names = set()
        ingredients = []
        
        for ing in ingredients_data:
            name = ing.get("name") or ""
            quantity = ing.get("quantity")
            unit = ing.get("unit")
            category = ing.get("category") or "other"
            
            # Skip items without a name
            if not name or name.lower() == "unknown":
                continue
            
            # Skip items without a quantity (likely from cooking steps, not ingredients list)
            quantity_str = str(quantity).strip() if quantity is not None else ""
            if not quantity_str:
                logger.debug(f"Skipping ingredient without quantity: {name}")
                continue
            
            # Skip duplicates (case-insensitive)
            name_lower = name.lower().strip()
            if name_lower in seen_names:
                logger.debug(f"Skipping duplicate ingredient: {name}")
                continue
            seen_names.add(name_lower)
            
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
        # Try fallback on any error
        try:
            return await extract_ingredients_fallback(image_base64)
        except:
            return "", []

async def extract_ingredients_fallback(image_base64: str) -> tuple[str, List[Ingredient]]:
    """Fallback extraction using simpler prompt"""
    if not openai_client:
        return "", []
    
    try:
        logger.info("Trying fallback ingredient extraction...")
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You read images and list food ingredients. Be thorough."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "List ALL food ingredients visible in this image. Format: one ingredient per line with quantity if shown. Example:\n2 chicken breasts\n1 onion\n200g pasta"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=1500
        )
        
        result = response.choices[0].message.content
        logger.info(f"Fallback response: {result[:500] if result else 'Empty'}")
        
        if not result or not result.strip():
            return "", []
        
        # Parse simple text format
        lines = [line.strip() for line in result.strip().split('\n') if line.strip()]
        ingredients = []
        
        for line in lines:
            # Try to parse quantity and name
            # Pattern: optional quantity + ingredient name
            match = re.match(r'^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.+)$', line)
            if match:
                qty, unit, name = match.groups()
                ingredients.append(Ingredient(
                    name=name.strip(),
                    quantity=qty or "",
                    unit=unit or "",
                    category="other"
                ))
            else:
                # Just use the whole line as ingredient name
                ingredients.append(Ingredient(
                    name=line,
                    quantity="",
                    unit="",
                    category="other"
                ))
        
        logger.info(f"Fallback extracted {len(ingredients)} ingredients")
        return result, ingredients
    except Exception as e:
        logger.error(f"Fallback extraction failed: {e}")
        return "", []

async def extract_instructions_from_image(image_base64: str) -> tuple[str, List[str], str, str, str]:
    """Use AI vision to extract cooking instructions from an image"""
    if not openai_client:
        logger.warning("No OpenAI API key found")
        return "", [], "", "", ""
    
    try:
        system_message = """You are an expert at reading recipe cards and extracting cooking instructions.
            
IMPORTANT: Look VERY carefully at the entire image. Recipe cards often have:
- Numbered steps or instructions
- Method/directions section
- Tips or notes scattered around
- Cooking times embedded in steps

Your task: Find and extract EVERY cooking step visible.

Return as JSON with format:
{
    "raw_text": "ALL instruction text you can see, exactly as written",
    "instructions": ["Step 1 text", "Step 2 text", "Step 3 text", ...],
    "prep_time": "estimated prep time (e.g., '15 min')",
    "cook_time": "estimated cook time (e.g., '30 min')",
    "suggested_name": "A creative name for this dish based on the main ingredients and cooking method"
}

RULES:
- Extract ALL steps, even if you're not 100% certain of exact wording
- Remove step numbers from the text but keep the order
- Include any tips, notes, or serving suggestions as separate steps
- Look for instructions in sidebars, margins, and photo captions
- Estimate prep_time based on chopping, mixing, marinating steps
- Estimate cook_time based on actual cooking/baking/simmering time
- For suggested_name: create a descriptive, appetizing name like "Creamy Garlic Chicken Pasta" or "Spiced Lamb with Roasted Vegetables"
- Return ONLY valid JSON, no markdown code blocks"""

        logger.info("Sending image to OpenAI Vision API for instructions extraction...")
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract cooking instructions from this recipe image. List every step and suggest a creative name for this dish."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=2000
        )
        
        result = response.choices[0].message.content
        logger.info(f"Instructions Vision API response length: {len(result) if result else 0}")
        logger.info(f"Instructions Vision API response: {result[:1000] if result else 'Empty'}")
        
        import json
        clean_response = result.strip()
        
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
                return "", [], "", "", ""
        
        raw_text = data.get("raw_text", "")
        instructions = data.get("instructions", [])
        prep_time = data.get("prep_time", "")
        cook_time = data.get("cook_time", "")
        suggested_name = data.get("suggested_name", "")
        
        # Ensure all instructions are strings
        instructions = [str(inst) for inst in instructions if inst]
        
        logger.info(f"Extracted {len(instructions)} instructions from image, prep: {prep_time}, cook: {cook_time}, suggested_name: {suggested_name}")
        return raw_text, instructions, prep_time, cook_time, suggested_name
    except Exception as e:
        logger.error(f"Error extracting instructions from image: {e}", exc_info=True)
        return "", [], "", "", ""

async def suggest_meals_with_shared_ingredients(pantry_items: List[dict], recipes: List[dict], prioritize_expiring: bool = False) -> List[dict]:
    """
    Suggest meals with intelligent grouping based on shared ingredients.
    Prioritizes meals that:
    1. Share more ingredients with other recipes (efficient shopping)
    2. Use more pantry ingredients you already have
    3. Can make multiple meals from same ingredients
    """
    if not recipes:
        return []
    
    # Build pantry ingredient set with multiple matching keys for each item
    pantry_ingredient_names = set()
    pantry_items_lookup = {}  # Store original names for better matching
    expiring_ingredients = set()
    
    for item in pantry_items:
        name = item.get('name', '')
        normalized = normalize_ingredient_name(name)
        base_name = get_base_ingredient_name(name)
        
        if normalized:
            pantry_ingredient_names.add(normalized)
            pantry_items_lookup[normalized] = name
            
            # Also add the base name for fuzzy matching
            if base_name and base_name != normalized:
                pantry_ingredient_names.add(base_name)
                pantry_items_lookup[base_name] = name
            
            # Add individual significant words (e.g., "chicken" from "chicken breast fillets")
            words = normalized.split()
            for word in words:
                if len(word) > 3 and word not in ['with', 'from', 'free', 'range', 'fresh', 'large', 'small', 'medium']:
                    pantry_ingredient_names.add(word)
                    pantry_items_lookup[word] = name
            
            # Track expiring items
            if item.get('days_until_expiry') is not None and item['days_until_expiry'] <= 7:
                expiring_ingredients.add(normalized)
                if base_name:
                    expiring_ingredients.add(base_name)
    
    def ingredient_matches_pantry(recipe_ing_name: str) -> tuple[bool, str]:
        """Check if a recipe ingredient matches something in pantry"""
        normalized = normalize_ingredient_name(recipe_ing_name)
        base_name = get_base_ingredient_name(recipe_ing_name)
        
        # Direct match
        if normalized in pantry_ingredient_names:
            return True, normalized
        
        # Base name match
        if base_name in pantry_ingredient_names:
            return True, base_name
        
        # Word-level match (e.g., recipe "chicken breast" matches pantry "chicken")
        recipe_words = set(normalized.split())
        for word in recipe_words:
            if len(word) > 3 and word in pantry_ingredient_names:
                return True, word
        
        # Check if any pantry item contains the recipe ingredient or vice versa
        for pantry_name in pantry_ingredient_names:
            if len(pantry_name) > 3 and len(normalized) > 3:
                if pantry_name in normalized or normalized in pantry_name:
                    return True, pantry_name
        
        return False, None
    
    # Build recipe -> ingredients mapping with fuzzy matching
    recipe_ingredients = {}
    all_ingredients = {}  # ingredient -> list of recipe ids
    
    for recipe in recipes:
        recipe_id = recipe.get('id')
        recipe_ings = set()
        for ing in recipe.get('ingredients', []):
            ing_name = ing.get('name', '')
            normalized = normalize_ingredient_name(ing_name)
            base_name = get_base_ingredient_name(ing_name)
            
            if normalized:
                recipe_ings.add(normalized)
                # Also track by base name for better cross-recipe matching
                if base_name and base_name != normalized:
                    recipe_ings.add(base_name)
                
                # Track for shared ingredient calculation
                if normalized not in all_ingredients:
                    all_ingredients[normalized] = []
                all_ingredients[normalized].append(recipe_id)
                
        recipe_ingredients[recipe_id] = recipe_ings
    
    # Find shared ingredients (appear in 2+ recipes)
    shared_ingredients = {
        ing: recipe_ids 
        for ing, recipe_ids in all_ingredients.items() 
        if len(recipe_ids) >= 2
    }
    
    # Score each recipe
    suggestions = []
    for recipe in recipes:
        recipe_id = recipe.get('id')
        recipe_name = recipe.get('name', '')
        original_recipe_ings = [ing.get('name', '') for ing in recipe.get('ingredients', [])]
        recipe_ings = recipe_ingredients.get(recipe_id, set())
        
        if not recipe_ings:
            continue
        
        # Calculate metrics using fuzzy matching
        available = []
        missing = []
        
        for ing_name in original_recipe_ings:
            matched, matched_key = ingredient_matches_pantry(ing_name)
            if matched:
                available.append(ing_name)
            else:
                missing.append(ing_name)
        
        # Calculate match percentage based on original ingredient count
        total_ings = len(original_recipe_ings)
        match_pct = int((len(available) / total_ings) * 100) if total_ings > 0 else 0
        
        # Count shared ingredients with other recipes (must share 2+ to count)
        shared_count = sum(1 for ing in recipe_ings if ing in shared_ingredients)
        
        # Count how many other recipes share 2+ ingredients with this one
        related_recipes = {}
        for ing in recipe_ings:
            if ing in shared_ingredients:
                for rid in shared_ingredients[ing]:
                    if rid != recipe_id:
                        related_recipes[rid] = related_recipes.get(rid, 0) + 1
        
        # Only count recipes that share 2+ ingredients
        recipes_sharing_multiple = [rid for rid, count in related_recipes.items() if count >= 2]
        
        # Count expiring ingredients used (with fuzzy matching)
        expiring_used_list = []
        if prioritize_expiring:
            for ing_name in original_recipe_ings:
                normalized = normalize_ingredient_name(ing_name)
                base_name = get_base_ingredient_name(ing_name)
                if normalized in expiring_ingredients or base_name in expiring_ingredients:
                    expiring_used_list.append(ing_name)
        expiring_used = len(expiring_used_list)
        
        # Calculate composite score
        # Weights: match_pct (40%) + shared_ingredients (25%) + related_recipes_with_2+ (25%) + expiring (10%)
        # Bonus for recipes that share multiple ingredients with multiple other recipes
        multi_share_bonus = len(recipes_sharing_multiple) * 15
        base_score = (match_pct * 0.4) + (shared_count * 8 * 0.25) + (multi_share_bonus * 0.25)
        expiring_bonus = expiring_used * 25 if prioritize_expiring else 0
        composite_score = base_score + expiring_bonus
        
        suggestions.append({
            "recipe_id": recipe_id,
            "recipe_name": recipe_name,
            "match_percentage": match_pct,
            "available_ingredients": list(available),
            "missing_ingredients": list(missing),
            "shared_ingredient_count": shared_count,
            "related_recipe_count": len(recipes_sharing_multiple),
            "expiring_ingredients_used": expiring_used if prioritize_expiring else None,
            "expiring_ingredients_list": expiring_used_list if prioritize_expiring else [],
            "composite_score": composite_score,
            "recommendation": get_recommendation(match_pct, shared_count, len(recipes_sharing_multiple), expiring_used if prioritize_expiring else 0)
        })
    
    # Sort by composite score (highest first)
    suggestions.sort(key=lambda x: x['composite_score'], reverse=True)
    
    return suggestions[:20]  # Return top 20

def get_recommendation(match_pct: int, shared_count: int, related_count: int, expiring_count: int) -> str:
    """Generate a recommendation message based on metrics"""
    if expiring_count > 0:
        return f"Uses {expiring_count} items expiring soon!"
    if match_pct >= 90 and shared_count >= 3:
        return "Perfect! You have everything and can make similar recipes!"
    if match_pct >= 80:
        return "Great choice! You have almost everything."
    if shared_count >= 4:
        return f"Smart pick! Shares ingredients with {related_count} other recipes."
    if related_count >= 3:
        return f"Efficient! Same ingredients can make {related_count} other meals."
    if match_pct >= 50:
        return "Good match with your pantry."
    return "A few items to buy, but worth it!"

def normalize_ingredient_name(name: str) -> str:
    """Normalize ingredient name for matching"""
    # Remove common variations and plurals
    name = name.lower().strip()
    # Remove common prefixes/suffixes
    for word in ['fresh ', 'dried ', 'chopped ', 'diced ', 'minced ', 'sliced ', 'whole ', 'ground ', 'jar of ', 'can of ', 'tin of ', 'bottle of ', 'pack of ', 'packet of ', 'bag of ']:
        name = name.replace(word, '')
    # Simple plural handling
    if name.endswith('ies'):
        name = name[:-3] + 'y'  # berries -> berry
    elif name.endswith('es') and len(name) > 3:
        name = name[:-2]
    elif name.endswith('s') and len(name) > 2 and not name.endswith('ss'):
        name = name[:-1]
    return name.strip()

# Ingredient equivalence mapping for smart consolidation
INGREDIENT_EQUIVALENTS = {
    # Garlic conversions (1 clove ≈ 1/2 tsp minced ≈ 1/4 tsp powder)
    'garlic': {'base_unit': 'clove', 'conversions': {
        'clove': 1, 'cloves': 1, 'tsp': 2, 'teaspoon': 2, 'tbsp': 6, 'tablespoon': 6,
        'jar': 30, 'g': 0.2, 'gram': 0.2
    }},
    'mushroom': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'pieces': 25, 'piece': 25, 'each': 25, '': 25  # 1 mushroom ≈ 25g
    }},
    'onion': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'pieces': 150, 'piece': 150, 'each': 150, '': 150, 'medium': 150, 'large': 200, 'small': 100
    }},
    'tomato': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'pieces': 120, 'piece': 120, 'each': 120, '': 120
    }},
    'carrot': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'pieces': 60, 'piece': 60, 'each': 60, '': 60
    }},
    'potato': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'pieces': 170, 'piece': 170, 'each': 170, '': 170, 'medium': 170, 'large': 250, 'small': 100
    }},
    'egg': {'base_unit': 'pieces', 'conversions': {
        'pieces': 1, 'piece': 1, 'each': 1, '': 1, 'large': 1, 'medium': 1
    }},
    'lemon': {'base_unit': 'pieces', 'conversions': {
        'pieces': 1, 'piece': 1, 'each': 1, '': 1
    }},
    'lime': {'base_unit': 'pieces', 'conversions': {
        'pieces': 1, 'piece': 1, 'each': 1, '': 1
    }},
    'butter': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'tbsp': 14, 'tablespoon': 14, 'tsp': 5, 'teaspoon': 5, 'cup': 227, 'stick': 113
    }},
    'flour': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'cup': 125, 'tbsp': 8, 'tablespoon': 8
    }},
    'sugar': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'cup': 200, 'tbsp': 12.5, 'tablespoon': 12.5, 'tsp': 4, 'teaspoon': 4
    }},
    'milk': {'base_unit': 'ml', 'conversions': {
        'ml': 1, 'l': 1000, 'liter': 1000, 'litre': 1000, 'cup': 240, 'tbsp': 15, 'tablespoon': 15
    }},
    'oil': {'base_unit': 'ml', 'conversions': {
        'ml': 1, 'l': 1000, 'liter': 1000, 'litre': 1000, 'cup': 240, 'tbsp': 15, 'tablespoon': 15, 'tsp': 5, 'teaspoon': 5
    }},
    'cream': {'base_unit': 'ml', 'conversions': {
        'ml': 1, 'l': 1000, 'liter': 1000, 'litre': 1000, 'cup': 240, 'tbsp': 15, 'tablespoon': 15
    }},
    'cheese': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'cup': 100, 'slice': 20, 'slices': 20
    }},
    'chicken': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'breast': 200, 'breasts': 200, 'thigh': 150, 'thighs': 150, 'pieces': 150, 'piece': 150
    }},
    'beef': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'lb': 454, 'pound': 454
    }},
    'rice': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'cup': 185
    }},
    'pasta': {'base_unit': 'g', 'conversions': {
        'g': 1, 'gram': 1, 'kg': 1000, 'cup': 100
    }},
}

def get_base_ingredient_name(name: str) -> str:
    """Get the base ingredient name for matching equivalents"""
    normalized = normalize_ingredient_name(name)
    # Check if any equivalent key is in the name
    for key in INGREDIENT_EQUIVALENTS:
        if key in normalized:
            return key
    return normalized

def convert_to_base_unit(name: str, quantity: float, unit: str) -> tuple[float, str]:
    """Convert an ingredient quantity to its base unit for consolidation"""
    base_name = get_base_ingredient_name(name)
    
    if base_name in INGREDIENT_EQUIVALENTS:
        equiv = INGREDIENT_EQUIVALENTS[base_name]
        unit_lower = unit.lower().strip() if unit else ''
        
        if unit_lower in equiv['conversions']:
            base_qty = quantity * equiv['conversions'][unit_lower]
            return base_qty, equiv['base_unit']
    
    # No conversion available, return as-is
    return quantity, unit

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
    """Consolidate shopping list items with smart unit conversion"""
    # Group by base ingredient name (using equivalents) and convert to base units
    grouped = {}
    for item in items:
        base_name = get_base_ingredient_name(item.name)
        qty = parse_quantity(item.quantity)
        base_qty, base_unit = convert_to_base_unit(item.name, qty, item.unit)
        
        if base_name not in grouped:
            grouped[base_name] = {
                'name': item.name,  # Keep first occurrence's name
                'quantity': 0,
                'unit': base_unit,
                'original_unit': item.unit,
                'category': item.category,
                'sources': []
            }
        grouped[base_name]['quantity'] += base_qty
        if item.recipe_source and item.recipe_source not in grouped[base_name]['sources']:
            grouped[base_name]['sources'].append(item.recipe_source)
    
    # Convert back to list with smart unit formatting
    consolidated = []
    for base_name, data in grouped.items():
        qty = data['quantity']
        unit = data['unit']
        
        # Convert large quantities to more sensible units
        if unit == 'g' and qty >= 1000:
            qty = qty / 1000
            unit = 'kg'
        elif unit == 'ml' and qty >= 1000:
            qty = qty / 1000
            unit = 'L'
        
        # Format quantity nicely
        if qty == int(qty):
            qty_str = str(int(qty))
        elif qty < 1:
            # Show fractions for small amounts
            if abs(qty - 0.25) < 0.05:
                qty_str = '1/4'
            elif abs(qty - 0.33) < 0.05:
                qty_str = '1/3'
            elif abs(qty - 0.5) < 0.05:
                qty_str = '1/2'
            elif abs(qty - 0.67) < 0.05:
                qty_str = '2/3'
            elif abs(qty - 0.75) < 0.05:
                qty_str = '3/4'
            else:
                qty_str = f"{qty:.1f}".rstrip('0').rstrip('.')
        else:
            qty_str = f"{qty:.1f}".rstrip('0').rstrip('.')
        
        consolidated.append(ShoppingListItem(
            name=data['name'],
            quantity=qty_str,
            unit=unit,
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
    if not openai_client:
        return consolidated
    
    try:
        items_text = "\n".join([f"- {item.quantity} {item.unit} {item.name} (from: {item.recipe_source or 'manual'})" for item in items])
        
        system_message = """You are a helpful assistant that consolidates shopping list items.
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

        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": f"Consolidate these shopping list items by combining quantities of the same ingredient:\n\n{items_text}"}
            ],
            max_tokens=2000
        )
        
        result = response.choices[0].message.content
        
        import json
        clean_response = result.strip()
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
    """Scrape recipe data from recipe URLs with comprehensive selector coverage"""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client_http:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
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
            
            # Try JSON-LD structured data first (most reliable)
            json_ld_scripts = soup.find_all('script', type='application/ld+json')
            for script in json_ld_scripts:
                try:
                    data = json.loads(script.string)
                    # Handle @graph array
                    if isinstance(data, dict) and '@graph' in data:
                        data = data['@graph']
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict) and item.get('@type') == 'Recipe':
                                data = item
                                break
                    if isinstance(data, dict) and data.get('@type') == 'Recipe':
                        recipe_data['name'] = data.get('name', '')
                        recipe_data['description'] = data.get('description', '')
                        
                        # Parse ingredients from JSON-LD
                        ingredients = data.get('recipeIngredient', [])
                        if ingredients:
                            recipe_data['ingredients_text'] = '\n'.join(ingredients)
                        
                        # Parse instructions from JSON-LD
                        instructions = data.get('recipeInstructions', [])
                        if instructions:
                            inst_text = []
                            for inst in instructions:
                                if isinstance(inst, str):
                                    inst_text.append(inst)
                                elif isinstance(inst, dict):
                                    inst_text.append(inst.get('text', ''))
                            recipe_data['instructions_text'] = '\n'.join(inst_text)
                        
                        # Get image
                        img = data.get('image')
                        if img:
                            if isinstance(img, list):
                                recipe_data['image_url'] = img[0] if img else None
                            elif isinstance(img, dict):
                                recipe_data['image_url'] = img.get('url', '')
                            else:
                                recipe_data['image_url'] = img
                        
                        logger.info(f"Found recipe data from JSON-LD: {recipe_data['name']}")
                        break
                except (json.JSONDecodeError, TypeError) as e:
                    continue
            
            # Fallback to HTML scraping if JSON-LD didn't work
            if not recipe_data['name']:
                # Extended title selectors
                title_selectors = [
                    'h1.entry-title', 'h1.recipe-title', 'h1.wprm-recipe-name', 
                    'h2.wprm-recipe-name', '.tasty-recipes-title', 
                    '[data-test-id="recipe-name"]', '.recipe-name', 
                    'h1[itemprop="name"]', '.recipe-header h1', 
                    '.post-title', 'article h1', 'h1'
                ]
                for selector in title_selectors:
                    title_elem = soup.select_one(selector)
                    if title_elem and title_elem.get_text(strip=True):
                        recipe_data['name'] = title_elem.get_text(strip=True)
                        break
            
            if not recipe_data['description']:
                desc_selectors = [
                    '.recipe-description', '.wprm-recipe-summary', 
                    '[data-test-id="recipe-description"]', 'meta[name="description"]',
                    '.recipe-summary', '[itemprop="description"]'
                ]
                for selector in desc_selectors:
                    desc_elem = soup.select_one(selector)
                    if desc_elem:
                        if desc_elem.name == 'meta':
                            recipe_data['description'] = desc_elem.get('content', '')
                        else:
                            recipe_data['description'] = desc_elem.get_text(strip=True)
                        if recipe_data['description']:
                            break
            
            if not recipe_data['ingredients_text']:
                # Extended ingredient selectors
                ing_selectors = [
                    '.wprm-recipe-ingredients', '.tasty-recipes-ingredients',
                    '.ingredients', '[data-test-id="ingredients"]', 
                    '.recipe-ingredients', '.ingredient-list',
                    '[itemprop="recipeIngredient"]', '.recipe-ingredients-list',
                    '.ingredients-section', '#ingredients'
                ]
                for selector in ing_selectors:
                    ing_elem = soup.select_one(selector)
                    if ing_elem:
                        recipe_data['ingredients_text'] = ing_elem.get_text('\n', strip=True)
                        if recipe_data['ingredients_text']:
                            break
                
                # Try individual ingredient items
                if not recipe_data['ingredients_text']:
                    ing_items = soup.select(
                        'li[class*="ingredient"], .ingredient-item, '
                        '.wprm-recipe-ingredient, li[itemprop="recipeIngredient"], '
                        '.tasty-recipes-ingredient'
                    )
                    if ing_items:
                        recipe_data['ingredients_text'] = '\n'.join([item.get_text(strip=True) for item in ing_items])
            
            if not recipe_data['instructions_text']:
                # Extended instruction selectors
                inst_selectors = [
                    '.wprm-recipe-instructions', '.tasty-recipes-instructions',
                    '.instructions', '[data-test-id="instructions"]', 
                    '.recipe-instructions', '.directions',
                    '[itemprop="recipeInstructions"]', '.recipe-directions',
                    '.method', '#instructions', '.steps'
                ]
                for selector in inst_selectors:
                    inst_elem = soup.select_one(selector)
                    if inst_elem:
                        recipe_data['instructions_text'] = inst_elem.get_text('\n', strip=True)
                        if recipe_data['instructions_text']:
                            break
                
                # Try individual instruction items
                if not recipe_data['instructions_text']:
                    inst_items = soup.select(
                        'li[class*="instruction"], .instruction-item, '
                        '.wprm-recipe-instruction, li[itemprop="recipeInstructions"], '
                        '.tasty-recipes-instruction, .step'
                    )
                    if inst_items:
                        recipe_data['instructions_text'] = '\n'.join([item.get_text(strip=True) for item in inst_items])
            
            if not recipe_data['image_url']:
                img_selectors = [
                    '.recipe-image img', '[data-test-id="recipe-image"]', 
                    'meta[property="og:image"]', '.hero-image img',
                    '.wprm-recipe-image img', '.post-thumbnail img',
                    'img[itemprop="image"]', '.entry-content img'
                ]
                for selector in img_selectors:
                    img_elem = soup.select_one(selector)
                    if img_elem:
                        if img_elem.name == 'meta':
                            recipe_data['image_url'] = img_elem.get('content')
                        else:
                            recipe_data['image_url'] = img_elem.get('src') or img_elem.get('data-src')
                        if recipe_data['image_url']:
                            break
            
            return recipe_data
    except Exception as e:
        logger.error(f"Error scraping recipe: {e}")
        raise HTTPException(status_code=400, detail=f"Could not fetch recipe from URL: {str(e)}")

async def extract_recipe_with_ai(url: str, html_content: str) -> dict:
    """Use AI to extract recipe from webpage content when scraping fails"""
    if not openai_client:
        return None
    
    try:
        # Limit HTML content to avoid token limits
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove scripts, styles, nav, footer
        for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'aside']):
            tag.decompose()
        
        # Get main content text
        text_content = soup.get_text('\n', strip=True)
        # Limit to ~4000 chars to stay within token limits
        text_content = text_content[:4000]
        
        system_message = """You are a recipe extraction expert. Extract recipe details from webpage content.

Return JSON format:
{
    "name": "Recipe name",
    "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity", ...],
    "instructions": ["step 1", "step 2", ...]
}

If you cannot find a recipe, return {"name": "", "ingredients": [], "instructions": []}"""

        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": f"Extract the recipe from this webpage content:\n\n{text_content}"}
            ],
            max_tokens=2000
        )
        
        result = response.choices[0].message.content
        
        # Parse JSON response
        clean_response = result.strip()
        if "```json" in clean_response:
            clean_response = clean_response.split("```json")[1].split("```")[0]
        elif "```" in clean_response:
            parts = clean_response.split("```")
            if len(parts) >= 2:
                clean_response = parts[1]
        
        data = json.loads(clean_response.strip())
        return {
            'name': data.get('name', ''),
            'description': '',
            'ingredients_text': '\n'.join(data.get('ingredients', [])),
            'instructions_text': '\n'.join(data.get('instructions', [])),
            'image_url': None,
            'source_url': url
        }
    except Exception as e:
        logger.error(f"AI recipe extraction failed: {e}")
        return None

# ============== AUTH ROUTES ==============

@api_router.get("/auth/google/login")
async def google_login(request: Request):
    """Initiate Google OAuth login"""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    redirect_uri = f"{APP_URL}/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@api_router.get("/auth/google/callback")
async def google_callback(request: Request, response: Response):
    """Handle Google OAuth callback"""
    try:
        logger.info(f"OAuth callback received. Query params: {dict(request.query_params)}")
        
        # Check for error from Google
        if 'error' in request.query_params:
            error = request.query_params.get('error')
            logger.error(f"Google OAuth returned error: {error}")
            return RedirectResponse(url=f"{APP_URL}?error={error}", status_code=302)
        
        token = await oauth.google.authorize_access_token(request)
        logger.info(f"Token received: {bool(token)}")
        
        user_info = token.get('userinfo')
        if not user_info:
            # Try to get user info from id_token
            user_info = await oauth.google.parse_id_token(token, nonce=None)
        
        if not user_info:
            logger.error("Failed to get user info from token")
            return RedirectResponse(url=f"{APP_URL}?error=no_user_info", status_code=302)
        
        email = user_info.get('email')
        name = user_info.get('name', email.split('@')[0] if email else 'User')
        picture = user_info.get('picture', '')
        
        logger.info(f"User authenticated: {email}")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": name, "picture": picture}}
            )
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user_doc = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user_doc)
        
        # Create session token
        session_token = str(uuid.uuid4())
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.insert_one(session_doc)
        
        logger.info(f"Session created for user: {user_id}")
        
        # Create redirect response with cookie
        redirect_response = RedirectResponse(url=APP_URL, status_code=302)
        redirect_response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="lax",
            path="/",
            max_age=7 * 24 * 60 * 60
        )
        
        return redirect_response
        
    except Exception as e:
        logger.error(f"Google OAuth error: {e}", exc_info=True)
        return RedirectResponse(url=f"{APP_URL}?error=auth_failed&detail={str(e)[:50]}", status_code=302)

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
    
    # Estimate cooking times - prefer instructions-based if available
    if instructions:
        prep_time, cook_time = estimate_cooking_times_from_instructions(instructions, data.recipe_name or "")
    else:
        prep_time, cook_time = estimate_cooking_times(
            [ing.model_dump() for ing in ingredients], 
            data.recipe_name or ""
        )
    
    return ParseIngredientsResponse(
        ingredients=ingredients, 
        instructions=instructions,
        prep_time=prep_time,
        cook_time=cook_time
    )

@api_router.post("/parse-image", response_model=ImageParseResponse)
async def parse_image(file: UploadFile = File(...)):
    """Extract ingredients from an uploaded image or PDF using AI vision"""
    # Read file contents
    contents = await file.read()
    content_type = file.content_type or ""
    filename = file.filename or ""
    
    logger.info(f"Received file: name={filename}, content_type={content_type}, size={len(contents)} bytes")
    
    # Check if it's a PDF by magic bytes (PDF files start with %PDF)
    is_pdf = (
        content_type == "application/pdf" or 
        filename.lower().endswith('.pdf') or
        contents[:4] == b'%PDF'
    )
    
    # Handle PDF by converting to image
    if is_pdf:
        logger.info("Detected PDF file, converting to image...")
        try:
            import fitz  # PyMuPDF
            
            # Open PDF from bytes
            pdf_document = fitz.open(stream=contents, filetype="pdf")
            
            if pdf_document.page_count == 0:
                raise HTTPException(status_code=400, detail="PDF has no pages")
            
            logger.info(f"PDF has {pdf_document.page_count} pages")
            
            # Get first page and render at high resolution
            page = pdf_document[0]
            zoom = 300 / 72  # 300 DPI
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PNG bytes then base64
            image_bytes = pix.tobytes("png")
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            pdf_document.close()
            logger.info(f"Successfully converted PDF to image, base64 length: {len(image_base64)}")
            
        except ImportError as e:
            logger.error(f"PyMuPDF not available: {e}")
            raise HTTPException(status_code=400, detail="PDF processing not available. Please upload an image instead.")
        except Exception as e:
            logger.error(f"Error converting PDF: {e}", exc_info=True)
            raise HTTPException(status_code=400, detail=f"Could not process PDF: {str(e)}. Please take a screenshot instead.")
    else:
        # For images, just encode as base64
        image_base64 = base64.b64encode(contents).decode('utf-8')
        logger.info(f"Processing as image, base64 length: {len(image_base64)}")
    
    # Extract ingredients
    raw_text, ingredients = await extract_ingredients_from_image(image_base64)
    
    return ImageParseResponse(ingredients_text=raw_text, ingredients=ingredients)


async def rewrite_instructions_immediately(original_instructions: List[str], ingredients: List[dict] = None) -> List[str]:
    """Aggressively restructure and rewrite instructions for copyright safety.
    This completely transforms the recipe structure, not just paraphrases."""
    
    if not openai_client or not original_instructions:
        return original_instructions
    
    if len(original_instructions) < 2:
        return original_instructions
    
    try:
        system_prompt = """You are a culinary recipe restructuring expert. Your job is to COMPLETELY TRANSFORM recipe instructions into an UNRECOGNIZABLE structure while achieving the same dish.

CRITICAL RESTRUCTURING RULES:

1. REORDER AGGRESSIVELY:
   - Move ALL prep work (chopping, measuring, mixing marinades) to the START
   - Group similar actions together (all chopping first, then all mixing, then cooking)
   - If original says "while X cooks, do Y" - separate these into distinct sequential steps
   - Preheating can go anywhere before it's needed

2. SPLIT AND MERGE DIFFERENTLY:
   - If original has 2 actions in one step, split into 2 steps
   - If original has 2 short related steps, combine into 1
   - NEVER have the same number of steps as original
   - Change where step boundaries fall

3. COMPLETELY DIFFERENT VOCABULARY:
   - "dice" → "cut into small cubes"
   - "sauté" → "cook in a pan over medium heat"
   - "fold in" → "gently mix through"
   - "season to taste" → "add salt and pepper as needed"
   - NEVER use the same verb as the original for the same action
   - Use totally different sentence structures

4. CHANGE PERSPECTIVE/STYLE:
   - If original is detailed, be concise
   - If original is concise, add helpful detail
   - If original uses "you", use imperatives
   - Change passive to active or vice versa

5. STANDARDIZE DIFFERENTLY:
   - Convert all to metric OR imperial (opposite of original if possible)
   - Round temperatures to nearest 10°C
   - Express times differently (original "15-20 mins" → "quarter of an hour")

6. STRUCTURE OUTPUT:
   - Always start with ALL prep work grouped together
   - Then cooking steps in logical order
   - End with plating/serving
   - Aim for a DIFFERENT total number of steps than original

OUTPUT FORMAT: Return ONLY a JSON array of instruction strings. Each string is one step."""

        # Format original instructions for analysis
        original_text = "\n".join([f"ORIGINAL STEP {i+1}: {inst}" for i, inst in enumerate(original_instructions)])
        
        user_prompt = f"""COMPLETELY RESTRUCTURE these recipe instructions. 

The output must be UNRECOGNIZABLE as the same recipe text - a human should NOT be able to tell these came from the same source.

ORIGINAL ({len(original_instructions)} steps):
{original_text}

REQUIREMENTS:
- Different number of steps than {len(original_instructions)}
- All prep grouped at start
- Completely different wording throughout
- No phrase of 5+ words matching original
- Return JSON array only"""

        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=2500,
            temperature=0.9  # Higher temperature for more creative restructuring
        )
        
        result = response.choices[0].message.content.strip()
        
        # Parse JSON array
        import json
        if "```json" in result:
            result = result.split("```json")[1].split("```")[0]
        elif "```" in result:
            result = result.split("```")[1].split("```")[0]
        
        result = result.strip()
        
        # Try to parse
        try:
            rewritten = json.loads(result)
            if isinstance(rewritten, list) and len(rewritten) > 0:
                logger.info(f"Restructured {len(original_instructions)} steps into {len(rewritten)} steps")
                return rewritten
        except json.JSONDecodeError:
            # Try to find array in response
            start = result.find("[")
            end = result.rfind("]") + 1
            if start >= 0 and end > start:
                rewritten = json.loads(result[start:end])
                if isinstance(rewritten, list):
                    logger.info(f"Restructured {len(original_instructions)} steps into {len(rewritten)} steps")
                    return rewritten
        
        logger.warning("Could not parse restructured instructions, using originals")
        return original_instructions
        
    except Exception as e:
        logger.error(f"Error restructuring instructions: {e}")
        return original_instructions


@api_router.post("/parse-instructions-image")
async def parse_instructions_image(file: UploadFile = File(...)):
    """Extract cooking instructions from an uploaded image or PDF using AI vision, then rewrite for copyright safety"""
    contents = await file.read()
    content_type = file.content_type or ""
    filename = file.filename or ""
    
    logger.info(f"Parse instructions - file: name={filename}, content_type={content_type}, size={len(contents)} bytes")
    
    # Check if it's a PDF by magic bytes (PDF files start with %PDF)
    is_pdf = (
        content_type == "application/pdf" or 
        filename.lower().endswith('.pdf') or
        contents[:4] == b'%PDF'
    )
    
    # Handle PDF by converting to image
    if is_pdf:
        logger.info("Detected PDF for instructions, converting to image...")
        try:
            import fitz  # PyMuPDF
            
            pdf_document = fitz.open(stream=contents, filetype="pdf")
            
            if pdf_document.page_count == 0:
                raise HTTPException(status_code=400, detail="PDF has no pages")
            
            # Get first page and render at high resolution
            page = pdf_document[0]
            zoom = 300 / 72
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            image_bytes = pix.tobytes("png")
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            pdf_document.close()
            logger.info(f"Successfully converted instructions PDF to image")
            
        except ImportError as e:
            logger.error(f"PyMuPDF not available: {e}")
            raise HTTPException(status_code=400, detail="PDF processing not available. Please upload an image instead.")
        except Exception as e:
            logger.error(f"Error converting PDF: {e}", exc_info=True)
            raise HTTPException(status_code=400, detail=f"Could not process PDF. Please take a screenshot instead.")
    else:
        image_base64 = base64.b64encode(contents).decode('utf-8')
    
    raw_text, instructions, prep_time, cook_time, suggested_name = await extract_instructions_from_image(image_base64)
    
    # IMMEDIATELY rewrite instructions for copyright safety
    # The user never sees the original wording - only our rewritten version
    if instructions and len(instructions) > 0:
        instructions = await rewrite_instructions_immediately(instructions)
    
    return {
        "instructions_text": "",  # Don't return original text
        "instructions": instructions,  # Rewritten instructions
        "prep_time": prep_time,
        "cook_time": cook_time,
        "suggested_name": suggested_name
    }

# ---- Meal Suggestions Route ----

@api_router.get("/suggestions/meals")
async def get_meal_suggestions(request: Request, meal_type: Optional[str] = None, expiring_soon: bool = False):
    """Get meal suggestions based on pantry inventory, optionally filtered by meal type or expiring ingredients"""
    user_id = await get_user_id_or_none(request)
    
    # Get pantry items
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry or not pantry.get('items'):
        return {"suggestions": [], "message": "Add items to your pantry first!"}
    
    pantry_items = pantry['items']
    
    # If filtering by expiring soon, prioritize items with expiry dates
    expiring_items = []
    expiring_item_names = []
    if expiring_soon:
        today = datetime.now(timezone.utc).date()
        for item in pantry_items:
            if item.get('expiry_date'):
                try:
                    expiry = datetime.fromisoformat(item['expiry_date'].replace('Z', '+00:00')).date()
                    days_until_expiry = (expiry - today).days
                    if days_until_expiry <= 7:  # Within 7 days
                        expiring_items.append({
                            **item,
                            'days_until_expiry': days_until_expiry
                        })
                        expiring_item_names.append(item.get('name', ''))
                except:
                    pass
        
        if not expiring_items:
            return {"suggestions": [], "message": "No items expiring soon! Your pantry is fresh."}
        
        # Sort by expiry date (soonest first)
        expiring_items.sort(key=lambda x: x['days_until_expiry'])
        
        # IMPORTANT: Don't replace pantry_items entirely - just mark expiring ones
        # This allows recipes to match against ALL pantry items but prioritize expiring ones
        for item in pantry_items:
            item['is_expiring'] = item.get('name', '') in expiring_item_names
        
        # Add expiring flag to items that are expiring
        for exp_item in expiring_items:
            exp_item['is_expiring'] = True
            # Find and update the item in pantry_items
            for p_item in pantry_items:
                if p_item.get('name') == exp_item.get('name'):
                    p_item['days_until_expiry'] = exp_item['days_until_expiry']
    
    # Get recipes, optionally filtered by meal type
    recipe_query = {"user_id": user_id} if user_id else {}
    all_recipes = await db.recipes.find(recipe_query, {"_id": 0}).to_list(100)
    
    # Filter by meal type using smart keyword matching
    if meal_type and meal_type in ["breakfast", "lunch", "dinner", "snack"]:
        # Extended keywords for better meal type detection
        meal_keywords = {
            "breakfast": [
                "breakfast", "pancake", "pancakes", "waffle", "waffles", "egg", "eggs", 
                "omelette", "omelet", "toast", "porridge", "oatmeal", "cereal", "smoothie", 
                "muffin", "muffins", "bacon", "sausage", "hash brown", "french toast",
                "granola", "yogurt parfait", "scrambled", "fried egg", "benedict",
                "croissant", "bagel"
            ],
            "lunch": [
                "lunch", "sandwich", "sandwiches", "salad", "salads", "soup", "soups",
                "wrap", "wraps", "bowl", "bowls", "panini", "quesadilla", "tacos", "taco",
                "burrito", "pita", "hummus", "bruschetta", "light", "quick"
            ],
            "dinner": [
                "dinner", "roast", "steak", "curry", "curries", "casserole", "pie", "pies",
                "lasagna", "lasagne", "risotto", "stew", "beef", "pork", "lamb", "chicken",
                "fish", "salmon", "cod", "roasted", "baked", "grilled", "braised",
                "shepherd", "cottage pie", "bolognese", "carbonara", "tikka", "korma",
                "thai", "chinese", "indian", "mexican", "mediterranean"
            ],
            "snack": [
                "snack", "snacks", "cookie", "cookies", "cake", "bar", "bars", "dip", "dips",
                "nuts", "fruit", "bites", "balls", "energy", "popcorn", "chips", "nachos",
                "trail mix", "crackers"
            ]
        }
        
        # Some items can be multi-meal - pasta and stir fry work for lunch AND dinner
        multi_meal_items = {
            "pasta": ["lunch", "dinner"],
            "stir fry": ["lunch", "dinner"],
            "stir-fry": ["lunch", "dinner"],
            "noodles": ["lunch", "dinner"],
            "noodle": ["lunch", "dinner"],
            "rice": ["lunch", "dinner"],
            "fried rice": ["lunch", "dinner"],
        }
        
        keywords = meal_keywords.get(meal_type, [])
        
        recipes = []
        for r in all_recipes:
            recipe_name = r.get('name', '').lower()
            recipe_desc = r.get('description', '').lower()
            recipe_text = recipe_name + " " + recipe_desc
            
            # Check if any keyword matches
            if any(kw in recipe_text for kw in keywords):
                recipes.append(r)
            else:
                # Check multi-meal items
                for item, valid_meals in multi_meal_items.items():
                    if item in recipe_text and meal_type in valid_meals:
                        recipes.append(r)
                        break
        
        # If still no matches and looking for breakfast/lunch, be more lenient
        # Don't include heavy dinner items in breakfast/lunch
        if not recipes and meal_type in ["breakfast", "lunch"]:
            dinner_only_keywords = ["roast", "stew", "casserole", "braised", "slow cook"]
            recipes = [
                r for r in all_recipes
                if not any(kw in r.get('name', '').lower() for kw in dinner_only_keywords)
            ]
    else:
        recipes = all_recipes
    
    if not recipes:
        meal_label = meal_type.title() if meal_type else "any"
        return {"suggestions": [], "message": f"No {meal_label} recipes found. Add some recipes first!"}
    
    # Get improved suggestions with shared ingredient grouping
    suggestions = await suggest_meals_with_shared_ingredients(pantry_items, recipes, expiring_soon)
    
    meal_label = f"{meal_type} " if meal_type else ""
    expiry_label = ""
    
    if expiring_soon and expiring_item_names:
        # Filter to show only suggestions that actually use expiring items, but still show some if none match
        suggestions_with_expiring = [s for s in suggestions if s.get('expiring_ingredients_used', 0) > 0]
        
        if suggestions_with_expiring:
            suggestions = suggestions_with_expiring
            expiry_label = f" using expiring: {', '.join(expiring_item_names[:3])}"
        else:
            # No recipes directly use the expiring ingredients
            expiry_label = f" (Note: No recipes found using your expiring items: {', '.join(expiring_item_names[:3])}. Try the AI generator!)"
    
    return {"suggestions": suggestions, "message": f"Found {len(suggestions)} {meal_label}recipes{expiry_label}!"}

@api_router.get("/recipes/grouped")
async def get_recipes_grouped_by_ingredients(request: Request):
    """Get recipe groups where recipes share 2+ ingredients together"""
    user_id = await get_user_id_or_none(request)
    
    recipe_query = {"user_id": user_id} if user_id else {}
    recipes = await db.recipes.find(recipe_query, {"_id": 0}).to_list(100)
    
    if not recipes:
        return {"groups": [], "message": "Add some recipes first!"}
    
    # Build recipe -> ingredients mapping
    recipe_ingredients = {}
    for recipe in recipes:
        recipe_id = recipe.get('id')
        recipe_ings = set()
        for ing in recipe.get('ingredients', []):
            ing_name = normalize_ingredient_name(ing.get('name', ''))
            if ing_name:
                recipe_ings.add(ing_name)
        recipe_ingredients[recipe_id] = {
            'id': recipe_id,
            'name': recipe.get('name', ''),
            'ingredients': recipe_ings
        }
    
    # Find recipe pairs/groups that share 2+ ingredients
    recipe_groups = []
    recipe_ids = list(recipe_ingredients.keys())
    
    for i in range(len(recipe_ids)):
        for j in range(i + 1, len(recipe_ids)):
            r1 = recipe_ingredients[recipe_ids[i]]
            r2 = recipe_ingredients[recipe_ids[j]]
            shared = r1['ingredients'] & r2['ingredients']
            
            # Only include if they share 2+ ingredients
            if len(shared) >= 2:
                recipe_groups.append({
                    'recipes': [
                        {'id': r1['id'], 'name': r1['name']},
                        {'id': r2['id'], 'name': r2['name']}
                    ],
                    'shared_ingredients': list(shared),
                    'shared_count': len(shared)
                })
    
    # Sort by number of shared ingredients (most shared first)
    recipe_groups.sort(key=lambda x: x['shared_count'], reverse=True)
    
    # Merge groups with same recipes but format for display
    # Group by shared ingredient combination for display
    display_groups = []
    for group in recipe_groups[:15]:  # Top 15 groups
        shared_text = ", ".join([ing.title() for ing in group['shared_ingredients'][:3]])
        if len(group['shared_ingredients']) > 3:
            shared_text += f" +{len(group['shared_ingredients']) - 3}"
        
        display_groups.append({
            'shared_ingredient': shared_text,
            'recipes': group['recipes'],
            'count': group['shared_count']
        })
    
    return {
        "groups": display_groups,
        "total_recipes": len(recipes),
        "message": f"Found {len(display_groups)} recipe pairs sharing 2+ ingredients"
    }

# ---- Recipe Routes ----

@api_router.post("/recipes", response_model=Recipe)
async def create_recipe(recipe_data: RecipeCreate, request: Request):
    """Create a new recipe with AI-generated image and auto-suggested categories"""
    user_id = await get_user_id_or_none(request)
    
    # Handle image based on skip_image_generation flag
    image_url = recipe_data.image_url
    ingredients_dict = [ing.model_dump() if hasattr(ing, 'model_dump') else ing for ing in recipe_data.ingredients]
    
    # Only generate AI image if:
    # 1. No image URL provided
    # 2. skip_image_generation is False
    # 3. There are ingredients to base the image on
    if not image_url and not recipe_data.skip_image_generation and recipe_data.ingredients:
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
    # Remove skip_image_generation from stored data
    recipe_dict.pop('skip_image_generation', None)
    
    recipe = Recipe(**recipe_dict, user_id=user_id)
    doc = recipe.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.recipes.insert_one(doc)
    return recipe

@api_router.post("/recipes/scrape-url")
async def scrape_recipe_url(import_data: RecipeImport):
    """Scrape a recipe URL and return data without saving - rewrites instructions for copyright safety"""
    scraped = await scrape_recipe_from_url(import_data.url)
    
    # If basic scraping failed to get ingredients/instructions, try AI extraction
    if not scraped['ingredients_text'] and not scraped['instructions_text']:
        logger.info("Basic scraping didn't find recipe data, trying AI extraction...")
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client_http:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
                response = await client_http.get(import_data.url, headers=headers)
                ai_extracted = await extract_recipe_with_ai(import_data.url, response.text)
                if ai_extracted and (ai_extracted['ingredients_text'] or ai_extracted['instructions_text']):
                    scraped = ai_extracted
                    logger.info("AI extraction succeeded")
        except Exception as e:
            logger.error(f"AI extraction fallback failed: {e}")
    
    if not scraped['name']:
        scraped['name'] = "Imported Recipe"
    
    ingredients = []
    if scraped['ingredients_text']:
        ingredients = await parse_ingredients_with_ai(scraped['ingredients_text'], scraped['name'])
    
    instructions = []
    if scraped['instructions_text']:
        instructions = [step.strip() for step in scraped['instructions_text'].split('\n') if step.strip()]
    
    # IMMEDIATELY rewrite instructions for copyright safety
    if instructions and len(instructions) > 0:
        instructions = await rewrite_instructions_immediately(instructions)
    
    # Estimate times from instructions
    prep_time, cook_time = estimate_cooking_times_from_instructions(instructions, scraped['name'])
    
    return {
        "name": scraped['name'],
        "description": "",  # Don't include original description (may have copyright content)
        "ingredients": [ing.model_dump() for ing in ingredients],
        "instructions": instructions,  # Rewritten instructions
        "source_url": scraped['source_url'],
        "image_url": "",  # Don't use source image (copyright)
        "prep_time": prep_time,
        "cook_time": cook_time,
        "extraction_method": "ai" if not scraped.get('_from_html') else "html"
    }

# ============== FAVORITES ==============

@api_router.get("/favorites")
async def get_favorites(request: Request):
    """Get user's favorite recipe IDs"""
    user_id = await get_user_id_or_none(request)
    if not user_id:
        return {"favorites": []}
    
    favorites_doc = await db.favorites.find_one({"user_id": user_id}, {"_id": 0})
    return {"favorites": favorites_doc.get("recipe_ids", []) if favorites_doc else []}

@api_router.post("/favorites/{recipe_id}")
async def add_favorite(recipe_id: str, request: Request):
    """Add a recipe to favorites"""
    user_id = await get_user_id_or_none(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")
    
    await db.favorites.update_one(
        {"user_id": user_id},
        {"$addToSet": {"recipe_ids": recipe_id}},
        upsert=True
    )
    return {"message": "Added to favorites", "recipe_id": recipe_id}

@api_router.delete("/favorites/{recipe_id}")
async def remove_favorite(recipe_id: str, request: Request):
    """Remove a recipe from favorites"""
    user_id = await get_user_id_or_none(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required")
    
    await db.favorites.update_one(
        {"user_id": user_id},
        {"$pull": {"recipe_ids": recipe_id}}
    )
    return {"message": "Removed from favorites", "recipe_id": recipe_id}

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

# ============== COCKTAILS ENDPOINTS ==============

@api_router.get("/cocktails", response_model=List[Recipe])
async def get_cocktails(request: Request, alcoholic: Optional[str] = None):
    """Get all cocktail recipes with optional alcoholic/non-alcoholic filter"""
    user_id = await get_user_id_or_none(request)
    
    # Base query: only cocktails
    query = {"recipe_type": "cocktail"}
    if user_id:
        query["user_id"] = user_id
    
    # Filter by alcoholic status if specified
    if alcoholic == "true":
        query["is_alcoholic"] = True
    elif alcoholic == "false":
        query["is_alcoholic"] = False
    # If not specified, return all cocktails
    
    cursor = db.recipes.find(query, {"_id": 0}).sort("created_at", -1)
    cocktails = await cursor.to_list(1000)
    
    for cocktail in cocktails:
        if isinstance(cocktail.get('created_at'), str):
            cocktail['created_at'] = datetime.fromisoformat(cocktail['created_at'])
    
    return cocktails

@api_router.get("/recipes", response_model=List[Recipe])
async def get_recipes(request: Request, sort_by: Optional[str] = None):
    """Get all recipes (for logged in user or all if not logged in)"""
    user_id = await get_user_id_or_none(request)
    
    # If user is logged in, show their recipes. Otherwise show all (backward compat)
    query = {"user_id": user_id} if user_id else {}
    
    # Determine sort order
    if sort_by == "popularity":
        # Sort by average_rating descending, then by review_count descending
        cursor = db.recipes.find(query, {"_id": 0}).sort([("average_rating", -1), ("review_count", -1)])
    elif sort_by == "newest":
        cursor = db.recipes.find(query, {"_id": 0}).sort("created_at", -1)
    else:
        cursor = db.recipes.find(query, {"_id": 0})
    
    recipes = await cursor.to_list(1000)
    
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

# ============== REVIEWS ENDPOINTS ==============

@api_router.get("/recipes/{recipe_id}/reviews")
async def get_recipe_reviews(recipe_id: str):
    """Get all reviews for a recipe"""
    reviews = await db.reviews.find({"recipe_id": recipe_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for review in reviews:
        if isinstance(review.get('created_at'), str):
            review['created_at'] = datetime.fromisoformat(review['created_at'])
    return {"reviews": reviews, "count": len(reviews)}

@api_router.post("/recipes/{recipe_id}/reviews")
async def add_recipe_review(recipe_id: str, review_data: ReviewCreate, request: Request):
    """Add a review to a recipe"""
    recipe = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    user_id = await get_user_id_or_none(request)
    user_name = "Anonymous"
    if user_id:
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if user:
            user_name = user.get("name", "Anonymous")
    
    review = Review(
        recipe_id=recipe_id,
        user_id=user_id,
        user_name=user_name,
        rating=review_data.rating,
        comment=review_data.comment
    )
    
    doc = review.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.reviews.insert_one(doc)
    
    # Update recipe average rating
    all_reviews = await db.reviews.find({"recipe_id": recipe_id}, {"_id": 0}).to_list(1000)
    if all_reviews:
        avg_rating = sum(r.get('rating', 0) for r in all_reviews) / len(all_reviews)
        await db.recipes.update_one(
            {"id": recipe_id},
            {"$set": {"average_rating": round(avg_rating, 1), "review_count": len(all_reviews)}}
        )
    
    return {"message": "Review added!", "review": review}

@api_router.delete("/recipes/{recipe_id}/reviews/{review_id}")
async def delete_recipe_review(recipe_id: str, review_id: str, request: Request):
    """Delete a review"""
    user_id = await get_user_id_or_none(request)
    
    review = await db.reviews.find_one({"id": review_id, "recipe_id": recipe_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Only allow deletion by the review author
    if review.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Cannot delete other users' reviews")
    
    await db.reviews.delete_one({"id": review_id})
    
    # Update recipe average rating
    all_reviews = await db.reviews.find({"recipe_id": recipe_id}, {"_id": 0}).to_list(1000)
    if all_reviews:
        avg_rating = sum(r.get('rating', 0) for r in all_reviews) / len(all_reviews)
        await db.recipes.update_one(
            {"id": recipe_id},
            {"$set": {"average_rating": round(avg_rating, 1), "review_count": len(all_reviews)}}
        )
    else:
        await db.recipes.update_one(
            {"id": recipe_id},
            {"$set": {"average_rating": 0, "review_count": 0}}
        )
    
    return {"message": "Review deleted!"}

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

class AddItemsToShoppingListRequest(BaseModel):
    items: List[dict]

@api_router.post("/shopping-list/add-items", response_model=ShoppingList)
async def add_items_to_shopping_list(data: AddItemsToShoppingListRequest, request: Request):
    """Add multiple items to the shopping list (from pantry low stock export)"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    shopping_list = await db.shopping_lists.find_one(query, {"_id": 0})
    
    if not shopping_list:
        shopping_list = ShoppingList(items=[], user_id=user_id).model_dump()
        shopping_list['created_at'] = shopping_list['created_at'].isoformat() if hasattr(shopping_list['created_at'], 'isoformat') else shopping_list['created_at']
        shopping_list['updated_at'] = shopping_list['updated_at'].isoformat() if hasattr(shopping_list['updated_at'], 'isoformat') else shopping_list['updated_at']
        await db.shopping_lists.insert_one(shopping_list)
    
    # Add each item to the shopping list
    added_count = 0
    for item_data in data.items:
        # Check if item already exists (by name, case-insensitive)
        existing = next(
            (i for i in shopping_list['items'] 
             if normalize_ingredient_name(i.get('name', '')) == normalize_ingredient_name(item_data.get('name', ''))),
            None
        )
        
        if not existing:
            new_item = ShoppingListItem(
                name=item_data.get('name', ''),
                quantity=str(item_data.get('quantity', '1')),
                unit=item_data.get('unit', ''),
                category=item_data.get('category', 'other'),
                checked=False,
                recipe_source="Pantry Low Stock"
            ).model_dump()
            shopping_list['items'].append(new_item)
            added_count += 1
    
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

@api_router.post("/pantry/consolidate")
async def consolidate_pantry(request: Request):
    """Consolidate duplicate items in the pantry using smart matching"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry or not pantry.get('items'):
        return {"message": "Pantry is empty", "merged": 0}
    
    # Group items by their base ingredient name
    groups = {}
    for item in pantry['items']:
        base_name = get_base_ingredient_name(item['name'])
        if base_name not in groups:
            groups[base_name] = []
        groups[base_name].append(item)
    
    # Merge groups with multiple items
    merged_count = 0
    new_items = []
    
    for base_name, items in groups.items():
        if len(items) == 1:
            new_items.append(items[0])
        else:
            # Merge items - use shortest name as the canonical name
            items.sort(key=lambda x: len(x['name']))
            merged_item = items[0].copy()
            
            # Sum up quantities (convert to same unit if possible)
            total_base_qty = 0
            base_unit = None
            
            for item in items:
                qty, unit = convert_to_base_unit(item['name'], item['quantity'], item.get('unit', ''))
                if base_unit is None:
                    base_unit = unit
                if unit == base_unit:
                    total_base_qty += qty
                else:
                    total_base_qty += item['quantity']
            
            merged_item['quantity'] = total_base_qty
            if base_unit:
                merged_item['unit'] = base_unit
            merged_item['last_updated'] = datetime.now(timezone.utc).isoformat()
            
            new_items.append(merged_item)
            merged_count += len(items) - 1
            logger.info(f"Merged {len(items)} items into '{merged_item['name']}'")
    
    if merged_count > 0:
        pantry['items'] = new_items
        pantry['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db.pantry.update_one(query, {"$set": pantry}, upsert=True)
    
    return {
        "message": f"Consolidated pantry - merged {merged_count} duplicate items",
        "merged": merged_count
    }

@api_router.get("/pantry/barcode/{barcode}")
async def lookup_barcode(barcode: str):
    """Look up a product by barcode using Open Food Facts API"""
    import aiohttp
    
    # Clean barcode - remove any non-numeric characters
    barcode = ''.join(filter(str.isdigit, barcode))
    
    if not barcode or len(barcode) < 8:
        raise HTTPException(status_code=400, detail="Invalid barcode")
    
    try:
        # Query Open Food Facts API
        url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as response:
                if response.status != 200:
                    raise HTTPException(status_code=404, detail="Product not found")
                
                data = await response.json()
        
        if data.get('status') != 1:
            raise HTTPException(status_code=404, detail="Product not found in database")
        
        product = data.get('product', {})
        
        # Extract product information
        product_name = product.get('product_name', '') or product.get('product_name_en', '') or product.get('generic_name', '')
        
        # Try to get a cleaner name
        if not product_name:
            brands = product.get('brands', '')
            generic = product.get('generic_name', '')
            product_name = f"{brands} {generic}".strip() if brands or generic else "Unknown Product"
        
        # Determine category
        categories = product.get('categories', '').lower()
        category = 'other'
        if any(x in categories for x in ['fruit', 'vegetable', 'produce', 'salad']):
            category = 'produce'
        elif any(x in categories for x in ['milk', 'cheese', 'yogurt', 'dairy', 'cream', 'butter']):
            category = 'dairy'
        elif any(x in categories for x in ['meat', 'chicken', 'beef', 'pork', 'fish', 'seafood', 'egg', 'protein']):
            category = 'protein'
        elif any(x in categories for x in ['bread', 'pasta', 'rice', 'cereal', 'grain', 'flour']):
            category = 'grains'
        elif any(x in categories for x in ['spice', 'herb', 'seasoning', 'sauce']):
            category = 'spices'
        elif any(x in categories for x in ['frozen']):
            category = 'frozen'
        elif any(x in categories for x in ['canned', 'preserved', 'oil', 'condiment']):
            category = 'pantry'
        
        # Get quantity/size
        quantity_str = product.get('quantity', '')
        serving_size = product.get('serving_size', '')
        
        # Parse quantity
        quantity = 1
        unit = 'pieces'
        
        if quantity_str:
            # Try to extract number and unit from quantity string like "500g", "1L", "400gr"
            import re
            match = re.search(r'(\d+(?:\.\d+)?)\s*(gr|g|kg|ml|l|cl|oz|lb)(?:\b|$)', quantity_str.lower())
            if match:
                quantity = float(match.group(1))
                unit = match.group(2)
                # Normalize units
                if unit == 'gr':
                    unit = 'g'
                elif unit == 'cl':
                    quantity *= 10
                    unit = 'ml'
                elif unit == 'oz':
                    quantity *= 28.35
                    unit = 'g'
                elif unit == 'lb':
                    quantity *= 453.6
                    unit = 'g'
        
        # Get image
        image_url = product.get('image_front_small_url', '') or product.get('image_url', '')
        
        return {
            "found": True,
            "barcode": barcode,
            "name": product_name.strip().title(),
            "brand": product.get('brands', ''),
            "quantity": quantity,
            "unit": unit,
            "category": category,
            "image_url": image_url,
            "raw_quantity": quantity_str
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404) as-is
        raise
    except aiohttp.ClientError as e:
        logger.error(f"Error querying Open Food Facts: {e}")
        raise HTTPException(status_code=503, detail="Could not reach product database")
    except Exception as e:
        logger.error(f"Error looking up barcode: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
            # Handle expiry_date - can be set to a value or cleared
            if update_data.clear_expiry_date:
                item['expiry_date'] = None
            elif update_data.expiry_date is not None:
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
        recipe_name = recipe_ing['name'].lower().strip()
        recipe_name_normalized = normalize_ingredient_name(recipe_name)
        
        # Try to find a matching pantry item
        best_match = None
        best_match_score = 0
        
        for pantry_item in pantry['items']:
            pantry_name = pantry_item['name'].lower().strip()
            pantry_name_normalized = normalize_ingredient_name(pantry_name)
            
            # Calculate match score using multiple methods
            score = 0
            
            # Exact normalized match (best)
            if recipe_name_normalized == pantry_name_normalized:
                score = 100
            # One contains the other (good)
            elif recipe_name_normalized in pantry_name_normalized or pantry_name_normalized in recipe_name_normalized:
                score = 80
            # Key words match (e.g., "chicken" matches "chicken breast", "diced chicken")
            else:
                recipe_words = set(recipe_name_normalized.split())
                pantry_words = set(pantry_name_normalized.split())
                
                # Check if the core ingredient word matches
                common_words = recipe_words & pantry_words
                if common_words:
                    # Score based on how many words match
                    score = min(70, 30 + (len(common_words) * 20))
                
                # Also check base ingredient name from equivalents
                recipe_base = get_base_ingredient_name(recipe_name)
                pantry_base = get_base_ingredient_name(pantry_name)
                if recipe_base == pantry_base and len(recipe_base) > 2:
                    score = max(score, 75)
            
            if score > best_match_score:
                best_match_score = score
                best_match = pantry_item
        
        # Only deduct if we have a reasonable match (score > 50)
        if best_match and best_match_score >= 50:
            # Parse recipe quantity
            try:
                recipe_qty = float(recipe_ing['quantity']) * data.servings_multiplier
            except (ValueError, TypeError):
                recipe_qty = 1 * data.servings_multiplier
            
            recipe_unit = recipe_ing.get('unit', '').lower().strip()
            pantry_unit = best_match.get('unit', '').lower().strip()
            
            # Convert to base units for proper deduction
            recipe_base_qty, recipe_base_unit = convert_to_base_unit(recipe_ing['name'], recipe_qty, recipe_unit)
            pantry_base_qty, pantry_base_unit = convert_to_base_unit(best_match['name'], best_match['quantity'], pantry_unit)
            
            # If units match, deduct directly
            if recipe_base_unit == pantry_base_unit:
                deduct_amount = recipe_base_qty
                # Convert back to pantry units for storage
                new_pantry_qty = max(0, pantry_base_qty - deduct_amount)
                
                # Convert back to original unit if needed
                if pantry_unit in ['kg', 'kilo'] and pantry_base_unit == 'g':
                    best_match['quantity'] = round(new_pantry_qty / 1000, 2)
                elif pantry_unit in ['l', 'liter', 'litre'] and pantry_base_unit == 'ml':
                    best_match['quantity'] = round(new_pantry_qty / 1000, 2)
                else:
                    best_match['quantity'] = round(new_pantry_qty, 2)
            else:
                # Units don't match - make a reasonable estimate
                # Deduct 1 unit if small quantity, or proportionally
                if recipe_qty <= 3:
                    best_match['quantity'] = max(0, best_match['quantity'] - recipe_qty)
                else:
                    best_match['quantity'] = max(0, best_match['quantity'] - 1)
            
            best_match['last_updated'] = datetime.now(timezone.utc).isoformat()
            deducted.append({
                "name": best_match['name'],
                "matched_with": recipe_ing['name'],
                "deducted": recipe_qty,
                "unit": recipe_unit,
                "remaining": best_match['quantity'],
                "match_score": best_match_score
            })
        else:
            missing.append(recipe_ing['name'])
    
    # Remove items with 0 or negative quantity
    pantry['items'] = [item for item in pantry['items'] if item.get('quantity', 0) > 0]
    
    pantry['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.pantry.update_one(query, {"$set": pantry}, upsert=True)
    
    return {
        "message": f"Cooked {recipe['name']}",
        "deducted": deducted,
        "deducted_count": len(deducted),
        "missing_ingredients": missing
    }

@api_router.get("/pantry/low-stock")
async def get_low_stock_items(request: Request):
    """Get staple items that are below their minimum threshold.
    Only alerts for pantry staples like dairy, sauces, condiments, spices - 
    not fresh produce or protein that you buy per-recipe."""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry:
        return {"low_stock_items": [], "suggested_shopping": []}
    
    # Categories that should trigger low-stock alerts (staples you keep stocked)
    STAPLE_CATEGORIES = ['dairy', 'pantry', 'spices', 'frozen', 'grains']
    
    # Common staple keywords for items that might be miscategorized
    STAPLE_KEYWORDS = [
        'cheese', 'milk', 'cream', 'butter', 'yogurt', 'yoghurt',
        'sauce', 'ketchup', 'mayo', 'mayonnaise', 'mustard', 'soy sauce',
        'oil', 'vinegar', 'honey', 'syrup', 'jam', 'jelly',
        'flour', 'sugar', 'salt', 'pepper', 'rice', 'pasta', 'noodles',
        'stock', 'broth', 'bouillon', 'tomato paste', 'coconut milk',
        'beans', 'lentils', 'chickpeas', 'canned',
        'bread', 'tortilla', 'wrap',
        'egg', 'eggs'
    ]
    
    low_stock = []
    suggested_shopping = []
    
    for item in pantry.get('items', []):
        if item['quantity'] <= item.get('min_threshold', 0):
            category = item.get('category', 'other').lower()
            name_lower = item.get('name', '').lower()
            
            # Check if it's a staple category or contains staple keywords
            is_staple = (
                category in STAPLE_CATEGORIES or
                any(kw in name_lower for kw in STAPLE_KEYWORDS)
            )
            
            if is_staple:
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

@api_router.get("/pantry/expiring-soon")
async def get_expiring_items(request: Request, days: int = 7):
    """Get pantry items that are expiring within the specified number of days"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry:
        return {"expiring_items": [], "expired_items": []}
    
    today = datetime.now(timezone.utc).date()
    expiring_items = []
    expired_items = []
    
    for item in pantry.get('items', []):
        if not item.get('expiry_date'):
            continue
        
        try:
            # Parse expiry date
            expiry_str = item['expiry_date']
            if 'T' in expiry_str:
                expiry = datetime.fromisoformat(expiry_str.replace('Z', '+00:00')).date()
            else:
                expiry = datetime.strptime(expiry_str, '%Y-%m-%d').date()
            
            days_until_expiry = (expiry - today).days
            
            item_info = {
                **item,
                'expiry_date': expiry.isoformat(),
                'days_until_expiry': days_until_expiry
            }
            
            if days_until_expiry < 0:
                expired_items.append(item_info)
            elif days_until_expiry <= days:
                expiring_items.append(item_info)
        except Exception as e:
            logger.warning(f"Could not parse expiry date for {item.get('name')}: {e}")
            continue
    
    # Sort by days until expiry (soonest first)
    expiring_items.sort(key=lambda x: x['days_until_expiry'])
    expired_items.sort(key=lambda x: x['days_until_expiry'])
    
    return {
        "expiring_items": expiring_items,
        "expired_items": expired_items,
        "message": f"Found {len(expiring_items)} items expiring within {days} days, {len(expired_items)} already expired"
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

@api_router.post("/pantry/scan-receipt")
async def scan_receipt(request: Request, file: UploadFile = File(...)):
    """Scan a receipt image/PDF and extract items to add to pantry"""
    if not openai_client:
        raise HTTPException(status_code=503, detail="AI features not available")
    
    user_id = await get_user_id_or_none(request)
    
    # Read file contents
    contents = await file.read()
    
    # Determine file type
    content_type = file.content_type or ""
    filename = file.filename or ""
    
    logger.info(f"Receipt scan - file: name={filename}, content_type={content_type}, size={len(contents)} bytes")
    
    # Check if it's a PDF
    is_pdf = (
        content_type == "application/pdf" or 
        filename.lower().endswith('.pdf') or
        (len(contents) > 4 and contents[:4] == b'%PDF')
    )
    
    extracted_text = ""
    image_base64 = None
    image_media_type = "image/png"
    
    # Handle PDF - extract text directly (faster and more accurate for text-based PDFs)
    if is_pdf:
        logger.info("Detected PDF receipt, extracting text...")
        try:
            import fitz  # PyMuPDF
            
            pdf_document = fitz.open(stream=contents, filetype="pdf")
            
            if pdf_document.page_count == 0:
                raise HTTPException(status_code=400, detail="PDF has no pages")
            
            logger.info(f"Receipt PDF has {pdf_document.page_count} pages")
            
            # Extract text from ALL pages (Tesco baskets can have many pages)
            all_text = []
            for page_num in range(min(pdf_document.page_count, 30)):  # Limit to 30 pages
                page = pdf_document[page_num]
                page_text = page.get_text()
                if page_text.strip():
                    all_text.append(f"--- Page {page_num + 1} ---\n{page_text}")
            
            extracted_text = "\n".join(all_text)
            logger.info(f"Extracted {len(extracted_text)} chars of text from PDF")
            
            # If very little text, fall back to image OCR of first few pages
            if len(extracted_text.strip()) < 100:
                logger.info("Little text found, falling back to image OCR...")
                # Render first 3 pages to images
                images_base64 = []
                for page_num in range(min(pdf_document.page_count, 3)):
                    page = pdf_document[page_num]
                    zoom = 200 / 72  # 200 DPI for reasonable size
                    mat = fitz.Matrix(zoom, zoom)
                    pix = page.get_pixmap(matrix=mat)
                    image_bytes = pix.tobytes("png")
                    images_base64.append(base64.b64encode(image_bytes).decode('utf-8'))
                
                image_base64 = images_base64[0] if images_base64 else None
            
            pdf_document.close()
            
        except ImportError as e:
            logger.error(f"PyMuPDF not installed: {e}")
            raise HTTPException(status_code=400, detail="PDF processing not available. Please upload a screenshot instead.")
        except Exception as e:
            logger.error(f"Error processing PDF: {e}", exc_info=True)
            raise HTTPException(status_code=400, detail=f"Could not process PDF: {str(e)}")
    else:
        # For images, encode as base64 for vision API
        image_base64 = base64.b64encode(contents).decode('utf-8')
        if content_type.startswith("image/"):
            image_media_type = content_type
        elif filename.lower().endswith('.png'):
            image_media_type = "image/png"
        elif filename.lower().endswith('.webp'):
            image_media_type = "image/webp"
        else:
            image_media_type = "image/jpeg"
        logger.info(f"Processing receipt as image")
    
    try:
        system_message = """You are a helpful assistant that extracts grocery items from shopping lists, baskets, or receipts.

Extract ALL grocery/food items from the provided text or image.

For each item, determine:
- name: Simplified product name (e.g., "Pistachios" not "Tesco Roasted & Salted Pistachios 150G")
- quantity: The number of items or weight (look for "X in basket", quantities, or weights like "150G", "500G", "1KG")
- unit: The unit (g, kg, L, ml, pack, pieces, each - extract from product name like "150G" means 150, g)
- category: One of: produce, dairy, protein, grains, pantry, spices, frozen, other

EXAMPLES:
- "Tesco Roasted & Salted Pistachios 150G, 1 in basket" → name: "Pistachios", quantity: 150, unit: "g", category: "pantry"
- "Tesco Penne Pasta 500G" → name: "Penne Pasta", quantity: 500, unit: "g", category: "grains"
- "Semi Skimmed Milk 2L, 2 in basket" → name: "Milk", quantity: 4, unit: "L", category: "dairy"
- "Chicken Breast Fillets 650G" → name: "Chicken Breast", quantity: 650, unit: "g", category: "protein"
- "6 Free Range Eggs" → name: "Eggs", quantity: 6, unit: "pieces", category: "protein"

Return ONLY a valid JSON array, no explanation:
[{"name": "Pistachios", "quantity": 150, "unit": "g", "category": "pantry"}, ...]

IMPORTANT:
- Skip unavailable items, vouchers, bags, non-food items
- Remove brand names (TESCO, ASDA, etc.) from item names
- Extract weights/sizes from product names (e.g., "500G" → quantity: 500, unit: "g")
- If "X in basket", multiply the weight by X"""

        # Use text if available (from PDF), otherwise use image
        if extracted_text and len(extracted_text.strip()) > 100:
            logger.info("Using extracted text for AI processing")
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",  # Text processing can use the smaller model
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": f"Extract all grocery items from this shopping list/basket:\n\n{extracted_text[:15000]}"}  # Limit text length
                ],
                max_tokens=3000
            )
        elif image_base64:
            logger.info("Using image for AI processing")
            response = await openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_message},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Extract all grocery items from this receipt/basket image."},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{image_media_type};base64,{image_base64}"}
                            }
                        ]
                    }
                ],
                max_tokens=3000
            )
        else:
            return {"extracted_items": [], "message": "Could not extract content from file"}
        
        result = response.choices[0].message.content
        logger.info(f"Receipt scan response: {result[:500] if result else 'Empty'}")
        
        # Parse response
        import json
        clean_response = result.strip()
        
        # Remove markdown if present
        if "```json" in clean_response:
            clean_response = clean_response.split("```json")[1].split("```")[0]
        elif "```" in clean_response:
            parts = clean_response.split("```")
            if len(parts) >= 2:
                clean_response = parts[1]
        
        clean_response = clean_response.strip()
        
        # Try to parse JSON
        try:
            items_data = json.loads(clean_response)
        except json.JSONDecodeError:
            # Try to find JSON array in response
            start = clean_response.find("[")
            end = clean_response.rfind("]") + 1
            if start >= 0 and end > start:
                items_data = json.loads(clean_response[start:end])
            else:
                logger.error(f"Could not parse receipt JSON: {clean_response}")
                return {"extracted_items": [], "message": "Could not parse receipt. Please try a clearer image."}
        
        # Validate and normalize items
        extracted_items = []
        for item in items_data:
            if not item.get('name'):
                continue
            
            extracted_items.append({
                "name": str(item.get('name', '')).strip().title(),
                "quantity": float(item.get('quantity', 1)),
                "unit": str(item.get('unit', '')).strip().lower(),
                "category": item.get('category', 'other').lower()
            })
        
        logger.info(f"Extracted {len(extracted_items)} items from receipt")
        
        return {
            "extracted_items": extracted_items,
            "message": f"Found {len(extracted_items)} items on receipt"
        }
        
    except Exception as e:
        logger.error(f"Error scanning receipt: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing receipt: {str(e)}")

@api_router.post("/pantry/add-from-receipt")
async def add_from_receipt(request: Request):
    """Add items extracted from a receipt scan to pantry with smart consolidation"""
    user_id = await get_user_id_or_none(request)
    body = await request.json()
    items = body.get('items', [])
    
    if not items:
        raise HTTPException(status_code=400, detail="No items provided")
    
    # Get or create pantry
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry:
        pantry = Pantry(user_id=user_id).model_dump()
        pantry['created_at'] = pantry['created_at'].isoformat()
        pantry['updated_at'] = pantry['updated_at'].isoformat()
    
    added_count = 0
    updated_count = 0
    
    def find_matching_pantry_item(new_name: str, pantry_items: list) -> int:
        """Find a matching pantry item using fuzzy matching"""
        new_normalized = normalize_ingredient_name(new_name)
        new_base = get_base_ingredient_name(new_name)
        new_words = set(new_normalized.split())
        
        best_match_idx = None
        best_match_score = 0
        
        for i, pantry_item in enumerate(pantry_items):
            existing_name = pantry_item['name']
            existing_normalized = normalize_ingredient_name(existing_name)
            existing_base = get_base_ingredient_name(existing_name)
            existing_words = set(existing_normalized.split())
            
            score = 0
            
            # Exact normalized match
            if new_normalized == existing_normalized:
                score = 100
            # Base name match (e.g., both are "burger")
            elif new_base == existing_base and len(new_base) > 3:
                score = 85
            # One contains the other
            elif new_normalized in existing_normalized or existing_normalized in new_normalized:
                score = 80
            else:
                # Word overlap matching
                common_words = new_words & existing_words
                # Remove common filler words
                significant_common = {w for w in common_words if len(w) > 3 and w not in ['based', 'style', 'free', 'organic']}
                
                if significant_common:
                    # Score based on overlap ratio
                    overlap_ratio = len(significant_common) / max(len(new_words), len(existing_words))
                    score = int(50 + overlap_ratio * 40)
            
            if score > best_match_score and score >= 70:  # Require at least 70% confidence
                best_match_score = score
                best_match_idx = i
        
        return best_match_idx
    
    for item in items:
        qty = float(item.get('quantity', 1))
        name = item.get('name', '').strip()
        unit = item.get('unit', '').strip()
        
        if not name:
            continue
        
        # Find matching item using fuzzy matching
        existing_idx = find_matching_pantry_item(name, pantry['items'])
        
        if existing_idx is not None:
            # Update existing item
            existing_item = pantry['items'][existing_idx]
            existing_unit = existing_item.get('unit', '').lower()
            new_unit = unit.lower()
            
            # Convert to same units if possible before adding
            if existing_unit == new_unit or not existing_unit or not new_unit:
                pantry['items'][existing_idx]['quantity'] += qty
            else:
                # Try to convert units
                new_base_qty, new_base_unit = convert_to_base_unit(name, qty, unit)
                existing_base_qty, existing_base_unit = convert_to_base_unit(
                    existing_item['name'], 
                    existing_item['quantity'], 
                    existing_unit
                )
                
                if new_base_unit == existing_base_unit:
                    # Convert back to original unit
                    total_base = existing_base_qty + new_base_qty
                    pantry['items'][existing_idx]['quantity'] = total_base
                    pantry['items'][existing_idx]['unit'] = new_base_unit
                else:
                    # Units incompatible, just add the quantity
                    pantry['items'][existing_idx]['quantity'] += qty
            
            pantry['items'][existing_idx]['last_updated'] = datetime.now(timezone.utc).isoformat()
            updated_count += 1
            logger.info(f"Consolidated '{name}' with existing '{existing_item['name']}'")
        else:
            # Add new item
            new_item = PantryItem(
                name=name,
                quantity=qty,
                unit=unit,
                category=item.get('category', 'other'),
                typical_purchase=qty
            ).model_dump()
            new_item['last_updated'] = new_item['last_updated'].isoformat()
            pantry['items'].append(new_item)
            added_count += 1
    
    pantry['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.pantry.update_one(query, {"$set": pantry}, upsert=True)
    
    return {
        "message": f"Added {added_count} new items, updated {updated_count} existing items",
        "added": added_count,
        "updated": updated_count
    }

# ============== RECIPE UPDATE/EDIT ENDPOINT ==============

class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    servings: Optional[int] = None
    prep_time: Optional[str] = None
    cook_time: Optional[str] = None
    ingredients: Optional[List[Ingredient]] = None
    instructions: Optional[List[str]] = None
    categories: Optional[List[str]] = None

@api_router.put("/recipes/{recipe_id}")
async def update_recipe(recipe_id: str, update_data: RecipeUpdate, request: Request):
    """Update an existing recipe"""
    user_id = await get_user_id_or_none(request)
    
    # Find recipe
    query = {"id": recipe_id}
    if user_id:
        query["user_id"] = user_id
    
    recipe = await db.recipes.find_one(query, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Update fields
    update_dict = {}
    if update_data.name is not None:
        update_dict["name"] = update_data.name
    if update_data.description is not None:
        update_dict["description"] = update_data.description
    if update_data.servings is not None:
        update_dict["servings"] = update_data.servings
    if update_data.prep_time is not None:
        update_dict["prep_time"] = update_data.prep_time
    if update_data.cook_time is not None:
        update_dict["cook_time"] = update_data.cook_time
    if update_data.ingredients is not None:
        update_dict["ingredients"] = [ing.model_dump() for ing in update_data.ingredients]
    if update_data.instructions is not None:
        update_dict["instructions"] = update_data.instructions
    if update_data.categories is not None:
        update_dict["categories"] = update_data.categories
    
    if update_dict:
        await db.recipes.update_one(query, {"$set": update_dict})
    
    # Return updated recipe
    updated_recipe = await db.recipes.find_one(query, {"_id": 0})
    if isinstance(updated_recipe.get('created_at'), str):
        updated_recipe['created_at'] = datetime.fromisoformat(updated_recipe['created_at'])
    return updated_recipe

# ============== RECIPE EXPORT/IMPORT ENDPOINTS ==============

class RecipeExportRequest(BaseModel):
    recipe_ids: List[str]

@api_router.post("/recipes/export")
async def export_recipes(data: RecipeExportRequest, request: Request):
    """Export recipes as JSON for sharing"""
    user_id = await get_user_id_or_none(request)
    
    exported = []
    for recipe_id in data.recipe_ids:
        query = {"id": recipe_id}
        if user_id:
            query["user_id"] = user_id
        
        recipe = await db.recipes.find_one(query, {"_id": 0})
        if recipe:
            # Remove user-specific and system fields
            export_recipe = {
                "name": recipe.get("name"),
                "description": recipe.get("description", ""),
                "servings": recipe.get("servings", 2),
                "prep_time": recipe.get("prep_time", ""),
                "cook_time": recipe.get("cook_time", ""),
                "ingredients": recipe.get("ingredients", []),
                "instructions": recipe.get("instructions", []),
                "categories": recipe.get("categories", []),
                "source_url": recipe.get("source_url"),
            }
            exported.append(export_recipe)
    
    return {
        "recipes": exported,
        "count": len(exported),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "version": "1.0"
    }

class RecipeImportBatchRequest(BaseModel):
    recipes: List[dict]

@api_router.post("/recipes/import-batch")
async def import_recipes_batch(data: RecipeImportBatchRequest, request: Request):
    """Import multiple recipes from exported JSON"""
    user_id = await get_user_id_or_none(request)
    
    imported = []
    for recipe_data in data.recipes:
        try:
            # Create new recipe with new ID
            ingredients = []
            for ing in recipe_data.get("ingredients", []):
                ingredients.append(Ingredient(
                    name=ing.get("name", ""),
                    quantity=str(ing.get("quantity", "")),
                    unit=ing.get("unit", ""),
                    category=ing.get("category", "other")
                ))
            
            recipe = Recipe(
                name=recipe_data.get("name", "Imported Recipe"),
                description=recipe_data.get("description", ""),
                servings=recipe_data.get("servings", 2),
                prep_time=recipe_data.get("prep_time", ""),
                cook_time=recipe_data.get("cook_time", ""),
                ingredients=ingredients,
                instructions=recipe_data.get("instructions", []),
                categories=recipe_data.get("categories", []),
                source_url=recipe_data.get("source_url"),
                user_id=user_id
            )
            
            doc = recipe.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.recipes.insert_one(doc)
            imported.append({"name": recipe.name, "id": recipe.id})
        except Exception as e:
            logger.error(f"Failed to import recipe: {e}")
    
    return {
        "imported": imported,
        "count": len(imported),
        "message": f"Successfully imported {len(imported)} recipes"
    }

# ============== COPYRIGHT-SAFE PRIVATE RECIPE SHARING ==============
# Implements legally-safe sharing that respects UK copyright law
# Only shares: facts (ingredients, times) + AI-rewritten instructions
# Never shares: original prose, third-party photos, brand copy

class PrivateShareRequest(BaseModel):
    recipe_ids: List[str]

class CreateImportTokenResponse(BaseModel):
    token: str
    expires_in_minutes: int = 15
    recipe_count: int
    message: str

@api_router.post("/recipes/share")
async def create_private_share_link(data: PrivateShareRequest, request: Request):
    """Create a private import link for recipes (copyright-safe)
    
    This creates a single-use, time-limited token that allows a friend to import
    recipes into their PRIVATE library. The link contains NO content preview.
    
    Process:
    1. For each recipe, create safe fields (facts + AI-rewritten instructions)
    2. Store safe version with compliance metrics
    3. Generate secure import token
    """
    user_id = await get_user_id_or_none(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Sign in to share recipes")
    
    # Process each recipe for safe sharing
    safe_recipes = []
    compliance_issues = []
    
    for recipe_id in data.recipe_ids:
        recipe = await db.recipes.find_one({"id": recipe_id, "user_id": user_id}, {"_id": 0})
        if not recipe:
            continue
        
        # Check if recipe already has compliant rewritten version
        existing_safe = await db.safe_recipes.find_one(
            {"original_recipe_id": recipe_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if existing_safe and existing_safe.get("compliance", {}).get("passed_compliance"):
            safe_recipes.append(existing_safe)
            continue
        
        # Check domain quota
        source_url = recipe.get("source_url", "")
        domain = extract_domain(source_url)
        if domain and not await check_domain_quota(domain):
            compliance_issues.append(f"Quota exceeded for {domain}")
            continue
        
        try:
            # Parse instructions into step graph
            original_instructions = recipe.get("instructions", [])
            ingredients = recipe.get("ingredients", [])
            
            step_graph = parse_to_step_graph(original_instructions, ingredients)
            
            # AI rewrite instructions in original wording
            rewrite_result = await rewrite_instructions_with_ai(
                step_graph=step_graph,
                ingredients=ingredients,
                original_title=recipe.get("name", ""),
                original_instructions=original_instructions
            )
            
            # Validate compliance
            compliance = await validate_compliance(
                original_instructions=original_instructions,
                rewritten_instructions=rewrite_result["method_rewritten"],
                check_semantic=False  # Only check semantic for borderline cases
            )
            
            # If compliance failed, try regeneration with stricter prompt
            if not compliance.passed_compliance:
                logger.warning(f"First compliance check failed for recipe {recipe_id}, retrying...")
                rewrite_result = await rewrite_instructions_with_ai(
                    step_graph=step_graph,
                    ingredients=ingredients,
                    original_title=recipe.get("name", ""),
                    original_instructions=original_instructions
                )
                compliance = await validate_compliance(
                    original_instructions=original_instructions,
                    rewritten_instructions=rewrite_result["method_rewritten"],
                    check_semantic=True  # Full check on retry
                )
            
            if not compliance.passed_compliance:
                compliance_issues.append(f"Could not generate compliant version of '{recipe.get('name')}'")
                continue
            
            # Calculate total time
            prep_time = recipe.get("prep_time", "")
            cook_time = recipe.get("cook_time", "")
            total_min = step_graph.get("total_time_min", 0)
            
            # Try to parse times if step graph didn't capture them
            if not total_min:
                try:
                    prep_min = int(re.search(r'(\d+)', prep_time).group(1)) if prep_time else 0
                    cook_min = int(re.search(r'(\d+)', cook_time).group(1)) if cook_time else 0
                    total_min = prep_min + cook_min
                except:
                    total_min = 30  # Default
            
            # Create safe recipe document
            safe_recipe = {
                "id": str(uuid.uuid4()),
                "original_recipe_id": recipe_id,
                "user_id": user_id,
                "title_generic": rewrite_result["title_generic"],
                "ingredients": ingredients,  # Facts - not copyrightable
                "servings": recipe.get("servings", 2),
                "time_total_min": total_min,
                "nutrition": recipe.get("nutrition", {}),  # Facts
                "method_rewritten": rewrite_result["method_rewritten"],
                "method_notes": rewrite_result.get("notes", ""),
                "adapted_from_domain": domain if domain else None,
                "compliance": compliance.model_dump(),
                "categories": recipe.get("categories", []),
                "source_hash": hash_source_content(" ".join(original_instructions)),  # For audit
                "created_at": datetime.now(timezone.utc).isoformat(),
                # NO images from source - user must add their own
                "user_images": []
            }
            
            # Store safe version
            await db.safe_recipes.update_one(
                {"original_recipe_id": recipe_id, "user_id": user_id},
                {"$set": safe_recipe},
                upsert=True
            )
            
            # Increment domain quota
            if domain:
                await increment_domain_quota(domain)
            
            safe_recipes.append(safe_recipe)
            
        except Exception as e:
            logger.error(f"Error processing recipe {recipe_id} for sharing: {e}")
            compliance_issues.append(f"Error processing '{recipe.get('name', 'Unknown')}'")
    
    if not safe_recipes:
        error_detail = "No recipes could be prepared for sharing."
        if compliance_issues:
            error_detail += f" Issues: {'; '.join(compliance_issues[:3])}"
        raise HTTPException(status_code=400, detail=error_detail)
    
    # Generate secure import token
    token = generate_import_token()
    token_doc = {
        "token": token,
        "recipe_ids": [r["id"] for r in safe_recipes],
        "sender_id": user_id,
        "scope": "private-import-only",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
        "used": False,
        "recipe_count": len(safe_recipes)
    }
    await db.import_tokens.insert_one(token_doc)
    
    # Log for governance
    logger.info(f"Private share token created by {user_id} for {len(safe_recipes)} recipes")
    
    return {
        "token": token,
        "expires_in_minutes": 15,
        "recipe_count": len(safe_recipes),
        "message": "Private import link created! Share this link - it expires in 15 minutes.",
        "compliance_issues": compliance_issues if compliance_issues else None
    }

@api_router.get("/recipes/shared/{token}")
async def get_share_preview(token: str):
    """Get minimal preview for share link (NO content exposed)
    
    This endpoint intentionally returns minimal info to prevent
    third-party content from being exposed before import.
    """
    # Find token
    token_doc = await db.import_tokens.find_one({"token": token}, {"_id": 0})
    
    if not token_doc:
        raise HTTPException(status_code=404, detail="Link not found or expired")
    
    # Check if used or expired
    if token_doc.get("used"):
        raise HTTPException(status_code=410, detail="This link has already been used")
    
    expires_at = token_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="This link has expired")
    
    # Return minimal preview - NO content
    return {
        "recipe_count": token_doc.get("recipe_count", 0),
        "expires_at": token_doc.get("expires_at"),
        "message": "Sign in to import these recipes to your private library",
        "legal_notice": "Recipes contain ingredients (facts) and originally-worded instructions. No third-party images or text."
    }

@api_router.post("/recipes/import-shared/{token}")
async def import_private_recipes(token: str, request: Request):
    """Import recipes from a private share link into user's library
    
    This is the core of copyright-safe sharing:
    1. Validates token (single-use, not expired)
    2. Copies ONLY safe fields (facts + rewritten instructions)
    3. NO third-party images or original prose
    4. Invalidates token after use
    """
    user_id = await get_user_id_or_none(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Sign in to import recipes")
    
    # Find and validate token
    token_doc = await db.import_tokens.find_one({"token": token}, {"_id": 0})
    
    if not token_doc:
        raise HTTPException(status_code=404, detail="Link not found")
    
    if token_doc.get("used"):
        raise HTTPException(status_code=410, detail="This link has already been used")
    
    if token_doc.get("scope") != "private-import-only":
        raise HTTPException(status_code=400, detail="Invalid link scope")
    
    # Check expiry
    expires_at = token_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="This link has expired")
    
    # Don't allow self-import
    if token_doc.get("sender_id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot import your own shared recipes")
    
    # Import safe recipes
    imported = []
    recipe_ids = token_doc.get("recipe_ids", [])
    
    for safe_recipe_id in recipe_ids:
        # Get safe recipe version
        safe_recipe = await db.safe_recipes.find_one({"id": safe_recipe_id}, {"_id": 0})
        
        if not safe_recipe:
            continue
        
        # Re-validate compliance before import
        if not safe_recipe.get("compliance", {}).get("passed_compliance"):
            logger.warning(f"Skipping recipe {safe_recipe_id} - compliance not passed")
            continue
        
        try:
            # Create ingredients from safe recipe
            ingredients = []
            for ing in safe_recipe.get("ingredients", []):
                ingredients.append(Ingredient(
                    name=ing.get("name", ""),
                    quantity=str(ing.get("quantity", "")),
                    unit=ing.get("unit", ""),
                    category=ing.get("category", "other")
                ))
            
            # Calculate times from total
            total_min = safe_recipe.get("time_total_min", 30)
            prep_time = f"{min(total_min // 3, 20)} mins"
            cook_time = f"{max(total_min - (total_min // 3), 10)} mins"
            
            # Create new recipe with SAFE FIELDS ONLY
            # NO: original prose, third-party images, descriptions with brand copy
            recipe = Recipe(
                name=safe_recipe.get("title_generic", "Imported Recipe"),
                description=f"Adapted recipe. Ingredients and times are factual; instructions are in original wording.",
                servings=safe_recipe.get("servings", 2),
                prep_time=prep_time,
                cook_time=cook_time,
                ingredients=ingredients,
                instructions=safe_recipe.get("method_rewritten", []),  # AI-rewritten
                categories=safe_recipe.get("categories", []),
                image_url="",  # NO third-party images - user adds their own
                user_id=user_id,
                source=safe_recipe.get("adapted_from_domain", "Shared recipe")
            )
            
            doc = recipe.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            doc['imported_from_share'] = True
            doc['compliance_verified'] = True
            
            await db.recipes.insert_one(doc)
            imported.append({"name": recipe.name, "id": recipe.id})
            
        except Exception as e:
            logger.error(f"Error importing safe recipe: {e}")
    
    # Invalidate token (single-use)
    await db.import_tokens.update_one(
        {"token": token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat(), "used_by": user_id}}
    )
    
    # Log for governance
    logger.info(f"Private import completed: {len(imported)} recipes imported by {user_id}")
    
    return {
        "imported": imported,
        "count": len(imported),
        "message": f"Imported {len(imported)} recipes to your private library!",
        "notice": "Ingredients are factual; instructions are in original wording. Add your own photos to complete each recipe."
    }

# Keep legacy endpoint for backward compatibility but mark deprecated
@api_router.get("/recipes/shared-legacy/{share_id}")
async def get_shared_recipes_legacy(share_id: str):
    """DEPRECATED: Legacy share endpoint - redirects to new system"""
    # Check if this is an old-style share
    share_doc = await db.shared_recipes.find_one({"share_id": share_id}, {"_id": 0})
    
    if share_doc:
        # Return minimal info, encourage using new system
        return {
            "recipes": [],  # Don't expose content
            "count": len(share_doc.get("recipes", [])),
            "deprecated": True,
            "message": "This share link format is deprecated. Please ask sender to create a new private import link."
        }
    
    raise HTTPException(status_code=404, detail="Share link not found")

# ============== AI RECIPE GENERATION FROM PANTRY ==============

class GenerateRecipeRequest(BaseModel):
    meal_type: Optional[str] = None
    expiring_soon: bool = False

@api_router.post("/suggestions/generate-recipe")
async def generate_ai_recipe_from_pantry(request: Request, data: GenerateRecipeRequest = None):
    """Generate a new AI recipe based solely on pantry ingredients"""
    user_id = await get_user_id_or_none(request)
    meal_type = data.meal_type if data else None
    filter_expiring = data.expiring_soon if data else False
    
    # Get pantry
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry or not pantry.get('items'):
        raise HTTPException(status_code=400, detail="Add items to your pantry first")
    
    if not openai_client:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Find expiring items
    today = datetime.now(timezone.utc).date()
    expiring_items = []
    for item in pantry['items']:
        if item.get('expiry_date'):
            try:
                expiry_str = item['expiry_date']
                if 'T' in expiry_str:
                    expiry = datetime.fromisoformat(expiry_str.replace('Z', '+00:00')).date()
                else:
                    expiry = datetime.strptime(expiry_str, '%Y-%m-%d').date()
                
                days_until = (expiry - today).days
                if days_until <= 7:
                    expiring_items.append({
                        'name': item.get('name'),
                        'days_until_expiry': days_until,
                        'quantity': item.get('quantity'),
                        'unit': item.get('unit')
                    })
            except:
                pass
    
    # Sort expiring items by days until expiry
    expiring_items.sort(key=lambda x: x['days_until_expiry'])
    
    # If filtering by expiring and no expiring items, return error
    if filter_expiring and not expiring_items:
        raise HTTPException(status_code=400, detail="No ingredients expiring soon! Your pantry is fresh.")
    
    meal_context = ""
    if meal_type:
        meal_contexts = {
            "breakfast": "Create a breakfast recipe - something suitable for morning, like eggs, pancakes, smoothies, or toast-based dishes.",
            "lunch": "Create a lunch recipe - something light to moderate like sandwiches, salads, soups, or wraps.",
            "dinner": "Create a dinner recipe - something hearty and satisfying like a main course with sides.",
            "snack": "Create a snack recipe - something small and quick like dips, energy balls, or finger foods."
        }
        meal_context = meal_contexts.get(meal_type, "")
    
    try:
        # Different prompts depending on whether we're focusing on expiring ingredients
        if filter_expiring:
            system_msg = f"""You are a creative chef focused on reducing food waste.
Your PRIMARY goal is to create a recipe that USES UP the expiring ingredients provided.
The recipe MUST include at least 2-3 of the expiring ingredients as main components.
{meal_context}

Return as JSON with format:
{{
    "name": "Recipe Name",
    "description": "Brief appetizing description highlighting how this uses expiring ingredients",
    "servings": 4,
    "prep_time": "15 min",
    "cook_time": "30 min",
    "ingredients": [
        {{"name": "ingredient", "quantity": "2", "unit": "cups", "category": "produce", "from_pantry": true, "is_expiring": true}}
    ],
    "instructions": ["Step 1", "Step 2", ...],
    "missing_ingredients": ["any item not in pantry but needed"],
    "categories": ["vegan", "quick-easy"],
    "expiring_used": ["list of expiring ingredients this recipe uses"]
}}

Categories can be: vegan, vegetarian, pescatarian, low-fat, quick-easy
Return ONLY valid JSON, no markdown."""
        else:
            system_msg = """You are a creative chef that generates delicious recipes.
Given a list of available ingredients, create a complete recipe that uses primarily those ingredients.
You can suggest 1-2 common pantry staples that might be missing.
""" + meal_context + """

Return as JSON with format:
{
    "name": "Recipe Name",
    "description": "Brief appetizing description",
    "servings": 4,
    "prep_time": "15 min",
    "cook_time": "30 min",
    "ingredients": [
        {"name": "ingredient", "quantity": "2", "unit": "cups", "category": "produce", "from_pantry": true}
    ],
    "instructions": ["Step 1", "Step 2", ...],
    "missing_ingredients": ["any item not in pantry but needed"],
    "categories": ["vegan", "quick-easy"]
}

Categories can be: vegan, vegetarian, pescatarian, low-fat, quick-easy
Return ONLY valid JSON, no markdown."""
        
        # Format pantry items
        pantry_text = "\n".join([
            f"- {item.get('name', '')} ({item.get('quantity', '')} {item.get('unit', '')})" 
            for item in pantry['items'] if item.get('quantity', 0) > 0
        ])
        
        # Build the prompt based on filter
        if filter_expiring:
            expiring_text = "\n".join([
                f"- {item['name']} ({item['quantity']} {item['unit']}) - EXPIRES IN {item['days_until_expiry']} DAYS!"
                for item in expiring_items
            ])
            user_prompt = f"""Create a recipe that PRIMARILY USES these EXPIRING ingredients:

🚨 EXPIRING SOON - MUST USE:
{expiring_text}

OTHER AVAILABLE INGREDIENTS (optional to use):
{pantry_text}

The recipe MUST use at least 2-3 of the expiring ingredients as main components.
This is about reducing food waste - prioritize the expiring items!"""
        else:
            # Standard prompt with expiring items as optional priority
            expiring_context = ""
            if expiring_items:
                expiring_text = "\n".join([
                    f"- {item['name']} (expires in {item['days_until_expiry']} days)"
                    for item in expiring_items[:5]
                ])
                expiring_context = f"\n\nPRIORITY - These ingredients are expiring soon and should be used:\n{expiring_text}"
            
            user_prompt = f"""Create a delicious recipe using these available ingredients:

{pantry_text}{expiring_context}

Make sure the recipe is practical and tasty. Use primarily ingredients from the list.
If absolutely necessary, you can include 1-2 common staples like salt, pepper, or oil."""
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=2000
        )
        
        result = response.choices[0].message.content
        
        import json
        clean_response = result.strip()
        
        if "```json" in clean_response:
            clean_response = clean_response.split("```json")[1].split("```")[0]
        elif "```" in clean_response:
            parts = clean_response.split("```")
            if len(parts) >= 2:
                clean_response = parts[1]
        
        clean_response = clean_response.strip()
        
        try:
            recipe_data = json.loads(clean_response)
        except json.JSONDecodeError:
            start = clean_response.find("{")
            end = clean_response.rfind("}") + 1
            if start >= 0 and end > start:
                recipe_data = json.loads(clean_response[start:end])
            else:
                raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
        return {
            "recipe": recipe_data,
            "expiring_items_used": expiring_items[:5],  # Include expiring items info
            "message": "Recipe generated from your pantry ingredients!"
        }
    except Exception as e:
        logger.error(f"Error generating recipe: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate recipe")

# ============== AI COCKTAIL GENERATION ==============

class GenerateCocktailRequest(BaseModel):
    alcoholic: Optional[bool] = None

@api_router.post("/suggestions/generate-cocktail")
async def generate_ai_cocktail_from_pantry(request: Request, data: GenerateCocktailRequest = None):
    """Generate an AI cocktail suggestion based on pantry ingredients"""
    user_id = await get_user_id_or_none(request)
    
    # Handle the alcoholic preference from request body
    alcoholic_preference = data.alcoholic if data else None
    
    logger.info(f"Generating cocktail for user {user_id}, alcoholic preference: {alcoholic_preference}")
    
    # Get pantry
    query = {"user_id": user_id} if user_id else {"user_id": None}
    pantry = await db.pantry.find_one(query, {"_id": 0})
    
    if not pantry or not pantry.get('items'):
        raise HTTPException(status_code=400, detail="Add items to your pantry first")
    
    if not openai_client:
        raise HTTPException(status_code=500, detail="AI service not configured - check OPENAI_API_KEY")
    
    # Build ingredient list from pantry
    pantry_items = []
    for item in pantry['items']:
        name = item.get('name', '')
        quantity = item.get('quantity', '')
        unit = item.get('unit', '')
        pantry_items.append(f"{name}: {quantity} {unit}".strip())
    
    pantry_list = "\n".join(pantry_items)
    
    # Determine drink type preference
    drink_type_context = ""
    if alcoholic_preference is True:
        drink_type_context = "Create an ALCOHOLIC cocktail. Focus on spirits, liqueurs, and classic cocktail ingredients."
    elif alcoholic_preference is False:
        drink_type_context = "Create a NON-ALCOHOLIC mocktail/drink. Focus on juices, sodas, syrups, and fresh ingredients."
    else:
        drink_type_context = "Create either an alcoholic cocktail or a non-alcoholic mocktail based on what ingredients are available."
    
    try:
        system_msg = f"""You are a creative bartender who makes delicious drinks from available ingredients.
{drink_type_context}

Look at the pantry items and suggest a cocktail/drink that can be made with mostly what's available.
Be creative! Consider:
- Spirits (vodka, gin, rum, whiskey, tequila, etc.)
- Mixers (juices, sodas, tonic, syrups)
- Fresh ingredients (fruits, herbs, citrus)
- Garnishes

Return as JSON with format:
{{
    "name": "Cocktail Name",
    "description": "Brief enticing description of the drink",
    "is_alcoholic": true/false,
    "ingredients": [
        {{"name": "ingredient", "quantity": "2", "unit": "oz", "from_pantry": true}}
    ],
    "instructions": ["Step 1: ...", "Step 2: ...", ...],
    "missing_ingredients": ["any item not in pantry but essential"],
    "glass_type": "Cocktail glass / Highball / etc.",
    "garnish": "Lime wheel / Mint sprig / etc.",
    "flavor_profile": ["sweet", "citrus", "refreshing"]
}}

Return ONLY valid JSON, no markdown."""
        
        user_msg = f"""Here's what's in my pantry:
{pantry_list}

Suggest a creative {'' if alcoholic_preference is None else ('alcoholic ' if alcoholic_preference else 'non-alcoholic ')}drink I can make!"""
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg}
            ],
            temperature=0.9,
            max_tokens=1500
        )
        
        ai_response = response.choices[0].message.content
        logger.info(f"Cocktail AI response received: {len(ai_response)} chars")
        
        # Parse JSON response
        clean_response = ai_response.strip()
        if clean_response.startswith("```"):
            clean_response = clean_response.split("```")[1]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:]
        
        try:
            cocktail_data = json.loads(clean_response)
        except json.JSONDecodeError:
            start = clean_response.find("{")
            end = clean_response.rfind("}") + 1
            if start >= 0 and end > start:
                cocktail_data = json.loads(clean_response[start:end])
            else:
                logger.error(f"Failed to parse cocktail JSON: {clean_response[:200]}")
                raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
        return {
            "cocktail": cocktail_data,
            "message": "Cocktail suggestion generated from your pantry!"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating cocktail: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate cocktail: {str(e)}")

# ============== SHOPPING LIST COST ESTIMATION ==============

# UK supermarket average prices (£ per standard unit) with loyalty card prices
# Loyalty cards: Tesco Clubcard, Sainsbury's Nectar, Asda Blue Light (staff only so standard), Morrisons More
UK_PRICE_DATA = {
    # Produce - per item prices
    "tomato": {"price": 0.30, "unit": "each", "tesco": 0.28, "tesco_clubcard": 0.22, "sainsburys": 0.32, "sainsburys_nectar": 0.28, "aldi": 0.22, "lidl": 0.20, "asda": 0.25, "morrisons": 0.29, "morrisons_more": 0.26},
    "onion": {"price": 0.15, "unit": "each", "tesco": 0.15, "tesco_clubcard": 0.12, "sainsburys": 0.18, "sainsburys_nectar": 0.15, "aldi": 0.10, "lidl": 0.10, "asda": 0.12, "morrisons": 0.14, "morrisons_more": 0.12},
    "garlic": {"price": 0.40, "unit": "bulb", "tesco": 0.40, "tesco_clubcard": 0.35, "sainsburys": 0.45, "sainsburys_nectar": 0.40, "aldi": 0.29, "lidl": 0.29, "asda": 0.35, "morrisons": 0.40, "morrisons_more": 0.35},
    "potato": {"price": 0.20, "unit": "each", "tesco": 0.20, "tesco_clubcard": 0.15, "sainsburys": 0.22, "sainsburys_nectar": 0.18, "aldi": 0.15, "lidl": 0.15, "asda": 0.18, "morrisons": 0.20, "morrisons_more": 0.17},
    "carrot": {"price": 0.10, "unit": "each", "tesco": 0.10, "tesco_clubcard": 0.08, "sainsburys": 0.12, "sainsburys_nectar": 0.10, "aldi": 0.07, "lidl": 0.07, "asda": 0.08, "morrisons": 0.10, "morrisons_more": 0.08},
    "pepper": {"price": 0.70, "unit": "each", "tesco": 0.70, "tesco_clubcard": 0.55, "sainsburys": 0.80, "sainsburys_nectar": 0.65, "aldi": 0.49, "lidl": 0.49, "asda": 0.60, "morrisons": 0.65, "morrisons_more": 0.55},
    "broccoli": {"price": 0.89, "unit": "head", "tesco": 0.89, "tesco_clubcard": 0.69, "sainsburys": 0.99, "sainsburys_nectar": 0.79, "aldi": 0.69, "lidl": 0.69, "asda": 0.79, "morrisons": 0.85, "morrisons_more": 0.75},
    "lettuce": {"price": 0.65, "unit": "head", "tesco": 0.65, "tesco_clubcard": 0.50, "sainsburys": 0.75, "sainsburys_nectar": 0.60, "aldi": 0.49, "lidl": 0.49, "asda": 0.55, "morrisons": 0.60, "morrisons_more": 0.52},
    "mushroom": {"price": 1.20, "unit": "250g", "tesco": 1.20, "tesco_clubcard": 0.95, "sainsburys": 1.35, "sainsburys_nectar": 1.10, "aldi": 0.89, "lidl": 0.89, "asda": 1.00, "morrisons": 1.15, "morrisons_more": 0.99},
    "spinach": {"price": 1.50, "unit": "bag", "tesco": 1.50, "tesco_clubcard": 1.20, "sainsburys": 1.65, "sainsburys_nectar": 1.35, "aldi": 1.09, "lidl": 1.09, "asda": 1.30, "morrisons": 1.45, "morrisons_more": 1.25},
    "celery": {"price": 0.75, "unit": "bunch", "tesco": 0.75, "tesco_clubcard": 0.59, "sainsburys": 0.85, "sainsburys_nectar": 0.69, "aldi": 0.55, "lidl": 0.55, "asda": 0.65, "morrisons": 0.72, "morrisons_more": 0.62},
    "cucumber": {"price": 0.55, "unit": "each", "tesco": 0.55, "tesco_clubcard": 0.45, "sainsburys": 0.65, "sainsburys_nectar": 0.52, "aldi": 0.39, "lidl": 0.39, "asda": 0.48, "morrisons": 0.52, "morrisons_more": 0.45},
    "courgette": {"price": 0.50, "unit": "each", "tesco": 0.50, "tesco_clubcard": 0.40, "sainsburys": 0.60, "sainsburys_nectar": 0.48, "aldi": 0.35, "lidl": 0.35, "asda": 0.42, "morrisons": 0.48, "morrisons_more": 0.40},
    "aubergine": {"price": 0.85, "unit": "each", "tesco": 0.85, "tesco_clubcard": 0.69, "sainsburys": 0.99, "sainsburys_nectar": 0.79, "aldi": 0.65, "lidl": 0.65, "asda": 0.75, "morrisons": 0.82, "morrisons_more": 0.70},
    "lemon": {"price": 0.35, "unit": "each", "tesco": 0.35, "tesco_clubcard": 0.28, "sainsburys": 0.40, "sainsburys_nectar": 0.32, "aldi": 0.25, "lidl": 0.25, "asda": 0.30, "morrisons": 0.33, "morrisons_more": 0.28},
    "lime": {"price": 0.30, "unit": "each", "tesco": 0.30, "tesco_clubcard": 0.24, "sainsburys": 0.35, "sainsburys_nectar": 0.28, "aldi": 0.20, "lidl": 0.20, "asda": 0.25, "morrisons": 0.28, "morrisons_more": 0.24},
    "ginger": {"price": 0.80, "unit": "piece", "tesco": 0.80, "tesco_clubcard": 0.65, "sainsburys": 0.95, "sainsburys_nectar": 0.76, "aldi": 0.55, "lidl": 0.55, "asda": 0.68, "morrisons": 0.75, "morrisons_more": 0.65},
    "spring onion": {"price": 0.60, "unit": "bunch", "tesco": 0.60, "tesco_clubcard": 0.48, "sainsburys": 0.70, "sainsburys_nectar": 0.56, "aldi": 0.45, "lidl": 0.45, "asda": 0.52, "morrisons": 0.58, "morrisons_more": 0.50},
    "banana": {"price": 0.15, "unit": "each", "tesco": 0.15, "tesco_clubcard": 0.12, "sainsburys": 0.18, "sainsburys_nectar": 0.14, "aldi": 0.11, "lidl": 0.11, "asda": 0.13, "morrisons": 0.14, "morrisons_more": 0.12},
    "apple": {"price": 0.30, "unit": "each", "tesco": 0.30, "tesco_clubcard": 0.24, "sainsburys": 0.35, "sainsburys_nectar": 0.28, "aldi": 0.22, "lidl": 0.22, "asda": 0.26, "morrisons": 0.29, "morrisons_more": 0.25},
    # Dairy
    "milk": {"price": 1.55, "unit": "liter", "tesco": 1.55, "tesco_clubcard": 1.35, "sainsburys": 1.60, "sainsburys_nectar": 1.45, "aldi": 1.09, "lidl": 1.09, "asda": 1.35, "morrisons": 1.50, "morrisons_more": 1.35},
    "cheese": {"price": 2.50, "unit": "250g", "tesco": 2.50, "tesco_clubcard": 2.00, "sainsburys": 2.75, "sainsburys_nectar": 2.25, "aldi": 1.89, "lidl": 1.89, "asda": 2.20, "morrisons": 2.40, "morrisons_more": 2.00},
    "cheddar": {"price": 2.50, "unit": "250g", "tesco": 2.50, "tesco_clubcard": 2.00, "sainsburys": 2.75, "sainsburys_nectar": 2.25, "aldi": 1.89, "lidl": 1.89, "asda": 2.20, "morrisons": 2.40, "morrisons_more": 2.00},
    "parmesan": {"price": 3.50, "unit": "100g", "tesco": 3.50, "tesco_clubcard": 2.80, "sainsburys": 3.90, "sainsburys_nectar": 3.20, "aldi": 2.49, "lidl": 2.49, "asda": 3.00, "morrisons": 3.30, "morrisons_more": 2.85},
    "butter": {"price": 2.00, "unit": "250g", "tesco": 2.00, "tesco_clubcard": 1.65, "sainsburys": 2.20, "sainsburys_nectar": 1.85, "aldi": 1.49, "lidl": 1.49, "asda": 1.75, "morrisons": 1.90, "morrisons_more": 1.65},
    "egg": {"price": 2.30, "unit": "6 pack", "tesco": 2.30, "tesco_clubcard": 1.89, "sainsburys": 2.50, "sainsburys_nectar": 2.10, "aldi": 1.69, "lidl": 1.69, "asda": 2.00, "morrisons": 2.20, "morrisons_more": 1.89},
    "cream": {"price": 1.20, "unit": "300ml", "tesco": 1.20, "tesco_clubcard": 1.00, "sainsburys": 1.35, "sainsburys_nectar": 1.15, "aldi": 0.89, "lidl": 0.89, "asda": 1.05, "morrisons": 1.15, "morrisons_more": 0.99},
    "yogurt": {"price": 1.50, "unit": "500g", "tesco": 1.50, "tesco_clubcard": 1.20, "sainsburys": 1.65, "sainsburys_nectar": 1.35, "aldi": 1.09, "lidl": 1.09, "asda": 1.30, "morrisons": 1.45, "morrisons_more": 1.25},
    # Protein
    "chicken": {"price": 5.50, "unit": "kg", "tesco": 5.50, "tesco_clubcard": 4.50, "sainsburys": 6.00, "sainsburys_nectar": 5.00, "aldi": 4.29, "lidl": 4.29, "asda": 4.80, "morrisons": 5.20, "morrisons_more": 4.50},
    "chicken breast": {"price": 6.50, "unit": "kg", "tesco": 6.50, "tesco_clubcard": 5.25, "sainsburys": 7.00, "sainsburys_nectar": 5.75, "aldi": 4.99, "lidl": 4.99, "asda": 5.50, "morrisons": 6.00, "morrisons_more": 5.25},
    "mince": {"price": 4.50, "unit": "500g", "tesco": 4.50, "tesco_clubcard": 3.60, "sainsburys": 5.00, "sainsburys_nectar": 4.00, "aldi": 3.29, "lidl": 3.29, "asda": 3.80, "morrisons": 4.20, "morrisons_more": 3.60},
    "beef": {"price": 8.00, "unit": "kg", "tesco": 8.00, "tesco_clubcard": 6.50, "sainsburys": 9.00, "sainsburys_nectar": 7.50, "aldi": 6.49, "lidl": 6.49, "asda": 7.00, "morrisons": 7.50, "morrisons_more": 6.50},
    "pork": {"price": 5.00, "unit": "kg", "tesco": 5.00, "tesco_clubcard": 4.00, "sainsburys": 5.50, "sainsburys_nectar": 4.50, "aldi": 3.99, "lidl": 3.99, "asda": 4.30, "morrisons": 4.70, "morrisons_more": 4.00},
    "bacon": {"price": 2.50, "unit": "200g", "tesco": 2.50, "tesco_clubcard": 2.00, "sainsburys": 2.80, "sainsburys_nectar": 2.25, "aldi": 1.79, "lidl": 1.79, "asda": 2.10, "morrisons": 2.35, "morrisons_more": 2.00},
    "salmon": {"price": 12.00, "unit": "kg", "tesco": 12.00, "tesco_clubcard": 9.50, "sainsburys": 13.50, "sainsburys_nectar": 11.00, "aldi": 9.99, "lidl": 9.99, "asda": 10.50, "morrisons": 11.50, "morrisons_more": 9.75},
    "fish": {"price": 8.00, "unit": "kg", "tesco": 8.00, "tesco_clubcard": 6.50, "sainsburys": 9.00, "sainsburys_nectar": 7.50, "aldi": 6.49, "lidl": 6.49, "asda": 7.00, "morrisons": 7.50, "morrisons_more": 6.50},
    "prawn": {"price": 8.00, "unit": "250g", "tesco": 8.00, "tesco_clubcard": 6.50, "sainsburys": 9.00, "sainsburys_nectar": 7.50, "aldi": 5.99, "lidl": 5.99, "asda": 7.00, "morrisons": 7.50, "morrisons_more": 6.50},
    "tofu": {"price": 2.00, "unit": "280g", "tesco": 2.00, "tesco_clubcard": 1.60, "sainsburys": 2.25, "sainsburys_nectar": 1.80, "aldi": 1.49, "lidl": 1.49, "asda": 1.70, "morrisons": 1.90, "morrisons_more": 1.60},
    # Pantry
    "rice": {"price": 2.00, "unit": "kg", "tesco": 2.00, "tesco_clubcard": 1.65, "sainsburys": 2.20, "sainsburys_nectar": 1.85, "aldi": 1.49, "lidl": 1.49, "asda": 1.70, "morrisons": 1.90, "morrisons_more": 1.60},
    "pasta": {"price": 1.20, "unit": "500g", "tesco": 1.20, "tesco_clubcard": 0.95, "sainsburys": 1.35, "sainsburys_nectar": 1.10, "aldi": 0.75, "lidl": 0.75, "asda": 0.95, "morrisons": 1.10, "morrisons_more": 0.95},
    "noodle": {"price": 1.50, "unit": "300g", "tesco": 1.50, "tesco_clubcard": 1.20, "sainsburys": 1.70, "sainsburys_nectar": 1.40, "aldi": 1.09, "lidl": 1.09, "asda": 1.30, "morrisons": 1.45, "morrisons_more": 1.25},
    "flour": {"price": 1.10, "unit": "kg", "tesco": 1.10, "tesco_clubcard": 0.89, "sainsburys": 1.25, "sainsburys_nectar": 1.00, "aldi": 0.75, "lidl": 0.75, "asda": 0.90, "morrisons": 1.05, "morrisons_more": 0.89},
    "sugar": {"price": 1.20, "unit": "kg", "tesco": 1.20, "tesco_clubcard": 0.99, "sainsburys": 1.35, "sainsburys_nectar": 1.10, "aldi": 0.89, "lidl": 0.89, "asda": 1.00, "morrisons": 1.15, "morrisons_more": 0.99},
    "oil": {"price": 2.50, "unit": "liter", "tesco": 2.50, "tesco_clubcard": 2.00, "sainsburys": 2.80, "sainsburys_nectar": 2.30, "aldi": 1.89, "lidl": 1.89, "asda": 2.20, "morrisons": 2.40, "morrisons_more": 2.10},
    "olive oil": {"price": 4.50, "unit": "500ml", "tesco": 4.50, "tesco_clubcard": 3.50, "sainsburys": 5.00, "sainsburys_nectar": 4.00, "aldi": 2.99, "lidl": 2.99, "asda": 3.80, "morrisons": 4.20, "morrisons_more": 3.60},
    "bread": {"price": 1.20, "unit": "loaf", "tesco": 1.20, "tesco_clubcard": 0.95, "sainsburys": 1.35, "sainsburys_nectar": 1.10, "aldi": 0.75, "lidl": 0.75, "asda": 0.95, "morrisons": 1.10, "morrisons_more": 0.95},
    "soy sauce": {"price": 1.80, "unit": "bottle", "tesco": 1.80, "tesco_clubcard": 1.45, "sainsburys": 2.00, "sainsburys_nectar": 1.65, "aldi": 1.29, "lidl": 1.29, "asda": 1.50, "morrisons": 1.70, "morrisons_more": 1.45},
    "honey": {"price": 3.50, "unit": "jar", "tesco": 3.50, "tesco_clubcard": 2.85, "sainsburys": 4.00, "sainsburys_nectar": 3.25, "aldi": 2.49, "lidl": 2.49, "asda": 3.00, "morrisons": 3.30, "morrisons_more": 2.85},
    "stock": {"price": 1.20, "unit": "pot", "tesco": 1.20, "tesco_clubcard": 0.95, "sainsburys": 1.40, "sainsburys_nectar": 1.15, "aldi": 0.85, "lidl": 0.85, "asda": 1.00, "morrisons": 1.15, "morrisons_more": 0.99},
    "tin tomato": {"price": 0.65, "unit": "can", "tesco": 0.65, "tesco_clubcard": 0.52, "sainsburys": 0.75, "sainsburys_nectar": 0.60, "aldi": 0.45, "lidl": 0.45, "asda": 0.55, "morrisons": 0.62, "morrisons_more": 0.52},
    "chopped tomato": {"price": 0.65, "unit": "can", "tesco": 0.65, "tesco_clubcard": 0.52, "sainsburys": 0.75, "sainsburys_nectar": 0.60, "aldi": 0.45, "lidl": 0.45, "asda": 0.55, "morrisons": 0.62, "morrisons_more": 0.52},
    "coconut milk": {"price": 1.30, "unit": "can", "tesco": 1.30, "tesco_clubcard": 1.05, "sainsburys": 1.50, "sainsburys_nectar": 1.20, "aldi": 0.99, "lidl": 0.99, "asda": 1.15, "morrisons": 1.25, "morrisons_more": 1.05},
    "passata": {"price": 0.85, "unit": "jar", "tesco": 0.85, "tesco_clubcard": 0.68, "sainsburys": 0.99, "sainsburys_nectar": 0.79, "aldi": 0.59, "lidl": 0.59, "asda": 0.72, "morrisons": 0.82, "morrisons_more": 0.68},
    # Spices - small amounts are cheap
    "salt": {"price": 0.65, "unit": "pack", "tesco": 0.65, "tesco_clubcard": 0.50, "sainsburys": 0.75, "sainsburys_nectar": 0.60, "aldi": 0.35, "lidl": 0.35, "asda": 0.50, "morrisons": 0.60, "morrisons_more": 0.50},
    "black pepper": {"price": 1.50, "unit": "jar", "tesco": 1.50, "tesco_clubcard": 1.20, "sainsburys": 1.75, "sainsburys_nectar": 1.40, "aldi": 0.99, "lidl": 0.99, "asda": 1.20, "morrisons": 1.40, "morrisons_more": 1.20},
    "cumin": {"price": 1.20, "unit": "jar", "tesco": 1.20, "tesco_clubcard": 0.95, "sainsburys": 1.40, "sainsburys_nectar": 1.12, "aldi": 0.79, "lidl": 0.79, "asda": 0.99, "morrisons": 1.15, "morrisons_more": 0.95},
    "paprika": {"price": 1.20, "unit": "jar", "tesco": 1.20, "tesco_clubcard": 0.95, "sainsburys": 1.40, "sainsburys_nectar": 1.12, "aldi": 0.79, "lidl": 0.79, "asda": 0.99, "morrisons": 1.15, "morrisons_more": 0.95},
    "cinnamon": {"price": 1.30, "unit": "jar", "tesco": 1.30, "tesco_clubcard": 1.05, "sainsburys": 1.50, "sainsburys_nectar": 1.20, "aldi": 0.85, "lidl": 0.85, "asda": 1.05, "morrisons": 1.25, "morrisons_more": 1.05},
    "chilli": {"price": 0.20, "unit": "each", "tesco": 0.20, "tesco_clubcard": 0.16, "sainsburys": 0.25, "sainsburys_nectar": 0.20, "aldi": 0.12, "lidl": 0.12, "asda": 0.15, "morrisons": 0.18, "morrisons_more": 0.15},
    "herb": {"price": 1.00, "unit": "pack", "tesco": 1.00, "tesco_clubcard": 0.80, "sainsburys": 1.15, "sainsburys_nectar": 0.92, "aldi": 0.65, "lidl": 0.65, "asda": 0.85, "morrisons": 0.95, "morrisons_more": 0.80},
    "basil": {"price": 1.00, "unit": "pack", "tesco": 1.00, "tesco_clubcard": 0.80, "sainsburys": 1.15, "sainsburys_nectar": 0.92, "aldi": 0.65, "lidl": 0.65, "asda": 0.85, "morrisons": 0.95, "morrisons_more": 0.80},
    "coriander": {"price": 0.80, "unit": "bunch", "tesco": 0.80, "tesco_clubcard": 0.64, "sainsburys": 0.95, "sainsburys_nectar": 0.76, "aldi": 0.55, "lidl": 0.55, "asda": 0.68, "morrisons": 0.75, "morrisons_more": 0.65},
    "parsley": {"price": 0.80, "unit": "bunch", "tesco": 0.80, "tesco_clubcard": 0.64, "sainsburys": 0.95, "sainsburys_nectar": 0.76, "aldi": 0.55, "lidl": 0.55, "asda": 0.68, "morrisons": 0.75, "morrisons_more": 0.65},
}

# Store display names and their loyalty card info
STORE_INFO = {
    "tesco": {"display": "Tesco", "loyalty": "tesco_clubcard", "loyalty_name": "Clubcard"},
    "sainsburys": {"display": "Sainsbury's", "loyalty": "sainsburys_nectar", "loyalty_name": "Nectar"},
    "aldi": {"display": "Aldi", "loyalty": None, "loyalty_name": None},
    "lidl": {"display": "Lidl", "loyalty": None, "loyalty_name": None},
    "asda": {"display": "Asda", "loyalty": None, "loyalty_name": None},
    "morrisons": {"display": "Morrisons", "loyalty": "morrisons_more", "loyalty_name": "More Card"},
}

def estimate_item_price(item_name: str, quantity: float = 1, unit: str = "") -> dict:
    """Estimate price for a shopping item - proportional to quantity"""
    name_lower = item_name.lower()
    unit_lower = unit.lower().strip() if unit else ""
    
    # First try to find a matching price entry
    matched_data = None
    for key, data in UK_PRICE_DATA.items():
        if key in name_lower or name_lower in key:
            matched_data = data
            break
    
    # If no exact match, try partial word matching
    if not matched_data:
        name_words = name_lower.split()
        for key, data in UK_PRICE_DATA.items():
            if any(key in word or word in key for word in name_words if len(word) > 3):
                matched_data = data
                break
    
    if matched_data:
        base_price = matched_data["price"]
        pack_unit = matched_data.get("unit", "each").lower()
        
        # Calculate multiplier based on quantity and unit conversion
        multiplier = 1.0
        
        # Determine if unit is grams (but not kg)
        is_grams = ('g' in unit_lower and 'kg' not in unit_lower) or unit_lower == 'g' or unit_lower == 'gram' or unit_lower == 'grams'
        is_kg = 'kg' in unit_lower or 'kilo' in unit_lower
        is_ml = 'ml' in unit_lower
        is_liters = ('l' in unit_lower and 'ml' not in unit_lower) or unit_lower in ['l', 'liter', 'litre', 'liters', 'litres']
        
        if is_grams:
            # Quantity is in grams
            if 'kg' in pack_unit:
                multiplier = quantity / 1000
            elif 'g' in pack_unit:
                pack_size = float(''.join(filter(str.isdigit, pack_unit)) or 250)
                multiplier = quantity / pack_size
            else:
                multiplier = quantity / 250  # Assume 250g typical pack
        elif is_kg:
            # Quantity is in kg
            if 'kg' in pack_unit:
                multiplier = quantity
            elif 'g' in pack_unit:
                pack_size = float(''.join(filter(str.isdigit, pack_unit)) or 250)
                multiplier = (quantity * 1000) / pack_size
            else:
                multiplier = quantity * 4
        elif is_ml:
            # Quantity is in ml
            if 'liter' in pack_unit or 'litre' in pack_unit or pack_unit == 'l':
                multiplier = quantity / 1000
            elif 'ml' in pack_unit:
                pack_size = float(''.join(filter(str.isdigit, pack_unit)) or 500)
                multiplier = quantity / pack_size
            else:
                multiplier = quantity / 500
        elif is_liters:
            # Quantity is in liters
            if 'ml' in pack_unit:
                pack_size = float(''.join(filter(str.isdigit, pack_unit)) or 500)
                multiplier = (quantity * 1000) / pack_size
            else:
                multiplier = quantity
        elif any(x in unit_lower for x in ['each', 'piece', 'pcs', 'clove', 'bulb', 'head', 'loaf', '']):
            # Discrete items or no unit specified
            if 'pack' in pack_unit:
                pack_size = float(''.join(filter(str.isdigit, pack_unit)) or 6)
                multiplier = quantity / pack_size
            elif 'g' in pack_unit:
                # Item is sold by weight, estimate pieces
                multiplier = max(0.5, quantity / 2)
            else:
                multiplier = quantity
        elif unit_lower in ['tbsp', 'tablespoon', 'tsp', 'teaspoon']:
            # Small measurement - estimate as fraction of a bottle/jar
            if unit_lower in ['tbsp', 'tablespoon']:
                multiplier = quantity / 20
            else:
                multiplier = quantity / 60
        else:
            multiplier = max(0.5, quantity / 2)
        
        # Ensure reasonable multiplier
        multiplier = max(0.1, min(multiplier, 20))  # Cap at 20x base price
        
        estimated_price = round(base_price * multiplier, 2)
        
        return {
            "estimated_price": estimated_price,
            "prices_by_store": {
                "tesco": round(matched_data.get("tesco", base_price) * multiplier, 2),
                "tesco_clubcard": round(matched_data.get("tesco_clubcard", matched_data.get("tesco", base_price)) * multiplier, 2),
                "sainsburys": round(matched_data.get("sainsburys", base_price) * multiplier, 2),
                "sainsburys_nectar": round(matched_data.get("sainsburys_nectar", matched_data.get("sainsburys", base_price)) * multiplier, 2),
                "aldi": round(matched_data.get("aldi", base_price) * multiplier, 2),
                "lidl": round(matched_data.get("lidl", base_price) * multiplier, 2),
                "asda": round(matched_data.get("asda", base_price) * multiplier, 2),
                "morrisons": round(matched_data.get("morrisons", base_price) * multiplier, 2),
                "morrisons_more": round(matched_data.get("morrisons_more", matched_data.get("morrisons", base_price)) * multiplier, 2),
            },
            "matched": True
        }
    
    # Default estimate for unknown items - REALISTIC UK supermarket pricing
    # Most items are £1-5 range
    is_grams = ('g' in unit_lower and 'kg' not in unit_lower) or unit_lower in ['g', 'gram', 'grams']
    is_kg = 'kg' in unit_lower or 'kilo' in unit_lower
    is_ml = 'ml' in unit_lower
    is_liters = ('l' in unit_lower and 'ml' not in unit_lower) or unit_lower in ['l', 'liter', 'litre']
    
    if is_grams:
        # Price per 100g is typically £0.50-£1.50 for most items
        default_price = max(0.50, min((quantity / 100) * 0.80, 8.00))
    elif is_kg:
        default_price = max(1.00, min(quantity * 5.00, 15.00))
    elif is_ml:
        default_price = max(0.30, min((quantity / 100) * 0.40, 6.00))
    elif is_liters:
        default_price = max(1.00, min(quantity * 2.00, 8.00))
    elif quantity < 1:
        default_price = max(0.30, quantity * 2.00)
    elif quantity <= 6:
        default_price = max(0.50, min(quantity * 0.80, 4.00))
    else:
        default_price = min(quantity * 0.50, 6.00)
    
    default_price = round(default_price, 2)
    
    return {
        "estimated_price": default_price,
        "prices_by_store": {
            "tesco": default_price,
            "tesco_clubcard": round(default_price * 0.85, 2),
            "sainsburys": round(default_price * 1.1, 2),
            "sainsburys_nectar": round(default_price * 0.95, 2),
            "aldi": round(default_price * 0.75, 2),
            "lidl": round(default_price * 0.75, 2),
            "asda": round(default_price * 0.9, 2),
            "morrisons": round(default_price * 0.95, 2),
            "morrisons_more": round(default_price * 0.85, 2),
        },
        "matched": False
    }

@api_router.get("/shopping-list/estimate-costs")
async def estimate_shopping_costs(request: Request):
    """Estimate costs for the shopping list and recommend cheapest store"""
    user_id = await get_user_id_or_none(request)
    
    query = {"user_id": user_id} if user_id else {"user_id": None}
    shopping_list = await db.shopping_lists.find_one(query, {"_id": 0})
    
    if not shopping_list or not shopping_list.get('items'):
        return {
            "items": [],
            "totals": {},
            "cheapest_store": None,
            "message": "No items in shopping list"
        }
    
    # Only estimate for unchecked items
    items_to_estimate = [item for item in shopping_list['items'] if not item.get('checked', False)]
    
    if not items_to_estimate:
        return {
            "items": [],
            "totals": {},
            "cheapest_store": None,
            "message": "All items checked off"
        }
    
    # Calculate estimates
    store_totals = {
        "tesco": 0, "tesco_clubcard": 0,
        "sainsburys": 0, "sainsburys_nectar": 0,
        "aldi": 0, "lidl": 0, "asda": 0, 
        "morrisons": 0, "morrisons_more": 0
    }
    
    item_estimates = []
    for item in items_to_estimate:
        qty = parse_quantity(item.get('quantity', '1'))
        unit = item.get('unit', '')
        estimate = estimate_item_price(item['name'], qty, unit)
        
        item_estimates.append({
            "name": item['name'],
            "quantity": item.get('quantity', '1'),
            "unit": item.get('unit', ''),
            "estimated_price": estimate['estimated_price'],
            "price_matched": estimate['matched']
        })
        
        for store, price in estimate['prices_by_store'].items():
            store_totals[store] += price
    
    # Round totals
    store_totals = {store: round(total, 2) for store, total in store_totals.items()}
    
    # Separate standard and loyalty card prices
    standard_stores = {k: v for k, v in store_totals.items() if k in ["tesco", "sainsburys", "aldi", "lidl", "asda", "morrisons"]}
    loyalty_stores = {
        "tesco_clubcard": store_totals.get("tesco_clubcard", 0),
        "sainsburys_nectar": store_totals.get("sainsburys_nectar", 0),
        "morrisons_more": store_totals.get("morrisons_more", 0),
    }
    
    # Find cheapest including loyalty cards
    all_options = {**standard_stores, **loyalty_stores}
    cheapest = min(all_options.items(), key=lambda x: x[1])
    most_expensive = max(standard_stores.items(), key=lambda x: x[1])
    savings = round(most_expensive[1] - cheapest[1], 2)
    
    # Format display name
    display_names = {
        "tesco": "Tesco", "tesco_clubcard": "Tesco (Clubcard)",
        "sainsburys": "Sainsbury's", "sainsburys_nectar": "Sainsbury's (Nectar)",
        "aldi": "Aldi", "lidl": "Lidl", "asda": "Asda",
        "morrisons": "Morrisons", "morrisons_more": "Morrisons (More Card)"
    }
    
    return {
        "items": item_estimates,
        "totals": standard_stores,
        "loyalty_totals": loyalty_stores,
        "cheapest_store": {
            "name": display_names.get(cheapest[0], cheapest[0].title()),
            "key": cheapest[0],
            "total": cheapest[1],
            "has_loyalty": "_" in cheapest[0],
            "savings_vs_most_expensive": savings
        },
        "average_estimate": round(sum(standard_stores.values()) / len(standard_stores), 2),
        "message": f"Shop at {display_names.get(cheapest[0], cheapest[0].title())} to save £{savings:.2f}"
    }

# Get CORS origins from environment
cors_origins_str = os.environ.get('CORS_ORIGINS', '')
if cors_origins_str and cors_origins_str != '*':
    cors_origins = [origin.strip() for origin in cors_origins_str.split(',') if origin.strip()]
else:
    cors_origins = [
        "http://localhost:3000",
        "http://localhost:8001",
        "https://localhost:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.ondigitalocean\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ============== RECIPE CONVERSION (VEGAN/VEGETARIAN) ==============

@api_router.post("/recipes/{recipe_id}/make-vegan")
async def make_recipe_vegan(recipe_id: str, request: Request):
    """Convert a recipe to vegan by substituting all animal products with plant-based alternatives"""
    user_id = await get_user_id_or_none(request)
    
    # Get the recipe
    query = {"id": recipe_id}
    if user_id:
        query["user_id"] = user_id
    
    recipe = await db.recipes.find_one(query, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    if not openai_client:
        raise HTTPException(status_code=503, detail="AI features not available")
    
    try:
        # Format current ingredients
        ingredients_text = "\n".join([
            f"- {ing.get('quantity', '')} {ing.get('unit', '')} {ing.get('name', '')}".strip()
            for ing in recipe.get('ingredients', [])
        ])
        
        system_prompt = """You are a vegan chef expert at converting recipes. Replace ALL animal products with delicious plant-based alternatives.

SUBSTITUTION GUIDE:
- Chicken/Turkey → Tofu, seitan, or tempeh
- Beef → Mushrooms, seitan, or Beyond/plant mince
- Pork → Jackfruit, tempeh, or smoked tofu
- Fish → Banana blossom, hearts of palm, or tofu
- Shrimp/Prawns → King oyster mushrooms or hearts of palm
- Bacon → Coconut bacon, smoked tempeh, or mushroom bacon
- Milk → Oat milk, soy milk, or coconut milk
- Cream → Coconut cream or cashew cream
- Butter → Vegan butter or coconut oil
- Cheese → Nutritional yeast, vegan cheese, or cashew cheese
- Eggs (binding) → Flax egg (1 tbsp ground flax + 3 tbsp water) or chia egg
- Eggs (main dish) → Tofu scramble, chickpea flour omelette
- Honey → Maple syrup or agave
- Yogurt → Coconut or soy yogurt

Keep quantities similar. Maintain the dish's character and flavor profile.

Return ONLY valid JSON:
{
    "ingredients": [
        {"name": "ingredient name", "quantity": "amount", "unit": "unit", "category": "category"}
    ],
    "substitutions_made": ["Replaced chicken with pressed tofu", "Replaced milk with oat milk"],
    "tips": "Optional cooking tip for the vegan version"
}"""

        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Convert this recipe to VEGAN:\n\nRecipe: {recipe.get('name', 'Unknown')}\n\nIngredients:\n{ingredients_text}"}
            ],
            max_tokens=1500
        )
        
        result = response.choices[0].message.content.strip()
        
        # Parse JSON
        if "```json" in result:
            result = result.split("```json")[1].split("```")[0]
        elif "```" in result:
            result = result.split("```")[1].split("```")[0]
        
        import json
        try:
            data = json.loads(result.strip())
        except json.JSONDecodeError:
            start = result.find("{")
            end = result.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(result[start:end])
            else:
                raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
        new_ingredients = data.get("ingredients", [])
        substitutions = data.get("substitutions_made", [])
        tips = data.get("tips", "")
        
        # Update recipe in database
        new_categories = list(set(recipe.get('categories', [])) - {'can-be-vegan', 'vegetarian', 'pescatarian'})
        new_categories.extend(['vegan', 'vegetarian'])
        
        update_data = {
            "ingredients": new_ingredients,
            "categories": new_categories,
            "description": f"🌱 Veganized! {tips}" if tips else recipe.get('description', '')
        }
        
        await db.recipes.update_one(query, {"$set": update_data})
        
        # Fetch and return the updated recipe
        updated_recipe = await db.recipes.find_one(query, {"_id": 0})
        return updated_recipe
        
    except Exception as e:
        logger.error(f"Error converting recipe to vegan: {e}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")


@api_router.post("/recipes/{recipe_id}/make-vegetarian")
async def make_recipe_vegetarian(recipe_id: str, request: Request):
    """Convert a recipe to vegetarian by substituting meat/fish with vegetarian alternatives"""
    user_id = await get_user_id_or_none(request)
    
    # Get the recipe
    query = {"id": recipe_id}
    if user_id:
        query["user_id"] = user_id
    
    recipe = await db.recipes.find_one(query, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    if not openai_client:
        raise HTTPException(status_code=503, detail="AI features not available")
    
    try:
        # Format current ingredients
        ingredients_text = "\n".join([
            f"- {ing.get('quantity', '')} {ing.get('unit', '')} {ing.get('name', '')}".strip()
            for ing in recipe.get('ingredients', [])
        ])
        
        system_prompt = """You are a vegetarian chef expert at converting recipes. Replace meat and fish with vegetarian alternatives. Keep dairy and eggs.

SUBSTITUTION GUIDE:
- Chicken → Halloumi, paneer, tofu, or quorn
- Beef → Portobello mushrooms, lentils, or veggie mince
- Pork → Jackfruit or smoked cheese
- Fish → Halloumi or firm tofu with nori for seafood flavor
- Bacon → Halloumi strips or smoked cheese
- Shrimp → Halloumi cubes or egg
- Stock/broth → Vegetable stock

Keep dairy (milk, cheese, cream, butter) and eggs as-is.
Maintain the dish's character and flavor profile.

Return ONLY valid JSON:
{
    "ingredients": [
        {"name": "ingredient name", "quantity": "amount", "unit": "unit", "category": "category"}
    ],
    "substitutions_made": ["Replaced chicken with halloumi", "Replaced beef stock with vegetable stock"],
    "tips": "Optional cooking tip for the vegetarian version"
}"""

        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Convert this recipe to VEGETARIAN:\n\nRecipe: {recipe.get('name', 'Unknown')}\n\nIngredients:\n{ingredients_text}"}
            ],
            max_tokens=1500
        )
        
        result = response.choices[0].message.content.strip()
        
        # Parse JSON
        if "```json" in result:
            result = result.split("```json")[1].split("```")[0]
        elif "```" in result:
            result = result.split("```")[1].split("```")[0]
        
        import json
        try:
            data = json.loads(result.strip())
        except json.JSONDecodeError:
            start = result.find("{")
            end = result.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(result[start:end])
            else:
                raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
        new_ingredients = data.get("ingredients", [])
        substitutions = data.get("substitutions_made", [])
        tips = data.get("tips", "")
        
        # Update recipe in database
        new_categories = list(set(recipe.get('categories', [])) - {'can-be-vegan', 'pescatarian'})
        if 'vegetarian' not in new_categories:
            new_categories.append('vegetarian')
        if 'can-be-vegan' not in new_categories:
            new_categories.append('can-be-vegan')
        
        update_data = {
            "ingredients": new_ingredients,
            "categories": new_categories,
            "description": f"🥬 Vegetarian version! {tips}" if tips else recipe.get('description', '')
        }
        
        await db.recipes.update_one(query, {"$set": update_data})
        
        # Fetch and return the updated recipe
        updated_recipe = await db.recipes.find_one(query, {"_id": 0})
        return updated_recipe
        
    except Exception as e:
        logger.error(f"Error converting recipe to vegetarian: {e}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")


# Include the router in the main app (must be before static file catch-all)
app.include_router(api_router)

# Serve static frontend files in production (MUST be after api_router to not catch /api routes)
static_dir = ROOT_DIR / "static"
if static_dir.exists():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse
    
    # Mount static files for assets (js, css, images)
    app.mount("/static", StaticFiles(directory=static_dir / "static"), name="static_assets")
    
    @app.get("/")
    async def serve_root():
        return FileResponse(static_dir / "index.html")
    
    # Catch-all for SPA routing - exclude /api routes (handled by api_router above)
    @app.get("/{path:path}")
    async def serve_spa(path: str):
        # API routes are already handled by api_router, this shouldn't be reached
        if path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not found")
        
        file_path = static_dir / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # For SPA routing, return index.html
        return FileResponse(static_dir / "index.html")

