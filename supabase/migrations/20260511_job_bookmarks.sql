-- Job bookmarks table for persistent saved jobs
CREATE TABLE IF NOT EXISTS job_bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX idx_job_bookmarks_user ON job_bookmarks(user_id);
CREATE INDEX idx_job_bookmarks_job ON job_bookmarks(job_id);
