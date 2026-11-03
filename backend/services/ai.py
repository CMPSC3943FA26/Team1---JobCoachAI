
from backend.AI.AI_test import (
    analyze_current_resume,
    generate_evidence_suggestions,
    generate_suggestions_for_resume,
    main_request_combined,
    regenerate,
)

def tailor_resume(resume_id:str,job:object,user_id:str,request_id=None):
    return main_request_combined(resume_id, job, user_id, request_id=request_id)

def regenerate_resume(
    current_resume,
    job,
    requirements,
    unapplied_suggestions=None,
    request_id=None,
    candidate_context='',
    analysis=None,
    user_evidence=None,
):
    return regenerate(
        current_resume,
        job,
        requirements,
        unapplied_suggestions,
        request_id=request_id,
        candidate_context=candidate_context,
        analysis=analysis,
        user_evidence=user_evidence,
    )


def analyze_resume(
    current_resume,
    job,
    requirements=None,
    user_evidence=None,
    request_id=None,
):
    return analyze_current_resume(
        current_resume,
        job,
        requirements=requirements,
        user_evidence=user_evidence,
        request_id=request_id,
    )


def generate_suggestions(
    current_resume,
    job,
    requirements,
    analysis,
    user_evidence=None,
    unapplied_suggestions=None,
    request_id=None,
    candidate_context='',
):
    return generate_suggestions_for_resume(
        current_resume,
        job,
        requirements,
        analysis,
        user_evidence=user_evidence,
        unapplied_suggestions=unapplied_suggestions,
        request_id=request_id,
        candidate_context=candidate_context,
    )


def generate_evidence_section_suggestions(
    current_resume,
    job,
    requirements,
    user_evidence,
    request_id=None,
):
    return generate_evidence_suggestions(
        current_resume,
        job,
        requirements,
        user_evidence,
        request_id=request_id,
    )
