#!/usr/bin/env python3
"""
Test script for Wildlife Survey API

Tests all major API endpoints to verify the SQLModel migration worked correctly.
Run this script with: python3 test_api.py
"""

import requests
import json
from datetime import date, time
from typing import Dict, Any

# API Base URL
BASE_URL = "http://localhost:8000/api"

# Color codes for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


def print_section(title: str):
    """Print a formatted section header"""
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}{title:^70}{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")


def print_success(message: str):
    """Print a success message"""
    print(f"{GREEN}✓ {message}{RESET}")


def print_error(message: str):
    """Print an error message"""
    print(f"{RED}✗ {message}{RESET}")


def print_info(message: str):
    """Print an info message"""
    print(f"{YELLOW}ℹ {message}{RESET}")


def test_health_check():
    """Test the health check endpoint"""
    print_section("Health Check")
    try:
        response = requests.get(f"{BASE_URL}/health")
        response.raise_for_status()
        data = response.json()
        print_success(f"API is healthy - Version: {data['version']}")
        return True
    except Exception as e:
        print_error(f"Health check failed: {e}")
        return False


def test_surveyors():
    """Test surveyor CRUD operations"""
    print_section("Surveyors API")

    try:
        # Create a surveyor
        print_info("Creating a new surveyor...")
        create_data = {
            "first_name": "Test",
            "last_name": "Surveyor"
        }
        response = requests.post(f"{BASE_URL}/surveyors", json=create_data)
        response.raise_for_status()
        surveyor = response.json()
        surveyor_id = surveyor['id']
        print_success(f"Created surveyor: {surveyor['first_name']} {surveyor['last_name']} (ID: {surveyor_id})")

        # Get all surveyors
        print_info("Fetching all surveyors...")
        response = requests.get(f"{BASE_URL}/surveyors")
        response.raise_for_status()
        surveyors = response.json()
        print_success(f"Found {len(surveyors)} surveyor(s)")

        # Get specific surveyor
        print_info(f"Fetching surveyor {surveyor_id}...")
        response = requests.get(f"{BASE_URL}/surveyors/{surveyor_id}")
        response.raise_for_status()
        print_success(f"Retrieved surveyor: {response.json()['first_name']} {response.json()['last_name']}")

        # Update surveyor
        print_info("Updating surveyor...")
        update_data = {"first_name": "Updated"}
        response = requests.put(f"{BASE_URL}/surveyors/{surveyor_id}", json=update_data)
        response.raise_for_status()
        print_success(f"Updated surveyor name to: {response.json()['first_name']}")

        # Delete surveyor
        print_info("Deleting surveyor...")
        response = requests.delete(f"{BASE_URL}/surveyors/{surveyor_id}")
        response.raise_for_status()
        print_success("Deleted surveyor")

        return True

    except Exception as e:
        print_error(f"Surveyor test failed: {e}")
        return False


def test_species():
    """Test species CRUD operations"""
    print_section("Species API")

    try:
        # Create a species
        print_info("Creating a new species...")
        create_data = {
            "name": "Test Butterfly",
            "conservation_status": "LC",
            "type": "butterfly"
        }
        response = requests.post(f"{BASE_URL}/species", json=create_data)
        response.raise_for_status()
        species = response.json()
        species_id = species['id']
        print_success(f"Created species: {species['name']} (ID: {species_id})")

        # Get all species
        print_info("Fetching all species...")
        response = requests.get(f"{BASE_URL}/species")
        response.raise_for_status()
        all_species = response.json()
        print_success(f"Found {len(all_species)} species")

        # Filter by type
        print_info("Filtering species by type (butterfly)...")
        response = requests.get(f"{BASE_URL}/species?survey_type=butterfly")
        response.raise_for_status()
        butterfly_species = response.json()
        print_success(f"Found {len(butterfly_species)} butterfly species")

        # Delete species
        print_info("Deleting species...")
        response = requests.delete(f"{BASE_URL}/species/{species_id}")
        response.raise_for_status()
        print_success("Deleted species")

        return True

    except Exception as e:
        print_error(f"Species test failed: {e}")
        return False


def test_transects():
    """Test transect CRUD operations"""
    print_section("Transects API")

    try:
        # Create a transect
        print_info("Creating a new transect...")
        create_data = {
            "number": 999,
            "name": "Test Transect",
            "type": "butterfly"
        }
        response = requests.post(f"{BASE_URL}/transects", json=create_data)
        response.raise_for_status()
        transect = response.json()
        transect_id = transect['id']
        print_success(f"Created transect: {transect['name']} (ID: {transect_id})")

        # Get all transects
        print_info("Fetching all transects...")
        response = requests.get(f"{BASE_URL}/transects")
        response.raise_for_status()
        transects = response.json()
        print_success(f"Found {len(transects)} transect(s)")

        # Delete transect
        print_info("Deleting transect...")
        response = requests.delete(f"{BASE_URL}/transects/{transect_id}")
        response.raise_for_status()
        print_success("Deleted transect")

        return True

    except Exception as e:
        print_error(f"Transect test failed: {e}")
        return False


def test_surveys():
    """Test survey CRUD operations"""
    print_section("Surveys API")

    # First, create a surveyor for the test
    try:
        print_info("Setting up test data...")
        surveyor_response = requests.post(f"{BASE_URL}/surveyors", json={
            "first_name": "Survey",
            "last_name": "Tester"
        })
        surveyor_response.raise_for_status()
        surveyor_id = surveyor_response.json()['id']
        print_success(f"Created test surveyor (ID: {surveyor_id})")

        # Create a survey
        print_info("Creating a new survey...")
        create_data = {
            "date": str(date.today()),
            "start_time": "09:00:00",
            "end_time": "11:00:00",
            "sun_percentage": 75,
            "temperature_celsius": 18.5,
            "conditions_met": True,
            "notes": "Test survey",
            "type": "butterfly",
            "surveyor_ids": [surveyor_id]
        }
        response = requests.post(f"{BASE_URL}/surveys", json=create_data)
        response.raise_for_status()
        survey = response.json()
        survey_id = survey['id']
        print_success(f"Created survey (ID: {survey_id})")

        # Get all surveys
        print_info("Fetching all surveys...")
        response = requests.get(f"{BASE_URL}/surveys")
        response.raise_for_status()
        surveys = response.json()
        print_success(f"Found {len(surveys)} survey(s)")

        # Get specific survey
        print_info(f"Fetching survey {survey_id}...")
        response = requests.get(f"{BASE_URL}/surveys/{survey_id}")
        response.raise_for_status()
        print_success(f"Retrieved survey with {len(response.json()['surveyor_ids'])} surveyor(s)")

        # Clean up
        print_info("Cleaning up test data...")
        requests.delete(f"{BASE_URL}/surveys/{survey_id}")
        requests.delete(f"{BASE_URL}/surveyors/{surveyor_id}")
        print_success("Cleanup complete")

        return True

    except Exception as e:
        print_error(f"Survey test failed: {e}")
        # Try to clean up
        try:
            if 'surveyor_id' in locals():
                requests.delete(f"{BASE_URL}/surveyors/{surveyor_id}")
        except:
            pass
        return False


def test_api_docs():
    """Test that API documentation is accessible"""
    print_section("API Documentation")

    try:
        # Test Swagger UI
        print_info("Checking Swagger UI...")
        response = requests.get("http://localhost:8000/api/docs")
        response.raise_for_status()
        print_success("Swagger UI is accessible at http://localhost:8000/api/docs")

        # Test ReDoc
        print_info("Checking ReDoc...")
        response = requests.get("http://localhost:8000/api/redoc")
        response.raise_for_status()
        print_success("ReDoc is accessible at http://localhost:8000/api/redoc")

        # Test OpenAPI schema
        print_info("Checking OpenAPI schema...")
        response = requests.get("http://localhost:8000/openapi.json")
        response.raise_for_status()
        schema = response.json()
        print_success(f"OpenAPI schema loaded - API Title: {schema['info']['title']}")

        return True

    except Exception as e:
        print_error(f"Documentation test failed: {e}")
        return False


def main():
    """Run all tests"""
    print(f"\n{BLUE}{'='*70}")
    print(f"{'Wildlife Survey API Test Suite':^70}")
    print(f"{'='*70}{RESET}\n")

    results = []

    # Run all tests
    results.append(("Health Check", test_health_check()))

    if results[0][1]:  # Only continue if health check passes
        results.append(("Surveyors", test_surveyors()))
        results.append(("Species", test_species()))
        results.append(("Transects", test_transects()))
        results.append(("Surveys", test_surveys()))
        results.append(("API Documentation", test_api_docs()))
    else:
        print_error("Skipping remaining tests due to failed health check")

    # Print summary
    print_section("Test Summary")
    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = f"{GREEN}PASSED{RESET}" if result else f"{RED}FAILED{RESET}"
        print(f"  {test_name}: {status}")

    print(f"\n{BLUE}{'─'*70}{RESET}")
    if passed == total:
        print(f"{GREEN}All tests passed! ({passed}/{total}){RESET}")
        print(f"\n{GREEN}SQLModel migration successful!{RESET}")
        print(f"{GREEN}Your API is ready to use.{RESET}")
    else:
        print(f"{YELLOW}Some tests failed ({passed}/{total} passed){RESET}")
    print(f"{BLUE}{'─'*70}{RESET}\n")

    # Print useful links
    print_info("Useful Links:")
    print(f"  • API Docs (Swagger): http://localhost:8000/api/docs")
    print(f"  • API Docs (ReDoc):   http://localhost:8000/api/redoc")
    print(f"  • Health Check:       http://localhost:8000/api/health")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{YELLOW}Test interrupted by user{RESET}\n")
    except Exception as e:
        print(f"\n{RED}Unexpected error: {e}{RESET}\n")
