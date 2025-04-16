#!/usr/bin/env python3
import requests
import json
import time
import sys
from datetime import datetime

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
        "name": f"Escalation Test Policy {int(time.time())}",
        "description": "SLA policy with escalation rules for testing",
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
        sys.exit(1)
    
    return response.json()["data"]["_id"]

def create_ticket(cookies, policy_id, priority="high"):
    ticket_data = {
        "title": f"Test Ticket for SLA Escalation {int(time.time())}",
        "description": "This is a test ticket for testing SLA escalation rules",
        "category": "technical",
        "subcategory": "server",
        "priority": priority,
        "source": "direct_creation",
        "slaPolicy": policy_id
    }
    
    response = requests.post(f"{BASE_URL}/tickets", json=ticket_data, cookies=cookies)
    if response.status_code != 201:
        print(f"Failed to create ticket: {response.text}")
        sys.exit(1)
    
    return response.json()["data"]["_id"]

def check_sla_breaches(cookies):
    response = requests.post(f"{BASE_URL}/sla/check-breaches", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to check SLA breaches: {response.text}")
        sys.exit(1)
    
    return response.json()

def get_notifications(cookies):
    response = requests.get(f"{BASE_URL}/notifications", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get notifications: {response.text}")
        return []
    
    return response.json().get("data", [])

def get_ticket(cookies, ticket_id):
    response = requests.get(f"{BASE_URL}/tickets/{ticket_id}", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get ticket: {response.text}")
        sys.exit(1)
    
    return response.json()["data"]

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

# Main test function
def test_sla_escalation():
    print("Testing SLA escalation rules...")
    
    # Login as admin
    admin_cookies = login(ADMIN_CREDENTIALS)
    print("Logged in as admin")
    
    # Create SLA policy with escalation rules
    policy_id = create_sla_policy(admin_cookies)
    print(f"Created SLA policy with ID: {policy_id}")
    
    # Login as team lead
    team_lead_cookies = login(TEAM_LEAD_CREDENTIALS)
    print("Logged in as team lead")
    
    # Create a ticket with the SLA policy
    ticket_id = create_ticket(team_lead_cookies, policy_id, "high")
    print(f"Created ticket with ID: {ticket_id}")
    
    # Get the ticket to see SLA deadlines
    ticket = get_ticket(team_lead_cookies, ticket_id)
    print(f"Ticket SLA response deadline: {ticket['sla']['responseDeadline']}")
    print(f"Ticket SLA resolution deadline: {ticket['sla']['resolutionDeadline']}")
    
    # Check for notifications
    print("Checking for notifications...")
    notifications = get_notifications(team_lead_cookies)
    print(f"Found {len(notifications)} notifications")
    
    # Manually trigger SLA breach check
    print("Triggering SLA breach check...")
    result = check_sla_breaches(admin_cookies)
    print(f"SLA breach check result: {result}")
    
    # Check for notifications again
    print("Checking for notifications after SLA breach check...")
    notifications = get_notifications(team_lead_cookies)
    print(f"Found {len(notifications)} notifications")
    
    # Get SLA reports
    print("Getting SLA performance report...")
    performance_report = get_sla_performance_report(team_lead_cookies)
    if performance_report:
        print(f"SLA performance report: {json.dumps(performance_report, indent=2)}")
    
    print("Getting SLA breach report...")
    breach_report = get_sla_breach_report(team_lead_cookies)
    if breach_report:
        print(f"SLA breach report: {json.dumps(breach_report, indent=2)}")
    
    # Get the ticket again to see if escalation rules were applied
    ticket = get_ticket(team_lead_cookies, ticket_id)
    print(f"Ticket priority after SLA check: {ticket['priority']}")
    print(f"Ticket audit log entries: {len(ticket['auditLog'])}")
    
    # Print audit log entries
    for entry in ticket['auditLog']:
        print(f"Audit log entry: {entry['action']} at {entry['timestamp']}")
        if 'details' in entry:
            print(f"  Details: {entry['details']}")
    
    print("SLA escalation test completed")

if __name__ == "__main__":
    test_sla_escalation()
