import requests


import json


import os
import logging
import re
from pathlib import Path
from datetime import datetime, timezone
from difflib import SequenceMatcher
from time import perf_counter
from uuid import uuid4


from dotenv import load_dotenv


load_dotenv(
    os.path.join(os.path.dirname(__file__), "..", ".env"),
    override=True,
)
load_dotenv()


from backend.services.resume import get_resume


OPENROUTER_API_KEY = os.getenv("AI_MODEL_KEY")
GROQ_API_KEY = os.getenv("groq_api_key")
CEREBRAS_API_KEY = os.getenv("cerebras_api_key")
AI_PROVIDER = os.getenv("AI_PROVIDER", "openrouter").strip().lower()
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _safe_provider_error(response):
    """Return bounded provider error metadata without logging response content."""
    try:
        body = response.json()
    except ValueError:
        return {"body_type": "non_json"}

    if not isinstance(body, dict):
        return {"body_type": type(body).__name__}

    details = {"top_level_keys": sorted(str(key) for key in body.keys())[:12]}
    error = body.get("error")
    if isinstance(error, dict):
        for key in ("type", "code", "param"):
            value = error.get(key)
            if isinstance(value, str):
                value = re.sub(
                    r"(?i)\b(bearer)\s+\S+",
                    r"\1 [REDACTED]",
                    value,
                )
                value = re.sub(
                    r"(?i)\b(api[_ -]?key|token|secret|password)"
                    r"\s*[:=]\s*[^\s,;]+",
                    r"\1=[REDACTED]",
                    value,
                )
                details[f"error_{key}"] = value[:240]
    elif isinstance(error, str):
        details["error_type"] = "string"
    return details


def _diagnostic_output(content, limit=12000):
    if len(content) <= limit:
        return content
    return content[:limit] + "... [truncated]"


def _write_ai_capture(capture):
    """Write an AI capture to a sortable local file when capture is enabled."""
    if os.getenv("AI_CAPTURE_RESPONSES", "").strip().lower() not in {
        "1", "true", "yes", "on",
    }:
        return

    output_dir = Path(os.getenv(
        "AI_RESPONSE_CAPTURE_DIR",
        os.path.join(os.path.dirname(__file__), "test-output"),
    ))
    output_dir.mkdir(parents=True, exist_ok=True)
    stage = capture.get("stage", "unknown")
    safe_stage = re.sub(r"[^a-zA-Z0-9_-]+", "_", stage).strip("_") or "unknown"
    captured_at = datetime.now(timezone.utc)
    timestamp = captured_at.strftime("%Y%m%dT%H%M%S.%fZ")
    output_path = output_dir / f"{timestamp}_{safe_stage}.json"
    duplicate = 1
    while output_path.exists():
        output_path = output_dir / f"{timestamp}_{safe_stage}_{duplicate:02d}.json"
        duplicate += 1
    capture["captured_at"] = captured_at.isoformat(timespec="microseconds")
    output_path.write_text(
        json.dumps(capture, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info(
        "AI output captured request_id=%s stage=%s path=%s",
        capture.get("request_id"),
        safe_stage,
        output_path,
    )


def _capture_provider_response(
    response_body, provider, model, stage, request_id, status,
):
    """Write a full provider response to a local file when capture is enabled."""
    _write_ai_capture({
        "request_id": request_id,
        "provider": provider,
        "model": model,
        "stage": stage,
        "status": status,
        "response": response_body,
    })


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


prompt = """
You analyze job descriptions and extract concise, independently verifiable
qualifications and meaningful job responsibilities.
Return a JSON object with a "requirements" array. Each item must have:
"requirement" (a concise qualification), "importance" ("required", "desired",
or "mentioned"), "group" (a concise name for the scoring unit),
"group_logic" ("all" or "any"), "direct_search_terms" (specific evidence),
and "related_search_terms" (contextual evidence).

Group requirements according to the posting's actual logic:
- Give independent qualifications their own group, with group_logic "all".
- Put explicit alternatives in one group with group_logic "any". Examples:
  "one or more programming languages" is one group with language options;
  "Bachelor's degree or equivalent experience" is one group, not two mandatory
  requirements; "X, Y, or Z" is one group.
- group_logic applies to requirement rows in the same group, not to the
  related_search_terms. With "all", every requirement row in the group is
  required; with "any", at least one requirement row in the group is sufficient.
- For an "all" requirement row, normally provide exactly one direct_search_term:
  a canonical phrase that represents that independently required qualification.
  Put synonyms, examples, and alternate wording in related_search_terms, not as
  additional direct terms. This prevents a matcher from accidentally treating
  every wording variant as a separate condition.
- When a sentence contains multiple independently mandatory conditions, split
  them into separate requirement rows in the same "all" group, with one direct
  term per row. Use multiple direct_search_terms mainly for a single "any"
  requirement row whose terms are true alternatives. Do not put mandatory AND
  conditions into related_search_terms merely to avoid representing them; split
  them into separate rows so each condition remains required.
- Do not split examples, technologies, or subtopics within one qualification
  into independent mandatory requirements. Use "any" only when the posting
  says alternatives (e.g. "or", "one or more", "any of"). A comma-separated
  list without alternative wording is not automatically a set of requirements.
- Split distinct skills when each is independently verifiable. For example,
  "Strong C++, C programming" means separate C++ and C requirement rows in a
  shared "all" group. Keep them together with "any" only when the posting
  explicitly accepts either. Do not split a single qualification into
  redundant subtopics.
- If one sentence combines mandatory conditions with alternatives, split it
  into the smallest independently matchable requirements. Put each mandatory
  experience, setting, or duration condition in its own row in a shared "all"
  group; put alternative options in a separate "any" group. Never put OR
  options in an "all" row. For example, "3 years of backend experience using
  Python or Java" becomes an "all" group with one row for 3 years of backend
  experience, and an "any" group for Python or Java.
- A degree or field alternative such as "Master's in Computer Science or a
  related technical field" is one "any" requirement, not a requirement for both.
- Boolean examples:
  * "Python or Java" => one "any" requirement.
  * "Bachelor's degree or equivalent practical experience" => one "any"
    requirement.
  * "One or more of Web, Linux, or ML" => one "any" requirement.
  * "1 year of software development in an industry setting using one or more
    programming languages (e.g., Python, C, or Java)" => an "all" group with
    separate one-direct-term rows for the year/experience and industry-setting
    conditions, plus an "any" group for the language options.
  * "Experience with backend development and production systems" => an "all"
    group with separate one-direct-term rows for backend development and
    production systems.
- A group should represent one independently scoreable qualification. Include
  conditions such as years of experience, industry setting, or degree field in
  the requirement itself; do not make those conditions disappear by grouping
  only their example technologies.
- Extract a small set of relevant, concrete responsibilities or capabilities
  stated outside formal qualification sections (such as software development,
  testing, documentation, collaboration, or technical communication) as
  "mentioned", unless the posting explicitly makes them required or desired.
  Exclude generic company descriptions, benefits, compensation,
  equal-opportunity/legal text, boilerplate, and redundant responsibilities.
- Keep the set focused; do not turn every task or sentence into a separate
  requirement.
- Do not add a qualification merely because it is common for the job title.
- Preserve qualifiers and negation. Do not invent dates or requirements.

Direct search terms should be specific to the stated qualification or its true
aliases, not merely related skills. For example, C is not C++, and Linux is not
embedded Linux development. Put potentially relevant but insufficient evidence
in related_search_terms; it may support only a partial match. Include useful
wording variations without broadening the qualification. Avoid duplicate or
overlapping requirements.
"""

prompt_combined = """
You are a resume tailoring assistant.

Your job is to tailor the candidate's existing resume to a specific job while preserving complete factual accuracy.

You will receive four inputs:

1. FULL JOB DESCRIPTION
The original job posting. This is the source of truth for the job's responsibilities, qualifications, terminology, and requirements.

2. JOB REQUIREMENTS
Structured requirements extracted from the job description. Use these to identify which qualifications are most relevant to the position.

3. PRELIMINARY RESUME EVIDENCE
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

If a requirement has no evidence and no specific incomplete information to clarify, classify it as unsupported without generating a generic improvement.
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

SUGGESTIONS:

Use this for concrete edits to existing resume content.

Format:

{
  "requirement": "Exact requirement name from the job requirements",
  "resume_id": "Exact ID of the resume content being changed",
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
The suggestion's resume_id must identify one exact text field from the supplied
resume evidence, such as "skills[0].skill_name" or
"certifications[0].name". Never use a section or collection path such as
"skills" or "certifications[0]" for a suggestion or removal.


IMPORTANT:

Do not rewrite a resume entry merely because a job requirement exists.

Only create a suggestion when the entry can be made genuinely better or more relevant.


REMOVALS:

Use this for existing content that should be removed or shortened because it has low value for this specific job.

Format:

{
  "resume_id": "Exact ID of the content",
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
  "improvement": "Specific explanation of the gap or improvement"
  "reason":"reason for this improvement and which category of edit it is"
}

An improvement should be specific and actionable.

Good example:

"The resume does not identify the programming language used for this project. Add the language used if JavaScript was used."

Bad example:

"Consider adding more technical skills."

Do not create an improvement when a meaningful suggestion can already solve the issue.

Do not generate a generic improvement for an absent qualification unless there is specific incomplete information to clarify.


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
  "evidence": [],
  "suggestions": [],
  "removals": [],
  "improvements": []
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
- Keep recommendations consistent with your evidence classifications.
- Never add a missing skill merely because the job wants it.
- Preserve legitimate certifications and experience unless there is a strong reason to remove them.
- Improve presentation, relevance, clarity, and conciseness without changing the underlying truth.





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


def _object_schema(properties):
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


def _array_schema(items):
    return {"type": "array", "items": items}


_STRING = {"type": "string"}
_IMPORTANCE = {
    "type": "string",
    "enum": ["required", "desired", "mentioned"],
}
_CLASSIFICATION = {
    "type": "string",
    "enum": ["supported", "partial", "unsupported"],
}


REQUIREMENTS_SCHEMA = _object_schema({
    "requirements": _array_schema(_object_schema({
        "requirement": _STRING,
        "importance": _IMPORTANCE,
        "group": _STRING,
        "group_logic": {"type": "string", "enum": ["all", "any"]},
        "direct_search_terms": _array_schema(_STRING),
        "related_search_terms": _array_schema(_STRING),
    })),
})


SUGGESTIONS_PROMPT = """
You are a resume-tailoring assistant. Produce factual, actionable resume edits
from the supplied current resume, job requirements, and requirement-to-evidence
analysis.

Your primary objective is to improve how effectively the resume presents the
candidate's existing qualifications for the target job. Optimize for relevance,
clarity, specificity, conciseness, and professional presentation without
inventing or exaggerating experience.

CORE PRINCIPLE:
Be ambitious about PRESENTATION but conservative about FACTS.

The full resume is authoritative for existing candidate claims. The job
description establishes employer priorities, not candidate qualifications.
User-provided evidence is an explicit candidate claim, but applies only to the
target section identified by the user. Rewrite casual user wording professionally
without changing its factual meaning.

FACTUAL ACCURACY:
- Every factual claim in a suggestion must be supported by the resume or
  applicable user-provided evidence.
- Never invent skills, technologies, responsibilities, accomplishments,
  metrics, outcomes, qualifications, or project details.
- Do not increase the candidate's actual responsibility, technical involvement,
  leadership, ownership, experience level, or accomplishments.
- A technology listed in skills does not prove it was used in a specific project.
- Do not transfer facts between unrelated projects or work experiences.
- You MAY reorganize and combine facts established within the same project or
  work experience, including facts from its title, description, and other fields
  clearly belonging to that entry.
- Facts from elsewhere in the resume may be incorporated only when the resume
  explicitly establishes their connection to the entry being edited.
- Do not infer a technology merely because it is technically compatible with
  another technology.
- An API does not prove REST. A dashboard does not prove web development,
  JavaScript, responsive design, real-time behavior, architecture, testing,
  or scalability.
- Git, teamwork, or software projects do not automatically prove AI
  productivity-tool experience or project-management responsibility.
- A job's design/test/deploy/maintain responsibilities do not prove the
  candidate performed every software lifecycle activity.
- Do not add testing, deployment, JavaScript, REST, machine-learning algorithms,
  leadership, deadlines, or other qualifications unless the applicable resume
  evidence establishes them.
- Do not generate a rewrite solely because substantial English-language resume
  text triggered the ATS-only English-proficiency heuristic.

EVIDENCE CLASSIFICATIONS ARE AUTHORITATIVE:
- "supported" means the supplied resume evidence directly establishes the
  qualification. This determines qualification coverage, not whether the
  supporting resume text is already optimally written.
- "partial" means relevant evidence exists but does not establish the full
  qualification. Describe only the established facts. Never rewrite partial
  evidence as definite proof of the complete qualification.
- "unsupported" means there is no qualifying resume evidence. Do not claim
  or imply that the candidate has the missing qualification.
- The job description must never be treated as evidence of candidate experience.
- Requirements sharing a group are evaluated using group_logic for ATS scoring.
  Preserve the distinction between individual requirements and grouped coverage.
- Do not change or exaggerate qualification coverage to justify a rewrite.
- Do not omit a useful rewrite merely because a requirement or its group is
  already classified as supported.

RESUME PRESENTATION AND TAILORING:
Requirement coverage and presentation quality are separate considerations.

A supported requirement does not mean its supporting resume entry is already
written optimally. A meaningful rewrite does not need to establish an additional
qualification. Presenting existing evidence more effectively is itself valuable.

Review the entire resume, including relevant projects, work experience,
education, and skills, rather than considering only fields directly matched to
requirements.

For each relevant entry, evaluate:
1. Does it emphasize the experience most relevant to this particular job?
2. Are important technical contributions or accomplishments buried in weak
   or generic wording?
3. Can established facts be reorganized or combined to communicate the
   candidate's actual work more clearly?
4. Are there redundant statements that could be shortened or consolidated?
5. Can accurate terminology from the job description make existing experience
   clearer, more specific, or easier to recognize?
6. Would stronger action-oriented wording improve the description without
   implying greater responsibility or accomplishments?
7. Can the entry become more concise without losing meaningful factual details?

When an evidence-supported rewrite would materially improve relevance, clarity,
specificity, or conciseness, generate it even when the associated requirement
is already supported.

Prefer substantive, job-specific improvements to project and experience
descriptions over superficial wording changes when both are justified.
Still include legitimate typo corrections, capitalization fixes, terminology
standardization, and duplicate removals.

Do not rewrite entries that are already effective merely to increase the number
of suggestions. Every suggested replacement must offer a meaningful improvement
over the original.

Keep the editing process focused: identify the strongest evidence-supported
edit for each field and draft it once. Once a suggestion is accurate and
meaningfully improves the resume, use it; do not spend time on repeated minor
wording revisions or near-duplicate alternatives.

SUGGESTIONS:
- Use suggestions for concrete edits to existing resume text fields.
- Return the COMPLETE replacement text for the targeted field, not just the
  modified sentence or a description of the requested change.
- Preserve important established facts unless removing redundancy or less
  relevant information genuinely improves the entry.
- Use accurate, professional, action-oriented language.
- Use relevant terminology from the job description when it accurately describes
  qualifications already established by the resume.
- Generate at most one suggestion per original resume text field, considering
  all relevant requirements for that field together.
- Combine compatible improvements to clarity, terminology, relevance,
  conciseness, and factual correction into one complete replacement. Preserve
  important facts and do not combine unrelated facts or transfer experience
  between entries.
- Do not generate duplicate, conflicting, or exact no-op suggestions.
- Use an exact existing resume text-field path for resume_id, not a section,
  collection, or record path.
- If a relevant skill is not listed but is clearly established by the resume,
  add it as a separate Skills entry. Never replace or combine it with an
  unrelated existing skill. Do not add a skill based only on the job
  description, a related technology, or an inference about what the candidate
  may know. If the resume does not establish the skill, ask whether the
  candidate has used or learned it in improvements instead.
- Never add a skill that is already listed, including an equivalent spelling
  or alias.
- Education descriptions may summarize only relevant coursework, academic
  projects, or other details explicitly supported by the education entry or
  applicable user evidence. Preserve school, degree, field of study, and dates.
- Use the exact supplied requirement name most relevant to the edit.
  Do not invent or rename requirements.
  For general replacement edits such as typo corrections, capitalization,
  formatting, or clarity with no meaningful job requirement, set requirement
  to null. Skill additions and clarification requests still need a requirement.
  User evidence may establish multiple skills regardless of which requirement
  the user selected when submitting it; use explicit facts across that evidence.
- Do not return original resume text separately; the backend retrieves it
  using resume_id.
- Do not target resume.professional_summary. Professional summaries are
  generated through a separate request.

REMOVALS:
- Recommend removing duplicated, redundant, or genuinely low-value content
  when doing so improves the resume for the target job.
- Do not remove legitimate experience simply because it lacks a job keyword
  or does not directly satisfy a requirement.
- Use exact existing text-field paths for resume_id.
- Do not recommend removal of a field that also receives a replacement
  suggestion in the same response.

IMPROVEMENTS AND CLARIFICATIONS:
- Use improvements for high-value questions about missing or ambiguous
  qualifications that could materially improve the resume.
- Inspect the entire resume before deciding that information is missing.
- Ask for specific additional evidence rather than inventing qualifications.
- Do not ask for facts already established in the resume.
- Do not ask a question when a truthful rewrite can already address the issue.
- A question about an unsupported qualification does not establish that
  qualification.
- Keep questions specific and actionable rather than generic career advice.

USER-PROVIDED EVIDENCE:
- Treat newly supplied user evidence as an explicit candidate claim.
- Apply it only to the target section identified by the user.
- Rewrite informal wording professionally while preserving its meaning.
- Do not transfer user-provided claims to unrelated experiences or projects.
- Do not use user evidence to strengthen facts beyond what the user actually
  stated.

FINAL VALIDATION:
Before returning a suggestion, verify:
1. Every factual claim is supported by applicable resume or user evidence.
2. All technologies and responsibilities belong to the entry being edited.
3. The rewrite does not exaggerate qualifications or accomplishments.
4. The replacement meaningfully improves relevance, clarity, specificity,
   or conciseness.
5. The resume_id identifies an exact existing text field.
6. The requirement name is copied exactly from the supplied job requirements,
   or is null for a general replacement edit with no meaningful requirement.
7. The replacement preserves important established information.

If a proposed rewrite depends on missing or ambiguous factual information,
do not invent the missing detail. Ask a specific clarification question
in improvements when that information would be valuable.
FIELD SEMANTICS AND INTEGRITY:
- Resume field paths have specific meanings. Preserve those meanings.
- Work experience job titles identify positions actually held. Never replace
  them with a target job title, academic status, career objective, or
  generalized professional identity.
- Do not rewrite employer names, institution names, degrees, dates, or other
  factual identifiers to improve relevance.
- Focus substantive tailoring on project descriptions, work experience
  descriptions, skills terminology, and other editable descriptive fields.
- A resume headline is not interchangeable with a work experience title.
- Never change a field into a different type of information, even if the
  replacement sounds more relevant to the target job.
OUTPUT:
Return ONLY valid JSON matching the supplied schema.

The response must contain suggestions, removals, and improvements.

Each suggestion must contain:
- requirement
- resume_id
- suggestion
- reason
- action ("replace" or "add")
- section_name (empty for replacements; "Skills" for skill additions)
- new_entry (empty skill_name for replacements; a skill_name for additions)

Each removal must contain:
- resume_id
- reason

Each improvement must contain:
- requirement
- resume_id
- improvement
- reason

Do not include Markdown, code fences, additional fields, or explanatory text
outside the JSON response.
"""


ANALYSIS_SCHEMA = _object_schema({
    "evidence": _array_schema(_object_schema({
        "requirement": _STRING,
        "importance": _IMPORTANCE,
        "classification": _CLASSIFICATION,
        "evidence": _array_schema(_object_schema({
            "resume_id": _STRING,
            "reason": _STRING,
        })),
    })),
    "suggestions": _array_schema(_object_schema({
        "requirement": _STRING,
        "resume_id": _STRING,
        "suggestion": _STRING,
        "reason": _STRING,
    })),
    "removals": _array_schema(_object_schema({
        "resume_id": _STRING,
        "reason": _STRING,
    })),
    "improvements": _array_schema(_object_schema({
        "requirement": _STRING,
        "resume_id": {"type": ["string", "null"]},
        "improvement": _STRING,
        "reason": _STRING,
    })),
})

SUGGESTIONS_SCHEMA = _object_schema({
    "suggestions": _array_schema(_object_schema({
        "requirement": {"type": ["string", "null"]},
        "resume_id": _STRING,
        "suggestion": _STRING,
        "reason": _STRING,
        "action": {"type": "string", "enum": ["replace", "add"]},
        "section_name": _STRING,
        "new_entry": _object_schema({
            "skill_name": _STRING,
        }),
    })),
    "removals": ANALYSIS_SCHEMA["properties"]["removals"],
    "improvements": ANALYSIS_SCHEMA["properties"]["improvements"],
})

PROFESSIONAL_SUMMARY_PROMPT = """
Write three job-tailored professional summaries using the complete supplied
resume and job description. Return one option for each requested tone:
executive, technical, and concise.

Aim for 40-55 words in executive and technical summaries; keep each at
60 words or fewer, usually two sentences. Aim for 25-35 words in the concise
summary and keep it to 40 words or fewer, usually one or two sentences. There is no
minimum word count; prioritize complete, accurate wording over padding.
Select only the strongest relevant facts rather than listing every skill or
project. Tone changes emphasis, not length or the candidate's experience level.

The resume is the sole source of candidate facts. Emphasize relevant experience,
skills, education, and accomplishments already stated in the resume. Never
invent qualifications, tools, responsibilities, outcomes, or metrics, and do
not present requirements from the job description as candidate experience.
Use the job description to select relevant facts and terminology. Keep each
summary professional, accurate, and suitable for a resume.
Preserve factual accuracy and the strength of the original claims: coursework
is not professional experience, participation is not leadership, and using a
tool does not imply expertise. Do not add unsupported qualitative claims.
Check the facts and relevance, then draft it once. Do not spend reasoning on
minor wording revisions or repeatedly debate equivalent word choices. Focus
reasoning on factual accuracy, meaningful relevance, and concise presentation.

Return only JSON matching the supplied schema.
"""

PROFESSIONAL_SUMMARY_SCHEMA = _object_schema({
    "summaries": _array_schema(_object_schema({
        "tone": {
            "type": "string",
            "enum": ["executive", "technical", "concise"],
        },
        "text": _STRING,
    })),
})

EVIDENCE_SUGGESTION_PROMPT = """
You create targeted resume edits based only on the user's newly provided evidence.
Do not regenerate, review, or return any existing suggestions.

For every requested target section, create exactly one separate suggestion:
- If target_section is "Let AI decide", choose the single most appropriate
  concrete section using the user's evidence and existing resume. Return that
  concrete target_section, never "Let AI decide". Coursework usually belongs
  in an existing Education description. Do not turn interests, motivation,
  broad qualifications, or entire requirement sentences into skill names.
- Every suggestion field must contain a non-empty, useful value. In particular,
  "suggestion" must never be empty or whitespace-only. For action "add",
  include the complete proposed entry in "suggestion". For action "replace",
  put the complete replacement text in "suggestion".
- Professional Summary: return a complete replacement for the current
  professional summary. Use action "replace", resume_id
  "resume.professional_summary", and leave new_entry fields empty.
- Work Experience or Projects: choose the best fit between editing an existing
  description and adding a new entry. Prefer "replace" when an existing entry
  in that same target section is clearly related and can be improved using the
  user evidence. For a replacement, set resume_id to that exact description
  field path (for example "work_experience[0].description" or
  "projects[0].description") and leave new_entry fields empty. The suggestion
  must be the complete replacement text for that field.
- If no existing entry in Work Experience or Projects is a clear fit, add a
  new entry with action "add", leave resume_id empty, and fill only facts
  stated in the supplied user evidence. Unknown employer, title, location,
  dates, project name, or link must remain empty.
- Skills: add the explicitly supported skill as its own entry with action
  "add", an empty resume_id, and new_entry.skill_name set to the skill named
  by the requirement. Do not edit or combine it with an existing skill.
- Education: add only supported details to an existing education entry's
  description. Prefer action "replace" with resume_id set to that exact
  education description field (for example
  "education[0].description"), including when the current description is
  empty. Return the complete description and preserve the institution, degree,
  field of study, and dates. If no existing education entry is a fit, do not
  create an education record unless the user evidence explicitly supplies the
  institution and all facts needed for that record.

The user evidence is an explicit candidate claim. The current resume and job
description provide context, but do not use them to invent details for a new
entry or transfer details from another experience. Keep the wording
professionally cautious and accurate. Respect subjective statements about
interest, motivation, and passion as explicit user-provided evidence. When
Projects is selected, incorporate such evidence naturally into a relevant
existing project description while preserving its established technical details.
Do not invent circumstances such as independent development unless the resume or
user explicitly establishes them. Do not edit existing entries outside the
requested target section or any section that was not requested. For education
descriptions, do not invent courses, grades, qualifications, or academic
accomplishments.

Return one suggestion for each distinct requirement/target-section pair in
USER-PROVIDED EVIDENCE, and no other suggestions. Return only JSON matching the
requested schema.
"""

EVIDENCE_SUGGESTION_SCHEMA = _object_schema({
    "suggestions": _array_schema(_object_schema({
        "requirement": _STRING,
        "target_section": {
            "type": "string",
            "enum": [
                "Professional Summary", "Work Experience", "Projects",
                "Education", "Skills",
            ],
        },
        "action": {"type": "string", "enum": ["add", "replace"]},
        "resume_id": _STRING,
        "suggestion": _STRING,
        "reason": _STRING,
        "new_entry": _object_schema({
            "entry_title": _STRING,
            "company": _STRING,
            "location": _STRING,
            "start_date": _STRING,
            "end_date": _STRING,
            "description": _STRING,
            "link": _STRING,
            "skill_name": _STRING,
            "school": _STRING,
            "degree": _STRING,
            "field_of_study": _STRING,
        }),
    })),
})


def request_ai(
    content,
    schema_name,
    schema,
    reasoning_effort="high",
    request_id="unknown",
    stage="unknown",
):
    """Send a stage's prompt using the selected model's output settings."""
    provider = AI_PROVIDER
    if provider == "groq":
        if not GROQ_API_KEY:
            raise RuntimeError(
                "AI_PROVIDER is groq, but groq_api_key is not configured"
            )
        AI_MODEL_KEY = GROQ_API_KEY
        url = "https://api.groq.com/openai/v1/chat/completions"
        model = "qwen/qwen3.8-27b"
        payload = {
            "model": model,
            "max_completion_tokens": 12000,
            "messages": [{"role": "user", "content": content}],
            "reasoning_effort": reasoning_effort,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                },
            },
        }
    elif provider == "cerebras":
        if not CEREBRAS_API_KEY:
            raise RuntimeError(
                "AI_PROVIDER is cerebras, but cerebras_api_key is not configured"
            )
        AI_MODEL_KEY = CEREBRAS_API_KEY
        url = "https://api.cerebras.ai/v1/chat/completions"
        model = "qwen-3.8-27b"
        payload = {
            "model": model,
            "max_completion_tokens": 8000,
            "messages": [{"role": "user", "content": content}],
            "reasoning_effort": reasoning_effort,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                },
            },
        }
    elif provider == "openrouter":
        if not OPENROUTER_API_KEY:
            raise RuntimeError(
                "AI_PROVIDER is openrouter, but AI_MODEL_KEY is not configured"
            )
        AI_MODEL_KEY = OPENROUTER_API_KEY
        url = "https://openrouter.ai/api/v1/chat/completions"
        model = "nvidia/nemotron-3-ultra-550b-a55b:free"
        payload = {
            "model": model,
            "max_tokens": 12000,
            "messages": [{"role": "user", "content": content}],
            "reasoning": {"enabled": True, "effort": reasoning_effort},
        }
    else:
        raise ValueError(
            f"Unsupported AI_PROVIDER {provider!r}; "
            "use 'openrouter', 'groq', or 'cerebras'"
        )

    if provider == "openrouter" and not model.endswith(":free"):
        payload["response_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "strict": True,
                "schema": schema,
            },
        }
        payload["provider"] = {"require_parameters": True}

    started = perf_counter()
    logger.info(
        "AI provider call started request_id=%s provider=%s model=%s "
        "stage=%s attempt=1",
        request_id,
        provider,
        model,
        stage,
    )
    try:
        response = requests.post(
            url=url,
            headers={
            "Authorization": f"Bearer {AI_MODEL_KEY}",
            "Content-Type": "application/json",
            },
            data=json.dumps(payload),
            timeout=(10, 120),
        )
    except requests.Timeout as exc:
        logger.warning(
            "AI provider call timed out request_id=%s stage=%s "
            "elapsed_seconds=%.2f error_type=%s",
            request_id,
            stage,
            perf_counter() - started,
            type(exc).__name__,
        )
        raise
    except requests.RequestException as exc:
        logger.warning(
            "AI provider call failed request_id=%s stage=%s "
            "elapsed_seconds=%.2f error_type=%s",
            request_id,
            stage,
            perf_counter() - started,
            type(exc).__name__,
        )
        raise

    elapsed = perf_counter() - started
    try:
        response_body = response.json()
    except ValueError:
        response_body = {"body": response.text}
    _capture_provider_response(
        response_body,
        provider,
        model,
        stage,
        request_id,
        response.status_code,
    )
    rate_limit_headers = {
        key: value
        for key, value in response.headers.items()
        if key.casefold().startswith("x-ratelimit-")
        or key.casefold() == "retry-after"
    }
    usage = response_body.get("usage", {})
    usage = usage if isinstance(usage, dict) else {}
    completion_details = usage.get("completion_tokens_details", {})
    completion_details = (
        completion_details if isinstance(completion_details, dict) else {}
    )
    choices = response_body.get("choices", [])
    first_choice = choices[0] if isinstance(choices, list) and choices else {}
    finish_reason = (
        first_choice.get("finish_reason")
        if isinstance(first_choice, dict) else None
    )
    logger.info(
        "AI provider response request_id=%s stage=%s status=%s "
        "elapsed_seconds=%.2f completion_tokens=%s reasoning_tokens=%s "
        "finish_reason=%s headers=%s",
        request_id,
        stage,
        response.status_code,
        elapsed,
        usage.get("completion_tokens"),
        completion_details.get("reasoning_tokens", usage.get("reasoning_tokens")),
        finish_reason,
        json.dumps(rate_limit_headers, sort_keys=True),
    )
    if not response.ok:
        logger.warning(
            "AI provider call ended request_id=%s stage=%s status=%s "
            "elapsed_seconds=%.2f provider_error=%s",
            request_id,
            stage,
            response.status_code,
            elapsed,
            json.dumps(_safe_provider_error(response), sort_keys=True),
        )
    else:
        logger.info(
            "AI provider call ended request_id=%s stage=%s status=%s "
            "elapsed_seconds=%.2f",
            request_id,
            stage,
            response.status_code,
            elapsed,
        )
    return response


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
        "education": ["degree", "field_of_study", "description"],
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


SKILL_ALIASES = (
    ("javascript", "js", "ecmascript"),
    ("typescript", "ts"),
    ("postgresql", "postgres"),
    ("microsoft sql server", "sql server", "mssql"),
    ("c sharp", "c#"),
    ("c", "c programming", "c language"),
    ("c plus plus", "c++", "c++ programming"),
    ("node js", "nodejs", "node.js"),
    ("react", "reactjs"),
    ("vue js", "vue.js", "vuejs"),
    ("amazon web services", "aws"),
    ("google cloud platform", "gcp", "google cloud"),
    ("microsoft azure", "azure"),
    ("machine learning", "ml"),
    ("artificial intelligence", "ai"),
    ("natural language processing", "nlp"),
    ("continuous integration", "ci"),
    ("continuous delivery", "cd"),
    ("ci cd", "cicd"),
    ("microsoft excel", "excel"),
    ("power bi", "powerbi"),
    ("version control", "source control"),
)

SKILL_CATEGORIES = {
    "programming languages": (
        "programming language", "programming languages", "coding language",
        "coding languages", "software development experience",
        "developing software systems", "software systems",
        "software design and development", "python", "java", "javascript",
        "typescript", "c sharp", "c plus plus", "golang", "rust", "ruby",
        "php", "swift", "kotlin",
    ),
    "software development": (
        "software development", "software engineering", "full stack",
        "full-stack", "application development", "web application development",
    ),
    "databases": (
        "database", "databases", "sql", "mysql", "postgresql", "postgres",
        "sqlite", "mongodb", "nosql", "data storage", "database schema",
        "relational schema",
    ),
    "cloud platforms": (
        "cloud", "cloud computing", "aws", "amazon web services", "azure",
        "gcp", "google cloud",
    ),
    "web development": (
        "web development", "frontend", "front end", "backend", "back end",
        "web application development", "web application", "web applications",
        "web app", "web apps", "application development", "dashboard",
        "html", "css", "javascript", "react", "angular", "vue",
    ),
    "generative AI": (
        "generative AI", "large language model", "large language models",
        "LLM", "LLMs", "AI workflow", "AI application",
    ),
    "data analytics": (
        "data analytics", "data analysis", "analytics", "data visualization",
        "tableau", "power bi", "excel", "pandas",
    ),
    "version control": (
        "version control", "source control", "git", "github", "gitlab",
    ),
    "project management": (
        "project management", "agile", "scrum", "kanban",
    ),
    "containers": (
        "container", "containers", "containerization", "docker", "kubernetes",
    ),
    "api development": (
        "api", "apis", "rest", "restful", "graphql", "web services",
        "networking", "network protocols",
    ),
}


def _search_tokens(value):
    return re.findall(r"[a-z0-9]+(?:[+#]+)?", str(value).casefold())


def _normalized_phrase(value):
    return " ".join(_search_tokens(value))


def _alias_terms(term):
    normalized = _normalized_phrase(term)
    for group in SKILL_ALIASES:
        normalized_group = {_normalized_phrase(alias) for alias in group}
        if normalized in normalized_group:
            return normalized_group
    return {normalized} if normalized else set()


def _contains_phrase(text_tokens, phrase_tokens):
    if not phrase_tokens or len(phrase_tokens) > len(text_tokens):
        return False
    width = len(phrase_tokens)
    return any(
        text_tokens[index:index + width] == phrase_tokens
        for index in range(len(text_tokens) - width + 1)
    )


def _exact_or_alias_match(text, term):
    text_tokens = _search_tokens(text)
    return any(
        _contains_phrase(text_tokens, _search_tokens(alias))
        for alias in _alias_terms(term)
    )


def _fuzzy_match(text, term):
    term_tokens = _search_tokens(term)
    if not term_tokens or any(len(token) < 4 for token in term_tokens):
        return False
    text_tokens = _search_tokens(text)
    width = len(term_tokens)
    for candidate_width in range(max(1, width - 1), min(len(text_tokens), width + 1) + 1):
        for index in range(len(text_tokens) - candidate_width + 1):
            candidate = " ".join(text_tokens[index:index + candidate_width])
            target = " ".join(term_tokens)
            if SequenceMatcher(None, target, candidate).ratio() >= 0.88:
                return True
    return False


def _requirement_categories(requirement, direct_terms, related_terms):
    terms = [requirement, *direct_terms, *related_terms]
    return {
        category
        for category, indicators in SKILL_CATEGORIES.items()
        if any(
            _exact_or_alias_match(term, indicator)
            for term in terms
            for indicator in indicators
        )
    }


def _degree_levels(value):
    tokens = set(_search_tokens(value))
    levels = set()
    if tokens.intersection({"bachelor", "bachelors", "baccalaureate"}):
        levels.add("bachelor")
    if tokens.intersection({"master", "masters", "mba"}):
        levels.add("master")
    if tokens.intersection({"doctorate", "doctoral", "phd"}):
        levels.add("doctoral")
    return levels


ENGLISH_FUNCTION_WORDS = {
    "a", "an", "and", "are", "as", "be", "by", "for", "from", "in",
    "is", "of", "on", "or", "that", "the", "this", "to", "was", "were",
    "with",
}


def _is_english_proficiency_requirement(requirement):
    tokens = set(_search_tokens(requirement))
    return "english" in tokens and bool(
        tokens.intersection({
            "proficiency", "proficient", "fluency", "fluent", "language",
            "communication", "written", "verbal",
        })
    )


def _has_substantial_english_text(evidence):
    tokens = [
        token
        for item in evidence
        for token in _search_tokens(item.get("relevant_text", ""))
        if token.isalpha()
    ]
    return (
        len(tokens) >= 50
        and sum(token in ENGLISH_FUNCTION_WORDS for token in tokens) >= 8
    )


def _category_evidence_match(text, category):
    indicators = SKILL_CATEGORIES[category]
    for indicator in indicators:
        if not _exact_or_alias_match(text, indicator):
            continue
        if indicator == "dashboard" and not any(
            _exact_or_alias_match(text, context)
            for context in ("api", "endpoint", "http", "web application", "filters")
        ):
            continue
        return True
    return False


def _broad_software_requirement(requirement):
    normalized = _normalized_phrase(requirement)
    return any(
        phrase in normalized
        for phrase in (
            "software development",
            "software systems",
            "software design",
            "software engineering",
            "application development",
            "web application development",
        )
    )


def _broad_programming_requirement(requirement):
    normalized = _normalized_phrase(requirement)
    return any(
        phrase in normalized
        for phrase in (
            "programming language",
            "programming experience",
            "coding language",
            "coding experience",
            "software development",
            "software systems",
            "software design",
        )
    )


def _has_development_activity(text):
    tokens = set(_search_tokens(text))
    return bool(tokens.intersection({
        "built", "build", "building", "created", "create", "creating",
        "developed", "develop", "developing", "designed", "design",
        "designing", "implemented", "implement", "implementing",
        "engineered", "engineer", "engineering", "programmed", "program",
        "programming", "constructed", "construct", "constructing",
    }))


def _substantive_category_match(text, category, requirement, resume_id):
    normalized_text = _normalized_phrase(text)
    if category == "version control":
        normalized_requirement = _normalized_phrase(requirement)
        if any(
            mandatory in normalized_requirement
            for mandatory in ("jenkins", "continuous integration", "ci cd")
        ):
            return False
        return _exact_or_alias_match(text, "git")
    if category == "software development" and _broad_software_requirement(requirement):
        project_context = resume_id.startswith("projects[")
        full_stack_project = "full stack" in normalized_text
        software_project = "software development" in normalized_text
        application_work = any(
            phrase in normalized_text
            for phrase in (
                "application", "applications", "web app", "web apps",
                "software system", "software systems",
            )
        )
        return (
            (project_context and (full_stack_project or software_project))
            or (
                application_work
                and _has_development_activity(text)
            )
        )
    if category == "databases":
        schema_design = (
            bool(
                set(normalized_text.split()).intersection(
                    {"designed", "design", "designing"}
                )
            )
            and any(term in normalized_text for term in ("schema", "database"))
            and any(
                _exact_or_alias_match(text, term)
                for term in ("postgresql", "postgres", "mysql", "sqlite", "database")
            )
        )
        return schema_design
    if category == "web development":
        web_application = any(
            phrase in normalized_text
            for phrase in ("web application", "web applications", "web app", "web apps")
        )
        return web_application and _has_development_activity(text)
    if category == "generative AI":
        normalized_requirement = _normalized_phrase(requirement)
        if not any(
            phrase in normalized_requirement
            for phrase in ("generative ai", "large language model", "llm")
        ):
            return False
        llm_workflow = any(
            phrase in normalized_text
            for phrase in (
                "large language model workflow", "llm workflow",
                "generative ai workflow", "generative ai application",
            )
        )
        return llm_workflow and _has_development_activity(text)
    return False


def _match_resume_requirements(evidence, requirements, user_evidence):
    user_evidence = _validate_user_evidence(user_evidence)
    result = []
    group_logic_by_name = {}
    for requirement_item in requirements.get("requirements", []):
        requirement = requirement_item["requirement"]
        group = requirement_item.get("group") or requirement
        group_logic = requirement_item.get("group_logic", "all")
        group_key = _normalized_phrase(group)
        if not group_key:
            raise ValueError("Requirement groups must have a non-empty name")
        previous_logic = group_logic_by_name.setdefault(group_key, group_logic)
        if previous_logic != group_logic:
            raise ValueError(
                f"Requirement group {group!r} has inconsistent group logic"
            )
        direct_terms = [
            term for term in requirement_item.get("direct_search_terms", [])
            if isinstance(term, str) and term.strip()
        ]
        related_terms = [
            term for term in requirement_item.get("related_search_terms", [])
            if isinstance(term, str) and term.strip()
        ]
        degree_levels = set().union(
            *(_degree_levels(term) for term in [requirement, *direct_terms])
        )
        categories = _requirement_categories(
            requirement, direct_terms, related_terms
        )
        mappings = {}
        classification = "unsupported"
        english_heuristic = (
            _is_english_proficiency_requirement(requirement)
            and _has_substantial_english_text(evidence)
        )
        if english_heuristic:
            classification = "supported"
            source = max(
                evidence,
                key=lambda item: len(_search_tokens(item.get("relevant_text", ""))),
            )
            mappings[source["resume_id"]] = {
                "resume_id": source["resume_id"],
                "source": "resume",
                "reason": (
                    "ATS-only inference from substantial English-language resume "
                    "text; do not generate a resume rewrite from this inference."
                ),
            }

        for resume_item in evidence:
            text = resume_item.get("relevant_text", "")
            resume_id = resume_item.get("resume_id")
            if not isinstance(text, str) or not isinstance(resume_id, str):
                continue
            if degree_levels:
                resume_degree_levels = _degree_levels(text)
                if not degree_levels.intersection(resume_degree_levels):
                    continue
                classification = "supported"
                mappings[resume_id] = {
                    "resume_id": resume_id,
                    "source": "resume",
                    "reason": "Matching degree-level evidence.",
                }
                continue
            reasons = []
            direct_matches = [
                _exact_or_alias_match(text, term) for term in direct_terms
            ]
            direct_match = bool(direct_matches) and (
                all(direct_matches) if group_logic == "all"
                else any(direct_matches)
            )
            if direct_match:
                classification = "supported"
                reasons.append("Direct or alias match.")
            elif any(
                _substantive_category_match(
                    text, category, requirement, resume_id
                )
                for category in categories
            ):
                classification = "supported"
                reasons.append(
                    "Substantive project or implementation evidence."
                )
            elif any(_exact_or_alias_match(text, term) for term in related_terms):
                if classification != "supported":
                    classification = "partial"
                reasons.append("Related search-term match.")
            elif any(_fuzzy_match(text, term) for term in direct_terms):
                if classification != "supported":
                    classification = "partial"
                reasons.append("Possible fuzzy match; verify wording.")
            elif any(_fuzzy_match(text, term) for term in related_terms):
                if classification != "supported":
                    classification = "partial"
                reasons.append("Possible fuzzy related match; verify wording.")
            elif any(
                _category_evidence_match(text, category)
                for category in categories
                if category != "programming languages"
                or _broad_programming_requirement(requirement)
                if not (
                    category == "programming languages"
                    and _broad_software_requirement(requirement)
                    and resume_id.startswith("skills[")
                )
            ):
                if classification != "supported":
                    classification = "partial"
                reasons.append("Related category match; verify relevance.")
            if reasons:
                mappings[resume_id] = {
                    "resume_id": resume_id,
                    "source": "resume",
                    "reason": " ".join(reasons),
                }

        requirement_aliases = (
            _alias_terms(requirement) | _alias_terms(group)
        )
        for index, item in enumerate(user_evidence):
            if _normalized_phrase(item["requirement"]) in requirement_aliases:
                classification = "supported"
                mappings[f"user_evidence[{index}]"] = {
                    "resume_id": f"user_evidence[{index}]",
                    "source": "user",
                    "reason": "Explicit candidate-provided evidence.",
                }

        result.append({
            "requirement": requirement,
            "group": group,
            "group_logic": group_logic,
            "importance": requirement_item["importance"],
            "classification": classification,
            "evidence": list(mappings.values()),
        })
    return {"evidence": result}


def _summarize_requirement_groups(entries):
    groups = {}
    for item in entries:
        group = item.get("group") or item["requirement"]
        key = _normalized_phrase(group)
        group_items = groups.setdefault(key, {
            "requirement": group,
            "group": group,
            "group_logic": item.get("group_logic", "all"),
            "items": [],
        })
        if group_items["group_logic"] != item.get("group_logic", "all"):
            raise ValueError(
                f"Requirement group {group!r} has inconsistent group logic"
            )
        group_items["items"].append(item)

    summaries = []
    for group in groups.values():
        classifications = {
            item["classification"] for item in group["items"]
        }
        if group["group_logic"] == "any":
            classification = (
                "supported" if "supported" in classifications else
                "partial" if "partial" in classifications else
                "unsupported"
            )
        else:
            classification = (
                "supported" if classifications == {"supported"} else
                "partial" if classifications.intersection({"supported", "partial"})
                else "unsupported"
            )
        summaries.append({
            "requirement": group["requirement"],
            "group": group["group"],
            "group_logic": group["group_logic"],
            "classification": classification,
            "items": group["items"],
        })
    return summaries


def parse_ai_response(response, request_id="unknown", stage="unknown"):
    """Parse an AI response while logging only response structure and error metadata."""
    response.raise_for_status()
    try:
        body = response.json()
    except ValueError as exc:
        logger.warning(
            "AI provider response JSON decoding failed request_id=%s "
            "stage=%s status=%s error_type=%s",
            request_id,
            stage,
            response.status_code,
            type(exc).__name__,
        )
        raise

    choices = body.get("choices") if isinstance(body, dict) else None
    if not isinstance(choices, list) or not choices:
        logger.warning(
            "AI provider response missing choices request_id=%s stage=%s "
            "status=%s body_type=%s top_level_keys=%s provider_error=%s",
            request_id,
            stage,
            response.status_code,
            type(body).__name__,
            sorted(str(key) for key in body.keys())[:12]
            if isinstance(body, dict) else [],
            json.dumps(_safe_provider_error(response), sort_keys=True),
        )
        raise KeyError("AI provider response missing choices")

    first_choice = choices[0]
    finish_reason = (
        first_choice.get("finish_reason")
        if isinstance(first_choice, dict) else None
    )
    usage = body.get("usage", {}) if isinstance(body, dict) else {}
    usage = usage if isinstance(usage, dict) else {}
    completion_details = usage.get("completion_tokens_details", {})
    completion_details = (
        completion_details if isinstance(completion_details, dict) else {}
    )
    if finish_reason == "length":
        completion_tokens = usage.get("completion_tokens")
        reasoning_tokens = completion_details.get(
            "reasoning_tokens", usage.get("reasoning_tokens")
        )
        logger.warning(
            "AI response exhausted completion tokens request_id=%s stage=%s "
            "completion_tokens=%s reasoning_tokens=%s finish_reason=%s",
            request_id,
            stage,
            completion_tokens,
            reasoning_tokens,
            finish_reason,
        )
        raise ValueError(
            "AI response exhausted its completion-token budget "
            f"(completion_tokens={completion_tokens}, "
            f"reasoning_tokens={reasoning_tokens})"
        )

    message = (
        first_choice.get("message")
        if isinstance(first_choice, dict) else None
    )
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str):
        logger.warning(
            "AI provider response missing message content request_id=%s "
            "stage=%s status=%s choice_type=%s message_type=%s",
            request_id,
            stage,
            response.status_code,
            type(first_choice).__name__,
            type(message).__name__,
        )
        raise ValueError("AI provider response missing message content")

    try:
        result = json.loads(content)
    except json.JSONDecodeError as exc:
        logger.warning(
            "AI content JSON parsing failed request_id=%s stage=%s "
            "line=%s column=%s",
            request_id,
            stage,
            exc.lineno,
            exc.colno,
        )
        raise

    if stage == "evidence_suggestion" and isinstance(result, list):
        result = {"suggestions": result}

    if stage == "job_requirements":
        requirements = result.get("requirements") if isinstance(result, dict) else None
        validation_errors = []
        if not isinstance(requirements, list):
            validation_errors.append("'requirements' must be a list")
        else:
            normalized_requirements = []
            seen_requirements = {}
            group_logic = {}
            for index, item in enumerate(requirements):
                if not isinstance(item, dict):
                    validation_errors.append(
                        f"requirements[{index}] must be an object"
                    )
                    continue
                item_valid = True
                if not isinstance(item.get("requirement"), str) or not item.get(
                    "requirement", ""
                ).strip():
                    validation_errors.append(
                        f"requirements[{index}].requirement must be a non-empty string"
                    )
                    item_valid = False
                if item.get("importance") not in {
                    "required", "desired", "mentioned"
                }:
                    validation_errors.append(
                        f"requirements[{index}].importance is invalid"
                    )
                    item_valid = False
                if not isinstance(item.get("group"), str) or not item.get(
                    "group", ""
                ).strip():
                    validation_errors.append(
                        f"requirements[{index}].group must be a non-empty string"
                    )
                    item_valid = False
                if item.get("group_logic") not in {"all", "any"}:
                    validation_errors.append(
                        f"requirements[{index}].group_logic is invalid"
                    )
                    item_valid = False
                for field in ("direct_search_terms", "related_search_terms"):
                    if not isinstance(item.get(field), list):
                        validation_errors.append(
                            f"requirements[{index}].{field} must be a list"
                        )
                        item_valid = False
                if not item_valid:
                    continue
                requirement_key = _normalized_phrase(item["requirement"])
                group_key = _normalized_phrase(item["group"])
                previous_logic = group_logic.setdefault(
                    group_key, item["group_logic"]
                )
                if previous_logic != item["group_logic"]:
                    validation_errors.append(
                        f"requirements[{index}] conflicts with group_logic "
                        f"for group {item['group']!r}"
                    )
                    continue
                if requirement_key in seen_requirements:
                    existing = normalized_requirements[
                        seen_requirements[requirement_key]
                    ]
                    if (
                        _normalized_phrase(existing["group"]) != group_key
                        or existing["group_logic"] != item["group_logic"]
                        or existing["importance"] != item["importance"]
                    ):
                        validation_errors.append(
                            f"requirements[{index}] duplicates a requirement "
                            "with conflicting group or importance"
                        )
                        continue
                    for field in (
                        "direct_search_terms", "related_search_terms"
                    ):
                        existing_terms = {
                            _normalized_phrase(term)
                            for term in existing[field]
                            if isinstance(term, str)
                        }
                        for term in item[field]:
                            if (
                                isinstance(term, str)
                                and _normalized_phrase(term) not in existing_terms
                            ):
                                existing[field].append(term)
                                existing_terms.add(_normalized_phrase(term))
                    continue
                seen_requirements[requirement_key] = len(normalized_requirements)
                normalized_requirements.append(item)
            if not validation_errors:
                result["requirements"] = normalized_requirements
        valid = not validation_errors
    elif stage == "resume_analysis":
        valid = isinstance(result, dict) and all(
            isinstance(result.get(key), list)
            for key in ("evidence", "suggestions", "removals", "improvements")
        )
    elif stage == "resume_suggestions":
        valid = isinstance(result, dict) and all(
            isinstance(result.get(key), list)
            for key in ("suggestions", "removals", "improvements")
        )
    elif stage == "evidence_suggestion":
        valid = isinstance(result, dict) and isinstance(
            result.get("suggestions"), list
        ) and all(
            isinstance(item, dict)
            for item in result["suggestions"]
        )
    else:
        valid = True

    if not valid:
        shape = {
            "response_type": type(result).__name__,
            "top_level_keys": sorted(str(key) for key in result)[:12]
            if isinstance(result, dict) else [],
            "evidence_type": type(result.get("evidence")).__name__
            if isinstance(result, dict) else "unavailable",
        }
        if stage == "job_requirements":
            logger.warning(
                "AI job requirements validation failed request_id=%s "
                "errors=%s",
                request_id,
                json.dumps(validation_errors),
            )
        else:
            logger.warning(
                "AI schema validation failed request_id=%s stage=%s "
                "reason=invalid_response_shape response_shape=%s",
                request_id,
                stage,
                json.dumps(shape, sort_keys=True),
            )
        raise ValueError(f"AI response failed {stage} schema validation")
    return result


def build_frontend_response(stage_3, stage_2):
    """Map tailoring results to frontend fields using Stage 2 classifications."""
    requirements = {
        item["requirement"]: item
        for item in stage_2.get("evidence", [])
    }
    importance_values = {"required": 3, "desired": 2, "mentioned": 1}
    group_summaries = _summarize_requirement_groups(
        list(requirements.values())
    )
    requirements_met = sum(
        item.get("classification") == "supported"
        for item in group_summaries
    )
    requirements_missing = sum(
        item.get("classification") == "unsupported"
        for item in group_summaries
    )
    partial_count = sum(
        item.get("classification") == "partial"
        for item in group_summaries
    )
    total = len(group_summaries)

    frontend_response = {
        "suggestions": [],
        "improvements": [],
        "removals": [
            {
                "relevant_text": item["text"],
                "reason": item["reason"],
                "resume_id": item["resume_id"],
            }
            for item in stage_3.get("removals", [])
        ],
        "missing_requirements": [
            {"requirement": item["requirement"]}
            for item in group_summaries
            if item["classification"] == "unsupported"
        ],
        "ATS_score": round(
            (requirements_met + 0.5 * partial_count) / total * 100
        ) if total else 0,
        "requirements_met": [
            {"requirement": item["requirement"]}
            for item in group_summaries
            if item["classification"] == "supported"
        ],
        "requirements_missing": requirements_missing,
    }

    def find_requirement(name):
        requirement = requirements.get(name)
        if requirement is not None:
            return requirement
        matching_group = next(
            (
                item for item in requirements.values()
                if _normalized_phrase(item.get("group", "")) == _normalized_phrase(name)
            ),
            None,
        )
        if matching_group is None:
            raise KeyError(f"AI returned unknown requirement: {name!r}")
        return matching_group

    for item in stage_3.get("suggestions", []):
        requirement = (
            find_requirement(item["requirement"])
            if item["requirement"] is not None else None
        )
        suggestion = {
            "suggestion": item["suggestion"],
            "type": requirement["classification"] if requirement else "general",
            "requirement": item["requirement"],
            "importance": importance_values[requirement["importance"]] if requirement else 0,
            "before": item["relevant_text"],
            "reason": item["reason"],
            "resume_id": item["resume_id"],
        }
        if item.get("action") == "add":
            suggestion.update({
                "action": "add",
                "section_name": item["section_name"],
                "new_entry": item["new_entry"],
            })
        frontend_response["suggestions"].append(suggestion)

    for item in stage_3.get("improvements", []):
        requirement = find_requirement(item["requirement"])
        frontend_response["improvements"].append({
            "improvement": item["improvement"],
            "type": requirement["classification"],
            "requirement": item["requirement"],
            "reason": item["reason"],
            "resume_id": item.get("resume_id"),
        })

    return frontend_response


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
        # Summary text is nested under "resume" in the API payload, but the
        # model may omit that prefix when returning a field reference.
        if (
            isinstance(path, str)
            and path not in locations
            and f"resume.{path}" in locations
        ):
            path = f"resume.{path}"
        # Some model outputs incorrectly put every section under resume.
        if isinstance(path, str) and path not in locations and path.startswith("resume."):
            candidate = path.removeprefix("resume.")
            if candidate in locations:
                path = candidate
        if isinstance(path, str) and path in locations and path not in fields:
            section = path.split(".", 1)[0].split("[", 1)[0]
            preferred_fields = {
                "certifications": ("name",),
                "education": ("degree", "field_of_study", "school"),
                "projects": ("description", "name"),
                "skills": ("skill_name",),
                "work_experience": ("description", "job_title"),
            }.get(section, ())
            descendants = [
                candidate for candidate, text in fields.items()
                if (candidate.startswith(f"{path}.") or candidate.startswith(f"{path}["))
                and text.strip()
            ]
            path = next(
                (
                    candidate for field in preferred_fields
                    for candidate in descendants
                    if candidate.endswith(f".{field}")
                ),
                next(iter(descendants), path),
            )
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

    normalized_suggestions = []
    normalized_removals = [
        {**item, "resume_id": resolve(item), "text": original(item)}
        for item in response.get("removals", [])
    ]
    for item in response.get("suggestions", []):
        if item.get("action") == "add":
            entry = item.get("new_entry")
            skill_name = entry.get("skill_name") if isinstance(entry, dict) else None
            if (
                item.get("section_name") != "Skills"
                or item.get("resume_id") not in {
                    "", "skills", "resume.skills",
                    "skills.skill_name", "resume.skills.skill_name",
                }
                or not isinstance(skill_name, str)
                or not skill_name.strip()
            ):
                raise ValueError("AI returned an invalid new skill suggestion")
            normalized_suggestions.append({
                **item,
                "resume_id": "",
                "relevant_text": "",
                "suggestion": skill_name.strip(),
                "new_entry": {"skill_name": skill_name.strip()},
            })
        else:
            # An empty replacement deletes content; present it through the
            # removal review flow rather than failing the entire response.
            if isinstance(item.get("suggestion"), str) and not item["suggestion"].strip():
                text = original(item)
                if not text.strip():
                    continue
                path = resolve(item)
                if not any(removal["resume_id"] == path for removal in normalized_removals):
                    normalized_removals.append({
                        "resume_id": path,
                        "text": text,
                        "reason": item["reason"],
                    })
                continue
            normalized_suggestions.append({
                **item,
                "resume_id": resolve(item),
                "relevant_text": original(item),
                "action": "replace",
            })

    return {
        **response,
        "suggestions": normalized_suggestions,
        "improvements": [
            {**item, "resume_id": resolve(item) if item.get("resume_id") else None}
            for item in response.get("improvements", [])
        ],
        "removals": normalized_removals,
    }


def extract_requirements(job, requirements=None, request_id=None, timings=None):
    request_id = request_id or uuid4().hex
    timings = timings if timings is not None else {}
    if requirements is not None:
        logger.info(
            "AI pipeline stage skipped request_id=%s stage=job_requirements "
            "reason=cached_requirements",
            request_id,
        )
        return requirements

    job_input = {
        "title": job.get("title"),
        "company": job.get("company", job.get("company_name")),
        "description": job.get("description"),
    }
    started = perf_counter()
    logger.info(
        "AI pipeline stage started request_id=%s stage=job_requirements",
        request_id,
    )
    response = request_ai(
        prompt + "\nJob description:\n" + json.dumps(job_input),
        schema_name="job_requirements",
        schema=REQUIREMENTS_SCHEMA,
        reasoning_effort="low",
        request_id=request_id,
        stage="job_requirements",
    )
    requirements = parse_ai_response(
        response, request_id=request_id, stage="job_requirements"
    )
    timings["Stage 1: job requirements"] = perf_counter() - started
    logger.info(
        "AI pipeline stage ended request_id=%s stage=job_requirements "
        "elapsed_seconds=%.2f",
        request_id,
        timings["Stage 1: job requirements"],
    )
    return requirements


def _validate_user_evidence(user_evidence):
    if user_evidence is None:
        return []
    if not isinstance(user_evidence, list):
        raise ValueError("user_evidence must be a list")
    valid_sections = {
        "Let AI decide",
        "Work Experience", "Professional Summary", "Projects", "Education",
        "Skills", "Certifications",
    }
    normalized = []
    for index, item in enumerate(user_evidence):
        if not isinstance(item, dict):
            raise ValueError(f"user_evidence[{index}] must be an object")
        requirement = item.get("requirement")
        evidence = item.get("evidence")
        target_section = item.get("target_section")
        if not isinstance(requirement, str) or not requirement.strip():
            raise ValueError(f"user_evidence[{index}].requirement is required")
        if not isinstance(evidence, str) or not evidence.strip():
            raise ValueError(f"user_evidence[{index}].evidence is required")
        if target_section not in valid_sections:
            raise ValueError(f"user_evidence[{index}].target_section is invalid")
        normalized.append({
            "requirement": requirement.strip(),
            "evidence": evidence.strip(),
            "target_section": target_section,
            "source": "user",
        })
    return normalized


USER_EVIDENCE_STOP_WORDS = {
    "a", "an", "and", "for", "in", "of", "the", "to", "with",
}


def _resolve_requirement_name(requirement_name, requirements):
    requested = _normalized_phrase(requirement_name)
    requested_tokens = set(requested.split()) - USER_EVIDENCE_STOP_WORDS
    requirement_rows = requirements.get("requirements", [])
    matches = {}
    for requirement_item in requirement_rows:
        if not isinstance(requirement_item, dict):
            continue
        canonical = requirement_item.get("requirement")
        if not isinstance(canonical, str) or not canonical.strip():
            continue
        identifiers = [
            canonical,
            requirement_item.get("group", ""),
            *requirement_item.get("direct_search_terms", []),
            *requirement_item.get("related_search_terms", []),
        ]
        score = 0
        for identifier in identifiers:
            if not isinstance(identifier, str):
                continue
            normalized = _normalized_phrase(identifier)
            if not normalized:
                continue
            if requested == normalized or requested in _alias_terms(identifier):
                score = max(score, 3)
            elif (
                f" {requested} " in f" {normalized} "
                or f" {normalized} " in f" {requested} "
            ):
                score = max(score, 2)
            else:
                identifier_tokens = (
                    set(normalized.split()) - USER_EVIDENCE_STOP_WORDS
                )
                if requested_tokens and requested_tokens <= identifier_tokens:
                    score = max(score, 1)
        if score:
            matches[canonical] = max(matches.get(canonical, 0), score)
    if not matches:
        return None
    highest = max(matches.values())
    canonical_matches = [
        name for name, score in matches.items() if score == highest
    ]
    return canonical_matches[0] if len(canonical_matches) == 1 else None


def _canonicalize_user_evidence(user_evidence, requirements):
    evidence = _validate_user_evidence(user_evidence)
    for evidence_item in evidence:
        canonical = _resolve_requirement_name(
            evidence_item["requirement"], requirements
        )
        if canonical:
            evidence_item["requirement"] = canonical
    return evidence


def analyze_resume_requirements(
    structured_resume,
    requirements,
    user_evidence=None,
    request_id=None,
    timings=None,
):
    request_id = request_id or uuid4().hex
    timings = timings if timings is not None else {}
    user_evidence = _canonicalize_user_evidence(
        user_evidence, requirements
    )
    started = perf_counter()
    logger.info(
        "AI pipeline stage started request_id=%s stage=evidence_preprocessing",
        request_id,
    )
    resume_evidence = process_resume(structured_resume)["evidence"]
    timings["Evidence preprocessing"] = perf_counter() - started
    logger.info(
        "AI pipeline stage ended request_id=%s stage=evidence_preprocessing "
        "elapsed_seconds=%.2f",
        request_id,
        timings["Evidence preprocessing"],
    )

    started = perf_counter()
    logger.info(
        "AI pipeline stage started request_id=%s stage=resume_matching mode=local",
        request_id,
    )
    matching = _match_resume_requirements(
        resume_evidence, requirements, user_evidence
    )
    expected = {
        item["requirement"]: {
            "importance": item["importance"],
            "group": item.get("group") or item["requirement"],
            "group_logic": item.get("group_logic", "all"),
        }
        for item in requirements["requirements"]
    }
    entries = matching["evidence"]
    names = [item.get("requirement") for item in entries]
    if set(names) != set(expected) or len(names) != len(set(names)):
        raise ValueError("Resume matching must classify each requirement exactly once")

    resume_ids = {item["resume_id"] for item in resume_evidence}
    user_ids = {f"user_evidence[{index}]" for index in range(len(user_evidence))}
    by_requirement = {}
    for entry in entries:
        requirement = expected[entry["requirement"]]
        if entry.get("importance") != requirement["importance"]:
            raise ValueError("Resume matching returned incorrect requirement importance")
        if (
            entry.get("group") != requirement["group"]
            or entry.get("group_logic") != requirement["group_logic"]
        ):
            raise ValueError("Resume matching returned incorrect requirement group")
        if entry.get("classification") not in {"supported", "partial", "unsupported"}:
            raise ValueError("Resume matching returned an invalid classification")
        resume_mappings = []
        user_mappings = []
        for item in entry.get("evidence", []):
            source = item.get("source")
            path = item.get("resume_id")
            if source == "user":
                if path not in user_ids:
                    raise ValueError(f"AI returned unknown user evidence reference: {path!r}")
                user_mappings.append(item)
            elif source == "resume":
                if path not in resume_ids:
                    raise ValueError(f"AI returned unknown resume evidence reference: {path!r}")
                resume_mappings.append(item)
            else:
                raise ValueError("Resume matching returned an invalid evidence source")
        normalized_resume = restore_combined_resume_text(
            {"evidence": resume_mappings},
            structured_resume,
        )["evidence"]
        by_requirement[entry["requirement"]] = {
            **entry,
            **requirement,
            "evidence": normalized_resume + user_mappings,
        }

    result_entries = list(by_requirement.values())
    group_summaries = _summarize_requirement_groups(result_entries)
    group_classifications = {
        _normalized_phrase(item["group"]): item["classification"]
        for item in group_summaries
    }
    for item in result_entries:
        item["group_classification"] = group_classifications[
            _normalized_phrase(item["group"])
        ]
    supported_count = sum(
        item["classification"] == "supported" for item in group_summaries
    )
    partial_count = sum(
        item["classification"] == "partial" for item in group_summaries
    )
    unsupported_count = sum(
        item["classification"] == "unsupported" for item in group_summaries
    )
    total = len(group_summaries)
    analysis = {
        "suggestions": [],
        "improvements": [],
        "removals": [],
        "ATS_score": round(
            (supported_count + 0.5 * partial_count) / total * 100
        ) if total else 0,
        "requirements_met": [
            {"requirement": item["requirement"]}
            for item in group_summaries
            if item["classification"] == "supported"
        ],
        "requirements_missing": unsupported_count,
        "missing_requirements": [
            {"requirement": item["requirement"]}
            for item in group_summaries
            if item["classification"] == "unsupported"
        ],
        "requirements": requirements,
        "evidence": result_entries,
    }
    timings["Stage 2: resume matching"] = perf_counter() - started
    logger.info(
        "AI pipeline stage ended request_id=%s stage=resume_matching mode=local "
        "elapsed_seconds=%.2f",
        request_id,
        timings["Stage 2: resume matching"],
    )
    return analysis


def deduplicate_suggestions(response):
    if not isinstance(response, dict):
        raise ValueError("AI suggestions response must be an object")
    suggestions = response.get("suggestions")
    if not isinstance(suggestions, list):
        raise ValueError("AI suggestions must be a list")
    unique = []
    by_field = {}
    for item in suggestions:
        if not isinstance(item, dict):
            raise ValueError("AI suggestions must contain objects")
        original = item.get("relevant_text")
        suggestion = item.get("suggestion")
        resume_id = item.get("resume_id")
        action = item.get("action", "replace")
        if (
            not isinstance(original, str)
            or not isinstance(suggestion, str)
            or not isinstance(resume_id, str)
            or action not in {"replace", "add"}
        ):
            raise ValueError("AI suggestion fields are malformed")
        if (action == "replace" and (not resume_id or not original.strip())) or not suggestion.strip():
            raise ValueError("AI suggestions must contain replacement text")
        if action == "replace" and original == suggestion:
            continue
        if action == "add":
            if (
                item.get("section_name") != "Skills"
                or resume_id
                or item.get("new_entry", {}).get("skill_name") != suggestion
            ):
                raise ValueError("AI returned an invalid skill addition")
            key = f"add:skills:{_normalized_phrase(suggestion)}"
        else:
            key = f"replace:{resume_id}"
        previous = by_field.get(key)
        if previous is not None and previous["suggestion"] != suggestion:
            raise ValueError(
                f"AI returned conflicting suggestions for resume field {key!r}"
            )
        if previous is not None:
            continue
        by_field[key] = item
        unique.append(item)
    return {**response, "suggestions": unique}


def _keep_supported_skill_additions(
    response, structured_resume, analysis, requirements, user_evidence=None
):
    """Pass AI skill suggestions through, excluding already-listed skills."""
    existing_skills = {
        _normalized_phrase(item["skill_name"])
        for item in structured_resume.get("skills", [])
        if isinstance(item, dict) and isinstance(item.get("skill_name"), str)
    }
    suggestions = []
    addressed = set()
    for item in response.get("suggestions", []):
        if item.get("action") == "add":
            skill_name = item["new_entry"]["skill_name"]
            addressed.add(_normalized_phrase(item.get("requirement", "")))
            if any(
                _normalized_phrase(skill_name) in _alias_terms(existing)
                for existing in existing_skills
            ):
                continue
        suggestions.append(item)
    improvements = [
        item for item in response.get("improvements", [])
        if _normalized_phrase(item.get("requirement", "")) not in addressed
    ]
    return {**response, "suggestions": suggestions, "improvements": improvements}


def generate_tailoring_suggestions(
    structured_resume,
    job,
    requirements,
    analysis,
    user_evidence=None,
    unapplied_suggestions=None,
    request_id=None,
    timings=None,
    candidate_context="",
):
    request_id = request_id or uuid4().hex
    timings = timings if timings is not None else {}
    user_evidence = _validate_user_evidence(user_evidence)
    started = perf_counter()
    logger.info(
        "AI pipeline stage started request_id=%s stage=resume_suggestions",
        request_id,
    )
    job_input = {
        "title": job.get("title"),
        "company": job.get("company", job.get("company_name")),
        "description": job.get("description"),
    }
    suggestion_resume = dict(structured_resume)
    resume_section = structured_resume.get("resume")
    if isinstance(resume_section, dict):
        suggestion_resume["resume"] = {
            key: value
            for key, value in resume_section.items()
            if key != "professional_summary"
        }
    suggestions_prompt = (
        SUGGESTIONS_PROMPT
        + "\nJOB:\n"
        + json.dumps(job_input)
        + "\nJOB REQUIREMENTS:\n"
        + json.dumps(requirements)
        + "\nSTAGE 2 REQUIREMENT MATCHES:\n"
        + json.dumps(analysis["evidence"])
        + "\nCURRENT RESUME:\n"
        + json.dumps(suggestion_resume)
        + "\nUSER-PROVIDED EVIDENCE:\n"
        + json.dumps(user_evidence)
        + (
            "\nPREVIOUSLY UNAPPLIED SUGGESTIONS:\n"
            + json.dumps(unapplied_suggestions)
            if unapplied_suggestions else ""
        )
        + (
            "\nUNVERIFIED ATS DISPLAY NOTES (not candidate evidence):\n"
            + candidate_context
            if candidate_context else ""
        )
    )
    response = request_ai(
        suggestions_prompt,
        schema_name="resume_suggestions",
        schema=SUGGESTIONS_SCHEMA,
        reasoning_effort="low" if AI_PROVIDER == "cerebras" else "high",
        request_id=request_id,
        stage="resume_suggestions",
    )
    suggestions = parse_ai_response(
        response, request_id=request_id, stage="resume_suggestions"
    )
    if any(
        item.get("resume_id") in {
            "resume.professional_summary", "professional_summary",
        }
        for item in suggestions.get("suggestions", [])
    ):
        raise ValueError(
            "Professional summaries must be generated by the summary request"
        )
    suggestions = restore_combined_resume_text(suggestions, structured_resume)
    suggestions = _keep_supported_skill_additions(
        suggestions, structured_resume, analysis, requirements, user_evidence
    )
    suggestions = deduplicate_suggestions(suggestions)
    suggestions["missing_requirements"] = analysis["missing_requirements"]
    result = build_frontend_response(suggestions, analysis)
    result["requirements"] = requirements
    result["evidence"] = analysis["evidence"]
    timings["Stage 3: tailoring suggestions"] = perf_counter() - started
    logger.info(
        "AI pipeline stage ended request_id=%s stage=resume_suggestions "
        "elapsed_seconds=%.2f",
        request_id,
        timings["Stage 3: tailoring suggestions"],
    )
    return result


def generate_evidence_suggestions(
    structured_resume,
    job,
    requirements,
    user_evidence,
    request_id=None,
):
    request_id = request_id or uuid4().hex
    user_evidence = _canonicalize_user_evidence(
        user_evidence, requirements
    )
    if not user_evidence:
        raise ValueError("At least one user evidence item is required")
    allowed_sections = {
        "Professional Summary", "Work Experience", "Projects", "Education",
        "Skills",
    }
    if any(item["target_section"] not in allowed_sections | {"Let AI decide"} for item in user_evidence):
        raise ValueError("Evidence suggestions contain an unsupported target section")

    job_input = {
        "title": job.get("title"),
        "company": job.get("company", job.get("company_name")),
        "description": job.get("description"),
    }
    evidence_prompt = (
        EVIDENCE_SUGGESTION_PROMPT
        + "\nJOB:\n" + json.dumps(job_input)
        + "\nJOB REQUIREMENTS:\n" + json.dumps(requirements)
        + "\nCURRENT RESUME:\n" + json.dumps(structured_resume)
        + "\nUSER-PROVIDED EVIDENCE:\n" + json.dumps(user_evidence)
    )
    response = request_ai(
        evidence_prompt,
        schema_name="evidence_suggestions",
        schema=EVIDENCE_SUGGESTION_SCHEMA,
        reasoning_effort="low",
        request_id=request_id,
        stage="evidence_suggestion",
    )
    parsed = parse_ai_response(
        response, request_id=request_id, stage="evidence_suggestion"
    )

    expected = {
        (item["requirement"], item["target_section"])
        for item in user_evidence
    }
    suggestions = parsed["suggestions"]
    if isinstance(suggestions, dict):
        suggestions = [suggestions]
    if not isinstance(suggestions, list):
        raise ValueError("AI evidence suggestions must be a list")
    if not suggestions:
        raise ValueError("AI returned no suggestions for the supplied evidence")

    # Resolve automatic targets from the model's concrete section choice.
    for requirement, section in list(expected):
        if section != "Let AI decide":
            continue
        choices = [
            item for item in suggestions if isinstance(item, dict)
            and _resolve_requirement_name(item.get("requirement", ""), requirements) == requirement
        ]
        if len(choices) != 1:
            raise ValueError("AI must choose one section for automatic evidence")
        chosen = choices[0].get("target_section", choices[0].get("section_name"))
        if chosen not in allowed_sections:
            raise ValueError("AI must choose a concrete resume section")
        choices[0]["target_section"] = chosen
        expected.remove((requirement, section))
        expected.add((requirement, chosen))

    normalized_items = []
    for index, raw_item in enumerate(suggestions):
        if not isinstance(raw_item, dict):
            raise ValueError(
                f"AI evidence suggestion {index} must be an object"
            )
        item = dict(raw_item)
        if "suggestion" not in item:
            item["suggestion"] = item.get(
                "suggested_change",
                item.get("description", item.get("text", "")),
            )
        if "reason" not in item:
            item["reason"] = item.get("reasoning", "")

        if item.get("target_section") not in allowed_sections:
            candidates = [
                section for requirement, section in expected
                if requirement == item.get("requirement")
            ]
            if len(candidates) == 1:
                item["target_section"] = candidates[0]
            elif len(expected) == 1:
                item["target_section"] = next(iter(expected))[1]

        if not isinstance(item.get("requirement"), str) or not item["requirement"]:
            if len(expected) == 1:
                item["requirement"] = next(iter(expected))[0]
        if (
            not isinstance(item.get("target_section"), str)
            or item["target_section"] not in allowed_sections
        ):
            raise ValueError(
                f"AI evidence suggestion {index} has an invalid target section"
            )
        if not isinstance(item.get("requirement"), str) or not item["requirement"]:
            raise ValueError(
                f"AI evidence suggestion {index} has no requirement"
            )
        canonical_requirement = _resolve_requirement_name(
            item["requirement"], requirements
        )
        if canonical_requirement and (
            canonical_requirement, item["target_section"]
        ) in expected:
            item["requirement"] = canonical_requirement
        elif len(expected) == 1:
            expected_requirement, expected_section = next(iter(expected))
            if item["target_section"] == expected_section:
                item["requirement"] = expected_requirement

        target_section = item["target_section"]
        resume_id = item.get("resume_id")
        if not isinstance(resume_id, str):
            resume_id = ""
        action = item.get("action")
        if target_section == "Professional Summary":
            action = "replace"
            resume_id = "resume.professional_summary"
        elif target_section == "Skills":
            action = "add"
            resume_id = ""
        elif isinstance(action, str) and action in {"new", "create", "add_entry"}:
            action = "add"
        elif isinstance(action, str) and action in {"edit", "update", "modify"}:
            action = "replace"
        elif not isinstance(action, str) or action not in {"add", "replace"}:
            action = "replace" if resume_id else "add"
        item["action"] = action
        item["resume_id"] = resume_id

        raw_entry = item.get("new_entry")
        if not isinstance(raw_entry, dict):
            raw_entry = item.get("entry")
        if not isinstance(raw_entry, dict):
            raw_entry = {}

        def entry_text(*keys):
            for key in keys:
                value = raw_entry.get(key)
                if isinstance(value, str):
                    return value
            return ""

        item["new_entry"] = {
            "entry_title": entry_text(
                "entry_title", "name", "project_name", "job_title", "title", "role"
            ),
            "company": entry_text("company", "employer"),
            "location": entry_text("location"),
            "start_date": entry_text("start_date", "start"),
            "end_date": entry_text("end_date", "end"),
            "description": entry_text(
                "description", "details", "suggestion", "suggested_change"
            ) or (
                item["suggestion"] if action == "add"
                and isinstance(item["suggestion"], str) else ""
            ),
            "link": entry_text("link", "url"),
            "skill_name": entry_text("skill_name", "skill"),
            "school": entry_text("school", "institution"),
            "degree": entry_text("degree"),
            "field_of_study": entry_text("field_of_study", "major"),
        }
        if not isinstance(item.get("suggestion"), str):
            item["suggestion"] = ""
        if not isinstance(item.get("reason"), str):
            item["reason"] = ""
        if action == "add" and item["new_entry"]["description"].strip():
            item["suggestion"] = item["new_entry"]["description"].strip()
        if action == "add" and not item["reason"].strip():
            item["reason"] = (
                "Creates a separate resume entry using the experience you provided."
            )
        normalized_items.append(item)

    suggestions = normalized_items
    actual = [
        (item["requirement"], item["target_section"])
        for item in suggestions
    ]
    if len(actual) != len(expected) or set(actual) != expected:
        raise ValueError("AI must return one suggestion per requested evidence target")

    summary = structured_resume.get("resume", {}).get(
        "professional_summary", ""
    )
    normalized = []
    for item in suggestions:
        target = item["target_section"]
        is_summary = target == "Professional Summary"
        entry = item["new_entry"]
        action = item["action"]
        resume_id = item["resume_id"]
        if is_summary:
            action = "replace"
            resume_id = "resume.professional_summary"
            if item["action"] != action or item["resume_id"] != resume_id:
                raise ValueError("AI returned an invalid summary suggestion target")
            if not isinstance(summary, str) or not summary.strip():
                raise ValueError("A professional summary is required for replacement")
            if not item["suggestion"].strip():
                raise ValueError("Summary replacement suggestion cannot be empty")
            entry = None
            original_text = summary
        elif target == "Skills":
            if item["action"] != "add" or item["resume_id"]:
                raise ValueError("AI returned an invalid skill addition")
            skill_name = entry.get("skill_name", "").strip()
            if not skill_name:
                raise ValueError("New skill suggestions must include a skill name")
            existing_skills = structured_resume.get("skills", [])
            if not isinstance(existing_skills, list):
                existing_skills = []
            if any(
                isinstance(skill, dict)
                and isinstance(skill.get("skill_name"), str)
                and (
                    _normalized_phrase(skill_name)
                    in _alias_terms(skill["skill_name"])
                )
                for skill in existing_skills
            ):
                raise ValueError("AI returned a skill that is already listed")
            item["suggestion"] = skill_name
            entry = {"skill_name": skill_name}
            original_text = ""
            action = "add"
            resume_id = ""
        elif target == "Education":
            if item["action"] != "replace":
                raise ValueError("Education suggestions must update an existing description")
            match = re.fullmatch(r"education\[(\d+)\]\.description", resume_id)
            education = structured_resume.get("education", [])
            if not match or not isinstance(education, list):
                raise ValueError("AI returned a replacement outside the education section")
            entry_index = int(match.group(1))
            if entry_index >= len(education) or not isinstance(education[entry_index], dict):
                raise ValueError("AI returned an unknown education description")
            original_text = education[entry_index].get("description", "")
            if not isinstance(original_text, str) or not item["suggestion"].strip():
                raise ValueError("Education description replacement cannot be empty")
            entry = None
            action = "replace"
        else:
            action = item["action"]
            resume_id = item["resume_id"]
            if action == "replace":
                evidence_by_path = {
                    evidence_item["resume_id"]: evidence_item["relevant_text"]
                    for evidence_item in process_resume(structured_resume)["evidence"]
                }
                allowed_prefix = (
                    "work_experience["
                    if target == "Work Experience"
                    else "projects["
                )
                if (
                    not resume_id.startswith(allowed_prefix)
                    or not resume_id.endswith(".description")
                    or resume_id not in evidence_by_path
                ):
                    raise ValueError(
                        "AI returned a replacement outside the requested section"
                    )
                if not item["suggestion"].strip():
                    raise ValueError("Replacement suggestion cannot be empty")
                original_text = evidence_by_path[resume_id]
                entry = None
            elif action == "add":
                if resume_id:
                    raise ValueError("New entries must not reference an existing field")
                if not entry["description"].strip():
                    raise ValueError("New resume entries must include a description")
                item["suggestion"] = entry["description"].strip()
                if target == "Work Experience":
                    entry = {
                        "job_title": entry["entry_title"],
                        "company": entry["company"],
                        "location": entry["location"],
                        "start_date": entry["start_date"],
                        "end_date": entry["end_date"],
                        "description": entry["description"],
                    }
                else:
                    entry = {
                        "name": entry["entry_title"],
                        "description": entry["description"],
                        "link": entry["link"],
                    }
                original_text = ""
            else:
                raise ValueError("AI returned an invalid evidence suggestion action")
        normalized.append({
            "requirement": item["requirement"],
            "section_name": target,
            "action": action,
            "resume_id": resume_id,
            "original_text": original_text,
            "suggestion": item["suggestion"],
            "reason": item["reason"],
            "new_entry": entry,
        })
    result = {"suggestions": normalized}
    _write_ai_capture({
        "request_id": request_id,
        "provider": AI_PROVIDER,
        "model": {
            "cerebras": "qwen-3.8-27b",
            "groq": "qwen/qwen3.8-27b",
            "openrouter": "nvidia/nemotron-3-ultra-550b-a55b:free",
        }.get(AI_PROVIDER, ""),
        "stage": "targeted_suggestions",
        "status": "processed",
        "response": result,
    })
    return result


def generate_professional_summary_options(
    structured_resume,
    job,
    request_id=None,
):
    request_id = request_id or uuid4().hex
    job_input = {
        "title": job.get("title"),
        "company": job.get("company", job.get("company_name")),
        "description": job.get("description"),
    }
    prompt_content = (
        PROFESSIONAL_SUMMARY_PROMPT
        + "\nFULL JOB DESCRIPTION:\n"
        + json.dumps(job_input)
        + "\nFULL RESUME:\n"
        + json.dumps(structured_resume)
    )
    response = request_ai(
        prompt_content,
        schema_name="professional_summary_options",
        schema=PROFESSIONAL_SUMMARY_SCHEMA,
        reasoning_effort="low",
        request_id=request_id,
        stage="professional_summary",
    )
    parsed = parse_ai_response(
        response, request_id=request_id, stage="professional_summary"
    )
    summaries = parsed.get("summaries")
    expected_tones = {"executive", "technical", "concise"}
    if not isinstance(summaries, list):
        raise ValueError("AI professional summaries must be a list")
    normalized = {}
    for item in summaries:
        if not isinstance(item, dict):
            raise ValueError("AI professional summary options must be objects")
        tone = item.get("tone")
        text = item.get("text")
        if tone not in expected_tones or not isinstance(text, str) or not text.strip():
            raise ValueError("AI returned an invalid professional summary option")
        maximum_words = 40 if tone == "concise" else 60
        words = text.split()
        if len(words) > maximum_words:
            text = " ".join(words[:maximum_words])
        if tone in normalized:
            raise ValueError("AI returned duplicate professional summary tones")
        normalized[tone] = text.strip()
    if set(normalized) != expected_tones:
        raise ValueError(
            "AI must return one professional summary for each supported tone"
        )
    return {
        "options": [
            {"tone": tone, "text": normalized[tone]}
            for tone in ("executive", "technical", "concise")
        ],
    }


def analyze_resume_pipeline(
    structured_resume,
    job,
    requirements=None,
    user_evidence=None,
    request_id=None,
    timings=None,
    log_pipeline=True,
):
    request_id = request_id or uuid4().hex
    timings = timings if timings is not None else {}
    pipeline_started = perf_counter()
    if log_pipeline:
        logger.info("AI pipeline started request_id=%s", request_id)
    requirements = extract_requirements(
        job, requirements=requirements, request_id=request_id, timings=timings
    )
    analysis = analyze_resume_requirements(
        structured_resume,
        requirements,
        user_evidence=user_evidence,
        request_id=request_id,
        timings=timings,
    )
    if log_pipeline:
        logger.info(
            "AI pipeline ended request_id=%s elapsed_seconds=%.2f",
            request_id,
            perf_counter() - pipeline_started,
        )
    return analysis


def run_combined_pipeline(
    structured_resume,
    job,
    timings=None,
    requirements=None,
    request_id=None,
    unapplied_suggestions=None,
    candidate_context="",
    user_evidence=None,
):
    """Run all three stages and preserve the legacy combined response shape."""
    request_id = request_id or uuid4().hex
    timings = timings if timings is not None else {}
    pipeline_started = perf_counter()
    logger.info("AI pipeline started request_id=%s", request_id)
    analysis = analyze_resume_pipeline(
        structured_resume,
        job,
        requirements=requirements,
        user_evidence=user_evidence,
        request_id=request_id,
        timings=timings,
        log_pipeline=False,
    )
    suggestions = generate_tailoring_suggestions(
        structured_resume,
        job,
        analysis["requirements"],
        analysis,
        user_evidence=user_evidence,
        unapplied_suggestions=unapplied_suggestions,
        request_id=request_id,
        timings=timings,
        candidate_context=candidate_context,
    )
    if candidate_context:
        suggestions["candidate_context"] = candidate_context
    logger.info(
        "AI pipeline ended request_id=%s elapsed_seconds=%.2f",
        request_id,
        perf_counter() - pipeline_started,
    )
    return suggestions


def main_request_combined(id, job, user_id, request_id=None):
    """Load a saved resume and run the current two-request pipeline."""
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



    return run_combined_pipeline(
        structured_resume, job, request_id=request_id
    )


def analyze_current_resume(
    structured_resume,
    job,
    requirements=None,
    user_evidence=None,
    request_id=None,
):
    return analyze_resume_pipeline(
        structured_resume,
        job,
        requirements=requirements,
        user_evidence=user_evidence,
        request_id=request_id,
    )


def generate_suggestions_for_resume(
    structured_resume,
    job,
    requirements,
    analysis,
    user_evidence=None,
    unapplied_suggestions=None,
    request_id=None,
    candidate_context="",
):
    return generate_tailoring_suggestions(
        structured_resume,
        job,
        requirements,
        analysis,
        user_evidence=user_evidence,
        unapplied_suggestions=unapplied_suggestions,
        request_id=request_id,
        candidate_context=candidate_context,
    )


def regenerate(
    resume,
    job,
    requirements,
    unapplied_suggestions=None,
    request_id=None,
    candidate_context="",
    analysis=None,
    user_evidence=None,
):
    request_id = request_id or uuid4().hex
    analysis = analysis or analyze_resume_pipeline(
        resume,
        job,
        requirements=requirements,
        user_evidence=user_evidence,
        request_id=request_id,
    )
    result = generate_tailoring_suggestions(
        resume,
        job,
        analysis["requirements"],
        analysis,
        user_evidence=user_evidence,
        unapplied_suggestions=unapplied_suggestions,
        request_id=request_id,
        candidate_context=candidate_context,
    )
    if candidate_context:
        result["candidate_context"] = candidate_context
    return result

def console_test_combined(resume=None, job=None):
    """Test the current pipeline with two live AI calls and section timings."""
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
    parser.add_argument("--console-test-combined", action="store_true",
                      help="Run the two-request pipeline with live AI calls and timings")
    args = parser.parse_args()
    if args.console_test_combined:
        console_test_combined()
    else:
        parser.print_help()
