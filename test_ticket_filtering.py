#!/usr/bin/env python3
import requests
import json
import time
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:4290/api"
ADMIN_CREDENTIALS = {"email": "admin@example.com", "password": "Admin@123"}

def login(credentials):
    """Login and get authentication cookies"""
    response = requests.post(f"{BASE_URL}/auth/login", json=credentials)
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        sys.exit(1)
    return response.cookies

def get_tickets(cookies, params=None):
    """Get tickets with optional filters"""
    url = f"{BASE_URL}/tickets"
    if params:
        query_params = "&".join([f"{k}={v}" for k, v in params.items() if v is not None])
        url = f"{url}?{query_params}"
    
    response = requests.get(url, cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get tickets: {response.text}")
        return None
    
    return response.json()

def create_ticket(cookies, data):
    """Create a new ticket"""
    response = requests.post(f"{BASE_URL}/tickets", json=data, cookies=cookies)
    if response.status_code != 201:
        print(f"Failed to create ticket: {response.text}")
        return None
    return response.json()["data"]

def test_ticket_filtering():
    """Test ticket filtering and search functionality"""
    print("\n=== Testing Ticket Filtering and Search ===\n")
    
    # Login as admin
    print("Logging in as admin...")
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Step 1: Create test tickets with different properties
    print("\nStep 1: Creating test tickets with different properties...")
    
    # Create a high priority ticket
    high_ticket_data = {
        "title": f"High Priority Test Ticket {int(time.time())}",
        "description": "This is a high priority test ticket",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation"
    }
    
    high_ticket = create_ticket(admin_cookies, high_ticket_data)
    if not high_ticket:
        print("❌ Failed to create high priority ticket")
        return False
    
    print(f"✅ Created high priority ticket with ID: {high_ticket['_id']}")
    
    # Create a medium priority ticket
    medium_ticket_data = {
        "title": f"Medium Priority Test Ticket {int(time.time())}",
        "description": "This is a medium priority test ticket",
        "category": "support",
        "subcategory": "account",
        "priority": "medium",
        "source": "direct_creation"
    }
    
    medium_ticket = create_ticket(admin_cookies, medium_ticket_data)
    if not medium_ticket:
        print("❌ Failed to create medium priority ticket")
        return False
    
    print(f"✅ Created medium priority ticket with ID: {medium_ticket['_id']}")
    
    # Step 2: Test filtering by priority
    print("\nStep 2: Testing filtering by priority...")
    high_priority_params = {"priority": "high"}
    high_priority_result = get_tickets(admin_cookies, high_priority_params)
    
    if not high_priority_result or "data" not in high_priority_result:
        print("❌ Failed to filter tickets by high priority")
        return False
    
    high_priority_tickets = high_priority_result["data"]
    print(f"✅ Found {len(high_priority_tickets)} high priority tickets")
    
    medium_priority_params = {"priority": "medium"}
    medium_priority_result = get_tickets(admin_cookies, medium_priority_params)
    
    if not medium_priority_result or "data" not in medium_priority_result:
        print("❌ Failed to filter tickets by medium priority")
        return False
    
    medium_priority_tickets = medium_priority_result["data"]
    print(f"✅ Found {len(medium_priority_tickets)} medium priority tickets")
    
    # Step 3: Test filtering by category
    print("\nStep 3: Testing filtering by category...")
    technical_params = {"category": "technical"}
    technical_result = get_tickets(admin_cookies, technical_params)
    
    if not technical_result or "data" not in technical_result:
        print("❌ Failed to filter tickets by technical category")
        return False
    
    technical_tickets = technical_result["data"]
    print(f"✅ Found {len(technical_tickets)} technical category tickets")
    
    support_params = {"category": "support"}
    support_result = get_tickets(admin_cookies, support_params)
    
    if not support_result or "data" not in support_result:
        print("❌ Failed to filter tickets by support category")
        return False
    
    support_tickets = support_result["data"]
    print(f"✅ Found {len(support_tickets)} support category tickets")
    
    # Step 4: Test filtering by status
    print("\nStep 4: Testing filtering by status...")
    new_status_params = {"status": "new"}
    new_status_result = get_tickets(admin_cookies, new_status_params)
    
    if not new_status_result or "data" not in new_status_result:
        print("❌ Failed to filter tickets by new status")
        return False
    
    new_status_tickets = new_status_result["data"]
    print(f"✅ Found {len(new_status_tickets)} new status tickets")
    
    # Step 5: Test filtering by date range
    print("\nStep 5: Testing filtering by date range...")
    start_date = (datetime.now() - timedelta(days=7)).isoformat()
    end_date = datetime.now().isoformat()
    
    date_range_params = {
        "startDate": start_date,
        "endDate": end_date
    }
    
    date_range_result = get_tickets(admin_cookies, date_range_params)
    
    if not date_range_result or "data" not in date_range_result:
        print("❌ Failed to filter tickets by date range")
        return False
    
    date_range_tickets = date_range_result["data"]
    print(f"✅ Found {len(date_range_tickets)} tickets in date range")
    
    # Step 6: Test search functionality
    print("\nStep 6: Testing search functionality...")
    search_term = "Test Ticket"
    search_params = {"search": search_term}
    
    search_result = get_tickets(admin_cookies, search_params)
    
    if not search_result or "data" not in search_result:
        print("❌ Failed to search tickets")
        return False
    
    search_tickets = search_result["data"]
    print(f"✅ Found {len(search_tickets)} tickets matching search term '{search_term}'")
    
    # Step 7: Test combined filtering
    print("\nStep 7: Testing combined filtering...")
    combined_params = {
        "priority": "high",
        "category": "technical",
        "status": "new"
    }
    
    combined_result = get_tickets(admin_cookies, combined_params)
    
    if not combined_result or "data" not in combined_result:
        print("❌ Failed to apply combined filters")
        return False
    
    combined_tickets = combined_result["data"]
    print(f"✅ Found {len(combined_tickets)} tickets matching combined filters")
    
    print("\n=== Ticket Filtering and Search Test Completed Successfully ===")
    return True

if __name__ == "__main__":
    success = test_ticket_filtering()
    sys.exit(0 if success else 1)
