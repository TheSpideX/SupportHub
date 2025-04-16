#!/usr/bin/env python3
"""
Run All Tests for Ticket System with SLA Integration
This script runs all the test scripts in sequence
"""

import os
import sys
import time
import subprocess
from datetime import datetime

# List of test scripts to run
TEST_SCRIPTS = [
    "test_sla_policy_management.py",
    "test_ticket_sla_system.py",
    "test_sla_business_hours.py",
    "test_sla_breach_notifications.py",
    "test_ticket_sla_integration.py"
]

def print_section(title):
    """Print a section title"""
    print("\n" + "="*80)
    print(f" {title} ".center(80, "="))
    print("="*80)

def run_test_script(script_name):
    """Run a test script and return the result"""
    print_section(f"Running {script_name}")
    
    start_time = time.time()
    result = subprocess.run(["python3", script_name], capture_output=True, text=True)
    end_time = time.time()
    
    duration = end_time - start_time
    
    print(f"\nTest script {script_name} completed in {duration:.2f} seconds")
    print(f"Exit code: {result.returncode}")
    
    if result.returncode != 0:
        print("\nERROR OUTPUT:")
        print(result.stderr)
    
    # Save output to file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"test_results/{os.path.splitext(script_name)[0]}_{timestamp}.log"
    
    # Create directory if it doesn't exist
    os.makedirs("test_results", exist_ok=True)
    
    with open(output_file, "w") as f:
        f.write(f"Test script: {script_name}\n")
        f.write(f"Timestamp: {datetime.now().isoformat()}\n")
        f.write(f"Duration: {duration:.2f} seconds\n")
        f.write(f"Exit code: {result.returncode}\n\n")
        f.write("STDOUT:\n")
        f.write(result.stdout)
        f.write("\n\nSTDERR:\n")
        f.write(result.stderr)
    
    print(f"Test results saved to {output_file}")
    
    return result.returncode == 0

def run_all_tests():
    """Run all test scripts in sequence"""
    print_section("Starting All Tests")
    print(f"Running {len(TEST_SCRIPTS)} test scripts")
    
    start_time = time.time()
    results = []
    
    for script in TEST_SCRIPTS:
        success = run_test_script(script)
        results.append((script, success))
    
    end_time = time.time()
    total_duration = end_time - start_time
    
    print_section("Test Summary")
    print(f"Total duration: {total_duration:.2f} seconds")
    print(f"Tests passed: {sum(1 for _, success in results if success)} / {len(results)}")
    
    for script, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} - {script}")
    
    # Return success if all tests passed
    return all(success for _, success in results)

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
