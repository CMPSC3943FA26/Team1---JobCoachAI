// resumeData.ts
// Seed data used to match the current design and support future database hydration.
// This preserves the design exactly while keeping a clean place for persistence later.

export type ResumeSectionField = string

// Data types for the different resume sections.
export type WorkExperience = {
  id?: string
  job_title: string
  company: string
  location: string
  start_date: string
  end_date: string
  description: string
  sort_order?: number
}

export type Education = {
  id?: string
  school: string
  degree: string
  field_of_study: string
  start_date: string
  end_date: string
  sort_order?: number
}

export type Skill = {
  id?: string
  skill_name: string
  sort_order?: number
}

export type Project = {
  id?: string
  name: string
  description: string
  link: string
  sort_order?: number
}

export type Certification = {
  id?: string
  name: string
  issuer: string
  date_earned: string
  sort_order?: number
}

export type ResumeProfile = {
  first_name: string
  last_name: string
  email: string
  phone: string
  location: string
  professional_summary: string
}

// Maps each resume section to its corresponding data type.
export type ResumeSectionEntries = {
  work_experience: WorkExperience
  education: Education
  skills: Skill
  projects: Project
  certifications: Certification
  resume: ResumeProfile
}

// Main resume structure used by the editor and preview.
export type Resume = {
  id?: string
  first_name: string
  last_name: string
  email: string
  phone: string
  location: string
  professional_summary: string
  summary: string
  work_experience: WorkExperience[]
  education: Education[]
  skills: Skill[]
  projects: Project[]
  certifications: Certification[]
}

// Sample resume data used to populate the editor during development.
export const initialResume: Resume = {
  first_name: 'Jordan',
  last_name: 'Lee',
  email: 'jordan.lee@example.com',
  phone: '(415) 555-0148',
  location: 'San Francisco, CA',
  professional_summary:
    'Product-minded designer who turns complex problems into clear, intuitive experiences. You bring a thoughtful balance of user empathy, sharp visual craft, and cross-functional momentum.',
  summary:
    'Product-minded designer who turns complex problems into clear, intuitive experiences. You bring a thoughtful balance of user empathy, sharp visual craft, and cross-functional momentum.',
  work_experience: [
    {
      job_title: 'Senior Product Designer',
      company: 'Northstar Labs',
      location: 'San Francisco, CA',
      start_date: '2022',
      end_date: 'Present',
      description:
        'Led a redesign of the onboarding experience that improved activation by 28% and created a reusable design system with product and engineering.',
    },
    {
      job_title: 'UX Designer',
      company: 'Brightline Studio',
      location: 'Oakland, CA',
      start_date: '2019',
      end_date: '2022',
      description:
        'Planned user research, built interactive prototypes, and partnered with clients to launch accessible web products.',
    },
  ],
  education: [
    {
      school: 'California College of the Arts',
      degree: 'B.A.',
      field_of_study: 'Interaction Design',
      start_date: '2015',
      end_date: '2019',
    },
  ],
  skills: [
    { skill_name: 'Product strategy' },
    { skill_name: 'UX research' },
    { skill_name: 'Figma and prototyping' },
    { skill_name: 'Design systems' },
    { skill_name: 'Cross-functional leadership' },
  ],
  projects: [
    {
      name: 'Onboarding redesign',
      description:
        'Increased activation by 28% through a clearer first-run experience.',
      link: '',
    },
  ],
  certifications: [
    {
      name: 'Google UX Design Certificate',
      issuer: 'Google',
      date_earned: '2021',
    },
  ],
}

// Empty section templates used when users add new resume entries.
export const resumeSectionEntries: ResumeSectionEntries = {
  work_experience: {
    job_title: '',
    company: '',
    location: '',
    start_date: '',
    end_date: '',
    description: '',
  },
  education: {
    school: '',
    degree: '',
    field_of_study: '',
    start_date: '',
    end_date: '',
  },
  skills: {
    skill_name: '',
  },
  projects: {
    name: '',
    description: '',
    link: '',
  },
  certifications: {
    name: '',
    issuer: '',
    date_earned: '',
  },
  resume: {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    location: '',
    professional_summary: '',
  },
}