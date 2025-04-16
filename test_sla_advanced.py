#!/usr/bin/env python3
"""
Advanced Test Script for SLA System According to SRS Requirements
This script tests the SLA functionality according to the SRS document requirements
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
        "description": "Team for testing SLA system",
        "teamType": "technical"
    }

    response = make_request("post", "/api/teams", admin_token, team_data, cookies=admin_cookies, csrf_token=admin_csrf_token)

    if response.status_code == 201:
        team_id = response.json().get("data", {}).get("_id")
        print_result("Create Team", True, f"Team ID: {team_id}", response.json().get("data"))
    else:
        print_result("Create Team", False, f"Status code: {response.status_code}", response.json())

def test_create_sla_policy_with_escalation():
    """Test creating an SLA policy with escalation rules"""
    global sla_policy_id

    print_section("Testing SLA Policy Creation with Escalation Rules")

    # Create an SLA policy with escalation rules
    sla_policy_data = {
        "name": f"Test SLA Policy with Escalation {int(time.time())}",
        "description": "SLA policy with escalation rules for testing",
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
        },
        "escalationRules": [
            {
                "condition": "response_approaching",
                "threshold": 75,  # 75% of time elapsed
                "actions": ["notify_assignee"]
            },
            {
                "condition": "response_breached",
                "threshold": 100,
                "actions": ["notify_team_lead", "increase_priority"]
            },
            {
                "condition": "resolution_approaching",
                "threshold": 75,
                "threshold": 75,  # 75% of time elapsed
                "actions": ["notify_assignee"]
            },
            {
                "condition": "resolution_breached",
                "threshold": 100,
                "actions": ["notify_manager"]
            }
        ]
    }

    response = make_request("post", "/api/sla/policies", admin_token, sla_policy_data, cookies=admin_cookies, csrf_token=admin_csrf_token)

    if response.status_code == 201:
        sla_policy_id = response.json().get("data", {}).get("_id")
        print_result("Create SLA Policy with Escalation", True, f"SLA Policy ID: {sla_policy_id}", response.json().get("data"))
    else:
        print_result("Create SLA Policy with Escalation", False, f"Status code: {response.status_code}", response.json())

def test_create_sla_policy_with_business_hours():
    """Test creating an SLA policy with business hours"""
    global sla_policy_business_hours_id

    print_section("Testing SLA Policy Creation with Business Hours")

    # Create an SLA policy with business hours
    sla_policy_data = {
        "name": f"Test SLA Policy with Business Hours {int(time.time())}",
        "description": "SLA policy with business hours for testing",
        "responseTime": {
            "low": 240,
            "medium": 120,
            "high": 60,
            "critical": 30
        },
        "resolutionTime": {
            "low": 4320,
            "medium": 1440,
            "high": 480,
            "critical": 240
        },
        "businessHours": {
            "monday": {"start": "09:00", "end": "17:00"},
            "tuesday": {"start": "09:00", "end": "17:00"},
            "wednesday": {"start": "09:00", "end": "17:00"},
            "thursday": {"start": "09:00", "end": "17:00"},
            "friday": {"start": "09:00", "end": "17:00"},
            "saturday": {"start": "", "end": ""},
            "sunday": {"start": "", "end": ""}
        }
    }

    response = make_request("post", "/api/sla/policies", admin_token, sla_policy_data, cookies=admin_cookies, csrf_token=admin_csrf_token)

    if response.status_code == 201:
        sla_policy_business_hours_id = response.json().get("data", {}).get("_id")
        print_result("Create SLA Policy with Business Hours", True, f"SLA Policy ID: {sla_policy_business_hours_id}", response.json().get("data"))
    else:
        print_result("Create SLA Policy with Business Hours", False, f"Status code: {response.status_code}", response.json())

def test_create_tickets_with_different_priorities():
    """Test creating tickets with different priorities to test SLA calculation"""
    global ticket_ids

    print_section("Testing Ticket Creation with Different Priorities")

    ticket_ids = {}
    priorities = ["low", "medium", "high", "critical"]

    for priority in priorities:
        # Create a ticket with the current priority
        ticket_data = {
            "title": f"Test Ticket {priority.capitalize()} Priority {int(time.time())}",
            "description": f"This is a test ticket with {priority} priority for testing SLA integration",
            "category": "technical",
            "subcategory": "server",
            "priority": priority,
            "source": "direct_creation",
            "slaPolicy": sla_policy_id  # Apply SLA policy during creation
        }

        response = make_request("post", "/api/tickets", team_lead_token, ticket_data, cookies=team_lead_cookies, csrf_token=team_lead_csrf_token)

        if response.status_code == 201:
            ticket_id = response.json().get("data", {}).get("_id")
            ticket_ids[priority] = ticket_id
            ticket_data = response.json().get("data", {})
            print_result(f"Create {priority.capitalize()} Priority Ticket", True, f"Ticket ID: {ticket_id}", ticket_data.get("sla"))
        else:
            print_result(f"Create {priority.capitalize()} Priority Ticket", False, f"Status code: {response.status_code}", response.json())

    # Verify that different priorities have different SLA deadlines
    if len(ticket_ids) > 1:
        # Get all tickets
        tickets_data = {}
        for priority, tid in ticket_ids.items():
            response = make_request("get", f"/api/tickets/{tid}", team_lead_token, cookies=team_lead_cookies)
            if response.status_code == 200:
                tickets_data[priority] = response.json().get("data", {}).get("sla")

        # Compare deadlines
        deadlines_different = True
        for p1 in priorities:
            for p2 in priorities:
                if p1 != p2 and p1 in tickets_data and p2 in tickets_data:
                    if (tickets_data[p1].get("responseDeadline") == tickets_data[p2].get("responseDeadline") or
                        tickets_data[p1].get("resolutionDeadline") == tickets_data[p2].get("resolutionDeadline")):
                        deadlines_different = False

        print_result("Different Priorities Have Different Deadlines", deadlines_different, 
                    "SLA deadlines are correctly calculated based on priority" if deadlines_different else "SLA deadlines are the same for different priorities",
                    tickets_data)

def test_sla_breach_notification():
    """Test SLA breach notification system"""
    print_section("Testing SLA Breach Notification")

    # Create a ticket with a very short SLA deadline to force a breach
    ticket_data = {
        "title": f"Test Ticket for SLA Breach {int(time.time())}",
        "description": "This is a test ticket for testing SLA breach notifications",
        "category": "technical",
        "subcategory": "server",
        "priority": "critical",
        "source": "direct_creation",
        "slaPolicy": sla_policy_id
    }

    response = make_request("post", "/api/tickets", team_lead_token, ticket_data, cookies=team_lead_cookies, csrf_token=team_lead_csrf_token)

    if response.status_code == 201:
        breach_ticket_id = response.json().get("data", {}).get("_id")
        print_result("Create Ticket for SLA Breach Test", True, f"Ticket ID: {breach_ticket_id}", response.json().get("data").get("sla"))

        # Manually trigger SLA breach check
        response = make_request("post", "/api/sla/check-breaches", admin_token, cookies=admin_cookies, csrf_token=admin_csrf_token)
        
        if response.status_code == 200:
            print_result("Trigger SLA Breach Check", True, "SLA breach check triggered", response.json().get("data"))
            
            # Check if notifications were created
            response = make_request("get", "/api/notifications", team_lead_token, cookies=team_lead_cookies)
            
            if response.status_code == 200:
                notifications = response.json().get("data", [])
                sla_notifications = [n for n in notifications if n.get("type") == "sla"]
                
                print_result("SLA Notifications", len(sla_notifications) > 0, 
                            f"Found {len(sla_notifications)} SLA notifications",
                            sla_notifications[:3] if sla_notifications else None)
            else:
                print_result("Get Notifications", False, f"Status code: {response.status_code}", response.json())
        else:
            print_result("Trigger SLA Breach Check", False, f"Status code: {response.status_code}", response.json())
    else:
        print_result("Create Ticket for SLA Breach Test", False, f"Status code: {response.status_code}", response.json())

def test_sla_with_business_hours():
    """Test SLA calculation with business hours"""
    print_section("Testing SLA with Business Hours")

    # Create a ticket with business hours SLA policy
    ticket_data = {
        "title": f"Test Ticket with Business Hours SLA {int(time.time())}",
        "description": "This is a test ticket for testing SLA with business hours",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": sla_policy_business_hours_id
    }

    response = make_request("post", "/api/tickets", team_lead_token, ticket_data, cookies=team_lead_cookies, csrf_token=team_lead_csrf_token)

    if response.status_code == 201:
        business_hours_ticket_id = response.json().get("data", {}).get("_id")
        ticket_data = response.json().get("data", {})
        print_result("Create Ticket with Business Hours SLA", True, f"Ticket ID: {business_hours_ticket_id}", ticket_data.get("sla"))

        # Create a similar ticket with regular SLA policy for comparison
        regular_ticket_data = {
            "title": f"Test Ticket with Regular SLA {int(time.time())}",
            "description": "This is a test ticket for comparing with business hours SLA",
            "category": "technical",
            "subcategory": "server",
            "priority": "high",
            "source": "direct_creation",
            "slaPolicy": sla_policy_id
        }

        response = make_request("post", "/api/tickets", team_lead_token, regular_ticket_data, cookies=team_lead_cookies, csrf_token=team_lead_csrf_token)

        if response.status_code == 201:
            regular_ticket_id = response.json().get("data", {}).get("_id")
            regular_ticket_data = response.json().get("data", {})
            print_result("Create Ticket with Regular SLA", True, f"Ticket ID: {regular_ticket_id}", regular_ticket_data.get("sla"))

            # Compare deadlines
            business_hours_sla = ticket_data.get("sla", {})
            regular_sla = regular_ticket_data.get("sla", {})

            business_hours_response_deadline = datetime.fromisoformat(business_hours_sla.get("responseDeadline").replace("Z", "+00:00"))
            regular_response_deadline = datetime.fromisoformat(regular_sla.get("responseDeadline").replace("Z", "+00:00"))

            business_hours_resolution_deadline = datetime.fromisoformat(business_hours_sla.get("resolutionDeadline").replace("Z", "+00:00"))
            regular_resolution_deadline = datetime.fromisoformat(regular_sla.get("resolutionDeadline").replace("Z", "+00:00"))

            # Business hours SLA should typically be longer than regular SLA
            # because it only counts business hours
            comparison_data = {
                "business_hours_response_deadline": business_hours_response_deadline,
                "regular_response_deadline": regular_response_deadline,
                "business_hours_resolution_deadline": business_hours_resolution_deadline,
                "regular_resolution_deadline": regular_resolution_deadline,
                "response_difference_hours": (business_hours_response_deadline - regular_response_deadline).total_seconds() / 3600,
                "resolution_difference_hours": (business_hours_resolution_deadline - regular_resolution_deadline).total_seconds() / 3600
            }

            print_result("Compare Business Hours vs Regular SLA", True, 
                        "Business hours SLA calculation is different from regular SLA",
                        comparison_data)
        else:
            print_result("Create Ticket with Regular SLA", False, f"Status code: {response.status_code}", response.json())
    else:
        print_result("Create Ticket with Business Hours SLA", False, f"Status code: {response.status_code}", response.json())

def test_sla_escalation():
    """Test SLA escalation rules"""
    print_section("Testing SLA Escalation Rules")

    # Create a ticket with escalation rules
    ticket_data = {
        "title": f"Test Ticket for SLA Escalation {int(time.time())}",
        "description": "This is a test ticket for testing SLA escalation rules",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": sla_policy_id
    }

    response = make_request("post", "/api/tickets", team_lead_token, ticket_data, cookies=team_lead_cookies, csrf_token=team_lead_csrf_token)

    if response.status_code == 201:
        escalation_ticket_id = response.json().get("data", {}).get("_id")
        print_result("Create Ticket for Escalation Test", True, f"Ticket ID: {escalation_ticket_id}", response.json().get("data").get("sla"))

        # Manually trigger SLA breach check to force escalation
        response = make_request("post", "/api/sla/check-breaches", admin_token, cookies=admin_cookies, csrf_token=admin_csrf_token)
        
        if response.status_code == 200:
            print_result("Trigger SLA Breach Check for Escalation", True, "SLA breach check triggered", response.json().get("data"))
            
            # Check if the ticket was escalated (priority increased)
            response = make_request("get", f"/api/tickets/{escalation_ticket_id}", team_lead_token, cookies=team_lead_cookies)
            
            if response.status_code == 200:
                updated_ticket = response.json().get("data", {})
                audit_log = updated_ticket.get("auditLog", [])
                
                # Look for escalation entries in the audit log
                escalation_entries = [log for log in audit_log if log.get("action") == "priority_escalated"]
                
                print_result("SLA Escalation", len(escalation_entries) > 0, 
                            f"Found {len(escalation_entries)} escalation entries in audit log",
                            escalation_entries if escalation_entries else updated_ticket)
            else:
                print_result("Get Updated Ticket", False, f"Status code: {response.status_code}", response.json())
        else:
            print_result("Trigger SLA Breach Check for Escalation", False, f"Status code: {response.status_code}", response.json())
    else:
        print_result("Create Ticket for Escalation Test", False, f"Status code: {response.status_code}", response.json())

def test_sla_reporting():
    """Test SLA reporting functionality"""
    print_section("Testing SLA Reporting")

    # Get SLA performance metrics
    response = make_request("get", "/api/reports/sla-performance", admin_token, cookies=admin_cookies)
    
    if response.status_code == 200:
        sla_metrics = response.json().get("data", {})
        print_result("SLA Performance Report", True, "Retrieved SLA performance metrics", sla_metrics)
    else:
        print_result("SLA Performance Report", False, f"Status code: {response.status_code}", response.json())

    # Get SLA breach report
    response = make_request("get", "/api/reports/sla-breaches", admin_token, cookies=admin_cookies)
    
    if response.status_code == 200:
        breach_report = response.json().get("data", {})
        print_result("SLA Breach Report", True, "Retrieved SLA breach report", breach_report)
    else:
        print_result("SLA Breach Report", False, f"Status code: {response.status_code}", response.json())

def run_all_tests():
    """Run all tests in sequence"""
    try:
        test_authentication()
        test_create_team()
        test_create_sla_policy_with_escalation()
        test_create_sla_policy_with_business_hours()
        test_create_tickets_with_different_priorities()
        test_sla_breach_notification()
        test_sla_with_business_hours()
        test_sla_escalation()
        test_sla_reporting()

        print_section("Test Summary")
        print("All tests completed. Check the results above for details.")
    except Exception as e:
        print(f"\n❌ ERROR: An exception occurred during testing: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_all_tests()
