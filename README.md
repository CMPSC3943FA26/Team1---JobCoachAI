# JobCoachAI

JobCoachAI is an AI-powered career development platform designed to help job seekers create professional resumes, tailor applications to specific job opportunities, identify missing qualifications, and improve their career readiness. 

The platform aims to simplify the job application process by providing resume-building tools, AI-assisted recommendations, ATS compatibility analysis, and organized resume management.

This repository combines the Team1 product plans and documentation with the working Vite/React and Supabase starter implementation. The application is still an MVP in progress: the current codebase provides the frontend shell and Supabase client setup, while the broader coaching features remain planned work.

## Product scope

JobCoachAI is intended to bring these workflows into one platform:

- Resume creation, editing, organization, and PDF export.
- Job-specific resume tailoring and AI-assisted feedback.
- ATS compatibility analysis and missing keyword identification.
- AI-generated suggestions for improving resume content.
- Saved resume management and version history.
- Job search and application tracking.
- Interview preparation and feedback.
- Career development recommendations, including skills and certifications.

AI-generated suggestions are intended to improve how users present their existing qualifications. The application should not fabricate employment history, education, certifications, skills, or professional accomplishments.

## Current implementation

- Frontend: React 19, TypeScript, Vite, HTML/CSS, and ESLint.
- Frontend data client: Supabase JavaScript SDK.
- Backend integration: Python 3, Flask, REST APIs and Supabase Python client.
- Database and authentication: Supabase.
- Planned AI integration: an AI/LLM API for resume analysis, recommendations, and interview preparation.

The current frontend is the Vite starter shell. Backend routes, resume workflows, authentication flows, and AI features are planned but are not fully implemented yet.

## Repository structure

```text
Team1---JobCoachAI/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── App.css
│   ├── .env.example
│   └── package.json
│
├── backend/
│   ├── routes/
│   ├── services/
│   ├── schemas/
│   ├── AI/
│   ├── app.py
│   ├── supabase_client.py
│   └── .env.example
│
├── docs/
│   ├── db_architecture/
│   ├── roadmap/
│   ├── user-flow/
│   └── design/
│
├── requirements.txt
└── README.md

The repository structure may change as additional features are developed and integrated.
```

## Local setup

### Prerequisites

Before running JobCoachAI, install:

- Node.js LTS and npm.
- Python 3.10 or newer.
- Git.
- VSCode or another compatible editor.
- Access to the teams's Supabase project.
- Required frontend and backend environment variables.
- A Supabase project with a URL and publishable key.

### Clone the Repository
- git clone https://github.com/CMPSC3943FA26/Team1---JobCoachAI.git
- cd Team1---JobCoachAI

### Install dependencies

Create and activate a Python environment in the backend folder so the project stays organized:

Linux/macOS:

```powershell
cd backend
py -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r ../requirements.txt
```

Windows PowerShell:
```bash
cd backend
python3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r ../requirements.txt
```

Install the frontend packages:

```bash
cd ../frontend
npm install
```

### Configure environment variables

Create local .env files using the provided .env.example templates.

From the repository root:

Windows PowerShell:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
Copy-Item .\frontend\.env.example .\frontend\.env
```
Enter the supabase api keys in the .env files
Review the supabase Api keys.docx in the excel spreadsheet

Linux/macOS:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Configure the environment values according to the team's Supabase and backend settings.

Backend .env example:

```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Frontend .env example:

```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
VITE_API_URL=your_api_url_here
```

Additional environment variables may be required for configured AI services.

Alternate Method: 
- Download 7zip.
- Extract backendenv.zip and frontendenv.zip.
- Password is listed in JobSeachAITaskTracker spreadsheet.
- Place .env file in backend and frontend folder respectively.

Important security notes:
- Do not commit `.env` files or secrets.
- Never expose private Supabase service-role keys or AI API keys in frontend code.
- Do not publish credentials or environment-file archive passwords in repository documentation.

### Running JobCoachAI

Both the frontend and backend must be running for backend-dependent features to work.

### Start the Frontend

Open a separate terminal:

```bash
cd frontend
npm run dev
```

Useful frontend commands:

```bash
npm run build
npm run lint
npm run preview
```
### Start the Backend

Features that interact with the backend require the Flask server to be running.

1. Frontend .env

Make sure the frontend .env contains:

VITE_API_URL=http://localhost:5000

2. Start the Flask backend

From the root of the project, run:

```bash
python -m backend.app
```

Keep the backend running while testing backend-dependent features.

3. Start the frontend

In a separate terminal, run:

```bash
npm run dev
```

## Application Workflow

Step 1 – Access JobCoachAI
Users can register, log in, or continue as guests.

Step 2 – Create or Edit Resume
Users enter their resume information using the Resume Editor or import supported resume data.

Step 3 – Save Resume
Authenticated users can save original resumes to their accounts.

Step 4 – Tailor Resume
Users provide a job description and submit their resume for analysis.

Step 5 – Review ATS and AI Feedback
The application displays available analysis results, including:
- ATS compatibility estimate.
- Matched keywords.
- Missing keywords.
- AI improvement recommendations.
- Missing qualifications.

Step 6 – Review Tailored Resume
Users review suggested changes and preview their tailored resume.

Step 7 – Save and Manage Resumes
Authenticated users can save tailored resumes and access previously saved versions through their profile.

## AI Resume Coaching
JobCoachAI's resume coaching functionality is designed to:
- Analyze resume content against job descriptions.
- Identify relevant keywords.
- Estimate job compatibility.
- Highlight potential qualification gaps.
- Recommend improvements to resume wording.
- Help users understand skills they may need to develop.

AI-generated suggestions should remain subject to user review.
Users are responsible for ensuring their resumes accurately reflect their actual experience and qualifications.

### Planned features

Additional planned functionality includes:

## Job Search and Application Tracking

- Search for job opportunities.
- Save interesting positions.
- Track job application statuses.
- Monitor application progress.

## Interview Preparation

- Generate role-specific interview questions.
- Practice technical and behavioral interviews.
- Provide AI-assisted interview feedback.
- Track interview preparation progress.

## Career Development

- Recommend skills based on career goals.
- Identify relevant courses and certifications.
- Suggest professional development opportunities.
- Help users track long-term career objectives.

These capabilities are part of the broader product roadmap and should not all be considered fully implemented.

## Testing and Quality Assurance

The team performs development testing to verify application functionality and integration.

Key testing areas include:
- User registration and login.
- Guest access.
- Resume creation and editing.
- Resume saving and retrieval.
- Page navigation.
- ATS analysis.
- AI suggestion display.
- Saved resume management.
- Frontend-to-backend API communication.
- Supabase database integration.

Issues are identified, documented, and addressed throughout development.

## Project Documentation

Project materials are maintained under the docs/ directory.

Documentation includes:
- MVP definition.
- Software requirements.
- Product roadmap.
- User stories.
- Database architecture.
- User flows.
- Wireframes and design materials.
- Sprint planning and review documents.
- Testing and development reports.

## Collaboration Tools

- GitHub – Source code management and version control.
- GitHub Projects – Task organization and progress tracking.
- Miro – Planning, user flows, and design collaboration.
- Visual Studio Code – Application development.
- Supabase – Database and authentication services.

## Development Status

JobCoachAI is an MVP under active development.

The application has progressed beyond its initial React/Vite starter implementation and now includes working resume editing, account authentication, saved resume management, and resume tailoring interfaces.

Some features depend on backend services, AI integrations, or additional development and testing.

Future development will focus on completing the remaining product requirements, improving application reliability, and expanding career coaching capabilities.
