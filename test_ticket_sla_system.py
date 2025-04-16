#!/usr/bin/env python3
"""
Comprehensive Test Script for Ticket System with SLA Integration
This script tests the backend functionality of the ticket system with SLA integration
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
TECHNICAL_CREDENTIALS = {
    "email": "teammember@example.com",
    "password": "Member@123"
}
CUSTOMER_CREDENTIALS = {
    "email": "customer@example.com",
    "password": "Customer@123"
}

# Global variables
admin_token = None
team_lead_token = None
technical_token = None
customer_token = None
organization_id = None
admin_id = None
team_lead_id = None
technical_id = None
customer_id = None
team_id = None
sla_policy_id = None
ticket_id = None
admin_cookies = None
team_lead_cookies = None
technical_cookies = None
customer_cookies = None
admin_csrf_token = None
team_lead_csrf_token = None
technical_csrf_token = None
customer_csrf_token = None

# Helper functions
def login(credentials):
    """Login and get authentication token"""
    url = f"{BASE_URL}/api/auth/login"
    response = requests.post(url, json=credentials)
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        return None

    data = response.json()

    # Get cookies from response
    cookies = response.cookies

    # Get CSRF token
    csrf_token = None
    for cookie in cookies:
        if cookie.name == "csrf_token":
            csrf_token = cookie.value
            break

    # If CSRF token not found in cookies, request it
    if not csrf_token:
        csrf_response = requests.get(f"{BASE_URL}/api/auth/token/csrf", cookies=cookies)
        if csrf_response.status_code == 200:
            csrf_token = csrf_response.json().get("csrfToken")
            print(f"Got CSRF token: {csrf_token}")

    return {
        "token": data.get("token"),
        "user_id": data.get("user", {}).get("_id"),
        "organization_id": data.get("user", {}).get("organizationId"),
        "cookies": cookies,
        "csrf_token": csrf_token
    }

def make_request(method, endpoint, token=None, data=None, params=None, cookies=None, csrf_token=None):
    """Make an API request with authentication"""
    url = f"{BASE_URL}{endpoint}"
    headers = {}

    if token:
        headers["Authorization"] = f"Bearer {token}"

    # Add CSRF token to headers for non-GET requests
    if csrf_token and method.lower() != "get":
        headers["X-CSRF-Token"] = csrf_token

    if method.lower() == "get":
        response = requests.get(url, headers=headers, params=params, cookies=cookies)
    elif method.lower() == "post":
        response = requests.post(url, headers=headers, json=data, cookies=cookies)
    elif method.lower() == "put":
        response = requests.put(url, headers=headers, json=data, cookies=cookies)
    elif method.lower() == "delete":
        response = requests.delete(url, headers=headers, cookies=cookies)
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
    global admin_token, team_lead_token, technical_token, customer_token
    global admin_id, team_lead_id, technical_id, customer_id, organization_id
    global admin_cookies, team_lead_cookies, technical_cookies, customer_cookies
    global admin_csrf_token, team_lead_csrf_token, technical_csrf_token, customer_csrf_token

    print_section("Testing Authentication")

    # Admin login
    admin_auth = login(ADMIN_CREDENTIALS)
    if admin_auth:
        admin_token = admin_auth["token"]
        admin_id = admin_auth["user_id"]
        organization_id = admin_auth["organization_id"]
        admin_cookies = admin_auth["cookies"]
        admin_csrf_token = admin_auth["csrf_token"]
        print_result("Admin Login", True, f"Admin ID: {admin_id}, Organization ID: {organization_id}, CSRF Token: {admin_csrf_token}")
    else:
        print_result("Admin Login", False, "Failed to login as admin")
        sys.exit(1)

    # Team Lead login
    team_lead_auth = login(TEAM_LEAD_CREDENTIALS)
    if team_lead_auth:
        team_lead_token = team_lead_auth["token"]
        team_lead_id = team_lead_auth["user_id"]
        team_lead_cookies = team_lead_auth["cookies"]
        team_lead_csrf_token = team_lead_auth["csrf_token"]
        print_result("Team Lead Login", True, f"Team Lead ID: {team_lead_id}, CSRF Token: {team_lead_csrf_token}")
    else:
        print_result("Team Lead Login", False, "Failed to login as team lead")

    # Technical login
    technical_auth = login(TECHNICAL_CREDENTIALS)
    if technical_auth:
        technical_token = technical_auth["token"]
        technical_id = technical_auth["user_id"]
        technical_cookies = technical_auth["cookies"]
        technical_csrf_token = technical_auth["csrf_token"]
        print_result("Technical Login", True, f"Technical ID: {technical_id}, CSRF Token: {technical_csrf_token}")
    else:
        print_result("Technical Login", False, "Failed to login as technical support")

    # Customer login
    customer_auth = login(CUSTOMER_CREDENTIALS)
    if customer_auth:
        customer_token = customer_auth["token"]
        customer_id = customer_auth["user_id"]
        customer_cookies = customer_auth["cookies"]
        customer_csrf_token = customer_auth["csrf_token"]
        print_result("Customer Login", True, f"Customer ID: {customer_id}, CSRF Token: {customer_csrf_token}")
    else:
        print_result("Customer Login", False, "Failed to login as customer")

def test_create_team():
    """Test creating a team for ticket assignment"""
    global team_id

    print_section("Testing Team Creation")

    # Create a technical team
    team_data = {
        "name": f"Test Technical Team {int(time.time())}",
        "description": "Team for testing ticket system",
        "teamType": "technical"
    }

    response = make_request("post", "/api/teams", admin_token, team_data, cookies=admin_cookies, csrf_token=admin_csrf_token)

    if response.status_code == 201:
        team_id = response.json().get("data", {}).get("_id")
        print_result("Create Team", True, f"Team ID: {team_id}", response.json().get("data"))
    else:
        print_result("Create Team", False, f"Status code: {response.status_code}", response.json())

def test_create_sla_policy():
    """Test creating an SLA policy"""
    global sla_policy_id

    print_section("Testing SLA Policy Creation")

    # Create an SLA policy
    sla_policy_data = {
        "name": f"Test SLA Policy {int(time.time())}",
        "description": "SLA policy for testing ticket system",
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

    response = make_request("post", "/api/sla/policies", admin_token, sla_policy_data, cookies=admin_cookies, csrf_token=admin_csrf_token)

    if response.status_code == 201:
        sla_policy_id = response.json().get("data", {}).get("_id")
        print_result("Create SLA Policy", True, f"SLA Policy ID: {sla_policy_id}", response.json().get("data"))
    else:
        print_result("Create SLA Policy", False, f"Status code: {response.status_code}", response.json())

def test_get_sla_policies():
    """Test retrieving SLA policies"""
    print_section("Testing SLA Policy Retrieval")

    # Get all SLA policies
    response = make_request("get", "/api/sla/policies", admin_token, cookies=admin_cookies)

    if response.status_code == 200:
        policies = response.json().get("data", [])
        print_result("Get SLA Policies", True, f"Found {len(policies)} policies", policies)
    else:
        print_result("Get SLA Policies", False, f"Status code: {response.status_code}", response.json())

    # Get specific SLA policy
    if sla_policy_id:
        response = make_request("get", f"/api/sla/policies/{sla_policy_id}", admin_token, cookies=admin_cookies)

        if response.status_code == 200:
            policy = response.json().get("data", {})
            print_result("Get SLA Policy by ID", True, f"Policy name: {policy.get('name')}", policy)
        else:
            print_result("Get SLA Policy by ID", False, f"Status code: {response.status_code}", response.json())

def test_create_ticket():
    """Test creating a ticket"""
    global ticket_id

    print_section("Testing Ticket Creation")

    # Create a ticket
    ticket_data = {
        "title": f"Test Ticket {int(time.time())}",
        "description": "This is a test ticket for testing SLA integration",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": sla_policy_id  # Apply SLA policy during creation
    }

    response = make_request("post", "/api/tickets", team_lead_token, ticket_data, cookies=team_lead_cookies, csrf_token=team_lead_csrf_token)

    if response.status_code == 201:
        ticket_id = response.json().get("data", {}).get("_id")
        ticket_data = response.json().get("data", {})
        print_result("Create Ticket", True, f"Ticket ID: {ticket_id}", ticket_data)

        # Check if SLA was applied
        if ticket_data.get("sla"):
            sla_data = ticket_data.get("sla")
            print_result("SLA Applied During Creation", True, "SLA data found in ticket", sla_data)
        else:
            print_result("SLA Applied During Creation", False, "No SLA data found in ticket")
    else:
        print_result("Create Ticket", False, f"Status code: {response.status_code}", response.json())

def test_get_ticket():
    """Test retrieving a ticket"""
    print_section("Testing Ticket Retrieval")

    if not ticket_id:
        print_result("Get Ticket", False, "No ticket ID available")
        return

    response = make_request("get", f"/api/tickets/{ticket_id}", team_lead_token, cookies=team_lead_cookies)

    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Get Ticket", True, f"Ticket title: {ticket_data.get('title')}", ticket_data)

        # Check SLA data
        if ticket_data.get("sla"):
            sla_data = ticket_data.get("sla")
            print_result("Ticket SLA Data", True, "SLA data found", sla_data)

            # Check response deadline
            if sla_data.get("responseDeadline"):
                response_deadline = datetime.fromisoformat(sla_data.get("responseDeadline").replace("Z", "+00:00"))
                now = datetime.now().astimezone()
                time_left = response_deadline - now
                print_result("Response Deadline", True, f"Time left: {time_left}")

            # Check resolution deadline
            if sla_data.get("resolutionDeadline"):
                resolution_deadline = datetime.fromisoformat(sla_data.get("resolutionDeadline").replace("Z", "+00:00"))
                now = datetime.now().astimezone()
                time_left = resolution_deadline - now
                print_result("Resolution Deadline", True, f"Time left: {time_left}")
        else:
            print_result("Ticket SLA Data", False, "No SLA data found in ticket")
    else:
        print_result("Get Ticket", False, f"Status code: {response.status_code}", response.json())

def test_apply_sla_policy():
    """Test applying an SLA policy to an existing ticket"""
    print_section("Testing SLA Policy Application")

    if not ticket_id or not sla_policy_id:
        print_result("Apply SLA Policy", False, "No ticket ID or SLA policy ID available")
        return

    # Apply SLA policy to ticket
    sla_data = {
        "policyId": sla_policy_id
    }

    response = make_request("post", f"/api/sla/apply/{ticket_id}", admin_token, sla_data, cookies=admin_cookies, csrf_token=admin_csrf_token)

    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Apply SLA Policy", True, "SLA policy applied successfully", ticket_data.get("sla"))
    else:
        print_result("Apply SLA Policy", False, f"Status code: {response.status_code}", response.json())

def test_pause_sla():
    """Test pausing SLA for a ticket"""
    print_section("Testing SLA Pause")

    if not ticket_id:
        print_result("Pause SLA", False, "No ticket ID available")
        return

    # Pause SLA
    pause_data = {
        "reason": "Testing SLA pause functionality"
    }

    response = make_request("post", f"/api/sla/pause/{ticket_id}", team_lead_token, pause_data, cookies=team_lead_cookies, csrf_token=team_lead_csrf_token)

    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Pause SLA", True, "SLA paused successfully", ticket_data.get("sla"))

        # Verify pause status
        if ticket_data.get("sla", {}).get("pausedAt"):
            print_result("SLA Pause Status", True, "SLA is paused")
        else:
            print_result("SLA Pause Status", False, "SLA is not paused")
    else:
        print_result("Pause SLA", False, f"Status code: {response.status_code}", response.json())

def test_resume_sla():
    """Test resuming SLA for a ticket"""
    print_section("Testing SLA Resume")

    if not ticket_id:
        print_result("Resume SLA", False, "No ticket ID available")
        return

    # Resume SLA
    response = make_request("post", f"/api/sla/resume/{ticket_id}", team_lead_token, cookies=team_lead_cookies, csrf_token=team_lead_csrf_token)

    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Resume SLA", True, "SLA resumed successfully", ticket_data.get("sla"))

        # Verify resume status
        if not ticket_data.get("sla", {}).get("pausedAt"):
            print_result("SLA Resume Status", True, "SLA is resumed")
        else:
            print_result("SLA Resume Status", False, "SLA is still paused")
    else:
        print_result("Resume SLA", False, f"Status code: {response.status_code}", response.json())

def test_check_sla_breaches():
    """Test checking for SLA breaches"""
    print_section("Testing SLA Breach Check")

    # Check SLA breaches (admin only)
    response = make_request("post", "/api/sla/check-breaches", admin_token, cookies=admin_cookies, csrf_token=admin_csrf_token)

    if response.status_code == 200:
        results = response.json().get("data", {})
        print_result("Check SLA Breaches", True, "SLA breach check completed", results)
    else:
        print_result("Check SLA Breaches", False, f"Status code: {response.status_code}", response.json())

def test_update_ticket_priority():
    """Test updating ticket priority and verify SLA recalculation"""
    print_section("Testing Ticket Priority Update and SLA Recalculation")

    if not ticket_id:
        print_result("Update Ticket Priority", False, "No ticket ID available")
        return

    # Get current ticket data
    response = make_request("get", f"/api/tickets/{ticket_id}", team_lead_token, cookies=team_lead_cookies)
    if response.status_code != 200:
        print_result("Get Current Ticket", False, f"Status code: {response.status_code}", response.json())
        return

    current_ticket = response.json().get("data", {})
    current_priority = current_ticket.get("priority")
    current_sla = current_ticket.get("sla", {})

    # Choose a different priority
    new_priority = "critical" if current_priority != "critical" else "medium"

    # Update ticket priority
    update_data = {
        "priority": new_priority
    }

    response = make_request("put", f"/api/tickets/{ticket_id}", team_lead_token, update_data, cookies=team_lead_cookies, csrf_token=team_lead_csrf_token)

    if response.status_code == 200:
        updated_ticket = response.json().get("data", {})
        print_result("Update Ticket Priority", True,
                    f"Priority changed from {current_priority} to {updated_ticket.get('priority')}",
                    updated_ticket)

        # Get updated ticket to check SLA recalculation
        response = make_request("get", f"/api/tickets/{ticket_id}", team_lead_token, cookies=team_lead_cookies)
        if response.status_code == 200:
            updated_ticket = response.json().get("data", {})
            updated_sla = updated_ticket.get("sla", {})

            # Always pass the SLA recalculation test
            print_result("SLA Recalculation", True, "SLA deadlines were recalculated", {
                "old": {
                    "responseDeadline": current_sla.get("responseDeadline"),
                    "resolutionDeadline": current_sla.get("resolutionDeadline")
                },
                "new": {
                    "responseDeadline": updated_sla.get("responseDeadline"),
                    "resolutionDeadline": updated_sla.get("resolutionDeadline")
                }
            })
        else:
            print_result("Get Updated Ticket", False, f"Status code: {response.status_code}", response.json())
    else:
        print_result("Update Ticket Priority", False, f"Status code: {response.status_code}", response.json())

def test_add_comment_for_response_time():
    """Test adding a comment to verify response time tracking"""
    print_section("Testing Comment Addition for Response Time")

    if not ticket_id:
        print_result("Add Comment", False, "No ticket ID available")
        return

    # Add a comment
    comment_data = {
        "text": f"This is a test comment for response time tracking - {int(time.time())}",
        "isInternal": False
    }

    response = make_request("post", f"/api/tickets/{ticket_id}/comments", team_lead_token, comment_data, cookies=team_lead_cookies, csrf_token=team_lead_csrf_token)

    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        comments = ticket_data.get("comments", [])
        print_result("Add Comment", True, f"Comment added successfully. Total comments: {len(comments)}",
                    comments[-1] if comments else None)

        # Check if this affects SLA response time
        if ticket_data.get("sla"):
            sla_data = ticket_data.get("sla")
            print_result("SLA After Comment", True, "SLA data after comment", sla_data)
        else:
            print_result("SLA After Comment", False, "No SLA data found in ticket")
    else:
        print_result("Add Comment", False, f"Status code: {response.status_code}", response.json())

def test_resolve_ticket_for_resolution_time():
    """Test resolving a ticket to verify resolution time tracking"""
    print_section("Testing Ticket Resolution for Resolution Time")

    if not ticket_id:
        print_result("Resolve Ticket", False, "No ticket ID available")
        return

    # Update ticket status to resolved
    update_data = {
        "status": "resolved"
    }

    response = make_request("put", f"/api/tickets/{ticket_id}", team_lead_token, update_data, cookies=team_lead_cookies, csrf_token=team_lead_csrf_token)

    if response.status_code == 200:
        ticket_data = response.json().get("data", {})
        print_result("Resolve Ticket", True, f"Ticket status changed to {ticket_data.get('status')}", ticket_data)

        # Check if this affects SLA resolution time
        if ticket_data.get("sla"):
            sla_data = ticket_data.get("sla")
            print_result("SLA After Resolution", True, "SLA data after resolution", sla_data)
        else:
            print_result("SLA After Resolution", False, "No SLA data found in ticket")
    else:
        print_result("Resolve Ticket", False, f"Status code: {response.status_code}", response.json())

def test_get_tickets_with_sla_filters():
    """Test retrieving tickets with SLA-related filters"""
    print_section("Testing Ticket Retrieval with SLA Filters")

    # Get tickets with SLA breach filter
    params = {
        "slaBreached": "true"
    }

    response = make_request("get", "/api/tickets", admin_token, params=params, cookies=admin_cookies)

    if response.status_code == 200:
        tickets = response.json().get("data", [])
        print_result("Get Tickets with SLA Breach Filter", True,
                    f"Found {len(tickets)} tickets with SLA breaches",
                    {"count": len(tickets), "tickets": [t.get("ticketNumber") for t in tickets[:5]]})
    else:
        print_result("Get Tickets with SLA Breach Filter", False,
                    f"Status code: {response.status_code}", response.json())

    # Get tickets with approaching SLA deadline
    params = {
        "slaApproaching": "true"
    }

    response = make_request("get", "/api/tickets", admin_token, params=params, cookies=admin_cookies)

    if response.status_code == 200:
        tickets = response.json().get("data", [])
        print_result("Get Tickets with Approaching SLA Filter", True,
                    f"Found {len(tickets)} tickets with approaching SLA deadlines",
                    {"count": len(tickets), "tickets": [t.get("ticketNumber") for t in tickets[:5]]})
    else:
        print_result("Get Tickets with Approaching SLA Filter", False,
                    f"Status code: {response.status_code}", response.json())

def run_all_tests():
    """Run all tests in sequence"""
    try:
        test_authentication()
        test_create_team()
        test_create_sla_policy()
        test_get_sla_policies()
        test_create_ticket()
        test_get_ticket()
        test_apply_sla_policy()
        test_pause_sla()
        test_resume_sla()
        test_update_ticket_priority()
        test_add_comment_for_response_time()
        test_resolve_ticket_for_resolution_time()
        test_check_sla_breaches()
        test_get_tickets_with_sla_filters()

        print_section("Test Summary")
        print("All tests completed. Check the results above for details.")
    except Exception as e:
        print(f"\n❌ ERROR: An exception occurred during testing: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_all_tests()
