from flask import Flask
from flask_cors import CORS
from supabase_client import supabase

def create_app():
    app = Flask(__name__)
    CORS(
        app,orgins=["http://localhost:5173"],
        supports_credentials=True
    )
    if __name__ == "__main__":
        app.run(debug=True,port=5000)