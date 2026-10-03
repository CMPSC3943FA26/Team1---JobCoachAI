import requests
import json
import os
from dotenv import load_dotenv
load_dotenv()
AI_MODEL_KEY = os.getenv("AI_MODEL_KEY")
prompt= """
you are a job description analyzer. 
you must analyze the job description and extract the requirements.
In the "requirement" colunm enter a one or two word requirement from the job description
in the "importance" colunm enter a string indicating the importance of the requirement ("required", "desired", or "mentioned").
for the importance colunm, "required" means the requirement is explicitly required in the job description, "desired" means the requirement is desired but not explicitly required, and "mentioned" means the requirement is mentioned but not required or desired.
in the "direct_search_terms colunm enter 1-3 terms like the requirement name, or terms directly associated with the requirement.
in the "related_search_terms" colunm enter 1-5 terms that are related but not directly associated with the requirement.
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
test_job_description = {
   "id": "",
   "user_id": "",
   "title": "Software Engineer",
   "description": """ Nasdaq’s Internship Program is a 10-week summer experience designed to give students real exposure to how global markets and technology come together. Our interns work on meaningful projects alongside Nasdaq teams, gaining hands-on skills that make an impact on the business.

We believe the best way to learn is by doing, that’s why you’ll be paired with a mentor, connected with senior leaders, and included in professional development sessions. You’ll also join a diverse global intern community, sharing experiences and building networks that last beyond the program.

Our goal is to provide a supportive, engaging, and fun environment where your work feels valued and your growth comes first. Check out our Nasdaq Internship Program page to learn more and hear directly from past interns about their journeys.

What You’ll Do

Write quality production-ready code using C#, .Net, .Net Core, Vue.js, MSSQL, PostreSQL, and Terraform
Work with cloud platforms like AWS and build microservices and manage infrastructure using Terraform
Work with a team that leverages automation to streamline the software development lifecycle. This includes automating the build, test, and deployment processes to ensure that code changes are integrated and delivered quickly and reliably.
Review code quality, adhere to coding standards, and align with project requirements
Provide constructive feedback to team members on their code, suggest improvements and best practices
Assist in troubleshooting and debugging issues in the development and production environments

What You’ll Bring

Passion for learning and building innovative solutions
Interest in working with a modern SaaS-based platform
Experience using variety of software development tools and languages, including C#, Vue JS, and/or SQL
Awareness of data-driven systems

Nice-to-Have

Some knowledge of Single Page application development with Vue JS, .NET, and Postgres
Experience or knowledge in building applications leveraging AI
Experience or knowledge of cloud technologies, such as AWS or Azure
Experience or knowledge of no-SQdata stores, such as Elasticsearch
Experience or knowledge of microservices design & development
Experience or knowledge of container technologies, such as Docker
Experience or knowledge of deployment tooling, such as Jenkins

This position will be located in Atlanta and offers the opportunity for a hybrid work environment at least 3 days a week in-office, subject to change, providing flexibility and accessibility for qualified candidates.

Come as You Are

Nasdaq is an equal opportunity employer. We welcome applications from candidates of all backgrounds and identities.

We are committed to fostering an inclusive workplace where diverse perspectives, experiences, and identities are valued and celebrated.

We ensure that individuals with disabilities are provided with reasonable accommodation throughout the hiring process.""",
   "company": "Tech Company",
   "source": "",
   "created_at": "",
   "updated_at": ""
}
description = test_job_description["description"]
title = test_job_description["title"]
company = test_job_description["company"]
ai_job_description_prompt = {
  "description": description,
  "title": title,
  "company": company
}

response = requests.post(
  url="https://openrouter.ai/api/v1/chat/completions",
  headers={
    "Authorization": f"Bearer {AI_MODEL_KEY}",
    "Content-Type": "application/json",
  },
  data=json.dumps({
    "model": "deepseek/deepseek-v4-flash",
    "messages": [
        {
          "role": "user",
          "content":  prompt
    + "\nJob description:\n"
    + json.dumps(ai_job_description_prompt) 
        }
      ],
    "reasoning": {"enabled": False}
  })
)


response_status = response.status_code
response_data = response.json()
if response_status == 200:
  message = response_data["choices"][0]["message"]["content"]
  try:
    ai_response = json.loads(message)
    print("AI RESPONSE:")
    print(json.dumps(ai_response, indent=2))
  except json.JSONDecodeError:
    print("json invalid")
    print("RAW AI RESPONSE:")
    print(message)
else:
  print(response_status,response.text)

ai_input_json = {
  "requirements": [],
  "evidence": [],
}
ai_response_json = {
"requirements": [
  {
  "requirement": "",
  "importance": "",
  "classification": "",
  "evidence":[
    {
    "resume_id":"",
    "relevant_text":"",
    "reason":"",
    }
  ],
  }
],
}
test_resume = {
    "resume": {
        "title": "Software Developer Resume",
        "career_field": "Computer Science",
        "is_default": True,
        "full_name": "John Doe",
        "email": "john.doe@example.com",
        "phone": "555-123-4567",
        "location": "Ada, OK",
        "professional_summary": (
            "Computer Science student with experience developing REST APIs, "
            "AI applications, and database-backed software using Python and JavaScript."
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
            "job_title": "Software Developer Intern",
            "company": "Example Software Company",
            "location": "Oklahoma City, OK",
            "start_date": "2025-05-19",
            "end_date": "2025-08-15",
            "description": (
                "Developed and tested web applications using Python and JavaScript. "
                "Worked with REST APIs and SQL databases. Collaborated with developers "
                "using Git and GitHub and participated in code reviews and debugging."
            ),
            "sort_order": 1
        }
    ],

    "education": [
        {
            "school": "East Central University",
            "degree": "Bachelor of Science",
            "field_of_study": "Computer Science",
            "start_date": "2024-08-19",
            "end_date": "2028-05-19",
            "sort_order": 1
        }
    ],

    "skills": [
        {
            "skill_name": "Python",
            "sort_order": 1
        },
        {
            "skill_name": "JavaScript",
            "sort_order": 2
        },
        {
            "skill_name": "SQL",
            "sort_order": 3
        },
        {
            "skill_name": "Flask",
            "sort_order": 4
        },
        {
            "skill_name": "REST APIs",
            "sort_order": 5
        },
        {
            "skill_name": "Git",
            "sort_order": 6
        },
        {
            "skill_name": "SQLite",
            "sort_order": 7
        }
    ],

    "projects": [
        {
            "name": "Exercise Tracker API",
            "description": (
                "Built a REST API using Python, Flask, SQLAlchemy, and SQLite. "
                "Implemented CRUD operations, JWT authentication, and database migrations."
            ),
            "link": "https://github.com/example/exercise-tracker",
            "sort_order": 1
        },
        {
            "name": "AI Book Recommender",
            "description": (
                "Built an AI-powered book recommendation application using "
                "Cloudflare Workers, Workers AI, Durable Objects, WebSockets, "
                "and the Google Books API."
            ),
            "link": "https://github.com/example/book-recommender",
            "sort_order": 2
        }
    ],

    "certifications": [
        {
            "name": "AWS Certified Cloud Practitioner",
            "issuer": "Amazon Web Services",
            "date_earned": "2026-06-15",
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


print(process_resume(test_resume))
def analyze_resume(evidence):
  ai_response_processed = ai_response.get("requirements", [])
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
                 "match_type": "direct",
              })
       elif partial:
          for evidence_item in partial_evidence:
              ai_input_json["evidence"].append({
                 "requirement": requirement,
                 "importance": importance,
                 "resume_id": evidence_item.get("resume_id"),
                 "relevant_text": evidence_item.get("relevant_text"),
                 "match_type": "related",
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

evidence = process_resume(test_resume)["evidence"]
ai_input_json = analyze_resume(evidence)
prompt_resume = """
you are a resume analyzer. given a list of requirements, you must compare the requirements with the provided resume evidence.
 you must only use the resume evidence to decide which category the response belongs in. 
There are three separate categories: supported, partial, unsupported. 
evidence is supported if it has an explicit reference to the requirement, found by the backend outside of this prompt. 
evidence is partial if it has related term in the resume, but not explicitly mentioned in the requirement. for partial evidence, you must decide whether it is supported
or unsupported by seeing if the the context surrounding the term supports it. 
if the match type is direct, the requirement directly matches the resume evidence. if the match type is related, the requirement is related to the resume evidence but not directly mentioned in the resume.
evidence is unsupported if the resume has no direct or related terms in the resume for the requirement. 
if you are unsure if a partial response is supported, it is unsupported. 
you must provide a accurate id referencing the resume in the suggestion colunm to support your answer. 
response must be a json object with no explanations or ``` backticks before the json.
return only one requirement per object in the evidence array. the array is provided to show you all the possible 
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


response_2 = requests.post(
  url="https://openrouter.ai/api/v1/chat/completions",
  headers={
    "Authorization": f"Bearer {AI_MODEL_KEY}",
    "Content-Type": "application/json",
  },
  data=json.dumps({
    "model": "deepseek/deepseek-v4-flash",
    "messages": [
        {
          "role": "user",
          "content":  prompt_resume
    + "\nRequirements and resume evidence:\n"
    + json.dumps(ai_input_json)
        }
      ],
    "reasoning": {"enabled": False}
  })
)

response_status = response_2.status_code
response_data = response_2.json()
if response_status == 200:
  message = response_data["choices"][0]["message"]["content"]
  try:
    ai_response = json.loads(message)
    print("AI RESPONSE:")
    print(json.dumps(ai_response, indent=2))
  except json.JSONDecodeError:
    print("json invalid")
    print("RAW AI RESPONSE:")
    print(message)
else:
  print(response_status,response_2.text)

prompt_suggestion = """
You are a resume suggestion generator. The input contains job requirements and resume evidence that has already been classified as supported, partial, or unsupported. Use only the supplied requirement, classification, and evidence. Do not invent qualifications, skills, accomplishments, metrics, or resume IDs.

Return two arrays:
- "suggestions": for supported requirements where the existing resume evidence could be presented more clearly or effectively. Ground every suggestion in the supplied evidence. If no change would help, do not include that requirement here.
- "improvements": for partial or unsupported requirements. Explain what truthful detail the user could add if it reflects their actual experience. Do not write missing experience as a fact. For partial requirements, cite the related evidence; for unsupported requirements, use null for "resume_id" and "relevant_text".

Include each requirement at most once across the two arrays. Copy requirement, importance, resume_id, and relevant_text exactly from the input. Keep the suggestions concise and actionable. Return only valid JSON with this structure:
{
  "suggestions": [
    {
      "requirement": "Python",
      "importance": "required",
      "resume_id": "skills[0].skill_name",
      "relevant_text": "Python",
      "suggestion": "Keep Python prominent in the skills section and connect it to a project example if the resume contains one."
    }
  ],
  "improvements": [
    {
      "requirement": "AWS",
      "importance": "desired",
      "classification": "unsupported",
      "resume_id": null,
      "relevant_text": null,
      "improvement": "If you have AWS experience, add a truthful example describing how you used it; otherwise, do not claim this skill."
    }
  ]
}

Each suggestion object must contain only "requirement", "importance", "resume_id", "relevant_text", and "suggestion". Each improvement object must contain only "requirement", "importance", "classification", "resume_id", "relevant_text", and "improvement". Use only "partial" or "unsupported" for improvement classifications. Return empty arrays when there are no applicable items. Do not include markdown or explanatory text outside the JSON.
"""

response_3 = requests.post(
  url="https://openrouter.ai/api/v1/chat/completions",
  headers={
    "Authorization": f"Bearer {AI_MODEL_KEY}",
    "Content-Type": "application/json",
  },
  data=json.dumps({
    "model": "deepseek/deepseek-v4-flash",
    "messages": [
        {
          "role": "user",
          "content":  prompt_suggestion
    + "\nRequirements and resume evidence:\n"
    + json.dumps(response_2.json()["choices"][0]["message"]["content"])
        }
      ],
    "reasoning": {"enabled": False}
  })
)

response_status = response_3.status_code
response_data = response_3.json()
if response_status == 200:
  message = response_data["choices"][0]["message"]["content"]
  try:
    ai_response = json.loads(message)
    print("AI RESPONSE:")
    print(json.dumps(ai_response, indent=2))
  except json.JSONDecodeError:
    print("json invalid")
    print("RAW AI RESPONSE:")
    print(message)
else:
  print(response_status,response_3.text)
