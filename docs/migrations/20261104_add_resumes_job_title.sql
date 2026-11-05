ALTER TABLE public.resumes
ADD COLUMN IF NOT EXISTS job_title text;

NOTIFY pgrst, 'reload schema';
