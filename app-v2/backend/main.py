"""
FastAPI Backend for Wildlife Survey Management System

This API provides RESTful endpoints for managing surveys, species, transects, and sightings.
Following DEVELOPMENT.md conventions, this backend separates concerns while reusing
database logic from the Streamlit POC.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import surveys, species, transects, surveyors

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

# Development: Allow localhost on different ports
origins = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:5174",  # Backup Vite port
    "http://localhost:3000",  # Alternative React dev server
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # TODO: Update for production deployment
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)

# ============================================================================
# Include Routers - Organize endpoints by resource
# ============================================================================

app.include_router(surveys.router, prefix="/api/surveys", tags=["Surveys"])
app.include_router(species.router, prefix="/api/species", tags=["Species"])
app.include_router(transects.router, prefix="/api/transects", tags=["Transects"])
app.include_router(surveyors.router, prefix="/api/surveyors", tags=["Surveyors"])

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
