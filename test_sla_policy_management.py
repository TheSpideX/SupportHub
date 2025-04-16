#!/usr/bin/env python3
"""
Test Script for SLA Policy Management
This script tests the creation, retrieval, update, and deletion of SLA policies
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

# Global variables
admin_token = None
admin_id = None
organization_id = None
admin_cookies = None
created_policies = []

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

    # Print cookies for debugging
    print(f"Cookies: {dict(cookies)}")

    return {
        "token": data.get("token"),
        "user_id": data.get("user", {}).get("_id"),
        "organization_id": data.get("user", {}).get("organizationId"),
        "cookies": cookies
    }

def make_request(method, endpoint, token=None, data=None, params=None, cookies=None):
    """Make an API request with authentication"""
    url = f"{BASE_URL}{endpoint}"
    headers = {}

    if token:
        headers["Authorization"] = f"Bearer {token}"

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
    """Test authentication for admin user"""
    global admin_token, admin_id, organization_id, admin_cookies

    print_section("Testing Authentication")

    # Admin login
    admin_auth = login(ADMIN_CREDENTIALS)
    if admin_auth:
        admin_token = admin_auth["token"]
        admin_id = admin_auth["user_id"]
        organization_id = admin_auth["organization_id"]
        admin_cookies = admin_auth["cookies"]
        print_result("Admin Login", True, f"Admin ID: {admin_id}, Organization ID: {organization_id}")
    else:
        print_result("Admin Login", False, "Failed to login as admin")
        sys.exit(1)

def test_create_sla_policy():
    """Test creating an SLA policy with different configurations"""
    global created_policies

    print_section("Testing SLA Policy Creation")

    # Test Case 1: Create a basic SLA policy
    basic_policy_data = {
        "name": f"Basic SLA Policy {int(time.time())}",
        "description": "Basic SLA policy for testing",
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

    response = make_request("post", "/api/sla/policies", admin_token, basic_policy_data, cookies=admin_cookies)

    if response.status_code == 201:
        policy_id = response.json().get("data", {}).get("_id")
        created_policies.append(policy_id)
        print_result("Create Basic SLA Policy", True, f"SLA Policy ID: {policy_id}", response.json().get("data"))
    else:
        print_result("Create Basic SLA Policy", False, f"Status code: {response.status_code}", response.json())

    # Test Case 2: Create an SLA policy with business hours
    business_hours_policy_data = {
        "name": f"Business Hours SLA Policy {int(time.time())}",
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
            "monday": { "start": "09:00", "end": "17:00" },
            "tuesday": { "start": "09:00", "end": "17:00" },
            "wednesday": { "start": "09:00", "end": "17:00" },
            "thursday": { "start": "09:00", "end": "17:00" },
            "friday": { "start": "09:00", "end": "17:00" },
            "saturday": { "start": "", "end": "" },
            "sunday": { "start": "", "end": "" }
        }
    }

    response = make_request("post", "/api/sla/policies", admin_token, business_hours_policy_data, cookies=admin_cookies)

    if response.status_code == 201:
        policy_id = response.json().get("data", {}).get("_id")
        created_policies.append(policy_id)
        print_result("Create Business Hours SLA Policy", True, f"SLA Policy ID: {policy_id}", response.json().get("data"))
    else:
        print_result("Create Business Hours SLA Policy", False, f"Status code: {response.status_code}", response.json())

    # Test Case 3: Create an SLA policy with escalation rules
    escalation_policy_data = {
        "name": f"Escalation SLA Policy {int(time.time())}",
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
                "actions": ["notify_assignee"]
            },
            {
                "condition": "response_breached",
                "threshold": 100,
                "actions": ["notify_team_lead", "increase_priority"]
            },
            {
                "condition": "resolution_approaching",
                "threshold": 80,
                "actions": ["notify_assignee"]
            },
            {
                "condition": "resolution_breached",
                "threshold": 100,
                "actions": ["notify_manager"]
            }
        ]
    }

    response = make_request("post", "/api/sla/policies", admin_token, escalation_policy_data, cookies=admin_cookies)

    if response.status_code == 201:
        policy_id = response.json().get("data", {}).get("_id")
        created_policies.append(policy_id)
        print_result("Create Escalation SLA Policy", True, f"SLA Policy ID: {policy_id}", response.json().get("data"))
    else:
        print_result("Create Escalation SLA Policy", False, f"Status code: {response.status_code}", response.json())

    # Test Case 4: Create an SLA policy with holidays
    holidays_policy_data = {
        "name": f"Holidays SLA Policy {int(time.time())}",
        "description": "SLA policy with holidays for testing",
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
            "monday": { "start": "09:00", "end": "17:00" },
            "tuesday": { "start": "09:00", "end": "17:00" },
            "wednesday": { "start": "09:00", "end": "17:00" },
            "thursday": { "start": "09:00", "end": "17:00" },
            "friday": { "start": "09:00", "end": "17:00" },
            "saturday": { "start": "", "end": "" },
            "sunday": { "start": "", "end": "" }
        },
        "holidays": [
            {
                "date": (datetime.now() + timedelta(days=7)).isoformat(),
                "name": "Test Holiday"
            },
            {
                "date": (datetime.now() + timedelta(days=14)).isoformat(),
                "name": "Another Test Holiday"
            }
        ]
    }

    response = make_request("post", "/api/sla/policies", admin_token, holidays_policy_data, cookies=admin_cookies)

    if response.status_code == 201:
        policy_id = response.json().get("data", {}).get("_id")
        created_policies.append(policy_id)
        print_result("Create Holidays SLA Policy", True, f"SLA Policy ID: {policy_id}", response.json().get("data"))
    else:
        print_result("Create Holidays SLA Policy", False, f"Status code: {response.status_code}", response.json())

def test_get_sla_policies():
    """Test retrieving SLA policies"""
    print_section("Testing SLA Policy Retrieval")

    # Get all SLA policies
    response = make_request("get", "/api/sla/policies", admin_token, cookies=admin_cookies)

    if response.status_code == 200:
        policies = response.json().get("data", [])
        print_result("Get All SLA Policies", True, f"Found {len(policies)} policies",
                    [{"id": p.get("_id"), "name": p.get("name")} for p in policies[:5]])
    else:
        print_result("Get All SLA Policies", False, f"Status code: {response.status_code}", response.json())

    # Get specific SLA policy
    if created_policies:
        policy_id = created_policies[0]
        response = make_request("get", f"/api/sla/policies/{policy_id}", admin_token, cookies=admin_cookies)

        if response.status_code == 200:
            policy = response.json().get("data", {})
            print_result("Get SLA Policy by ID", True, f"Policy name: {policy.get('name')}", policy)
        else:
            print_result("Get SLA Policy by ID", False, f"Status code: {response.status_code}", response.json())

def test_update_sla_policy():
    """Test updating an SLA policy"""
    print_section("Testing SLA Policy Update")

    if not created_policies:
        print_result("Update SLA Policy", False, "No SLA policies available to update")
        return

    policy_id = created_policies[0]

    # Get current policy data
    response = make_request("get", f"/api/sla/policies/{policy_id}", admin_token, cookies=admin_cookies)
    if response.status_code != 200:
        print_result("Get Current Policy", False, f"Status code: {response.status_code}", response.json())
        return

    current_policy = response.json().get("data", {})

    # Update policy
    update_data = {
        "name": f"Updated SLA Policy {int(time.time())}",
        "description": "Updated description for testing",
        "responseTime": {
            "low": 300,      # 5 hours in minutes
            "medium": 180,   # 3 hours in minutes
            "high": 90,      # 1.5 hours in minutes
            "critical": 45   # 45 minutes
        }
    }

    response = make_request("put", f"/api/sla/policies/{policy_id}", admin_token, update_data, cookies=admin_cookies)

    if response.status_code == 200:
        updated_policy = response.json().get("data", {})
        print_result("Update SLA Policy", True,
                    f"Policy updated from '{current_policy.get('name')}' to '{updated_policy.get('name')}'",
                    updated_policy)
    else:
        print_result("Update SLA Policy", False, f"Status code: {response.status_code}", response.json())

def test_delete_sla_policy():
    """Test deleting an SLA policy"""
    print_section("Testing SLA Policy Deletion")

    if not created_policies:
        print_result("Delete SLA Policy", False, "No SLA policies available to delete")
        return

    policy_id = created_policies.pop()  # Get the last created policy

    response = make_request("delete", f"/api/sla/policies/{policy_id}", admin_token, cookies=admin_cookies)

    if response.status_code == 200:
        print_result("Delete SLA Policy", True, f"Policy {policy_id} deleted successfully")

        # Verify deletion
        response = make_request("get", f"/api/sla/policies/{policy_id}", admin_token, cookies=admin_cookies)
        if response.status_code == 404:
            print_result("Verify Deletion", True, "Policy no longer exists")
        else:
            print_result("Verify Deletion", False, f"Status code: {response.status_code}", response.json())
    else:
        print_result("Delete SLA Policy", False, f"Status code: {response.status_code}", response.json())

def test_sla_policy_validation():
    """Test SLA policy validation"""
    print_section("Testing SLA Policy Validation")

    # Test Case 1: Missing required fields
    invalid_policy_data = {
        "name": f"Invalid SLA Policy {int(time.time())}"
        # Missing responseTime and resolutionTime
    }

    response = make_request("post", "/api/sla/policies", admin_token, invalid_policy_data, cookies=admin_cookies)

    if response.status_code >= 400:
        print_result("Validation: Missing Required Fields", True,
                    f"Server correctly rejected with status code: {response.status_code}",
                    response.json())
    else:
        print_result("Validation: Missing Required Fields", False,
                    f"Server accepted invalid data with status code: {response.status_code}",
                    response.json())

    # Test Case 2: Invalid response time values
    invalid_response_time_data = {
        "name": f"Invalid Response Time SLA Policy {int(time.time())}",
        "description": "SLA policy with invalid response time values",
        "responseTime": {
            "low": "invalid",  # Should be a number
            "medium": -120,    # Should be positive
            "high": 60,
            "critical": 30
        },
        "resolutionTime": {
            "low": 4320,
            "medium": 1440,
            "high": 480,
            "critical": 240
        }
    }

    response = make_request("post", "/api/sla/policies", admin_token, invalid_response_time_data, cookies=admin_cookies)

    if response.status_code >= 400:
        print_result("Validation: Invalid Response Time Values", True,
                    f"Server correctly rejected with status code: {response.status_code}",
                    response.json())
    else:
        print_result("Validation: Invalid Response Time Values", False,
                    f"Server accepted invalid data with status code: {response.status_code}",
                    response.json())

    # Test Case 3: Invalid business hours format
    invalid_business_hours_data = {
        "name": f"Invalid Business Hours SLA Policy {int(time.time())}",
        "description": "SLA policy with invalid business hours format",
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
            "monday": { "start": "25:00", "end": "17:00" },  # Invalid time
            "tuesday": { "start": "09:00", "end": "17:00" }
        }
    }

    response = make_request("post", "/api/sla/policies", admin_token, invalid_business_hours_data, cookies=admin_cookies)

    if response.status_code >= 400:
        print_result("Validation: Invalid Business Hours Format", True,
                    f"Server correctly rejected with status code: {response.status_code}",
                    response.json())
    else:
        print_result("Validation: Invalid Business Hours Format", False,
                    f"Server accepted invalid data with status code: {response.status_code}",
                    response.json())

def run_all_tests():
    """Run all tests in sequence"""
    try:
        test_authentication()
        test_create_sla_policy()
        test_get_sla_policies()
        test_update_sla_policy()
        test_sla_policy_validation()
        test_delete_sla_policy()

        print_section("Test Summary")
        print("All tests completed. Check the results above for details.")
    except Exception as e:
        print(f"\n❌ ERROR: An exception occurred during testing: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_all_tests()
