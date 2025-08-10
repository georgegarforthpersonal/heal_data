import streamlit as st
from database.connection import get_db_cursor
from database.models import Survey, Sighting, Surveyor, Species, Transect
import pandas as pd
from datetime import date, time

class SurveyForm:
    def render(self):
        st.subheader("Survey Management")
        
        tab1, tab2, tab3 = st.tabs(["View Surveys", "Add Survey", "View Sightings"])
        
        with tab1:
            self._render_surveys_view()
            
        with tab2:
            self._render_survey_form()
            
        with tab3:
            self._render_sightings_view()
    
    def _render_surveys_view(self):
        st.header("Survey Data")
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute("""
                    SELECT s.id, s.date, s.start_time, s.end_time, 
                           s.sun_percentage, s.temperature_celsius, s.conditions_met,
                           CONCAT(sv.first_name, ' ', sv.last_name) as surveyor_name,
                           COUNT(si.id) as sighting_count
                    FROM survey s
                    LEFT JOIN surveyor sv ON s.surveyor_id = sv.id
                    LEFT JOIN sighting si ON s.id = si.survey_id
                    GROUP BY s.id, s.date, s.start_time, s.end_time, 
                             s.sun_percentage, s.temperature_celsius, s.conditions_met,
                             sv.first_name, sv.last_name
                    ORDER BY s.date DESC, s.start_time DESC
                """)
                surveys = cursor.fetchall()
                
                if surveys:
                    for survey in surveys:
                        with st.expander(f"Survey {survey[0]} - {survey[1]} by {survey[7]} ({survey[8]} sightings)"):
                            col1, col2 = st.columns(2)
                            with col1:
                                st.write(f"**Date:** {survey[1]}")
                                st.write(f"**Time:** {survey[2]} - {survey[3]}")
                                st.write(f"**Surveyor:** {survey[7]}")
                            with col2:
                                st.write(f"**Sun:** {survey[4]}%")
                                st.write(f"**Temperature:** {survey[5]}°C")
                                st.write(f"**Conditions Met:** {'Yes' if survey[6] else 'No'}")
                            
                            # Show sightings for this survey
                            st.write("**Sightings:**")
                            cursor.execute("""
                                SELECT sp.name, t.name, si.count
                                FROM sighting si
                                JOIN species sp ON si.species_id = sp.id
                                JOIN transect t ON si.transect_id = t.id
                                WHERE si.survey_id = %s
                                ORDER BY t.number, sp.name
                            """, (survey[0],))
                            sightings = cursor.fetchall()
                            
                            if sightings:
                                df = pd.DataFrame(sightings, columns=['Species', 'Transect', 'Count'])
                                st.dataframe(df, hide_index=True)
                            else:
                                st.write("No sightings recorded for this survey")
                else:
                    st.info("No surveys found.")
                    
        except Exception as e:
            st.error(f"Error fetching surveys: {e}")
    
    def _render_survey_form(self):
        st.header("Add New Survey")
        
        # Get surveyors for dropdown
        try:
            with get_db_cursor() as cursor:
                cursor.execute("SELECT id, first_name, last_name FROM surveyor ORDER BY first_name")
                surveyors = cursor.fetchall()
        except Exception as e:
            st.error(f"Error fetching surveyors: {e}")
            surveyors = []
        
        with st.form("survey_form"):
            col1, col2 = st.columns(2)
            
            with col1:
                survey_date = st.date_input("Survey Date", value=date.today())
                start_time = st.time_input("Start Time", value=time(14, 0))
                sun_percentage = st.slider("Sun Percentage", 0, 100, 75)
                conditions_met = st.checkbox("Conditions Met", value=True)
                
            with col2:
                end_time = st.time_input("End Time", value=time(15, 0))
                temperature = st.number_input("Temperature (°C)", min_value=-10.0, max_value=40.0, value=20.0, step=0.5)
                
                if surveyors:
                    surveyor_options = {f"{first_name} {last_name}".strip(): id for id, first_name, last_name in surveyors}
                    selected_surveyor = st.selectbox("Surveyor", list(surveyor_options.keys()))
                    surveyor_id = surveyor_options[selected_surveyor] if selected_surveyor else None
                else:
                    st.warning("No surveyors found.")
                    surveyor_id = None
            
            submitted = st.form_submit_button("Add Survey")
            
            if submitted:
                if survey_date and start_time and end_time and surveyor_id is not None:
                    try:
                        with get_db_cursor() as cursor:
                            cursor.execute(
                                """INSERT INTO survey 
                                   (date, start_time, end_time, sun_percentage, temperature_celsius, conditions_met, surveyor_id) 
                                   VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                                (survey_date, start_time, end_time, sun_percentage, temperature, conditions_met, surveyor_id)
                            )
                            survey_id = cursor.fetchone()[0]
                            st.success(f"Survey added successfully with ID: {survey_id}")
                            st.rerun()
                    except Exception as e:
                        st.error(f"Error adding survey: {e}")
                else:
                    st.error("Please fill in all required fields")
    
    def _render_sightings_view(self):
        st.header("All Sightings")
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute("""
                    SELECT si.id, s.date, sp.name, t.name, si.count,
                           CONCAT(sv.first_name, ' ', sv.last_name) as surveyor_name
                    FROM sighting si
                    JOIN survey s ON si.survey_id = s.id
                    JOIN species sp ON si.species_id = sp.id
                    JOIN transect t ON si.transect_id = t.id
                    LEFT JOIN surveyor sv ON s.surveyor_id = sv.id
                    ORDER BY s.date DESC, sp.name, t.number
                """)
                sightings = cursor.fetchall()
                
                if sightings:
                    df = pd.DataFrame(sightings, columns=['ID', 'Date', 'Species', 'Transect', 'Count', 'Surveyor'])
                    
                    # Add filters
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        species_filter = st.selectbox("Filter by Species", ["All"] + sorted(df['Species'].unique().tolist()))
                    with col2:
                        transect_filter = st.selectbox("Filter by Transect", ["All"] + sorted(df['Transect'].unique().tolist()))
                    with col3:
                        surveyor_filter = st.selectbox("Filter by Surveyor", ["All"] + sorted(df['Surveyor'].unique().tolist()))
                    
                    # Apply filters
                    filtered_df = df.copy()
                    if species_filter != "All":
                        filtered_df = filtered_df[filtered_df['Species'] == species_filter]
                    if transect_filter != "All":
                        filtered_df = filtered_df[filtered_df['Transect'] == transect_filter]
                    if surveyor_filter != "All":
                        filtered_df = filtered_df[filtered_df['Surveyor'] == surveyor_filter]
                    
                    st.dataframe(filtered_df, hide_index=True)
                    
                    # Show summary statistics
                    st.subheader("Summary Statistics")
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        st.write("**Total Count by Species:**")
                        species_totals = filtered_df.groupby('Species')['Count'].sum().sort_values(ascending=False)
                        st.dataframe(species_totals.to_frame('Total Count'))
                    
                    with col2:
                        st.write("**Total Count by Transect:**")
                        transect_totals = filtered_df.groupby('Transect')['Count'].sum().sort_values(ascending=False)
                        st.dataframe(transect_totals.to_frame('Total Count'))
                        
                else:
                    st.info("No sightings found.")
                    
        except Exception as e:
            st.error(f"Error fetching sightings: {e}")