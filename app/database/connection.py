import psycopg2
import os
from contextlib import contextmanager

def get_db_connection():
    """Create and return a database connection"""
    try:
        connection_params = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'heal_butterflies'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', 'password')
        }

        # Add SSL mode if specified (required for Neon)
        sslmode = os.getenv('DB_SSLMODE')
        if sslmode:
            connection_params['sslmode'] = sslmode

        conn = psycopg2.connect(**connection_params)
        return conn
    except psycopg2.Error as e:
        print(f"Error connecting to database: {e}")
        return None

@contextmanager
def get_db_cursor():
    """Context manager for database operations"""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            yield cursor
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    else:
        raise Exception("Failed to connect to database")