FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app/ ./app/
COPY app/scripts/ ./scripts/
COPY ["app/scripts/data/Heal Butterfly transect 2025.csv", "./"]

EXPOSE 8501

# Change to app directory so imports work correctly
WORKDIR /app/app
CMD ["streamlit", "run", "streamlit_app.py", "--server.address", "0.0.0.0"]