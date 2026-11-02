from backend.services.ai import tailor_resume
from flask import Blueprint, current_app, g, jsonify, request
from backend.supabase_client import verify_user
import logging
from time import perf_counter
from uuid import UUID, uuid4
import requests

ai_bp=Blueprint("ai",__name__,url_prefix='/ai')

@ai_bp.route('/tailor_resume', methods=['POST'])
def tailor():
    current_app.logger.setLevel(logging.INFO)
    ai_logger = logging.getLogger("backend.AI.AI_test")
    if not ai_logger.handlers:
        ai_logger.handlers = current_app.logger.handlers[:]
        ai_logger.propagate = False
    g.ai_request_id = uuid4().hex
    try:
        g.ai_client_request_id = UUID(
            request.args.get("client_request_id", "")
        ).hex
    except ValueError:
        g.ai_client_request_id = None
    g.ai_request_started = perf_counter()
    current_app.logger.info(
        "AI request started request_id=%s client_request_id=%s",
        g.ai_request_id,
        g.ai_client_request_id,
    )
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
            result = tailor_resume(
                resume_id, job, user, request_id=g.ai_request_id
            )
        except requests.Timeout:
            current_app.logger.exception(
                "AI request timed out request_id=%s",
                g.ai_request_id,
            )
            return jsonify({
                'error': 'AI analysis timed out. Please try again.'
            }), 504
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 429:
                current_app.logger.warning(
                    "AI provider rate limit request_id=%s status=%s",
                    g.ai_request_id,
                    exc.response.status_code,
                )
                return jsonify({
                    'error': 'The AI service is temporarily rate-limited. Please try again later.'
                }), 503

            current_app.logger.exception(
                "AI provider HTTP error request_id=%s status=%s",
                g.ai_request_id,
                exc.response.status_code if exc.response is not None else None,
            )
            return jsonify({
                'error': 'The AI service request failed. Please try again.'
            }), 502

        except requests.RequestException:
            current_app.logger.exception(
                "AI provider request failed request_id=%s",
                g.ai_request_id,
            )
            return jsonify({
                'error': 'The AI service request failed. Please try again.'
            }), 502
        except (ValueError, KeyError, TypeError, IndexError):
            current_app.logger.exception(
                "Invalid AI analysis response request_id=%s",
                g.ai_request_id,
            )
            return jsonify({
                'error': 'The AI returned an invalid analysis. Please regenerate.'
            }), 502
        except Exception:
            current_app.logger.exception(
                "Unexpected AI analysis failure request_id=%s",
                g.ai_request_id,
            )
            return jsonify({
                'error': 'Unable to complete AI analysis. Please try again.'
            }), 500
        result['total_time_seconds'] = round(perf_counter() - started, 2)
        response = jsonify(result)
        response.status_code = 200
        return response
    else:
        return jsonify({'error':'user not found'}),401


@ai_bp.after_request
def log_ai_request_end(response):
    request_id = getattr(g, "ai_request_id", None)
    if request_id:
        elapsed = perf_counter() - g.ai_request_started
        response.headers["X-Request-ID"] = request_id
        current_app.logger.info(
            "AI request ended request_id=%s client_request_id=%s "
            "status=%s elapsed_seconds=%.2f",
            request_id,
            getattr(g, "ai_client_request_id", None),
            response.status_code,
            elapsed,
        )
    return response
        
