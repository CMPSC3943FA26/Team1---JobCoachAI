from flask import Blueprint, request, jsonify

from backend.schemas.resume import (
    ResumeSaveRequest,
    ResumeUpdateRequest,
)

from backend.services.resume import (
    create_resume,
    get_resume,
    delete_resume,
    update_resume,
    list_resumes,
)


resume_bp = Blueprint(
    "resume",
    __name__,
    url_prefix="/resume",
)


# Create a new resume
@resume_bp.route(
    "/add_resume/<uuid:user_id>",
    methods=["POST"]
)
def insert(user_id):
    try:
        data = ResumeSaveRequest(
            **request.get_json()
        )

        result = create_resume(
            data,
            str(user_id),
        )

        if result:
            return jsonify({
                "message": "resume created successfully",
                "resume": result,
                "id": result["id"],
            }), 201

        return jsonify({
            "error": "issue with creating resume"
        }), 400

    except Exception as error:
        print("Create resume error:", error)

        return jsonify({
            "error": str(error)
        }), 400


# Update an existing resume
@resume_bp.route(
    "/update_resume/<uuid:user_id>/<uuid:resume_id>",
    methods=["PATCH"]
)
def put(user_id, resume_id):
    try:
        data = ResumeUpdateRequest(
            **request.get_json()
        )

        result = update_resume(
            str(resume_id),
            str(user_id),
            data,
        )

        if result:
            return jsonify({
                "message": "resume updated successfully",
                "resume": result,
            }), 200

        return jsonify({
            "error": "issue with updating resume",
            "result": result,
        }), 400

    except Exception as error:
        print("Update resume error:", error)

        return jsonify({
            "error": str(error)
        }), 400


# Delete a resume
@resume_bp.route(
    "/delete_resume/<uuid:user_id>/<uuid:resume_id>",
    methods=["DELETE"]
)
def delete(user_id, resume_id):
    try:
        result = delete_resume(
            str(resume_id),
            str(user_id),
        )

        if result:
            return jsonify({
                "message": "resume successfully deleted"
            }), 200

        return jsonify({
            "error": "no resume found to delete"
        }), 404

    except Exception as error:
        print("Delete resume error:", error)

        return jsonify({
            "error": str(error)
        }), 400


# Get one saved resume
@resume_bp.route(
    "/get_resume/<uuid:user_id>/<uuid:resume_id>",
    methods=["GET"]
)
def get(user_id, resume_id):
    try:
        data = get_resume(
            str(resume_id),
            str(user_id),
        )

        if data:
            return jsonify({
                "resume": data,
                "id": data["id"],
            }), 200

        return jsonify({
            "error": "no resume found"
        }), 404

    except Exception as error:
        print("Get resume error:", error)

        return jsonify({
            "error": str(error)
        }), 400


# Get all resumes belonging to a user
@resume_bp.route(
    "/list_resumes/<uuid:user_id>",
    methods=["GET"]
)
def list_user_resumes(user_id):
    try:
        resumes = list_resumes(
            str(user_id)
        )

        return jsonify({
            "resumes": resumes
        }), 200

    except Exception as error:
        print("List resumes error:", error)

        return jsonify({
            "error": str(error)
        }), 400