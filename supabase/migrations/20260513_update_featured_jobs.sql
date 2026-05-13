-- apply_url을 KTC 링크로 수정, description 업데이트, salary 실제 데이터 반영

-- SeedLab - Performance & Growth Manager
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/SL201',
  location = 'District 7, HCMC',
  type = 'remote',
  salary_min = 20000000,
  salary_max = 40000000,
  description = 'SeedLab is not a traditional consulting firm — they are an execution-driven operating partner built to navigate the real complexity of global expansion, with experience building and operating companies in the U.S. across market entry, commerce infrastructure, growth marketing, and local operations.

As Performance & Growth Manager, you will manage and optimize Amazon Ads (Sponsored Products, Brands, Display), build scalable campaign structures, conduct keyword research and SEO strategy, analyze sales and advertising data, plan pricing and promotional strategies, and drive external traffic from Meta and Google to Amazon listings.

Requirements: 4+ years hands-on Amazon PPC experience, strong analytical capabilities (Excel, GA), solid keyword strategy and Amazon SEO understanding. External traffic channel experience (Meta, Google) preferred.

KPIs: ROAS, ACOS, TACOS, total revenue growth, organic vs. paid sales ratio, new-to-brand sales.',
  tech_stack = ARRAY['Amazon Ads', 'Google Analytics', 'Meta Ads', 'Google Ads']
WHERE company = 'SeedLab' AND title = 'Performance & Growth Manager' AND is_featured = true;

-- SeedLab - Content & Conversion Manager
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/SL202',
  location = 'District 7, HCMC',
  type = 'remote',
  salary_min = 20000000,
  salary_max = 40000000,
  description = 'SeedLab is an execution-driven operating partner specializing in global expansion — not a traditional consulting firm. Their team has hands-on experience building and operating companies in the U.S. across market entry, commerce infrastructure, growth marketing, and local operations.

As Content & Conversion Manager, you will create and optimize Amazon product listings (titles, bullet points, descriptions), plan and execute A+ content strategies, direct product imagery and video content, develop review and rating management strategies, define brand positioning, analyze competitor listings, and optimize content based on SEO and performance metrics.

Requirements: 4+ years Amazon listing and content optimization experience, demonstrated success improving conversion metrics, strong copywriting and content planning capabilities, experience collaborating with designers.

KPIs: Conversion rate, sales per session, click-through rate, listing quality score.',
  tech_stack = '{}'
WHERE company = 'SeedLab' AND title = 'Content & Conversion Manager' AND is_featured = true;

-- Jinosys
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/JN301',
  location = 'District 7, HCMC',
  type = 'remote',
  salary_min = 7000000,
  salary_max = 10000000,
  experience_min = 1,
  experience_max = 2,
  headcount = 2,
  description = 'Jinosys Co., Ltd. is a safety-specialized innovation company that develops proprietary AI-based safety IoT platforms and smart management systems. With 18 patents and approximately a decade of experience partnering with major corporations like Samsung Electronics, Jinosys digitalizes industrial safety through advanced IoT sensors and big data analytics.

As Mobile App & Web Service Developer, you will work on robot AI development and autonomous navigation systems, enhance existing AI-based fire detection models, develop smartphone camera-based on-device AI fire detection, manage IoT device and platform integration, build web services with cloud API integration, and support AI data collection for model training.

Requirements: Intermediate Korean (OPIc IM), experience with PHP, HTML5, CSS3, JavaScript, Android (Java/Kotlin). AI framework experience (TensorFlow, PyTorch Mobile) preferred.',
  tech_stack = ARRAY['PHP', 'JavaScript', 'Java', 'Kotlin', 'TensorFlow', 'PyTorch']
WHERE company = 'Jinosys' AND is_featured = true;

-- FPT Software
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/FPT401',
  location = 'District 7, HCMC',
  type = 'remote',
  salary_min = 7000000,
  salary_max = 40000000,
  experience_min = 0,
  experience_max = 1,
  description = 'FPT Software Korea is a subsidiary of FPT Software Co. Ltd., managing the technology business division of FPT Group — Vietnam''s largest ICT company. Established in 2020, FPT Software Korea specializes in application software development.

This role involves a 3-6 month training program in software technologies for the Automotive domain (Infotainment). You will learn industry-standard tools and processes (Agile, ASPICE, ISO 26262), participate in simulated and real projects under mentor guidance, communicate in Korean and English, and transition to full-time engineer status in global Automotive projects upon completion.

Requirements: Bachelor''s degree in CS, IT, or Electronics. Korean language proficiency (TOPIK Level 4+) strongly preferred. Programming foundation in Java, C/C++, or Python.

Benefits: Annual travel allowance, 5 summer vacation days, birthday half-day leave, commuting expense support, monthly childcare allowance, long-term service bonuses, education expense reimbursement, performance bonuses.',
  tech_stack = ARRAY['Java', 'C++', 'Python'],
  benefits = ARRAY['Annual travel allowance', 'Summer vacation days', 'Birthday leave', 'Commuting support', 'Childcare allowance', 'Education reimbursement', 'Performance bonuses']
WHERE company = 'FPT Software' AND is_featured = true;

-- Nexacode
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/NX501',
  location = 'District 7, HCMC',
  type = 'remote',
  salary_min = 18000000,
  salary_max = 20000000,
  experience_min = 1,
  experience_max = 2,
  description = 'Nexacode is a software development company specializing in in-house services such as ERP and B2B SaaS with customized system development capabilities.

As Full-stack Developer, you will develop and maintain internal SaaS products, participate in external client software projects, design full-stack systems with front-end and back-end optimization, collaborate with designers and QA on product quality, write clean maintainable code, conduct testing and debugging, analyze requirements and propose technical solutions, and research emerging technologies.

Requirements: 1+ year professional experience. Must have experience in one or more: Front-End (React, Next.js), Back-End (Nest.js, Python), or Mobile (Flutter).',
  tech_stack = ARRAY['React', 'Next.js', 'Node.js', 'Python', 'Flutter']
WHERE company = 'Nexacode' AND is_featured = true;

-- Wellpod - TikTok Ads Marketing Manager
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/WP601',
  location = 'District 7, HCMC',
  type = 'remote',
  salary_min = 18000000,
  salary_max = 20000000,
  description = 'Wellpod specializes in global sales and distribution of K-pop albums, developing short-form video content for YouTube and TikTok, and operating as a marketing agency.

As TikTok Ads Marketing Manager, you will plan and produce short-form content for TikTok Shopping (Shorts/Reels format), perform video editing and creative advertisement production, and identify and execute content ideas aligned with Vietnamese market trends.

Requirements: Prior experience as a TikTok/YouTube influencer, proficiency with video editing tools (CapCut), e-commerce platform experience (preferably Shopify). Background in distribution or e-commerce preferred.',
  tech_stack = ARRAY['TikTok', 'CapCut', 'Shopify']
WHERE company = 'Wellpod' AND title = 'TikTok Ads Marketing Manager' AND is_featured = true;

-- Wellpod - TikTok Shop & Shopify Manager
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/WP602',
  location = 'District 7, HCMC',
  type = 'remote',
  salary_min = 18000000,
  salary_max = 20000000,
  description = 'Wellpod specializes in global sales and distribution of K-pop albums, developing short-form video content for YouTube and TikTok, and operating as a marketing agency.

As TikTok Shop & Shopify Manager, you will handle store design, operations, product listing, and order management across TikTok Shop and Shopify platforms. Responsibilities include product registration, detail page configuration, storefront design and UI/UX layout creation, order management, shipping coordination, and customer support.

Requirements: Prior experience as a TikTok/YouTube content creator, proficiency with video editing software (CapCut), hands-on experience managing Shopify or similar e-commerce solutions. Background in distribution or e-commerce preferred.',
  tech_stack = ARRAY['TikTok', 'Shopify', 'CapCut']
WHERE company = 'Wellpod' AND title = 'TikTok Shop & Shopify Manager' AND is_featured = true;

-- Mutistation - UI/UX Designer
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/MT701',
  location = 'District 7, HCMC',
  type = 'remote',
  salary_min = 20000000,
  salary_max = 22000000,
  description = 'MUTI (Mutistation) develops Augmented Reality (AR) applications and Visual Positioning System (VPS) technology that enables precise location recognition in AR environments. They focus on indoor location-based technology for immersive AR content, next-gen AR device applications, and are expanding globally into Silicon Valley.

As UI/UX Designer, you will design and optimize brand website interfaces to enhance user experience and conversion metrics, develop wireframes, user flows, and high-fidelity designs, implement data-driven design decisions, create responsive designs across web and mobile, coordinate with development teams, and conduct user research and usability testing.

Requirements: 3 years experience. Prior experience designing e-commerce or in-house mall interfaces. Demonstrated track record improving conversion rates. Proficiency with Figma, Adobe XD. Recruitment period: July ~ August.',
  tech_stack = ARRAY['Figma', 'Adobe XD']
WHERE company = 'Mutistation' AND title = 'UI/UX Designer' AND is_featured = true;

-- Mutistation - Website Developer
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/MT702',
  location = 'District 7, HCMC',
  type = 'remote',
  salary_min = 20000000,
  salary_max = 22000000,
  description = 'MUTI (Mutistation) develops Augmented Reality (AR) applications and Visual Positioning System (VPS) technology that enables precise location recognition in AR environments. They focus on indoor location-based technology for immersive AR content, next-gen AR device applications, and are expanding globally into Silicon Valley.

As Website Developer, you will develop and maintain D2C e-commerce websites, implement frontend features using modern frameworks (React, Vue), build and manage backend systems (Node.js, Java, PHP), integrate payment gateways and third-party APIs, optimize performance and scalability, ensure security and stability, and collaborate with design teams on UI/UX implementation.

Requirements: 3 years experience. Proficiency in React or Vue (frontend), Node.js, Java, or PHP (backend). E-commerce platform development and Payment Gateway API integration experience. Recruitment period: July ~ August.',
  tech_stack = ARRAY['React', 'Vue', 'Node.js', 'Java', 'PHP']
WHERE company = 'Mutistation' AND title = 'Website Developer' AND is_featured = true;

-- Andwise
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/AW801',
  location = 'District 7, HCMC',
  type = 'remote',
  salary_min = 25000000,
  salary_max = 28000000,
  description = 'Andwise is an IT company founded in 2008, specializing in digital platform development and operation for public institutions, universities, and various industries. They provide integrated services spanning website creation, CMS platforms, cloud transformation, system upkeep, and AI-driven solutions using their proprietary GINIWORKS CMS.

As Full-stack Developer, you will maintain and enhance the G-Works CMS functionality, develop AI-based services, and configure and oversee web server environments.

Requirements: 3 years experience. Korean proficiency required (OPIc IL+). Backend: Java (Spring Boot, Spring MVC, Liferay, Hibernate, RESTful APIs, Apache Tomcat). Frontend: JavaScript (jQuery), HTML, CSS, JSON, JSP. Databases: MySQL, PostgreSQL, Oracle, SQL Server.',
  tech_stack = ARRAY['Java', 'Spring Boot', 'JavaScript', 'MySQL', 'PostgreSQL']
WHERE company = 'Andwise' AND is_featured = true;

-- ONSQUARE
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/OQ901',
  location = 'District 7, HCMC',
  type = 'remote',
  salary_min = 30000000,
  salary_max = 35000000,
  description = 'Onsquare is a Korea-based Fintech and AI-based SaaS startup that creates payment systems and AI Agent tools for global markets, with distributed teams across Korea, Canada, and Vietnam.

As Full-stack Developer, you will develop Fintech and AI Agent services collaborating across multiple offices, build in-house SaaS products, B2B workflow management tools (immigration automation), and payment platforms. Frontend work includes React/TypeScript web applications with responsive UI and real-time data interfaces. Backend involves Node.js/NestJS API servers with PostgreSQL and Redis. You will also integrate external APIs including payment gateways (Stripe, Airwallex) and AI services.

Requirements: 5+ years full-stack experience. React, TypeScript, Node.js/NestJS, PostgreSQL, Git/GitHub, AWS. Fintech/B2B SaaS or AI product development background preferred. LLM API experience (OpenAI, Anthropic) a plus.',
  tech_stack = ARRAY['React', 'TypeScript', 'Node.js', 'NestJS', 'PostgreSQL', 'Redis', 'AWS']
WHERE company = 'ONSQUARE' AND is_featured = true;

-- Lumicraft (404 on KTC page, keep existing description, update apply_url pattern)
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/LM10'
WHERE company = 'Lumicraft' AND is_featured = true;

-- Shupia - Full Stack Developer
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/SHU1101'
WHERE company = 'Shupia' AND title = 'Full Stack Developer' AND is_featured = true;

-- Shupia - UX/UI Developer
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/SHU1102'
WHERE company = 'Shupia' AND title = 'UX/UI Developer' AND is_featured = true;

-- MNF Solution
UPDATE jobs SET
  apply_url = 'https://ktc.likelion.edu.vn/jobs/MNF1201'
WHERE company = 'MNF Solution' AND is_featured = true;

-- 회사 공식 홈페이지 링크 추가
UPDATE jobs SET company_url = 'https://seedlab.xyz' WHERE company = 'SeedLab' AND is_featured = true;
UPDATE jobs SET company_url = 'https://fptsoftware.com' WHERE company = 'FPT Software' AND is_featured = true;
UPDATE jobs SET company_url = 'https://nexacode.co.kr' WHERE company = 'Nexacode' AND is_featured = true;
UPDATE jobs SET company_url = 'https://wellpod.com' WHERE company = 'Wellpod' AND is_featured = true;
UPDATE jobs SET company_url = 'https://mutistation.com' WHERE company = 'Mutistation' AND is_featured = true;
UPDATE jobs SET company_url = 'https://mnfsolution.com' WHERE company = 'MNF Solution' AND is_featured = true;
