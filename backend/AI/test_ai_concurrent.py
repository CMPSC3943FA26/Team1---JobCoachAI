import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from copy import deepcopy
from json import dumps
from pathlib import Path
from time import perf_counter
from uuid import uuid4

import requests
from dotenv import load_dotenv
from supabase import create_client

from backend.AI.AI_test import test_job_description as sample_job
from backend.AI.AI_test import test_resume as sample_resume


BACKEND_URL = os.getenv("AI_TEST_BACKEND_URL", "http://127.0.0.1:5000").rstrip("/")
REQUEST_TIMEOUT_SECONDS = 300


def _login_as_guest(label):
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    supabase_url = os.getenv("SUPABASE_URL")
    publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not supabase_url or not publishable_key:
        raise RuntimeError(
            "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in backend/.env"
        )

    client = create_client(supabase_url, publishable_key)
    auth = client.auth.sign_in_anonymously()
    if not auth.user or not auth.session:
        raise RuntimeError(f"{label} did not receive a Supabase guest session")

    return {
        "label": label,
        "user_id": auth.user.id,
        "access_token": auth.session.access_token,
    }


def _frontend_resume_payload():
    resume = deepcopy(sample_resume)

    def valid_date(value):
        return f"{value}-01" if isinstance(value, str) and len(value) == 7 else value

    for experience in resume.get("work_experience", []):
        experience["start_date"] = valid_date(experience.get("start_date"))
        experience["end_date"] = valid_date(experience.get("end_date"))
    for education in resume.get("education", []):
        education["start_date"] = valid_date(education.get("start_date"))
        education["end_date"] = valid_date(education.get("end_date"))
    for certification in resume.get("certifications", []):
        certification["date_earned"] = valid_date(
            certification.get("date_earned")
        )

    resume_fields = resume["resume"]
    resume["resume"] = {
        key: resume_fields.get(key)
        for key in (
            "full_name",
            "email",
            "phone",
            "location",
            "professional_summary",
        )
    }
    return resume


def _save_resume_as_frontend_user(user):
    response = requests.post(
        f"{BACKEND_URL}/resume/add_resume/{user['user_id']}",
        headers={"Authorization": f"Bearer {user['access_token']}"},
        json=_frontend_resume_payload(),
        timeout=30,
    )
    if response.status_code != 201:
        raise RuntimeError(
            f"{user['label']} resume save failed "
            f"(HTTP {response.status_code}): {response.text}"
        )
    body = response.json()
    if not body.get("resume_id"):
        raise RuntimeError(f"{user['label']} resume save returned no resume_id")
    return body["resume_id"]


def _call_ai_as_frontend_user(user, resume_id):
    started = perf_counter()
    client_request_id = uuid4().hex
    try:
        response = requests.post(
            f"{BACKEND_URL}/ai/tailor_resume"
            f"?client_request_id={client_request_id}",
            headers={"Authorization": f"Bearer {user['access_token']}"},
            json={
                "resume_id": resume_id,
                "job": {
                    key: sample_job[key]
                    for key in ("title", "company", "description")
                },
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        try:
            body = response.json()
        except ValueError:
            body = {"error": response.text}

        return {
            "label": user["label"],
            "user_id": user["user_id"],
            "resume_id": resume_id,
            "client_request_id": client_request_id,
            "request_id": response.headers.get("X-Request-ID"),
            "status_code": response.status_code,
            "elapsed_seconds": round(perf_counter() - started, 2),
            "body": body,
        }
    except requests.RequestException as exc:
        return {
            "label": user["label"],
            "user_id": user["user_id"],
            "resume_id": resume_id,
            "client_request_id": client_request_id,
            "request_id": None,
            "elapsed_seconds": round(perf_counter() - started, 2),
            "error": f"{type(exc).__name__}: {exc}",
        }


def _outcome_summary(outcome):
    body = outcome.get("body", {})
    summary = {
        key: outcome.get(key)
        for key in (
            "label",
            "user_id",
            "resume_id",
            "client_request_id",
            "request_id",
            "status_code",
            "elapsed_seconds",
        )
    }
    if "error" in outcome:
        summary["error"] = outcome["error"]
    elif isinstance(body, dict):
        if body.get("error"):
            summary["error"] = body["error"]
        else:
            summary.update({
                "backend_total_time_seconds": body.get("total_time_seconds"),
                "ATS_score": body.get("ATS_score"),
                "requirements_met_count": len(body.get("requirements_met", [])),
                "requirements_missing_count": body.get("requirements_missing"),
            })
    return summary


def test_single_then_concurrent_supabase_guest_requests():
    """Create two guest accounts; resume rows are removed, guest accounts persist."""
    users = []
    resume_ids = {}
    outcomes = []
    baseline = None
    try:
        users = [_login_as_guest("Guest 1"), _login_as_guest("Guest 2")]
        print("Supabase guest users:")
        print(dumps(
            [{"label": user["label"], "user_id": user["user_id"]} for user in users],
            indent=2,
        ))

        for user in users:
            resume_ids[user["user_id"]] = _save_resume_as_frontend_user(user)

        baseline = _call_ai_as_frontend_user(
            users[0], resume_ids[users[0]["user_id"]]
        )
        print("Single-user baseline result:")
        print(dumps(_outcome_summary(baseline), indent=2))

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(
                    _call_ai_as_frontend_user,
                    user,
                    resume_ids[user["user_id"]],
                )
                for user in users
            ]
            for future in as_completed(futures):
                outcomes.append(future.result())

        outcomes.sort(key=lambda result: result["label"])
        print("Concurrent frontend-style AI request results:")
        print(dumps(
            [_outcome_summary(outcome) for outcome in outcomes],
            indent=2,
        ))

        errors = [
            f"{outcome['label']} ({outcome['user_id']}): "
            f"{outcome.get('error', outcome.get('body', {}).get('error', outcome.get('status_code')))}"
            for outcome in outcomes
            if outcome.get("status_code") != 200 or "error" in outcome
        ]
        if baseline.get("status_code") != 200 or "error" in baseline:
            errors.insert(
                0,
                f"Single-user baseline ({baseline['user_id']}): "
                f"{baseline.get('error', baseline.get('body', {}).get('error', baseline.get('status_code')))}",
            )
        assert not errors, "Guest AI requests failed:\n" + "\n".join(errors)
        assert len(outcomes) == 2
    finally:
        for user in users:
            resume_id = resume_ids.get(user["user_id"])
            if not resume_id:
                continue
            try:
                response = requests.delete(
                    f"{BACKEND_URL}/resume/delete_resume/"
                    f"{user['user_id']}/{resume_id}",
                    headers={"Authorization": f"Bearer {user['access_token']}"},
                    timeout=30,
                )
                if response.status_code != 200:
                    print(
                        f"Resume cleanup failed for {user['label']} "
                        f"({user['user_id']}): HTTP {response.status_code} "
                        f"{response.text}"
                    )
            except requests.RequestException as exc:
                print(
                    f"Resume cleanup failed for {user['label']} "
                    f"({user['user_id']}): {type(exc).__name__}: {exc}"
                )
