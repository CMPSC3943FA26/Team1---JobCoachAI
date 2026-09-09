// resumeData.ts
// Seed data used to match the current design and support future database hydration.
// This preserves the design exactly while keeping a clean place for persistence later.

export type ResumeSectionField = string

export const initialResume = {
  firstName: 'Jordan',
  lastName: 'Lee',
  phone: '(415) 555-0148',
  email: 'jordan.lee@example.com',
  summary: [
    'Product-minded designer who turns complex problems into clear, intuitive experiences. You bring a thoughtful balance of user empathy, sharp visual craft, and cross-functional momentum.',
  ],
  experience: [
    'Senior Product Designer | Northstar Labs | 2022 - Present\nLed a redesign of the onboarding experience that improved activation by 28% and created a reusable design system with product and engineering.',
    'UX Designer | Brightline Studio | 2019 - 2022\nPlanned user research, built interactive prototypes, and partnered with clients to launch accessible web products.',
  ],
  skills: ['Product strategy', 'UX research', 'Figma and prototyping', 'Design systems', 'Cross-functional leadership'],
  jobTitle: 'Product Designer',
  jobDescription: 'Paste the job description here...',
  uploadedFileName: 'No resume selected',
}
