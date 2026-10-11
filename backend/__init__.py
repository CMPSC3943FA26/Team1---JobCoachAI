from flask import Flask
from flask_cors import CORS

from backend.supabase_client import supabase
from backend.routes.skill_gap import skill_gap_bp


def create_app():
    app = Flask(__name__)
    app.register_blueprint(skill_gap_bp)
    CORS(
        app,
        origins=["http://localhost:5173"],
        supports_credentials=True,
    )
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
