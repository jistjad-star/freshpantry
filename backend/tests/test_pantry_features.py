"""
Test cases for Fresh Pantry new features:
1. Pantry - Add Essentials with pre-set alerts
2. Pantry - Individual item alerts (min_threshold)
3. AddRecipe - Separate ingredients/instructions parsing
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_1770683252655"

class TestPantryAlerts:
    """Test pantry alert features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.headers = {
            "Authorization": f"Bearer {SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_add_pantry_item_with_min_threshold(self):
        """Test adding a pantry item with min_threshold (alert threshold)"""
        # Add item with alert threshold
        response = requests.post(
            f"{BASE_URL}/api/pantry/items",
            headers=self.headers,
            json={
                "name": "Test Eggs",
                "quantity": 12,
                "unit": "eggs",
                "category": "dairy",
                "min_threshold": 3,
                "typical_purchase": 12
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "item" in data
        assert data["item"]["name"] == "Test Eggs"
        assert data["item"]["min_threshold"] == 3
        assert data["item"]["typical_purchase"] == 12
        
        # Store item ID for cleanup
        self.test_item_id = data["item"]["id"]
        
        # Verify item was persisted
        pantry_response = requests.get(
            f"{BASE_URL}/api/pantry",
            headers=self.headers
        )
        assert pantry_response.status_code == 200
        pantry_data = pantry_response.json()
        
        # Find the item we just added
        found_item = None
        for item in pantry_data.get("items", []):
            if item["name"] == "Test Eggs":
                found_item = item
                break
        
        assert found_item is not None
        assert found_item["min_threshold"] == 3
    
    def test_update_pantry_item_min_threshold(self):
        """Test updating min_threshold on an existing pantry item"""
        # First, get the pantry to find an item
        pantry_response = requests.get(
            f"{BASE_URL}/api/pantry",
            headers=self.headers
        )
        assert pantry_response.status_code == 200
        pantry_data = pantry_response.json()
        
        if not pantry_data.get("items"):
            pytest.skip("No pantry items to test update")
        
        item_id = pantry_data["items"][0]["id"]
        
        # Update min_threshold
        update_response = requests.put(
            f"{BASE_URL}/api/pantry/items/{item_id}",
            headers=self.headers,
            json={"min_threshold": 5}
        )
        
        assert update_response.status_code == 200
        
        # Verify update was persisted
        pantry_response = requests.get(
            f"{BASE_URL}/api/pantry",
            headers=self.headers
        )
        pantry_data = pantry_response.json()
        
        updated_item = None
        for item in pantry_data.get("items", []):
            if item["id"] == item_id:
                updated_item = item
                break
        
        assert updated_item is not None
        assert updated_item["min_threshold"] == 5
    
    def test_add_pantry_item_with_zero_threshold(self):
        """Test adding item with zero threshold (no alert)"""
        response = requests.post(
            f"{BASE_URL}/api/pantry/items",
            headers=self.headers,
            json={
                "name": "Test Bread",
                "quantity": 1,
                "unit": "loaf",
                "category": "grains",
                "min_threshold": 0,
                "typical_purchase": 1
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["item"]["min_threshold"] == 0


class TestParseIngredients:
    """Test parse-ingredients API with separate ingredients and instructions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.headers = {
            "Authorization": f"Bearer {SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_parse_ingredients_with_separate_instructions(self):
        """Test that parse-ingredients accepts separate ingredients_text and instructions_text"""
        response = requests.post(
            f"{BASE_URL}/api/parse-ingredients",
            headers=self.headers,
            json={
                "recipe_name": "Test Chicken Recipe",
                "ingredients_text": "2 chicken breasts\n1 tbsp olive oil\n3 cloves garlic",
                "instructions_text": "1. Preheat oven to 200°C\n2. Season chicken\n3. Cook for 25 minutes"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have instructions parsed
        assert "instructions" in data
        assert len(data["instructions"]) > 0
        
        # Should have prep_time and cook_time estimated
        assert "prep_time" in data
        assert "cook_time" in data
    
    def test_parse_ingredients_without_instructions(self):
        """Test that parse-ingredients works with only ingredients_text"""
        response = requests.post(
            f"{BASE_URL}/api/parse-ingredients",
            headers=self.headers,
            json={
                "recipe_name": "Simple Recipe",
                "ingredients_text": "2 cups flour\n1 cup sugar\n2 eggs",
                "instructions_text": ""
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Instructions should be empty
        assert "instructions" in data
        assert len(data["instructions"]) == 0


class TestPantryEndpoints:
    """Test pantry CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.headers = {
            "Authorization": f"Bearer {SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_get_pantry(self):
        """Test getting pantry"""
        response = requests.get(
            f"{BASE_URL}/api/pantry",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "id" in data
    
    def test_add_and_delete_pantry_item(self):
        """Test adding and deleting a pantry item"""
        # Add item
        add_response = requests.post(
            f"{BASE_URL}/api/pantry/items",
            headers=self.headers,
            json={
                "name": "TEST_Delete_Item",
                "quantity": 1,
                "unit": "piece",
                "category": "other",
                "min_threshold": 0,
                "typical_purchase": 1
            }
        )
        
        assert add_response.status_code == 200
        item_id = add_response.json()["item"]["id"]
        
        # Delete item
        delete_response = requests.delete(
            f"{BASE_URL}/api/pantry/items/{item_id}",
            headers=self.headers
        )
        
        assert delete_response.status_code == 200
        
        # Verify deletion
        pantry_response = requests.get(
            f"{BASE_URL}/api/pantry",
            headers=self.headers
        )
        pantry_data = pantry_response.json()
        
        # Item should not exist
        for item in pantry_data.get("items", []):
            assert item["id"] != item_id


class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health_endpoint(self):
        """Test /health endpoint"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "database" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
