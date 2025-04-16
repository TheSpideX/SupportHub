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
    
    return policy_id

def test_ticket_with_sla(policy_id):
    print("\n=== Testing Ticket with SLA ===")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    
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
    record_test("Create ticket with SLA", ticket_id is not None, "Failed to create ticket with SLA")
    
    if not ticket_id:
        return None
    
    # Get the ticket to verify SLA is applied
    ticket = get_ticket(admin_cookies, ticket_id)
    
    # Check if SLA is applied
    has_sla = ticket and "sla" in ticket
    record_test("Ticket has SLA field", has_sla, "Ticket does not have SLA field")
    
    if has_sla:
        # Check if SLA policy ID matches
        policy_matches = ticket["sla"]["policyId"] == policy_id
        record_test("SLA policy ID matches", policy_matches, f"SLA policy ID does not match: {ticket['sla']['policyId']} != {policy_id}")
        
        # Check if SLA deadlines are set
        has_response_deadline = "responseDeadline" in ticket["sla"]
        has_resolution_deadline = "resolutionDeadline" in ticket["sla"]
        
        record_test("SLA response deadline set", has_response_deadline, "SLA response deadline not set")
        record_test("SLA resolution deadline set", has_resolution_deadline, "SLA resolution deadline not set")
        
        if has_response_deadline:
            print(f"Response deadline: {ticket['sla']['responseDeadline']}")
        
        if has_resolution_deadline:
            print(f"Resolution deadline: {ticket['sla']['resolutionDeadline']}")
    
    return ticket_id

def test_sla_breach_check(ticket_id):
    print("\n=== Testing SLA Breach Check ===")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Trigger SLA breach check
    result = check_sla_breaches(admin_cookies)
    record_test("Trigger SLA breach check", result is not None, "Failed to trigger SLA breach check")
    
    if result:
        print(f"SLA breach check result: {json.dumps(result, indent=2)}")
    
    # Get the ticket again to see if any SLA status changed
    ticket = get_ticket(admin_cookies, ticket_id)
    
    if ticket and "sla" in ticket:
        print(f"SLA status after breach check: {json.dumps(ticket['sla'], indent=2)}")
    
    return result

def test_sla_reports():
    print("\n=== Testing SLA Reports ===")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Get SLA performance report
    performance_report = get_sla_performance_report(admin_cookies)
    record_test("Get SLA performance report", performance_report is not None, "Failed to get SLA performance report")
    
    if performance_report:
        print(f"SLA performance report summary:")
        print(f"  Total tickets: {performance_report['overall']['totalTickets']}")
        print(f"  Response compliance rate: {performance_report['overall']['responseComplianceRate']}%")
        print(f"  Resolution compliance rate: {performance_report['overall']['resolutionComplianceRate']}%")
    
    # Get SLA breach report
    breach_report = get_sla_breach_report(admin_cookies)
    record_test("Get SLA breach report", breach_report is not None, "Failed to get SLA breach report")
    
    if breach_report:
        print(f"SLA breach report summary:")
        print(f"  Total breaches: {breach_report['totalBreaches']}")
        print(f"  Response breaches: {breach_report['responseBreaches']}")
        print(f"  Resolution breaches: {breach_report['resolutionBreaches']}")
    
    return performance_report is not None and breach_report is not None

def test_ticket_workflow_with_sla(policy_id):
    print("\n=== Testing Ticket Workflow with SLA ===")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Create a test ticket with the SLA policy
    ticket_data = {
        "title": f"Workflow SLA Test Ticket {int(time.time())}",
        "description": "This is a test ticket for testing workflow with SLA",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": policy_id
    }
    
    ticket_id = create_ticket(admin_cookies, ticket_data)
    record_test("Create ticket for workflow test", ticket_id is not None, "Failed to create ticket")
    
    if not ticket_id:
        return False
    
    # Get initial ticket state
    initial_ticket = get_ticket(admin_cookies, ticket_id)
    initial_priority = initial_ticket["priority"]
    print(f"Initial ticket priority: {initial_priority}")
    
    # Update ticket status to in_progress
    update_data = {"status": "in_progress"}
    success = update_ticket(admin_cookies, ticket_id, update_data)
    record_test("Update ticket status to in_progress", success, "Failed to update ticket status")
    
    # Add a comment
    comment_text = "Working on this ticket"
    success = add_comment(admin_cookies, ticket_id, comment_text)
    record_test("Add comment to ticket", success, "Failed to add comment")
    
    # Update ticket priority
    update_data = {"priority": "critical"}
    success = update_ticket(admin_cookies, ticket_id, update_data)
    record_test("Update ticket priority", success, "Failed to update ticket priority")
    
    # Get updated ticket
    updated_ticket = get_ticket(admin_cookies, ticket_id)
    
    # Check if SLA deadlines were recalculated after priority change
    if initial_ticket and updated_ticket and "sla" in initial_ticket and "sla" in updated_ticket:
        initial_response_deadline = initial_ticket["sla"]["responseDeadline"]
        updated_response_deadline = updated_ticket["sla"]["responseDeadline"]
        
        initial_resolution_deadline = initial_ticket["sla"]["resolutionDeadline"]
        updated_resolution_deadline = updated_ticket["sla"]["resolutionDeadline"]
        
        deadlines_changed = (initial_response_deadline != updated_response_deadline or 
                            initial_resolution_deadline != updated_resolution_deadline)
        
        record_test("SLA deadlines recalculated after priority change", deadlines_changed, 
                   "SLA deadlines not recalculated after priority change")
        
        print(f"Initial response deadline: {initial_response_deadline}")
        print(f"Updated response deadline: {updated_response_deadline}")
        print(f"Initial resolution deadline: {initial_resolution_deadline}")
        print(f"Updated resolution deadline: {updated_resolution_deadline}")
    
    # Check audit log for SLA recalculation entry
    if updated_ticket and "auditLog" in updated_ticket:
        sla_recalculation_found = False
        for entry in updated_ticket["auditLog"]:
            if entry["action"] == "sla_recalculated":
                sla_recalculation_found = True
                print(f"SLA recalculation audit log entry found: {json.dumps(entry, indent=2)}")
                break
        
        record_test("SLA recalculation audit log entry", sla_recalculation_found, 
                   "No SLA recalculation audit log entry found")
    
    return True

def run_focused_tests():
    print("\n=== Running Focused Ticket System and SLA Tests ===\n")
    
    # Test SLA policy management
    policy_id = test_sla_policy_management()
    
    if not policy_id:
        print("Cannot continue tests without a valid SLA policy")
        return False
    
    # Test ticket with SLA
    ticket_id = test_ticket_with_sla(policy_id)
    
    if not ticket_id:
        print("Cannot continue tests without a valid ticket")
        return False
    
    # Test SLA breach check
    test_sla_breach_check(ticket_id)
    
    # Test SLA reports
    test_sla_reports()
    
    # Test ticket workflow with SLA
    test_ticket_workflow_with_sla(policy_id)
    
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
    success = run_focused_tests()
    sys.exit(0 if success else 1)
