export interface ResumeData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  summary: string[];
  experience: string[];
  skills: string[];
}

/** Used when the user creates a resume from scratch. */
export const EMPTY_RESUME: ResumeData = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  summary: [''],
  experience: [''],
  skills: [''],
};

/**
 * Stand-in for the fields a parsed resume would produce.
 * Replace this with the real parsing response once the backend route exists.
 */
export const SAMPLE_PARSED_RESUME: ResumeData = {
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
  skills: [
    'Product strategy',
    'UX research',
    'Figma and prototyping',
    'Design systems',
    'Cross-functional leadership',
  ],
};
