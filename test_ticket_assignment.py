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

def get_teams(cookies):
    """Get list of teams"""
    response = requests.get(f"{BASE_URL}/teams", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get teams: {response.text}")
        return []
    return response.json().get("data", [])

def get_team_members(cookies, team_id):
    """Get members of a team"""
    response = requests.get(f"{BASE_URL}/teams/{team_id}/members", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get team members: {response.text}")
        return []
    return response.json().get("data", [])

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

def assign_ticket_to_team(cookies, ticket_id, team_id, is_primary=True):
    """Assign a ticket to a team using the dedicated endpoint"""
    data = {
        "teamId": team_id,
        "isPrimary": is_primary
    }
    response = requests.post(f"{BASE_URL}/tickets/{ticket_id}/assign-team", json=data, cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to assign ticket to team: {response.text}")
        return None
    return response.json()["data"]

def test_ticket_assignment():
    """Test ticket assignment and team collaboration features"""
    print("\n=== Testing Ticket Assignment and Team Collaboration ===\n")

    # Login as admin
    print("Logging in as admin...")
    admin_cookies = login(ADMIN_CREDENTIALS)

    # Step 1: Get teams
    print("\nStep 1: Getting teams...")
    teams = get_teams(admin_cookies)
    if not teams:
        print("❌ No teams found")
        return False

    team_id = teams[0]["_id"]
    team_name = teams[0]["name"]
    print(f"✅ Found team: {team_name} (ID: {team_id})")

    # Step 2: Get team members
    print("\nStep 2: Getting team members...")
    members = get_team_members(admin_cookies, team_id)
    if not members:
        print("❌ No team members found")
        return False

    member_id = members[0]["_id"]
    member_name = members[0].get("fullName", members[0].get("email", "Unknown"))
    print(f"✅ Found team member: {member_name} (ID: {member_id})")

    # Step 3: Create a ticket without assignment
    print("\nStep 3: Creating a ticket without assignment...")
    ticket_data = {
        "title": f"Assignment Test Ticket {int(time.time())}",
        "description": "This is a test ticket for testing assignment",
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

    # Step 4: Assign ticket to a team
    print("\nStep 4: Assigning ticket to a team...")

    updated_ticket = assign_ticket_to_team(admin_cookies, ticket_id, team_id)
    if not updated_ticket:
        print("❌ Failed to assign ticket to team")
        return False

    if not updated_ticket.get("primaryTeam") or str(updated_ticket.get("primaryTeam", {}).get("teamId")) != team_id:
        print(f"❌ Ticket not assigned to team, expected {team_id}, got {updated_ticket.get('primaryTeam', {}).get('teamId')}")
        return False

    print(f"✅ Assigned ticket to team: {team_name}")

    # Step 5: Assign ticket to a team member
    print("\nStep 5: Assigning ticket to a team member...")
    update_data = {
        "assignedTo": member_id
    }

    updated_ticket = update_ticket(admin_cookies, ticket_id, update_data)
    if not updated_ticket:
        print("❌ Failed to assign ticket to team member")
        return False

    if updated_ticket.get("assignedTo") != member_id:
        print(f"❌ Ticket not assigned to team member, expected {member_id}, got {updated_ticket.get('assignedTo')}")
        return False

    print(f"✅ Assigned ticket to team member: {member_name}")

    # Step 6: Check audit log for assignment entries
    print("\nStep 6: Checking audit log for assignment entries...")
    final_ticket = get_ticket(admin_cookies, ticket_id)
    if not final_ticket:
        print("❌ Failed to get final ticket")
        return False

    audit_log = final_ticket.get("auditLog", [])
    assignment_entries = [entry for entry in audit_log if entry["action"] in ["assigned", "team_assigned", "team_assigned_primary"]]

    if len(assignment_entries) < 1:  # We should have at least 1 assignment entry
        print(f"❌ No assignment audit entries are present, got {len(assignment_entries)}")
        return False

    print(f"✅ Found {len(assignment_entries)} assignment audit entries")
    for i, entry in enumerate(assignment_entries):
        print(f"   {i+1}. Action: {entry['action']}, Time: {entry['timestamp']}")
        if "details" in entry:
            print(f"      Details: {entry['details']}")

    # Step 7: Login as team lead and update the ticket
    print("\nStep 7: Logging in as team lead...")
    team_lead_cookies = login(TEAM_LEAD_CREDENTIALS)

    print("Updating ticket as team lead...")
    update_data = {
        "status": "in_progress",
        "priority": "high"
    }

    updated_ticket = update_ticket(team_lead_cookies, ticket_id, update_data)
    if not updated_ticket:
        print("❌ Failed to update ticket as team lead")
        return False

    if updated_ticket["status"] != "in_progress" or updated_ticket["priority"] != "high":
        print(f"❌ Ticket not updated correctly by team lead")
        return False

    print(f"✅ Updated ticket as team lead")
    print(f"   New status: {updated_ticket['status']}")
    print(f"   New priority: {updated_ticket['priority']}")

    print("\n=== Ticket Assignment Test Completed Successfully ===")
    return True

if __name__ == "__main__":
    success = test_ticket_assignment()
    sys.exit(0 if success else 1)
