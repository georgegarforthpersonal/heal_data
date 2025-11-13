/**
 * API Client Service
 *
 * Centralized API client for all backend communication.
 * Following DEVELOPMENT.md conventions:
 * - Built inline first (no premature abstraction)
 * - Simple fetch-based implementation
 * - Ready to be enhanced with React Query later
 */

// API base URL - defaults to localhost for development
const API_BASE_URL = 'http://localhost:8000/api';

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
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('API request failed:', error);
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
}

export interface Species {
  id: number;
  name: string;
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

export interface SurveyDetail extends Omit<Survey, 'sightings_count'> {
  surveyors?: Surveyor[];
}

export interface Sighting {
  id: number;
  survey_id: number;
  species_id: number;
  count: number;
  species_name?: string;
}

// ============================================================================
// API Methods - Surveys
// ============================================================================

export const surveysAPI = {
  /**
   * Get all surveys with sighting counts
   */
  getAll: (): Promise<Survey[]> => {
    return fetchAPI('/surveys');
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
};

// ============================================================================
// API Methods - Surveyors
// ============================================================================

export const surveyorsAPI = {
  /**
   * Get all surveyors
   */
  getAll: (): Promise<Surveyor[]> => {
    return fetchAPI('/surveyors');
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
   * Delete a surveyor
   */
  delete: (id: number): Promise<void> => {
    return fetchAPI(`/surveyors/${id}`, {
      method: 'DELETE',
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
