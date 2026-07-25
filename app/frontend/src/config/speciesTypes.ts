/**
 * Species Type Configuration
 *
 * Central source of truth for species type metadata including:
 * - Icon components
 * - Display names
 * - Type identifiers
 */

import type { JSX } from 'react';
import type { SvgIconProps } from '@mui/material';
import {
  ButterflyIcon,
  BirdIcon,
  MushroomIcon,
  BatIcon,
  MammalIcon,
  ReptileIcon,
  AmphibianIcon,
  MothIcon,
  LeafIcon,
  BeeIcon,
  DragonflyIcon,
  EarwigIcon,
} from '../components/icons/WildlifeIcons';

// Type for icon components
type IconComponent = (props: SvgIconProps) => JSX.Element;

// Configuration for each species type
interface SpeciesTypeConfig {
  icon: IconComponent;
  singular: string;
  plural: string;
}

// Central configuration map. Keyed by the twelve species-type slugs that
// survive the July 2026 taxonomy collapse (see
// docs/species-type-refactor-plan.md), in the group display order. The 'insect'
// slug is the "Other invertebrates" catch-all — it holds arachnids and
// crustaceans too, not only insects — and EarwigIcon doubles as the
// unknown-type fallback. Order here drives speciesTypes (below).
const speciesTypeConfig: Record<string, SpeciesTypeConfig> = {
  butterfly: { icon: ButterflyIcon, singular: 'Butterfly', plural: 'Butterflies' },
  moth: { icon: MothIcon, singular: 'Moth', plural: 'Moths' },
  bee: { icon: BeeIcon, singular: 'Bee', plural: 'Bees' },
  'dragonfly-damselfly': { icon: DragonflyIcon, singular: 'Dragonfly', plural: 'Dragonflies' },
  insect: { icon: EarwigIcon, singular: 'Other Invertebrate', plural: 'Other Invertebrates' },
  mammal: { icon: MammalIcon, singular: 'Mammal', plural: 'Mammals' },
  bat: { icon: BatIcon, singular: 'Bat', plural: 'Bats' },
  bird: { icon: BirdIcon, singular: 'Bird', plural: 'Birds' },
  reptile: { icon: ReptileIcon, singular: 'Reptile', plural: 'Reptiles' },
  amphibian: { icon: AmphibianIcon, singular: 'Amphibian', plural: 'Amphibians' },
  fungus: { icon: MushroomIcon, singular: 'Fungus', plural: 'Fungi' },
  plant: { icon: LeafIcon, singular: 'Plant', plural: 'Plants' },
};

// Default icon for unknown types
const defaultIcon = EarwigIcon;

/**
 * Get the icon component for a species type
 */
export function getSpeciesIcon(type: string): IconComponent {
  return speciesTypeConfig[type]?.icon ?? defaultIcon;
}

/**
 * Get the plural display name for a species type
 */
export function getSpeciesDisplayName(type: string): string {
  return speciesTypeConfig[type]?.plural ?? type.charAt(0).toUpperCase() + type.slice(1) + 's';
}

/**
 * Format species type with count (e.g., "1 Bird" or "5 Birds")
 */
export function formatSpeciesCount(type: string, count: number): string {
  const config = speciesTypeConfig[type];
  if (config) {
    return `${count} ${count === 1 ? config.singular : config.plural}`;
  }
  // Fallback for unknown types
  const capitalized = type.charAt(0).toUpperCase() + type.slice(1);
  return `${count} ${count === 1 ? capitalized : capitalized + 's'}`;
}

/**
 * List of all known species types (in display order)
 */
export const speciesTypes = Object.keys(speciesTypeConfig);

/**
 * Get full config for a species type
 */
export function getSpeciesTypeConfig(type: string): SpeciesTypeConfig | undefined {
  return speciesTypeConfig[type];
}
