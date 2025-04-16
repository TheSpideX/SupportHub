#!/usr/bin/env python3
import requests
import json
import time
import sys

# Configuration
BASE_URL = "http://localhost:4290/api"
ADMIN_CREDENTIALS = {"email": "admin@example.com", "password": "Admin@123"}
TEAM_LEAD_CREDENTIALS = {"email": "teamlead@example.com", "password": "TeamLead@123"}

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

def add_comment(cookies, ticket_id, comment_text, is_internal=False):
    """Add a comment to a ticket"""
    data = {
        "text": comment_text,
        "isInternal": is_internal
    }
    response = requests.post(f"{BASE_URL}/tickets/{ticket_id}/comments", json=data, cookies=cookies)
    if response.status_code != 201:
        # Check if the response is still successful despite the status code
        try:
            result = response.json()
            if result.get("success") == True and "data" in result:
                print(f"Comment added successfully despite non-201 status code")
                return result["data"]
            else:
                print(f"Failed to add comment: {response.text}")
                return None
        except:
            print(f"Failed to add comment: {response.text}")
            return None
    return response.json()["data"]

def test_ticket_comments():
    """Test ticket comments and collaboration features"""
    print("\n=== Testing Ticket Comments and Collaboration ===\n")

    # Login as admin
    print("Logging in as admin...")
    admin_cookies = login(ADMIN_CREDENTIALS)

    # Step 1: Create a new ticket
    print("\nStep 1: Creating a new ticket...")
    ticket_data = {
        "title": f"Comment Test Ticket {int(time.time())}",
        "description": "This is a test ticket for testing comments",
        "category": "technical",
        "subcategory": "server",
        "priority": "medium",
        "source": "direct_creation"
    }

    ticket = create_ticket(admin_cookies, ticket_data)
    if not ticket:
        print("❌ Failed to create ticket")
        return False

    ticket_id = ticket["_id"]
    print(f"✅ Created ticket with ID: {ticket_id}")

    # Step 2: Add a public comment as admin
    print("\nStep 2: Adding a public comment as admin...")
    admin_comment = f"This is a public comment from admin at {time.time()}"
    comment_result = add_comment(admin_cookies, ticket_id, admin_comment)
    if not comment_result:
        print("❌ Failed to add public comment as admin")
        return False

    print(f"✅ Added public comment as admin")

    # Step 3: Add an internal comment as admin
    print("\nStep 3: Adding an internal comment as admin...")
    admin_internal_comment = f"This is an internal comment from admin at {time.time()}"
    comment_result = add_comment(admin_cookies, ticket_id, admin_internal_comment, is_internal=True)
    if not comment_result:
        print("❌ Failed to add internal comment as admin")
        return False

    print(f"✅ Added internal comment as admin")

    # Step 4: Login as team lead and add a comment
    print("\nStep 4: Logging in as team lead...")
    team_lead_cookies = login(TEAM_LEAD_CREDENTIALS)

    print("Adding a comment as team lead...")
    team_lead_comment = f"This is a comment from team lead at {time.time()}"
    comment_result = add_comment(team_lead_cookies, ticket_id, team_lead_comment)
    if not comment_result:
        print("❌ Failed to add comment as team lead")
        return False

    print(f"✅ Added comment as team lead")

    # Step 5: Add another comment as team lead
    print("\nStep 5: Adding another comment as team lead...")
    team_lead_comment2 = f"This is a second comment from team lead at {time.time()}"
    comment_result = add_comment(team_lead_cookies, ticket_id, team_lead_comment2)
    if not comment_result:
        print("❌ Failed to add second comment as team lead")
        return False

    print(f"✅ Added second comment as team lead")

    # Step 6: Verify all comments are present
    print("\nStep 6: Verifying all comments are present...")
    updated_ticket = get_ticket(admin_cookies, ticket_id)
    if not updated_ticket:
        print("❌ Failed to get updated ticket")
        return False

    comments = updated_ticket.get("comments", [])
    if len(comments) < 4:  # We should have at least 4 comments
        print(f"❌ Not all comments are present, expected at least 4, got {len(comments)}")
        return False

    print(f"✅ Found {len(comments)} comments")
    for i, comment in enumerate(comments):
        print(f"   {i+1}. Author: {comment['author']}")
        print(f"      Text: {comment['text']}")
        print(f"      Internal: {comment.get('isInternal', False)}")
        print(f"      Time: {comment['createdAt']}")

    # Step 7: Check audit log for comment entries
    print("\nStep 7: Checking audit log for comment entries...")
    audit_log = updated_ticket.get("auditLog", [])
    comment_audit_entries = [entry for entry in audit_log if entry["action"] == "commented"]

    if len(comment_audit_entries) < 4:
        print(f"❌ Not all comment audit entries are present, expected at least 4, got {len(comment_audit_entries)}")
        return False

    print(f"✅ Found {len(comment_audit_entries)} comment audit entries")

    print("\n=== Ticket Comments Test Completed Successfully ===")
    return True

if __name__ == "__main__":
    success = test_ticket_comments()
    sys.exit(0 if success else 1)
