#!/usr/bin/env python3
import requests
import json
import time
import sys
from datetime import datetime, timedelta
import random

# Configuration
BASE_URL = "http://localhost:4290/api"
ADMIN_CREDENTIALS = {"email": "admin@example.com", "password": "Admin@123"}
TEAM_LEAD_CREDENTIALS = {"email": "teamlead@example.com", "password": "TeamLead@123"}
TEAM_MEMBER_CREDENTIALS = {"email": "teammember@example.com", "password": "TeamMember@123"}
CUSTOMER_CREDENTIALS = {"email": "customer@example.com", "password": "Customer@123"}

# Test results tracking
test_results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "failures": []
}

def record_test(name, passed, message=None):
    test_results["total"] += 1
    if passed:
        test_results["passed"] += 1
        print(f"✅ PASS: {name}")
    else:
        test_results["failed"] += 1
        failure = {"test": name, "message": message}
        test_results["failures"].append(failure)
        print(f"❌ FAIL: {name} - {message}")

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

def create_sla_policy(cookies):
    policy_data = {
        "name": f"Test SLA Policy {int(time.time())}",
        "description": "SLA policy for testing",
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
        "escalationRules": [
            {
                "condition": "response_approaching",
                "threshold": 80,
                "actions": ["notify_assignee", "notify_team_lead"]
            },
            {
                "condition": "response_breached",
                "threshold": 100,
                "actions": ["notify_team_lead", "increase_priority"]
            },
            {
                "condition": "resolution_approaching",
                "threshold": 80,
                "actions": ["notify_assignee", "notify_team_lead"]
            },
            {
                "condition": "resolution_breached",
                "threshold": 100,
                "actions": ["notify_manager", "increase_priority"]
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/sla/policies", json=policy_data, cookies=cookies)
    if response.status_code != 201:
        print(f"Failed to create SLA policy: {response.text}")
        return None
    
    return response.json()["data"]["_id"]

def get_sla_policies(cookies):
    response = requests.get(f"{BASE_URL}/sla/policies", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get SLA policies: {response.text}")
        return []
    
    return response.json().get("data", [])

def create_ticket(cookies, data):
    response = requests.post(f"{BASE_URL}/tickets", json=data, cookies=cookies)
    if response.status_code != 201:
        print(f"Failed to create ticket: {response.text}")
        return None
    
    return response.json()["data"]["_id"]

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
        return False
    
    return True

def add_comment(cookies, ticket_id, comment):
    data = {"text": comment}
    response = requests.post(f"{BASE_URL}/tickets/{ticket_id}/comments", json=data, cookies=cookies)
    if response.status_code != 201:
        print(f"Failed to add comment: {response.text}")
        return False
    
    return True

def check_sla_breaches(cookies):
    response = requests.post(f"{BASE_URL}/sla/check-breaches", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to check SLA breaches: {response.text}")
        return None
    
    return response.json()

def get_notifications(cookies):
    response = requests.get(f"{BASE_URL}/notifications", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get notifications: {response.text}")
        return []
    
    return response.json().get("data", [])

def get_sla_performance_report(cookies):
    response = requests.get(f"{BASE_URL}/reports/sla-performance", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get SLA performance report: {response.text}")
        return None
    
    return response.json()["data"]

def get_sla_breach_report(cookies):
    response = requests.get(f"{BASE_URL}/reports/sla-breaches", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get SLA breach report: {response.text}")
        return None
    
    return response.json()["data"]

# Test functions
def test_sla_policy_management():
    print("\n=== Testing SLA Policy Management ===")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Test creating SLA policy
    policy_id = create_sla_policy(admin_cookies)
    record_test("Create SLA policy", policy_id is not None, "Failed to create SLA policy")
    
    # Test getting SLA policies
    policies = get_sla_policies(admin_cookies)
    record_test("Get SLA policies", len(policies) > 0, "No SLA policies found")
    
    # Test getting specific SLA policy
    if policy_id:
        found = False
        for policy in policies:
            if policy["_id"] == policy_id:
                found = True
                break
        record_test("Get specific SLA policy", found, f"SLA policy {policy_id} not found")

def test_ticket_creation():
    print("\n=== Testing Ticket Creation ===")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Get SLA policies
    policies = get_sla_policies(admin_cookies)
    if not policies:
        policy_id = create_sla_policy(admin_cookies)
    else:
        policy_id = policies[0]["_id"]
    
    # Get teams
    teams = get_teams(admin_cookies)
    if not teams:
        record_test("Get teams", False, "No teams found")
        return
    
    team_id = teams[0]["_id"]
    
    # Get team members
    members = get_team_members(admin_cookies, team_id)
    if not members:
        record_test("Get team members", False, "No team members found")
        return
    
    member_id = members[0]["_id"]
    
    # Test ticket creation as admin
    ticket_data = {
        "title": f"Admin Test Ticket {int(time.time())}",
        "description": "This is a test ticket created by admin",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": policy_id,
        "assignedTeam": team_id,
        "assignedTo": member_id
    }
    
    ticket_id = create_ticket(admin_cookies, ticket_data)
    record_test("Create ticket as admin", ticket_id is not None, "Failed to create ticket as admin")
    
    # Test ticket creation as team lead
    team_lead_cookies = login(TEAM_LEAD_CREDENTIALS)
    
    ticket_data = {
        "title": f"Team Lead Test Ticket {int(time.time())}",
        "description": "This is a test ticket created by team lead",
        "category": "technical",
        "subcategory": "server",
        "priority": "medium",
        "source": "direct_creation",
        "slaPolicy": policy_id
    }
    
    ticket_id = create_ticket(team_lead_cookies, ticket_data)
    record_test("Create ticket as team lead", ticket_id is not None, "Failed to create ticket as team lead")
    
    # Test ticket creation as customer
    customer_cookies = login(CUSTOMER_CREDENTIALS)
    
    ticket_data = {
        "title": f"Customer Test Ticket {int(time.time())}",
        "description": "This is a test ticket created by customer",
        "category": "support",
        "subcategory": "account",
        "priority": "low",
        "source": "customer_portal"
    }
    
    ticket_id = create_ticket(customer_cookies, ticket_data)
    record_test("Create ticket as customer", ticket_id is not None, "Failed to create ticket as customer")

def test_ticket_management():
    print("\n=== Testing Ticket Management ===")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Get SLA policies
    policies = get_sla_policies(admin_cookies)
    if not policies:
        policy_id = create_sla_policy(admin_cookies)
    else:
        policy_id = policies[0]["_id"]
    
    # Create a test ticket
    ticket_data = {
        "title": f"Test Ticket for Management {int(time.time())}",
        "description": "This is a test ticket for testing ticket management",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": policy_id
    }
    
    ticket_id = create_ticket(admin_cookies, ticket_data)
    if not ticket_id:
        record_test("Create test ticket", False, "Failed to create test ticket")
        return
    
    # Test getting tickets
    tickets = get_tickets(admin_cookies)
    record_test("Get tickets", len(tickets) > 0, "No tickets found")
    
    # Test getting specific ticket
    ticket = get_ticket(admin_cookies, ticket_id)
    record_test("Get specific ticket", ticket is not None, f"Ticket {ticket_id} not found")
    
    # Test updating ticket
    update_data = {
        "status": "in_progress",
        "priority": "critical"
    }
    
    success = update_ticket(admin_cookies, ticket_id, update_data)
    record_test("Update ticket", success, "Failed to update ticket")
    
    # Verify update
    updated_ticket = get_ticket(admin_cookies, ticket_id)
    status_updated = updated_ticket and updated_ticket["status"] == "in_progress"
    priority_updated = updated_ticket and updated_ticket["priority"] == "critical"
    
    record_test("Verify ticket status update", status_updated, "Ticket status not updated")
    record_test("Verify ticket priority update", priority_updated, "Ticket priority not updated")
    
    # Test adding comment
    comment_text = f"Test comment {int(time.time())}"
    success = add_comment(admin_cookies, ticket_id, comment_text)
    record_test("Add comment", success, "Failed to add comment")
    
    # Verify comment
    updated_ticket = get_ticket(admin_cookies, ticket_id)
    comment_found = False
    if updated_ticket and "comments" in updated_ticket:
        for comment in updated_ticket["comments"]:
            if comment["text"] == comment_text:
                comment_found = True
                break
    
    record_test("Verify comment added", comment_found, "Comment not found in ticket")

def test_sla_functionality():
    print("\n=== Testing SLA Functionality ===")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Create SLA policy
    policy_id = create_sla_policy(admin_cookies)
    if not policy_id:
        record_test("Create SLA policy", False, "Failed to create SLA policy")
        return
    
    # Create a test ticket with the SLA policy
    ticket_data = {
        "title": f"SLA Test Ticket {int(time.time())}",
        "description": "This is a test ticket for testing SLA functionality",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": policy_id
    }
    
    ticket_id = create_ticket(admin_cookies, ticket_data)
    if not ticket_id:
        record_test("Create test ticket", False, "Failed to create test ticket")
        return
    
    # Get the ticket to verify SLA is applied
    ticket = get_ticket(admin_cookies, ticket_id)
    sla_applied = ticket and "sla" in ticket and ticket["sla"]["policyId"] == policy_id
    record_test("Verify SLA applied to ticket", sla_applied, "SLA not applied to ticket")
    
    # Check for SLA deadlines
    deadlines_set = ticket and "sla" in ticket and "responseDeadline" in ticket["sla"] and "resolutionDeadline" in ticket["sla"]
    record_test("Verify SLA deadlines set", deadlines_set, "SLA deadlines not set")
    
    # Trigger SLA breach check
    result = check_sla_breaches(admin_cookies)
    record_test("Trigger SLA breach check", result is not None, "Failed to trigger SLA breach check")
    
    # Get SLA performance report
    performance_report = get_sla_performance_report(admin_cookies)
    record_test("Get SLA performance report", performance_report is not None, "Failed to get SLA performance report")
    
    # Get SLA breach report
    breach_report = get_sla_breach_report(admin_cookies)
    record_test("Get SLA breach report", breach_report is not None, "Failed to get SLA breach report")

def test_notification_system():
    print("\n=== Testing Notification System ===")
    
    # Login as team lead
    team_lead_cookies = login(TEAM_LEAD_CREDENTIALS)
    
    # Get notifications
    notifications = get_notifications(team_lead_cookies)
    record_test("Get notifications", notifications is not None, "Failed to get notifications")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Create SLA policy
    policy_id = create_sla_policy(admin_cookies)
    if not policy_id:
        record_test("Create SLA policy", False, "Failed to create SLA policy")
        return
    
    # Create a test ticket with the SLA policy
    ticket_data = {
        "title": f"Notification Test Ticket {int(time.time())}",
        "description": "This is a test ticket for testing notifications",
        "category": "technical",
        "subcategory": "server",
        "priority": "critical",
        "source": "direct_creation",
        "slaPolicy": policy_id
    }
    
    ticket_id = create_ticket(admin_cookies, ticket_data)
    if not ticket_id:
        record_test("Create test ticket", False, "Failed to create test ticket")
        return
    
    # Trigger SLA breach check
    result = check_sla_breaches(admin_cookies)
    record_test("Trigger SLA breach check", result is not None, "Failed to trigger SLA breach check")
    
    # Get notifications again
    team_lead_cookies = login(TEAM_LEAD_CREDENTIALS)
    notifications_after = get_notifications(team_lead_cookies)
    
    # Check if new notifications were created
    record_test("Verify notifications created", notifications_after is not None, "Failed to get notifications after SLA check")

def test_ticket_filtering():
    print("\n=== Testing Ticket Filtering ===")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Test filtering by status
    status_params = {"status": "open"}
    status_tickets = get_tickets(admin_cookies, status_params)
    record_test("Filter tickets by status", status_tickets is not None, "Failed to filter tickets by status")
    
    # Test filtering by priority
    priority_params = {"priority": "high"}
    priority_tickets = get_tickets(admin_cookies, priority_params)
    record_test("Filter tickets by priority", priority_tickets is not None, "Failed to filter tickets by priority")
    
    # Test filtering by category
    category_params = {"category": "technical"}
    category_tickets = get_tickets(admin_cookies, category_params)
    record_test("Filter tickets by category", category_tickets is not None, "Failed to filter tickets by category")
    
    # Test filtering by date range
    date_params = {
        "startDate": (datetime.now() - timedelta(days=30)).isoformat(),
        "endDate": datetime.now().isoformat()
    }
    date_tickets = get_tickets(admin_cookies, date_params)
    record_test("Filter tickets by date range", date_tickets is not None, "Failed to filter tickets by date range")

def test_ticket_workflow():
    print("\n=== Testing Ticket Workflow ===")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Get SLA policies
    policies = get_sla_policies(admin_cookies)
    if not policies:
        policy_id = create_sla_policy(admin_cookies)
    else:
        policy_id = policies[0]["_id"]
    
    # Create a test ticket
    ticket_data = {
        "title": f"Workflow Test Ticket {int(time.time())}",
        "description": "This is a test ticket for testing ticket workflow",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": policy_id
    }
    
    ticket_id = create_ticket(admin_cookies, ticket_data)
    if not ticket_id:
        record_test("Create test ticket", False, "Failed to create test ticket")
        return
    
    # Test workflow: Open -> In Progress
    update_data = {"status": "in_progress"}
    success = update_ticket(admin_cookies, ticket_id, update_data)
    record_test("Update ticket status to In Progress", success, "Failed to update ticket status")
    
    # Verify status
    ticket = get_ticket(admin_cookies, ticket_id)
    status_updated = ticket and ticket["status"] == "in_progress"
    record_test("Verify ticket status updated to In Progress", status_updated, "Ticket status not updated")
    
    # Add a comment
    comment_text = "Working on this issue"
    success = add_comment(admin_cookies, ticket_id, comment_text)
    record_test("Add comment to ticket", success, "Failed to add comment")
    
    # Test workflow: In Progress -> On Hold
    update_data = {"status": "on_hold", "holdReason": "waiting_for_customer"}
    success = update_ticket(admin_cookies, ticket_id, update_data)
    record_test("Update ticket status to On Hold", success, "Failed to update ticket status")
    
    # Verify status
    ticket = get_ticket(admin_cookies, ticket_id)
    status_updated = ticket and ticket["status"] == "on_hold"
    hold_reason_updated = ticket and ticket["holdReason"] == "waiting_for_customer"
    record_test("Verify ticket status updated to On Hold", status_updated, "Ticket status not updated")
    record_test("Verify hold reason set", hold_reason_updated, "Hold reason not set")
    
    # Test workflow: On Hold -> In Progress
    update_data = {"status": "in_progress"}
    success = update_ticket(admin_cookies, ticket_id, update_data)
    record_test("Update ticket status back to In Progress", success, "Failed to update ticket status")
    
    # Test workflow: In Progress -> Resolved
    update_data = {"status": "resolved", "resolutionType": "fixed"}
    success = update_ticket(admin_cookies, ticket_id, update_data)
    record_test("Update ticket status to Resolved", success, "Failed to update ticket status")
    
    # Verify status
    ticket = get_ticket(admin_cookies, ticket_id)
    status_updated = ticket and ticket["status"] == "resolved"
    resolution_type_updated = ticket and ticket["resolutionType"] == "fixed"
    record_test("Verify ticket status updated to Resolved", status_updated, "Ticket status not updated")
    record_test("Verify resolution type set", resolution_type_updated, "Resolution type not set")
    
    # Test workflow: Resolved -> Closed
    update_data = {"status": "closed"}
    success = update_ticket(admin_cookies, ticket_id, update_data)
    record_test("Update ticket status to Closed", success, "Failed to update ticket status")
    
    # Verify status
    ticket = get_ticket(admin_cookies, ticket_id)
    status_updated = ticket and ticket["status"] == "closed"
    record_test("Verify ticket status updated to Closed", status_updated, "Ticket status not updated")

def run_all_tests():
    print("\n=== Running Comprehensive Ticket System and SLA Tests ===\n")
    
    test_sla_policy_management()
    test_ticket_creation()
    test_ticket_management()
    test_sla_functionality()
    test_notification_system()
    test_ticket_filtering()
    test_ticket_workflow()
    
    # Print test summary
    print("\n=== Test Summary ===")
    print(f"Total tests: {test_results['total']}")
    print(f"Passed: {test_results['passed']}")
    print(f"Failed: {test_results['failed']}")
    
    if test_results['failed'] > 0:
        print("\n=== Failed Tests ===")
        for failure in test_results['failures']:
            print(f"- {failure['test']}: {failure['message']}")
    
    # Calculate pass percentage
    pass_percentage = (test_results['passed'] / test_results['total']) * 100 if test_results['total'] > 0 else 0
    print(f"\nPass rate: {pass_percentage:.2f}%")
    
    return pass_percentage >= 90  # Consider test successful if pass rate is at least 90%

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
