import requests
import sys
import json
from datetime import datetime
import uuid

class GreenChefAPITester:
    def __init__(self, base_url="https://recipe-shopper-15.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_recipe_id = None
        self.created_shopping_list_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.text else {}
                    if response_data:
                        print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'List with ' + str(len(response_data)) + ' items'}")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if response.text and success else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_create_recipe(self):
        """Test creating a recipe manually"""
        recipe_data = {
            "name": f"Test Recipe {datetime.now().strftime('%H%M%S')}",
            "description": "A test recipe for API testing",
            "servings": 4,
            "prep_time": "15 min",
            "cook_time": "30 min",
            "ingredients": [
                {
                    "name": "chicken breast",
                    "quantity": "2",
                    "unit": "lbs",
                    "category": "protein",
                    "checked": False
                },
                {
                    "name": "olive oil",
                    "quantity": "2",
                    "unit": "tbsp",
                    "category": "pantry",
                    "checked": False
                }
            ],
            "instructions": [
                "Preheat oven to 375°F",
                "Season chicken with salt and pepper",
                "Cook for 25-30 minutes"
            ],
            "image_url": "https://example.com/test-image.jpg"
        }
        
        success, response = self.run_test(
            "Create Recipe",
            "POST",
            "recipes",
            200,
            data=recipe_data
        )
        
        if success and 'id' in response:
            self.created_recipe_id = response['id']
            print(f"   Created recipe ID: {self.created_recipe_id}")
        
        return success

    def test_get_recipes(self):
        """Test getting all recipes"""
        success, response = self.run_test(
            "Get All Recipes",
            "GET",
            "recipes",
            200
        )
        
        if success:
            print(f"   Found {len(response)} recipes")
        
        return success

    def test_get_single_recipe(self):
        """Test getting a single recipe by ID"""
        if not self.created_recipe_id:
            print("⚠️  Skipping single recipe test - no recipe ID available")
            return True
            
        success, response = self.run_test(
            "Get Single Recipe",
            "GET",
            f"recipes/{self.created_recipe_id}",
            200
        )
        
        if success:
            print(f"   Recipe name: {response.get('name', 'N/A')}")
            print(f"   Ingredients count: {len(response.get('ingredients', []))}")
        
        return success

    def test_generate_shopping_list(self):
        """Test generating shopping list from recipes"""
        if not self.created_recipe_id:
            print("⚠️  Skipping shopping list generation - no recipe ID available")
            return True
            
        success, response = self.run_test(
            "Generate Shopping List",
            "POST",
            "shopping-list/generate",
            200,
            data={"recipe_ids": [self.created_recipe_id]}
        )
        
        if success:
            items_count = len(response.get('items', []))
            print(f"   Generated {items_count} shopping list items")
            if 'id' in response:
                self.created_shopping_list_id = response['id']
        
        return success

    def test_get_shopping_list(self):
        """Test getting the current shopping list"""
        success, response = self.run_test(
            "Get Shopping List",
            "GET",
            "shopping-list",
            200
        )
        
        if success and response:
            items_count = len(response.get('items', []))
            print(f"   Shopping list has {items_count} items")
        elif success and not response:
            print("   No shopping list found (empty)")
        
        return success

    def test_add_custom_shopping_item(self):
        """Test adding a custom item to shopping list"""
        custom_item = {
            "name": "Test Custom Item",
            "quantity": "1",
            "unit": "piece",
            "category": "other",
            "checked": False
        }
        
        success, response = self.run_test(
            "Add Custom Shopping Item",
            "POST",
            "shopping-list/add-item",
            200,
            data=custom_item
        )
        
        if success:
            items_count = len(response.get('items', []))
            print(f"   Shopping list now has {items_count} items")
        
        return success

    def test_weekly_plan_operations(self):
        """Test weekly plan creation and retrieval"""
        week_start = datetime.now().strftime('%Y-%m-%d')
        
        # Create weekly plan
        plan_data = {
            "week_start": week_start,
            "days": [
                {"day": "Monday", "recipe_ids": [self.created_recipe_id] if self.created_recipe_id else []},
                {"day": "Tuesday", "recipe_ids": []},
                {"day": "Wednesday", "recipe_ids": []},
                {"day": "Thursday", "recipe_ids": []},
                {"day": "Friday", "recipe_ids": []},
                {"day": "Saturday", "recipe_ids": []},
                {"day": "Sunday", "recipe_ids": []}
            ]
        }
        
        success1, response1 = self.run_test(
            "Create Weekly Plan",
            "POST",
            "weekly-plan",
            200,
            data=plan_data
        )
        
        # Get weekly plan
        success2, response2 = self.run_test(
            "Get Weekly Plan",
            "GET",
            "weekly-plan",
            200,
            params={"week_start": week_start}
        )
        
        if success2 and response2:
            days_count = len(response2.get('days', []))
            print(f"   Weekly plan has {days_count} days")
        
        return success1 and success2

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        # Test /api/auth/me without authentication (should return 401)
        success, response = self.run_test(
            "Auth Me (Unauthenticated)",
            "GET",
            "auth/me",
            401  # Should return 401 when not authenticated
        )
        
        return success

    def test_parse_ingredients(self):
        """Test AI ingredient parsing"""
        parse_data = {
            "recipe_name": "Test Recipe",
            "ingredients_text": "2 chicken breasts\n1 tbsp olive oil\n3 cloves garlic",
            "instructions_text": "1. Cook chicken\n2. Add oil\n3. Season with garlic"
        }
        
        success, response = self.run_test(
            "Parse Ingredients with AI",
            "POST",
            "parse-ingredients",
            200,
            data=parse_data
        )
        
        if success:
            ingredients_count = len(response.get('ingredients', []))
            instructions_count = len(response.get('instructions', []))
            print(f"   Parsed {ingredients_count} ingredients and {instructions_count} instructions")
        
        return success

    def test_parse_image_endpoint(self):
        """Test image parsing endpoint exists (without actual image)"""
        # We can't easily test with a real image in this simple test,
        # but we can check if the endpoint exists and returns proper error
        success, response = self.run_test(
            "Parse Image Endpoint (No File)",
            "POST",
            "parse-image",
            422  # Should return 422 for missing file
        )
        
        if not success:
            print("   ⚠️  Image parsing endpoint test - checking if endpoint exists")
        
        return True  # Don't count this as failure since we expect 422

    def test_recipe_import(self):
        """Test recipe import from URL (this might fail if AI is not working)"""
        # Using a simple test URL - this will likely fail but we want to see the error
        import_data = {
            "url": "https://www.example.com/recipe"
        }
        
        success, response = self.run_test(
            "Import Recipe from URL",
            "POST",
            "recipes/import",
            200,  # We expect this might fail, but let's see
            data=import_data
        )
        
        # This test is expected to potentially fail due to URL scraping
        if not success:
            print("   ⚠️  Recipe import failed (expected - requires valid recipe URL)")
        
        return True  # Don't count this as a failure

    def test_pantry_operations(self):
        """Test pantry/inventory operations"""
        # Test get pantry (should create empty one if doesn't exist)
        success1, response1 = self.run_test(
            "Get Pantry",
            "GET",
            "pantry",
            200
        )
        
        if success1:
            items_count = len(response1.get('items', []))
            print(f"   Pantry has {items_count} items")
        
        # Test add pantry item
        pantry_item = {
            "name": "Test Cheese",
            "quantity": 250.0,
            "unit": "g",
            "category": "dairy",
            "min_threshold": 50.0,
            "typical_purchase": 500.0
        }
        
        success2, response2 = self.run_test(
            "Add Pantry Item",
            "POST",
            "pantry/items",
            200,
            data=pantry_item
        )
        
        if success2:
            print(f"   Added item: {response2.get('item', {}).get('name', 'Unknown')}")
        
        # Test get low stock items
        success3, response3 = self.run_test(
            "Get Low Stock Items",
            "GET",
            "pantry/low-stock",
            200
        )
        
        if success3:
            low_stock_count = len(response3.get('low_stock_items', []))
            suggested_count = len(response3.get('suggested_shopping', []))
            print(f"   Found {low_stock_count} low stock items, {suggested_count} suggestions")
        
        return success1 and success2 and success3

    def test_cook_recipe_pantry_deduction(self):
        """Test cooking a recipe and deducting from pantry"""
        if not self.created_recipe_id:
            print("⚠️  Skipping cook recipe test - no recipe ID available")
            return True
        
        cook_data = {
            "recipe_id": self.created_recipe_id,
            "servings_multiplier": 1.0
        }
        
        success, response = self.run_test(
            "Cook Recipe (Pantry Deduction)",
            "POST",
            "pantry/cook",
            200,
            data=cook_data
        )
        
        if success:
            deducted_count = len(response.get('deducted', []))
            missing_count = len(response.get('missing_ingredients', []))
            print(f"   Deducted {deducted_count} ingredients, {missing_count} missing")
        
        return success

    def test_add_from_shopping_to_pantry(self):
        """Test adding checked shopping items to pantry"""
        success, response = self.run_test(
            "Add From Shopping to Pantry",
            "POST",
            "pantry/add-from-shopping",
            200
        )
        
        if success:
            added_count = response.get('added', 0)
            print(f"   Added {added_count} items from shopping list to pantry")
        
        return success

    def test_delete_recipe(self):
        """Test deleting a recipe"""
        if not self.created_recipe_id:
            print("⚠️  Skipping recipe deletion - no recipe ID available")
            return True
            
        success, response = self.run_test(
            "Delete Recipe",
            "DELETE",
            f"recipes/{self.created_recipe_id}",
            200
        )
        
        return success

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("🧙‍♀️ Starting Green Chef API Tests")
        print("=" * 50)
        
        # Test basic connectivity
        if not self.test_root_endpoint():
            print("❌ Root endpoint failed - stopping tests")
            return False
        
        # Test auth endpoints
        self.test_auth_endpoints()
        
        # Test AI parsing endpoints
        self.test_parse_ingredients()
        self.test_parse_image_endpoint()
        
        # Test recipe operations
        self.test_create_recipe()
        self.test_get_recipes()
        self.test_get_single_recipe()
        
        # Test shopping list operations
        self.test_generate_shopping_list()
        self.test_get_shopping_list()
        self.test_add_custom_shopping_item()
        
        # Test weekly plan operations
        self.test_weekly_plan_operations()
        
        # Test pantry operations
        self.test_pantry_operations()
        self.test_cook_recipe_pantry_deduction()
        self.test_add_from_shopping_to_pantry()
        
        # Test import (might fail)
        self.test_recipe_import()
        
        # Cleanup
        self.test_delete_recipe()
        
        # Print results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            failed = self.tests_run - self.tests_passed
            print(f"⚠️  {failed} test(s) failed")
            return False

def main():
    tester = GreenChefAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())