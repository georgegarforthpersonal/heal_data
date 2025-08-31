import streamlit as st
from pages import surveys, dashboard

st.set_page_config(page_title="Wildlife Survey Management", layout="wide")

# Define pages
surveys_page = st.Page(surveys.show, title="Surveys", icon="🔍")
dashboard_page = st.Page(dashboard.dashboard, title="Dashboard", icon="📊")

# Create navigation
pg = st.navigation([surveys_page, dashboard_page])

# Run the selected page
pg.run()