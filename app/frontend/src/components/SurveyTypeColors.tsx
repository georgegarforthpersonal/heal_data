/**
 * Survey Type Colors - Color selector and chip components for survey types
 *
 * Uses Notion-style color palette from theme.ts for a clean, consistent look.
 * The color key is stored in the database and mapped to styles here.
 */

import { Box, Chip, MenuItem, Select, FormControl, InputLabel, FormHelperText, Stack, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { notionColors } from '../theme';

/**
 * Available color options matching the notionColors palette
 */
export type NotionColorKey = keyof typeof notionColors;

export const surveyTypeColorOptions: { id: NotionColorKey; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'gray', label: 'Gray' },
  { id: 'brown', label: 'Brown' },
  { id: 'orange', label: 'Orange' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'green', label: 'Green' },
  { id: 'blue', label: 'Blue' },
  { id: 'purple', label: 'Purple' },
  { id: 'pink', label: 'Pink' },
  { id: 'red', label: 'Red' },
];

/**
 * Get the color styles for a survey type color key
 */
export function getSurveyTypeColorStyles(colorKey: string | null | undefined): { background: string; text: string } {
  if (!colorKey || !(colorKey in notionColors)) {
    return notionColors.default;
  }
  return notionColors[colorKey as NotionColorKey];
}

/**
 * Props for SurveyTypeChip component
 */
interface SurveyTypeChipProps {
  name: string;
  color: string | null | undefined;
  size?: 'small' | 'medium';
}

/**
 * Display component for survey type as a colored chip
 */
export function SurveyTypeChip({ name, color, size = 'small' }: SurveyTypeChipProps) {
  const colorStyles = getSurveyTypeColorStyles(color);

  return (
    <Chip
      label={name}
      size={size}
      sx={{
        backgroundColor: colorStyles.background,
        color: colorStyles.text,
        fontWeight: 500,
        fontSize: size === 'small' ? '0.8125rem' : '0.875rem',
        height: size === 'small' ? 24 : 28,
        '& .MuiChip-label': {
          px: 1.5,
        },
      }}
    />
  );
}

/**
 * Props for SurveyTypeColorSelector component
 */
interface SurveyTypeColorSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: boolean;
  helperText?: string;
}

/**
 * Selector component for choosing a survey type color
 */
export function SurveyTypeColorSelector({
  value,
  onChange,
  error,
  helperText,
}: SurveyTypeColorSelectorProps) {
  const handleChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value;
    onChange(newValue || null);
  };

  return (
    <FormControl fullWidth error={error} size="small">
      <InputLabel id="color-select-label">Color</InputLabel>
      <Select
        labelId="color-select-label"
        value={value || ''}
        onChange={handleChange}
        label="Color"
        renderValue={(selected) => {
          const colorStyles = getSurveyTypeColorStyles(selected);
          const option = surveyTypeColorOptions.find((opt) => opt.id === selected);
          return (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '4px',
                  backgroundColor: colorStyles.background,
                  border: `1px solid ${colorStyles.text}`,
                }}
              />
              <Typography variant="body2">{option?.label || 'Default'}</Typography>
            </Stack>
          );
        }}
      >
        {surveyTypeColorOptions.map((option) => {
          const colorStyles = notionColors[option.id];
          return (
            <MenuItem key={option.id} value={option.id}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '4px',
                    backgroundColor: colorStyles.background,
                    border: `1px solid ${colorStyles.text}`,
                  }}
                />
                <Typography variant="body2">{option.label}</Typography>
              </Stack>
            </MenuItem>
          );
        })}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}
