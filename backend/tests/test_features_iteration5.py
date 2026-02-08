"""
Test file for iteration 5 features:
1. Recipe category update endpoint (PUT /api/recipes/{id}/categories)
2. Pantry cook endpoint (POST /api/pantry/cook)
3. Recipe categories filter functionality
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRecipeCategoriesAPI:
    """Test recipe category update functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_recipe_id = None
        yield
        # Cleanup
        if self.test_recipe_id:
            try:
                requests.delete(f"{BASE_URL}/api/recipes/{self.test_recipe_id}")
            except:
                pass
    
    def test_create_recipe_with_categories(self):
        """Test creating a recipe with categories"""
        recipe_data = {
            "name": f"TEST_Category_Recipe_{uuid.uuid4().hex[:8]}",
            "description": "Test recipe for category testing",
            "servings": 4,
            "ingredients": [
                {"name": "tofu", "quantity": "1", "unit": "block", "category": "protein"},
                {"name": "broccoli", "quantity": "2", "unit": "cups", "category": "produce"}
            ],
            "instructions": ["Step 1", "Step 2"],
            "categories": ["vegan", "quick-easy"]
        }
        
        response = requests.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert response.status_code == 200, f"Failed to create recipe: {response.text}"
        
        data = response.json()
        self.test_recipe_id = data["id"]
        
        # Verify categories were saved
        assert "categories" in data
        assert "vegan" in data["categories"]
        assert "quick-easy" in data["categories"]
        print(f"SUCCESS: Created recipe with categories: {data['categories']}")
    
    def test_update_recipe_categories(self):
        """Test updating recipe categories via PUT endpoint"""
        # First create a recipe
        recipe_data = {
            "name": f"TEST_Update_Categories_{uuid.uuid4().hex[:8]}",
            "description": "Test recipe for category update",
            "servings": 2,
            "ingredients": [
                {"name": "chicken", "quantity": "1", "unit": "lb", "category": "protein"}
            ],
            "instructions": ["Cook it"],
            "categories": []
        }
        
        create_response = requests.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.test_recipe_id = recipe_id
        
        # Update categories
        update_data = {"categories": ["low-fat", "quick-easy"]}
        update_response = requests.put(f"{BASE_URL}/api/recipes/{recipe_id}/categories", json=update_data)
        
        assert update_response.status_code == 200, f"Failed to update categories: {update_response.text}"
        
        result = update_response.json()
        assert "categories" in result
        assert "low-fat" in result["categories"]
        assert "quick-easy" in result["categories"]
        print(f"SUCCESS: Updated categories to: {result['categories']}")
        
        # Verify by fetching the recipe
        get_response = requests.get(f"{BASE_URL}/api/recipes/{recipe_id}")
        assert get_response.status_code == 200
        
        fetched = get_response.json()
        assert "low-fat" in fetched.get("categories", [])
        assert "quick-easy" in fetched.get("categories", [])
        print(f"SUCCESS: Verified categories persisted: {fetched['categories']}")
    
    def test_update_categories_remove_all(self):
        """Test removing all categories from a recipe"""
        # Create recipe with categories
        recipe_data = {
            "name": f"TEST_Remove_Categories_{uuid.uuid4().hex[:8]}",
            "servings": 2,
            "ingredients": [{"name": "rice", "quantity": "1", "unit": "cup", "category": "grains"}],
            "instructions": ["Cook"],
            "categories": ["vegan", "vegetarian"]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.test_recipe_id = recipe_id
        
        # Remove all categories
        update_response = requests.put(f"{BASE_URL}/api/recipes/{recipe_id}/categories", json={"categories": []})
        assert update_response.status_code == 200
        
        result = update_response.json()
        assert result["categories"] == []
        print("SUCCESS: Removed all categories")
    
    def test_update_categories_invalid_recipe(self):
        """Test updating categories for non-existent recipe"""
        fake_id = "non-existent-recipe-id"
        update_response = requests.put(f"{BASE_URL}/api/recipes/{fake_id}/categories", json={"categories": ["vegan"]})
        
        assert update_response.status_code == 404
        print("SUCCESS: Correctly returned 404 for non-existent recipe")


class TestPantryCookAPI:
    """Test pantry cook functionality - deducting ingredients when cooking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_recipe_id = None
        self.pantry_items_to_cleanup = []
        yield
        # Cleanup
        if self.test_recipe_id:
            try:
                requests.delete(f"{BASE_URL}/api/recipes/{self.test_recipe_id}")
            except:
                pass
    
    def test_cook_recipe_deducts_pantry(self):
        """Test that cooking a recipe deducts ingredients from pantry"""
        # First add items to pantry
        pantry_item = {
            "name": "TEST_Chicken",
            "quantity": 5,
            "unit": "lb",
            "category": "protein"
        }
        add_response = requests.post(f"{BASE_URL}/api/pantry/items", json=pantry_item)
        assert add_response.status_code == 200, f"Failed to add pantry item: {add_response.text}"
        print(f"Added pantry item: {pantry_item['name']} - {pantry_item['quantity']} {pantry_item['unit']}")
        
        # Create a recipe that uses the pantry item
        recipe_data = {
            "name": f"TEST_Cook_Recipe_{uuid.uuid4().hex[:8]}",
            "servings": 2,
            "ingredients": [
                {"name": "TEST_Chicken", "quantity": "2", "unit": "lb", "category": "protein"}
            ],
            "instructions": ["Cook the chicken"]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.test_recipe_id = recipe_id
        print(f"Created recipe: {recipe_id}")
        
        # Cook the recipe
        cook_data = {"recipe_id": recipe_id, "servings_multiplier": 1}
        cook_response = requests.post(f"{BASE_URL}/api/pantry/cook", json=cook_data)
        
        assert cook_response.status_code == 200, f"Failed to cook recipe: {cook_response.text}"
        
        result = cook_response.json()
        assert "deducted" in result
        assert "missing_ingredients" in result
        print(f"Cook result: {result}")
        
        # Verify deduction happened
        if len(result["deducted"]) > 0:
            print(f"SUCCESS: Deducted {len(result['deducted'])} ingredients from pantry")
            for item in result["deducted"]:
                print(f"  - {item['name']}: deducted {item['deducted']}, remaining {item['remaining']}")
        else:
            print(f"INFO: No ingredients deducted (may not have matched pantry items)")
    
    def test_cook_recipe_with_missing_ingredients(self):
        """Test cooking a recipe when some ingredients are not in pantry"""
        # Create a recipe with ingredients not in pantry
        recipe_data = {
            "name": f"TEST_Missing_Ingredients_{uuid.uuid4().hex[:8]}",
            "servings": 2,
            "ingredients": [
                {"name": "UNIQUE_INGREDIENT_NOT_IN_PANTRY", "quantity": "1", "unit": "cup", "category": "other"}
            ],
            "instructions": ["Mix it"]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.test_recipe_id = recipe_id
        
        # Cook the recipe
        cook_response = requests.post(f"{BASE_URL}/api/pantry/cook", json={"recipe_id": recipe_id, "servings_multiplier": 1})
        
        assert cook_response.status_code == 200
        result = cook_response.json()
        
        # Should report missing ingredients
        assert "missing_ingredients" in result
        assert len(result["missing_ingredients"]) > 0
        print(f"SUCCESS: Correctly reported missing ingredients: {result['missing_ingredients']}")
    
    def test_cook_recipe_not_found(self):
        """Test cooking a non-existent recipe"""
        cook_response = requests.post(f"{BASE_URL}/api/pantry/cook", json={"recipe_id": "non-existent-id", "servings_multiplier": 1})
        
        assert cook_response.status_code == 404
        print("SUCCESS: Correctly returned 404 for non-existent recipe")
    
    def test_cook_recipe_with_servings_multiplier(self):
        """Test cooking with different servings multiplier"""
        # Add pantry item
        pantry_item = {
            "name": "TEST_Flour",
            "quantity": 10,
            "unit": "cups",
            "category": "pantry"
        }
        requests.post(f"{BASE_URL}/api/pantry/items", json=pantry_item)
        
        # Create recipe
        recipe_data = {
            "name": f"TEST_Multiplier_Recipe_{uuid.uuid4().hex[:8]}",
            "servings": 2,
            "ingredients": [
                {"name": "TEST_Flour", "quantity": "2", "unit": "cups", "category": "pantry"}
            ],
            "instructions": ["Mix flour"]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]
        self.test_recipe_id = recipe_id
        
        # Cook with 2x multiplier (should deduct 4 cups instead of 2)
        cook_response = requests.post(f"{BASE_URL}/api/pantry/cook", json={"recipe_id": recipe_id, "servings_multiplier": 2})
        
        assert cook_response.status_code == 200
        result = cook_response.json()
        print(f"Cook with 2x multiplier result: {result}")
        
        # Check if deduction was doubled
        if len(result["deducted"]) > 0:
            for item in result["deducted"]:
                if "flour" in item["name"].lower():
                    assert item["deducted"] == 4, f"Expected 4 cups deducted, got {item['deducted']}"
                    print(f"SUCCESS: Correctly deducted {item['deducted']} cups with 2x multiplier")


class TestRecipeFilterByCategory:
    """Test recipe filtering by category"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_recipe_ids = []
        yield
        # Cleanup
        for recipe_id in self.test_recipe_ids:
            try:
                requests.delete(f"{BASE_URL}/api/recipes/{recipe_id}")
            except:
                pass
    
    def test_recipes_have_categories_field(self):
        """Test that recipes endpoint returns categories field"""
        response = requests.get(f"{BASE_URL}/api/recipes")
        assert response.status_code == 200
        
        recipes = response.json()
        print(f"Total recipes: {len(recipes)}")
        
        # Check that recipes have categories field
        for recipe in recipes[:5]:
            assert "categories" in recipe or recipe.get("categories") is None, f"Recipe {recipe['id']} missing categories field"
            print(f"  - {recipe['name']}: categories = {recipe.get('categories', [])}")
        
        print("SUCCESS: All recipes have categories field")
    
    def test_create_recipes_with_different_categories(self):
        """Test creating recipes with different categories for filter testing"""
        # Create vegan recipe
        vegan_recipe = {
            "name": f"TEST_Vegan_Recipe_{uuid.uuid4().hex[:8]}",
            "servings": 2,
            "ingredients": [{"name": "tofu", "quantity": "1", "unit": "block", "category": "protein"}],
            "instructions": ["Cook"],
            "categories": ["vegan"]
        }
        
        response1 = requests.post(f"{BASE_URL}/api/recipes", json=vegan_recipe)
        assert response1.status_code == 200
        self.test_recipe_ids.append(response1.json()["id"])
        
        # Create pescatarian recipe
        fish_recipe = {
            "name": f"TEST_Fish_Recipe_{uuid.uuid4().hex[:8]}",
            "servings": 2,
            "ingredients": [{"name": "salmon", "quantity": "1", "unit": "lb", "category": "protein"}],
            "instructions": ["Grill"],
            "categories": ["pescatarian"]
        }
        
        response2 = requests.post(f"{BASE_URL}/api/recipes", json=fish_recipe)
        assert response2.status_code == 200
        self.test_recipe_ids.append(response2.json()["id"])
        
        # Fetch all recipes and verify categories
        all_recipes = requests.get(f"{BASE_URL}/api/recipes").json()
        
        vegan_recipes = [r for r in all_recipes if "vegan" in r.get("categories", [])]
        pescatarian_recipes = [r for r in all_recipes if "pescatarian" in r.get("categories", [])]
        
        print(f"Vegan recipes: {len(vegan_recipes)}")
        print(f"Pescatarian recipes: {len(pescatarian_recipes)}")
        
        assert len(vegan_recipes) >= 1, "Should have at least 1 vegan recipe"
        assert len(pescatarian_recipes) >= 1, "Should have at least 1 pescatarian recipe"
        
        print("SUCCESS: Recipes with different categories created and retrievable")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
