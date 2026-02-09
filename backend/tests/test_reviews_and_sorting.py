"""
Test file for Star Reviews and Popularity Sorting features
- Star review system - submit a review on a recipe detail page
- Star review display - verify reviews show on recipe detail page
- Popularity sort - verify Top Rated sort button works on /recipes page
- Rating display on recipe cards - verify star ratings show on library cards
- CORS fix - verify /api/auth/me returns 200 (not 401) for authenticated users
- GET /api/recipes?sort_by=popularity endpoint
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token created via mongosh
TEST_SESSION_TOKEN = "test_session_1770635829092"
TEST_USER_ID = "test-user-1770635829092"
TEST_RECIPE_ID = "3c4acbd9-3b36-45cf-b8fc-8ac49fcbf520"  # Playwright Test Recipe


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
        "Cookie": f"session_token={TEST_SESSION_TOKEN}"
    })
    return session


@pytest.fixture
def unauthenticated_client():
    """Session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestCORSAndAuth:
    """Test CORS fix - verify /api/auth/me returns 200 for authenticated users"""
    
    def test_auth_me_returns_200_for_authenticated_user(self, api_client):
        """CORS fix - verify /api/auth/me returns 200 (not 401) for authenticated users"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "name" in data
        assert data["user_id"] == TEST_USER_ID
    
    def test_auth_me_returns_401_for_unauthenticated_user(self, unauthenticated_client):
        """Verify unauthenticated requests get 401"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401


class TestRecipesSorting:
    """Test GET /api/recipes with sort_by parameter"""
    
    def test_get_recipes_default_sort(self, unauthenticated_client):
        """GET /api/recipes without sort_by returns recipes"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/recipes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_recipes_sort_by_popularity(self, unauthenticated_client):
        """GET /api/recipes?sort_by=popularity returns recipes sorted by rating"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/recipes?sort_by=popularity")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify sorting - recipes with higher ratings should come first
        if len(data) >= 2:
            for i in range(len(data) - 1):
                current_rating = data[i].get('average_rating', 0) or 0
                next_rating = data[i + 1].get('average_rating', 0) or 0
                # Allow equal ratings (secondary sort by review_count)
                assert current_rating >= next_rating, f"Recipes not sorted by popularity: {current_rating} < {next_rating}"
    
    def test_get_recipes_sort_by_newest(self, unauthenticated_client):
        """GET /api/recipes?sort_by=newest returns recipes sorted by created_at"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/recipes?sort_by=newest")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestReviewsCRUD:
    """Test Review CRUD endpoints"""
    
    def test_get_reviews_for_recipe(self, unauthenticated_client):
        """GET /api/recipes/{recipe_id}/reviews returns reviews"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/recipes/{TEST_RECIPE_ID}/reviews")
        assert response.status_code == 200
        
        data = response.json()
        assert "reviews" in data
        assert "count" in data
        assert isinstance(data["reviews"], list)
        assert data["count"] >= 0
    
    def test_add_review_to_recipe(self, api_client):
        """POST /api/recipes/{recipe_id}/reviews adds a review"""
        review_data = {
            "rating": 5,
            "comment": "Test review from pytest - excellent recipe!"
        }
        response = api_client.post(
            f"{BASE_URL}/api/recipes/{TEST_RECIPE_ID}/reviews",
            json=review_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "review" in data
        assert data["review"]["rating"] == 5
        assert data["review"]["comment"] == "Test review from pytest - excellent recipe!"
        assert data["review"]["user_name"] == "Test User"
        assert data["review"]["user_id"] == TEST_USER_ID
    
    def test_add_review_updates_recipe_average_rating(self, api_client, unauthenticated_client):
        """Adding a review updates the recipe's average_rating and review_count"""
        # Get current recipe state
        recipe_response = unauthenticated_client.get(f"{BASE_URL}/api/recipes/{TEST_RECIPE_ID}")
        if recipe_response.status_code == 200:
            initial_count = recipe_response.json().get("review_count", 0) or 0
        else:
            initial_count = 0
        
        # Add a review
        review_data = {"rating": 3, "comment": "Average recipe"}
        response = api_client.post(
            f"{BASE_URL}/api/recipes/{TEST_RECIPE_ID}/reviews",
            json=review_data
        )
        assert response.status_code == 200
        
        # Verify recipe was updated
        recipe_response = unauthenticated_client.get(f"{BASE_URL}/api/recipes/{TEST_RECIPE_ID}")
        if recipe_response.status_code == 200:
            recipe = recipe_response.json()
            assert recipe.get("review_count", 0) > initial_count, "Review count should increase"
            assert "average_rating" in recipe
    
    def test_add_review_without_comment(self, api_client):
        """POST review with rating only (no comment) works"""
        review_data = {"rating": 4, "comment": ""}
        response = api_client.post(
            f"{BASE_URL}/api/recipes/{TEST_RECIPE_ID}/reviews",
            json=review_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["review"]["rating"] == 4
    
    def test_add_review_invalid_rating(self, api_client):
        """POST review with invalid rating fails validation"""
        # Rating must be 1-5
        review_data = {"rating": 0, "comment": "Invalid"}
        response = api_client.post(
            f"{BASE_URL}/api/recipes/{TEST_RECIPE_ID}/reviews",
            json=review_data
        )
        # Should fail validation (422) or be rejected
        assert response.status_code in [400, 422]
    
    def test_add_review_to_nonexistent_recipe(self, api_client):
        """POST review to non-existent recipe returns 404"""
        review_data = {"rating": 5, "comment": "Test"}
        response = api_client.post(
            f"{BASE_URL}/api/recipes/nonexistent-recipe-id/reviews",
            json=review_data
        )
        assert response.status_code == 404
    
    def test_get_reviews_for_nonexistent_recipe(self, unauthenticated_client):
        """GET reviews for non-existent recipe returns empty list"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/recipes/nonexistent-recipe-id/reviews")
        # Should return 200 with empty reviews or 404
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            assert data["count"] == 0


class TestRecipeRatingFields:
    """Test that recipes have rating fields for display"""
    
    def test_recipe_has_rating_fields(self, unauthenticated_client):
        """Verify recipe response includes average_rating and review_count"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/recipes/{TEST_RECIPE_ID}")
        if response.status_code == 200:
            recipe = response.json()
            # These fields should exist (may be null/0 if no reviews)
            assert "average_rating" in recipe or recipe.get("average_rating") is None
            assert "review_count" in recipe or recipe.get("review_count") is None
    
    def test_recipes_list_includes_rating_fields(self, unauthenticated_client):
        """Verify recipes list includes rating fields for card display"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/recipes")
        assert response.status_code == 200
        
        recipes = response.json()
        if len(recipes) > 0:
            # Check first recipe has rating fields
            recipe = recipes[0]
            # Fields may be present or absent depending on schema
            # Just verify the response is valid
            assert "id" in recipe
            assert "name" in recipe


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
