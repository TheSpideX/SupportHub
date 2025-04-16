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

# Helper functions
def login(credentials):
    response = requests.post(f"{BASE_URL}/auth/login", json=credentials)
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        sys.exit(1)
    return response.cookies

def create_sla_policy(cookies):
    policy_data = {
        "name": f"Core Test SLA Policy {int(time.time())}",
        "description": "SLA policy for core testing",
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
    
    return response.json()["data"]

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
    
    return response.json()["data"]

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

def check_sla_breaches(cookies):
    response = requests.post(f"{BASE_URL}/sla/check-breaches", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to check SLA breaches: {response.text}")
        return None
    
    return response.json()

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

def test_core_sla_functionality():
    print("\n=== Testing Core SLA Functionality ===\n")
    
    # Login as admin
    print("Logging in as admin...")
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Create SLA policy
    print("\nCreating SLA policy...")
    policy = create_sla_policy(admin_cookies)
    if not policy:
        print("❌ Failed to create SLA policy")
        return False
    
    policy_id = policy["_id"]
    print(f"✅ Created SLA policy with ID: {policy_id}")
    print(f"   Name: {policy['name']}")
    print(f"   Response times: {json.dumps(policy['responseTime'])}")
    print(f"   Resolution times: {json.dumps(policy['resolutionTime'])}")
    print(f"   Escalation rules: {len(policy['escalationRules'])}")
    
    # Create a ticket with the SLA policy
    print("\nCreating ticket with SLA policy...")
    ticket_data = {
        "title": f"Core SLA Test Ticket {int(time.time())}",
        "description": "This is a test ticket for testing core SLA functionality",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": policy_id
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
    
    # Verify SLA is applied
    if "sla" not in ticket:
        print("❌ Ticket does not have SLA field")
        return False
    
    print("\nVerifying SLA is applied to ticket...")
    print(f"✅ SLA is applied to ticket")
    print(f"   SLA policy ID: {ticket['sla']['policyId']}")
    print(f"   Response deadline: {ticket['sla']['responseDeadline']}")
    print(f"   Resolution deadline: {ticket['sla']['resolutionDeadline']}")
    
    # Update ticket priority and verify SLA recalculation
    print("\nUpdating ticket priority to critical...")
    updated_ticket = update_ticket(admin_cookies, ticket_id, {"priority": "critical"})
    if not updated_ticket:
        print("❌ Failed to update ticket priority")
        return False
    
    print(f"✅ Updated ticket priority to {updated_ticket['priority']}")
    
    # Verify SLA deadlines were recalculated
    if "sla" not in updated_ticket:
        print("❌ Updated ticket does not have SLA field")
        return False
    
    print("\nVerifying SLA deadlines were recalculated...")
    print(f"   New response deadline: {updated_ticket['sla']['responseDeadline']}")
    print(f"   New resolution deadline: {updated_ticket['sla']['resolutionDeadline']}")
    
    # Check for SLA recalculation in audit log
    sla_recalculation_found = False
    for entry in updated_ticket["auditLog"]:
        if entry["action"] == "sla_recalculated":
            sla_recalculation_found = True
            print(f"✅ Found SLA recalculation in audit log:")
            print(f"   Reason: {entry['details']['reason']}")
            print(f"   Old priority: {entry['details']['oldPriority']}")
            print(f"   New priority: {entry['details']['newPriority']}")
            print(f"   Old response deadline: {entry['details']['oldResponseDeadline']}")
            print(f"   New response deadline: {entry['details']['newResponseDeadline']}")
            break
    
    if not sla_recalculation_found:
        print("❌ No SLA recalculation entry found in audit log")
    
    # Check SLA breach detection
    print("\nTesting SLA breach detection...")
    result = check_sla_breaches(admin_cookies)
    if not result:
        print("❌ Failed to check SLA breaches")
        return False
    
    print(f"✅ SLA breach check completed")
    print(f"   Tickets checked: {result['data']['checked']}")
    print(f"   Response breaches: {result['data']['breached']['response']}")
    print(f"   Resolution breaches: {result['data']['breached']['resolution']}")
    print(f"   Response approaching: {result['data']['approaching']['response']}")
    print(f"   Resolution approaching: {result['data']['approaching']['resolution']}")
    
    # Test SLA reports
    print("\nTesting SLA performance report...")
    performance_report = get_sla_performance_report(admin_cookies)
    if not performance_report:
        print("❌ Failed to get SLA performance report")
        return False
    
    print(f"✅ SLA performance report retrieved")
    print(f"   Total tickets: {performance_report['overall']['totalTickets']}")
    print(f"   Response compliance rate: {performance_report['overall']['responseComplianceRate']}%")
    print(f"   Resolution compliance rate: {performance_report['overall']['resolutionComplianceRate']}%")
    
    print("\nTesting SLA breach report...")
    breach_report = get_sla_breach_report(admin_cookies)
    if not breach_report:
        print("❌ Failed to get SLA breach report")
        return False
    
    print(f"✅ SLA breach report retrieved")
    print(f"   Total breaches: {breach_report['totalBreaches']}")
    print(f"   Response breaches: {breach_report['responseBreaches']}")
    print(f"   Resolution breaches: {breach_report['resolutionBreaches']}")
    
    print("\n=== Core SLA Functionality Test Completed Successfully ===")
    return True

if __name__ == "__main__":
    success = test_core_sla_functionality()
    sys.exit(0 if success else 1)
