-- Pre-curated school domain → canonical name + tier, so a verified student email
-- maps to the *right* university name (and prestige tier) instead of a best-effort
-- guess. The abbreviation IS the domain for VN schools (hust.edu.vn, ftu.edu.vn…),
-- which makes domains a far cleaner key than the free-text `university` field.
--
-- Matching is by domain *suffix* (verify.js): student mailboxes live on faculty/
-- student subdomains (sis.hust.edu.vn, gm.uit.edu.vn, student.tdtu.edu.vn) — the
-- longest seeded suffix wins, so member subdomains (uet.vnu.edu.vn) are resolved
-- before the shared root (vnu.edu.vn).
--
-- tier mirrors lib/topUniversities.js ('top' = KPI-counted flagship/elite,
-- 'strong' = regional/near-elite, null = unclassified). country marks overseas
-- (US/UK/…); null = domestic VN. Both are policy choices — edit the rows freely.

ALTER TABLE school_domains ADD COLUMN IF NOT EXISTS tier TEXT;     -- 'top' | 'strong' | null
ALTER TABLE school_domains ADD COLUMN IF NOT EXISTS country TEXT;  -- 'US' | 'UK' | ... | null (null = VN)

-- Cache the verified school's tier on the profile (mirror of verified_school_name)
-- so the admin talent pool can count domain-verified prestige authoritatively,
-- not only the free-text resume `university`.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS verified_school_tier TEXT;

-- Upsert so any row auto-created earlier by a best-effort guess gets corrected.
INSERT INTO school_domains (domain, school_name, tier, country) VALUES
  -- === Vietnam — tier: top (KPI 집계 대상) ===
  -- VNU-HCM members (each on its own registrable domain)
  ('hcmut.edu.vn',     'HCMUT (Bách Khoa, VNU-HCM)',                 'top', NULL),
  ('hcmus.edu.vn',     'University of Science (VNU-HCM)',            'top', NULL),
  ('uit.edu.vn',       'UIT (VNU-HCM)',                             'top', NULL),
  ('hcmiu.edu.vn',     'International University (VNU-HCM)',         'top', NULL),
  ('vnuhcm.edu.vn',    'VNU-HCM',                                   'top', NULL),
  -- VNU Hanoi members live on subdomains of the shared root vnu.edu.vn —
  -- seed the specific members first; bare vnu.edu.vn is the generic fallback.
  ('uet.vnu.edu.vn',   'UET (VNU Hanoi)',                           'top', NULL),
  ('hus.vnu.edu.vn',   'University of Science (VNU Hanoi)',          'top', NULL),
  ('vnu.edu.vn',       'VNU Hanoi',                                 'top', NULL),
  -- Elite single-focus / specialised
  ('hust.edu.vn',      'HUST (Bách Khoa Hà Nội)',                   'top', NULL),
  ('dut.udn.vn',       'Danang Univ. of Science and Technology (Bách Khoa)', 'top', NULL),
  ('ptit.edu.vn',      'PTIT',                                      'top', NULL),
  ('fpt.edu.vn',       'FPT University',                            'top', NULL),
  ('rmit.edu.vn',      'RMIT Vietnam',                              'top', NULL),
  ('ftu.edu.vn',       'Foreign Trade University (FTU)',            'top', NULL),
  ('neu.edu.vn',       'National Economics University (NEU)',       'top', NULL),
  ('ueh.edu.vn',       'University of Economics HCMC (UEH)',         'top', NULL),
  ('lqdtu.edu.vn',     'Le Quy Don Technical University',           'top', NULL),
  ('mta.edu.vn',       'Le Quy Don Technical University',           'top', NULL),

  -- === Vietnam — tier: strong (지역 거점/준명문, KPI 미집계) ===
  ('hutech.edu.vn',    'HUTECH (HCMC Univ. of Technology, private)', 'strong', NULL),
  ('hoasen.edu.vn',    'Hoa Sen University',                        'strong', NULL),
  ('ctu.edu.vn',       'Can Tho University',                        'strong', NULL),
  ('tdtu.edu.vn',      'Ton Duc Thang University',                  'strong', NULL),
  ('duytan.edu.vn',    'Duy Tan University',                        'strong', NULL),
  ('dtu.edu.vn',       'Duy Tan University',                        'strong', NULL),
  ('iuh.edu.vn',       'Industrial University of HCMC',             'strong', NULL),
  ('utc.edu.vn',       'University of Transport and Communications', 'strong', NULL),
  ('utc2.edu.vn',      'University of Transport and Communications', 'strong', NULL),

  -- === Overseas (유학) — tier null; bucketed by country in the admin pool ===
  -- Names contain a keyword lib/topUniversities.js matches, so name-based
  -- classification (isOverseas) also resolves them.
  -- US
  ('harvard.edu',      'Harvard University',                        NULL, 'US'),
  ('stanford.edu',     'Stanford University',                       NULL, 'US'),
  ('mit.edu',          'Massachusetts Institute of Technology (MIT)', NULL, 'US'),
  ('berkeley.edu',     'University of California, Berkeley',         NULL, 'US'),
  ('ucla.edu',         'UCLA',                                      NULL, 'US'),
  ('usc.edu',          'University of Southern California (USC)',    NULL, 'US'),
  ('nyu.edu',          'New York University',                       NULL, 'US'),
  ('columbia.edu',     'Columbia University',                       NULL, 'US'),
  ('cornell.edu',      'Cornell University',                        NULL, 'US'),
  ('princeton.edu',    'Princeton University',                      NULL, 'US'),
  ('yale.edu',         'Yale University',                           NULL, 'US'),
  ('cmu.edu',          'Carnegie Mellon University',                NULL, 'US'),
  ('purdue.edu',       'Purdue University',                         NULL, 'US'),
  ('gatech.edu',       'Georgia Tech',                              NULL, 'US'),
  ('bu.edu',           'Boston University',                         NULL, 'US'),
  ('asu.edu',          'Arizona State University',                  NULL, 'US'),
  -- Australia
  ('sydney.edu.au',    'University of Sydney',                      NULL, 'Australia'),
  ('unimelb.edu.au',   'University of Melbourne',                   NULL, 'Australia'),
  ('monash.edu',       'Monash University',                        NULL, 'Australia'),
  ('unsw.edu.au',      'UNSW Sydney',                              NULL, 'Australia'),
  ('uq.edu.au',        'University of Queensland',                  NULL, 'Australia'),
  ('deakin.edu.au',    'Deakin University',                        NULL, 'Australia'),
  ('adelaide.edu.au',  'University of Adelaide',                    NULL, 'Australia'),
  ('curtin.edu.au',    'Curtin University',                        NULL, 'Australia'),
  ('uow.edu.au',       'University of Wollongong',                  NULL, 'Australia'),
  ('mq.edu.au',        'Macquarie University',                     NULL, 'Australia'),
  -- Canada
  ('utoronto.ca',      'University of Toronto',                     NULL, 'Canada'),
  ('ubc.ca',           'University of British Columbia (UBC)',       NULL, 'Canada'),
  ('mcgill.ca',        'McGill University',                        NULL, 'Canada'),
  ('uwaterloo.ca',     'University of Waterloo',                    NULL, 'Canada'),
  ('ualberta.ca',      'University of Alberta',                     NULL, 'Canada'),
  ('umontreal.ca',     'University of Montreal',                    NULL, 'Canada'),
  ('uottawa.ca',       'University of Ottawa',                      NULL, 'Canada'),
  ('ucalgary.ca',      'University of Calgary',                     NULL, 'Canada'),
  -- UK
  ('ox.ac.uk',         'University of Oxford',                      NULL, 'UK'),
  ('cam.ac.uk',        'University of Cambridge',                   NULL, 'UK'),
  ('ucl.ac.uk',        'University College London (UCL)',           NULL, 'UK'),
  ('manchester.ac.uk', 'University of Manchester',                  NULL, 'UK'),
  ('ed.ac.uk',         'University of Edinburgh',                   NULL, 'UK'),
  ('warwick.ac.uk',    'University of Warwick',                     NULL, 'UK'),
  ('leeds.ac.uk',      'University of Leeds',                       NULL, 'UK'),
  ('bristol.ac.uk',    'University of Bristol',                     NULL, 'UK'),
  ('gla.ac.uk',        'University of Glasgow',                     NULL, 'UK'),
  ('nottingham.ac.uk', 'University of Nottingham',                  NULL, 'UK'),
  ('bham.ac.uk',       'University of Birmingham',                  NULL, 'UK'),
  ('sheffield.ac.uk',  'University of Sheffield',                   NULL, 'UK'),
  -- Singapore / New Zealand / Ireland
  ('nus.edu.sg',       'National University of Singapore (NUS)',     NULL, 'Singapore'),
  ('ntu.edu.sg',       'Nanyang Technological University (NTU Singapore)', NULL, 'Singapore'),
  ('auckland.ac.nz',   'University of Auckland',                    NULL, 'New Zealand'),
  ('otago.ac.nz',      'University of Otago',                       NULL, 'New Zealand'),
  ('tcd.ie',           'Trinity College Dublin',                   NULL, 'Ireland')
ON CONFLICT (domain) DO UPDATE
  SET school_name = EXCLUDED.school_name,
      tier        = EXCLUDED.tier,
      country     = EXCLUDED.country;

-- Backfill verified_school_tier for users already verified before this seed,
-- matching their stored verified_school_domain by longest suffix.
UPDATE user_profiles p
SET verified_school_tier = s.tier
FROM school_domains s
WHERE p.verified_school_domain IS NOT NULL
  AND s.tier IS NOT NULL
  AND (p.verified_school_domain = s.domain OR p.verified_school_domain LIKE '%.' || s.domain)
  AND s.domain = (
    SELECT s2.domain FROM school_domains s2
    WHERE s2.tier IS NOT NULL
      AND (p.verified_school_domain = s2.domain OR p.verified_school_domain LIKE '%.' || s2.domain)
    ORDER BY length(s2.domain) DESC
    LIMIT 1
  );
