/**
 * Surveyor multi-select: type-to-search Autocomplete with deletable chips for
 * the chosen surveyors. The one shared picker — used by the Groups surveyor
 * picker, the survey form (SurveyFormFields) and the wizard SetupStep.
 *
 * Every option row carries a checkbox. Options stay in the list after
 * selection (the dropdown stays open for multi-pick), so without a checkbox
 * the only cue that a name is already selected is a faint grey highlight —
 * and tapping it again silently REMOVES it. Surveyors in the field were
 * "adding" a name that was already on the survey and losing it. The checkbox
 * makes selected state unmistakable and a second tap read as a deliberate
 * untick. Options are keyed by id, not label: duplicate surveyor rows can
 * share a display name.
 */
import { Autocomplete, TextField, Chip, Checkbox } from '@mui/material';
import { CheckBox, CheckBoxOutlineBlank } from '@mui/icons-material';
import type { Surveyor } from '../../services/api';

const surveyorLabel = (s: Surveyor) =>
  s.last_name ? `${s.first_name} ${s.last_name}` : s.first_name;

interface SurveyorMultiSelectProps {
  options: Surveyor[];
  value: Surveyor[];
  onChange: (surveyors: Surveyor[]) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  autoFocus?: boolean;
}

export default function SurveyorMultiSelect({
  options,
  value,
  onChange,
  label = 'Surveyors',
  required = false,
  disabled = false,
  error = false,
  helperText,
  autoFocus = false,
}: SurveyorMultiSelectProps) {
  return (
    <Autocomplete
      multiple
      options={options}
      value={value}
      onChange={(_, next) => onChange(next)}
      disabled={disabled}
      getOptionLabel={surveyorLabel}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      disableCloseOnSelect
      renderInput={(params) => (
        <TextField
          {...params}
          label={required ? `${label} *` : label}
          error={error}
          helperText={helperText}
          autoFocus={autoFocus}
          sx={{ '& .MuiInputBase-input': { fontSize: { xs: '16px', sm: '1rem' } } }}
        />
      )}
      renderOption={(props, option, { selected }) => {
        const { key: _key, ...optionProps } = props as { key?: React.Key } &
          React.HTMLAttributes<HTMLLIElement>;
        return (
          <li key={option.id} {...optionProps}>
            <Checkbox
              icon={<CheckBoxOutlineBlank fontSize="small" />}
              checkedIcon={<CheckBox fontSize="small" />}
              checked={selected}
              sx={{ mr: 1, p: 0.25 }}
            />
            {surveyorLabel(option)}
          </li>
        );
      }}
      renderTags={(tags, getTagProps) =>
        tags.map((option, index) => (
          <Chip label={surveyorLabel(option)} size="small" {...getTagProps({ index })} key={option.id} />
        ))
      }
    />
  );
}
