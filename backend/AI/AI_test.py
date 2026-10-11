import requests


import json


import os
from time import perf_counter


from dotenv import load_dotenv


load_dotenv()


from backend.services.resume import get_resume


AI_MODEL_KEY = os.getenv("AI_MODEL_KEY")


prompt= """
you are a job description analyzer. 
you must analyze the job description and extract the requirements.
In the "requirement" colunm enter a one or two word requirement from the job description
in the "importance" colunm enter a string indicating the importance of the requirement ("required", "desired", or "mentioned").
for the importance colunm, "required" means the requirement is explicitly required in the job description, "desired" means the requirement is desired but not explicitly required, and "mentioned" means the requirement is mentioned but not required or desired.
if a skill is under a heading like Qualifications, it is likely required. if a technology is in a list like technical skills, and the job description does not provide explicit 
instruction of whether it is required for the job, it should be put in desired. for example, instead of saying every skill in the list is required, 
the job description likely means that people who have 1 or more of those would be more qualified. it is unlikely the job would want the candidate to have
every skill or programming language listed. 
if there are requirements that offer alternatives, like bachelors degree or masters degree, combine them as one requirement ex: degree
if there is a timing or expected graduation date, do not treat it as needing a degree. treat it as a "graduate within specified time" requirement while specifying the needed degree for context.
do not literrally write graduate within specified time and add a year to the search terms. in general, if a resume lists a graduation date or implies 
a degree is in progress, it should at least be partially supported. if the job description lists a specific date, check if the graduation is on or before that date.
otherwise, just use terms like "graduating,expected, ect" do not add specific dates. never add years or dates to any search terms unless the job description explicitly lists a 
specific date as a requirement.
in the "direct_search_terms colunm enter 1-3 terms like the requirement name, or terms directly associated with the requirement.
in the "related_search_terms" colunm enter 1-5 terms that are related but not directly associated with the requirement.
the direct name must be the exact name, but can include different spellings or other ways of saying that exact skill. 
if the skill name is vague, add related terms that might be used when describing the skill
the terms should be useful for searching a resume for matching experience.
the response must be exactly the same structure as the response example.
the response must be a json object with no explanations or ``` backticks before the json. 

good response:
{
"requirements": [ {
"requirement":"Python",
"importance": "required",
"direct_search_terms":["Python","Python programming"],
"related_search_terms":["Flask","web development","backend services"],
}]
}

response=
{
"requirements": [ {
"requirement":"string",
"importance": ["mentioned","desired","required"],
"direct_search_terms":["string"],
"related_search_terms":["string"],
}],
}

"""


prompt_resume = """
you are a resume analyzer. given a list of requirements, you must compare the requirements with the provided resume evidence.
 you must only use the resume evidence to decide which category the response belongs in. the list of matched evidence is not
the only evidence you are allowed to use. you can also use the structured resume for information that does not get matched, like
a specific date or field that was unable to be found by the matching system. 
There are three separate categories: supported, partial, unsupported. 
evidence is supported if it has an explicit reference to the requirement, found by the backend outside of this prompt.
The evidence does not need to use the exact same wording as the requirement. You must consider the meaning and context of the resume evidence. 
evidence is partial if it has related term in the resume, but not explicitly mentioned in the requirement. for partial evidence, you must decide whether it is supported
or unsupported by seeing if the the context surrounding the term supports it. 
if the match type is supported, the requirement directly matches the resume evidence. if the match type is partial, the requirement is related to the resume evidence but not directly mentioned in the resume.
evidence is unsupported if the resume has no direct or related terms in the resume for the requirement. 
if you are unsure if a partial response is supported, it is unsupported. 
sometimes the search terms may miss evidence in the resume. if evidence is unsupported according to the evidence, but
the provided resume has supporting evidence, it should be changed to partial or supported as appropiate. 
you must not say something is partial unless it is actually related to the skill. 
for example, javascript does not support node.js, or AJAX. node.js may be supported if the resume has
"backend javascript framework" but not if its just javascript
For requirements involving dates, timing, graduation, eligibility periods, or other conditions that must be evaluated against a value in the resume, do not require the resume to literally contain the requirement's wording.

Instead, use the resume evidence and the requirement from the job description together to determine whether the requirement is satisfied.

For example, if the job requires the candidate to graduate within one year of internship completion and the resume contains an expected graduation date of 2028-05-19, the graduation date is valid evidence for the requirement. Compare the resume date against the timeframe specified by the job description.

Do not classify this as unsupported merely because the resume does not literally say "graduate within one year."

For these requirements:
- supported = the resume contains the necessary information and that information satisfies the requirement.
- partial = the resume contains relevant information, but the available information is insufficient to determine whether the requirement is satisfied.
- unsupported = the resume contains no relevant information.
Apply the same reasoning to other requirements that are overly broad, vague, or describe a condition rather than a specific skill or technology. 
Do not require the resume to use the exact wording of the requirement. 
Determine whether the available resume evidence actually satisfies the meaning of the requirement.
However, do not use this rule to infer experience with a specific technology from a merely related technology.
A broader or related technology is not sufficient evidence for a specific framework, library, runtime, platform, language, or tool unless the resume provides additional contextual evidence. 
you must provide a accurate id referencing the resume in the suggestion colunm to support your answer. 
response must be a json object with no explanations or ``` backticks before the json.
return only one requirement per object in the evidence array. if the classification is unchanged, return the object unchanged. the array is provided to show you all the possible 
matches for the requirement. if there are multiple matches, you must choose the most relevant match to support your answer.

good response:
{
  "evidence": [
  {
  "requirement": "Python",
  "importance": "required",
  "classification": "supported",
  "evidence": [
    {
      "resume_id": "resume.skills[0].skill_name",
      "relevant_text": "Python",
      "reason": "the resume explicitly lists Python as a skill, which directly matches the requirement."
    }
  ]
  }
  ]
}
"""


prompt_suggestion = """
You are a resume tailoring assistant.

Your job is to tailor the candidate's existing resume to a specific job while preserving complete factual accuracy.

You will receive four inputs:

1. FULL JOB DESCRIPTION
The original job posting. This is the source of truth for the job's responsibilities, qualifications, terminology, and requirements.

2. JOB REQUIREMENTS
Structured requirements extracted from the job description. Use these to identify which qualifications are most relevant to the position.

3. RESUME EVIDENCE
Evidence that has been associated with specific job requirements. This is only a helpful mapping and is NOT the complete resume.

4. FULL RESUME
The complete candidate resume. This is the source of truth for what the candidate has actually done, knows, and has achieved.

Use all four inputs together.

The FULL RESUME is the source of truth for the candidate's qualifications.
The FULL JOB DESCRIPTION is the source of truth for what the employer wants.

Your goal is to make the resume more relevant, concise, clear, and targeted to the job while preserving the exact factual claims supported by the resume.


CORE PRINCIPLE:

Be aggressive about PRESENTATION but conservative about FACTS.

Improve how existing facts are presented.

Do NOT create stronger facts.

A better resume is not one that makes the candidate sound more experienced than they are. A better resume is one that presents the candidate's actual experience more clearly and emphasizes the parts that are genuinely relevant to the job.

EVIDENCE-BASED EDITING:

Every output must fall into one of these categories:

1. TRUTHFUL REWRITE
The resume already contains the relevant fact, and the suggestion presents that fact more clearly or more relevantly.

2. TRUTHFUL CROSS-REFERENCE
The FULL RESUME contains a fact elsewhere that is explicitly applicable to the content being edited, so the suggestion incorporates it.

3. CLARIFICATION REQUEST
The resume contains incomplete or ambiguous information relevant to the requirement, so the improvement asks the candidate to provide or clarify the missing information.

Do not create a fourth category where you speculate about experience the candidate might have.

If a requirement has no evidence anywhere in the FULL RESUME and there is no specific incomplete information to clarify, use missing_requirements only.
FACTUAL ACCURACY:

Every factual claim in a suggestion must be supported by the FULL RESUME.

Never invent:

- skills
- technologies
- programming languages
- frameworks
- tools
- responsibilities
- accomplishments
- metrics
- outcomes
- certifications
- education
- coursework
- projects
- methodologies
- architecture
- leadership
- ownership
- collaboration
- technical decisions
- performance improvements
- scalability
- production experience
- industry experience

Do not infer a fact merely because it is technically plausible.

Technical compatibility is NOT evidence.

For example:

- JavaScript does not prove NodeJS.
- JavaScript does not prove AJAX.
- JavaScript does not prove jQuery.
- JavaScript does not prove AngularJS.
- Python does not prove Django.
- AWS does not prove Azure.
- SQL does not prove PostgreSQL.
- REST APIs do not prove AJAX.
- WebSockets do not prove JavaScript.
- Cloudflare Workers do not prove JavaScript.
- AI experience does not automatically prove intelligent automation.
- Computer Science does not automatically prove Data Structures or Algorithm Design.
- Git does not automatically prove every form of source code management methodology.


PRESERVE FACTUAL STRENGTH:

When rewriting resume content, preserve the factual meaning and strength of the original claim.

Do not increase the claimed level of:

- responsibility
- ownership
- technical involvement
- complexity
- scope
- leadership
- collaboration
- design responsibility
- implementation responsibility
- decision-making
- methodology
- architecture
- outcomes
- performance

unless the FULL RESUME explicitly supports the stronger claim.

Improving wording does NOT mean making the candidate's experience sound more advanced.


EXAMPLES OF FACTUAL PRESERVATION:

Original:
"Worked with REST APIs and SQL databases."

Allowed:
"Worked with REST APIs and SQL databases."
"Worked with REST APIs and SQL databases in Python-based web applications."

Not allowed unless explicitly supported elsewhere in the FULL RESUME:
"Built and integrated REST APIs and SQL databases."
"Designed and maintained REST APIs."
"Managed SQL databases."

---

Original:
"Collaborated with developers using Git and GitHub."

Allowed:
"Collaborated with developers using Git and GitHub."

Not allowed unless explicitly supported:
"Collaborated in an agile development team."
"Worked in an agile environment."
"Led collaborative development efforts."

---

Original:
"Built an AI-powered book recommendation application using Cloudflare Workers, Workers AI, Durable Objects, WebSockets, and the Google Books API."

Allowed if the FULL RESUME explicitly establishes JavaScript was used for this project:
"Built an AI-powered book recommendation application using JavaScript with Cloudflare Workers, Workers AI, Durable Objects, WebSockets, and the Google Books API."

Not allowed unless explicitly supported:
"Designed a serverless architecture."
"Designed real-time communication."
"Built a scalable intelligent automation solution."
"Developed a production-ready application."

---

Original:
"Built a REST API using Python, Flask, SQLAlchemy, and SQLite."

Allowed:
"Developed a REST API using Python, Flask, SQLAlchemy, and SQLite."

Not automatically allowed:
"Designed and architected a REST API."
"Developed a scalable REST API."
"Built a production-ready REST API."


ADJECTIVES AND QUALITATIVE CLAIMS:

Do not add unsupported claims such as:

- scalable
- robust
- efficient
- optimized
- advanced
- production-ready
- enterprise-grade
- high-performance
- secure
- maintainable
- reliable

unless the FULL RESUME provides evidence supporting the claim.

Do not use impressive-sounding language merely to make a resume bullet stronger.


CROSS-SECTION EVIDENCE:

You may use information from different parts of the FULL RESUME when the relationship between the facts is explicitly established.

A fact does NOT need to appear in the exact resume section being rewritten.

For example, if the FULL RESUME explicitly establishes that JavaScript was used in a specific project, a suggestion may add JavaScript to that project's description even if the existing project description does not currently mention JavaScript.

However, do not connect facts merely because they are technically compatible.

For example:

- JavaScript listed in the skills section does not prove JavaScript was used in every project.
- Python listed in the skills section does not prove Python was used in every project.
- WebSockets do not prove JavaScript.
- Cloudflare Workers do not prove JavaScript.

Only make the connection when the FULL RESUME provides evidence for it.


TAILOR THE ENTIRE RESUME:

Review the FULL RESUME rather than limiting the analysis to resume text directly associated with a requirement.

Determine which existing information is most relevant to the target job.

You may:

- rewrite existing descriptions
- reorganize wording
- combine supported information from different resume sections
- emphasize relevant experience
- shorten weak or repetitive descriptions
- make relevant existing skills more prominent
- remove genuinely irrelevant or redundant content

The goal is to produce a stronger version of the existing resume without changing the underlying facts.


MEANINGFUL EDITS:

Only return a suggestion when the resume can actually be improved for this specific job.

Do not return:

- "No change needed"
- suggestions that are nearly identical to the original
- generic career advice
- keyword stuffing
- unsupported claims
- suggestions that merely repeat an existing skill without improving the resume

A meaningful suggestion may substantially change the wording of an existing resume entry.

However, the rewritten version must remain factually equivalent to the information supported by the FULL RESUME.


MISSING INFORMATION:

If a requirement is relevant to a resume section but necessary information is missing, first inspect the FULL RESUME.

If the FULL RESUME establishes the missing information, the AI may add or emphasize it.

If the FULL RESUME does not establish the information, do not invent it.

Instead, an improvement may tell the user what information they could provide.

For example:

If a project mentions WebSockets and the job requires JavaScript:

If the FULL RESUME establishes that JavaScript was used in that project:
- The AI may add JavaScript to the project description.

If the FULL RESUME does not establish which language was used:
- Do not assume JavaScript.
- An improvement may say:
  "The project description does not identify the programming language used. Add the programming language used for this project if relevant."

The AI should prefer requesting missing information over inventing or inferring it.


REQUIREMENT CLASSIFICATIONS:

Use the classification supplied by the AI 2 evidence analysis.

Do not change a requirement's classification.

Do not upgrade:

- unsupported → partial
- unsupported → supported
- partial → supported

The AI 3 is responsible for tailoring the resume, not re-evaluating the evidence classification.

Use the AI 2 classification as provided.


SUGGESTIONS:

Use this for concrete edits to existing resume content.

Format:

{
  "requirement": "Exact requirement name from the job requirements",
  "resume_id": "Exact ID of the resume content being changed",
  "relevant_text": "Exact existing resume text",
  "suggestion": "Complete replacement text"
  "reason":"reason and justification of suggestion and category of edit"
}

The suggestion must:

1. Be meaningfully better for the target job.
2. Be completely supported by the FULL RESUME.
3. Preserve the factual strength of the original claims.
4. Use relevant terminology from the job description when that terminology accurately describes the candidate's existing experience.
5. Never add unsupported facts.

A suggestion may add information from another part of the FULL RESUME when that information is explicitly applicable to the resume content being changed.


IMPORTANT:

Do not rewrite a resume entry merely because a job requirement exists.

Only create a suggestion when the entry can be made genuinely better or more relevant.


REMOVALS:

Use this for existing content that should be removed or shortened because it has low value for this specific job.

Format:

{
  "resume_id": "Exact ID of the content",
  "text": "Exact existing resume text",
  "reason": "Why this content is less valuable for this specific job and category of edit"
}

Only recommend removal when there is a strong, specific reason.

Valid reasons include:

- clearly unrelated to the target job
- redundant with stronger resume content
- provides very little useful information
- consumes space that would be better used for substantially more relevant content

Do NOT remove content merely because:

- it does not contain a job keyword
- it does not directly satisfy a requirement
- another technology is more relevant
- the job mentions a competing technology

For example, do not remove an AWS certification merely because the job mentions Azure.

A legitimate technical certification, skill, project, education item, or work experience should normally be retained unless there is a strong reason to remove it.


IMPROVEMENTS:

Use this for genuine gaps that cannot be solved through a truthful rewrite.

Format:

{
  "requirement": "Exact requirement name from the job requirements",
  "importance": "Importance from the job requirements",
  "classification": "partial or unsupported",
  "resume_id": "Relevant resume ID, if applicable",
  "relevant_text": "Relevant existing resume text, if applicable",
  "improvement": "Specific explanation of the gap or improvement"
  "reason":"reason for this improvement and which category of edit it is"
}

An improvement should be specific and actionable.

Good example:

"The resume does not identify the programming language used for this project. Add the language used if JavaScript was used."

Bad example:

"Consider adding more technical skills."

Do not create an improvement when a meaningful suggestion can already solve the issue.

If a requirement is missing and there is no useful improvement that can be made without additional information from the user, place it only in missing_requirements.


MISSING REQUIREMENTS:

Use this for requirements that are not supported by the resume and cannot currently be addressed through a truthful resume edit.

Format:

{
  "requirement": "Exact requirement name from the job requirements"
}

Do not add unsupported skills to the resume simply to avoid listing them here.


REQUIREMENT NAMES:

When referring to a job requirement, copy its name exactly from the provided JOB REQUIREMENTS.

Do not rename, generalize, or reinterpret the requirement.


IMPORTANCE LEVELS:

"required" means the job explicitly requires the qualification.

"desired" means the employer prefers or values the qualification but does not strictly require it.

"mentioned" means the qualification appears in the job description but is not required or necessary for the candidate to have.

Prioritize required requirements when making meaningful edits.

Address desired requirements when the resume provides genuine relevant evidence.

Do not force mentioned requirements into the resume.


OUTPUT:

Return ONLY valid JSON.

Do not use Markdown.

Do not use code fences.

Do not include any text before or after the JSON.

Return exactly this structure:

{
  "suggestions": [],
  "removals": [],
  "improvements": [],
  "missing_requirements": []
}


FINAL CHECK:

Before returning the JSON, verify every suggestion against the FULL RESUME.

For every factual statement in every suggestion, ask:

1. Is this fact explicitly supported somewhere in the FULL RESUME?
2. Am I certain that the fact applies to the specific resume section being changed?
3. Did I accidentally make the candidate's responsibility or technical involvement sound stronger?
4. Did I infer a technology merely because it is related to another technology?
5. Did I add an unsupported adjective or qualitative claim?
6. Did I change the meaning of the original resume statement?
7. Could I defend every factual claim using specific information from the FULL RESUME?

If any answer creates uncertainty, remove or weaken that claim.

Final rules:

- Never invent facts.
- Never infer unsupported technical experience.
- Never increase the factual strength of a claim without explicit supporting evidence.
- Never change AI 2 classifications.
- Never add a missing skill merely because the job wants it.
- Preserve legitimate certifications and experience unless there is a strong reason to remove them.
- Improve presentation, relevance, clarity, and conciseness without changing the underlying truth.



"""


def request_ai(content, reasoning_effort="medium"):
    """Send a stage's prompt and inputs using the shared OpenRouter settings."""
    return requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {AI_MODEL_KEY}",
            "Content-Type": "application/json",
        },
        data=json.dumps({
            "model": "nvidia/nemotron-3-ultra-550b-a55b",
            "max_tokens": 12000,
            "messages": [{"role": "user", "content": content}],
            "reasoning": {"enabled": True, "effort": reasoning_effort},
        }),
    )


test_job_description = {
   "id": "",
   "user_id": "",
   "title": "Data & Automation Intern",
   "description": "NorthStar Analytics is seeking a Data & Automation Intern to support analysis, reporting, and process improvement across the business. This role will help build and maintain internal reporting workflows, automate recurring tasks, and support data validation across multiple teams.\n\nResponsibilities:\n- Write Python scripts to clean, transform, and validate data\n- Create SQL queries for reporting and dashboard support\n- Help automate recurring business processes using scripting and ETL tools\n- Collaborate with analysts and engineers to document data workflows\n- Support internal tools and dashboards used by operations teams\n\nRequired qualifications:\n- Python programming experience\n- SQL experience\n- Basic understanding of data processing and reporting\n- Strong communication and teamwork skills\n\nPreferred qualifications:\n- Experience with ETL or workflow automation\n- Azure or AWS experience\n- Git version control\n- JavaScript or front-end exposure\n- Experience with dashboarding tools\n\nWe are looking for a student with a strong analytical mindset and the ability to learn quickly in a collaborative environment.",
   "company": "NorthStar Analytics",
   "source": "",
   "created_at": "",
   "updated_at": ""
}


test_resume = {
    "resume": {
        "title": "Student Resume",
        "career_field": "Data Analytics",
        "is_default": True,
        "full_name": "Jordan Lee",
        "email": "jordan.lee@example.com",
        "phone": "555-210-4456",
        "location": "Austin, TX",
        "professional_summary": (
            "Computer Science student with experience in Python, SQL, and data cleanup for academic "
            "and internship projects. Interested in data workflows, reporting, and automation. "
            "Comfortable working with teams and translating business needs into technical solutions."
        )
    },

    "section_order": [
        {
            "section_name": "education",
            "section_order": 1
        },
        {
            "section_name": "work_experience",
            "section_order": 2
        },
        {
            "section_name": "projects",
            "section_order": 3
        },
        {
            "section_name": "skills",
            "section_order": 4
        },
        {
            "section_name": "certifications",
            "section_order": 5
        }
    ],

    "work_experience": [
        {
            "job_title": "Student Data Assistant",
            "company": "University Career Center",
            "location": "Austin, TX",
            "start_date": "2025-01",
            "end_date": "2025-12",
            "description": (
                "Used Python and SQL to clean student data for reporting dashboards. Helped create weekly "
                "summaries of internship and placement metrics. Worked with staff to improve spreadsheet "
                "accuracy and automate repetitive reporting tasks."
            ),
            "sort_order": 1
        }
    ],

    "education": [
        {
            "school": "University of Texas at Austin",
            "degree": "Bachelor of Science",
            "field_of_study": "Computer Science",
            "start_date": "2024-08",
            "end_date": "2028-05",
            "sort_order": 1
        }
    ],

    "skills": [
        {"skill_name": "Python", "sort_order": 1},
        {"skill_name": "SQL", "sort_order": 2},
        {"skill_name": "Excel", "sort_order": 3},
        {"skill_name": "Tableau", "sort_order": 4},
        {"skill_name": "Git", "sort_order": 5},
        {"skill_name": "Data cleaning", "sort_order": 6},
        {"skill_name": "Documentation", "sort_order": 7}
    ],

    "projects": [
        {
            "name": "Campus Event Attendance Dashboard",
            "description": (
                "Built a Python-based data processing workflow to clean attendance records, normalize fields, "
                "and prepare merged output for Tableau visualization. Used SQL queries to summarize participant "
                "trends and export reporting tables."
            ),
            "link": "https://github.com/example/attendance-dashboard",
            "sort_order": 1
        },
        {
            "name": "Internship Tracking Spreadsheet Tool",
            "description": (
                "Created an internal spreadsheet automation workflow to organize internship records, reduce "
                "manual entry errors, and generate summary reports for advising staff."
            ),
            "link": "https://github.com/example/internship-tracker",
            "sort_order": 2
        }
    ],

    "certifications": [
        {
            "name": "Google Data Analytics Certificate",
            "issuer": "Google",
            "date_earned": "2025-06",
            "sort_order": 1
        }
    ]
}


def process_resume(test_resume):
    evidence = []
    sections = {
        "skills": ["skill_name"],
        "work_experience": ["job_title", "description"],
        "projects": ["name", "description"],
        "education": ["degree", "field_of_study"],
        "certifications": ["name"],
    }

    resume_section = test_resume.get("resume")
    if isinstance(resume_section, dict):
        summary = resume_section.get("professional_summary")
        if isinstance(summary, str) and summary.strip():
            evidence.append({
                "resume_id": "resume.professional_summary",
                "relevant_text": summary.strip(),
            })

    for section_name, fields in sections.items():
        records = test_resume.get(section_name)
        if isinstance(records, dict):
            records = [records]
        if not isinstance(records, list):
            continue

        for record_index, record in enumerate(records):
            if not isinstance(record, dict):
                continue
            for field in fields:
                text = record.get(field)
                if isinstance(text, str) and text.strip():
                    evidence.append({
                        "resume_id": f"{section_name}[{record_index}].{field}",
                        "relevant_text": text.strip(),
                    })
    return {"evidence": evidence}


def analyze_resume(evidence, requirements_response):
  ai_input_json = {"requirements": [], "evidence": []}
  ai_response_processed = requirements_response.get("requirements", [])
  if not isinstance(ai_response_processed, list):
    print("AI response is not a list of requirements")
  elif len(ai_response_processed) == 0:
    print("AI response is an empty list of requirements")
  else:
    for item in ai_response_processed:
       if not isinstance(item, dict):
           continue
       requirement = item.get("requirement")
       importance = item.get("importance")
       direct_search_terms = item.get("direct_search_terms")
       related_search_terms = item.get("related_search_terms")
       set_of_direct_search_terms = set(direct_search_terms)
       set_of_related_search_terms = set(related_search_terms)
       supported = False
       partial= False
       supporting_evidence=[]
       partial_evidence=[]
       unsupported_evidence=[]
       for evidence_item in evidence:
          relevant_text = evidence_item.get("relevant_text").lower()
          if any(term.lower() in relevant_text for term in set_of_direct_search_terms):
              supported=True
              supporting_evidence.append(evidence_item)
          elif any(term.lower() in relevant_text for term in set_of_related_search_terms):
              partial=True
              partial_evidence.append(evidence_item)
       if supported:
          for evidence_item in supporting_evidence:
              ai_input_json["evidence"].append({
                 "requirement": requirement,
                 "importance": importance,
                 "resume_id": evidence_item.get("resume_id"),
                 "relevant_text": evidence_item.get("relevant_text"),
                 "match_type": "supported",
              })
       elif partial:
          for evidence_item in partial_evidence:
              ai_input_json["evidence"].append({
                 "requirement": requirement,
                 "importance": importance,
                 "resume_id": evidence_item.get("resume_id"),
                 "relevant_text": evidence_item.get("relevant_text"),
                 "match_type": "partial",
              })
       else:
          ai_input_json["evidence"].append({
              "requirement": requirement,
                "importance": importance,
                "resume_id": None,
                "relevant_text": None,
                "match_type": "none",
            })
       ai_input_json["requirements"].append({
          "requirement": requirement,
          "importance": importance,
          "direct_search_terms": direct_search_terms,
          "related_search_terms": related_search_terms,
       })
  return ai_input_json


def parse_ai_response(response):
    """Read a successful AI response as JSON."""
    response.raise_for_status()
    message = response.json()["choices"][0]["message"]["content"]
    result = json.loads(message)
    print("AI RESPONSE:")
    print(json.dumps(result, indent=2))
    return result


def build_frontend_response(stage_3, stage_2):
    """Map tailoring results to frontend fields using Stage 2 classifications."""
    requirements = {
        item["requirement"]: item
        for item in stage_2.get("evidence", [])
    }
    importance_values = {"required": 3, "desired": 2, "mentioned": 1}
    requirements_met = sum(
        item.get("classification") == "supported"
        for item in requirements.values()
    )
    requirements_missing = sum(
        item.get("classification") == "unsupported"
        for item in requirements.values()
    )
    total = len(requirements)

    frontend_response = {
        "suggestions": [],
        "improvements": [],
        "removals": [
            {"relevant_text": item["text"], "reason": item["reason"]}
            for item in stage_3.get("removals", [])
        ],
        "missing_requirements": [
            {"requirement": item["requirement"]}
            for item in stage_3.get("missing_requirements", [])
        ],
        # Compatibility estimate: partial requirements count only in the total.
        "ATS_score": round(requirements_met / total * 100) if total else 0,
        "requirements_met": requirements_met,
        "requirements_missing": requirements_missing,
    }

    for item in stage_3.get("suggestions", []):
        requirement = requirements[item["requirement"]]
        frontend_response["suggestions"].append({
            "suggestion": item["suggestion"],
            "type": requirement["classification"],
            "requirement": item["requirement"],
            "importance": importance_values[requirement["importance"]],
            "before": item["relevant_text"],
            "reason": item["reason"],
            "resume_id": item["resume_id"],
        })

    for item in stage_3.get("improvements", []):
        requirement = requirements[item["requirement"]]
        frontend_response["improvements"].append({
            "improvement": item["improvement"],
            "type": requirement["classification"],
            "requirement": item["requirement"],
            "reason": item["reason"],
            "resume_id": item.get("resume_id"),
        })

    return frontend_response


def main_request(id, job, user_id):
    """Load a saved resume and return the Stage 3 tailoring recommendations."""
    resume = get_resume(str(id), str(user_id))
    if resume is None:
        raise ValueError("Resume not found")

    section_names = (
        "work_experience", "education", "skills",
        "projects", "certifications", "section_order",
    )
    structured_resume = {
        "resume": {key: value for key, value in resume.items() if key not in section_names},
        **{section: resume.get(section, []) for section in section_names},
    }
    return run_pipeline(structured_resume, job)


def run_pipeline(structured_resume, job, timings=None):
    """Run the same pipeline for saved resumes or console test fixtures."""
    if timings is None:
        timings = {}
    ai_job_description_prompt = {
        "title": job.get("title"),
        "company": job.get("company", job.get("company_name")),
        "description": job.get("description"),
    }

    # Initialize every stage's response before making requests.
    response = None
    response_2 = None
    response_3 = None
    requirements_response = None
    evidence_response = None
    suggestions_response = None

    # Stage 1
    stage_started = perf_counter()
    response = request_ai(
        (
            prompt
            + "\nJob description:\n"
            + json.dumps(ai_job_description_prompt)
        ),
        reasoning_effort="low",
    )
    requirements_response = parse_ai_response(response)
    timings["Stage 1: job requirements"] = perf_counter() - stage_started

    stage_started = perf_counter()
    evidence = process_resume(structured_resume)["evidence"]
    ai_input_json = analyze_resume(evidence, requirements_response)
    timings["Evidence preprocessing"] = perf_counter() - stage_started

    # Stage 2
    stage_started = perf_counter()
    response_2 = request_ai(
        (
            prompt_resume
            + "\nRequirements and resume evidence:\n"
            + json.dumps(ai_input_json)
            + "structured resume:"
            + json.dumps(structured_resume)
        ),
        reasoning_effort="medium",
    )
    evidence_response = parse_ai_response(response_2)
    timings["Stage 2: resume evidence"] = perf_counter() - stage_started

    # Stage 3
    stage_started = perf_counter()
    response_3 = request_ai(
        (
            prompt_suggestion
            + "\n\nRequirements and resume evidence:\n"
            + json.dumps(evidence_response)
            + "\n\nFull resume:\n"
            + json.dumps(structured_resume)
            + "\n\nFull Description:\n"
            + json.dumps(ai_job_description_prompt)
        ),
        reasoning_effort="medium",
    )
    suggestions_response = parse_ai_response(response_3)
    timings["Stage 3: recommendations"] = perf_counter() - stage_started

    stage_started = perf_counter()
    result = build_frontend_response(suggestions_response, evidence_response)
    timings["Frontend response mapping"] = perf_counter() - stage_started
    return result



def console_test(resume=None, job=None):
    """Test local fixtures without database reads; makes three live AI requests."""
    timings = {}
    started = perf_counter()
    try:
        result = run_pipeline(
            test_resume if resume is None else resume,
            test_job_description if job is None else job,
            timings,
        )
        print("\nFRONTEND RESPONSE:")
        print(json.dumps(result, indent=2))
        return result
    finally:
        print("\nELAPSED TIME:")
        for section, seconds in timings.items():
            print(f"{section}: {seconds:.2f}s")
        print(f"Total: {perf_counter() - started:.2f}s")


# Alternative two-request pipeline. The original prompts and pipeline stay intact.
prompt_combined = prompt_suggestion.replace(
    prompt_suggestion[
        prompt_suggestion.index("REQUIREMENT CLASSIFICATIONS:"):
        prompt_suggestion.index("SUGGESTIONS:")
    ],
    """REQUIREMENT CLASSIFICATIONS:
First classify every supplied job requirement against the FULL RESUME.
The backend's keyword matches are candidates, not final classifications.
Return exactly one evidence entry per requirement, copying its name and importance.
Use supported for explicit contextual evidence, partial for relevant but incomplete
or ambiguous evidence, and unsupported when no qualifying evidence exists.
A related technology does not prove a specific framework, language, or platform.
For dates and eligibility, evaluate actual resume values against the job conditions.
For each requirement, include only the relevant field paths and a short
explanation. Do not copy original resume text. Use an empty evidence array
when no relevant evidence exists.
Then generate recommendations based on these classifications. Do not change a
classification merely to justify a rewrite or to add a desired keyword.

SUGGESTIONS:""".removesuffix("SUGGESTIONS:"),
).replace(
    "3. RESUME EVIDENCE", "3. PRELIMINARY RESUME EVIDENCE"
).replace(
    "- Never change AI 2 classifications.",
    "- Keep recommendations consistent with your evidence classifications.",
).replace(
    '  "suggestions": [],\n  "removals": [],\n  "improvements": [],\n  "missing_requirements": []',
    '  "evidence": [],\n  "suggestions": [],\n  "removals": [],\n  "improvements": []',
).replace(
    prompt_suggestion[
        prompt_suggestion.index("MISSING REQUIREMENTS:"):
        prompt_suggestion.index("REQUIREMENT NAMES:")
    ],
    '',
).replace(
    'If a requirement has no evidence anywhere in the FULL RESUME and there is no specific incomplete information to clarify, use missing_requirements only.',
    'If a requirement has no evidence and no specific incomplete information to clarify, classify it as unsupported without generating a generic improvement.',
).replace(
    'If a requirement is missing and there is no useful improvement that can be made without additional information from the user, place it only in missing_requirements.',
    'Do not generate a generic improvement for an absent qualification unless there is specific incomplete information to clarify.',
).replace(
    '  "relevant_text": "Exact existing resume text",\n', '',
).replace(
    '  "relevant_text": "Relevant existing resume text, if applicable",\n', '',
).replace(
    '  "text": "Exact existing resume text",\n', '',
) + """

EVIDENCE OUTPUT:
The top-level evidence array must contain every supplied requirement exactly once.
Each entry must have this structure:
{
  "requirement": "Exact requirement name",
  "importance": "required, desired, or mentioned; copied from input",
  "classification": "supported, partial, or unsupported",
  "evidence": [
    {
      "resume_id": "Exact field path from the supplied resume evidence",
      "reason": "Why this evidence supports the classification"
    }
  ]
}
Return only one JSON object containing evidence, suggestions, removals,
and improvements. Do not return separate JSON objects or a missing requirements
list. The backend builds that list from every unsupported classification,
including requirements that also have a specific clarification in improvements.
FIELD REFERENCES:
Use exact field paths, including section prefixes and zero-based array indexes.
Only summary fields use the resume prefix (for example,
resume.professional_summary). Other sections are top-level: skills[0].skill_name,
work_experience[0].description, projects[0].description, education[0].end_date.
Reference individual fields, not entire section objects or array entries.
Return field locations instead of original resume text in all collections.
Do not return relevant_text, text, or before. The backend retrieves original text.
Suggestions still require complete replacement text in suggestion; improvements
and reasons still require concise explanations. Removals require resume_id and
reason. An improvement may use null for resume_id when no specific field applies.

PROJECT-SPECIFIC EVIDENCE:
Keep facts attributed to the project where they are established. Do not transfer
tools, technologies, responsibilities, methods, or outcomes from one project to
another. A technology listed in skills or used in a different project does not
prove it was used in the project being edited. Only add it when the FULL RESUME
explicitly establishes its use in that specific project, including an explicit
reference elsewhere that clearly identifies the same project.
For example, Tableau used in project A does not justify adding Tableau to project
B. Do not combine separate projects into a single claimed implementation. If the
connection is ambiguous and worth clarifying, put the question in improvements
instead of generating a suggestion that assumes the connection.
Project titles may provide context for edits to that same project. For example,
a dashboard project title can help interpret its description, but does not prove
that the candidate built dashboards in a separate work experience. Keep any
dashboard-building rewrite attached to the project that supports it; a title
alone does not establish specific tools, implementation steps, or outcomes.
In work experience that describes cleaning data for reporting dashboards,
emphasize that contribution, such as "Prepared data for reporting dashboards."
Use "Built a data workflow for reporting dashboards" only if that role establishes
building a workflow. Do not claim improved dashboards without evidence of an
improvement, or transfer dashboard construction from a project into that role.

CLARIFICATION BELONGS IN IMPROVEMENTS:
If a proposed edit needs an ambiguous detail confirmed, do not return a suggestion
for that edit. Instead, return an improvement with the relevant requirement,
resume_id, a concise question in improvement, and a reason explaining what needs
confirmation. Do not also provide replacement text for the same edit or attach a
clarification field to a suggestion. Suggestions are only for edits that can be
made confidently from established resume facts without clarification.
A clarification request does not establish evidence or change classification.
For example, if using "ETL pipeline" requires confirmation of extraction or
loading, return an improvement asking:
"improvement": "Did this workflow extract records from a source, transform them
by cleaning and normalizing them, and load the results into a target system for
reporting? If it performed all three steps, describe it as an ETL (extract,
transform, load) workflow in your project description. If it only prepared output
for later use, keep the term data processing workflow."
Do not generate an ETL rewrite until those steps are established.
Use "ETL pipeline" without clarification when the resume already establishes
extraction, transformation, and loading, even if it does not use the term ETL.
"""


def restore_combined_resume_text(response, structured_resume):
    """Resolve AI field references locally without trusting AI copies of resume text."""
    fields = {}
    locations = set()

    def collect(value, path):
        locations.add(path)
        if isinstance(value, dict):
            for key, child in value.items():
                collect(child, f"{path}.{key}" if path else key)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                collect(child, f"{path}[{index}]")
        elif isinstance(value, str):
            fields[path] = value

    collect(structured_resume, "")

    def resolve(item):
        path = item.get("resume_id")
        # Some model outputs incorrectly put every section under resume.
        if isinstance(path, str) and path not in locations and path.startswith("resume."):
            candidate = path.removeprefix("resume.")
            if candidate in locations:
                path = candidate
        if path not in locations or not path:
            raise ValueError(f"AI returned an unknown resume field: {path!r}")
        return path

    def original(item):
        path = resolve(item)
        if path not in fields:
            raise ValueError(f"AI edit must reference a text field: {path!r}")
        return fields[path]

    # Validate classification references as well as the fields used for edits.
    for requirement in response.get("evidence", []):
        for item in requirement.get("evidence", []):
            resolve(item)

    return {
        **response,
        "suggestions": [
            {**item, "resume_id": resolve(item), "relevant_text": original(item)}
            for item in response.get("suggestions", [])
        ],
        "improvements": [
            {**item, "resume_id": resolve(item) if item.get("resume_id") else None}
            for item in response.get("improvements", [])
        ],
        "removals": [
            {**item, "resume_id": resolve(item), "text": original(item)}
            for item in response.get("removals", [])
        ],
    }


def run_combined_pipeline(structured_resume, job, timings=None):
    """Extract requirements, then classify evidence and tailor in one request."""
    if timings is None:
        timings = {}
    job_input = {
        "title": job.get("title"),
        "company": job.get("company", job.get("company_name")),
        "description": job.get("description"),
    }
    response = None
    combined_response = None
    requirements_response = None
    recommendations_response = None

    started = perf_counter()
    response = request_ai(
        prompt + "\nJob description:\n" + json.dumps(job_input),
        reasoning_effort="low",
    )
    requirements_response = parse_ai_response(response)
    timings["Stage 1: job requirements"] = perf_counter() - started

    started = perf_counter()
    evidence = process_resume(structured_resume)["evidence"]
    matched_evidence = analyze_resume(evidence, requirements_response)
    timings["Evidence preprocessing"] = perf_counter() - started

    started = perf_counter()
    combined_response = request_ai(
        prompt_combined
        + "\n\nJob requirements and preliminary resume evidence:\n"
        + json.dumps(matched_evidence)
        + "\n\nFull resume:\n" + json.dumps(structured_resume)
        + "\n\nFull job description:\n" + json.dumps(job_input),
        reasoning_effort="low",
    )
    recommendations_response = parse_ai_response(combined_response)
    timings["Stage 2: classification and recommendations"] = perf_counter() - started

    started = perf_counter()
    expected = {item["requirement"] for item in requirements_response["requirements"]}
    classified = recommendations_response.get("evidence", [])
    names = [item["requirement"] for item in classified]
    if set(names) != expected or len(names) != len(set(names)):
        raise ValueError("Combined response must classify each requirement exactly once")
    if any(item.get("classification") not in {"supported", "partial", "unsupported"}
           for item in classified):
        raise ValueError("Combined response contains an invalid classification")
    # Keep importance tied to the extracted requirements, rather than a new AI value.
    importance = {item["requirement"]: item["importance"]
                  for item in requirements_response["requirements"]}
    classifications = {"evidence": [
        {**item, "importance": importance[item["requirement"]]}
        for item in classified
    ]}
    recommendations_response = restore_combined_resume_text(
        recommendations_response, structured_resume
    )
    recommendations_response["missing_requirements"] = [
        {"requirement": item["requirement"]}
        for item in classifications["evidence"]
        if item["classification"] == "unsupported"
    ]
    result = build_frontend_response(recommendations_response, classifications)
    timings["Frontend response mapping"] = perf_counter() - started
    return result


def main_request_combined(id, job, user_id):
    """Optional saved-resume entry point; the API still uses main_request."""
    resume = get_resume(str(id), str(user_id))
    if resume is None:
        raise ValueError("Resume not found")
    section_names = (
        "work_experience", "education", "skills",
        "projects", "certifications", "section_order",
    )
    structured_resume = {
        "resume": {key: value for key, value in resume.items() if key not in section_names},
        **{section: resume.get(section, []) for section in section_names},
    }
    return run_combined_pipeline(structured_resume, job)


def console_test_combined(resume=None, job=None):
    """Test the alternative pipeline with two live AI calls and section timings."""
    timings = {}
    started = perf_counter()
    try:
        result = run_combined_pipeline(
            test_resume if resume is None else resume,
            test_job_description if job is None else job,
            timings,
        )
        print("\nCOMBINED PIPELINE FRONTEND RESPONSE:")
        print(json.dumps(result, indent=2))
        return result
    finally:
        print("\nCOMBINED PIPELINE ELAPSED TIME:")
        for section, seconds in timings.items():
            print(f"{section}: {seconds:.2f}s")
        print(f"Total: {perf_counter() - started:.2f}s")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="JobCoachAI pipeline console test")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--console-test", action="store_true",
                        help="Run local fixtures with live AI requests and timing output")
    mode.add_argument("--console-test-combined", action="store_true",
                      help="Run the two-request pipeline with live AI calls and timings")
    args = parser.parse_args()
    if args.console_test:
        console_test()
    elif args.console_test_combined:
        console_test_combined()
    else:
        parser.print_help()
