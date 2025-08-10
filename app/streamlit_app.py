import streamlit as st
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.connection import get_db_connection
from forms.survey_forms import SurveyForm

st.set_page_config(
    page_title="Butterfly Survey App",
    page_icon="🦋",
    layout="wide"
)

def main():
    st.title("🦋 Butterfly Survey App")
    st.sidebar.title("Navigation")
    
    page = st.sidebar.selectbox("Choose a page", ["Home", "Survey Data", "Database View"])
    
    if page == "Home":
        st.header("Welcome to Butterfly Survey App")
        st.write("This app helps manage butterfly survey and sighting data.")
        
        # Show some quick stats
        try:
            conn = get_db_connection()
            if conn:
                cursor = conn.cursor()
                
                # Get total surveys
                cursor.execute("SELECT COUNT(*) FROM survey")
                survey_count = cursor.fetchone()[0]
                
                # Get total sightings
                cursor.execute("SELECT COUNT(*) FROM sighting")
                sighting_count = cursor.fetchone()[0]
                
                # Get total species seen
                cursor.execute("SELECT COUNT(DISTINCT species_id) FROM sighting")
                species_count = cursor.fetchone()[0]
                
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Total Surveys", survey_count)
                with col2:
                    st.metric("Total Sightings", sighting_count)
                with col3:
                    st.metric("Species Recorded", species_count)
                
                conn.close()
        except Exception as e:
            st.error(f"Error fetching stats: {e}")
        
    elif page == "Survey Data":
        st.header("Survey Data")
        survey_form = SurveyForm()
        survey_form.render()
        
    elif page == "Database View":
        st.header("Database View")
        try:
            conn = get_db_connection()
            if conn:
                st.success("Database connected successfully!")
                conn.close()
            else:
                st.error("Failed to connect to database")
        except Exception as e:
            st.error(f"Database connection error: {e}")

if __name__ == "__main__":
    main()