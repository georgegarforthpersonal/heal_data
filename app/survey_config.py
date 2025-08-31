"""
Survey field configuration for different survey types.
Defines which fields should be displayed and their validation rules.
"""

from typing import Dict, List, Any

SURVEY_FIELDS = {
    "butterfly": {
        "fields": [
            "date",
            "surveyors", 
            "start_time",
            "end_time",
            "sun_percentage",
            "temperature",
            "conditions_met"
        ],
        "required": ["date", "surveyors"],
        "field_config": {
            "date": {
                "label": "Survey Date",
                "type": "date",
                "default_factory": "today"
            },
            "surveyors": {
                "label": "Surveyors", 
                "type": "multiselect",
                "help": "Select the surveyors who conducted this butterfly survey"
            },
            "start_time": {
                "label": "Start Time",
                "type": "time",
                "default": "09:00"
            },
            "end_time": {
                "label": "End Time", 
                "type": "time",
                "default": "10:00"
            },
            "sun_percentage": {
                "label": "Sun Percentage (%)",
                "type": "slider",
                "min": 0,
                "max": 100,
                "default": 50,
                "help": "Percentage of sunshine during the survey"
            },
            "temperature": {
                "label": "Temperature (°C)",
                "type": "number",
                "min": -50.0,
                "max": 60.0,
                "default": 20.0,
                "step": 0.1
            },
            "conditions_met": {
                "label": "Survey Conditions Met",
                "type": "checkbox",
                "default": False,
                "help": "Were the standard butterfly survey conditions met?"
            }
        }
    },
    "bird": {
        "fields": [
            "date",
            "surveyors",
            "notes"
        ],
        "required": ["date", "surveyors"],
        "field_config": {
            "date": {
                "label": "Survey Date",
                "type": "date", 
                "default_factory": "today"
            },
            "surveyors": {
                "label": "Surveyors",
                "type": "multiselect",
                "help": "Select the surveyors who conducted this bird survey"
            },
            "notes": {
                "label": "Notes",
                "type": "text_area",
                "help": "Additional notes about the bird survey",
                "placeholder": "Weather conditions, observations, etc."
            }
        }
    }
}

def get_survey_fields(survey_type: str) -> List[str]:
    """Get the list of fields for a given survey type."""
    return SURVEY_FIELDS.get(survey_type, {}).get("fields", [])

def get_required_fields(survey_type: str) -> List[str]:
    """Get the list of required fields for a given survey type.""" 
    return SURVEY_FIELDS.get(survey_type, {}).get("required", [])

def get_field_config(survey_type: str, field_name: str) -> Dict[str, Any]:
    """Get the configuration for a specific field in a survey type."""
    return SURVEY_FIELDS.get(survey_type, {}).get("field_config", {}).get(field_name, {})

def is_field_required(survey_type: str, field_name: str) -> bool:
    """Check if a field is required for a given survey type."""
    return field_name in get_required_fields(survey_type)

def get_supported_survey_types() -> List[str]:
    """Get the list of supported survey types."""
    return list(SURVEY_FIELDS.keys())