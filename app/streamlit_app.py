import streamlit as st
from pages import surveys, dashboard

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
    options=["Surveys", "Dashboard"],
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
        st.write("Bird Dashboard content coming soon...")
    
    with butterfly_dashboard_tab:
        st.write("Butterfly Dashboard content coming soon...")