import json
from unittest.mock import patch

import pytest

from backend.AI import AI_pipeline
from backend.AI.AI_pipeline import build_frontend_response


def _suggestion(requirement, resume_id, before, suggestion):
    return {
        "requirement": requirement,
        "resume_id": resume_id,
        "relevant_text": before,
        "suggestion": suggestion,
        "reason": "Makes the existing experience clearer.",
    }


def test_supported_requirement_can_receive_wording_suggestion():
    analysis = {
        "evidence": [{
            "requirement": "Python",
            "group": "Python",
            "group_logic": "all",
            "group_classification": "supported",
            "classification": "supported",
            "importance": "required",
        }],
    }
    stage_3 = {
        "suggestions": [
            _suggestion(
                "Python",
                "projects[0].description",
                "Used Python for data cleanup.",
                "Cleaned project data using Python.",
            ),
        ],
        "improvements": [],
        "removals": [],
    }

    response = build_frontend_response(stage_3, analysis)

    assert len(response["suggestions"]) == 1
    assert response["suggestions"][0]["suggestion"] == (
        "Cleaned project data using Python."
    )


def test_suggestions_and_improvements_are_not_suppressed_by_group_status():
    analysis = {
        "evidence": [
            {
                "requirement": "Python",
                "group": "Programming languages",
                "group_logic": "any",
                "group_classification": "supported",
                "classification": "supported",
                "importance": "desired",
            },
            {
                "requirement": "C++",
                "group": "Programming languages",
                "group_logic": "any",
                "group_classification": "supported",
                "classification": "unsupported",
                "importance": "desired",
            },
        ],
    }
    stage_3 = {
        "suggestions": [
            _suggestion(
                "Python",
                "skills[0].skill_name",
                "Python",
                "Python programming",
            ),
            _suggestion(
                "C++",
                "skills[0].skill_name",
                "Python",
                "C++ programming",
            ),
        ],
        "improvements": [{
            "requirement": "C++",
            "improvement": "Describe any C++ experience if applicable.",
            "reason": "The job lists C++ as an option.",
            "resume_id": None,
        }],
        "removals": [],
    }

    response = build_frontend_response(stage_3, analysis)

    assert [item["requirement"] for item in response["suggestions"]] == [
        "Python", "C++",
    ]
    assert [item["requirement"] for item in response["improvements"]] == [
        "C++",
    ]


def test_suggestion_deduplication_keeps_keyword_and_format_edits_per_field():
    response = AI_pipeline.deduplicate_suggestions({
        "suggestions": [
            {
                "resume_id": "projects[0].description",
                "relevant_text": "Built a web app",
                "suggestion": "Developed a web application",
                "reason": "Uses the job's terminology for the same documented work.",
            },
            {
                "resume_id": "projects[1].description",
                "relevant_text": "Used Postgres",
                "suggestion": "Used PostgreSQL.",
                "reason": "Corrects terminology and punctuation.",
            },
            {
                "resume_id": "projects[2].description",
                "relevant_text": "Already accurate.",
                "suggestion": "Already accurate.",
                "reason": "No change needed.",
            },
        ],
    })

    assert [item["resume_id"] for item in response["suggestions"]] == [
        "projects[0].description",
        "projects[1].description",
    ]


def test_conflicting_suggestions_for_same_field_are_rejected():
    with pytest.raises(ValueError, match="conflicting suggestions"):
        AI_pipeline.deduplicate_suggestions({
            "suggestions": [
                {
                    "resume_id": "projects[0].description",
                    "relevant_text": "Built an app.",
                    "suggestion": "Developed an application.",
                },
                {
                    "resume_id": "projects[0].description",
                    "relevant_text": "Built an app.",
                    "suggestion": "Created a web application.",
                },
            ],
        })


def test_substantive_project_evidence_supports_broader_requirements():
    resume = {
        "resume": {"professional_summary": ""},
        "projects": [
            {"name": "Full-stack inventory app", "description": ""},
            {"name": "Database schema", "description": "Designed PostgreSQL schemas."},
            {"name": "Web application", "description": "Building web applications."},
            {"name": "LLM workflow", "description": "Built an LLM workflow for user prompts."},
        ],
        "skills": [{"skill_name": "Git"}],
    }
    requirements = {"requirements": [
        {
            "requirement": "Prior software development experience",
            "importance": "required",
            "group": "software development",
            "group_logic": "all",
            "direct_search_terms": ["software development experience"],
            "related_search_terms": [],
        },
        {
            "requirement": "Database knowledge",
            "importance": "required",
            "group": "database knowledge",
            "group_logic": "all",
            "direct_search_terms": ["database knowledge"],
            "related_search_terms": ["database schema design"],
        },
        {
            "requirement": "Application development knowledge",
            "importance": "required",
            "group": "application development",
            "group_logic": "all",
            "direct_search_terms": ["application development"],
            "related_search_terms": ["web application development"],
        },
        {
            "requirement": "Version control experience",
            "importance": "required",
            "group": "version control",
            "group_logic": "all",
            "direct_search_terms": ["version control experience"],
            "related_search_terms": ["source control"],
        },
        {
            "requirement": "Generative AI development experience",
            "importance": "required",
            "group": "generative AI development",
            "group_logic": "all",
            "direct_search_terms": ["generative AI development experience"],
            "related_search_terms": ["LLM workflow development"],
        },
        {
            "requirement": "Jenkins CI experience",
            "importance": "required",
            "group": "Jenkins CI",
            "group_logic": "all",
            "direct_search_terms": ["Git", "Jenkins"],
            "related_search_terms": [],
        },
        {
            "requirement": "Retrieval-augmented generation development",
            "importance": "required",
            "group": "retrieval-augmented generation",
            "group_logic": "all",
            "direct_search_terms": ["retrieval-augmented generation"],
            "related_search_terms": ["LLM workflow"],
        },
    ]}

    analysis = AI_pipeline.analyze_resume_requirements(
        resume,
        requirements,
        request_id="local-matcher-test",
    )
    classifications = {
        item["requirement"]: item["classification"]
        for item in analysis["evidence"]
    }

    assert classifications["Prior software development experience"] == "supported"
    assert classifications["Database knowledge"] == "supported"
    assert classifications["Application development knowledge"] == "supported"
    assert classifications["Version control experience"] == "supported"
    assert classifications["Generative AI development experience"] == "supported"
    assert classifications["Jenkins CI experience"] == "partial"
    assert classifications["Retrieval-augmented generation development"] == "partial"


class FakeProviderResponse:
    status_code = 200

    def __init__(self, content):
        self.content = content

    def raise_for_status(self):
        pass

    def json(self):
        return {
            "choices": [{
                "finish_reason": "stop",
                "message": {"content": json.dumps(self.content)},
            }],
        }


def test_evidence_shorthand_maps_to_canonical_requirement_name():
    resume = {
        "resume": {"professional_summary": ""},
        "projects": [
            {"name": "Project One", "description": "Built a project tracker."},
            {"name": "Project Two", "description": "Created a web application."},
            {"name": "Project Three", "description": "Built a resume analysis app."},
        ],
    }
    requirements = {"requirements": [{
        "requirement": "Passion for technology and engineering",
        "importance": "desired",
        "group": "Passion for technology and engineering",
        "group_logic": "all",
        "direct_search_terms": ["passion for technology"],
        "related_search_terms": ["enthusiasm for engineering"],
    }]}
    provider_result = {
        "suggestions": [{
            "requirement": "Passion for technology and engineering",
            "target_section": "Projects",
            "action": "replace",
            "resume_id": "projects[2].description",
            "suggestion": (
                "Built a resume analysis app, reflecting enthusiasm for "
                "technology and engineering."
            ),
            "reason": "Uses the motivation the candidate explicitly provided.",
            "new_entry": {
                "entry_title": "",
                "company": "",
                "location": "",
                "start_date": "",
                "end_date": "",
                "description": "",
                "link": "",
            },
        }],
    }
    user_evidence = [{
        "requirement": "passion",
        "target_section": "Projects",
        "evidence": "MY PROJECTS SHOW THAT IM PASSIONATE",
    }]

    with patch.object(
        AI_pipeline,
        "request_ai",
        return_value=FakeProviderResponse(provider_result),
    ) as request_ai:
        result = AI_pipeline.generate_evidence_suggestions(
            resume,
            {"title": "Engineer", "company": "Example", "description": "Job"},
            requirements,
            user_evidence,
            request_id="local-evidence-test",
        )

    suggestion = result["suggestions"][0]
    assert suggestion["requirement"] == "Passion for technology and engineering"
    assert suggestion["section_name"] == "Projects"
    assert suggestion["resume_id"] == "projects[2].description"
    assert suggestion["original_text"] == "Built a resume analysis app."
    assert '"requirement": "Passion for technology and engineering"' in (
        request_ai.call_args.args[0]
    )


def test_professional_summary_options_use_full_resume_and_job_input():
    resume = {
        "resume": {"full_name": "Jordan Lee", "professional_summary": ""},
        "projects": [{"name": "App", "description": "Built a web application."}],
    }
    job = {
        "title": "Software Engineer",
        "company": "Example",
        "description": "Develop web applications using Python.",
    }
    provider_result = {
        "summaries": [
            {"tone": "executive", "text": "Results-focused software engineer."},
            {"tone": "technical", "text": "Software engineer who builds web applications."},
            {"tone": "concise", "text": "Software engineer with web application experience."},
        ],
    }

    with patch.object(
        AI_pipeline,
        "request_ai",
        return_value=FakeProviderResponse(provider_result),
    ) as request_ai:
        result = AI_pipeline.generate_professional_summary_options(
            resume,
            job,
            request_id="local-summary-test",
        )

    assert [item["tone"] for item in result["options"]] == [
        "executive", "technical", "concise",
    ]
    prompt_content = request_ai.call_args.args[0]
    assert "FULL RESUME" in prompt_content
    assert "FULL JOB DESCRIPTION" in prompt_content
    assert "Jordan Lee" in prompt_content
    assert "Software Engineer" in prompt_content
