import streamlit as st
import psycopg2
from datetime import date, time, datetime
from decimal import Decimal
from typing import List, Optional, Tuple

from database.connection import get_db_cursor
from database.models import Survey, Surveyor

def get_all_surveyors() -> List[Tuple[int, str]]:
    """Get all surveyors for dropdown selection"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT id, 
                CASE 
                    WHEN last_name IS NULL OR trim(last_name) = '' 
                    THEN trim(first_name)
                    ELSE trim(first_name) || ' ' || trim(last_name)
                END as full_name 
                FROM surveyor 
                ORDER BY first_name, last_name
            """)
            return cursor.fetchall()
    except Exception as e:
        st.error(f"Error fetching surveyors: {e}")
        return []

def get_all_surveys() -> List[Tuple]:
    """Get all surveys with surveyor names"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT s.id, s.date, s.start_time, s.end_time, s.sun_percentage, 
                       s.temperature_celsius, s.conditions_met, s.surveyor_id,
                       COALESCE(
                           CASE 
                               WHEN sv.last_name IS NULL OR trim(sv.last_name) = '' 
                               THEN trim(sv.first_name)
                               ELSE trim(sv.first_name) || ' ' || trim(sv.last_name)
                           END, 
                           'No surveyor'
                       ) as surveyor_name
                FROM survey s
                LEFT JOIN surveyor sv ON s.surveyor_id = sv.id
                ORDER BY s.date DESC, s.start_time DESC
            """)
            return cursor.fetchall()
    except Exception as e:
        st.error(f"Error fetching surveys: {e}")
        return []

def create_survey(survey: Survey) -> bool:
    """Create a new survey"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                INSERT INTO survey (date, start_time, end_time, sun_percentage, temperature_celsius, conditions_met, surveyor_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                survey.date,
                survey.start_time,
                survey.end_time,
                survey.sun_percentage,
                survey.temperature_celsius,
                survey.conditions_met,
                survey.surveyor_id
            ))
            return True
    except Exception as e:
        st.error(f"Error creating survey: {e}")
        return False

def update_survey(survey: Survey) -> bool:
    """Update an existing survey"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                UPDATE survey 
                SET date = %s, start_time = %s, end_time = %s, sun_percentage = %s, 
                    temperature_celsius = %s, conditions_met = %s, surveyor_id = %s
                WHERE id = %s
            """, (
                survey.date,
                survey.start_time,
                survey.end_time,
                survey.sun_percentage,
                survey.temperature_celsius,
                survey.conditions_met,
                survey.surveyor_id,
                survey.id
            ))
            return True
    except Exception as e:
        st.error(f"Error updating survey: {e}")
        return False

def delete_survey(survey_id: int) -> bool:
    """Delete a survey"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM survey WHERE id = %s", (survey_id,))
            return True
    except Exception as e:
        st.error(f"Error deleting survey: {e}")
        return False

def get_survey_by_id(survey_id: int) -> Optional[Survey]:
    """Get a specific survey by ID"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT id, date, start_time, end_time, sun_percentage, temperature_celsius, conditions_met, surveyor_id
                FROM survey WHERE id = %s
            """, (survey_id,))
            row = cursor.fetchone()
            if row:
                return Survey(
                    id=row[0],
                    date=row[1],
                    start_time=row[2],
                    end_time=row[3],
                    sun_percentage=row[4],
                    temperature_celsius=row[5],
                    conditions_met=row[6],
                    surveyor_id=row[7]
                )
            return None
    except Exception as e:
        st.error(f"Error fetching survey: {e}")
        return None

def survey_form(survey: Optional[Survey] = None, key_prefix: str = ""):
    """Render survey form for create/update operations"""
    surveyors = get_all_surveyors()
    surveyor_options = {f"{name} (ID: {id})": id for id, name in surveyors}
    surveyor_options["No surveyor"] = None
    
    # Form fields
    survey_date = st.date_input(
        "Survey Date", 
        value=survey.date if survey and survey.date else date.today(),
        key=f"{key_prefix}_date"
    )
    
    col1, col2 = st.columns(2)
    with col1:
        start_time = st.time_input(
            "Start Time",
            value=survey.start_time if survey and survey.start_time else time(9, 0),
            key=f"{key_prefix}_start_time"
        )
    with col2:
        end_time = st.time_input(
            "End Time",
            value=survey.end_time if survey and survey.end_time else time(10, 0),
            key=f"{key_prefix}_end_time"
        )
    
    sun_percentage = st.slider(
        "Sun Percentage (%)",
        min_value=0,
        max_value=100,
        value=survey.sun_percentage if survey and survey.sun_percentage is not None else 50,
        key=f"{key_prefix}_sun"
    )
    
    temperature = st.number_input(
        "Temperature (°C)",
        min_value=-50.0,
        max_value=60.0,
        value=float(survey.temperature_celsius) if survey and survey.temperature_celsius else 20.0,
        step=0.1,
        key=f"{key_prefix}_temp"
    )
    
    conditions_met = st.checkbox(
        "Survey Conditions Met",
        value=survey.conditions_met if survey else False,
        key=f"{key_prefix}_conditions"
    )
    
    # Surveyor selection
    current_surveyor_key = None
    if survey and survey.surveyor_id:
        for key, value in surveyor_options.items():
            if value == survey.surveyor_id:
                current_surveyor_key = key
                break
    
    selected_surveyor_key = st.selectbox(
        "Surveyor",
        options=list(surveyor_options.keys()),
        index=list(surveyor_options.keys()).index(current_surveyor_key) if current_surveyor_key else 0,
        key=f"{key_prefix}_surveyor"
    )
    
    selected_surveyor_id = surveyor_options[selected_surveyor_key]
    
    return Survey(
        id=survey.id if survey else None,
        date=survey_date,
        start_time=start_time,
        end_time=end_time,
        sun_percentage=sun_percentage,
        temperature_celsius=Decimal(str(temperature)),
        conditions_met=conditions_met,
        surveyor_id=selected_surveyor_id
    )

def main():
    st.set_page_config(page_title="Butterfly Survey Management", layout="wide")
    st.title("🦋 Butterfly Survey Management")
    
    # Surveyor instructions
    with st.expander("📋 Surveyor Instructions"):
        st.markdown("""
        🌡️ Minimum 13°C required - do not record surveys below this temperature
        
        ☀️ 13-17°C needs at least 60% sunshine throughout the survey period
        
        🌤️ 17°C+ can proceed without sunshine
        
        💨 Moderate winds only (Beaufort scale 5 or less), unless the route is sheltered
        
        🌧️ No surveys during rain
        
        ⚠️ Check conditions before starting to ensure requirements will be met throughout the survey
        """)
    
    # Initialize session state for editing
    if "editing_survey_id" not in st.session_state:
        st.session_state.editing_survey_id = None
    if "show_create_form" not in st.session_state:
        st.session_state.show_create_form = False
    if "delete_confirm_id" not in st.session_state:
        st.session_state.delete_confirm_id = None
    
    # Create new survey section
    if st.button("➕ Add New Survey"):
        st.session_state.show_create_form = not st.session_state.show_create_form
        st.session_state.editing_survey_id = None
    
    # Display all surveys
    surveys = get_all_surveys()
    
    if surveys:
        # Column headers in new order: Date, Surveyor, Start, End, Sun, Temp, Actions
        header_col1, header_col2, header_col3, header_col4, header_col5, header_col6, header_col7 = st.columns([1.5, 1.5, 1, 1, 1, 1, 1])
        
        with header_col1:
            st.write("**Date**")
        with header_col2:
            st.write("**Surveyor**")
        with header_col3:
            st.write("**Start Time**")
        with header_col4:
            st.write("**End Time**")
        with header_col5:
            st.write("**Sun %**")
        with header_col6:
            st.write("**Temp °C**")
        with header_col7:
            st.write("**Actions**")
        
        st.divider()
        
        # Add new survey row if creating - new order: Date, Surveyor, Start, End, Sun, Temp, Actions
        if st.session_state.show_create_form:
            col1, col2, col3, col4, col5, col6, col7 = st.columns([1.5, 1.5, 1, 1, 1, 1, 1])
            
            with col1:
                create_date = st.date_input(
                    "",
                    value=date.today(),
                    key="create_date",
                    label_visibility="collapsed"
                )
            
            with col2:
                surveyors = get_all_surveyors()
                create_surveyor_options = {f"{name}": surveyor_id for surveyor_id, name in surveyors}
                create_surveyor_options["No surveyor"] = None
                
                create_surveyor_name = st.selectbox(
                    "",
                    options=list(create_surveyor_options.keys()),
                    key="create_surveyor",
                    label_visibility="collapsed"
                )
                create_surveyor_id = create_surveyor_options[create_surveyor_name]
            
            with col3:
                create_start_time = st.time_input(
                    "",
                    value=time(9, 0),
                    key="create_start_time",
                    label_visibility="collapsed"
                )
            
            with col4:
                create_end_time = st.time_input(
                    "",
                    value=time(10, 0),
                    key="create_end_time",
                    label_visibility="collapsed"
                )
            
            with col5:
                create_sun = st.number_input(
                    "",
                    min_value=0,
                    max_value=100,
                    value=50,
                    key="create_sun",
                    label_visibility="collapsed"
                )
            
            with col6:
                create_temp = st.number_input(
                    "",
                    min_value=-50.0,
                    max_value=60.0,
                    value=20.0,
                    step=0.1,
                    key="create_temp",
                    label_visibility="collapsed"
                )
            
            with col7:
                save_col, cancel_col = st.columns([1, 1])
                with save_col:
                    if st.button("💾", key="create_save", help="Save new survey"):
                        # Create new survey object
                        new_survey = Survey(
                            date=create_date,
                            start_time=create_start_time,
                            end_time=create_end_time,
                            sun_percentage=create_sun,
                            temperature_celsius=Decimal(str(create_temp)),
                            conditions_met=False,  # Default value
                            surveyor_id=create_surveyor_id
                        )
                        
                        if create_start_time >= create_end_time:
                            st.error("Start time must be before end time.")
                        else:
                            if create_survey(new_survey):
                                st.success("Survey created!")
                                st.session_state.show_create_form = False
                                st.rerun()
                with cancel_col:
                    if st.button("❌", key="create_cancel", help="Cancel"):
                        st.session_state.show_create_form = False
                        st.rerun()
            
            st.divider()
        
        for survey in surveys:
            # Check if this survey is being edited
            is_editing = st.session_state.editing_survey_id == survey[0]
            
            # Get survey details for editing
            survey_details = get_survey_by_id(survey[0]) if is_editing else None
            
            col1, col2, col3, col4, col5, col6, col7 = st.columns([1.5, 1.5, 1, 1, 1, 1, 1])
            
            with col1:
                if is_editing and survey_details:
                    new_date = st.date_input(
                        "",
                        value=survey_details.date,
                        key=f"edit_date_{survey[0]}",
                        label_visibility="collapsed"
                    )
                else:
                    st.write(f"{survey[1]}")
            
            with col2:
                if is_editing and survey_details:
                    surveyors = get_all_surveyors()
                    surveyor_options = {f"{name}": surveyor_id for surveyor_id, name in surveyors}
                    surveyor_options["No surveyor"] = None
                    
                    # Find current surveyor name
                    current_surveyor = "No surveyor"
                    for name, surveyor_id in surveyor_options.items():
                        if surveyor_id == survey_details.surveyor_id:
                            current_surveyor = name
                            break
                    
                    new_surveyor_name = st.selectbox(
                        "",
                        options=list(surveyor_options.keys()),
                        index=list(surveyor_options.keys()).index(current_surveyor),
                        key=f"edit_surveyor_{survey[0]}",
                        label_visibility="collapsed"
                    )
                    new_surveyor_id = surveyor_options[new_surveyor_name]
                else:
                    st.write(f"{survey[8]}")
            
            with col3:
                if is_editing and survey_details:
                    new_start_time = st.time_input(
                        "",
                        value=survey_details.start_time,
                        key=f"edit_start_{survey[0]}",
                        label_visibility="collapsed"
                    )
                else:
                    st.write(f"{survey[2].strftime('%H:%M')}")
            
            with col4:
                if is_editing and survey_details:
                    new_end_time = st.time_input(
                        "",
                        value=survey_details.end_time,
                        key=f"edit_end_{survey[0]}",
                        label_visibility="collapsed"
                    )
                else:
                    st.write(f"{survey[3].strftime('%H:%M')}")
            
            with col5:
                if is_editing and survey_details:
                    new_sun = st.number_input(
                        "",
                        min_value=0,
                        max_value=100,
                        value=survey_details.sun_percentage,
                        key=f"edit_sun_{survey[0]}",
                        label_visibility="collapsed"
                    )
                else:
                    st.write(f"{survey[4]}%")
            
            with col6:
                if is_editing and survey_details:
                    new_temp = st.number_input(
                        "",
                        min_value=-50.0,
                        max_value=60.0,
                        value=float(survey_details.temperature_celsius),
                        step=0.1,
                        key=f"edit_temp_{survey[0]}",
                        label_visibility="collapsed"
                    )
                else:
                    st.write(f"{float(survey[5]):.1f}°C")
            
            with col7:
                if is_editing:
                    # Save and Cancel buttons
                    save_col, cancel_col = st.columns([1, 1])
                    with save_col:
                        if st.button("💾", key=f"save_{survey[0]}", help="Save changes"):
                            # Create updated survey object
                            updated_survey = Survey(
                                id=survey[0],
                                date=new_date,
                                start_time=new_start_time,
                                end_time=new_end_time,
                                sun_percentage=new_sun,
                                temperature_celsius=Decimal(str(new_temp)),
                                conditions_met=survey_details.conditions_met,  # Keep existing value
                                surveyor_id=new_surveyor_id
                            )
                            
                            if new_start_time >= new_end_time:
                                st.error("Start time must be before end time.")
                            else:
                                if update_survey(updated_survey):
                                    st.success("Survey updated!")
                                    st.session_state.editing_survey_id = None
                                    st.rerun()
                    with cancel_col:
                        if st.button("❌", key=f"cancel_{survey[0]}", help="Cancel edit"):
                            st.session_state.editing_survey_id = None
                            st.rerun()
                else:
                    # Edit and Delete buttons
                    edit_col, delete_col = st.columns([1, 1])
                    with edit_col:
                        if st.button("✏️", key=f"edit_{survey[0]}", help="Edit survey"):
                            st.session_state.editing_survey_id = survey[0]
                            st.session_state.show_create_form = False
                            st.rerun()
                    with delete_col:
                        if st.button("🗑️", key=f"delete_{survey[0]}", help="Delete survey"):
                            st.session_state.delete_confirm_id = survey[0]
                            st.rerun()
        
    # Show delete confirmation popup if needed
    if st.session_state.delete_confirm_id is not None:
        survey_to_delete = None
        for survey in surveys:
            if survey[0] == st.session_state.delete_confirm_id:
                survey_to_delete = survey
                break
        
        if survey_to_delete:
            @st.dialog("⚠️ Confirm Survey Deletion")
            def delete_confirmation():
                st.write(f"Are you sure you want to delete the survey from **{survey_to_delete[1]}** by **{survey_to_delete[8]}**?")
                
                st.write("**This will permanently delete:**")
                st.write("- The survey record")
                st.write("- All associated butterfly sightings for this survey")
                
                st.warning("⚠️ **This action cannot be undone**")
                
                col1, col2 = st.columns(2)
                with col1:
                    if st.button("🗑️ Yes, Delete", type="primary", use_container_width=True):
                        if delete_survey(st.session_state.delete_confirm_id):
                            st.success("Survey deleted successfully!")
                            st.session_state.delete_confirm_id = None
                            st.rerun()
                        else:
                            st.error("Failed to delete survey")
                with col2:
                    if st.button("❌ Cancel", use_container_width=True):
                        st.session_state.delete_confirm_id = None
                        st.rerun()
            
            delete_confirmation()
    
    # Show message if no surveys exist
    if not surveys:
        st.info("No surveys found. Click 'Add New Survey' to create your first survey.")

if __name__ == "__main__":
    main()