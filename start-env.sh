#!/bin/bash

# Helper script to start different environments
# Usage: ./start-env.sh [dev|staging|prod]

set -e

ENV=${1:-dev}

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Heal Butterflies Environment Manager${NC}"
echo -e "${BLUE}========================================${NC}\n"

case $ENV in
  dev)
    echo -e "${GREEN}Starting DEVELOPMENT environment${NC}"
    echo -e "  • Frontend: ${YELLOW}http://localhost:5173${NC}"
    echo -e "  • API: ${YELLOW}http://localhost:8000${NC}"
    echo -e "  • Database: ${YELLOW}Local PostgreSQL container${NC}"
    echo ""
    docker compose --profile dev up -d
    ;;

  staging)
    echo -e "${YELLOW}Starting STAGING environment${NC}"
    echo -e "  • Frontend: ${YELLOW}http://localhost:5173${NC}"
    echo -e "  • API: ${YELLOW}http://localhost:8000${NC}"
    echo -e "  • Database: ${YELLOW}Neon Staging (ep-snowy-base)${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Warning: Connected to staging database${NC}"
    docker compose --profile staging up -d
    ;;

  prod)
    echo -e "${RED}Starting PRODUCTION environment${NC}"
    echo -e "  • Frontend: ${YELLOW}http://localhost:5173${NC}"
    echo -e "  • API: ${YELLOW}http://localhost:8000${NC}"
    echo -e "  • Database: ${RED}Neon Production (ep-bold-lab)${NC}"
    echo ""
    echo -e "${RED}⚠️  WARNING: Connected to PRODUCTION database!${NC}"
    echo -e "${RED}⚠️  Be careful with data modifications!${NC}"
    read -p "Press Enter to continue or Ctrl+C to cancel..."
    docker compose --profile prod up -d
    ;;

  *)
    echo -e "${RED}Error: Invalid environment '${ENV}'${NC}"
    echo ""
    echo "Usage: $0 [dev|staging|prod]"
    echo ""
    echo "Environments:"
    echo "  dev      - Local PostgreSQL database (safe for development)"
    echo "  staging  - Neon staging database (copy of prod data)"
    echo "  prod     - Neon production database (real data, use carefully!)"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}✓ Environment started successfully${NC}"
echo ""
echo "Useful commands:"
echo "  • View API logs:     docker logs -f heal_butterflies_api"
echo "  • Stop environment:  docker compose --profile $ENV down"
echo "  • Health check:      curl http://localhost:8000/api/health"
echo ""
