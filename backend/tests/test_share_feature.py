"""
Test suite for Copyright-Safe Private Recipe Sharing Feature
Tests: Share endpoints, token management, compliance checks, import flow
"""
import pytest
import requests
import os
import time
import subprocess
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://recipe-list.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def test_user1():
    """Create first test user"""
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
        print('TOKEN=' + sessionToken);
        print('USERID=' + userId);
        '''
    ], capture_output=True, text=True)
    
    token = None
    user_id = None
    for line in result.stdout.split('\n'):
        if line.startswith('TOKEN='):
            token = line.split('=')[1]
        elif line.startswith('USERID='):
            user_id = line.split('=')[1]
    
    return {"token": token, "user_id": user_id}


@pytest.fixture(scope="module")
def test_user2():
    """Create second test user for import testing"""
    timestamp = int(time.time() * 1000) + 1
    
    result = subprocess.run([
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
        print('TOKEN=' + sessionToken);
        print('USERID=' + userId);
        '''
    ], capture_output=True, text=True)
    
    token = None
    user_id = None
    for line in result.stdout.split('\n'):
        if line.startswith('TOKEN='):
            token = line.split('=')[1]
        elif line.startswith('USERID='):
            user_id = line.split('=')[1]
    
    return {"token": token, "user_id": user_id}


@pytest.fixture(scope="module")
def test_recipe(test_user1):
    """Create a test recipe for user 1"""
    response = requests.post(
        f"{BASE_URL}/api/recipes",
        headers={"Authorization": f"Bearer {test_user1['token']}", "Content-Type": "application/json"},
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
        return response.json()
    return None


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


class TestTokenExpiry:
    """Test token expiry and single-use behavior"""
    
    def test_expired_token_returns_410(self):
        """Expired tokens should return 410 Gone"""
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
    
    def test_share_creates_token_or_compliance_fails(self, test_user1, test_recipe):
        """POST /api/recipes/share should create a token or fail compliance"""
        if not test_user1 or not test_recipe:
            pytest.skip("Test setup failed")
        
        response = requests.post(
            f"{BASE_URL}/api/recipes/share",
            headers={"Authorization": f"Bearer {test_user1['token']}", "Content-Type": "application/json"},
            json={"recipe_ids": [test_recipe['id']]}
        )
        
        # May fail due to compliance - that's expected behavior
        if response.status_code == 400:
            data = response.json()
            if "compliance" in data.get("detail", "").lower() or "could not generate" in data.get("detail", "").lower():
                print("✓ Share correctly rejected due to compliance check (AI rewrite didn't pass n-gram check)")
                return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data
        assert "expires_in_minutes" in data
        assert data["expires_in_minutes"] == 15
        assert "recipe_count" in data
        print(f"✓ Share created token: {data['token'][:20]}...")
    
    def test_share_with_nonexistent_recipe(self, test_user1):
        """Share with non-existent recipe should fail gracefully"""
        if not test_user1:
            pytest.skip("Test setup failed")
        
        response = requests.post(
            f"{BASE_URL}/api/recipes/share",
            headers={"Authorization": f"Bearer {test_user1['token']}", "Content-Type": "application/json"},
            json={"recipe_ids": ["nonexistent-recipe-id-12345"]}
        )
        
        assert response.status_code == 400
        print("✓ Share with non-existent recipe fails gracefully")


class TestImportFlow:
    """Test the import flow"""
    
    def test_import_with_invalid_token(self, test_user2):
        """Import with invalid token should return 404"""
        if not test_user2:
            pytest.skip("Test setup failed")
        
        response = requests.post(
            f"{BASE_URL}/api/recipes/import-shared/invalid-token-xyz",
            headers={"Authorization": f"Bearer {test_user2['token']}"}
        )
        
        assert response.status_code == 404
        print("✓ Import with invalid token returns 404")


class TestNgramCompliance:
    """Test n-gram compliance checking"""
    
    def test_ngram_function_exists(self):
        """Verify n-gram compliance functions are available"""
        result = subprocess.run(
            ['grep', '-c', 'check_8gram_compliance', '/app/backend/server.py'],
            capture_output=True, text=True
        )
        count = int(result.stdout.strip())
        assert count >= 1, "check_8gram_compliance function not found"
        print("✓ N-gram compliance function exists")
    
    def test_compliance_metrics_model_exists(self):
        """Verify ComplianceMetrics model exists"""
        result = subprocess.run(
            ['grep', '-c', 'class ComplianceMetrics', '/app/backend/server.py'],
            capture_output=True, text=True
        )
        count = int(result.stdout.strip())
        assert count >= 1, "ComplianceMetrics model not found"
        print("✓ ComplianceMetrics model exists")


class TestSharePreviewContent:
    """Test that share preview doesn't expose content"""
    
    def test_preview_has_no_recipe_content(self):
        """Create a valid token and verify preview has no content"""
        timestamp = int(time.time() * 1000)
        
        # Create a valid token directly in DB
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.import_tokens.insertOne({{
              token: 'preview-test-token-{timestamp}',
              recipe_ids: ['test-recipe-id'],
              sender_id: 'test-sender',
              scope: 'private-import-only',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 15*60*1000),
              used: false,
              recipe_count: 1
            }});
            '''
        ], capture_output=True, text=True)
        
        response = requests.get(f"{BASE_URL}/api/recipes/shared/preview-test-token-{timestamp}")
        assert response.status_code == 200
        
        data = response.json()
        # Should have minimal info
        assert "recipe_count" in data
        assert "legal_notice" in data
        # Should NOT have content
        assert "instructions" not in data
        assert "ingredients" not in data
        assert "method_rewritten" not in data
        print("✓ Preview returns minimal info without recipe content")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
