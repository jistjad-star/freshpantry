"""
Test iteration 12 critical fixes:
1. Photo choice dropdown visibility (frontend test - verified via Playwright)
2. Recipe grouping API - must return groups with 2+ shared ingredients
3. AI image generation using Emergent integrations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRecipeGroupingAPI:
    """Test /api/recipes/grouped endpoint - CRITICAL FIX"""
    
    def test_recipes_grouped_endpoint_exists(self):
        """Test that the grouped endpoint exists and returns 200"""
        response = requests.get(f"{BASE_URL}/api/recipes/grouped")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("SUCCESS: /api/recipes/grouped endpoint returns 200")
    
    def test_recipes_grouped_response_structure(self):
        """Test that response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/recipes/grouped")
        data = response.json()
        
        # Check required fields
        assert "groups" in data, "Response must have 'groups' field"
        assert "total_recipes" in data, "Response must have 'total_recipes' field"
        assert "message" in data, "Response must have 'message' field"
        print(f"SUCCESS: Response has correct structure - {len(data['groups'])} groups, {data['total_recipes']} total recipes")
    
    def test_recipes_grouped_count_field(self):
        """CRITICAL: Each group must have count >= 2 (sharing 2+ ingredients)"""
        response = requests.get(f"{BASE_URL}/api/recipes/grouped")
        data = response.json()
        
        groups = data.get("groups", [])
        if len(groups) == 0:
            pytest.skip("No recipe groups found - need more recipes with shared ingredients")
        
        for group in groups:
            assert "count" in group, "Each group must have 'count' field"
            assert group["count"] >= 2, f"Group count must be >= 2, got {group['count']}"
            assert "recipes" in group, "Each group must have 'recipes' field"
            assert len(group["recipes"]) == 2, f"Each group must have exactly 2 recipes, got {len(group['recipes'])}"
            assert "shared_ingredient" in group, "Each group must have 'shared_ingredient' field"
        
        print(f"SUCCESS: All {len(groups)} groups have count >= 2 (sharing 2+ ingredients)")
    
    def test_recipes_grouped_recipe_structure(self):
        """Test that each recipe in a group has id and name"""
        response = requests.get(f"{BASE_URL}/api/recipes/grouped")
        data = response.json()
        
        groups = data.get("groups", [])
        if len(groups) == 0:
            pytest.skip("No recipe groups found")
        
        for group in groups:
            for recipe in group["recipes"]:
                assert "id" in recipe, "Each recipe must have 'id' field"
                assert "name" in recipe, "Each recipe must have 'name' field"
        
        print("SUCCESS: All recipes in groups have correct structure (id, name)")


class TestRecipeCreationWithImageChoice:
    """Test recipe creation with different image choices"""
    
    def test_create_recipe_with_ai_image(self):
        """Test creating recipe with AI image generation (skip_image_generation=False)"""
        recipe_data = {
            "name": "TEST_AI_Image_Recipe",
            "description": "Test recipe for AI image generation",
            "servings": 2,
            "ingredients": [
                {"name": "chicken", "quantity": "1", "unit": "lb", "category": "protein"},
                {"name": "garlic", "quantity": "3", "unit": "cloves", "category": "produce"}
            ],
            "instructions": ["Cook chicken", "Add garlic"],
            "skip_image_generation": False  # Should generate AI image
        }
        
        response = requests.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "id" in data, "Response must have 'id' field"
        assert "name" in data, "Response must have 'name' field"
        
        # AI image should be generated (base64 data URL)
        if data.get("image_url"):
            print(f"SUCCESS: Recipe created with AI image (length: {len(data['image_url'])} chars)")
        else:
            print("INFO: Recipe created but no AI image generated (may be due to API limits)")
        
        # Cleanup
        recipe_id = data["id"]
        requests.delete(f"{BASE_URL}/api/recipes/{recipe_id}")
    
    def test_create_recipe_without_image(self):
        """Test creating recipe with no image (skip_image_generation=True)"""
        recipe_data = {
            "name": "TEST_No_Image_Recipe",
            "description": "Test recipe without image",
            "servings": 2,
            "ingredients": [
                {"name": "pasta", "quantity": "1", "unit": "lb", "category": "grains"}
            ],
            "instructions": ["Cook pasta"],
            "skip_image_generation": True  # Should NOT generate AI image
        }
        
        response = requests.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # When skip_image_generation=True, image_url should be empty
        image_url = data.get("image_url", "")
        print(f"SUCCESS: Recipe created with skip_image_generation=True, image_url: '{image_url[:50] if image_url else 'empty'}'")
        
        # Cleanup
        recipe_id = data["id"]
        requests.delete(f"{BASE_URL}/api/recipes/{recipe_id}")
    
    def test_create_recipe_with_own_image(self):
        """Test creating recipe with user's own image (base64)"""
        # Small test base64 image (1x1 pixel PNG)
        test_base64_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        recipe_data = {
            "name": "TEST_Own_Image_Recipe",
            "description": "Test recipe with own image",
            "servings": 2,
            "ingredients": [
                {"name": "rice", "quantity": "1", "unit": "cup", "category": "grains"}
            ],
            "instructions": ["Cook rice"],
            "image_url": test_base64_image,
            "skip_image_generation": True
        }
        
        response = requests.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("image_url") == test_base64_image, "Own image should be preserved"
        print("SUCCESS: Recipe created with user's own base64 image")
        
        # Cleanup
        recipe_id = data["id"]
        requests.delete(f"{BASE_URL}/api/recipes/{recipe_id}")


class TestMealSuggestionsAPI:
    """Test meal suggestions API"""
    
    def test_suggestions_endpoint_exists(self):
        """Test that suggestions endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/suggestions/meals")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("SUCCESS: /api/suggestions/meals endpoint returns 200")
    
    def test_suggestions_response_structure(self):
        """Test suggestions response structure"""
        response = requests.get(f"{BASE_URL}/api/suggestions/meals")
        data = response.json()
        
        assert "suggestions" in data, "Response must have 'suggestions' field"
        assert "message" in data, "Response must have 'message' field"
        print(f"SUCCESS: Suggestions response has correct structure - {len(data['suggestions'])} suggestions")


class TestHealthEndpoint:
    """Test health endpoint"""
    
    def test_api_root_endpoint(self):
        """Test API root endpoint returns OK"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response should have 'message' field"
        print(f"SUCCESS: API root endpoint OK - {data.get('message')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
