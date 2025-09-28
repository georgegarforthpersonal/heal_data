import streamlit as st
import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pages import surveys, dashboard
from dashboards.unified_dashboard import render_dashboard, render_report, render_reptile_report, create_combined_species_chart

st.set_page_config(
    page_title="Wildlife Survey Management", 
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Hide sidebar completely
st.markdown("""
<style>
    .st-emotion-cache-6qob1r {
        display: none !important;
    }
    .st-emotion-cache-1gwvy71 {
        display: none !important;
    }
    [data-testid="stSidebar"] {
        display: none !important;
    }
</style>
""", unsafe_allow_html=True)

# Main title
st.title("Heal Somerset - Survey Management")

# Top-level navigation using segmented control
selected_tab = st.segmented_control(
    None,
    options=["Surveys", "Dashboard", "Report"],
    default="Surveys",
)

if selected_tab == "Surveys":
    # Second-level navigation for surveys using normal tabs
    bird_surveys_tab, butterfly_surveys_tab = st.tabs(["🐦 Birds", "🦋 Butterflies"])
    
    with bird_surveys_tab:
        surveys.render_tab_content("bird")
    
    with butterfly_surveys_tab:
        surveys.render_tab_content("butterfly")

elif selected_tab == "Dashboard":
    # Second-level navigation for dashboard using normal tabs
    bird_dashboard_tab, butterfly_dashboard_tab = st.tabs(["🐦 Birds", "🦋 Butterflies"])

    with bird_dashboard_tab:
        render_dashboard("bird")

    with butterfly_dashboard_tab:
        render_dashboard("butterfly")

elif selected_tab == "Report":
    # Show both birds and butterflies reports on the same page
    st.header("Species Reports")

    # Combined chart at the top
    st.subheader("📊 Combined Species Overview")
    combined_fig = create_combined_species_chart()
    if combined_fig:
        st.plotly_chart(combined_fig, use_container_width=True)
    else:
        st.error("Unable to load combined species chart")

    # Individual sections below
    st.divider()

    # Birds section
    st.subheader("🐦 Birds")
    render_report("bird")

    # Butterflies section
    st.subheader("🦋 Butterflies")
    render_report("butterfly")

    # Reptiles section
    st.subheader("🦎 Reptiles")
    render_reptile_report()