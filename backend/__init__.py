from flask import Flask
from flask_cors import CORS

from backend.supabase_client import supabase


def create_app():
    app = Flask(__name__)
    CORS(
        app,
        origins=["http://localhost:5173"],
        supports_credentials=True,
    )
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)