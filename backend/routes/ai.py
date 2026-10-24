from backend.services.ai import tailor_resume
from flask import Blueprint,request,jsonify,current_app
from backend.supabase_client import verify_user
from time import perf_counter
import requests

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
        try:
            result = tailor_resume(resume_id, job, user)
        except requests.Timeout:
            current_app.logger.exception("AI analysis timed out")
            return jsonify({
                'error': 'AI analysis timed out. Please try again.'
            }), 504
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 429:
                current_app.logger.warning(
                    "AI provider rate limit: %s",
                    exc.response.text
                )
                return jsonify({
                    'error': 'The AI service is temporarily rate-limited. Please try again later.'
                }), 503

            current_app.logger.exception(
                "AI provider HTTP error: status=%s, body=%s",
                exc.response.status_code if exc.response is not None else None,
                exc.response.text if exc.response is not None else None,
            )
            return jsonify({
                'error': 'The AI service request failed. Please try again.'
            }), 502

        except requests.RequestException:
            current_app.logger.exception("AI provider request failed")
            return jsonify({
                'error': 'The AI service request failed. Please try again.'
            }), 502
        except (ValueError, KeyError, TypeError, IndexError):
            current_app.logger.exception("Invalid AI analysis response")
            return jsonify({
                'error': 'The AI returned an invalid analysis. Please regenerate.'
            }), 502
        except Exception:
            current_app.logger.exception("Unexpected AI analysis failure")
            return jsonify({
                'error': 'Unable to complete AI analysis. Please try again.'
            }), 500
        result['total_time_seconds'] = round(perf_counter() - started, 2)
        return jsonify(result),200
    else:
        return jsonify({'error':'user not found'}),401
        
