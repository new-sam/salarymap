-- 파트너 기업 추천 공고 16개 추가
-- DF Corp: Closed - Cancelled → 제외
-- 나머지 15개 In Progress 공고 추가

INSERT INTO jobs (title, company, company_initials, location, type, country, role, experience_min, experience_max, salary_min, salary_max, description, is_active, is_featured, apply_url, headcount, tech_stack, benefits, company_size, source) VALUES

-- SeedLab
('Performance & Growth Manager', 'SeedLab', 'SL', 'Seoul', 'onsite', 'korea', 'PM', 4, 5, 50000000, 70000000,
 'Performance & Growth Manager role at SeedLab. Responsible for driving growth strategies, analyzing performance metrics, and optimizing marketing campaigns. 4-5 years of experience required.',
 true, true, 'https://www.notion.so/likelion/SL201-Performance-Growth-Manager-4-5-years-1-35644860a4f48036a7bfd71e5b43873e?source=copy_link', 1, '{}', '{}', '', 'manual'),

('Content & Conversion Manager', 'SeedLab', 'SL', 'Seoul', 'onsite', 'korea', 'PM', 4, 5, 50000000, 70000000,
 'Content & Conversion Manager role at SeedLab. Focus on creating compelling content strategies and optimizing conversion funnels. 4-5 years of experience required.',
 true, true, 'https://www.notion.so/likelion/SL202-Content-Conversion-Manager-4-5-years-1-35644860a4f48046b611dc8fa5496bad?source=copy_link', 1, '{}', '{}', '', 'manual'),

-- Jinosys
('AI, IoT, and Robotics Integrated Mobile App & Web Service Developer', 'Jinosys', 'JN', 'Seoul', 'onsite', 'korea', 'Fullstack', 0, 10, 35000000, 70000000,
 'Full-stack developer role integrating AI, IoT, and Robotics into mobile and web services. All experience levels welcome. Intermediate Korean required (OPIc IM).',
 true, true, 'https://www.notion.so/likelion/JN301-AI-IoT-and-Robotics-Integrated-Mobile-App-Web-Service-Developer-35644860a4f48075ab07f8dbbb2c0039?source=copy_link', 3, ARRAY['React', 'Node.js', 'Python', 'IoT'], '{}', '', 'manual'),

-- FPT Software
('Embedded Software Developer', 'FPT Software', 'FPT', 'Seoul', 'onsite', 'korea', 'Backend', 0, 1, 30000000, 45000000,
 'Embedded software developer intern position at FPT Software. Work on embedded systems and firmware development. Intermediate Korean required (OPIc IM).',
 true, true, 'https://www.notion.so/likelion/FPT401-Embedded-Software-Developer-35644860a4f480f6800dc70e7fa7c8e3?source=copy_link', 5, ARRAY['C', 'C++', 'Embedded'], '{}', '', 'manual'),

-- Nexacode
('Full-stack Developer', 'Nexacode', 'NX', 'Seoul', 'onsite', 'korea', 'Fullstack', 0, 2, 35000000, 50000000,
 'Entry-level full-stack developer position at Nexacode. Build and maintain web applications with modern technologies.',
 true, true, 'https://www.notion.so/likelion/NX501-Full-stack-Developer-35644860a4f4800f836cf09013eaaf28?source=copy_link', 2, ARRAY['React', 'Node.js', 'TypeScript'], '{}', '', 'manual'),

-- Wellpod
('TikTok Ads Marketing Manager', 'Wellpod', 'WP', 'Seoul', 'onsite', 'korea', 'PM', 0, 1, 30000000, 45000000,
 'TikTok Ads Marketing Manager intern position at Wellpod. Manage and optimize TikTok advertising campaigns for maximum ROI.',
 true, true, 'https://www.notion.so/likelion/WP601-TikTok-Ads-Marketing-Manager-35644860a4f4800781ffc8c7c55b6649?source=copy_link', 1, '{}', '{}', '', 'manual'),

('TikTok Shop & Shopify Manager', 'Wellpod', 'WP', 'Seoul', 'onsite', 'korea', 'PM', 0, 1, 30000000, 45000000,
 'TikTok Shop & Shopify Manager intern position at Wellpod. Manage e-commerce operations across TikTok Shop and Shopify platforms.',
 true, true, 'https://www.notion.so/likelion/WP602-TikTok-Shop-Shopify-Manager-35744860a4f48085b610d2a731cc3806?source=copy_link', 1, '{}', '{}', '', 'manual'),

-- Mutistation
('UI/UX Designer', 'Mutistation', 'MT', 'Seoul', 'onsite', 'korea', 'Design', 2, 4, 40000000, 60000000,
 'UI/UX Designer position at Mutistation. Design intuitive user interfaces and experiences. 3 years of experience required. Recruitment period: July ~ August.',
 true, true, 'https://www.notion.so/likelion/MT701-UI-UX-Designer-35644860a4f480e8906bd56402af60a7?source=copy_link', 2, ARRAY['Figma', 'Adobe XD'], '{}', '', 'manual'),

('Website Developer', 'Mutistation', 'MT', 'Seoul', 'onsite', 'korea', 'Frontend', 2, 4, 40000000, 60000000,
 'Website Developer position at Mutistation. Build and maintain responsive web applications. 3 years of experience required. Recruitment period: July ~ August.',
 true, true, 'https://www.notion.so/likelion/MT702-Website-Developer-35744860a4f4807ebc9bd9406ffff095?source=copy_link', 1, ARRAY['JavaScript', 'React', 'HTML', 'CSS'], '{}', '', 'manual'),

-- Andwise
('Full-stack Developer', 'Andwise', 'AW', 'Seoul', 'onsite', 'korea', 'Fullstack', 2, 4, 40000000, 60000000,
 'Full-stack Developer position at Andwise. Build end-to-end web applications. 3 years of experience required. Basic Korean required (OPIc IL+).',
 true, true, 'https://www.notion.so/likelion/AW801-Full-stack-Developer-35644860a4f48003ace2c260b2907e02?source=copy_link', 3, ARRAY['React', 'Node.js', 'TypeScript'], '{}', '', 'manual'),

-- ONSQUARE
('Full-stack Developer', 'ONSQUARE', 'OQ', 'Seoul', 'onsite', 'korea', 'Fullstack', 4, 6, 50000000, 75000000,
 'Senior Full-stack Developer position at ONSQUARE. 5 years of experience required. Build scalable web applications and services.',
 true, true, 'https://www.notion.so/likelion/OQ901-Full-stack-Developer-35744860a4f4800d905bc18e289b1e2b?source=copy_link', 2, ARRAY['React', 'Node.js', 'TypeScript'], '{}', '', 'manual'),

-- Lumicraft
('Full-stack Developer', 'Lumicraft', 'LM', 'Seoul', 'onsite', 'korea', 'Fullstack', 0, 2, 35000000, 50000000,
 'Full-stack Developer position at Lumicraft. 1 year of experience required. Work with modern web technologies.',
 true, true, 'https://www.notion.so/likelion/LM10-Lumicraft-35744860a4f480ce9e27d397db0dffd2?source=copy_link', 1, ARRAY['React', 'Node.js'], '{}', '', 'manual'),

-- Shupia
('Full Stack Developer', 'Shupia', 'SHU', 'Seoul', 'onsite', 'korea', 'Fullstack', 2, 4, 40000000, 60000000,
 'Full Stack Developer position at Shupia. 3 years of experience required. Recruitment period: July.',
 true, true, 'https://www.notion.so/SHU1101_Full-Stack-Developer-35d44860a4f4809d88baf5de619c0824?source=copy_link', 1, ARRAY['React', 'Node.js', 'TypeScript'], '{}', '', 'manual'),

('UX/UI Developer', 'Shupia', 'SHU', 'Seoul', 'onsite', 'korea', 'Design', 2, 4, 40000000, 60000000,
 'UX/UI Developer position at Shupia. 3 years of experience required. Recruitment period: July.',
 true, true, 'https://www.notion.so/SHU1102_UX-UI-Developer-35d44860a4f48097b7a7e29a3c5ff263?source=copy_link', 1, ARRAY['Figma', 'React', 'CSS'], '{}', '', 'manual'),

-- MNF Solution
('Full-stack Developer', 'MNF Solution', 'MNF', 'Seoul', 'onsite', 'korea', 'Fullstack', 2, 4, 40000000, 60000000,
 'Full-stack Developer (Back-end/Front-end, Back Office/Front Office) position at MNF Solution. 2-4 years of experience required. Recruitment period: June.',
 true, true, 'https://www.notion.so/MNF1201-Back-end-Front-end-Developer-Back-Office-Front-Office-35d44860a4f48014857aca9e6450950d?source=copy_link', 2, ARRAY['React', 'Node.js', 'TypeScript'], '{}', '', 'manual');
