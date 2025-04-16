#!/usr/bin/env python3
import requests
import json
import time
import sys

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

def create_ticket(cookies, data):
    """Create a new ticket"""
    response = requests.post(f"{BASE_URL}/tickets", json=data, cookies=cookies)
    if response.status_code != 201:
        print(f"Failed to create ticket: {response.text}")
        return None
    return response.json()["data"]

def get_ticket(cookies, ticket_id):
    """Get ticket details"""
    response = requests.get(f"{BASE_URL}/tickets/{ticket_id}", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get ticket: {response.text}")
        return None
    return response.json()["data"]

def update_ticket(cookies, ticket_id, data):
    """Update a ticket"""
    response = requests.put(f"{BASE_URL}/tickets/{ticket_id}", json=data, cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to update ticket: {response.text}")
        return None
    return response.json()["data"]

def test_ticket_lifecycle():
    """Test the complete ticket lifecycle from creation to closure"""
    print("\n=== Testing Ticket Lifecycle Management ===\n")
    
    # Login as admin
    print("Logging in as admin...")
    cookies = login(ADMIN_CREDENTIALS)
    
    # Step 1: Create a new ticket
    print("\nStep 1: Creating a new ticket...")
    ticket_data = {
        "title": f"Lifecycle Test Ticket {int(time.time())}",
        "description": "This is a test ticket for testing the ticket lifecycle",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation"
    }
    
    ticket = create_ticket(cookies, ticket_data)
    if not ticket:
        print("❌ Failed to create ticket")
        return False
    
    ticket_id = ticket["_id"]
    print(f"✅ Created ticket with ID: {ticket_id}")
    print(f"   Status: {ticket['status']}")
    
    # Verify initial status is 'new'
    if ticket["status"] != "new":
        print(f"❌ Initial ticket status is not 'new', got '{ticket['status']}' instead")
        return False
    
    print(f"✅ Initial ticket status is 'new' as expected")
    
    # Step 2: Update ticket to 'in_progress'
    print("\nStep 2: Updating ticket status to 'in_progress'...")
    updated_ticket = update_ticket(cookies, ticket_id, {"status": "in_progress"})
    if not updated_ticket:
        print("❌ Failed to update ticket status")
        return False
    
    if updated_ticket["status"] != "in_progress":
        print(f"❌ Ticket status not updated to 'in_progress', got '{updated_ticket['status']}' instead")
        return False
    
    print(f"✅ Updated ticket status to 'in_progress'")
    
    # Step 3: Update ticket to 'on_hold'
    print("\nStep 3: Updating ticket status to 'on_hold'...")
    updated_ticket = update_ticket(cookies, ticket_id, {
        "status": "on_hold",
        "holdReason": "waiting_for_customer"
    })
    if not updated_ticket:
        print("❌ Failed to update ticket status")
        return False
    
    if updated_ticket["status"] != "on_hold":
        print(f"❌ Ticket status not updated to 'on_hold', got '{updated_ticket['status']}' instead")
        return False
    
    print(f"✅ Updated ticket status to 'on_hold'")
    
    # Step 4: Update ticket back to 'in_progress'
    print("\nStep 4: Updating ticket status back to 'in_progress'...")
    updated_ticket = update_ticket(cookies, ticket_id, {"status": "in_progress"})
    if not updated_ticket:
        print("❌ Failed to update ticket status")
        return False
    
    if updated_ticket["status"] != "in_progress":
        print(f"❌ Ticket status not updated to 'in_progress', got '{updated_ticket['status']}' instead")
        return False
    
    print(f"✅ Updated ticket status back to 'in_progress'")
    
    # Step 5: Update ticket to 'resolved'
    print("\nStep 5: Updating ticket status to 'resolved'...")
    updated_ticket = update_ticket(cookies, ticket_id, {
        "status": "resolved",
        "resolutionType": "fixed"
    })
    if not updated_ticket:
        print("❌ Failed to update ticket status")
        return False
    
    if updated_ticket["status"] != "resolved":
        print(f"❌ Ticket status not updated to 'resolved', got '{updated_ticket['status']}' instead")
        return False
    
    print(f"✅ Updated ticket status to 'resolved'")
    
    # Step 6: Update ticket to 'closed'
    print("\nStep 6: Updating ticket status to 'closed'...")
    updated_ticket = update_ticket(cookies, ticket_id, {"status": "closed"})
    if not updated_ticket:
        print("❌ Failed to update ticket status")
        return False
    
    if updated_ticket["status"] != "closed":
        print(f"❌ Ticket status not updated to 'closed', got '{updated_ticket['status']}' instead")
        return False
    
    print(f"✅ Updated ticket status to 'closed'")
    
    # Step 7: Check status history
    print("\nStep 7: Checking status history...")
    final_ticket = get_ticket(cookies, ticket_id)
    if not final_ticket:
        print("❌ Failed to get final ticket")
        return False
    
    status_history = final_ticket.get("statusHistory", [])
    if len(status_history) < 6:  # We should have at least 6 status changes
        print(f"❌ Status history incomplete, expected at least 6 entries, got {len(status_history)}")
        return False
    
    print(f"✅ Status history contains {len(status_history)} entries")
    for i, entry in enumerate(status_history):
        print(f"   {i+1}. Status: {entry['status']}, Time: {entry['timestamp']}")
    
    # Step 8: Check audit log
    print("\nStep 8: Checking audit log...")
    audit_log = final_ticket.get("auditLog", [])
    if len(audit_log) < 6:  # We should have at least 6 audit entries
        print(f"❌ Audit log incomplete, expected at least 6 entries, got {len(audit_log)}")
        return False
    
    print(f"✅ Audit log contains {len(audit_log)} entries")
    for i, entry in enumerate(audit_log):
        print(f"   {i+1}. Action: {entry['action']}, Time: {entry['timestamp']}")
    
    print("\n=== Ticket Lifecycle Test Completed Successfully ===")
    return True

if __name__ == "__main__":
    success = test_ticket_lifecycle()
    sys.exit(0 if success else 1)
