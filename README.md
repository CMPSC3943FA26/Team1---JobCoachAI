# JobCoachAI

JobCoachAI is an AI-powered career platform for helping job seekers build stronger resumes, tailor applications, prepare for interviews, track their job search, and plan their career growth.

This repository combines the Team1 product plans and documentation with the working Vite/React and Supabase starter implementation. The application is still an MVP in progress: the current codebase provides the frontend shell and Supabase client setup, while the broader coaching features remain planned work.

## Product scope

JobCoachAI is intended to bring these workflows into one platform:

- Resume creation, editing, organization, and PDF export
- Job-specific resume tailoring and AI feedback
- Skill and qualification gap identification
- Job search, saved jobs, and application tracking
- Interview question practice and feedback
- Career goals, skill recommendations, courses, and certifications

AI suggestions should improve the presentation of a user's real qualifications. They must not fabricate employment, education, certifications, skills, or accomplishments.

## Current implementation

- Frontend: React 19, TypeScript, Vite, and ESLint
- Frontend data client: Supabase JavaScript SDK
- Backend integration: Python 3 and the Supabase Python client
- Database and authentication: Supabase
- Planned AI integration: an AI/LLM API for resume analysis, recommendations, and interview preparation

The current frontend is the Vite starter shell. Backend routes, resume workflows, authentication flows, and AI features are planned but are not fully implemented yet.

## Repository structure

```text
JobCoachAI/
├── frontend/                   # React + TypeScript + Vite application
│   ├── src/                    # Application source
│   ├── public/                 # Static frontend assets
│   ├── .env.example            # Frontend environment template
│   └── package.json
├── backend/                    # Python Supabase integration
│   ├── supabase_client.py
│   └── .env.example            # Backend environment template
├── docs/
│   ├── JobCoachAI_MVP_Definition.docx
│   ├── db_architecture         # Supabase/Postgres table design
│   ├── roadmap/                # Product roadmap materials
│   ├── user-flow/              # User-flow materials
│   └── design/                 # Design materials
├── requirements.txt
└── README.md
```

## Local setup

### Prerequisites

- Node.js LTS and npm
- Python 3.10+
- A Supabase project with a URL and publishable key

### Install dependencies

Create and activate a Python environment in the backend folder so the project stays organized:

Linux/macOS:

```powershell
cd backend
py -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r ..\requirements.txt
```

Windows PowerShell:
```bash
cd ..
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

Create local environment files from the templates:

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

Set the values required by the clients. The backend client reads:

```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

The frontend template uses:

```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
VITE_API_URL=your_api_url_here
```

Do not commit `.env` files or secrets.

### Run the frontend

From `frontend/`:

```bash
npm run dev
```

Useful frontend commands:

```bash
npm run build
npm run lint
npm run preview
```

## Planned features

### Onboarding and access

- Welcome page, country selection, guest access, registration, login, and navigation

### Resume builder

- Create and edit resumes from structured forms
- Add, reorder, and manage resume sections
- Maintain multiple resumes and job-specific versions
- Export resumes as PDF

### AI resume coaching

- Analyze job descriptions
- Evaluate resume fit and identify missing skills
- Generate editable recommendations and professional summaries
- Preserve the master resume while creating tailored versions

### Job search and career growth

- Search, filter, view, and save job opportunities
- Track application status and activity
- Set career goals and receive skill, course, and certification recommendations

## Documentation

The MVP definition, database architecture, roadmap, user flows, and wireframes live under `docs/`. The database design uses Supabase/Postgres and includes master resumes, tailored resume snapshots, version history, AI suggestions, and job records.

## Collaboration

GitHub, GitHub Projects, and Miro are used for development and planning. The technology stack may evolve as the MVP is built.
- GitHub Projects
