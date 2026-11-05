import json
from unittest.mock import patch

from backend.AI import AI_test


class FakeProviderResponse:
    status_code = 200

    def __init__(self, content):
        self.content = content

    def raise_for_status(self):
        pass

    def json(self):
        return {
            "choices": [
                {"message": {"content": json.dumps(self.content)}}
            ]
        }


def test_cached_requirements_skip_provider_call():
    cached = {"requirements": []}

    with patch.object(AI_test, "request_ai") as request_ai:
        result = AI_test.extract_requirements(
            {"description": "A job"},
            requirements=cached,
            request_id="request-1",
        )

    assert result is cached
    request_ai.assert_not_called()


def test_job_requirement_response_requires_explicit_group_logic():
    response = FakeProviderResponse({
        "requirements": [{
            "requirement": "Programming language experience",
            "importance": "required",
            "group": "Programming language experience",
            "group_logic": "any",
            "direct_search_terms": ["Python", "C++", "Java"],
            "related_search_terms": [],
        }],
    })

    parsed = AI_test.parse_ai_response(response, stage="job_requirements")

    assert parsed["requirements"][0]["group_logic"] == "any"


def test_requirement_extraction_prompt_specifies_boolean_semantics():
    prompt = " ".join(AI_test.prompt.split())
    assert (
        'With "all", every requirement row in the group is required; with "any", '
        "at least one requirement row in the group is sufficient."
    ) in prompt
    assert 'For an "all" requirement row, normally provide exactly one direct_search_term' in prompt
    assert "Put synonyms, examples, and alternate wording in related_search_terms" in prompt
    assert "Use multiple direct_search_terms mainly for a single \"any\"" in prompt
    assert (
        "If one sentence combines mandatory conditions with alternatives, split it"
        in prompt
    )
    assert 'Never put OR options in an "all" row.' in prompt
    assert "Master's in Computer Science or a related technical field" in prompt


def test_requirement_extraction_preserves_boolean_logic_examples():
    cases = [
        {
            "input": [{
                "requirement": "Python or Java",
                "group": "programming_languages",
                "group_logic": "any",
                "direct_search_terms": ["Python", "Java"],
                "related_search_terms": [],
            }],
            "expected": [
                ("programming_languages", "any", ["Python", "Java"], []),
            ],
        },
        {
            "input": [{
                "requirement": "Bachelor's degree or equivalent practical experience",
                "group": "education_or_equivalent_experience",
                "group_logic": "any",
                "direct_search_terms": [
                    "Bachelor's degree",
                    "equivalent practical experience",
                ],
                "related_search_terms": [],
            }],
            "expected": [
                (
                    "education_or_equivalent_experience",
                    "any",
                    ["Bachelor's degree", "equivalent practical experience"],
                    [],
                ),
            ],
        },
        {
            "input": [{
                "requirement": "Experience in one or more of Web, Linux, or ML",
                "group": "technical_domain_experience",
                "group_logic": "any",
                "direct_search_terms": ["Web", "Linux", "ML"],
                "related_search_terms": [],
            }],
            "expected": [
                ("technical_domain_experience", "any", ["Web", "Linux", "ML"], []),
            ],
        },
        {
            "input": [
                {
                    "requirement": "1 year of software development experience",
                    "group": "software_development_experience",
                    "group_logic": "all",
                    "direct_search_terms": ["1 year of software development experience"],
                    "related_search_terms": ["software development experience"],
                },
                {
                    "requirement": "Software development experience in an industry setting",
                    "group": "software_development_experience",
                    "group_logic": "all",
                    "direct_search_terms": ["software development in an industry setting"],
                    "related_search_terms": ["industry software development"],
                },
                {
                    "requirement": (
                        "Experience with at least one programming language"
                    ),
                    "group": "programming_language_experience",
                    "group_logic": "any",
                    "direct_search_terms": [
                        "Python", "C", "C++", "Java", "JavaScript",
                    ],
                    "related_search_terms": [],
                },
            ],
            "expected": [
                (
                    "software_development_experience",
                    "all",
                    ["1 year of software development experience"],
                    ["software development experience"],
                ),
                (
                    "software_development_experience",
                    "all",
                    ["software development in an industry setting"],
                    ["industry software development"],
                ),
                (
                    "programming_language_experience",
                    "any",
                    ["Python", "C", "C++", "Java", "JavaScript"],
                    [],
                ),
            ],
        },
        {
            "input": [{
                "requirement": "Master's in Computer Science or related field",
                "group": "masters_degree",
                "group_logic": "any",
                "direct_search_terms": [
                    "Master's degree in Computer Science",
                    "Master's degree in a related technical field",
                ],
                "related_search_terms": [],
            }],
            "expected": [
                (
                    "masters_degree",
                    "any",
                    [
                        "Master's degree in Computer Science",
                        "Master's degree in a related technical field",
                    ],
                    [],
                ),
            ],
        },
        {
            "input": [
                {
                    "requirement": "Backend development experience",
                    "group": "backend_production_experience",
                    "group_logic": "all",
                    "direct_search_terms": ["backend development"],
                    "related_search_terms": ["backend software development"],
                },
                {
                    "requirement": "Production systems experience",
                    "group": "backend_production_experience",
                    "group_logic": "all",
                    "direct_search_terms": ["production systems"],
                    "related_search_terms": ["production environment"],
                },
            ],
            "expected": [
                (
                    "backend_production_experience",
                    "all",
                    ["backend development"],
                    ["backend software development"],
                ),
                (
                    "backend_production_experience",
                    "all",
                    ["production systems"],
                    ["production environment"],
                ),
            ],
        },
        {
            "input": [
                {
                    "requirement": "3 years of backend experience",
                    "group": "backend_experience",
                    "group_logic": "all",
                    "direct_search_terms": ["3 years of backend experience"],
                    "related_search_terms": ["backend development experience"],
                },
                {
                    "requirement": "Python or Java",
                    "group": "programming_language",
                    "group_logic": "any",
                    "direct_search_terms": ["Python", "Java"],
                    "related_search_terms": [],
                },
            ],
            "expected": [
                (
                    "backend_experience",
                    "all",
                    ["3 years of backend experience"],
                    ["backend development experience"],
                ),
                ("programming_language", "any", ["Python", "Java"], []),
            ],
        },
    ]

    for case in cases:
        payload = {
            "requirements": [
                {
                    **item,
                    "importance": "required",
                }
                for item in case["input"]
            ],
        }
        parsed = AI_test.parse_ai_response(
            FakeProviderResponse(payload),
            stage="job_requirements",
        )

        assert [
            (
                item["group"],
                item["group_logic"],
                item["direct_search_terms"],
                item["related_search_terms"],
            )
            for item in parsed["requirements"]
        ] == case["expected"]
        assert all(
            len(item["direct_search_terms"]) == 1
            for item in parsed["requirements"]
            if item["group_logic"] == "all"
        )
        assert all(
            item["importance"] == "required"
            for item in parsed["requirements"]
        )


def test_restore_resume_text_accepts_unprefixed_professional_summary_path():
    response = {
        "suggestions": [{
            "requirement": "Professional summary",
            "resume_id": "professional_summary",
            "suggestion": "A clearer summary.",
            "reason": "Improves clarity.",
        }],
        "removals": [],
        "improvements": [],
        "evidence": [],
    }
    resume = {
        "resume": {"professional_summary": "Original summary."},
        "skills": [],
    }

    restored = AI_test.restore_combined_resume_text(response, resume)

    assert restored["suggestions"][0]["resume_id"] == "resume.professional_summary"
    assert restored["suggestions"][0]["relevant_text"] == "Original summary."


def test_local_matching_handles_aliases_fuzzy_terms_and_categories():
    resume = {
        "skills": [
            {"skill_name": "JavaScript"},
            {"skill_name": "Pythn"},
            {"skill_name": "PostgreSQL"},
        ]
    }
    requirements = {
        "requirements": [
            {
                "requirement": "JavaScript",
                "importance": "required",
                "direct_search_terms": ["JS"],
                "related_search_terms": [],
            },
            {
                "requirement": "Python",
                "importance": "desired",
                "direct_search_terms": ["Python"],
                "related_search_terms": [],
            },
            {
                "requirement": "Database",
                "importance": "desired",
                "direct_search_terms": ["database"],
                "related_search_terms": ["SQL"],
            },
        ]
    }
    user_evidence = [{
        "requirement": "Database",
        "evidence": "Used relational databases in a class project.",
        "target_section": "Projects",
        "source": "user",
    }]

    with patch.object(AI_test, "request_ai") as request_ai:
        analysis = AI_test.analyze_resume_requirements(
            resume, requirements, user_evidence=user_evidence
        )

    request_ai.assert_not_called()
    javascript, python, database = analysis["evidence"]
    assert javascript["classification"] == "supported"
    assert javascript["evidence"][0]["resume_id"] == "skills[0].skill_name"
    assert python["classification"] == "partial"
    assert any(
        item["resume_id"] == "skills[1].skill_name"
        and "fuzzy match" in item["reason"]
        for item in python["evidence"]
    )
    assert database["classification"] == "partial"
    assert {item["source"] for item in database["evidence"]} == {"resume", "user"}


def test_different_programming_languages_do_not_match_specific_language_requirements():
    resume = {
        "resume": {
            "professional_summary": (
                "Computer Science student who has used Python, SQL, and Git "
                "in class projects."
            ),
        },
        "skills": [
            {"skill_name": "Python"},
            {"skill_name": "JavaScript"},
        ],
    }
    requirements = {
        "requirements": [
            {
                "requirement": "C++",
                "importance": "desired",
                "direct_search_terms": ["C++"],
                "related_search_terms": [],
            },
            {
                "requirement": "Java",
                "importance": "desired",
                "direct_search_terms": ["Java"],
                "related_search_terms": [],
            },
            {
                "requirement": "JavaScript",
                "importance": "desired",
                "direct_search_terms": ["JavaScript"],
                "related_search_terms": [],
            },
            {
                "requirement": "Programming languages",
                "importance": "desired",
                "direct_search_terms": ["programming languages"],
                "related_search_terms": [],
            },
        ],
    }

    analysis = AI_test.analyze_resume_requirements(resume, requirements)
    classifications = {
        item["requirement"]: item["classification"]
        for item in analysis["evidence"]
    }

    assert classifications == {
        "C++": "unsupported",
        "Java": "unsupported",
        "JavaScript": "supported",
        "Programming languages": "partial",
    }


def test_any_requirement_group_counts_once_when_one_option_is_supported():
    resume = {
        "skills": [{"skill_name": "Python"}],
    }
    requirements = {
        "requirements": [
            {
                "requirement": language,
                "importance": "required",
                "group": "Programming language experience",
                "group_logic": "any",
                "direct_search_terms": [language],
                "related_search_terms": [],
            }
            for language in ("Python", "C", "C++", "Java", "JavaScript")
        ],
    }

    analysis = AI_test.analyze_resume_requirements(resume, requirements)
    response = AI_test.build_frontend_response(
        {"suggestions": [], "improvements": [], "removals": []},
        analysis,
    )

    assert analysis["ATS_score"] == 100
    assert analysis["requirements_met"] == [
        {"requirement": "Programming language experience"}
    ]
    assert analysis["requirements_missing"] == 0
    assert response["ATS_score"] == 100
    assert response["requirements_met"] == [
        {"requirement": "Programming language experience"}
    ]
    assert response["missing_requirements"] == []


def test_suggestions_and_improvements_are_preserved_for_satisfied_any_group():
    analysis = {
        "evidence": [
            {
                "requirement": language,
                "group": "Programming language experience",
                "group_logic": "any",
                "group_classification": "supported",
                "importance": "required",
                "classification": "supported" if language == "Python" else "unsupported",
            }
            for language in ("Python", "C++")
        ],
    }
    stage_3 = {
        "suggestions": [{
            "requirement": "C++",
            "suggestion": "Added C++ experience.",
            "reason": "The requirement is missing.",
            "resume_id": "skills[0].skill_name",
            "relevant_text": "Python",
        }],
        "improvements": [{
            "requirement": "Programming language experience",
            "improvement": "Have you used C++?",
            "reason": "Alternative option.",
            "resume_id": None,
        }],
        "removals": [],
    }

    response = AI_test.build_frontend_response(stage_3, analysis)

    assert [item["requirement"] for item in response["suggestions"]] == ["C++"]
    assert [item["requirement"] for item in response["improvements"]] == [
        "Programming language experience",
    ]


def test_bachelors_degree_does_not_match_masters_degree_requirement():
    resume = {
        "education": [{
            "degree": "Bachelor of Science",
            "field_of_study": "Computer Science",
        }],
        "work_experience": [{
            "description": "Developed software projects using Python and SQL.",
        }],
    }
    requirements = {
        "requirements": [
            {
                "requirement": "Bachelor's degree",
                "importance": "required",
                "direct_search_terms": ["Bachelor's degree"],
                "related_search_terms": [],
            },
            {
                "requirement": "Master's degree",
                "importance": "desired",
                "direct_search_terms": ["Master's degree"],
                "related_search_terms": ["graduate degree"],
            },
        ]
    }

    analysis = AI_test.analyze_resume_requirements(resume, requirements)

    classifications = {
        item["requirement"]: item["classification"]
        for item in analysis["evidence"]
    }
    assert classifications == {
        "Bachelor's degree": "supported",
        "Master's degree": "unsupported",
    }


def test_broad_requirements_use_resume_context_and_keep_partial_score_conservative():
    resume = {
        "resume": {
            "professional_summary": (
                "A computer science student who builds and documents software "
                "projects, communicates with teammates, and applies technical "
                "skills to practical problems. The student works carefully, "
                "learns new tools, and explains project decisions clearly."
            ),
        },
        "work_experience": [{
            "job_title": "Software Intern",
            "description": (
                "Built a REST API with Python, Flask, and SQLite. Implemented "
                "CRUD endpoints, input validation, and HTTP error handling. "
                "Used Git collaboration and wrote README documentation."
            ),
        }],
        "projects": [{
            "name": "Operations dashboard",
            "description": (
                "Built a dashboard consuming an API with filters. Wrote Python "
                "scripts and SQL queries, performed data validation, "
                "documentation, and collaboration."
            ),
        }],
    }
    requirements = {
        "requirements": [
            ("Python", ["Python"], []),
            (
                "software development experience",
                ["software development experience"],
                ["software development"],
            ),
            (
                "developing software systems",
                ["developing software systems"],
                ["software systems"],
            ),
            (
                "web application development",
                ["web application development"],
                ["web application"],
            ),
            (
                "software design and development",
                ["software design and development"],
                ["software design"],
            ),
            ("networking", ["networking"], ["network protocols"]),
            (
                "distributed systems",
                ["distributed systems"],
                ["distributed computing"],
            ),
            (
                "English proficiency",
                ["English proficiency"],
                ["English language"],
            ),
            ("project management", ["project management"], ["scrum"]),
        ]
    }
    requirements["requirements"] = [
        {
            "requirement": name,
            "importance": "required",
            "direct_search_terms": direct,
            "related_search_terms": related,
        }
        for name, direct, related in requirements["requirements"]
    ]

    analysis = AI_test.analyze_resume_requirements(resume, requirements)
    classifications = {
        item["requirement"]: item["classification"]
        for item in analysis["evidence"]
    }

    assert classifications == {
        "Python": "supported",
        "software development experience": "partial",
        "developing software systems": "partial",
        "web application development": "partial",
        "software design and development": "partial",
        "networking": "partial",
        "distributed systems": "unsupported",
        "English proficiency": "supported",
        "project management": "unsupported",
    }
    assert analysis["ATS_score"] == 50
    assert analysis["requirements_missing"] == 2
    assert "English proficiency" in {
        item["requirement"] for item in analysis["requirements_met"]
    }
    python_evidence = next(
        item for item in analysis["evidence"] if item["requirement"] == "Python"
    )["evidence"]
    assert {item["resume_id"].split("[", 1)[0] for item in python_evidence} == {
        "work_experience",
        "projects",
    }
    software_evidence = next(
        item for item in analysis["evidence"]
        if item["requirement"] == "software development experience"
    )["evidence"]
    assert all(not item["resume_id"].startswith("skills[") for item in software_evidence)
    web_evidence = next(
        item for item in analysis["evidence"]
        if item["requirement"] == "web application development"
    )["evidence"]
    assert [item["resume_id"] for item in web_evidence] == [
        "projects[0].description"
    ]
    networking_evidence = next(
        item for item in analysis["evidence"] if item["requirement"] == "networking"
    )["evidence"]
    assert networking_evidence[0]["resume_id"] == "work_experience[0].description"
    english_evidence = next(
        item for item in analysis["evidence"]
        if item["requirement"] == "English proficiency"
    )["evidence"]
    assert "ATS-only inference" in english_evidence[0]["reason"]


def test_suggestion_prompt_includes_unapplied_suggestions_and_user_evidence():
    resume = {"skills": [{"skill_name": "Python"}]}
    requirements = {"requirements": []}
    analysis = {
        "requirements": requirements,
        "evidence": [{
            "requirement": "AI productivity tools experience",
            "importance": "required",
            "classification": "partial",
            "evidence": [{
                "resume_id": "work_experience[0].description",
                "source": "resume",
                "reason": "Related search-term match.",
            }],
        }],
        "missing_requirements": [],
    }
    unapplied = [{
        "section_name": "Projects",
        "original_text": "Built a class project.",
        "suggested_change": "Built a Python class project.",
        "reasoning": "Aligns wording with the requirement.",
    }]
    user_evidence = [{
        "requirement": "Python",
        "evidence": "Used Python in a class project.",
        "target_section": "Projects",
        "source": "user",
    }]
    response = FakeProviderResponse({
        "suggestions": [],
        "removals": [],
        "improvements": [],
    })

    with patch.object(AI_test, "request_ai", return_value=response) as request_ai:
        AI_test.generate_tailoring_suggestions(
            resume,
            {"title": "Developer", "company": "Example", "description": "Job"},
            requirements,
            analysis,
            user_evidence=user_evidence,
            unapplied_suggestions=unapplied,
            candidate_context="User marked Python as found.",
        )

    prompt = request_ai.call_args.args[0]
    assert "PREVIOUSLY UNAPPLIED SUGGESTIONS" in prompt
    assert "ATS-only English-proficiency heuristic" in AI_test.SUGGESTIONS_PROMPT
    assert "User marked Python as found." in prompt
    assert "Used Python in a class project." in prompt
    assert "EVIDENCE CLASSIFICATIONS ARE AUTHORITATIVE" in prompt
    assert "Never rewrite it as a definite claim" in prompt
    assert "AI productivity-tool experience or project-management responsibility" in prompt


def test_evidence_suggestions_only_generate_requested_new_resume_edits():
    resume = {
        "resume": {"professional_summary": "Computer Science student."},
        "work_experience": [{
            "job_title": "Research Assistant",
            "description": "Assisted with research data collection.",
        }],
        "projects": [],
    }
    requirements = {
        "requirements": [{
            "requirement": "Machine learning",
            "importance": "desired",
            "direct_search_terms": ["Machine learning"],
            "related_search_terms": [],
        }]
    }
    user_evidence = [
        {
            "requirement": "Machine learning",
            "evidence": "Used scikit-learn in a class project to classify images.",
            "target_section": "Projects",
            "source": "user",
        },
        {
            "requirement": "Machine learning",
            "evidence": "Used scikit-learn in a class project to classify images.",
            "target_section": "Professional Summary",
            "source": "user",
        },
        {
            "requirement": "Machine learning",
            "evidence": (
                "As a research assistant, used scikit-learn to evaluate "
                "classification results."
            ),
            "target_section": "Work Experience",
            "source": "user",
        },
    ]
    response = FakeProviderResponse({
        "suggestions": [
            {
                "requirement": "Machine learning",
                "target_section": "Projects",
                "action": "add",
                "resume_id": "",
                "suggestion": "Classified images using scikit-learn.",
                "reason": "Adds the user-provided project experience.",
                "new_entry": {
                    "entry_title": "Image classification project",
                    "company": "",
                    "location": "",
                    "start_date": "",
                    "end_date": "",
                    "description": "Classified images using scikit-learn.",
                    "link": "",
                },
            },
            {
                "requirement": "Machine learning",
                "target_section": "Professional Summary",
                "action": "replace",
                "resume_id": "resume.professional_summary",
                "suggestion": (
                    "Computer Science student with class-project experience "
                    "using scikit-learn for image classification."
                ),
                "reason": "Adds the user-provided experience to the summary.",
                "new_entry": {
                    "entry_title": "",
                    "company": "",
                    "location": "",
                    "start_date": "",
                    "end_date": "",
                    "description": "",
                    "link": "",
                },
            },
            {
                "requirement": "Machine learning",
                "target_section": "Work Experience",
                "action": "replace",
                "resume_id": "work_experience[0].description",
                "suggestion": (
                    "Collected research data and used scikit-learn to evaluate "
                    "classification results."
                ),
                "reason": "Improves a related existing experience with the user's evidence.",
                "new_entry": {
                    "entry_title": "",
                    "company": "",
                    "location": "",
                    "start_date": "",
                    "end_date": "",
                    "description": "",
                    "link": "",
                },
            },
        ]
    })

    with patch.object(
        AI_test, "request_ai", return_value=response
    ) as request_ai:
        result = AI_test.generate_evidence_suggestions(
            resume,
            {"title": "ML Intern", "company": "Example", "description": "Job"},
            requirements,
            user_evidence,
        )

    prompt = request_ai.call_args.args[0]
    assert "Do not regenerate, review, or return any existing suggestions." in prompt
    assert "CURRENT RESUME" in prompt
    assert '"suggestion" must never be empty or whitespace-only' in prompt
    assert '"suggestion" and' in prompt
    assert "new_entry.description" in prompt
    assert [item["section_name"] for item in result["suggestions"]] == [
        "Projects",
        "Professional Summary",
        "Work Experience",
    ]
    assert result["suggestions"][0]["new_entry"] == {
        "name": "Image classification project",
        "description": "Classified images using scikit-learn.",
        "link": "",
    }
    assert result["suggestions"][1]["original_text"] == "Computer Science student."
    assert result["suggestions"][2]["new_entry"] is None
    assert result["suggestions"][2]["action"] == "replace"
    assert result["suggestions"][2]["resume_id"] == "work_experience[0].description"
    assert result["suggestions"][2]["original_text"] == (
        "Assisted with research data collection."
    )


def test_evidence_suggestion_parser_wraps_top_level_suggestion_array():
    suggestion = {
        "requirement": "Python",
        "target_section": "Projects",
        "action": "add",
        "resume_id": "",
        "suggestion": "Built a Python project.",
        "reason": "Adds the user-provided project experience.",
        "new_entry": {
            "entry_title": "Python project",
            "company": "",
            "location": "",
            "start_date": "",
            "end_date": "",
            "description": "Built a Python project.",
            "link": "",
        },
    }
    response = FakeProviderResponse([suggestion])

    parsed = AI_test.parse_ai_response(
        response,
        request_id="request-array",
        stage="evidence_suggestion",
    )

    assert parsed == {"suggestions": [suggestion]}


def test_evidence_suggestions_normalize_minimal_project_entry_response():
    resume = {"resume": {"professional_summary": "Student."}, "projects": []}
    requirements = {
        "requirements": [{
            "requirement": "AI productivity tools",
            "importance": "required",
            "direct_search_terms": ["AI productivity tools"],
            "related_search_terms": [],
        }]
    }
    user_evidence = [{
        "requirement": "AI productivity tools",
        "evidence": (
            "Used ChatGPT with two others on an AI racing project. "
            "We used PPO and reinforcement learning to teach AI to race a car."
        ),
        "target_section": "Projects",
        "source": "user",
    }]
    response = FakeProviderResponse({
        "suggestions": [{
            "requirement": "AI productivity tools",
            "target_section": "Projects",
            "suggestion": "",
            "reasoning": "",
            "new_entry": {
                "name": "AI car-racing project",
                "description": (
                    "Collaborated with two teammates on an AI car-racing "
                    "project, using ChatGPT and PPO-based reinforcement learning."
                ),
            },
        }]
    })

    with patch.object(
        AI_test, "request_ai", return_value=response
    ):
        result = AI_test.generate_evidence_suggestions(
            resume,
            {"title": "Software Developer", "company": "Example", "description": "Job"},
            requirements,
            user_evidence,
        )

    suggestion = result["suggestions"][0]
    assert suggestion["action"] == "add"
    assert suggestion["resume_id"] == ""
    assert suggestion["new_entry"] == {
        "name": "AI car-racing project",
        "description": (
            "Collaborated with two teammates on an AI car-racing project, "
            "using ChatGPT and PPO-based reinforcement learning."
        ),
        "link": "",
    }
    assert suggestion["suggestion"] == suggestion["new_entry"]["description"]
    assert suggestion["reason"]


def test_suggestion_deduplication_drops_noops_and_repeated_originals():
    result = AI_test.deduplicate_suggestions({
        "suggestions": [
            {
                "relevant_text": "Built a project",
                "suggestion": "Built a project",
                "reason": "No change needed.",
            },
            {
                "relevant_text": "Built a project",
                "suggestion": "Built a Python project",
                "reason": "Adds relevant detail.",
            },
            {
                "relevant_text": "  BUILT   A project ",
                "suggestion": "Created a Python project",
                "reason": "Alternative wording.",
            },
        ]
    })

    assert len(result["suggestions"]) == 1
    assert result["suggestions"][0]["suggestion"] == "Built a Python project"
