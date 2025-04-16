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

def get_sla_policies(cookies):
    """Get list of SLA policies"""
    response = requests.get(f"{BASE_URL}/sla/policies", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get SLA policies: {response.text}")
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

def check_sla_breaches(cookies):
    """Trigger SLA breach check"""
    response = requests.post(f"{BASE_URL}/sla/check-breaches", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to check SLA breaches: {response.text}")
        return None
    return response.json()

def get_sla_performance_report(cookies):
    """Get SLA performance report"""
    response = requests.get(f"{BASE_URL}/reports/sla-performance", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get SLA performance report: {response.text}")
        return None
    return response.json()["data"]

def get_sla_breach_report(cookies):
    """Get SLA breach report"""
    response = requests.get(f"{BASE_URL}/reports/sla-breaches", cookies=cookies)
    if response.status_code != 200:
        print(f"Failed to get SLA breach report: {response.text}")
        return None
    return response.json()["data"]

def test_ticket_sla():
    """Test SLA functionality with tickets"""
    print("\n=== Testing Ticket SLA Functionality ===\n")
    
    # Login as admin
    print("Logging in as admin...")
    admin_cookies = login(ADMIN_CREDENTIALS)
    
    # Step 1: Get SLA policies
    print("\nStep 1: Getting SLA policies...")
    policies = get_sla_policies(admin_cookies)
    if not policies:
        print("❌ No SLA policies found")
        return False
    
    policy_id = policies[0]["_id"]
    policy_name = policies[0]["name"]
    print(f"✅ Found SLA policy: {policy_name} (ID: {policy_id})")
    
    # Step 2: Create a ticket with SLA policy
    print("\nStep 2: Creating a ticket with SLA policy...")
    ticket_data = {
        "title": f"SLA Test Ticket {int(time.time())}",
        "description": "This is a test ticket for testing SLA functionality",
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
    
    # Step 3: Verify SLA is applied
    print("\nStep 3: Verifying SLA is applied...")
    if "sla" not in ticket:
        print("❌ Ticket does not have SLA field")
        return False
    
    if not ticket["sla"].get("policyId"):
        print("❌ SLA policy not applied to ticket")
        return False
    
    print(f"✅ SLA policy applied to ticket")
    print(f"   Response deadline: {ticket['sla']['responseDeadline']}")
    print(f"   Resolution deadline: {ticket['sla']['resolutionDeadline']}")
    
    # Step 4: Update ticket priority and check SLA recalculation
    print("\nStep 4: Updating ticket priority to critical...")
    updated_ticket = update_ticket(admin_cookies, ticket_id, {"priority": "critical"})
    if not updated_ticket:
        print("❌ Failed to update ticket priority")
        return False
    
    print(f"✅ Updated ticket priority to {updated_ticket['priority']}")
    print(f"   New response deadline: {updated_ticket['sla']['responseDeadline']}")
    print(f"   New resolution deadline: {updated_ticket['sla']['resolutionDeadline']}")
    
    # Step 5: Check audit log for SLA recalculation
    print("\nStep 5: Checking audit log for SLA recalculation...")
    audit_log = updated_ticket.get("auditLog", [])
    sla_recalculation_entries = [entry for entry in audit_log if entry["action"] == "sla_recalculated"]
    
    if not sla_recalculation_entries:
        print("❌ No SLA recalculation entries found in audit log")
        return False
    
    print(f"✅ Found {len(sla_recalculation_entries)} SLA recalculation entries")
    for i, entry in enumerate(sla_recalculation_entries):
        print(f"   {i+1}. Reason: {entry['details']['reason']}")
        print(f"      Old priority: {entry['details']['oldPriority']}")
        print(f"      New priority: {entry['details']['newPriority']}")
        print(f"      Old response deadline: {entry['details']['oldResponseDeadline']}")
        print(f"      New response deadline: {entry['details']['newResponseDeadline']}")
    
    # Step 6: Trigger SLA breach check
    print("\nStep 6: Triggering SLA breach check...")
    result = check_sla_breaches(admin_cookies)
    if not result:
        print("❌ Failed to trigger SLA breach check")
        return False
    
    print(f"✅ SLA breach check completed")
    print(f"   Tickets checked: {result['data']['checked']}")
    print(f"   Response breaches: {result['data']['breached']['response']}")
    print(f"   Resolution breaches: {result['data']['breached']['resolution']}")
    
    # Step 7: Get SLA performance report
    print("\nStep 7: Getting SLA performance report...")
    performance_report = get_sla_performance_report(admin_cookies)
    if not performance_report:
        print("❌ Failed to get SLA performance report")
        return False
    
    print(f"✅ SLA performance report retrieved")
    print(f"   Total tickets: {performance_report['overall']['totalTickets']}")
    print(f"   Response compliance rate: {performance_report['overall']['responseComplianceRate']}%")
    print(f"   Resolution compliance rate: {performance_report['overall']['resolutionComplianceRate']}%")
    
    # Step 8: Get SLA breach report
    print("\nStep 8: Getting SLA breach report...")
    breach_report = get_sla_breach_report(admin_cookies)
    if not breach_report:
        print("❌ Failed to get SLA breach report")
        return False
    
    print(f"✅ SLA breach report retrieved")
    print(f"   Total breaches: {breach_report['totalBreaches']}")
    print(f"   Response breaches: {breach_report['responseBreaches']}")
    print(f"   Resolution breaches: {breach_report['resolutionBreaches']}")
    
    # Step 9: Update ticket status to test SLA pausing
    print("\nStep 9: Updating ticket status to on_hold to test SLA pausing...")
    updated_ticket = update_ticket(admin_cookies, ticket_id, {
        "status": "on_hold",
        "holdReason": "waiting_for_customer"
    })
    if not updated_ticket:
        print("❌ Failed to update ticket status")
        return False
    
    print(f"✅ Updated ticket status to {updated_ticket['status']}")
    if "pausedAt" in updated_ticket["sla"]:
        print(f"   SLA paused at: {updated_ticket['sla']['pausedAt']}")
    
    # Step 10: Resume SLA by changing status back to in_progress
    print("\nStep 10: Resuming SLA by changing status to in_progress...")
    updated_ticket = update_ticket(admin_cookies, ticket_id, {"status": "in_progress"})
    if not updated_ticket:
        print("❌ Failed to update ticket status")
        return False
    
    print(f"✅ Updated ticket status to {updated_ticket['status']}")
    if "totalPausedTime" in updated_ticket["sla"]:
        print(f"   Total paused time: {updated_ticket['sla']['totalPausedTime']} minutes")
    
    print("\n=== Ticket SLA Test Completed Successfully ===")
    return True

if __name__ == "__main__":
    success = test_ticket_sla()
    sys.exit(0 if success else 1)
