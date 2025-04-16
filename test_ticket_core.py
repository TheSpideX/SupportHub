#!/usr/bin/env python3
import requests
import json
import time
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:4290/api"
ADMIN_CREDENTIALS = {"email": "admin@example.com", "password": "Admin@123"}
TEAM_LEAD_CREDENTIALS = {"email": "teamlead@example.com", "password": "TeamLead@123"}
TEAM_MEMBER_CREDENTIALS = {"email": "teammember@example.com", "password": "TeamMember@123"}

# Helper functions
def login(credentials):
    response = requests.post(f"{BASE_URL}/auth/login", json=credentials)
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        sys.exit(1)
    return response.cookies

def get_teams(cookies):
    response = requests.get(f"{BASE_URL}/teams", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get teams: {response.text}")
        return []
    return response.json().get("data", [])

def get_team_members(cookies, team_id):
    response = requests.get(f"{BASE_URL}/teams/{team_id}/members", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get team members: {response.text}")
        return []
    return response.json().get("data", [])

def create_ticket(cookies, data):
    response = requests.post(f"{BASE_URL}/tickets", json=data, cookies=cookies)
    if response.status_code != 201:
        print(f"Failed to create ticket: {response.text}")
        return None
    
    return response.json()["data"]

def get_tickets(cookies, params=None):
    url = f"{BASE_URL}/tickets"
    if params:
        query_params = "&".join([f"{k}={v}" for k, v in params.items()])
        url = f"{url}?{query_params}"
    
    response = requests.get(url, cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get tickets: {response.text}")
        return []
    
    return response.json().get("data", [])

def get_ticket(cookies, ticket_id):
    response = requests.get(f"{BASE_URL}/tickets/{ticket_id}", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get ticket: {response.text}")
        return None
    
    return response.json()["data"]

def update_ticket(cookies, ticket_id, data):
    response = requests.put(f"{BASE_URL}/tickets/{ticket_id}", json=data, cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to update ticket: {response.text}")
        return None
    
    return response.json()["data"]

def add_comment(cookies, ticket_id, comment_text):
    data = {"text": comment_text}
    response = requests.post(f"{BASE_URL}/tickets/{ticket_id}/comments", json=data, cookies=cookies)
    if response.status_code != 201:
        print(f"Failed to add comment: {response.text}")
        return None
    
    return response.json()["data"]

def test_core_ticket_functionality():
    print("\n=== Testing Core Ticket Functionality ===\n")
    
    # Login as admin
    print("Logging in as admin...")
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Get teams
    print("\nGetting teams...")
    teams = get_teams(admin_cookies)
    if not teams:
        print("❌ No teams found")
        return False
    
    team_id = teams[0]["_id"]
    print(f"✅ Found team: {teams[0]['name']} (ID: {team_id})")
    
    # Get team members
    print("\nGetting team members...")
    members = get_team_members(admin_cookies, team_id)
    if not members:
        print("❌ No team members found")
        return False
    
    member_id = members[0]["_id"]
    print(f"✅ Found team member: {members[0]['name']} (ID: {member_id})")
    
    # Create a ticket
    print("\nCreating ticket...")
    ticket_data = {
        "title": f"Core Ticket Test {int(time.time())}",
        "description": "This is a test ticket for testing core ticket functionality",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "assignedTeam": team_id,
        "assignedTo": member_id
    }
    
    ticket = create_ticket(admin_cookies, ticket_data)
    if not ticket:
        print("❌ Failed to create ticket")
        return False
    
    ticket_id = ticket["_id"]
    print(f"✅ Created ticket with ID: {ticket_id}")
    print(f"   Title: {ticket['title']}")
    print(f"   Priority: {ticket['priority']}")
    print(f"   Status: {ticket['status']}")
    print(f"   Assigned team: {ticket['assignedTeam']}")
    print(f"   Assigned to: {ticket['assignedTo']}")
    
    # Get tickets
    print("\nGetting tickets...")
    tickets = get_tickets(admin_cookies)
    if not tickets:
        print("❌ No tickets found")
        return False
    
    print(f"✅ Found {len(tickets)} tickets")
    
    # Get specific ticket
    print("\nGetting specific ticket...")
    retrieved_ticket = get_ticket(admin_cookies, ticket_id)
    if not retrieved_ticket:
        print(f"❌ Failed to get ticket {ticket_id}")
        return False
    
    print(f"✅ Retrieved ticket {ticket_id}")
    print(f"   Title: {retrieved_ticket['title']}")
    print(f"   Status: {retrieved_ticket['status']}")
    
    # Update ticket status
    print("\nUpdating ticket status to in_progress...")
    updated_ticket = update_ticket(admin_cookies, ticket_id, {"status": "in_progress"})
    if not updated_ticket:
        print("❌ Failed to update ticket status")
        return False
    
    print(f"✅ Updated ticket status to {updated_ticket['status']}")
    
    # Add a comment
    print("\nAdding comment to ticket...")
    comment_text = f"Test comment at {datetime.now().isoformat()}"
    comment_result = add_comment(admin_cookies, ticket_id, comment_text)
    
    # Get updated ticket to verify comment
    updated_ticket = get_ticket(admin_cookies, ticket_id)
    if not updated_ticket:
        print("❌ Failed to get updated ticket")
        return False
    
    # Check if comment exists
    comment_found = False
    if "comments" in updated_ticket:
        for comment in updated_ticket["comments"]:
            if comment["text"] == comment_text:
                comment_found = True
                break
    
    if comment_found:
        print(f"✅ Comment added successfully")
    else:
        print(f"❌ Comment not found in ticket")
    
    # Check audit log
    print("\nChecking audit log...")
    if "auditLog" in updated_ticket and len(updated_ticket["auditLog"]) > 0:
        print(f"✅ Audit log contains {len(updated_ticket['auditLog'])} entries")
        for i, entry in enumerate(updated_ticket["auditLog"]):
            print(f"   {i+1}. Action: {entry['action']}, Time: {entry['timestamp']}")
    else:
        print("❌ No audit log entries found")
    
    # Update ticket priority
    print("\nUpdating ticket priority to critical...")
    updated_ticket = update_ticket(admin_cookies, ticket_id, {"priority": "critical"})
    if not updated_ticket:
        print("❌ Failed to update ticket priority")
        return False
    
    print(f"✅ Updated ticket priority to {updated_ticket['priority']}")
    
    # Update ticket status to on_hold
    print("\nUpdating ticket status to on_hold...")
    updated_ticket = update_ticket(admin_cookies, ticket_id, {
        "status": "on_hold",
        "holdReason": "waiting_for_customer"
    })
    if not updated_ticket:
        print("❌ Failed to update ticket status to on_hold")
        return False
    
    print(f"✅ Updated ticket status to {updated_ticket['status']}")
    if "holdReason" in updated_ticket:
        print(f"   Hold reason: {updated_ticket['holdReason']}")
    
    # Update ticket status to resolved
    print("\nUpdating ticket status to resolved...")
    updated_ticket = update_ticket(admin_cookies, ticket_id, {
        "status": "resolved",
        "resolutionType": "fixed"
    })
    if not updated_ticket:
        print("❌ Failed to update ticket status to resolved")
        return False
    
    print(f"✅ Updated ticket status to {updated_ticket['status']}")
    if "resolutionType" in updated_ticket:
        print(f"   Resolution type: {updated_ticket['resolutionType']}")
    
    # Update ticket status to closed
    print("\nUpdating ticket status to closed...")
    updated_ticket = update_ticket(admin_cookies, ticket_id, {"status": "closed"})
    if not updated_ticket:
        print("❌ Failed to update ticket status to closed")
        return False
    
    print(f"✅ Updated ticket status to {updated_ticket['status']}")
    
    # Test filtering
    print("\nTesting ticket filtering...")
    
    # Filter by status
    status_params = {"status": "closed"}
    status_tickets = get_tickets(admin_cookies, status_params)
    if status_tickets:
        print(f"✅ Successfully filtered tickets by status: found {len(status_tickets)} closed tickets")
    else:
        print("❌ Failed to filter tickets by status")
    
    # Filter by priority
    priority_params = {"priority": "critical"}
    priority_tickets = get_tickets(admin_cookies, priority_params)
    if priority_tickets:
        print(f"✅ Successfully filtered tickets by priority: found {len(priority_tickets)} critical tickets")
    else:
        print("❌ Failed to filter tickets by priority")
    
    # Filter by category
    category_params = {"category": "technical"}
    category_tickets = get_tickets(admin_cookies, category_params)
    if category_tickets:
        print(f"✅ Successfully filtered tickets by category: found {len(category_tickets)} technical tickets")
    else:
        print("❌ Failed to filter tickets by category")
    
    print("\n=== Core Ticket Functionality Test Completed Successfully ===")
    return True

if __name__ == "__main__":
    success = test_core_ticket_functionality()
    sys.exit(0 if success else 1)
