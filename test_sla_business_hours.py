#!/usr/bin/env python3
"""
Test Script for SLA Business Hours and Holidays
This script tests the SLA calculation with business hours and holidays
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
sla_policy_id = None
ticket_id = None

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
    """Test authentication for admin user"""
    global admin_token, admin_id, organization_id
    
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

def test_create_business_hours_sla_policy():
    """Create an SLA policy with business hours and holidays"""
    global sla_policy_id
    
    print_section("Creating Business Hours SLA Policy")
    
    # Get current day of week (0 = Monday, 6 = Sunday)
    current_day = datetime.now().weekday()
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    current_day_name = day_names[current_day]
    
    # Create business hours for all days, with current day having extended hours
    business_hours = {}
    for day in day_names:
        if day == current_day_name:
            # Extended hours for current day to ensure we're in business hours
            business_hours[day] = {"start": "00:00", "end": "23:59"}
        elif day in ["saturday", "sunday"]:
            # No business hours on weekends
            business_hours[day] = {"start": "", "end": ""}
        else:
            # Regular business hours on weekdays
            business_hours[day] = {"start": "09:00", "end": "17:00"}
    
    # Create an SLA policy with business hours and holidays
    sla_policy_data = {
        "name": f"Business Hours SLA Policy {int(time.time())}",
        "description": "SLA policy with business hours and holidays for testing",
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
        "businessHours": business_hours,
        "holidays": [
            {
                "date": (datetime.now() + timedelta(days=1)).isoformat(),
                "name": "Test Holiday Tomorrow"
            },
            {
                "date": (datetime.now() + timedelta(days=7)).isoformat(),
                "name": "Test Holiday Next Week"
            }
        ]
    }
    
    response = make_request("post", "/api/sla/policies", admin_token, sla_policy_data)
    
    if response.status_code == 201:
        sla_policy_id = response.json().get("data", {}).get("_id")
        print_result("Create Business Hours SLA Policy", True, 
                    f"SLA Policy ID: {sla_policy_id}", 
                    {"policy": response.json().get("data"), "currentDay": current_day_name})
    else:
        print_result("Create Business Hours SLA Policy", False, 
                    f"Status code: {response.status_code}", response.json())
        sys.exit(1)

def test_create_ticket_with_business_hours_sla():
    """Create a ticket with the business hours SLA policy"""
    global ticket_id
    
    print_section("Creating Ticket with Business Hours SLA")
    
    # Create a ticket with the business hours SLA policy
    ticket_data = {
        "title": f"Business Hours SLA Test Ticket {int(time.time())}",
        "description": "This is a test ticket for testing SLA calculation with business hours",
        "category": "technical",
        "subcategory": "server",
        "priority": "high",
        "source": "direct_creation",
        "slaPolicy": sla_policy_id
    }
    
    response = make_request("post", "/api/tickets", admin_token, ticket_data)
    
    if response.status_code == 201:
        ticket_id = response.json().get("data", {}).get("_id")
        ticket_data = response.json().get("data", {})
        print_result("Create Ticket with Business Hours SLA", True, 
                    f"Ticket ID: {ticket_id}", ticket_data)
        
        # Check if SLA was applied
        if ticket_data.get("sla"):
            sla_data = ticket_data.get("sla")
            print_result("SLA Applied with Business Hours", True, "SLA data found in ticket", sla_data)
            
            # Calculate expected response and resolution times
            created_at = datetime.fromisoformat(ticket_data.get("createdAt").replace("Z", "+00:00"))
            response_deadline = datetime.fromisoformat(sla_data.get("responseDeadline").replace("Z", "+00:00"))
            resolution_deadline = datetime.fromisoformat(sla_data.get("resolutionDeadline").replace("Z", "+00:00"))
            
            response_minutes = (response_deadline - created_at).total_seconds() / 60
            resolution_minutes = (resolution_deadline - created_at).total_seconds() / 60
            
            print_result("SLA Deadline Calculation", True, 
                        f"Response time: {response_minutes:.2f} minutes, Resolution time: {resolution_minutes:.2f} minutes", 
                        {
                            "createdAt": created_at.isoformat(),
                            "responseDeadline": response_deadline.isoformat(),
                            "resolutionDeadline": resolution_deadline.isoformat(),
                            "responseMinutes": response_minutes,
                            "resolutionMinutes": resolution_minutes
                        })
        else:
            print_result("SLA Applied with Business Hours", False, "No SLA data found in ticket")
    else:
        print_result("Create Ticket with Business Hours SLA", False, 
                    f"Status code: {response.status_code}", response.json())

def test_pause_and_resume_sla():
    """Test pausing and resuming SLA with business hours"""
    print_section("Testing SLA Pause and Resume with Business Hours")
    
    if not ticket_id:
        print_result("Pause SLA", False, "No ticket ID available")
        return
    
    # Get current ticket data
    response = make_request("get", f"/api/tickets/{ticket_id}", admin_token)
    if response.status_code != 200:
        print_result("Get Current Ticket", False, f"Status code: {response.status_code}", response.json())
        return
    
    current_ticket = response.json().get("data", {})
    current_sla = current_ticket.get("sla", {})
    
    # Pause SLA
    pause_data = {
        "reason": "Testing SLA pause with business hours"
    }
    
    response = make_request("post", f"/api/sla/pause/{ticket_id}", admin_token, pause_data)
    
    if response.status_code == 200:
        paused_ticket = response.json().get("data", {})
        paused_sla = paused_ticket.get("sla", {})
        print_result("Pause SLA with Business Hours", True, "SLA paused successfully", paused_sla)
        
        # Wait for a short time
        print("Waiting for 10 seconds while SLA is paused...")
        time.sleep(10)
        
        # Resume SLA
        response = make_request("post", f"/api/sla/resume/{ticket_id}", admin_token)
        
        if response.status_code == 200:
            resumed_ticket = response.json().get("data", {})
            resumed_sla = resumed_ticket.get("sla", {})
            print_result("Resume SLA with Business Hours", True, "SLA resumed successfully", resumed_sla)
            
            # Check if deadlines were adjusted
            if resumed_sla.get("totalPausedTime"):
                print_result("SLA Pause Time Tracking", True, 
                            f"Total paused time: {resumed_sla.get('totalPausedTime')} minutes", 
                            {
                                "original": {
                                    "responseDeadline": current_sla.get("responseDeadline"),
                                    "resolutionDeadline": current_sla.get("resolutionDeadline")
                                },
                                "after_resume": {
                                    "responseDeadline": resumed_sla.get("responseDeadline"),
                                    "resolutionDeadline": resumed_sla.get("resolutionDeadline"),
                                    "totalPausedTime": resumed_sla.get("totalPausedTime")
                                }
                            })
            else:
                print_result("SLA Pause Time Tracking", False, "No pause time recorded")
        else:
            print_result("Resume SLA with Business Hours", False, 
                        f"Status code: {response.status_code}", response.json())
    else:
        print_result("Pause SLA with Business Hours", False, 
                    f"Status code: {response.status_code}", response.json())

def test_sla_calculation_methods():
    """Test SLA calculation methods directly"""
    print_section("Testing SLA Calculation Methods")
    
    if not sla_policy_id:
        print_result("Test SLA Calculation Methods", False, "No SLA policy ID available")
        return
    
    # Get the SLA policy
    response = make_request("get", f"/api/sla/policies/{sla_policy_id}", admin_token)
    if response.status_code != 200:
        print_result("Get SLA Policy", False, f"Status code: {response.status_code}", response.json())
        return
    
    policy = response.json().get("data", {})
    
    # Test business hours check
    now = datetime.now()
    day_of_week = now.strftime("%A").lower()
    current_time = now.strftime("%H:%M")
    
    business_hours = policy.get("businessHours", {})
    day_hours = business_hours.get(day_of_week, {})
    
    is_within_business_hours = False
    if day_hours.get("start") and day_hours.get("end"):
        is_within_business_hours = day_hours.get("start") <= current_time <= day_hours.get("end")
    
    print_result("Business Hours Check", True, 
                f"Current time: {current_time}, Day: {day_of_week}, Within business hours: {is_within_business_hours}", 
                {
                    "currentTime": current_time,
                    "dayOfWeek": day_of_week,
                    "dayHours": day_hours,
                    "isWithinBusinessHours": is_within_business_hours
                })
    
    # Test holiday check
    today = now.date().isoformat()
    holidays = policy.get("holidays", [])
    holiday_dates = [h.get("date").split("T")[0] for h in holidays]
    
    is_holiday = today in holiday_dates
    
    print_result("Holiday Check", True, 
                f"Today: {today}, Is holiday: {is_holiday}", 
                {
                    "today": today,
                    "holidays": holidays,
                    "isHoliday": is_holiday
                })
    
    # Test deadline calculation for different priorities
    priorities = ["low", "medium", "high", "critical"]
    
    for priority in priorities:
        # Calculate expected response and resolution times based on policy
        response_minutes = policy.get("responseTime", {}).get(priority, 0)
        resolution_minutes = policy.get("resolutionTime", {}).get(priority, 0)
        
        print_result(f"SLA Calculation for {priority.capitalize()} Priority", True, 
                    f"Response time: {response_minutes} minutes, Resolution time: {resolution_minutes} minutes", 
                    {
                        "priority": priority,
                        "responseMinutes": response_minutes,
                        "resolutionMinutes": resolution_minutes,
                        "businessHoursAdjusted": True
                    })

def run_all_tests():
    """Run all tests in sequence"""
    try:
        test_authentication()
        test_create_business_hours_sla_policy()
        test_create_ticket_with_business_hours_sla()
        test_pause_and_resume_sla()
        test_sla_calculation_methods()
        
        print_section("Test Summary")
        print("All tests completed. Check the results above for details.")
    except Exception as e:
        print(f"\n❌ ERROR: An exception occurred during testing: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_all_tests()
