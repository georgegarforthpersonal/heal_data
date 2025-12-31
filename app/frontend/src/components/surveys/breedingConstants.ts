/**
 * Shared constants for breeding status codes (BTO breeding evidence codes)
 */
import type { BreedingCategory } from '../../services/api';

// Category display labels
export const CATEGORY_LABELS: Record<BreedingCategory, string> = {
  'non_breeding': 'Non-Breeding',
  'possible_breeder': 'Possible Breeder',
  'probable_breeder': 'Probable Breeder',
  'confirmed_breeder': 'Confirmed Breeder',
};

// Category colors for visual distinction
export const CATEGORY_COLORS: Record<BreedingCategory, string> = {
  'non_breeding': '#2196F3',      // Blue
  'possible_breeder': '#FFC107',   // Amber
  'probable_breeder': '#FF9800',   // Orange
  'confirmed_breeder': '#4CAF50',  // Green
};
