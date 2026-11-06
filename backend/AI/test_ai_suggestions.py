import json
from unittest.mock import patch

import pytest

from backend.AI import AI_pipeline
from backend.AI.AI_pipeline import build_frontend_response


def test_general_replacement_has_no_requirement_and_does_not_affect_score():
    result = build_frontend_response({
        "suggestions": [{
            "requirement": None,
            "resume_id": "skills[0].skill_name",
            "relevant_text": "LInux",
            "suggestion": "Linux",
            "reason": "Corrects capitalization.",
            "action": "replace",
        }],
        "improvements": [],
        "removals": [],
    }, {"evidence": []})
    suggestion = result["suggestions"][0]
    assert suggestion["requirement"] is None
    assert suggestion["type"] == "general"
    assert suggestion["importance"] == 0
    assert suggestion["suggestion"] == "Linux"
    assert result["ATS_score"] == 0
    assert result["requirements_met"] == []


def test_cpp_evidence_does_not_establish_c():
    assert not AI_pipeline._exact_or_alias_match("Used C++ in Operating Systems.", "C")


def test_c_skill_accepts_c_programming_search_term_and_cross_requirement_evidence():
    requirement = "Strong C programming"
    clarification = {
        "requirement": requirement,
        "resume_id": None,
        "improvement": "Have you used C?",
        "reason": "Confirm experience.",
    }
    normalized = AI_pipeline.restore_combined_resume_text({
        "suggestions": [{
            "requirement": requirement,
            "resume_id": "",
            "suggestion": "",
            "action": "add",
            "section_name": "Skills",
            "new_entry": {"skill_name": "C"},
            "reason": "User confirmed C coursework.",
        }],
        "improvements": [clarification],
        "removals": [],
    }, {"skills": []})
    result = AI_pipeline._keep_supported_skill_additions(
        normalized, {"skills": []}, {"evidence": []},
        {"requirements": [
            {"requirement": requirement, "direct_search_terms": ["C programming"]},
            {"requirement": "Strong C++ programming", "direct_search_terms": ["C++"]},
        ]},
        [{
            "requirement": "Strong C++ programming",
            "evidence": "I used C in Programming 1 and 2 and C++ in Operating Systems.",
            "target_section": "Let AI decide",
        }],
    )
    assert result["suggestions"][0]["new_entry"] == {"skill_name": "C"}
    assert result["improvements"] == []


@pytest.mark.parametrize("text", ["", "   "])
@pytest.mark.parametrize("existing_removal", [False, True])
def test_empty_replacement_is_normalized_to_reviewable_removal(text, existing_removal):
    removal = {
        "resume_id": "skills[1].skill_name",
        "reason": "Duplicate Git skill.",
    }
    response = AI_pipeline.restore_combined_resume_text({
        "suggestions": [{
            **removal,
            "requirement": None,
            "action": "replace",
            "suggestion": text,
        }],
        "removals": [removal] if existing_removal else [],
    }, {"skills": [{"skill_name": "Git"}, {"skill_name": "Git"}]})
    response = AI_pipeline.deduplicate_suggestions(response)
    frontend = build_frontend_response(response, {"evidence": []})
    assert frontend["suggestions"] == []
    assert frontend["removals"] == [{
        "resume_id": "skills[1].skill_name",
        "relevant_text": "Git",
        "reason": "Duplicate Git skill.",
    }]


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
            {
                "tone": "executive",
                "text": " ".join(f"executive{i}" for i in range(38)),
            },
            {
                "tone": "technical",
                "text": " ".join(f"technical{i}" for i in range(120)),
            },
            {
                "tone": "concise",
                "text": " ".join(f"concise{i}" for i in range(50)),
            },
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
    normalized_prompt = " ".join(prompt_content.split())
    assert "FULL RESUME" in prompt_content
    assert "FULL JOB DESCRIPTION" in prompt_content
    assert "Jordan Lee" in prompt_content
    assert "Software Engineer" in prompt_content
    assert "60 words or fewer" in normalized_prompt
    assert "no minimum word count" in normalized_prompt
    assert len(result["options"][0]["text"].split()) == 38
    assert "minor wording revisions" in normalized_prompt
    assert "Preserve factual accuracy" in normalized_prompt
    assert request_ai.call_args.kwargs["reasoning_effort"] == "low"


def test_minor_revision_guidance_is_in_tailoring_suggestions_prompt():
    suggestions_prompt = " ".join(AI_pipeline.SUGGESTIONS_PROMPT.split())
    summary_prompt = " ".join(AI_pipeline.PROFESSIONAL_SUMMARY_PROMPT.split())
    assert "draft it once" in suggestions_prompt
    assert "minor wording revisions" in suggestions_prompt
    assert "minor wording revisions" in summary_prompt


def test_professional_summary_options_truncate_above_word_limits():
    provider_result = {
        "summaries": [
            {
                "tone": "executive",
                "text": " ".join(f"executive{i}" for i in range(125)),
            },
            {
                "tone": "technical",
                "text": " ".join(f"technical{i}" for i in range(121)),
            },
            {
                "tone": "concise",
                "text": " ".join(f"concise{i}" for i in range(65)),
            },
        ],
    }

    with patch.object(
        AI_pipeline,
        "request_ai",
        return_value=FakeProviderResponse(provider_result),
    ):
        result = AI_pipeline.generate_professional_summary_options({}, {})

    assert [len(option["text"].split()) for option in result["options"]] == [
        60, 60, 40,
    ]


@pytest.mark.parametrize("confirmed", [False, True])
@pytest.mark.parametrize("evidence_requirement", ["C programming", "Python"])
@pytest.mark.parametrize("addition_path", [
    "", "skills", "resume.skills", "skills.skill_name", "resume.skills.skill_name",
])
@pytest.mark.parametrize("addition_text", ["", "Add C programming to the skills list"])
def test_skill_additions_pass_without_evidence_classification(
    confirmed, addition_path, addition_text, evidence_requirement,
):
    requirements = {
        "requirements": [
            {
                "requirement": "Python",
                "importance": "required",
                "group": "Python",
                "group_logic": "all",
                "direct_search_terms": ["Python"],
                "related_search_terms": [],
            },
            {
                "requirement": "C programming",
                "importance": "desired",
                "group": "C programming",
                "group_logic": "all",
                "direct_search_terms": ["C programming", "C"],
                "related_search_terms": [],
            },
        ],
    }
    analysis = {
        "evidence": [
            {
                "requirement": "Python",
                "group": "Python",
                "group_logic": "all",
                "classification": "supported",
                "importance": "required",
                "evidence": [{
                    "resume_id": "projects[0].description",
                    "source": "resume",
                    "reason": "The project describes Python use.",
                }],
            },
            {
                "requirement": "C programming",
                "group": "C programming",
                "group_logic": "all",
                "classification": "unsupported",
                "importance": "desired",
                "evidence": [],
            },
        ],
        "missing_requirements": [{"requirement": "C programming"}],
    }
    provider_result = {
        "suggestions": [
            {
                "requirement": "Python",
                "resume_id": "",
                "suggestion": "Python",
                "reason": "The project description establishes Python use.",
                "action": "add",
                "section_name": "Skills",
                "new_entry": {"skill_name": "Python"},
            },
            {
                "requirement": "C programming",
                "resume_id": addition_path,
                "suggestion": addition_text,
                "reason": "The job requests C.",
                "action": "add",
                "section_name": "Skills",
                "new_entry": {"skill_name": "C programming"},
            },
        ],
        "removals": [],
        "improvements": [],
    }
    resume = {
        "resume": {"professional_summary": ""},
        "projects": [{"name": "Data cleanup", "description": "Used Python to clean data."}],
        "skills": [{"skill_name": "JavaScript"}],
    }

    with patch.object(
        AI_pipeline,
        "request_ai",
        return_value=FakeProviderResponse(provider_result),
    ):
        response = AI_pipeline.generate_tailoring_suggestions(
            resume,
            {"title": "Engineer", "company": "Example", "description": "Requires Python and C."},
            requirements,
            analysis,
            user_evidence=[{
                "requirement": evidence_requirement,
                "evidence": "I used C programming in coursework assignments.",
                "target_section": "Skills",
            }] if confirmed else None,
        )

    assert [(item["section_name"], item["new_entry"]["skill_name"])
            for item in response["suggestions"]] == [
                ("Skills", "Python"), ("Skills", "C programming"),
            ]
    added = response["suggestions"][1]
    assert added["suggestion"] == "C programming"
    assert added["resume_id"] == ""
    assert added["before"] == ""
    assert response["improvements"] == []


@pytest.mark.parametrize("automatic", [False, True])
def test_targeted_evidence_can_add_skill_and_fill_existing_education_description(automatic):
    requirements = {
        "requirements": [
            {
                "requirement": "C programming",
                "importance": "desired",
                "group": "C programming",
                "group_logic": "all",
                "direct_search_terms": ["C programming", "C"],
                "related_search_terms": [],
            },
            {
                "requirement": "Database coursework",
                "importance": "desired",
                "group": "Database coursework",
                "group_logic": "all",
                "direct_search_terms": ["database coursework"],
                "related_search_terms": [],
            },
        ],
    }
    resume = {
        "resume": {"professional_summary": ""},
        "skills": [{"skill_name": "Python"}],
        "education": [{
            "school": "Example University",
            "degree": "B.S.",
            "field_of_study": "Computer Science",
            "description": "",
            "start_date": "2022",
            "end_date": "2026",
        }],
    }
    evidence = [
        {
            "requirement": "C programming",
            "target_section": "Skills",
            "evidence": "Used C in a programming course project.",
            "source": "user",
        },
        {
            "requirement": "Database coursework",
            "target_section": "Education",
            "evidence": "Completed coursework in relational database design.",
            "source": "user",
        },
    ]
    empty_entry = {
        "entry_title": "",
        "company": "",
        "location": "",
        "start_date": "",
        "end_date": "",
        "description": "",
        "link": "",
        "skill_name": "",
        "school": "",
        "degree": "",
        "field_of_study": "",
    }
    provider_result = {
        "suggestions": [
            {
                "requirement": "C programming",
                "target_section": "Skills",
                "action": "add",
                "resume_id": "",
                "suggestion": "C programming",
                "reason": "The user confirmed using C in coursework.",
                "new_entry": {**empty_entry, "skill_name": "C programming"},
            },
            {
                "requirement": "Database coursework",
                "target_section": "Education",
                "action": "replace",
                "resume_id": "education[0].description",
                "suggestion": "Completed coursework in relational database design.",
                "reason": "Adds the coursework the user confirmed.",
                "new_entry": empty_entry,
            },
        ],
    }

    if automatic:
        for item in evidence:
            item["target_section"] = "Let AI decide"

    with patch.object(
        AI_pipeline,
        "request_ai",
        return_value=FakeProviderResponse(provider_result),
    ):
        response = AI_pipeline.generate_evidence_suggestions(
            resume,
            {"title": "Engineer", "company": "Example", "description": "Job"},
            requirements,
            evidence,
        )

    skills, education = response["suggestions"]
    assert skills["action"] == "add"
    assert skills["new_entry"] == {"skill_name": "C programming"}
    assert education["action"] == "replace"
    assert education["resume_id"] == "education[0].description"
    assert education["original_text"] == ""
    assert resume["education"][0]["school"] == "Example University"
