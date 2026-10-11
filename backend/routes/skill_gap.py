
from flask import Blueprint, jsonify, request
from backend.services.skill_gap import analyze_skill_gaps

skill_gap_bp = Blueprint("skill_gap", __name__)


@skill_gap_bp.route("/api/ai/skill-gap", methods=["POST"])
def skill_gap():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "JSON request body required"}), 400

    try:
        result = analyze_skill_gaps(
            data.get("resume_text"),
            data.get("job_description")
        )
        return jsonify(result), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400
