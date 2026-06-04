-- 기존 manual 소스 공고 비활성화 (새 데이터로 교체)
UPDATE public.jobs SET is_active = false WHERE source = 'manual';

-- 새 공고 20개 추가
INSERT INTO public.jobs (title, company, company_initials, location, type, country, role, experience_min, experience_max, salary_min, salary_max, description, is_active, is_featured, apply_url, headcount, tech_stack, benefits, company_size, source, image_url, logo_url) VALUES

-- 1. Andwise - Full-stack Developer
('Full-stack Developer', 'Andwise', 'AW', 'District 7, HCMC', 'remote', 'korea', 'Fullstack', 3, 3, 25000000, 28000000,
E'## Company Overview\nAndwise is an IT company specializing in digital platform development and operation for public institutions, universities, and various industries since 2008.\nThe company provides integrated services including website development, CMS, cloud transformation, system maintenance, and AI-based solutions.\nWith its proprietary GINIWORKS CMS and advanced AI technologies, Andwise delivers optimized and user-centered digital services for clients.\n\n## Responsibilities\nKey Responsibilities\n\n- Maintenance and improvement of G-Works CMS.\n- AI service development.\n- Web server environment setup and management.\n\nQualifications\n\n- Java: Spring Boot, Spring MVC, Liferay, Hibernate, Restful API, Apache Tomcat, JBoss.\n- Front-end: JavaScript (jQuery), HTML, CSS, JSON, JSP.\n- SQL: MySQL, PostgreSQL, Oracle, SQL Server.\n\n## Requirements\n- Proficiency in Korean.\n- Proficiency in English.\n- Experience in setting up and managing Web Servers.',
true, false, 'https://www.andwise.com/', 3,
ARRAY['Java', 'Spring Boot', 'JavaScript', 'MySQL', 'PostgreSQL'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Andwise%20(1).png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Andwise%20(1).png'),

-- 2. FPT Software Korea - AI/ML Engineer
('AI/ML Engineer', 'FPT Software Korea', 'FPT', 'District 7, HCMC', 'remote', 'korea', 'Data', 1, NULL, 50000000, 60000000,
E'## Company Overview\nFPT Software Korea is a subsidiary of FPT Software Co. Ltd., which manages the Technology business division of FPT Group, Vietnam''s largest ICT company. The company registered as a foreign-invested entity on March 9, 2020.\n\n## Responsibilities\n- Develop, train, validate, and deploy AI/ML models for production environments\n- Design and optimize data pipelines for model training, inference, and evaluation in collaboration with Data Engineers\n- Perform large-scale data preprocessing, cleansing, and feature engineering\n- Integrate AI solutions into operational systems, APIs, and cloud platforms for stable and scalable services\n- Monitor and continuously improve model performance, including accuracy, latency, and scalability\n- Collaborate cross-functionally with Data Engineers, Backend Developers, Product Owners, and other stakeholders to deliver end-to-end AI solutions\n- Research and stay up to date with the latest AI/ML technologies and share technical knowledge within the team\n\n## Requirements\n- Bachelor''s degree or higher in Computer Science, Data Science, AI, or related field\n- Minimum 1 year of hands-on experience as an AI/ML Engineer\n- Strong understanding of ML algorithms, deep learning, and statistics\n- Experience with Python and TensorFlow, PyTorch, or Scikit-learn\n- Experience with Pandas and NumPy\n- Experience deploying AI models into production\n- Experience integrating REST APIs and microservices\n- Experience in NLP, Computer Vision, Recommendation Systems, or Generative AI/LLMs\n- Good communication skills in English or Korean',
true, false, 'https://fptsoftware.kr/', 10,
ARRAY['Python', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy'],
ARRAY['Opportunity to work on cutting-edge AI technologies', 'Collaborative and innovation-driven work environment', 'Continuous learning and professional growth opportunities', 'Exposure to scalable AI systems and modern MLOps practices'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20FPT.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20FPT.png'),

-- 3. Metainnotech - HR & Accounting Coordinator
('HR & Accounting Coordinator', 'Metainnotech', 'META', 'District 7, HCMC', 'onsite', 'korea', 'Non-IT', 2, 2, 15000000, 25000000,
E'## Company Overview\nMetainnotech Inc. is a Korean technology company specializing in AIoT-based floor noise solutions. The HCMC branch operates software development and UX/UI teams and develops the official KOCHAM Vietnam application.\n\n## Responsibilities\n- Prepare, manage, and renew labor contracts\n- Manage attendance, leave, and overtime records\n- Handle onboarding documents for new employees\n- Manage SHUI, work permit, and visa renewals\n- Manage office administration, equipment, and utilities\n- Prepare and submit annual DPI reports\n- Enter accounting records into MISA\n- Issue and manage e-VAT invoices\n- Bank reconciliation and expense reporting\n- Assist in preparing annual financial statements\n- Handle VAT, PIT, and CIT tax filing\n- Prepare payroll and SHUI documents\n- Prepare monthly HR & finance reports\n- Support annual audit processes\n\n## Requirements\n- Basic or above proficiency in MISA\n- Experience in VAT filing via eTax or willingness to learn\n- Proficient in Excel / Google Sheets\n- Strong attention to numerical accuracy\n- Basic knowledge of Vietnamese labor law & social insurance\n- Basic to intermediate Korean communication skills preferred\n- 2+ years experience in Korean companies preferred',
true, true, 'https://www.metainnotech-vn.com/', 1,
ARRAY['MISA', 'Excel', 'Google Sheets'],
ARRAY['Full SHUI coverage according to Vietnamese law', '12 annual leave days', '13th-month bonus before Lunar New Year', '1.5-hour lunch break', 'Korean company working environment', 'Opportunity to grow with an expanding company'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Metainnotech.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Metainnotech.png'),

-- 4. Nexacode - Full-stack Developer
('Full-stack Developer', 'Nexacode', 'NX', 'District 7, HCMC', 'remote', 'korea', 'Fullstack', 1, 1, 18000000, 20000000,
E'## Company Overview\nWe are a software development company specializing in in-house services such as ERP and B2B SaaS. Additionally, we provide customized system development services upon request from external clients.\n\n## Responsibilities\n- Internal SaaS program development and collaboration on external projects\n- Develop and maintain the company''s internal SaaS products\n- Participate in building and delivering software projects for external clients\n- Design, develop, and optimize both front-end and back-end systems\n- Collaborate with UI/UX designers, QA teams, and other stakeholders\n- Write clean, maintainable code following best practices\n- Perform testing, debugging, and system performance improvements\n\n## Requirements\n- Front-End: Experience in React, Next.js development\n- Back-End: Experience in Nest.js, Python development\n- App: Experience in Flutter development\n- Candidates with 1 year of experience or more',
true, true, 'https://nexacode.co.kr', 2,
ARRAY['React', 'Next.js', 'Nest.js', 'Python', 'Flutter'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Nexacode.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Nexacode.png'),

-- 5. FPT Software Korea - Embedded Software Developer
('Embedded Software Developer', 'FPT Software Korea', 'FPT', 'District 7, HCMC', 'remote', 'korea', 'Backend', 1, 1, 7000000, 40000000,
E'## Company Overview\nFPT Software Korea is a subsidiary of FPT Software Co. Ltd., which manages the Technology business division of FPT Group, Vietnam''s largest ICT company.\n\n## Responsibilities\n- Join a 3-6 month training program in software technologies for the Automotive domain (Infotainment, etc.)\n- Learn and practice with industry-standard tools and processes (Agile, ASPICE, ISO 26262)\n- Participate in simulated and real projects under the guidance of experienced mentors\n- Communicate and collaborate with colleagues and clients in Korean and English\n- Upon successful completion, become a full-time engineer in global Automotive projects\n\n## Requirements\n- Bachelor''s degree (or final-year student) in Computer Science, IT, Electronics, etc.\n- Korean proficiency (TOPIK Level 4+ or equivalent) is strongly preferred\n- Solid foundation in programming (Java, C/C++, Python, or similar)\n- Good teamwork, logical thinking, and eagerness to learn\n- No prior work experience required - open for fresh graduates',
true, false, 'https://fptsoftware.kr/', 5,
ARRAY['Java', 'C', 'C++', 'Python', 'Embedded'],
ARRAY['Travel Allowance paid once a year', '5 additional days of summer vacation', 'Birthday Half-Day Leave', 'Commuting Expense Support', 'Childcare Allowance', 'Long-Term Service Awards', 'Education Expense Support', 'Individual and Management Performance Bonuses', 'Employee Health Checkups'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20FPT.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20FPT.png'),

-- 6. Jinosys - Mobile App & Web Service Developer
('Mobile App & Web Service Developer', 'Jinosys', 'JN', 'District 7, HCMC', 'remote', 'korea', 'Fullstack', 1, 2, 7000000, 10000000,
E'## Company Overview\nJinosys Co., Ltd. is a safety-specialized innovation company that develops proprietary AI-based safety IoT platforms and smart management systems.\n\nWith 18 patents and nearly a decade of experience as a primary safety partner for global leaders like Samsung Electronics, Jinosys integrates advanced IoT sensors and big data to digitalize industrial safety and create secure work environments.\n\n## Responsibilities\n- Development of robot AI and autonomous navigation systems\n- Upgrade and optimization of existing AI-based fire detection models\n- Development of on-device AI fire detection using smartphone cameras\n- Integration and management of IoT devices and platforms\n- Development of web services and integration with cloud-based APIs\n- Collection of AI data and support for model training\n\n## Requirements\n- Development: PHP, HTML5, CSS3, JavaScript, Android (Java/Kotlin)\n- AI: TensorFlow, PyTorch Mobile, etc\n- Experience with API integration',
true, true, 'http://www.jinosys.net/en/', 2,
ARRAY['PHP', 'HTML5', 'CSS3', 'JavaScript', 'Android', 'Java', 'Kotlin', 'TensorFlow', 'PyTorch'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-Jinosys.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-Jinosys.png'),

-- 7. ONSQUARE - Senior SafePay Backend Developer
('Senior SafePay Backend Developer', 'ONSQUARE', 'OQ', 'District 7, HCMC', 'remote', 'korea', 'Backend', 5, 5, 30000000, 35000000,
E'## Company Overview\nONSQUARE INC is a Korea-based Fintech and AI-based SaaS startup. It develops payment infrastructure and AI Agent-based user tools for the global market, operating with a distributed team structure across Korea, Canada, and Vietnam.\n\n## Responsibilities\n- Design and develop international payment and remittance infrastructure\n- Implement escrow payment systems with milestone-based settlements\n- Build KYC/AML systems\n- Integrate payment gateways (Stripe, Toss Payments, Airwallex, etc.)\n- Handle compliance requirements for international remittance services\n- Manage payment security and fraud/anomaly detection systems\n\n## Requirements\n- Minimum 5 years of senior backend development experience\n- Hands-on experience with Node.js / NestJS or equivalent backend frameworks\n- Experience in PostgreSQL-based data modeling\n- Experience operating AWS-based infrastructure\n- Mandatory experience in fintech/payment system development\n- Ability to read and write technical documentation in English\n- Currently residing in Ho Chi Minh City or willing to relocate',
true, true, 'https://dearfriday.net', 1,
ARRAY['Node.js', 'NestJS', 'PostgreSQL', 'AWS', 'Stripe'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-ONSQUARE.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-ONSQUARE.png'),

-- 8. Shupia - UX/UI Developer
('UX/UI Developer', 'Shupia', 'SHU', 'District 7, HCMC', 'remote', 'korea', 'Design', 3, 3, 22000000, 27000000,
E'## Company Overview\nJoi App is an AI-powered emotional and behavioral prognosis management platform that analyzes daily user data to detect emotional stability trends and early risk signals.\n\nThe platform combines AI analytics, digital healthcare services, and mobile/cloud infrastructure to provide personalized behavioral recommendations, recovery monitoring, and institutional dashboards.\n\n## Responsibilities\n- Improve and refine the current Joi app experience\n- Elevate UI clarity, usability, and emotional engagement\n- Create assets for app updates, marketing, and product storytelling\n- Collaborate closely with developers to implement changes\n- Help manage user communication channels\n- Support onboarding and user engagement\n- Design product description pages, landing pages, brochures, presentation slides\n- Edit short-form and promotional videos\n\n## Requirements\n- Strong modern UI/UX sense (mobile-first)\n- Fluent in Korean and English\n- Skilled with design + general tools (Figma, PPT, web/app assets)\n- Ability to contribute to both product and marketing design\n- You improve user understanding and engagement, not just visuals',
true, false, 'https://joiapp.net', 1,
ARRAY['Figma', 'Adobe XD', 'CapCut'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Shupia.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Shupia.png'),

-- 9. Lumicraft - Full-stack Developer
('Full-stack Developer', 'Lumicraft', 'LM', 'District 7, HCMC', 'remote', 'korea', 'Fullstack', 1, 1, 18000000, 27000000,
E'## Company Overview\nA combination of AI technology and digital content. Developing an AI-based casting matching platform.\n\n## Responsibilities\n- Development and maintenance of Next.js-based web platforms\n- Database management using Postgres, Supabase, and Drizzle ORM\n- Implementing Frontend-Backend communication via tRPC and React Query\n- Future participation in mobile app development using React Native\n- Collaboration through Git\n\n## Requirements\n- Front End: TypeScript, React.js, Next.js, TailwindCSS\n- Back End: Node.js, tRPC, Supabase, Drizzle ORM\n- Database: PostgreSQL\n- Mobile: React Native (Optional)\n\nPreferred:\n- Experience with React Query and tRPC\n- Experience in messaging services or performance optimization\n- Interest or experience in UI/UX design',
true, false, 'https://castlink.co.kr/ko', 1,
ARRAY['TypeScript', 'React.js', 'Next.js', 'TailwindCSS', 'Node.js', 'tRPC', 'Supabase', 'PostgreSQL'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20castlink.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20castlink.png'),

-- 10. Onsquare - Full-stack Developer
('Full-stack Developer', 'ONSQUARE', 'OQ', 'District 7, HCMC', 'remote', 'korea', 'Fullstack', 5, 5, 30000000, 35000000,
E'## Company Overview\nONSQUARE INC is a Korea-based Fintech and AI-based SaaS startup. It develops payment infrastructure and AI Agent-based user tools for the global market, operating with a distributed team structure across Korea, Canada, and Vietnam.\n\n## Responsibilities\n- Develop Fintech and AI Agent services\n- Develop in-house SaaS products\n- B2B workflow management tools (Immigration automation)\n- Fintech payment platform (Remittance, Payment, KYC)\n- AI Agent-based user tools\n- Front-end: React and TypeScript-based web applications\n- Back-end: API servers based on Node.js and NestJS\n- Data modeling and caching using PostgreSQL and Redis\n- GitHub-based code reviews and PR collaboration\n- Deployment and operation in AWS environments\n\n## Requirements\n- 5+ years of Full-stack web development experience\n- Experience in React and TypeScript frontend development\n- Experience in Node.js, NestJS backend frameworks\n- Experience in PostgreSQL data modeling and query optimization\n- Experience in fintech, B2B SaaS, or AI products preferred\n- Experience integrating payment systems (Stripe, Airwallex)\n- Proficient in English conversation',
true, true, 'https://dearfriday.net', 2,
ARRAY['React', 'TypeScript', 'Node.js', 'NestJS', 'PostgreSQL', 'Redis', 'AWS'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-ONSQUARE.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-ONSQUARE.png'),

-- 11. SeedLab - Performance & Growth Manager
('Performance & Growth Manager', 'SeedLab', 'SL', 'District 7, HCMC', 'remote', 'korea', 'PM', 4, 5, 20000000, 40000000,
E'## Company Overview\nSeedLab is an execution-driven operating partner built to navigate the real complexity of global expansion. Our team has spent years building and operating companies directly in the U.S., with hands-on experience across market entry, commerce infrastructure, growth marketing, and local operations.\n\n## Responsibilities\n- Manage and optimize Amazon Ads (Sponsored Products, Sponsored Brands, Sponsored Display)\n- Build and scale campaign structures (Auto -> Manual -> Scaling)\n- Conduct keyword research and develop SEO strategies\n- Analyze sales and advertising data to generate actionable insights\n- Plan and execute pricing and promotional strategies\n- Drive external traffic (Meta, Google) to Amazon listings\n- Set up and manage Amazon Attribution for performance tracking\n\nKPIs: ROAS, ACOS, TACOS, Total revenue growth, Organic vs paid sales ratio\n\n## Requirements\n- 4+ years of hands-on Amazon PPC experience\n- Proven track record of driving revenue growth\n- Strong analytical skills (Excel, GA, or similar tools)\n- Solid understanding of keyword strategy and Amazon SEO\n- Experience with external traffic channels (Meta, Google) is a plus',
true, false, 'https://www.seedlab.xyz/', 1,
ARRAY['Amazon PPC', 'Excel', 'Google Analytics'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20SEEDLAB.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20SEEDLAB.png'),

-- 12. SeedLab - Content & Conversion Manager
('Content & Conversion Manager', 'SeedLab', 'SL', 'District 7, HCMC', 'remote', 'korea', 'PM', 4, 5, 20000000, 40000000,
E'## Company Overview\nSeedLab is an execution-driven operating partner built to navigate the real complexity of global expansion. Our team has spent years building and operating companies directly in the U.S.\n\n## Responsibilities\n- Create and optimize Amazon listings (title, bullet points, descriptions)\n- Plan and execute A+ Content\n- Lead product image and video direction (including thumbnails)\n- Develop and manage review and rating strategies\n- Define brand positioning and product messaging (USP)\n- Analyze competitor listings and content strategies\n- Optimize content based on SEO and performance data\n\nKPIs: Conversion rate (CVR), Sales per session, Click-through rate (CTR), Listing quality score\n\n## Requirements\n- 4+ years of experience in Amazon listing and content optimization\n- Proven track record of improving conversion rates\n- Strong copywriting and content planning skills\n- Experience working with designers or managing creative assets\n- Strong understanding of consumer behavior and buying psychology',
true, false, 'https://www.seedlab.xyz/', 1,
ARRAY['Amazon', 'Content Strategy', 'SEO'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20SEEDLAB.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20SEEDLAB.png'),

-- 13. Shupia - Full Stack Developer
('Full Stack Developer', 'Shupia', 'SHU', 'District 7, HCMC', 'remote', 'korea', 'Fullstack', 3, 3, 22000000, 27000000,
E'## Company Overview\nJoi App is an AI-powered emotional and behavioral prognosis management platform that analyzes daily user data to detect emotional stability trends and early risk signals.\n\nThe platform combines AI analytics, digital healthcare services, and mobile/cloud infrastructure to provide personalized behavioral recommendations, recovery monitoring, and institutional dashboards.\n\n## Responsibilities\n- Improve and maintain the existing Joi app (Expo / React Native environment)\n- Push updates via GitHub and manage version control\n- Debug issues and implement fast, practical solutions\n- Support app releases on Google Play and Apple App Store\n- Work closely with design and product to ship updates quickly\n\n## Requirements\n- Experience in full stack or strong frontend with backend understanding\n- Familiarity with Expo / React Native\n- Comfortable with Git workflows (GitHub)\n- Experience using AI coding tools such as Claude, Cursor\n- Strong communication skills (KOR/ENG)',
true, false, 'https://joiapp.net', 1,
ARRAY['React Native', 'Expo', 'Git', 'TypeScript'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Shupia.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Shupia.png'),

-- 14. LIKELION - IT Interpreter & Admin Assistant
('IT Interpreter & Admin Assistant', 'LIKELION', 'META', 'District 7, HCMC', 'onsite', 'korea', 'Non-IT', 1, 1, 15000000, 25000000,
E'## Company Overview\nCollaborating with Korean headquarters, Vietnamese development teams, and IT/software partners\n\n## Responsibilities\n- Interpret meetings between Korean HQ and Vietnamese developers\n- Provide on-site and online interpretation via Zoom/Teams\n- Translate IT technical documents, UI/UX content, emails, and reports\n- Support communication for Korean employees\n- Assist interpretation during client meetings and contract negotiations\n- Provide administrative and meeting preparation support\n\n## Requirements\n- Intermediate Korean proficiency or above\n- Able to perform real-time interpretation\n- Understanding of basic IT/software terminology\n- Strong quick-response and accurate communication skills\n- High awareness of confidentiality and information security\n\nPreferred:\n- Experience working as an interpreter in IT/software companies\n- TOPIK level 4-6 certification\n- Basic English communication skills\n- Knowledge of Software, IoT, or AI\n- Preference for trilingual candidates',
true, true, NULL, 1,
'{}',
ARRAY['Full social insurance contribution according to Vietnamese law', '12 annual leave days', '13th-month bonus before Lunar New Year', '1.5-hour lunch break', 'Rolling interviews with immediate onboarding possible'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20LIKELION.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20LIKELION.png'),

-- 15. Omicsyn - Full-stack Developer
('Full-stack Developer', 'Omicsyn', 'OM', 'District 7, HCMC', 'remote', 'korea', 'Fullstack', 3, 5, 27000000, 36000000,
E'## Company Overview\nOmicsyn Co., Ltd. is a biotechnology company that creates new value and solves social challenges by utilizing artificial intelligence (AI) and big data in the fields of clinical medicine, multi-omics diagnostics, and therapeutics.\n\n## Responsibilities\n- Develop and maintain React-based web frontend applications\n- Develop backend services using Java Spring Boot\n- Design RESTful APIs and integrate with frontend systems\n- Design MySQL databases and optimize queries\n- Implement authentication and authorization systems (JWT, OAuth2)\n- Develop responsive and mobile-friendly UI\n- Collaborate with planning, design, and development teams\n\n## Requirements\n- Bachelor''s degree in Computer Science or related fields\n- 2-3+ years of web application development experience\n- Experience in React-based frontend development\n- Proficiency in JavaScript or TypeScript\n- Experience with Java and Spring Framework (Spring Boot, MVC, Security, JPA)\n- Experience in RESTful API design and development\n- Experience in MySQL database design and optimization\n- Understanding of JWT/OAuth2 authentication\n- Ability to communicate in English for work purposes',
true, false, 'https://www.omicsyn.com/', 1,
ARRAY['React', 'TypeScript', 'Java', 'Spring Boot', 'MySQL', 'PostgreSQL'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Omicsyn.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Omicsyn.png'),

-- 16. Wellpod - TikTok Shop & Shopify Manager
('TikTok Shop & Shopify Manager', 'Wellpod', 'WP', 'District 7, HCMC', 'remote', 'korea', 'PM', 1, 2, 18000000, 20000000,
E'## Company Overview\nCompany Profile & Key Business Activities\n- Global sales and distribution of K-pop albums\n- Development of shopping shorts for platforms like YouTube and TikTok\n- Marketing agency services\n\n## Responsibilities\n- Store Design, Operations, Product Listing, and Order Management\n- Operate and manage TikTok Shop and Shopify e-commerce platforms\n- Register products, configure and manage product detail pages\n- Design storefronts and create UI/UX layouts\n- Manage orders, shipping, and provide customer support (CS)\n\n## Requirements\n- Experience as a TikTok/YouTube influencer\n- Proficiency in video editing tools such as CapCut\n- Experience managing and operating e-commerce solutions like Shopify\n- Preference for candidates with experience in distribution or e-commerce',
true, true, 'https://wellpod.com', 1,
ARRAY['TikTok', 'Shopify', 'CapCut'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Wellpod.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Wellpod.png'),

-- 17. MNF Solution - Full-stack Developer
('Full-stack Developer', 'MNF Solution', 'MNF', 'District 7, HCMC', 'remote', 'korea', 'Fullstack', 2, 4, 18000000, 22000000,
E'## Company Overview\nCentered on digital platforms, we are building a new mobility ecosystem. We provide comprehensive management solutions for rental car companies, along with customer channel services for customer communication.\n\n## Responsibilities\n- Front-End: HTML5, CSS3, JavaScript (ES6+), TypeScript, React.js, Vue.js, Flutter\n- Back-End: Java, Spring / Spring Boot, JSP, Thymeleaf, RESTful APIs\n- Database: Oracle Database, PostgreSQL, Redis\n- System Engineering: Linux, Docker, AWS, Azure, NCP, GitHub Actions, Jenkins\n\n## Requirements\n- OS: Red Hat Linux, Debian-based Linux, Windows OS\n- Networking: TCP/IP, Routing, Switching\n- Cloud: AWS, Azure, NAVER Cloud Platform (NCP)\n- Experience with Docker container-based deployment\n- Experience with GitHub Actions, Jenkins\n\nAdditional Info:\n- Expected project duration: 5 months\n- Project: End-to-end management system for used car business',
true, true, 'https://www.mnfsolution.com/', 2,
ARRAY['React.js', 'Vue.js', 'Flutter', 'Java', 'Spring Boot', 'PostgreSQL', 'Docker', 'AWS'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-MnF%20Solution.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-MnF%20Solution.png'),

-- 18. Mutistation - Website Developer
('Website Developer', 'Mutistation', 'MT', 'District 7, HCMC', 'remote', 'korea', 'Fullstack', 3, 3, 20000000, 22000000,
E'## Company Overview\nMUTI is a company that develops Augmented Reality (AR) applications and Visual Positioning System (VPS) technology that enables precise location recognition in AR environments.\n\nStarting from 2025, MUTI has entered Silicon Valley to expand into the global market.\n\n## Responsibilities\n- Develop and maintain brand/e-commerce (D2C) website\n- Implement frontend features using React, Vue, or similar frameworks\n- Build and manage backend systems (Node.js, Java, PHP, etc.)\n- Integrate payment gateways (PG) and third-party APIs\n- Optimize website performance, speed, and scalability\n- Ensure website security, stability, and smooth user experience\n- Collaborate with designers to translate UI/UX into functional products\n\n## Requirements\n- Experience in developing E-commerce platforms or In-house shopping malls\n- Experience in integrating Payment APIs (Payment Gateways - PG)\n- Front-end: Proficient in React, Vue, etc.\n- Back-end: Proficient in Node.js, Java, PHP, etc.',
true, true, 'https://mutistation.com', 1,
ARRAY['React', 'Vue', 'Node.js', 'Java', 'PHP'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Mutistation.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Mutistation.png'),

-- 19. Mutistation - UI/UX Designer
('UI/UX Designer', 'Mutistation', 'MT', 'District 7, HCMC', 'remote', 'korea', 'Design', 3, 3, 20000000, 22000000,
E'## Company Overview\nMUTI is a company that develops Augmented Reality (AR) applications and Visual Positioning System (VPS) technology that enables precise location recognition in AR environments.\n\n## Responsibilities\n- Design and optimize brand website UI/UX to improve user experience and conversion\n- Create wireframes, user flows, and high-fidelity designs using Figma/Adobe XD\n- Improve conversion rate (CVR) through data-driven design decisions\n- Ensure responsive and consistent design across web and mobile platforms\n- Collaborate closely with developers to ensure accurate implementation\n- Conduct user research, usability testing, and iterate designs accordingly\n\n## Requirements\n- Experience in designing In-house malls or D2C E-commerce platforms\n- Proven experience in improving Conversion Rates (CVR)\n- Proficient in design tools such as Figma, Adobe XD, etc.\n- Experience in user-centered UX design',
true, true, 'https://mutistation.com', 2,
ARRAY['Figma', 'Adobe XD'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Mutistation.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Mutistation.png'),

-- 20. Wellpod - TikTok Ads Marketing Manager
('TikTok Ads Marketing Manager', 'Wellpod', 'WP', 'District 7, HCMC', 'remote', 'korea', 'PM', 1, 2, 18000000, 20000000,
E'## Company Overview\nCompany Profile & Key Business Activities\n- Global sales and distribution of K-pop albums\n- Development of shopping shorts for platforms like YouTube and TikTok\n- Marketing agency services\n\n## Responsibilities\n- Video Editing and Shopping Shorts Marketing\n- Plan and produce short-form content linked to TikTok Shopping (Shorts/Reels style)\n- Video editing and creative content production for advertisements\n- Discover and execute content ideas based on local trends in the Vietnam market\n\n## Requirements\n- Experience as a TikTok/YouTube influencer\n- Proficiency in video editing tools such as CapCut\n- Experience managing and operating e-commerce solutions like Shopify\n- Preference for candidates with experience in distribution or e-commerce',
true, true, 'https://wellpod.com', 1,
ARRAY['TikTok', 'CapCut', 'Shopify'],
ARRAY['Competitive compensation based on experience and skill set', 'Full social insurance coverage for contracts of 1 month or longer', 'Shared co-working space in District 7, HCMC'],
'', 'manual',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Wellpod.png',
'https://mpzwzihqtbewqudpggam.supabase.co/storage/v1/object/public/company-logos/DNN%20-%20Wellpod.png');
