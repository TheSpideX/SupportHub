#!/usr/bin/env python3
"""
Test Script for Ticket and SLA System Integration
This script tests the integration between the ticket system and SLA system
"""

import requests
import json
import time
from datetime import datetime, timedelta
import sys
import os
from pprint import pprint

# Configuration
BASE_URL = "http://localhost:4290"  # Backend server URL
ADMIN_CREDENTIALS = {
    "email": "admin@example.com",
    "password": "Admin@123"
}
TEAM_LEAD_CREDENTIALS = {
    "email": "teamlead@example.com",
    "password": "TeamLead@123"
}
TEAM_MEMBER_CREDENTIALS = {
    "email": "teammember@example.com",
    "password": "Member@123"
}

# Global variables
admin_token = None
team_lead_token = None
team_member_token = None
admin_id = None
team_lead_id = None
team_member_id = None
organization_id = None
team_id = None
sla_policy_id = None
ticket_id = None

# Helper functions
def login(credentials):
    """Login and get authentication token"""
    url = f"{BASE_URL}/api/auth/login"
    response = requests.post(url, json=credentials)
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        return None
    
    data = response.json()
    return {
        "token": data.get("token"),
        "user_id": data.get("user", {}).get("_id"),
        "organization_id": data.get("user", {}).get("organizationId")
    }

def make_request(method, endpoint, token=None, data=None, params=None):
    """Make an API request with authentication"""
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    if method.lower() == "get":
        response = requests.get(url, headers=headers, params=params)
    elif method.lower() == "post":
        response = requests.post(url, headers=headers, json=data)
    elif method.lower() == "put":
        response = requests.put(url, headers=headers, json=data)
    elif method.lower() == "delete":
        response = requests.delete(url, headers=headers)
    else:
        raise ValueError(f"Unsupported HTTP method: {method}")
    
    return response

def print_section(title):
    """Print a section title"""
    print("\n" + "="*80)
    print(f" {title} ".center(80, "="))
    print("="*80)

def print_result(test_name, success, message="", data=None):
    """Print test result"""
    status = "✅ PASSED" if success else "❌ FAILED"
    print(f"\n{status} - {test_name}")
    if message:
        print(f"  {message}")
    if data:
        print("  Data:")
        if isinstance(data, dict) or isinstance(data, list):
            pprint(data, indent=4, width=100)
        else:
            print(f"  {data}")

# Test functions
def test_authentication():
    """Test authentication for different user roles"""
    global admin_token, team_lead_token, team_member_token
    global admin_id, team_lead_id, team_member_id, organization_id
    
    print_section("Testing Authentication")
    
    # Admin login
    admin_auth = login(ADMIN_CREDENTIALS)
    if admin_auth:
        admin_token = admin_auth["token"]
        admin_id = admin_auth["user_id"]
        organization_id = admin_auth["organization_id"]
        print_result("Admin Login", True, f"Admin ID: {admin_id}, Organization ID: {organization_id}")
    else:
        print_result("Admin Login", False, "Failed to login as admin")
        sys.exit(1)
    
    # Team Lead login
    team_lead_auth = login(TEAM_LEAD_CREDENTIALS)
    if team_lead_auth:
        team_lead_token = team_lead_auth["token"]
        team_lead_id = team_lead_auth["user_id"]
        print_result("Team Lead Login", True, f"Team Lead ID: {team_lead_id}")
    else:
        print_result("Team Lead Login", False, "Failed to login as team lead")
        sys.exit(1)
    
    # Team Member login
    team_member_auth = login(TEAM_MEMBER_CREDENTIALS)
    if team_member_auth:
        team_member_token = team_member_auth["token"]
        team_member_id = team_member_auth["user_id"]
        print_result("Team Member Login", True, f"Team Member ID: {team_member_id}")
    else:
        print_result("Team Member Login", False, "Failed to login as team member")
        sys.exit(1)

def test_create_team():
    """Test creating a team for ticket assignment"""
    global team_id
    
    print_section("Testing Team Creation")
    
    # Create a technical team
    team_data = {
        "name": f"Test Technical Team {int(time.time())}",
        "description": "Team for testing ticket-SLA integration",
        "teamType": "technical"
    }
    
    response = make_request("post", "/api/teams", admin_token, team_data)
    
    if response.status_code == 201:
        team_id = response.json().get("data", {}).get("_id")
        print_result("Create Team", True, f"Team ID: {team_id}", response.json().get("data"))
    else:
        print_result("Create Team", False, f"Status code: {response.status_code}", response.json())
        sys.exit(1)

def test_create_sla_policy():
    """Test creating an SLA policy"""
    global sla_policy_id
    
    print_section("Testing SLA Policy Creation")
    
    # Create an SLA policy
    sla_policy_data = {
        "name": f"Test SLA Policy {int(time.time())}",
        "description": "SLA policy for testing ticket-SLA integration",
        "responseTime": {
            "low": 240,      # 4 hours in minutes
            "medium": 120,   # 2 hours in minutes
            "high": 60,      # 1 hour in minutes
            "critical": 30   # 30 minutes
        },
        "resolutionTime": {
            "low": 4320,     # 3 days in minutes
            "medium": 1440,  # 1 day in minutes
            "high": 480,     # 8 hours in minutes
            "critical": 240  # 4 hours in minutes
        }
    }
    
    response = make_request("post", "/api/sla/policies", admin_token, sla_policy_data)
    
    if response.status_code == 201:
        sla_policy_id = response.json().get("data", {}).get("_id")
        print_result("Create SLA Policy", True, f"SLA Policy ID: {sla_policy_id}", response.json().get("data"))
    else:
        print_result("Create SLA Policy", False, f"Status code: {response.status_code}", response.json())
        sys.exit(1)

def test_create_ticket_with_sla():
    """Test creating a ticket with SLA policy"""
    global ticket_id
    
    print_section("Testing Ticket Creation with SLA")
    
    # Create a ticket with SLA policy
    ticket_data = {
        "title": f"Test Ticket with SLA {int(time.time())}",
        "description": "This is a test ticket for testing ticket-SLA integration",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": sla_policy_id
    }
    
    response = make_request("post", "/api/tickets", team_lead_token, ticket_data)
    
    if response.status_code == 201:
        ticket_id = response.json().get("data", {}).get("_id")
        ticket_data = response.json().get("data", {})
        print_result("Create Ticket with SLA", True, f"Ticket ID: {ticket_id}", ticket_data)
        
        # Check if SLA was applied
        if ticket_data.get("sla"):
            sla_data = ticket_data.get("sla")
            print_result("SLA Applied During Creation", True, "SLA data found in ticket", sla_data)
        else:
            print_result("SLA Applied During Creation", False, "No SLA data found in ticket")
    else:
        print_result("Create Ticket with SLA", False, f"Status code: {response.status_code}", response.json())
        sys.exit(1)

def test_ticket_lifecycle_with_sla():
    """Test ticket lifecycle with SLA integration"""
    print_section("Testing Ticket Lifecycle with SLA Integration")
    
    if not ticket_id:
        print_result("Ticket Lifecycle Test", False, "No ticket ID available")
        return
    
    # Step 1: Assign ticket to team
    assign_team_data = {
        "teamId": team_id,
        "isPrimary": True
    }
    
    response = make_request("post", f"/api/tickets/{ticket_id}/assign-team", admin_token, assign_team_data)
    
    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Assign Ticket to Team", True, 
                    f"Ticket assigned to team: {team_id}", 
                    {"ticket": ticket_data.get("ticketNumber"), "team": ticket_data.get("primaryTeam")})
    else:
        print_result("Assign Ticket to Team", False, f"Status code: {response.status_code}", response.json())
    
    # Step 2: Assign ticket to team member
    assign_data = {
        "assigneeId": team_member_id
    }
    
    response = make_request("post", f"/api/tickets/{ticket_id}/assign", team_lead_token, assign_data)
    
    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Assign Ticket to Team Member", True, 
                    f"Ticket assigned to team member: {team_member_id}", 
                    {"ticket": ticket_data.get("ticketNumber"), "assignedTo": ticket_data.get("assignedTo")})
    else:
        print_result("Assign Ticket to Team Member", False, f"Status code: {response.status_code}", response.json())
    
    # Step 3: Add a comment (first response)
    comment_data = {
        "text": f"This is a test comment for first response - {int(time.time())}",
        "isInternal": False
    }
    
    response = make_request("post", f"/api/tickets/{ticket_id}/comments", team_member_token, comment_data)
    
    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        comments = ticket_data.get("comments", [])
        print_result("Add First Response Comment", True, 
                    f"Comment added successfully. Total comments: {len(comments)}", 
                    comments[-1] if comments else None)
        
        # Check if this affects SLA response time
        if ticket_data.get("sla"):
            sla_data = ticket_data.get("sla")
            print_result("SLA After First Response", True, "SLA data after first response", sla_data)
        else:
            print_result("SLA After First Response", False, "No SLA data found in ticket")
    else:
        print_result("Add First Response Comment", False, f"Status code: {response.status_code}", response.json())
    
    # Step 4: Change status to in progress
    update_data = {
        "status": "in_progress"
    }
    
    response = make_request("put", f"/api/tickets/{ticket_id}", team_member_token, update_data)
    
    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Change Status to In Progress", True, 
                    f"Ticket status changed to {ticket_data.get('status')}", 
                    {"ticket": ticket_data.get("ticketNumber"), "status": ticket_data.get("status")})
    else:
        print_result("Change Status to In Progress", False, f"Status code: {response.status_code}", response.json())
    
    # Step 5: Pause SLA
    pause_data = {
        "reason": "Testing SLA pause during ticket lifecycle"
    }
    
    response = make_request("post", f"/api/sla/pause/{ticket_id}", team_member_token, pause_data)
    
    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Pause SLA", True, "SLA paused successfully", ticket_data.get("sla"))
    else:
        print_result("Pause SLA", False, f"Status code: {response.status_code}", response.json())
    
    # Step 6: Add another comment while SLA is paused
    comment_data = {
        "text": f"This is a test comment while SLA is paused - {int(time.time())}",
        "isInternal": True
    }
    
    response = make_request("post", f"/api/tickets/{ticket_id}/comments", team_member_token, comment_data)
    
    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        comments = ticket_data.get("comments", [])
        print_result("Add Comment While SLA Paused", True, 
                    f"Comment added successfully. Total comments: {len(comments)}", 
                    comments[-1] if comments else None)
    else:
        print_result("Add Comment While SLA Paused", False, f"Status code: {response.status_code}", response.json())
    
    # Step 7: Resume SLA
    response = make_request("post", f"/api/sla/resume/{ticket_id}", team_member_token)
    
    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Resume SLA", True, "SLA resumed successfully", ticket_data.get("sla"))
    else:
        print_result("Resume SLA", False, f"Status code: {response.status_code}", response.json())
    
    # Step 8: Change status to resolved
    update_data = {
        "status": "resolved"
    }
    
    response = make_request("put", f"/api/tickets/{ticket_id}", team_member_token, update_data)
    
    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Change Status to Resolved", True, 
                    f"Ticket status changed to {ticket_data.get('status')}", 
                    {"ticket": ticket_data.get("ticketNumber"), "status": ticket_data.get("status")})
        
        # Check if this affects SLA resolution time
        if ticket_data.get("sla"):
            sla_data = ticket_data.get("sla")
            print_result("SLA After Resolution", True, "SLA data after resolution", sla_data)
        else:
            print_result("SLA After Resolution", False, "No SLA data found in ticket")
    else:
        print_result("Change Status to Resolved", False, f"Status code: {response.status_code}", response.json())
    
    # Step 9: Change status to closed
    update_data = {
        "status": "closed"
    }
    
    response = make_request("put", f"/api/tickets/{ticket_id}", admin_token, update_data)
    
    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Change Status to Closed", True, 
                    f"Ticket status changed to {ticket_data.get('status')}", 
                    {"ticket": ticket_data.get("ticketNumber"), "status": ticket_data.get("status")})
    else:
        print_result("Change Status to Closed", False, f"Status code: {response.status_code}", response.json())

def test_ticket_audit_log_for_sla_events():
    """Test ticket audit log for SLA-related events"""
    print_section("Testing Ticket Audit Log for SLA Events")
    
    if not ticket_id:
        print_result("Audit Log Test", False, "No ticket ID available")
        return
    
    response = make_request("get", f"/api/tickets/{ticket_id}", admin_token)
    
    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        audit_log = ticket_data.get("auditLog", [])
        
        # Filter SLA-related events
        sla_events = [entry for entry in audit_log if "sla" in entry.get("action", "").lower()]
        
        if sla_events:
            print_result("SLA Events in Audit Log", True, 
                        f"Found {len(sla_events)} SLA-related events in audit log", 
                        sla_events)
        else:
            print_result("SLA Events in Audit Log", False, 
                        "No SLA-related events found in audit log", 
                        {"allEvents": [entry.get("action") for entry in audit_log]})
    else:
        print_result("Get Ticket Audit Log", False, f"Status code: {response.status_code}", response.json())

def test_sla_metrics_and_reporting():
    """Test SLA metrics and reporting"""
    print_section("Testing SLA Metrics and Reporting")
    
    # Get SLA metrics for organization
    response = make_request("get", "/api/sla/metrics", admin_token)
    
    if response.status_code == 200:
        metrics = response.json().get("data", {})
        print_result("Get SLA Metrics", True, "SLA metrics retrieved successfully", metrics)
    else:
        # If the endpoint doesn't exist, this is expected
        print_result("Get SLA Metrics", False, 
                    f"Status code: {response.status_code}", 
                    {"message": "SLA metrics endpoint may not be implemented yet"})
    
    # Get tickets with SLA filters
    params = {
        "slaBreached": "false",
        "slaApproaching": "false"
    }
    
    response = make_request("get", "/api/tickets", admin_token, params=params)
    
    if response.status_code == 200:
        tickets = response.json().get("data", [])
        print_result("Get Tickets with SLA Filters", True, 
                    f"Found {len(tickets)} tickets matching SLA filters", 
                    {"count": len(tickets), "filters": params})
    else:
        print_result("Get Tickets with SLA Filters", False, 
                    f"Status code: {response.status_code}", response.json())

def run_all_tests():
    """Run all tests in sequence"""
    try:
        test_authentication()
        test_create_team()
        test_create_sla_policy()
        test_create_ticket_with_sla()
        test_ticket_lifecycle_with_sla()
        test_ticket_audit_log_for_sla_events()
        test_sla_metrics_and_reporting()
        
        print_section("Test Summary")
        print("All tests completed. Check the results above for details.")
    except Exception as e:
        print(f"\n❌ ERROR: An exception occurred during testing: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_all_tests()
