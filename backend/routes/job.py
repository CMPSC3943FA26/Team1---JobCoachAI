from flask import Blueprint, request, jsonify
from backend.schemas.job import JobCreateRequest, JobUpdateRequest
from backend.services.job import create_job, get_job, update_job, delete_job


job_bp = Blueprint("job", __name__, url_prefix="/job")


# Create Job
@job_bp.route('/add_job/<uuid:user_id>', methods=['POST'])
def insert(user_id):
    data = JobCreateRequest(**request.get_json())
    response = create_job(user_id, data)

    if response.data:
        return jsonify({'message': 'job created successfully'}), 201
    else:
        return jsonify({'error': 'issue with creating job'}), 400


# Update Job
@job_bp.route('/update_job/<uuid:user_id>/<uuid:job_id>', methods=['PATCH'])
def put(user_id, job_id):
    data = JobUpdateRequest(**request.get_json())
    response = update_job(job_id, user_id, data)

    if response.data:
        return jsonify({'message': 'job updated successfully'}), 200
    else:
        return jsonify({
            'error': 'issue with updating job'
        }), 400


# Delete Job
@job_bp.route('/delete_job/<uuid:user_id>/<uuid:job_id>', methods=['DELETE'])
def delete(user_id, job_id):
    response = delete_job(user_id, job_id)

    if response.data:
        return jsonify({'message': 'job successfully deleted'}), 200
    else:
        return jsonify({'error': 'no job found to delete'}), 404


# Get Job
@job_bp.route('/get_job/<uuid:user_id>/<uuid:job_id>', methods=['GET'])
def get(user_id, job_id):
    response = get_job(user_id, job_id)

    if response.data:
        return jsonify(response.data[0]), 200
    else:
        return jsonify({'error': 'no job found'}), 404