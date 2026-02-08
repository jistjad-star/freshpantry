"""
Test cases for the /api/parse-image endpoint
Tests the screenshot upload and ingredient extraction feature
"""
import pytest
import requests
import os
from PIL import Image, ImageDraw
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestParseImageEndpoint:
    """Tests for the /api/parse-image endpoint - screenshot upload feature"""
    
    @pytest.fixture
    def test_image_with_ingredients(self):
        """Create a test image with ingredient text"""
        img = Image.new('RGB', (400, 300), color='white')
        draw = ImageDraw.Draw(img)
        
        ingredients_text = """Ingredients:
2 cups flour
1 tsp salt
3 eggs
1/2 cup butter
1 cup milk"""
        
        draw.text((20, 20), ingredients_text, fill='black')
        
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer
    
    @pytest.fixture
    def blank_image(self):
        """Create a blank test image with no text"""
        img = Image.new('RGB', (200, 200), color='white')
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer
    
    def test_parse_image_extracts_ingredients(self, test_image_with_ingredients):
        """Test that the API extracts ingredients from an image with text"""
        files = {'file': ('test_ingredients.png', test_image_with_ingredients, 'image/png')}
        
        response = requests.post(f"{BASE_URL}/api/parse-image", files=files, timeout=60)
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "ingredients_text" in data, "Response should contain ingredients_text"
        assert "ingredients" in data, "Response should contain ingredients list"
        
        # Verify ingredients were extracted
        ingredients = data["ingredients"]
        assert len(ingredients) > 0, "Should extract at least one ingredient"
        
        # Verify ingredient structure
        for ing in ingredients:
            assert "name" in ing, "Ingredient should have name"
            assert "quantity" in ing, "Ingredient should have quantity"
            assert "unit" in ing, "Ingredient should have unit"
            assert "category" in ing, "Ingredient should have category"
        
        # Verify specific ingredients were found
        ingredient_names = [ing["name"].lower() for ing in ingredients]
        assert any("flour" in name for name in ingredient_names), "Should find flour"
        assert any("salt" in name for name in ingredient_names), "Should find salt"
        assert any("egg" in name for name in ingredient_names), "Should find eggs"
        
        print(f"SUCCESS: Extracted {len(ingredients)} ingredients from image")
        print(f"Ingredients: {[ing['name'] for ing in ingredients]}")
    
    def test_parse_image_returns_raw_text(self, test_image_with_ingredients):
        """Test that the API returns the raw extracted text"""
        files = {'file': ('test_ingredients.png', test_image_with_ingredients, 'image/png')}
        
        response = requests.post(f"{BASE_URL}/api/parse-image", files=files, timeout=60)
        
        assert response.status_code == 200
        
        data = response.json()
        raw_text = data.get("ingredients_text", "")
        
        # Should contain some of the ingredient text
        assert len(raw_text) > 0, "Should return raw text from image"
        print(f"SUCCESS: Raw text extracted: {raw_text[:100]}...")
    
    def test_parse_image_handles_blank_image(self, blank_image):
        """Test that the API handles images with no text gracefully"""
        files = {'file': ('blank.png', blank_image, 'image/png')}
        
        response = requests.post(f"{BASE_URL}/api/parse-image", files=files, timeout=60)
        
        # Should still return 200 but with empty/minimal results
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "ingredients" in data, "Response should contain ingredients list"
        # Blank image may return empty list or minimal results
        print(f"SUCCESS: Blank image handled gracefully, returned {len(data.get('ingredients', []))} ingredients")
    
    def test_parse_image_requires_file(self):
        """Test that the API returns error when no file is provided"""
        response = requests.post(f"{BASE_URL}/api/parse-image", timeout=30)
        
        # Should return 422 (validation error) when no file provided
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("SUCCESS: API correctly rejects requests without file")


class TestAPIHealth:
    """Basic API health checks"""
    
    def test_api_root(self):
        """Test that the API root endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"SUCCESS: API root accessible - {data['message']}")
    
    def test_recipes_endpoint(self):
        """Test that recipes endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/recipes", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Recipes endpoint accessible - {len(data)} recipes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
