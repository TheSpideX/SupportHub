#!/usr/bin/env python3
"""
Test Script for SLA Breach Notifications
This script tests the SLA breach notification system by creating tickets with short SLA deadlines
and verifying that notifications are sent when deadlines are breached
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

# Global variables
admin_token = None
team_lead_token = None
admin_id = None
team_lead_id = None
organization_id = None
sla_policy_id = None
ticket_ids = []

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
    """Test authentication for admin and team lead users"""
    global admin_token, team_lead_token, admin_id, team_lead_id, organization_id
    
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

def test_create_short_sla_policy():
    """Create an SLA policy with very short deadlines for testing breach notifications"""
    global sla_policy_id
    
    print_section("Creating Short SLA Policy")
    
    # Create an SLA policy with very short deadlines
    sla_policy_data = {
        "name": f"Short Deadline SLA Policy {int(time.time())}",
        "description": "SLA policy with very short deadlines for testing breach notifications",
        "responseTime": {
            "low": 2,        # 2 minutes
            "medium": 1,     # 1 minute
            "high": 1,       # 1 minute
            "critical": 1    # 1 minute
        },
        "resolutionTime": {
            "low": 5,        # 5 minutes
            "medium": 3,     # 3 minutes
            "high": 2,       # 2 minutes
            "critical": 1    # 1 minute
        }
    }
    
    response = make_request("post", "/api/sla/policies", admin_token, sla_policy_data)
    
    if response.status_code == 201:
        sla_policy_id = response.json().get("data", {}).get("_id")
        print_result("Create Short SLA Policy", True, f"SLA Policy ID: {sla_policy_id}", response.json().get("data"))
    else:
        print_result("Create Short SLA Policy", False, f"Status code: {response.status_code}", response.json())
        sys.exit(1)

def test_create_tickets_with_short_sla():
    """Create tickets with the short SLA policy"""
    global ticket_ids
    
    print_section("Creating Tickets with Short SLA")
    
    # Create tickets with different priorities
    priorities = ["low", "medium", "high", "critical"]
    
    for priority in priorities:
        ticket_data = {
            "title": f"SLA Breach Test Ticket - {priority.capitalize()} Priority - {int(time.time())}",
            "description": f"This is a test ticket for testing SLA breach notifications with {priority} priority",
            "category": "technical",
            "subcategory": "server",
            "priority": priority,
            "source": "direct_creation",
            "slaPolicy": sla_policy_id
        }
        
        response = make_request("post", "/api/tickets", team_lead_token, ticket_data)
        
        if response.status_code == 201:
            ticket_id = response.json().get("data", {}).get("_id")
            ticket_ids.append(ticket_id)
            print_result(f"Create {priority.capitalize()} Priority Ticket", True, 
                        f"Ticket ID: {ticket_id}", 
                        {"ticketId": ticket_id, "priority": priority})
        else:
            print_result(f"Create {priority.capitalize()} Priority Ticket", False, 
                        f"Status code: {response.status_code}", response.json())

def test_wait_for_sla_breach():
    """Wait for SLA deadlines to be breached"""
    print_section("Waiting for SLA Deadlines to be Breached")
    
    # Wait for response deadline to be breached (at least 1 minute)
    print("Waiting for response deadline to be breached (60 seconds)...")
    time.sleep(60)
    
    # Trigger SLA breach check
    response = make_request("post", "/api/sla/check-breaches", admin_token)
    
    if response.status_code == 200:
        results = response.json().get("data", {})
        print_result("Trigger SLA Breach Check", True, "SLA breach check completed", results)
    else:
        print_result("Trigger SLA Breach Check", False, f"Status code: {response.status_code}", response.json())
    
    # Wait for resolution deadline to be breached (additional 2 minutes)
    print("Waiting for resolution deadline to be breached (additional 120 seconds)...")
    time.sleep(120)
    
    # Trigger SLA breach check again
    response = make_request("post", "/api/sla/check-breaches", admin_token)
    
    if response.status_code == 200:
        results = response.json().get("data", {})
        print_result("Trigger Second SLA Breach Check", True, "SLA breach check completed", results)
    else:
        print_result("Trigger Second SLA Breach Check", False, f"Status code: {response.status_code}", response.json())

def test_check_ticket_sla_status():
    """Check the SLA status of the created tickets"""
    print_section("Checking Ticket SLA Status")
    
    for ticket_id in ticket_ids:
        response = make_request("get", f"/api/tickets/{ticket_id}", admin_token)
        
        if response.status_code == 200:
            ticket_data = response.json().get("data", {})
            sla_data = ticket_data.get("sla", {})
            
            # Check if SLA is breached
            response_breached = sla_data.get("breached", {}).get("response", False)
            resolution_breached = sla_data.get("breached", {}).get("resolution", False)
            
            print_result(f"Check SLA Status for Ticket {ticket_id}", True, 
                        f"Response Breached: {response_breached}, Resolution Breached: {resolution_breached}", 
                        {"ticket": ticket_data.get("ticketNumber"), "sla": sla_data})
            
            # Check audit log for SLA breach entries
            audit_log = ticket_data.get("auditLog", [])
            sla_breach_entries = [entry for entry in audit_log if entry.get("action") == "sla_breached"]
            
            if sla_breach_entries:
                print_result("SLA Breach Audit Log Entries", True, 
                            f"Found {len(sla_breach_entries)} SLA breach entries", 
                            sla_breach_entries)
            else:
                print_result("SLA Breach Audit Log Entries", False, 
                            "No SLA breach entries found in audit log")
        else:
            print_result(f"Check SLA Status for Ticket {ticket_id}", False, 
                        f"Status code: {response.status_code}", response.json())

def test_check_notifications():
    """Check if SLA breach notifications were created"""
    print_section("Checking SLA Breach Notifications")
    
    # Get notifications for admin
    response = make_request("get", "/api/notifications", admin_token)
    
    if response.status_code == 200:
        notifications = response.json().get("data", [])
        sla_notifications = [n for n in notifications if n.get("type") == "sla"]
        
        if sla_notifications:
            print_result("Admin SLA Notifications", True, 
                        f"Found {len(sla_notifications)} SLA notifications", 
                        sla_notifications[:3])  # Show first 3 notifications
        else:
            print_result("Admin SLA Notifications", False, 
                        "No SLA notifications found for admin")
    else:
        print_result("Get Admin Notifications", False, 
                    f"Status code: {response.status_code}", response.json())
    
    # Get notifications for team lead
    response = make_request("get", "/api/notifications", team_lead_token)
    
    if response.status_code == 200:
        notifications = response.json().get("data", [])
        sla_notifications = [n for n in notifications if n.get("type") == "sla"]
        
        if sla_notifications:
            print_result("Team Lead SLA Notifications", True, 
                        f"Found {len(sla_notifications)} SLA notifications", 
                        sla_notifications[:3])  # Show first 3 notifications
        else:
            print_result("Team Lead SLA Notifications", False, 
                        "No SLA notifications found for team lead")
    else:
        print_result("Get Team Lead Notifications", False, 
                    f"Status code: {response.status_code}", response.json())

def test_get_tickets_with_breached_sla():
    """Test retrieving tickets with breached SLA"""
    print_section("Testing Ticket Retrieval with Breached SLA")
    
    # Get tickets with SLA breach filter
    params = {
        "slaBreached": "true"
    }
    
    response = make_request("get", "/api/tickets", admin_token, params=params)
    
    if response.status_code == 200:
        tickets = response.json().get("data", [])
        
        # Check if our test tickets are in the results
        test_tickets_found = [t for t in tickets if t.get("_id") in ticket_ids]
        
        print_result("Get Tickets with Breached SLA", True, 
                    f"Found {len(tickets)} tickets with SLA breaches, {len(test_tickets_found)} are our test tickets", 
                    {"total": len(tickets), "testTicketsFound": len(test_tickets_found)})
    else:
        print_result("Get Tickets with Breached SLA", False, 
                    f"Status code: {response.status_code}", response.json())

def run_all_tests():
    """Run all tests in sequence"""
    try:
        test_authentication()
        test_create_short_sla_policy()
        test_create_tickets_with_short_sla()
        test_wait_for_sla_breach()
        test_check_ticket_sla_status()
        test_check_notifications()
        test_get_tickets_with_breached_sla()
        
        print_section("Test Summary")
        print("All tests completed. Check the results above for details.")
    except Exception as e:
        print(f"\n❌ ERROR: An exception occurred during testing: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_all_tests()
