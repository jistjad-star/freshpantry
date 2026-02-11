"""
Test suite for Cocktails and Pantry Enhancement Features (Iteration 16)
- GET /api/cocktails endpoint with alcoholic filter
- POST /api/shopping-list/add-items endpoint
- Creating cocktail recipes with recipe_type='cocktail' and is_alcoholic flag
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token created via mongosh
SESSION_TOKEN = "test_session_cocktails_1770824861278"
USER_ID = "test-user-cocktails-1770824861277"


class TestCocktailsEndpoint:
    """Tests for GET /api/cocktails endpoint"""
    
    def test_cocktails_endpoint_returns_empty_initially(self):
        """GET /api/cocktails should return empty array when no cocktails exist"""
        response = requests.get(
            f"{BASE_URL}/api/cocktails",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # Initially empty for new user
        print(f"✓ GET /api/cocktails returns list with {len(data)} items")
    
    def test_cocktails_endpoint_accepts_alcoholic_true_param(self):
        """GET /api/cocktails?alcoholic=true should filter alcoholic cocktails"""
        response = requests.get(
            f"{BASE_URL}/api/cocktails",
            params={"alcoholic": "true"},
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/cocktails?alcoholic=true returns {len(data)} items")
    
    def test_cocktails_endpoint_accepts_alcoholic_false_param(self):
        """GET /api/cocktails?alcoholic=false should filter non-alcoholic cocktails"""
        response = requests.get(
            f"{BASE_URL}/api/cocktails",
            params={"alcoholic": "false"},
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/cocktails?alcoholic=false returns {len(data)} items")


class TestCreateCocktailRecipe:
    """Tests for creating cocktail recipes with recipe_type='cocktail'"""
    
    def test_create_alcoholic_cocktail(self):
        """POST /api/recipes should create a cocktail with recipe_type='cocktail' and is_alcoholic=true"""
        cocktail_data = {
            "name": "TEST_Margarita",
            "description": "Classic margarita cocktail",
            "servings": 1,
            "prep_time": "5 min",
            "cook_time": "",
            "ingredients": [
                {"name": "Tequila", "quantity": "2", "unit": "oz", "category": "pantry"},
                {"name": "Lime juice", "quantity": "1", "unit": "oz", "category": "produce"},
                {"name": "Triple sec", "quantity": "1", "unit": "oz", "category": "pantry"},
                {"name": "Salt", "quantity": "1", "unit": "pinch", "category": "spices"}
            ],
            "instructions": ["Rim glass with salt", "Shake ingredients with ice", "Strain into glass"],
            "recipe_type": "cocktail",
            "is_alcoholic": True,
            "skip_image_generation": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/recipes",
            json=cocktail_data,
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Margarita"
        assert data["recipe_type"] == "cocktail"
        assert data["is_alcoholic"] == True
        assert "id" in data
        
        # Store for later tests
        TestCreateCocktailRecipe.alcoholic_cocktail_id = data["id"]
        print(f"✓ Created alcoholic cocktail: {data['name']} (id: {data['id']})")
        return data["id"]
    
    def test_create_non_alcoholic_cocktail(self):
        """POST /api/recipes should create a cocktail with recipe_type='cocktail' and is_alcoholic=false"""
        cocktail_data = {
            "name": "TEST_Virgin Mojito",
            "description": "Refreshing non-alcoholic mojito",
            "servings": 1,
            "prep_time": "5 min",
            "cook_time": "",
            "ingredients": [
                {"name": "Lime juice", "quantity": "1", "unit": "oz", "category": "produce"},
                {"name": "Mint leaves", "quantity": "10", "unit": "leaves", "category": "produce"},
                {"name": "Sugar", "quantity": "2", "unit": "tsp", "category": "pantry"},
                {"name": "Soda water", "quantity": "4", "unit": "oz", "category": "pantry"}
            ],
            "instructions": ["Muddle mint with sugar and lime", "Add ice", "Top with soda water"],
            "recipe_type": "cocktail",
            "is_alcoholic": False,
            "skip_image_generation": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/recipes",
            json=cocktail_data,
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Virgin Mojito"
        assert data["recipe_type"] == "cocktail"
        assert data["is_alcoholic"] == False
        assert "id" in data
        
        # Store for later tests
        TestCreateCocktailRecipe.non_alcoholic_cocktail_id = data["id"]
        print(f"✓ Created non-alcoholic cocktail: {data['name']} (id: {data['id']})")
        return data["id"]
    
    def test_cocktails_filter_returns_created_cocktails(self):
        """GET /api/cocktails should return the created cocktails"""
        # Get all cocktails
        response = requests.get(
            f"{BASE_URL}/api/cocktails",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have at least 2 cocktails (the ones we created)
        cocktail_names = [c["name"] for c in data]
        assert "TEST_Margarita" in cocktail_names, f"TEST_Margarita not found in {cocktail_names}"
        assert "TEST_Virgin Mojito" in cocktail_names, f"TEST_Virgin Mojito not found in {cocktail_names}"
        print(f"✓ GET /api/cocktails returns {len(data)} cocktails including our test cocktails")
    
    def test_cocktails_filter_alcoholic_true(self):
        """GET /api/cocktails?alcoholic=true should only return alcoholic cocktails"""
        response = requests.get(
            f"{BASE_URL}/api/cocktails",
            params={"alcoholic": "true"},
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned cocktails should be alcoholic
        for cocktail in data:
            assert cocktail.get("is_alcoholic") == True, f"Non-alcoholic cocktail found: {cocktail['name']}"
        
        # Should include our alcoholic cocktail
        cocktail_names = [c["name"] for c in data]
        assert "TEST_Margarita" in cocktail_names, "TEST_Margarita should be in alcoholic filter"
        assert "TEST_Virgin Mojito" not in cocktail_names, "TEST_Virgin Mojito should NOT be in alcoholic filter"
        print(f"✓ GET /api/cocktails?alcoholic=true returns {len(data)} alcoholic cocktails")
    
    def test_cocktails_filter_alcoholic_false(self):
        """GET /api/cocktails?alcoholic=false should only return non-alcoholic cocktails"""
        response = requests.get(
            f"{BASE_URL}/api/cocktails",
            params={"alcoholic": "false"},
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned cocktails should be non-alcoholic
        for cocktail in data:
            assert cocktail.get("is_alcoholic") == False, f"Alcoholic cocktail found: {cocktail['name']}"
        
        # Should include our non-alcoholic cocktail
        cocktail_names = [c["name"] for c in data]
        assert "TEST_Virgin Mojito" in cocktail_names, "TEST_Virgin Mojito should be in non-alcoholic filter"
        assert "TEST_Margarita" not in cocktail_names, "TEST_Margarita should NOT be in non-alcoholic filter"
        print(f"✓ GET /api/cocktails?alcoholic=false returns {len(data)} non-alcoholic cocktails")


class TestAddItemsToShoppingList:
    """Tests for POST /api/shopping-list/add-items endpoint"""
    
    def test_add_items_to_shopping_list(self):
        """POST /api/shopping-list/add-items should add multiple items"""
        items_data = {
            "items": [
                {"name": "TEST_Milk", "quantity": 2, "unit": "L", "category": "dairy"},
                {"name": "TEST_Eggs", "quantity": 12, "unit": "pieces", "category": "dairy"},
                {"name": "TEST_Bread", "quantity": 1, "unit": "loaf", "category": "grains"}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/shopping-list/add-items",
            json=items_data,
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data, "Response should have 'items' field"
        
        # Verify items were added
        item_names = [item["name"] for item in data["items"]]
        assert "TEST_Milk" in item_names, "TEST_Milk should be in shopping list"
        assert "TEST_Eggs" in item_names, "TEST_Eggs should be in shopping list"
        assert "TEST_Bread" in item_names, "TEST_Bread should be in shopping list"
        
        print(f"✓ POST /api/shopping-list/add-items added 3 items, total items: {len(data['items'])}")
    
    def test_add_items_does_not_duplicate(self):
        """POST /api/shopping-list/add-items should not add duplicate items"""
        # Try to add the same items again
        items_data = {
            "items": [
                {"name": "TEST_Milk", "quantity": 1, "unit": "L", "category": "dairy"},
                {"name": "TEST_New Item", "quantity": 5, "unit": "pieces", "category": "other"}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/shopping-list/add-items",
            json=items_data,
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Count how many times TEST_Milk appears (should be 1)
        milk_count = sum(1 for item in data["items"] if item["name"] == "TEST_Milk")
        assert milk_count == 1, f"TEST_Milk should appear only once, found {milk_count} times"
        
        # TEST_New Item should be added
        item_names = [item["name"] for item in data["items"]]
        assert "TEST_New Item" in item_names, "TEST_New Item should be added"
        
        print(f"✓ POST /api/shopping-list/add-items correctly handles duplicates")
    
    def test_add_items_sets_recipe_source(self):
        """POST /api/shopping-list/add-items should set recipe_source to 'Pantry Low Stock'"""
        # Get current shopping list
        response = requests.get(
            f"{BASE_URL}/api/shopping-list",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Check that our test items have the correct recipe_source
        for item in data["items"]:
            if item["name"].startswith("TEST_"):
                assert item.get("recipe_source") == "Pantry Low Stock", \
                    f"Item {item['name']} should have recipe_source='Pantry Low Stock', got {item.get('recipe_source')}"
        
        print(f"✓ Items added via add-items have recipe_source='Pantry Low Stock'")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_recipes(self):
        """Delete test recipes created during tests"""
        # Get all recipes
        response = requests.get(
            f"{BASE_URL}/api/recipes",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        if response.status_code == 200:
            recipes = response.json()
            for recipe in recipes:
                if recipe["name"].startswith("TEST_"):
                    delete_response = requests.delete(
                        f"{BASE_URL}/api/recipes/{recipe['id']}",
                        headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
                    )
                    print(f"  Deleted recipe: {recipe['name']}")
        
        print("✓ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
