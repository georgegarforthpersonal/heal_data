"""
FastAPI Backend for Wildlife Survey Management System

This API provides RESTful endpoints for managing surveys, species, locations, and sightings.
Following DEVELOPMENT.md conventions, this backend separates concerns while reusing
database logic from the Streamlit POC.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import surveys, species, locations, surveyors, dashboard

# Initialize FastAPI app
app = FastAPI(
    title="Wildlife Survey API",
    description="API for managing butterfly and wildlife surveys",
    version="2.0.0",
    docs_url="/api/docs",  # Swagger UI
    redoc_url="/api/redoc",  # ReDoc
)

# ============================================================================
# CORS Configuration - Allow React frontend to call API
# ============================================================================

# Development: Allow all origins for mobile testing
# In production, this should be restricted to specific domains
origins = ["*"]  # Allow all origins for development/staging

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)

# ============================================================================
# Include Routers - Organize endpoints by resource
# ============================================================================

app.include_router(surveys.router, prefix="/api/surveys", tags=["Surveys"])
app.include_router(species.router, prefix="/api/species", tags=["Species"])
app.include_router(locations.router, prefix="/api/locations", tags=["Locations"])
app.include_router(surveyors.router, prefix="/api/surveyors", tags=["Surveyors"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])

# ============================================================================
# Health Check Endpoint
# ============================================================================

@app.get("/api/health")
async def health_check():
    """Check if API is running"""
    return {"status": "healthy", "version": "2.0.0"}

@app.get("/")
async def root():
    """Root endpoint - redirect to docs"""
    return {
        "message": "Wildlife Survey API",
        "docs": "/api/docs",
        "health": "/api/health"
    }
