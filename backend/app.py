from flask import Flask
from flask_cors import CORS

from backend.routes.resume import resume_bp


def create_app():
    app = Flask(__name__)
    CORS(
        app,
        origins=[
        "http://localhost:5173",
        "http://localhost:5177",
        "http://localhost:5178",
        ]   ,
    supports_credentials=True,
    )
    app.register_blueprint(resume_bp)
    return app 


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)