from backend.services.ai import (
    analyze_resume,
    generate_evidence_section_suggestions,
    generate_suggestions,
    regenerate_resume,
    tailor_resume,
)
from flask import Blueprint, current_app, g, jsonify, request
from backend.supabase_client import verify_user
import logging
from time import perf_counter
from uuid import UUID, uuid4
import requests

ai_bp=Blueprint("ai",__name__,url_prefix='/ai')

def configure_ai_logger():
    ai_logger = logging.getLogger("backend.AI.AI_test")
    if not ai_logger.handlers:
        app_handlers = current_app.logger.handlers
        if app_handlers:
            ai_logger.handlers = app_handlers[:]
        else:
            ai_logger.setLevel(logging.INFO)
            ai_logger.propagate = True
            return
    ai_logger.setLevel(logging.INFO)
    ai_logger.propagate = False


def start_ai_request():
    current_app.logger.setLevel(logging.INFO)
    configure_ai_logger()
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


def authenticated_user():
    parts = request.headers.get('Authorization', '').split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None
    return verify_user(parts[1])


def handle_ai_error(error, stage):
    if isinstance(error, requests.Timeout):
        status, message = 504, 'AI analysis timed out. Please try again.'
    elif isinstance(error, requests.HTTPError):
        status = 503 if error.response is not None and error.response.status_code == 429 else 502
        message = (
            'The AI service is temporarily rate-limited. Please try again later.'
            if status == 503
            else 'The AI service request failed. Please try again.'
        )
    elif isinstance(error, requests.RequestException):
        status, message = 502, 'The AI service request failed. Please try again.'
    elif isinstance(error, (ValueError, KeyError, TypeError, IndexError)):
        status, message = 502, 'The AI returned an invalid analysis. Please regenerate.'
    else:
        status, message = 500, 'Unable to complete AI analysis. Please try again.'
    current_app.logger.exception(
        "AI request failed request_id=%s stage=%s",
        getattr(g, "ai_request_id", "unknown"),
        stage,
        exc_info=error,
    )
    return jsonify({'error': message}), status


@ai_bp.route('/tailor_resume', methods=['POST'])
def tailor():
    start_ai_request()
    user = authenticated_user()
    if user is None:
        return jsonify({'error': 'Missing bearer token'}), 401
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
                "Invalid AI analysis response request_id=%s "
                "stage=resume_analysis",
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


@ai_bp.route('/analyze_resume', methods=['POST'])
def analyze():
    start_ai_request()
    if authenticated_user() is None:
        return jsonify({'error': 'Missing or invalid bearer token'}), 401
    data = request.get_json()
    if (
        not isinstance(data, dict)
        or not isinstance(data.get('current_resume'), dict)
        or not isinstance(data.get('job'), dict)
    ):
        return jsonify({'error': 'current_resume and job are required'}), 400
    started = perf_counter()
    try:
        result = analyze_resume(
            data['current_resume'],
            data['job'],
            requirements=data.get('requirements'),
            user_evidence=data.get('user_evidence'),
            request_id=g.ai_request_id,
        )
        result['total_time_seconds'] = round(perf_counter() - started, 2)
        return jsonify(result)
    except Exception as error:
        return handle_ai_error(error, "resume_matching")


@ai_bp.route('/generate_suggestions', methods=['POST'])
def generate():
    start_ai_request()
    if authenticated_user() is None:
        return jsonify({'error': 'Missing or invalid bearer token'}), 401
    data = request.get_json()
    if (
        not isinstance(data, dict)
        or not isinstance(data.get('current_resume'), dict)
        or not isinstance(data.get('job'), dict)
        or not isinstance(data.get('requirements'), dict)
        or not isinstance(data.get('analysis'), dict)
    ):
        return jsonify({
            'error': 'current_resume, job, requirements, and analysis are required'
        }), 400
    started = perf_counter()
    try:
        result = generate_suggestions(
            data['current_resume'],
            data['job'],
            data['requirements'],
            data['analysis'],
            user_evidence=data.get('user_evidence'),
            unapplied_suggestions=data.get('unapplied_suggestions'),
            candidate_context=data.get('candidate_context', ''),
            request_id=g.ai_request_id,
        )
        result['total_time_seconds'] = round(perf_counter() - started, 2)
        return jsonify(result)
    except Exception as error:
        return handle_ai_error(error, "resume_suggestions")


@ai_bp.route('/generate_evidence_suggestions', methods=['POST'])
def generate_evidence():
    start_ai_request()
    if authenticated_user() is None:
        return jsonify({'error': 'Missing or invalid bearer token'}), 401
    data = request.get_json()
    if (
        not isinstance(data, dict)
        or not isinstance(data.get('current_resume'), dict)
        or not isinstance(data.get('job'), dict)
        or not isinstance(data.get('requirements'), dict)
        or not isinstance(data.get('user_evidence'), list)
    ):
        return jsonify({
            'error': (
                'current_resume, job, requirements, and user_evidence are required'
            )
        }), 400
    started = perf_counter()
    try:
        result = generate_evidence_section_suggestions(
            data['current_resume'],
            data['job'],
            data['requirements'],
            data['user_evidence'],
            request_id=g.ai_request_id,
        )
        result['total_time_seconds'] = round(perf_counter() - started, 2)
        return jsonify(result)
    except Exception as error:
        return handle_ai_error(error, "evidence_suggestions")


@ai_bp.route('/regenerate_resume', methods=['POST'])
def regenerate():
    start_ai_request()
    if authenticated_user() is None:
        return jsonify({'error': 'Missing or invalid bearer token'}), 401
    data = request.get_json()
    if not isinstance(data, dict):
        return jsonify({'error': 'A JSON request body is required'}), 400
    current_resume = data.get('current_resume')
    job = data.get('job')
    requirements = data.get('requirements')
    unapplied_suggestions = data.get('unapplied_suggestions', [])
    candidate_context = data.get('candidate_context', '')
    user_evidence = data.get('user_evidence')
    analysis = data.get('analysis')
    started = perf_counter()
    try:
        result = regenerate_resume(
            current_resume,
            job,
            requirements,
            unapplied_suggestions,
            request_id=g.ai_request_id,
            candidate_context=candidate_context,
            analysis=analysis,
            user_evidence=user_evidence,
        )
        result['total_time_seconds'] = round(perf_counter() - started, 2)
        return jsonify(result)
    except Exception as error:
        return handle_ai_error(error, "resume_suggestions")


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
        
