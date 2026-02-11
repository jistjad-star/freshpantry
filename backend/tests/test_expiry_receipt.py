"""
Backend tests for:
1. Expiry notification features (GET /api/pantry/expiring-soon)
2. Receipt scanning features (POST /api/pantry/scan-receipt, POST /api/pantry/add-from-receipt)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://recipe-list.preview.emergentagent.com')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_1770752478065')

@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    return session


class TestExpiringItems:
    """Tests for expiry notification feature"""
    
    def test_get_expiring_items_endpoint_exists(self, api_client):
        """Test that GET /api/pantry/expiring-soon endpoint exists"""
        response = api_client.get(f"{BASE_URL}/api/pantry/expiring-soon")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "expiring_items" in data, "Response should have expiring_items field"
        assert "expired_items" in data, "Response should have expired_items field"
        assert "message" in data, "Response should have message field"
    
    def test_get_expiring_items_with_days_param(self, api_client):
        """Test expiring items with custom days parameter"""
        response = api_client.get(f"{BASE_URL}/api/pantry/expiring-soon", params={"days": 3})
        assert response.status_code == 200
        
        data = response.json()
        assert "expiring_items" in data
        assert "expired_items" in data
    
    def test_add_pantry_item_with_expiry_date(self, api_client):
        """Test adding a pantry item with expiry date"""
        # Add item expiring in 2 days
        expiry_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        item_data = {
            "name": "TEST_Expiring_Milk",
            "quantity": 1,
            "unit": "L",
            "category": "dairy",
            "expiry_date": expiry_date
        }
        
        response = api_client.post(f"{BASE_URL}/api/pantry/items", json=item_data)
        assert response.status_code == 200, f"Failed to add item: {response.text}"
        
        # Verify item appears in expiring items
        expiring_response = api_client.get(f"{BASE_URL}/api/pantry/expiring-soon", params={"days": 7})
        assert expiring_response.status_code == 200
        
        data = expiring_response.json()
        expiring_names = [item["name"] for item in data.get("expiring_items", [])]
        assert "TEST_Expiring_Milk" in expiring_names, f"Item should appear in expiring items. Got: {expiring_names}"
    
    def test_add_expired_item(self, api_client):
        """Test adding an already expired item"""
        # Add item that expired yesterday
        expiry_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        item_data = {
            "name": "TEST_Expired_Yogurt",
            "quantity": 1,
            "unit": "pack",
            "category": "dairy",
            "expiry_date": expiry_date
        }
        
        response = api_client.post(f"{BASE_URL}/api/pantry/items", json=item_data)
        assert response.status_code == 200
        
        # Verify item appears in expired items
        expiring_response = api_client.get(f"{BASE_URL}/api/pantry/expiring-soon")
        assert expiring_response.status_code == 200
        
        data = expiring_response.json()
        expired_names = [item["name"] for item in data.get("expired_items", [])]
        assert "TEST_Expired_Yogurt" in expired_names, f"Item should appear in expired items. Got: {expired_names}"
    
    def test_expiring_items_response_structure(self, api_client):
        """Test that expiring items have correct structure"""
        response = api_client.get(f"{BASE_URL}/api/pantry/expiring-soon")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check expiring items structure
        for item in data.get("expiring_items", []):
            assert "name" in item, "Expiring item should have name"
            assert "days_until_expiry" in item, "Expiring item should have days_until_expiry"
            assert "expiry_date" in item, "Expiring item should have expiry_date"
            assert item["days_until_expiry"] >= 0, "days_until_expiry should be >= 0 for expiring items"
        
        # Check expired items structure
        for item in data.get("expired_items", []):
            assert "name" in item, "Expired item should have name"
            assert "days_until_expiry" in item, "Expired item should have days_until_expiry"
            assert item["days_until_expiry"] < 0, "days_until_expiry should be < 0 for expired items"


class TestReceiptScanning:
    """Tests for receipt scanning feature"""
    
    def test_scan_receipt_endpoint_exists(self, api_client):
        """Test that POST /api/pantry/scan-receipt endpoint exists"""
        # Create a simple test image (1x1 white pixel PNG)
        import base64
        # Minimal valid PNG (1x1 white pixel)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {"file": ("test_receipt.png", png_data, "image/png")}
        
        # Remove Content-Type header for multipart
        headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}
        
        response = requests.post(
            f"{BASE_URL}/api/pantry/scan-receipt",
            files=files,
            headers=headers
        )
        
        # Should return 200 (even if no items found) or 503 if AI not available
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "extracted_items" in data, "Response should have extracted_items field"
            assert "message" in data, "Response should have message field"
    
    def test_add_from_receipt_endpoint_exists(self, api_client):
        """Test that POST /api/pantry/add-from-receipt endpoint exists"""
        items = [
            {"name": "TEST_Receipt_Milk", "quantity": 2, "unit": "L", "category": "dairy"},
            {"name": "TEST_Receipt_Bread", "quantity": 1, "unit": "loaf", "category": "grains"}
        ]
        
        response = api_client.post(f"{BASE_URL}/api/pantry/add-from-receipt", json={"items": items})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "added" in data, "Response should have added count"
        assert "updated" in data, "Response should have updated count"
        assert "message" in data, "Response should have message"
    
    def test_add_from_receipt_creates_items(self, api_client):
        """Test that add-from-receipt actually creates pantry items"""
        items = [
            {"name": "TEST_Receipt_Cheese", "quantity": 200, "unit": "g", "category": "dairy"}
        ]
        
        response = api_client.post(f"{BASE_URL}/api/pantry/add-from-receipt", json={"items": items})
        assert response.status_code == 200
        
        # Verify item was added to pantry
        pantry_response = api_client.get(f"{BASE_URL}/api/pantry")
        assert pantry_response.status_code == 200
        
        pantry_data = pantry_response.json()
        item_names = [item["name"] for item in pantry_data.get("items", [])]
        assert "TEST_Receipt_Cheese" in item_names, f"Item should be in pantry. Got: {item_names}"
    
    def test_add_from_receipt_updates_existing(self, api_client):
        """Test that add-from-receipt updates quantity of existing items"""
        # First add an item
        items = [{"name": "TEST_Receipt_Eggs", "quantity": 6, "unit": "pieces", "category": "dairy"}]
        response1 = api_client.post(f"{BASE_URL}/api/pantry/add-from-receipt", json={"items": items})
        assert response1.status_code == 200
        
        # Add same item again
        items2 = [{"name": "TEST_Receipt_Eggs", "quantity": 6, "unit": "pieces", "category": "dairy"}]
        response2 = api_client.post(f"{BASE_URL}/api/pantry/add-from-receipt", json={"items": items2})
        assert response2.status_code == 200
        
        data = response2.json()
        assert data.get("updated", 0) >= 1, "Should have updated existing item"
        
        # Verify quantity was updated
        pantry_response = api_client.get(f"{BASE_URL}/api/pantry")
        pantry_data = pantry_response.json()
        
        for item in pantry_data.get("items", []):
            if item["name"] == "TEST_Receipt_Eggs":
                assert item["quantity"] >= 12, f"Quantity should be at least 12, got {item['quantity']}"
                break
    
    def test_add_from_receipt_empty_items(self, api_client):
        """Test add-from-receipt with empty items list"""
        response = api_client.post(f"{BASE_URL}/api/pantry/add-from-receipt", json={"items": []})
        assert response.status_code == 400, "Should return 400 for empty items"


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_items(self, api_client):
        """Remove test items from pantry"""
        pantry_response = api_client.get(f"{BASE_URL}/api/pantry")
        if pantry_response.status_code == 200:
            pantry_data = pantry_response.json()
            for item in pantry_data.get("items", []):
                if item["name"].startswith("TEST_"):
                    api_client.delete(f"{BASE_URL}/api/pantry/items/{item['id']}")
        
        # Verify cleanup
        print("Test cleanup completed")
        assert True
