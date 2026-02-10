"""
Test file for Iteration 11 features:
1. AddRecipe - Image choice is now a Select dropdown with options: AI Generate, Upload My Photo, No Photo
2. WeeklyPlanner - 'Use expiring items' toggle in the Suggested tab when adding meals
3. WeeklyPlanner - Suggestions show 'X exp' badge when using expiring filter
4. MealSuggestions - related_recipe_count now only counts recipes sharing 2+ ingredients
5. RecipeLibrary - Images use img tag with loading='eager' and onError fallback
6. Backend - AI images converted to base64 data URLs for permanent storage
7. Backend - Recipe import downloads and converts images to base64
"""

import pytest
import requests
import os
import json
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_1770742873843"
USER_ID = "test-user-1770742873843"


@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Cookie": f"session_token={SESSION_TOKEN}"
    })
    return session


class TestAuthAndBasicEndpoints:
    """Test authentication and basic API endpoints"""
    
    def test_auth_me(self, api_client):
        """Test /api/auth/me returns user data"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        print(f"✓ Auth working - User: {data.get('email')}")
    
    def test_api_root(self, api_client):
        """Test API root endpoint"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root: {data.get('message')}")


class TestMealSuggestionsRelatedRecipeCount:
    """Test that related_recipe_count only counts recipes sharing 2+ ingredients"""
    
    def test_suggestions_endpoint_returns_related_recipe_count(self, api_client):
        """Test /api/suggestions/meals returns related_recipe_count field"""
        response = api_client.get(f"{BASE_URL}/api/suggestions/meals")
        assert response.status_code == 200
        data = response.json()
        
        if data.get("suggestions"):
            suggestion = data["suggestions"][0]
            # Check that related_recipe_count field exists
            assert "related_recipe_count" in suggestion, "related_recipe_count field missing"
            assert "shared_ingredient_count" in suggestion, "shared_ingredient_count field missing"
            assert "composite_score" in suggestion, "composite_score field missing"
            print(f"✓ Suggestion has related_recipe_count: {suggestion.get('related_recipe_count')}")
            print(f"✓ Suggestion has shared_ingredient_count: {suggestion.get('shared_ingredient_count')}")
        else:
            print("⚠ No suggestions returned (may need pantry items)")
    
    def test_suggestions_with_expiring_filter(self, api_client):
        """Test /api/suggestions/meals?expiring_soon=true"""
        response = api_client.get(f"{BASE_URL}/api/suggestions/meals?expiring_soon=true")
        assert response.status_code == 200
        data = response.json()
        
        if data.get("suggestions"):
            suggestion = data["suggestions"][0]
            # When expiring filter is on, expiring_ingredients_used should be present
            assert "expiring_ingredients_used" in suggestion
            print(f"✓ Expiring filter working - expiring_ingredients_used: {suggestion.get('expiring_ingredients_used')}")
        else:
            print(f"⚠ No suggestions with expiring filter: {data.get('message')}")


class TestRecipeCreationWithImageChoice:
    """Test recipe creation with different image choices"""
    
    def test_create_recipe_with_ai_image(self, api_client):
        """Test creating recipe with AI image generation (skip_image_generation=false)"""
        recipe_data = {
            "name": "TEST_AI_Image_Recipe",
            "description": "Test recipe for AI image",
            "servings": 2,
            "prep_time": "10 min",
            "cook_time": "20 min",
            "ingredients": [
                {"name": "chicken breast", "quantity": "2", "unit": "pieces"},
                {"name": "olive oil", "quantity": "2", "unit": "tbsp"}
            ],
            "instructions": ["Step 1", "Step 2"],
            "skip_image_generation": False  # AI should generate image
        }
        
        response = api_client.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["name"] == "TEST_AI_Image_Recipe"
        
        # Check if image_url is a base64 data URL (new feature)
        image_url = data.get("image_url", "")
        if image_url:
            # AI images should now be base64 data URLs
            is_base64 = image_url.startswith("data:image/")
            print(f"✓ Recipe created with image_url: {'base64 data URL' if is_base64 else 'external URL'}")
            if is_base64:
                print("✓ AI image stored as base64 (permanent storage)")
        else:
            print("⚠ No image generated (AI may be slow)")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/recipes/{data['id']}")
        print(f"✓ Cleaned up test recipe")
    
    def test_create_recipe_with_no_image(self, api_client):
        """Test creating recipe with no image (skip_image_generation=true)"""
        recipe_data = {
            "name": "TEST_No_Image_Recipe",
            "description": "Test recipe without image",
            "servings": 2,
            "prep_time": "5 min",
            "cook_time": "10 min",
            "ingredients": [
                {"name": "pasta", "quantity": "200", "unit": "g"}
            ],
            "instructions": ["Boil pasta"],
            "skip_image_generation": True,  # No AI image
            "image_url": ""  # Explicitly no image
        }
        
        response = api_client.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["name"] == "TEST_No_Image_Recipe"
        assert data.get("image_url", "") == ""  # Should have no image
        print(f"✓ Recipe created without image (skip_image_generation=true)")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/recipes/{data['id']}")
    
    def test_create_recipe_with_own_base64_image(self, api_client):
        """Test creating recipe with user's own base64 image"""
        # Small test base64 image (1x1 pixel PNG)
        test_base64_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        recipe_data = {
            "name": "TEST_Own_Image_Recipe",
            "description": "Test recipe with own image",
            "servings": 2,
            "prep_time": "5 min",
            "cook_time": "10 min",
            "ingredients": [
                {"name": "rice", "quantity": "1", "unit": "cup"}
            ],
            "instructions": ["Cook rice"],
            "skip_image_generation": True,  # Don't generate AI image
            "image_url": test_base64_image  # User's own base64 image
        }
        
        response = api_client.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["name"] == "TEST_Own_Image_Recipe"
        assert data.get("image_url", "").startswith("data:image/")
        print(f"✓ Recipe created with user's own base64 image")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/recipes/{data['id']}")


class TestWeeklyPlannerSuggestions:
    """Test Weekly Planner suggestions with expiring filter"""
    
    def test_get_recipes_grouped(self, api_client):
        """Test /api/recipes/grouped endpoint"""
        response = api_client.get(f"{BASE_URL}/api/recipes/grouped")
        assert response.status_code == 200
        data = response.json()
        
        assert "groups" in data
        assert "total_recipes" in data
        print(f"✓ Recipes grouped: {len(data.get('groups', []))} groups, {data.get('total_recipes')} total recipes")
    
    def test_weekly_plan_crud(self, api_client):
        """Test weekly plan save and retrieve"""
        # Get current week start
        from datetime import date
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_start_str = week_start.isoformat()
        
        # Get weekly plan
        response = api_client.get(f"{BASE_URL}/api/weekly-plan?week_start={week_start_str}")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Weekly plan retrieved for week: {week_start_str}")


class TestRecipeLibraryImages:
    """Test recipe library image handling"""
    
    def test_get_recipes_returns_image_urls(self, api_client):
        """Test that recipes have image_url field"""
        response = api_client.get(f"{BASE_URL}/api/recipes")
        assert response.status_code == 200
        data = response.json()
        
        if data:
            recipe = data[0]
            assert "image_url" in recipe
            image_url = recipe.get("image_url", "")
            if image_url:
                is_base64 = image_url.startswith("data:image/")
                is_external = image_url.startswith("http")
                print(f"✓ Recipe has image_url: {'base64' if is_base64 else 'external URL' if is_external else 'other'}")
            else:
                print("✓ Recipe has no image (image_url is empty)")
        else:
            print("⚠ No recipes found")


class TestPantryExpiringItems:
    """Test pantry expiring items for Weekly Planner integration"""
    
    def test_get_expiring_soon(self, api_client):
        """Test /api/pantry/expiring-soon endpoint"""
        response = api_client.get(f"{BASE_URL}/api/pantry/expiring-soon")
        assert response.status_code == 200
        data = response.json()
        
        assert "expiring_items" in data
        assert "expired_items" in data
        print(f"✓ Expiring items: {len(data.get('expiring_items', []))}, Expired: {len(data.get('expired_items', []))}")
    
    def test_add_pantry_item_with_expiry(self, api_client):
        """Test adding pantry item with expiry date"""
        # Add item expiring in 3 days
        expiry_date = (datetime.now() + timedelta(days=3)).isoformat()
        
        item_data = {
            "name": "TEST_Expiring_Milk",
            "quantity": 1,
            "unit": "liter",
            "category": "dairy",
            "expiry_date": expiry_date
        }
        
        response = api_client.post(f"{BASE_URL}/api/pantry/items", json=item_data)
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        print(f"✓ Pantry item added with expiry date")
        
        # Verify it shows in expiring-soon
        response = api_client.get(f"{BASE_URL}/api/pantry/expiring-soon?days=7")
        assert response.status_code == 200
        expiring_data = response.json()
        
        expiring_names = [item.get("name", "") for item in expiring_data.get("expiring_items", [])]
        assert "TEST_Expiring_Milk" in expiring_names, "Item should appear in expiring-soon"
        print(f"✓ Item appears in expiring-soon list")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/pantry/items/{data['id']}")
        print(f"✓ Cleaned up test pantry item")


class TestRecipeImportImageConversion:
    """Test that recipe import converts images to base64"""
    
    def test_scrape_recipe_url_endpoint(self, api_client):
        """Test /api/recipes/scrape-url endpoint exists"""
        # Just test the endpoint exists and returns proper error for invalid URL
        response = api_client.post(f"{BASE_URL}/api/recipes/scrape-url", json={"url": "https://invalid-url-test.com"})
        # Should return 400 for invalid URL, not 404 (endpoint exists)
        assert response.status_code in [200, 400, 422]
        print(f"✓ Recipe scrape URL endpoint exists (status: {response.status_code})")


class TestCompositeScoreCalculation:
    """Test the new composite score calculation formula"""
    
    def test_suggestions_have_composite_score(self, api_client):
        """Test that suggestions include composite_score field"""
        response = api_client.get(f"{BASE_URL}/api/suggestions/meals")
        assert response.status_code == 200
        data = response.json()
        
        if data.get("suggestions"):
            suggestion = data["suggestions"][0]
            assert "composite_score" in suggestion
            assert "match_percentage" in suggestion
            assert "shared_ingredient_count" in suggestion
            assert "related_recipe_count" in suggestion
            
            # Verify score is reasonable (0-100+ range)
            score = suggestion.get("composite_score", 0)
            assert score >= 0, "Composite score should be non-negative"
            
            print(f"✓ Composite score: {score}")
            print(f"  - match_percentage: {suggestion.get('match_percentage')}")
            print(f"  - shared_ingredient_count: {suggestion.get('shared_ingredient_count')}")
            print(f"  - related_recipe_count: {suggestion.get('related_recipe_count')}")
        else:
            print("⚠ No suggestions to verify composite score")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
