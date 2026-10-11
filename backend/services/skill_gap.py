
import re

SKILLS = {
    "Python": ["python"],
    "Java": ["java"],
    "JavaScript": ["javascript"],
    "React": ["react"],
    "SQL": ["sql", "postgresql", "mysql"],
    "Flask": ["flask"],
    "AWS": ["aws", "amazon web services"],
    "Docker": ["docker"],
    "Git": ["git", "github"],
    "Machine Learning": ["machine learning"],
    "REST API": ["rest api", "restful api"],
}

RECOMMENDATIONS = {
    "Python": "Build Python projects and complete a programming course.",
    "Java": "Practice object-oriented programming and build Java applications.",
    "JavaScript": "Build interactive web applications.",
    "React": "Learn React components, hooks, and state management.",
    "SQL": "Practice queries, joins, and database design.",
    "Flask": "Build REST APIs using Flask.",
    "AWS": "Study AWS fundamentals and explore relevant certifications.",
    "Docker": "Practice containerizing applications with Docker.",
    "Git": "Practice version control and collaborative development.",
    "Machine Learning": "Complete a machine learning course and practical project.",
    "REST API": "Build and test REST APIs.",
}


def contains_term(text, term):
    return re.search(
        r"(?<!\w)" + re.escape(term) + r"(?!\w)",
        text,
        re.IGNORECASE
    ) is not None


def analyze_skill_gaps(resume_text, job_description):
    if not isinstance(resume_text, str) or not resume_text.strip():
        raise ValueError("Resume text is required.")

    if not isinstance(job_description, str) or not job_description.strip():
        raise ValueError("Job description is required.")

    resume = resume_text.lower()
    job = job_description.lower()

    required = []
    matched = []
    missing = []

    for skill, aliases in SKILLS.items():
        if not any(contains_term(job, alias) for alias in aliases):
            continue

        required.append(skill)

        if any(contains_term(resume, alias) for alias in aliases):
            matched.append(skill)
        else:
            missing.append({
                "skill": skill,
                "recommendation": RECOMMENDATIONS[skill]
            })

    percentage = round(len(matched) / len(required) * 100) if required else 0

    return {
        "required_skills": required,
        "matched_skills": matched,
        "missing_skills": missing,
        "match_percentage": percentage
    }
