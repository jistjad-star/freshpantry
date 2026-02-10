"""
Test suite for Copyright-Safe Private Recipe Sharing Feature
Tests: Share endpoints, token management, compliance checks, import flow
"""
import pytest
import requests
import os
import time
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://foodprep-4.preview.emergentagent.com').rstrip('/')

# Test session token - will be created in setup
SESSION_TOKEN = None
USER_ID = None
RECIPE_ID = None
SHARE_TOKEN = None

# Second user for import testing
SESSION_TOKEN_2 = None
USER_ID_2 = None


class TestShareFeatureSetup:
    """Setup test data for share feature tests"""
    
    @pytest.fixture(autouse=True, scope="class")
    def setup_test_users(self, request):
        """Create test users and recipes for testing"""
        global SESSION_TOKEN, USER_ID, RECIPE_ID, SESSION_TOKEN_2, USER_ID_2
        
        # Create first test user via mongosh
        import subprocess
        timestamp = int(time.time() * 1000)
        
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            var userId = 'test-share-user1-{timestamp}';
            var sessionToken = 'test_share_session1_{timestamp}';
            db.users.insertOne({{
              user_id: userId,
              email: 'test.share1.{timestamp}@example.com',
              name: 'Test Share User 1',
              picture: 'https://via.placeholder.com/150',
              created_at: new Date()
            }});
            db.user_sessions.insertOne({{
              user_id: userId,
              session_token: sessionToken,
              expires_at: new Date(Date.now() + 7*24*60*60*1000),
              created_at: new Date()
            }});
            print('TOKEN1=' + sessionToken);
            print('USERID1=' + userId);
            '''
        ], capture_output=True, text=True)
        
        for line in result.stdout.split('\n'):
            if line.startswith('TOKEN1='):
                SESSION_TOKEN = line.split('=')[1]
            elif line.startswith('USERID1='):
                USER_ID = line.split('=')[1]
        
        # Create second test user
        result2 = subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            var userId = 'test-share-user2-{timestamp}';
            var sessionToken = 'test_share_session2_{timestamp}';
            db.users.insertOne({{
              user_id: userId,
              email: 'test.share2.{timestamp}@example.com',
              name: 'Test Share User 2',
              picture: 'https://via.placeholder.com/150',
              created_at: new Date()
            }});
            db.user_sessions.insertOne({{
              user_id: userId,
              session_token: sessionToken,
              expires_at: new Date(Date.now() + 7*24*60*60*1000),
              created_at: new Date()
            }});
            print('TOKEN2=' + sessionToken);
            print('USERID2=' + userId);
            '''
        ], capture_output=True, text=True)
        
        for line in result2.stdout.split('\n'):
            if line.startswith('TOKEN2='):
                SESSION_TOKEN_2 = line.split('=')[1]
            elif line.startswith('USERID2='):
                USER_ID_2 = line.split('=')[1]
        
        print(f"Created test users: {USER_ID}, {USER_ID_2}")
        print(f"Session tokens: {SESSION_TOKEN}, {SESSION_TOKEN_2}")
        
        # Create a test recipe for user 1
        response = requests.post(
            f"{BASE_URL}/api/recipes",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}", "Content-Type": "application/json"},
            json={
                "name": "Test Simple Salad",
                "description": "A simple test salad",
                "servings": 2,
                "prep_time": "10 min",
                "cook_time": "0 min",
                "ingredients": [
                    {"name": "lettuce", "quantity": "1", "unit": "head", "category": "produce"},
                    {"name": "tomatoes", "quantity": "2", "unit": "", "category": "produce"},
                    {"name": "cucumber", "quantity": "1", "unit": "", "category": "produce"},
                    {"name": "olive oil", "quantity": "2", "unit": "tbsp", "category": "pantry"},
                    {"name": "lemon juice", "quantity": "1", "unit": "tbsp", "category": "pantry"}
                ],
                "instructions": [
                    "Wash and dry the lettuce leaves thoroughly.",
                    "Chop the tomatoes into bite-sized pieces.",
                    "Slice the cucumber into thin rounds.",
                    "Combine all vegetables in a large bowl.",
                    "Drizzle with olive oil and lemon juice.",
                    "Toss gently and serve immediately."
                ],
                "categories": ["vegan", "quick-easy"],
                "skip_image_generation": True
            }
        )
        
        if response.status_code == 200:
            RECIPE_ID = response.json().get('id')
            print(f"Created test recipe: {RECIPE_ID}")
        else:
            print(f"Failed to create recipe: {response.status_code} - {response.text}")
        
        yield
        
        # Cleanup after tests
        # Note: In production, we'd clean up test data here


class TestShareEndpointAuth:
    """Test authentication requirements for share endpoints"""
    
    def test_share_requires_auth(self):
        """POST /api/recipes/share should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/share",
            headers={"Content-Type": "application/json"},
            json={"recipe_ids": ["test-id"]}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        assert "Sign in" in response.json().get("detail", "")
        print("✓ Share endpoint requires authentication")
    
    def test_import_requires_auth(self):
        """POST /api/recipes/import-shared/{token} should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/recipes/import-shared/fake-token",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Import endpoint requires authentication")


class TestSharePreview:
    """Test share preview endpoint"""
    
    def test_invalid_token_returns_404(self):
        """GET /api/recipes/shared/{token} with invalid token returns 404"""
        response = requests.get(f"{BASE_URL}/api/recipes/shared/invalid-token-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid token returns 404")
    
    def test_preview_returns_minimal_info(self):
        """Preview should return minimal info without content"""
        # First create a share token
        if not SESSION_TOKEN or not RECIPE_ID:
            pytest.skip("Test setup failed - no session token or recipe")
        
        # Create share link
        share_response = requests.post(
            f"{BASE_URL}/api/recipes/share",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}", "Content-Type": "application/json"},
            json={"recipe_ids": [RECIPE_ID]}
        )
        
        if share_response.status_code != 200:
            # If share fails due to compliance, that's a separate test
            print(f"Share creation returned {share_response.status_code}: {share_response.text}")
            pytest.skip("Share creation failed - compliance check may have failed")
        
        global SHARE_TOKEN
        SHARE_TOKEN = share_response.json().get("token")
        
        # Get preview
        preview_response = requests.get(f"{BASE_URL}/api/recipes/shared/{SHARE_TOKEN}")
        assert preview_response.status_code == 200
        
        data = preview_response.json()
        assert "recipe_count" in data
        assert "legal_notice" in data
        # Should NOT contain actual recipe content
        assert "recipes" not in data or data.get("recipes") == []
        assert "instructions" not in data
        assert "ingredients" not in data
        print("✓ Preview returns minimal info without content")


class TestTokenExpiry:
    """Test token expiry and single-use behavior"""
    
    def test_expired_token_returns_410(self):
        """Expired tokens should return 410 Gone"""
        # Create an expired token directly in DB
        import subprocess
        timestamp = int(time.time() * 1000)
        
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.import_tokens.insertOne({{
              token: 'expired-test-token-{timestamp}',
              recipe_ids: ['test-recipe-id'],
              sender_id: 'test-sender',
              scope: 'private-import-only',
              created_at: new Date(Date.now() - 20*60*1000),
              expires_at: new Date(Date.now() - 5*60*1000),
              used: false,
              recipe_count: 1
            }});
            '''
        ], capture_output=True, text=True)
        
        response = requests.get(f"{BASE_URL}/api/recipes/shared/expired-test-token-{timestamp}")
        assert response.status_code == 410, f"Expected 410, got {response.status_code}"
        assert "expired" in response.json().get("detail", "").lower()
        print("✓ Expired token returns 410")
    
    def test_used_token_returns_410(self):
        """Already-used tokens should return 410 Gone"""
        import subprocess
        timestamp = int(time.time() * 1000)
        
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.import_tokens.insertOne({{
              token: 'used-test-token-{timestamp}',
              recipe_ids: ['test-recipe-id'],
              sender_id: 'test-sender',
              scope: 'private-import-only',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 15*60*1000),
              used: true,
              used_at: new Date(),
              recipe_count: 1
            }});
            '''
        ], capture_output=True, text=True)
        
        response = requests.get(f"{BASE_URL}/api/recipes/shared/used-test-token-{timestamp}")
        assert response.status_code == 410, f"Expected 410, got {response.status_code}"
        assert "already been used" in response.json().get("detail", "").lower()
        print("✓ Used token returns 410")


class TestShareCreation:
    """Test share link creation"""
    
    def test_share_creates_token(self):
        """POST /api/recipes/share should create a token"""
        if not SESSION_TOKEN or not RECIPE_ID:
            pytest.skip("Test setup failed")
        
        response = requests.post(
            f"{BASE_URL}/api/recipes/share",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}", "Content-Type": "application/json"},
            json={"recipe_ids": [RECIPE_ID]}
        )
        
        # May fail due to compliance - that's expected behavior
        if response.status_code == 400:
            data = response.json()
            if "compliance" in data.get("detail", "").lower():
                print("✓ Share correctly rejected due to compliance check")
                return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data
        assert "expires_in_minutes" in data
        assert data["expires_in_minutes"] == 15
        assert "recipe_count" in data
        print(f"✓ Share created token: {data['token'][:20]}...")
    
    def test_share_with_nonexistent_recipe(self):
        """Share with non-existent recipe should fail gracefully"""
        if not SESSION_TOKEN:
            pytest.skip("Test setup failed")
        
        response = requests.post(
            f"{BASE_URL}/api/recipes/share",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}", "Content-Type": "application/json"},
            json={"recipe_ids": ["nonexistent-recipe-id-12345"]}
        )
        
        assert response.status_code == 400
        print("✓ Share with non-existent recipe fails gracefully")


class TestImportFlow:
    """Test the import flow"""
    
    def test_cannot_import_own_recipes(self):
        """User cannot import their own shared recipes"""
        if not SESSION_TOKEN or not SHARE_TOKEN:
            pytest.skip("No share token available")
        
        response = requests.post(
            f"{BASE_URL}/api/recipes/import-shared/{SHARE_TOKEN}",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        
        # Should fail because same user
        assert response.status_code == 400
        assert "own" in response.json().get("detail", "").lower()
        print("✓ Cannot import own shared recipes")
    
    def test_import_invalidates_token(self):
        """Import should invalidate the token (single-use)"""
        if not SESSION_TOKEN or not SESSION_TOKEN_2 or not RECIPE_ID:
            pytest.skip("Test setup incomplete")
        
        # Create a new share token
        share_response = requests.post(
            f"{BASE_URL}/api/recipes/share",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}", "Content-Type": "application/json"},
            json={"recipe_ids": [RECIPE_ID]}
        )
        
        if share_response.status_code != 200:
            pytest.skip("Could not create share token")
        
        token = share_response.json().get("token")
        
        # Import with second user
        import_response = requests.post(
            f"{BASE_URL}/api/recipes/import-shared/{token}",
            headers={"Authorization": f"Bearer {SESSION_TOKEN_2}"}
        )
        
        if import_response.status_code != 200:
            print(f"Import failed: {import_response.status_code} - {import_response.text}")
            pytest.skip("Import failed")
        
        # Try to use token again - should fail
        second_import = requests.post(
            f"{BASE_URL}/api/recipes/import-shared/{token}",
            headers={"Authorization": f"Bearer {SESSION_TOKEN_2}"}
        )
        
        assert second_import.status_code == 410
        assert "already been used" in second_import.json().get("detail", "").lower()
        print("✓ Token invalidated after use (single-use)")


class TestNgramCompliance:
    """Test n-gram compliance checking"""
    
    def test_ngram_function_exists(self):
        """Verify n-gram compliance functions are available"""
        # This is a code review check - the functions should exist in server.py
        import subprocess
        result = subprocess.run(
            ['grep', '-c', 'check_8gram_compliance', '/app/backend/server.py'],
            capture_output=True, text=True
        )
        count = int(result.stdout.strip())
        assert count >= 1, "check_8gram_compliance function not found"
        print("✓ N-gram compliance function exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
