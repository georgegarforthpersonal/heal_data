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
  SpiderIcon,
  BatIcon,
  MammalIcon,
  ReptileIcon,
  AmphibianIcon,
  MothIcon,
  BugIcon,
  LeafIcon,
  BeeIcon,
  BeetleIcon,
  FlyIcon,
  GrasshopperIcon,
  DragonflyIcon,
  EarwigIcon,
  WoodlouseIcon,
  MiteIcon,
} from '../components/icons/WildlifeIcons';

// Type for icon components
type IconComponent = (props: SvgIconProps) => JSX.Element;

// Configuration for each species type
interface SpeciesTypeConfig {
  icon: IconComponent;
  singular: string;
  plural: string;
}

// Central configuration map
const speciesTypeConfig: Record<string, SpeciesTypeConfig> = {
  butterfly: { icon: ButterflyIcon, singular: 'Butterfly', plural: 'Butterflies' },
  bird: { icon: BirdIcon, singular: 'Bird', plural: 'Birds' },
  moth: { icon: MothIcon, singular: 'Moth', plural: 'Moths' },
  beetle: { icon: BeetleIcon, singular: 'Beetle', plural: 'Beetles' },
  fly: { icon: FlyIcon, singular: 'Fly', plural: 'Flies' },
  'bee-wasp-ant': { icon: BeeIcon, singular: 'Bee, Wasp or Ant', plural: 'Bees, Wasps & Ants' },
  bug: { icon: BugIcon, singular: 'Bug', plural: 'Bugs' },
  'dragonfly-damselfly': { icon: DragonflyIcon, singular: 'Dragonfly or Damselfly', plural: 'Dragonflies & Damselflies' },
  'grasshopper-cricket': { icon: GrasshopperIcon, singular: 'Grasshopper or Cricket', plural: 'Grasshoppers & Crickets' },
  insect: { icon: EarwigIcon, singular: 'Other Insect', plural: 'Other Insects' },
  gall: { icon: LeafIcon, singular: 'Gall', plural: 'Galls' },
  spider: { icon: SpiderIcon, singular: 'Spider', plural: 'Spiders' },
  bat: { icon: BatIcon, singular: 'Bat', plural: 'Bats' },
  mammal: { icon: MammalIcon, singular: 'Mammal', plural: 'Mammals' },
  reptile: { icon: ReptileIcon, singular: 'Reptile', plural: 'Reptiles' },
  amphibian: { icon: AmphibianIcon, singular: 'Amphibian', plural: 'Amphibians' },
  fungus: { icon: MushroomIcon, singular: 'Fungus', plural: 'Fungi' },
  woodlouse: { icon: WoodlouseIcon, singular: 'Woodlouse', plural: 'Woodlice' },
  mite: { icon: MiteIcon, singular: 'Mite', plural: 'Mites' },
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
