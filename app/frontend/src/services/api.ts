/**
 * API Client Service
 *
 * Centralized API client for all backend communication.
 * Following DEVELOPMENT.md conventions:
 * - Built inline first (no premature abstraction)
 * - Simple fetch-based implementation
 * - Ready to be enhanced with React Query later
 */

// API base URL - uses environment variable if available, otherwise falls back to auto-detection
const getApiBaseUrl = () => {
  // First check if environment variable is set (for production deployments)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // If accessed via localhost or 127.0.0.1, use localhost for backend
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000/api';
  }
  // Otherwise (e.g., accessed via 192.168.x.x from mobile), use the same host
  return `http://${window.location.hostname}:8000/api`;
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.detail || errorMessage;
      } catch {
        // If response body isn't JSON, try to get it as text
        try {
          const text = await response.text();
          if (text) errorMessage = text;
        } catch {
          // Ignore if we can't read the response
        }
      }
      throw new Error(errorMessage);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return undefined as T;
    }

    // Get the response text first
    const responseText = await response.text();

    // If response is empty, return undefined
    if (!responseText || responseText.trim() === '') {
      return undefined as T;
    }

    // Try to parse as JSON
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Failed to parse response as JSON. Response: ${responseText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error('API request failed:', {
      endpoint,
      method: options?.method || 'GET',
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface Surveyor {
  id: number;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export interface Species {
  id: number;
  name: string | null;
  scientific_name: string | null;
  conservation_status: string | null;
  type: string;
}

export interface Location {
  id: number;
  number: number;
  name: string;
  type: string;
}

/**
 * Species type count from API species_breakdown field
 * Used to display species-specific icons and counts in the UI
 */
export interface SpeciesTypeCount {
  type: string;  // "butterfly", "bird", or "fungi"
  count: number; // Number of sightings of this type
}

export interface Survey {
  id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  sun_percentage: number | null;
  temperature_celsius: string | null;
  conditions_met: boolean | null;
  notes: string | null;
  type: string; // DEPRECATED - use species_breakdown instead
  location_id: number;
  surveyor_ids: number[];
  sightings_count: number; // Total count across all species
  species_breakdown: SpeciesTypeCount[]; // Breakdown by species type
}

/**
 * Pagination metadata returned by paginated endpoints
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

/**
 * Query parameters for fetching surveys
 */
export interface SurveyQueryParams {
  page?: number;
  limit?: number;
  start_date?: string; // YYYY-MM-DD format
  end_date?: string; // YYYY-MM-DD format
}

export interface SurveyDetail extends Omit<Survey, 'sightings_count'> {
  surveyors?: Surveyor[];
}

export interface Sighting {
  id: number;
  survey_id: number;
  species_id: number;
  count: number;
  species_name?: string | null;
  species_scientific_name?: string | null;
}

/**
 * Dashboard data types
 */
export interface CumulativeSpeciesDataPoint {
  date: string; // ISO date string "YYYY-MM-DD"
  type: string; // Species type: "bird", "butterfly", etc.
  cumulative_count: number;
  new_species: string[]; // Names of species first seen on this date
}

export interface CumulativeSpeciesResponse {
  data: CumulativeSpeciesDataPoint[];
  date_range: {
    start: string;
    end: string;
  };
}

export interface SpeciesOccurrenceDataPoint {
  survey_date: string; // ISO date string "YYYY-MM-DD"
  survey_id: number;
  occurrence_count: number;
}

export interface SpeciesOccurrenceResponse {
  data: SpeciesOccurrenceDataPoint[];
  date_range: {
    start: string;
    end: string;
  };
  species_name: string;
}

export interface SpeciesWithCount {
  id: number;
  name: string | null;
  scientific_name: string | null;
  type: string;
  total_count: number;
}

// ============================================================================
// API Methods - Surveys
// ============================================================================

export const surveysAPI = {
  /**
   * Get surveys with pagination and optional filters
   */
  getAll: (params?: SurveyQueryParams): Promise<PaginatedResponse<Survey>> => {
    const queryParams = new URLSearchParams();

    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/surveys?${queryString}` : '/surveys';

    return fetchAPI(endpoint);
  },

  /**
   * Get a specific survey by ID
   */
  getById: (id: number): Promise<SurveyDetail> => {
    return fetchAPI(`/surveys/${id}`);
  },

  /**
   * Create a new survey
   */
  create: (survey: Partial<Survey>): Promise<Survey> => {
    return fetchAPI('/surveys', {
      method: 'POST',
      body: JSON.stringify(survey),
    });
  },

  /**
   * Update an existing survey
   */
  update: (id: number, survey: Partial<Survey>): Promise<Survey> => {
    return fetchAPI(`/surveys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(survey),
    });
  },

  /**
   * Delete a survey
   */
  delete: (id: number): Promise<void> => {
    return fetchAPI(`/surveys/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get sightings for a specific survey
   */
  getSightings: (surveyId: number): Promise<Sighting[]> => {
    return fetchAPI(`/surveys/${surveyId}/sightings`);
  },

  /**
   * Add a sighting to a survey
   */
  addSighting: (surveyId: number, sighting: Partial<Sighting>): Promise<Sighting> => {
    return fetchAPI(`/surveys/${surveyId}/sightings`, {
      method: 'POST',
      body: JSON.stringify(sighting),
    });
  },

  /**
   * Update a sighting in a survey
   */
  updateSighting: (surveyId: number, sightingId: number, sighting: Partial<Sighting>): Promise<Sighting> => {
    return fetchAPI(`/surveys/${surveyId}/sightings/${sightingId}`, {
      method: 'PUT',
      body: JSON.stringify(sighting),
    });
  },

  /**
   * Delete a sighting from a survey
   */
  deleteSighting: (surveyId: number, sightingId: number): Promise<void> => {
    return fetchAPI(`/surveys/${surveyId}/sightings/${sightingId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// API Methods - Surveyors
// ============================================================================

export const surveyorsAPI = {
  /**
   * Get all surveyors
   */
  getAll: (includeInactive: boolean = false): Promise<Surveyor[]> => {
    const query = includeInactive ? '?include_inactive=true' : '';
    return fetchAPI(`/surveyors${query}`);
  },

  /**
   * Get a specific surveyor by ID
   */
  getById: (id: number): Promise<Surveyor> => {
    return fetchAPI(`/surveyors/${id}`);
  },

  /**
   * Create a new surveyor
   */
  create: (surveyor: Partial<Surveyor>): Promise<Surveyor> => {
    return fetchAPI('/surveyors', {
      method: 'POST',
      body: JSON.stringify(surveyor),
    });
  },

  /**
   * Update an existing surveyor
   */
  update: (id: number, surveyor: Partial<Surveyor>): Promise<Surveyor> => {
    return fetchAPI(`/surveyors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(surveyor),
    });
  },

  /**
   * Delete a surveyor (hard delete - use deactivate instead)
   */
  delete: (id: number): Promise<void> => {
    return fetchAPI(`/surveyors/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Deactivate a surveyor (soft delete)
   */
  deactivate: (id: number): Promise<Surveyor> => {
    return fetchAPI(`/surveyors/${id}/deactivate`, {
      method: 'POST',
    });
  },

  /**
   * Reactivate a surveyor
   */
  reactivate: (id: number): Promise<Surveyor> => {
    return fetchAPI(`/surveyors/${id}/reactivate`, {
      method: 'POST',
    });
  },
};

// ============================================================================
// API Methods - Species
// ============================================================================

export const speciesAPI = {
  /**
   * Get all species
   */
  getAll: (surveyType?: string): Promise<Species[]> => {
    const query = surveyType ? `?survey_type=${surveyType}` : '';
    return fetchAPI(`/species${query}`);
  },

  /**
   * Get a specific species by ID
   */
  getById: (id: number): Promise<Species> => {
    return fetchAPI(`/species/${id}`);
  },

  /**
   * Create a new species
   */
  create: (species: Partial<Species>): Promise<Species> => {
    return fetchAPI('/species', {
      method: 'POST',
      body: JSON.stringify(species),
    });
  },

  /**
   * Update an existing species
   */
  update: (id: number, species: Partial<Species>): Promise<Species> => {
    return fetchAPI(`/species/${id}`, {
      method: 'PUT',
      body: JSON.stringify(species),
    });
  },

  /**
   * Delete a species
   */
  delete: (id: number): Promise<void> => {
    return fetchAPI(`/species/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// API Methods - Locations
// ============================================================================

export const locationsAPI = {
  /**
   * Get all locations
   */
  getAll: (surveyType?: string): Promise<Location[]> => {
    const query = surveyType ? `?survey_type=${surveyType}` : '';
    return fetchAPI(`/locations${query}`);
  },

  /**
   * Get a specific location by ID
   */
  getById: (id: number): Promise<Location> => {
    return fetchAPI(`/locations/${id}`);
  },

  /**
   * Create a new location
   */
  create: (location: Partial<Location>): Promise<Location> => {
    return fetchAPI('/locations', {
      method: 'POST',
      body: JSON.stringify(location),
    });
  },

  /**
   * Update an existing location
   */
  update: (id: number, location: Partial<Location>): Promise<Location> => {
    return fetchAPI(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(location),
    });
  },

  /**
   * Delete a location
   */
  delete: (id: number): Promise<void> => {
    return fetchAPI(`/locations/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// API Methods - Dashboard
// ============================================================================

export const dashboardAPI = {
  /**
   * Get cumulative species counts over time for dashboard chart
   */
  getCumulativeSpecies: (speciesTypes?: string[]): Promise<CumulativeSpeciesResponse> => {
    const params = new URLSearchParams();
    if (speciesTypes && speciesTypes.length > 0) {
      speciesTypes.forEach(type => params.append('species_types', type));
    }
    const query = params.toString();
    return fetchAPI(query ? `/dashboard/cumulative-species?${query}` : '/dashboard/cumulative-species');
  },

  /**
   * Get species ordered by occurrence count
   */
  getSpeciesByCount: (speciesType: string): Promise<SpeciesWithCount[]> => {
    return fetchAPI(`/dashboard/species-by-count?species_type=${speciesType}`);
  },

  /**
   * Get weekly occurrence counts for a specific species
   */
  getSpeciesOccurrences: (speciesId: number, startDate?: string, endDate?: string): Promise<SpeciesOccurrenceResponse> => {
    const params = new URLSearchParams();
    params.append('species_id', speciesId.toString());
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return fetchAPI(`/dashboard/species-occurrences?${params.toString()}`);
  },
};

// ============================================================================
// Health Check
// ============================================================================

export const healthAPI = {
  /**
   * Check if API is healthy
   */
  check: (): Promise<{ status: string; version: string }> => {
    return fetchAPI('/health');
  },
};
