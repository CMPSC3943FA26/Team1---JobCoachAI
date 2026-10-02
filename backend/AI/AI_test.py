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
in the "importance" colunm enter a 0,1,or 2 depending on importance. 0 is optional, 1 is desired, and 2 is neccessary.
in the "direct_search_terms colunm enter 1-3 terms like the requirement name, or terms directly associated with the requirement.
in the "related_search_terms" colunm enter 1-5 terms that are related but not directly associated with the requirement.
the terms should be useful for searching a resume for matching experience.
the response must be exactly the same structure as the response example.
the response must be a json object with no explanations or ``` backticks before the json. 

good response:
{
"requirements": [ {
"requirement":" Python",
"importance": 2,
"direct_search_terms":["Python","Python programming"],
"related_search_terms":["Flask","web development","backend services"],
}],
}

response=
{
"requirements": [ {
"requirement":"string",
"importance": 0,
"direct_search_terms":["string"],
"related_search_terms":["string"],
}],
}

Job description=
	{
   "job_title":"Software Developer",
   company:"Tech inc",
   "description":"Tech Inc is seeking a Software Developer Intern to help build and maintain web applications and backend services. The ideal candidate has experience with Python, REST APIs, SQL databases, and Git. Responsibilities include developing new application features, maintaining existing web services, debugging software issues, writing clean and maintainable code, and collaborating with other developers. Experience with Flask or similar Python web frameworks is a plus. Candidates should be comfortable learning new technologies and working in a team environment.",
  }
"""
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
          "content": prompt
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
  print(response_status)

prompt_resume = """
you are a resume analyzer. given a list of requirements, you must compare the requirements with the provided resume evidence.
you must not use the provided resume as evidence or as justification for your response. the provided resume is only provided for
accurate suggestions. you must only use the resume evidence to decide which category the response belongs in. 
There are three separate categories: supported, partial, unsupported. 
evidence is supported if it has an explicit reference to the requirement, found by the backend outside of this prompt. 
evidence is partial if it has related term not explicit in the resume. for partial evidence, you must decide whether it is supported
or unsupported by seeing if the the context surrounding the term supports it. 
evidence is unsupported if the resume has no direct or related terms in the resume for the requirement. 
supported evidence will go into the suggestion part of the response if a suggestion would improve the resume.
unsupported evidence will go into the improvement part of the response.
if you are unsure if a partial response is supported, it is unsupported. 
you must provide a accurate id referencing the resume in the suggestion colunm to support your answer. 

"""




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
  print(response_status)

