/**
 * Survey Type Icons - Lucide icon mapping and selector for survey types
 *
 * Uses Lucide icons (https://lucide.dev) for a clean, consistent look.
 * The icon identifier is stored in the database and mapped to components here.
 */

import { Box, Autocomplete, TextField, Stack, Typography } from '@mui/material';
import {
  Binoculars,
  ClipboardList,
  Bird,
  Bug,
  TreeDeciduous,
  Leaf,
  MapPin,
  Calendar,
  Users,
  Search,
  Eye,
  FileText,
  Compass,
  Mountain,
  Flower2,
  Squirrel,
  Fish,
  Footprints,
  Camera,
  Notebook,
  type LucideIcon,
} from 'lucide-react';

/**
 * Available survey type icons
 * Key is the identifier stored in the database
 */
export const surveyTypeIconMap: Record<string, LucideIcon> = {
  'binoculars': Binoculars,
  'clipboard-list': ClipboardList,
  'bird': Bird,
  'bug': Bug,
  'tree': TreeDeciduous,
  'leaf': Leaf,
  'map-pin': MapPin,
  'calendar': Calendar,
  'users': Users,
  'search': Search,
  'eye': Eye,
  'file-text': FileText,
  'compass': Compass,
  'mountain': Mountain,
  'flower': Flower2,
  'squirrel': Squirrel,
  'fish': Fish,
  'footprints': Footprints,
  'camera': Camera,
  'notebook': Notebook,
};

/**
 * Icon options for the selector dropdown
 */
export const surveyTypeIconOptions = Object.keys(surveyTypeIconMap).map((key) => ({
  id: key,
  label: key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
}));

/**
 * Get the icon component for a survey type icon identifier
 */
export function getSurveyTypeIcon(iconId: string | null | undefined): LucideIcon | null {
  if (!iconId) return null;
  return surveyTypeIconMap[iconId] || null;
}

/**
 * Props for SurveyTypeIcon component
 */
interface SurveyTypeIconProps {
  icon: string | null | undefined;
  size?: number;
  className?: string;
  color?: string;
}

/**
 * Display component for survey type icons
 */
export function SurveyTypeIcon({ icon, size = 20, className, color }: SurveyTypeIconProps) {
  const IconComponent = getSurveyTypeIcon(icon);
  if (!IconComponent) return null;
  return <IconComponent size={size} className={className} color={color} />;
}

/**
 * Props for SurveyTypeIconSelector component
 */
interface SurveyTypeIconSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: boolean;
  helperText?: string;
}

/**
 * Selector component for choosing a survey type icon
 */
export function SurveyTypeIconSelector({
  value,
  onChange,
  error,
  helperText,
}: SurveyTypeIconSelectorProps) {
  const selectedOption = surveyTypeIconOptions.find((opt) => opt.id === value) || null;

  return (
    <Autocomplete
      options={surveyTypeIconOptions}
      getOptionLabel={(option) => option.label}
      value={selectedOption}
      onChange={(_, newValue) => onChange(newValue?.id || null)}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      renderOption={(props, option) => {
        const IconComponent = surveyTypeIconMap[option.id];
        return (
          <li {...props}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 1,
                  bgcolor: 'grey.100',
                }}
              >
                <IconComponent size={18} />
              </Box>
              <Typography variant="body2">{option.label}</Typography>
            </Stack>
          </li>
        );
      }}
      renderInput={(params) => {
        const IconComponent = value ? surveyTypeIconMap[value] : null;
        return (
          <TextField
            {...params}
            label="Icon"
            error={error}
            helperText={helperText}
            InputProps={{
              ...params.InputProps,
              startAdornment: IconComponent ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: 'grey.100',
                    mr: 1,
                  }}
                >
                  <IconComponent size={18} />
                </Box>
              ) : null,
            }}
          />
        );
      }}
    />
  );
}
