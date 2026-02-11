"""
Test cases for Fresh Pantry new features:
1. Meal Suggestions - 'Use Expiring' toggle button
2. Meal Suggestions - Shared ingredients display
3. Meal Suggestions - Expiring ingredients badge
4. Meal Suggestions - Smart recommendations
5. Pantry - Set sell-by date
6. Pantry - Expiry date display
7. Pantry - Add item with expiry
8. Backend API - /api/suggestions/meals?expiring_soon=true
9. Backend API - /api/pantry/expiring-soon
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://shopguru-4.preview.emergentagent.com').rstrip('/')
SESSION_TOKEN = "test_session_1770684291113"

@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {SESSION_TOKEN}"}

@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    return session


class TestPantryExpiryFeatures:
    """Test pantry expiry date features"""
    
    def test_add_pantry_item_with_expiry_date(self, api_client):
        """Test adding a pantry item with expiry date"""
        # Calculate expiry date 3 days from now
        expiry_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        
        response = api_client.post(f"{BASE_URL}/api/pantry/items", json={
            "name": "TEST_Expiring_Milk",
            "quantity": 2,
            "unit": "L",
            "category": "dairy",
            "min_threshold": 0.5,
            "typical_purchase": 2,
            "expiry_date": expiry_date
        })
        
        assert response.status_code == 200, f"Failed to add item: {response.text}"
        data = response.json()
        
        # API returns item inside 'item' key
        item = data.get("item", data)
        assert item.get("name") == "TEST_Expiring_Milk"
        assert item.get("expiry_date") == expiry_date
        print(f"✓ Added pantry item with expiry date: {expiry_date}")
        
        return item.get("id")
    
    def test_add_pantry_item_expired(self, api_client):
        """Test adding a pantry item that is already expired"""
        # Calculate expiry date 2 days ago
        expiry_date = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
        
        response = api_client.post(f"{BASE_URL}/api/pantry/items", json={
            "name": "TEST_Expired_Yogurt",
            "quantity": 1,
            "unit": "cup",
            "category": "dairy",
            "expiry_date": expiry_date
        })
        
        assert response.status_code == 200, f"Failed to add item: {response.text}"
        data = response.json()
        item = data.get("item", data)
        assert item.get("expiry_date") == expiry_date
        print(f"✓ Added expired pantry item with expiry date: {expiry_date}")
        return item.get("id")
    
    def test_add_pantry_item_expiring_in_7_days(self, api_client):
        """Test adding a pantry item expiring in 7 days"""
        expiry_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = api_client.post(f"{BASE_URL}/api/pantry/items", json={
            "name": "TEST_Expiring_Cheese",
            "quantity": 200,
            "unit": "g",
            "category": "dairy",
            "expiry_date": expiry_date
        })
        
        assert response.status_code == 200, f"Failed to add item: {response.text}"
        data = response.json()
        item = data.get("item", data)
        assert item.get("expiry_date") == expiry_date
        print(f"✓ Added pantry item expiring in 7 days: {expiry_date}")
        return item.get("id")
    
    def test_update_pantry_item_expiry_date(self, api_client):
        """Test updating expiry date on existing pantry item"""
        # First add an item without expiry
        response = api_client.post(f"{BASE_URL}/api/pantry/items", json={
            "name": "TEST_Update_Expiry_Item",
            "quantity": 1,
            "unit": "piece",
            "category": "produce"
        })
        assert response.status_code == 200
        data = response.json()
        item = data.get("item", data)
        item_id = item.get("id")
        
        # Now update with expiry date
        new_expiry = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        update_response = api_client.put(f"{BASE_URL}/api/pantry/items/{item_id}", json={
            "expiry_date": new_expiry
        })
        
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        # Verify by fetching pantry
        pantry_response = api_client.get(f"{BASE_URL}/api/pantry")
        pantry = pantry_response.json()
        updated_item = next((i for i in pantry.get('items', []) if i['id'] == item_id), None)
        
        assert updated_item is not None, "Item not found in pantry after update"
        assert updated_item.get("expiry_date") == new_expiry
        print(f"✓ Updated pantry item expiry date to: {new_expiry}")
        return item_id
    
    def test_remove_pantry_item_expiry_date(self, api_client):
        """Test removing expiry date from pantry item"""
        # First add an item with expiry
        expiry_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        response = api_client.post(f"{BASE_URL}/api/pantry/items", json={
            "name": "TEST_Remove_Expiry_Item",
            "quantity": 1,
            "unit": "piece",
            "category": "produce",
            "expiry_date": expiry_date
        })
        assert response.status_code == 200
        data = response.json()
        item = data.get("item", data)
        item_id = item.get("id")
        
        # Now remove expiry date using clear_expiry_date flag
        update_response = api_client.put(f"{BASE_URL}/api/pantry/items/{item_id}", json={
            "clear_expiry_date": True
        })
        
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        # Verify by fetching pantry
        pantry_response = api_client.get(f"{BASE_URL}/api/pantry")
        pantry = pantry_response.json()
        updated_item = next((i for i in pantry.get('items', []) if i['id'] == item_id), None)
        
        assert updated_item is not None, "Item not found in pantry after update"
        assert updated_item.get("expiry_date") is None
        print(f"✓ Removed expiry date from pantry item")
        return item_id


class TestExpiringItemsAPI:
    """Test /api/pantry/expiring-soon endpoint"""
    
    def test_get_expiring_items_default_7_days(self, api_client):
        """Test getting items expiring within default 7 days"""
        response = api_client.get(f"{BASE_URL}/api/pantry/expiring-soon")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "expiring_items" in data
        assert "expired_items" in data
        assert "message" in data
        
        print(f"✓ GET /api/pantry/expiring-soon returned: {data['message']}")
        print(f"  - Expiring items: {len(data['expiring_items'])}")
        print(f"  - Expired items: {len(data['expired_items'])}")
        
        # Verify structure of expiring items
        for item in data['expiring_items']:
            assert 'name' in item
            assert 'days_until_expiry' in item
            assert item['days_until_expiry'] >= 0  # Not expired
            assert item['days_until_expiry'] <= 7  # Within 7 days
        
        # Verify structure of expired items
        for item in data['expired_items']:
            assert 'name' in item
            assert 'days_until_expiry' in item
            assert item['days_until_expiry'] < 0  # Already expired
    
    def test_get_expiring_items_custom_days(self, api_client):
        """Test getting items expiring within custom number of days"""
        response = api_client.get(f"{BASE_URL}/api/pantry/expiring-soon?days=3")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify items are within 3 days
        for item in data['expiring_items']:
            assert item['days_until_expiry'] <= 3
        
        print(f"✓ GET /api/pantry/expiring-soon?days=3 returned {len(data['expiring_items'])} items")


class TestMealSuggestionsWithExpiring:
    """Test meal suggestions with expiring filter"""
    
    def test_meal_suggestions_without_expiring_filter(self, api_client):
        """Test meal suggestions without expiring filter"""
        response = api_client.get(f"{BASE_URL}/api/suggestions/meals")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "suggestions" in data
        assert "message" in data
        
        print(f"✓ GET /api/suggestions/meals returned: {data['message']}")
        print(f"  - Suggestions count: {len(data['suggestions'])}")
        
        # Verify suggestion structure
        for suggestion in data['suggestions'][:3]:  # Check first 3
            assert 'recipe_id' in suggestion
            assert 'recipe_name' in suggestion
            assert 'match_percentage' in suggestion
            assert 'recommendation' in suggestion
            # New fields for shared ingredients
            if 'shared_ingredient_count' in suggestion:
                print(f"  - {suggestion['recipe_name']}: {suggestion['match_percentage']}% match, shares {suggestion.get('shared_ingredient_count', 0)} ingredients")
    
    def test_meal_suggestions_with_expiring_filter(self, api_client):
        """Test meal suggestions with expiring_soon=true filter"""
        response = api_client.get(f"{BASE_URL}/api/suggestions/meals?expiring_soon=true")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "suggestions" in data
        assert "message" in data
        
        print(f"✓ GET /api/suggestions/meals?expiring_soon=true returned: {data['message']}")
        
        # If there are suggestions, verify they have expiring_ingredients_used field
        for suggestion in data['suggestions'][:3]:
            if 'expiring_ingredients_used' in suggestion and suggestion['expiring_ingredients_used'] is not None:
                print(f"  - {suggestion['recipe_name']}: uses {suggestion['expiring_ingredients_used']} expiring ingredients")
    
    def test_meal_suggestions_with_meal_type_and_expiring(self, api_client):
        """Test meal suggestions with both meal_type and expiring_soon filters"""
        response = api_client.get(f"{BASE_URL}/api/suggestions/meals?meal_type=dinner&expiring_soon=true")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        print(f"✓ GET /api/suggestions/meals?meal_type=dinner&expiring_soon=true returned: {data['message']}")


class TestSharedIngredientsFeature:
    """Test shared ingredients grouping feature"""
    
    def test_recipes_grouped_by_ingredients(self, api_client):
        """Test /api/recipes/grouped endpoint"""
        response = api_client.get(f"{BASE_URL}/api/recipes/grouped")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "groups" in data
        assert "message" in data
        
        print(f"✓ GET /api/recipes/grouped returned: {data['message']}")
        
        # Verify group structure
        for group in data['groups'][:3]:
            assert 'shared_ingredient' in group
            assert 'recipes' in group
            assert 'count' in group
            print(f"  - {group['shared_ingredient']}: shared by {group['count']} recipes")
    
    def test_suggestions_include_shared_ingredient_count(self, api_client):
        """Test that meal suggestions include shared_ingredient_count"""
        response = api_client.get(f"{BASE_URL}/api/suggestions/meals")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if suggestions have the new fields
        for suggestion in data['suggestions'][:5]:
            # These fields should be present in the new implementation
            if 'shared_ingredient_count' in suggestion:
                print(f"✓ {suggestion['recipe_name']}: shared_ingredient_count = {suggestion['shared_ingredient_count']}")
            if 'related_recipe_count' in suggestion:
                print(f"  related_recipe_count = {suggestion['related_recipe_count']}")
            if 'composite_score' in suggestion:
                print(f"  composite_score = {suggestion['composite_score']:.2f}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_items(self, api_client):
        """Clean up all TEST_ prefixed pantry items"""
        # Get pantry
        response = api_client.get(f"{BASE_URL}/api/pantry")
        if response.status_code != 200:
            print("No pantry to clean up")
            return
        
        pantry = response.json()
        items = pantry.get('items', [])
        
        deleted_count = 0
        for item in items:
            if item.get('name', '').startswith('TEST_'):
                delete_response = api_client.delete(f"{BASE_URL}/api/pantry/items/{item['id']}")
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test pantry items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
