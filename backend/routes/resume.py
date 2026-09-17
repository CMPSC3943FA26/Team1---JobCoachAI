from flask import Blueprint, request, jsonify
from backend.services.resume import create_resume, get_resume, delete_resume, update_resume

resume_bp = Blueprint("resume",__name__,url_prefix='/resume')

@resume_bp.route('/add_resume/<uuid:user_id>', methods=['POST'])
def insert(user_id):
    data = request.get_json()
    result = create_resume(user_id,data)
    if result:
       return jsonify({'message':'resume created successfully'}),201
    else:
       return jsonify({'error':'issue with creating resume'})

@resume_bp.route('/update_resume/<uuid:user_id>/<uuid:resume_id>',methods=['PATCH'])
def put(user_id,resume_id):
   data = request.get_json()
   result = update_resume(user_id,resume_id,data)
   if result:
      return jsonify({'message':'resume updated successfully'}),200
   else:
      return jsonify({'error':'issue with updating resume','result': result}),400
   
@resume_bp.route('/delete_resume/<uuid:user_id>/<uuid:resume_id>',methods=['DELETE'])
def delete(user_id,resume_id):
   result = delete_resume(user_id,resume_id)
   if result:
      return jsonify({'resume successfully deleted'}),200
   else:
      return jsonify({'error':'no resume found to delete'}),404

@resume_bp.route('/get_resume/<uuid:user_id>/<uuid:resume_id>', methods=['GET'])
def get(user_id,resume_id):
   data = get_resume(user_id,resume_id)
   if data:
        return jsonify({'resume':data,'id':data['id']}),200
   else:
      return jsonify({'error':'no resume found'}),404


