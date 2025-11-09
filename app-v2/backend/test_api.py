#!/usr/bin/env python3
"""
API Testing Script - Tests all API endpoints and displays sample data

This script runs inside the API docker container and tests:
- Health check endpoint
- Surveyors endpoints
- Surveys endpoints
- Species endpoints
- Transects endpoints

Usage (from project root):
    docker exec heal_butterflies_api python /app/test_api.py
"""

import requests
import json
import sys
from typing import Dict, List, Any, Optional
from datetime import datetime


class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


class APITester:
    """Test API endpoints and display results"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results = {
            'passed': 0,
            'failed': 0,
            'total': 0
        }

    def print_header(self, text: str):
        """Print a formatted header"""
        print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 70}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{text:^70}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 70}{Colors.ENDC}\n")

    def print_section(self, text: str):
        """Print a formatted section header"""
        print(f"\n{Colors.OKBLUE}{Colors.BOLD}{text}{Colors.ENDC}")
        print(f"{Colors.OKBLUE}{'-' * len(text)}{Colors.ENDC}")

    def print_success(self, text: str):
        """Print success message"""
        print(f"{Colors.OKGREEN}✓ {text}{Colors.ENDC}")

    def print_error(self, text: str):
        """Print error message"""
        print(f"{Colors.FAIL}✗ {text}{Colors.ENDC}")

    def print_data(self, label: str, value: Any, indent: int = 2):
        """Print data in a formatted way"""
        indent_str = " " * indent
        if isinstance(value, (dict, list)):
            print(f"{indent_str}{Colors.OKCYAN}{label}:{Colors.ENDC}")
            print(f"{indent_str}{json.dumps(value, indent=2, default=str)}")
        else:
            print(f"{indent_str}{Colors.OKCYAN}{label}:{Colors.ENDC} {value}")

    def test_endpoint(self, method: str, endpoint: str, description: str,
                     show_data: bool = True, max_items: int = 3) -> Optional[Any]:
        """
        Test an API endpoint and display results

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            description: Description of what's being tested
            show_data: Whether to display response data
            max_items: Maximum number of items to display from lists

        Returns:
            Response data if successful, None otherwise
        """
        self.results['total'] += 1
        url = f"{self.base_url}{endpoint}"

        print(f"\n{Colors.BOLD}Testing: {description}{Colors.ENDC}")
        print(f"  {method} {url}")

        try:
            response = requests.request(method, url, timeout=5)

            # Check status code
            if response.status_code == 200:
                self.print_success(f"Status: {response.status_code} OK")
                self.results['passed'] += 1
            else:
                self.print_error(f"Status: {response.status_code}")
                self.results['failed'] += 1
                return None

            # Parse and display response data
            try:
                data = response.json()

                if show_data:
                    if isinstance(data, list):
                        count = len(data)
                        self.print_data("Total items", count)

                        if count > 0:
                            print(f"  {Colors.OKCYAN}Sample data (showing {min(count, max_items)} of {count}):{Colors.ENDC}")
                            for i, item in enumerate(data[:max_items]):
                                print(f"\n  {Colors.BOLD}Item {i+1}:{Colors.ENDC}")
                                for key, value in item.items():
                                    print(f"    {key}: {value}")
                        else:
                            self.print_data("Data", "No items found (empty list)")

                    elif isinstance(data, dict):
                        if 'status' in data or 'message' in data:
                            # Health check or info response
                            for key, value in data.items():
                                self.print_data(key, value)
                        else:
                            # Single item response
                            print(f"  {Colors.OKCYAN}Response data:{Colors.ENDC}")
                            for key, value in data.items():
                                print(f"    {key}: {value}")
                    else:
                        self.print_data("Response", data)

                return data

            except json.JSONDecodeError:
                self.print_data("Response (text)", response.text[:200])
                return response.text

        except requests.exceptions.ConnectionError:
            self.print_error("Connection failed - is the API server running?")
            self.results['failed'] += 1
            return None
        except requests.exceptions.Timeout:
            self.print_error("Request timed out")
            self.results['failed'] += 1
            return None
        except Exception as e:
            self.print_error(f"Error: {str(e)}")
            self.results['failed'] += 1
            return None

    def print_summary(self):
        """Print test summary"""
        self.print_header("TEST SUMMARY")

        print(f"  Total tests: {self.results['total']}")
        print(f"  {Colors.OKGREEN}Passed: {self.results['passed']}{Colors.ENDC}")
        print(f"  {Colors.FAIL}Failed: {self.results['failed']}{Colors.ENDC}")

        if self.results['failed'] == 0:
            print(f"\n  {Colors.OKGREEN}{Colors.BOLD}All tests passed!{Colors.ENDC}")
            return 0
        else:
            print(f"\n  {Colors.FAIL}{Colors.BOLD}Some tests failed.{Colors.ENDC}")
            return 1


def main():
    """Run all API tests"""
    tester = APITester()

    tester.print_header("API ENDPOINT TESTING")
    print(f"Testing API at: {tester.base_url}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Test 1: Health Check
    tester.print_section("1. Health Check")
    tester.test_endpoint("GET", "/api/health", "API health check")

    # Test 2: Root endpoint
    tester.print_section("2. Root Endpoint")
    tester.test_endpoint("GET", "/", "Root endpoint info")

    # Test 3: Surveyors
    tester.print_section("3. Surveyors Endpoints")
    surveyors = tester.test_endpoint("GET", "/api/surveyors", "Get all surveyors")

    # If we have surveyors, test getting a specific one
    if surveyors and len(surveyors) > 0:
        surveyor_id = surveyors[0]['id']
        tester.test_endpoint("GET", f"/api/surveyors/{surveyor_id}",
                           f"Get specific surveyor (ID: {surveyor_id})")

    # Test 4: Surveys
    tester.print_section("4. Surveys Endpoints")
    surveys = tester.test_endpoint("GET", "/api/surveys", "Get all surveys")

    # If we have surveys, test getting a specific one
    if surveys and len(surveys) > 0:
        survey_id = surveys[0].get('id') or surveys[0].get('survey_id')
        if survey_id:
            tester.test_endpoint("GET", f"/api/surveys/{survey_id}",
                               f"Get specific survey (ID: {survey_id})")

    # Test 5: Species
    tester.print_section("5. Species Endpoints")
    species = tester.test_endpoint("GET", "/api/species", "Get all species")

    # If we have species, test getting a specific one
    if species and len(species) > 0:
        species_id = species[0].get('id') or species[0].get('species_id')
        if species_id:
            tester.test_endpoint("GET", f"/api/species/{species_id}",
                               f"Get specific species (ID: {species_id})")

    # Test 6: Transects
    tester.print_section("6. Transects Endpoints")
    transects = tester.test_endpoint("GET", "/api/transects", "Get all transects")

    # If we have transects, test getting a specific one
    if transects and len(transects) > 0:
        transect_id = transects[0].get('id') or transects[0].get('transect_id')
        if transect_id:
            tester.test_endpoint("GET", f"/api/transects/{transect_id}",
                               f"Get specific transect (ID: {transect_id})")

    # Print summary and exit
    exit_code = tester.print_summary()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
