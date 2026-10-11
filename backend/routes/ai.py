from backend.services.ai import tailor_resume
from flask import Blueprint,request,jsonify
from backend.supabase_client import verify_user
from time import perf_counter

ai_bp=Blueprint("ai",__name__,url_prefix='/ai')

@ai_bp.route('/tailor_resume', methods=['POST'])
def tailor():
    parts = request.headers.get('Authorization', '').split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return jsonify({'error': 'Missing bearer token'}), 401
    user = verify_user(parts[1])
    if user:
        data = request.get_json()
        if not isinstance(data, dict) or not data.get('resume_id') or not isinstance(data.get('job'), dict):
            return jsonify({'error': 'resume_id and job are required'}), 400
        resume_id=data['resume_id']
        job=data['job']
        started = perf_counter()
        result= tailor_resume(resume_id,job,user)
        result['total_time_seconds'] = round(perf_counter() - started, 2)
        return jsonify(result),200
    else:
        return jsonify({'error':'user not found'}),401
        
