#!/bin/bash
#
# API Testing Script Wrapper
#
# This script:
# 1. Starts required docker services (db, api)
# 2. Waits for services to be ready
# 3. Runs the API test script inside the container
# 4. Displays results
#
# Usage:
#   ./test-api.sh
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Print colored messages
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
    echo -e "\n${BOLD}${BLUE}=== $1 ===${NC}\n"
}

# Check if docker is running
check_docker() {
    print_info "Checking if Docker is running..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Start docker services
start_services() {
    print_header "Starting Docker Services"

    print_info "Starting database and API services..."
    docker compose up -d db api

    if [ $? -eq 0 ]; then
        print_success "Services started successfully"
    else
        print_error "Failed to start services"
        exit 1
    fi
}

# Wait for database to be ready
wait_for_db() {
    print_info "Waiting for database to be ready..."
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if docker exec heal_butterflies_db pg_isready -U postgres > /dev/null 2>&1; then
            print_success "Database is ready"
            return 0
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 1
    done

    echo ""
    print_error "Database failed to become ready after ${max_attempts} seconds"
    exit 1
}

# Wait for API to be ready
wait_for_api() {
    print_info "Waiting for API to be ready..."
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
            print_success "API is ready"
            return 0
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 1
    done

    echo ""
    print_error "API failed to become ready after ${max_attempts} seconds"
    print_warning "Check API logs with: docker logs heal_butterflies_api"
    exit 1
}

# Run the tests
run_tests() {
    print_header "Running API Tests"

    # Run the test script inside the API container
    docker exec heal_butterflies_api python /app/test_api.py

    # Capture exit code
    test_exit_code=$?

    return $test_exit_code
}

# Show container status
show_status() {
    print_header "Container Status"
    docker compose ps
}

# Main execution
main() {
    print_header "API Testing Script"

    # Check docker
    check_docker

    # Start services
    start_services

    # Wait for services
    wait_for_db
    wait_for_api

    # Give it an extra second to fully initialize
    sleep 2

    # Run tests
    if run_tests; then
        print_success "All tests completed successfully"
        exit_code=0
    else
        print_error "Some tests failed"
        exit_code=1
    fi

    # Show status
    echo ""
    show_status

    echo ""
    print_info "To view API logs: ${BOLD}docker logs heal_butterflies_api${NC}"
    print_info "To view DB logs: ${BOLD}docker logs heal_butterflies_db${NC}"
    print_info "To stop services: ${BOLD}docker compose down${NC}"

    exit $exit_code
}

# Run main function
main
