from flask import Blueprint, request, jsonify
from backend.schemas.resume import ResumeUpdateRequest,ResumeSaveRequest
from backend.services.resume import create_resume, get_resume, delete_resume, update_resume, list_resumes

resume_bp = Blueprint("resume", __name__, url_prefix='/resume')


@resume_bp.route('/add_resume/<uuid:user_id>', methods=['POST'])
def insert(user_id):
    data = ResumeSaveRequest(**request.get_json()) 
    result = create_resume(data,user_id)
    if result:
       resume_id = result["id"]
       return jsonify({'message':'resume created successfully','resume_id':str(resume_id)}),201
    else:
       return jsonify({'error':'issue with creating resume'})

@resume_bp.route('/update_resume/<uuid:user_id>/<uuid:resume_id>',methods=['PATCH'])
def put(user_id,resume_id):
   data = ResumeUpdateRequest(**request.get_json())
   result = update_resume(resume_id,user_id,data)
   if result:
      return jsonify({'message':'resume updated successfully'}),200
   else:
      return jsonify({'error':'issue with updating resume','result': result}),400
   
@resume_bp.route('/delete_resume/<uuid:user_id>/<uuid:resume_id>',methods=['DELETE'])
def delete(user_id,resume_id):
   result = delete_resume(resume_id,user_id)
   if result:
      return jsonify({'message': 'resume successfully deleted'}), 200
   else:
      return jsonify({'error':'no resume found to delete'}),404

@resume_bp.route('/get_resume/<uuid:user_id>/<uuid:resume_id>', methods=['GET'])
def get(user_id, resume_id):
    data = get_resume(str(resume_id), str(user_id))
    if data:
        return jsonify({'resume': data, 'id': data['id']}), 200
    else:
        return jsonify({'error': 'no resume found'}), 404

    # list all resumes for a user_id


@resume_bp.route('/list_resumes/<uuid:user_id>', methods=['GET'])
def list_all(user_id):
    title = request.args.get('title')
    career_field = request.args.get('career_field')
    data = list_resumes(user_id, title=title, career_field=career_field)
    return jsonify({'resumes': data}), 200