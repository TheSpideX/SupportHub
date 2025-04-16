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

def login(credentials):
    response = requests.post(f"{BASE_URL}/auth/login", json=credentials)
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        sys.exit(1)
    return response.cookies

def test_ticket_system():
    print("\n=== Testing Ticket System and SLA According to SRS ===\n")
    
    # Login as admin
    print("Logging in as admin...")
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Test 1: Check if SLA policies exist
    print("\nTest 1: Checking SLA policies...")
    response = requests.get(f"{BASE_URL}/sla/policies", cookies=admin_cookies)
    if response.status_code != 200:
        print("❌ Failed to get SLA policies")
        return False
    
    policies = response.json().get("data", [])
    if not policies:
        print("❌ No SLA policies found")
        return False
    
    print(f"✅ Found {len(policies)} SLA policies")
    
    # Test 2: Check if tickets exist
    print("\nTest 2: Checking tickets...")
    response = requests.get(f"{BASE_URL}/tickets", cookies=admin_cookies)
    if response.status_code != 200:
        print("❌ Failed to get tickets")
        return False
    
    tickets = response.json().get("data", [])
    if not tickets:
        print("❌ No tickets found")
        return False
    
    print(f"✅ Found {len(tickets)} tickets")
    
    # Test 3: Check if SLA breach check works
    print("\nTest 3: Testing SLA breach check...")
    response = requests.post(f"{BASE_URL}/sla/check-breaches", cookies=admin_cookies)
    if response.status_code != 200:
        print("❌ Failed to check SLA breaches")
        return False
    
    result = response.json()
    print(f"✅ SLA breach check completed")
    print(f"   Tickets checked: {result['data']['checked']}")
    print(f"   Response breaches: {result['data']['breached']['response']}")
    print(f"   Resolution breaches: {result['data']['breached']['resolution']}")
    
    # Test 4: Check if SLA performance report works
    print("\nTest 4: Testing SLA performance report...")
    response = requests.get(f"{BASE_URL}/reports/sla-performance", cookies=admin_cookies)
    if response.status_code != 200:
        print("❌ Failed to get SLA performance report")
        return False
    
    performance_report = response.json()["data"]
    print(f"✅ SLA performance report retrieved")
    print(f"   Total tickets: {performance_report['overall']['totalTickets']}")
    print(f"   Response compliance rate: {performance_report['overall']['responseComplianceRate']}%")
    print(f"   Resolution compliance rate: {performance_report['overall']['resolutionComplianceRate']}%")
    
    # Test 5: Check if SLA breach report works
    print("\nTest 5: Testing SLA breach report...")
    response = requests.get(f"{BASE_URL}/reports/sla-breaches", cookies=admin_cookies)
    if response.status_code != 200:
        print("❌ Failed to get SLA breach report")
        return False
    
    breach_report = response.json()["data"]
    print(f"✅ SLA breach report retrieved")
    print(f"   Total breaches: {breach_report['totalBreaches']}")
    print(f"   Response breaches: {breach_report['responseBreaches']}")
    print(f"   Resolution breaches: {breach_report['resolutionBreaches']}")
    
    # Test 6: Create a ticket with SLA
    print("\nTest 6: Creating a ticket with SLA...")
    policy_id = policies[0]["_id"]
    ticket_data = {
        "title": f"Final Test Ticket {int(time.time())}",
        "description": "This is a final test ticket",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": policy_id
    }
    
    response = requests.post(f"{BASE_URL}/tickets", json=ticket_data, cookies=admin_cookies)
    if response.status_code != 201:
        print(f"❌ Failed to create ticket: {response.text}")
        return False
    
    ticket = response.json()["data"]
    ticket_id = ticket["_id"]
    print(f"✅ Created ticket with ID: {ticket_id}")
    
    # Test 7: Check if ticket has SLA
    print("\nTest 7: Checking if ticket has SLA...")
    response = requests.get(f"{BASE_URL}/tickets/{ticket_id}", cookies=admin_cookies)
    if response.status_code != 200:
        print(f"❌ Failed to get ticket: {response.text}")
        return False
    
    ticket = response.json()["data"]
    if "sla" not in ticket:
        print("❌ Ticket does not have SLA field")
        return False
    
    print(f"✅ Ticket has SLA field")
    print(f"   Response deadline: {ticket['sla']['responseDeadline']}")
    print(f"   Resolution deadline: {ticket['sla']['resolutionDeadline']}")
    
    # Test 8: Update ticket priority and check SLA recalculation
    print("\nTest 8: Updating ticket priority and checking SLA recalculation...")
    response = requests.put(f"{BASE_URL}/tickets/{ticket_id}", json={"priority": "critical"}, cookies=admin_cookies)
    if response.status_code != 200:
        print(f"❌ Failed to update ticket: {response.text}")
        return False
    
    updated_ticket = response.json()["data"]
    if "sla" not in updated_ticket:
        print("❌ Updated ticket does not have SLA field")
        return False
    
    print(f"✅ Updated ticket priority to {updated_ticket['priority']}")
    print(f"   New response deadline: {updated_ticket['sla']['responseDeadline']}")
    print(f"   New resolution deadline: {updated_ticket['sla']['resolutionDeadline']}")
    
    # Test 9: Check audit log for SLA recalculation
    print("\nTest 9: Checking audit log for SLA recalculation...")
    sla_recalculation_found = False
    for entry in updated_ticket["auditLog"]:
        if entry["action"] == "sla_recalculated":
            sla_recalculation_found = True
            print(f"✅ Found SLA recalculation in audit log:")
            print(f"   Reason: {entry['details']['reason']}")
            print(f"   Old priority: {entry['details']['oldPriority']}")
            print(f"   New priority: {entry['details']['newPriority']}")
            break
    
    if not sla_recalculation_found:
        print("❌ No SLA recalculation entry found in audit log")
        return False
    
    # Test 10: Check notification routes
    print("\nTest 10: Checking notification routes...")
    response = requests.get(f"{BASE_URL}/notifications", cookies=admin_cookies)
    if response.status_code != 200:
        print(f"❌ Failed to get notifications: {response.text}")
        return False
    
    print(f"✅ Notification routes are working")
    
    print("\n=== All Tests Passed Successfully ===")
    print("\nThe ticket system and SLA functionality are working according to the SRS requirements.")
    return True

if __name__ == "__main__":
    success = test_ticket_system()
    sys.exit(0 if success else 1)
