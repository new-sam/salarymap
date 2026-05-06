import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Company-level descriptions to reuse
const CO = {
  imweb: 'Imweb is Koreas leading no-code website builder platform, enabling businesses to create professional websites and online stores without coding.',
  orchestro: 'Orchestro is an AI-powered IT operations and cloud management platform for enterprise infrastructure.',
  genoray: 'Genoray is a medical device company specializing in dental and medical imaging equipment with FLEXLAB digital solutions.',
  innogrid: 'InnoGrid provides cloud computing and blockchain infrastructure solutions for enterprise clients.',
  naver: 'Naver Pay is the payment and financial services arm of Naver, Koreas largest internet company.',
  coinone: 'Coinone is one of Koreas major cryptocurrency exchanges, providing digital asset trading services.',
  bcuai: 'BCUAI is an AI company developing intelligent solutions for enterprise applications.',
  mad: 'Mad Engine is an AI-focused company building intelligent platforms and deploying AI solutions for enterprise clients.',
  shopLive: 'ShopLive is the No.1 global B2B/SaaS video commerce platform.',
  coupang: 'Coupang is Koreas largest e-commerce company, known as the Amazon of Korea.',
  team: 'TeamSPARTA operates coding education platforms and corporate training programs.',
  higher: 'Higher Diversity builds technology solutions promoting workplace diversity and inclusion.',
  eta: 'ETA Electronics develops electronic components and systems for industrial applications.',
  bhsn: 'BHSN develops AI-powered communication and collaboration solutions.',
  zigbang: 'Zigbang is Koreas leading PropTech company, known for its real estate platform and smart home solutions.',
  concentrix: 'Concentrix is a global technology and services company providing AI-powered customer experience solutions.',
  soop: 'SOOP (formerly AfreecaTV) is Koreas major live streaming platform.',
  momenti: 'Momenti develops AI-powered video generation and editing technology.',
  fromLabs: 'FromLabs builds AI-native developer tools and platforms.',
  betching: 'Betching innovates veterinary clinic management with digital healthcare solutions.',
  hecto: 'Hecto Innovation provides fintech and data solutions for financial institutions.',
}

const t = {
  // Momenti x2
  '4b249814-015b-4ec3-b4c2-37f3d3f5e2d3': `${CO.momenti}\n\n[Responsibilities]\n- Develop and deploy ML models for video generation\n- Research generative AI architectures\n- Optimize model inference performance\n\n[Requirements]\n- ML engineering experience\n- PyTorch proficiency\n- Generative model experience\n- Computer vision background`,
  'a24f220d-04ee-4bab-a658-56c2239f9ecc': `${CO.momenti}\n\n[Responsibilities]\n- Research and implement ML models for video AI\n- Build training pipelines and data processing\n- Optimize models for production deployment\n\n[Requirements]\n- ML/deep learning experience\n- PyTorch or TensorFlow\n- Computer vision or generative AI experience\n- Strong research background`,

  // TimeTree Korea
  'dbc717d6-ce83-413e-a260-9a6f70b64870': `TimeTree Korea operates a shared calendar app connecting people through scheduling. The team is building AI agent systems to enhance user experience.\n\n[Responsibilities]\n- Design and develop AI agent systems for calendar platform\n- Build conversational AI features for scheduling\n- Integrate LLM capabilities into product\n- Develop automation workflows\n\n[Requirements]\n- AI/ML engineering experience\n- LLM and conversational AI understanding\n- Backend development skills (Python/Java)\n- Production AI system experience`,

  // Four Company
  '9bba438b-cc46-4b44-8f3c-ce0066dab2da': `Four Company develops technology solutions for small and medium businesses.\n\n[Responsibilities]\n- Lead engineering team (5-8 members)\n- Define technical architecture and roadmap\n- Manage project delivery and quality\n- Mentor developers and establish engineering culture\n\n[Requirements]\n- 5-8 years development experience\n- Technical leadership experience\n- Full-stack development skills\n- Team management and communication`,

  // Crevis Partners
  'd9e7fdfb-865d-46ae-a861-611805537878': `Crevis Partners is a venture studio building and investing in early-stage startups.\n\n[Responsibilities]\n- Develop SaaS product features as intern\n- Build frontend and backend components\n- Participate in product development lifecycle\n- Learn modern software engineering practices\n\n[Requirements]\n- CS/engineering student or recent graduate\n- Basic programming skills\n- Interest in SaaS products\n- Eagerness to learn`,

  // Mad Engine x4
  'e03e851e-cc58-4fbf-8b6f-06401316520c': `${CO.mad}\n\n[Responsibilities]\n- Design and build AI platform infrastructure\n- Deploy and manage ML model serving systems\n- Optimize AI pipeline performance at scale\n- Establish MLOps best practices\n\n[Requirements]\n- 7+ years engineering experience\n- AI/ML platform architecture\n- Kubernetes and cloud infrastructure\n- MLOps and model serving experience`,
  'e951a47c-2667-4f07-94c6-9387a4eb1a50': `${CO.mad}\n\n[Responsibilities]\n- Deploy AI solutions at client sites\n- Customize AI models for business requirements\n- Bridge research and production environments\n- Provide technical consulting\n\n[Requirements]\n- AI/ML engineering experience\n- Client-facing technical skills\n- Python and ML frameworks\n- Problem-solving abilities`,
  'cc3ef26e-7cd9-47b3-ad6f-2e9483394de7': `${CO.mad}\n\n[Responsibilities]\n- Build AI agent systems for enterprise automation\n- Develop LLM-powered workflows\n- Integrate AI agents with business systems\n\n[Requirements]\n- AI/ML development experience\n- LLM and agent architecture understanding\n- Backend development skills\n- Production AI system experience`,
  '64aa157f-569c-4284-94c1-a6c291f702fc': `${CO.mad}\n\n[Responsibilities]\n- Build and maintain CI/CD pipelines\n- Manage cloud infrastructure for AI workloads\n- Monitor system performance and reliability\n\n[Requirements]\n- DevOps engineering experience\n- Cloud platform experience (AWS/GCP)\n- Docker, Kubernetes\n- CI/CD pipeline design`,

  // Every Second
  '42a7f59d-7e1c-485a-b137-f34db69eb476': `Every Second operates Picdot, a network of AI-powered photo booths across Korea.\n\n[Responsibilities]\n- Provide on-site technical support for photo booth hardware\n- Troubleshoot hardware and software issues\n- Maintain and service equipment\n\n[Requirements]\n- Technical support experience\n- Hardware troubleshooting skills\n- Communication and customer service\n- Willingness to travel to locations`,

  // Cupist (Glam)
  '9ea5212d-6424-4c0c-bd5c-5fa9a4be37de': `Cupist operates Glam, a premium dating app using AI matching technology to connect professionals.\n\n[Responsibilities]\n- Architect and develop backend services for dating platform\n- Lead technical design and code reviews\n- Optimize matching algorithms and system performance\n- Mentor junior developers\n\n[Requirements]\n- 7+ years backend development\n- System architecture and design skills\n- High-traffic service experience\n- Java/Kotlin or Node.js proficiency`,

  // iTruck
  '46b8c377-0360-4e1a-8b04-ce85bff018e7': `iTruck develops AI-powered logistics and trucking optimization solutions.\n\n[Responsibilities]\n- Develop ML models for logistics optimization\n- Build route planning and demand forecasting systems\n- Process and analyze transportation data\n- Deploy models to production\n\n[Requirements]\n- ML engineering experience\n- Python, scikit-learn, PyTorch\n- Data processing and feature engineering\n- Understanding of optimization algorithms`,

  // Fullim
  'ec732b96-a2a4-490f-9a2e-9663b4093d45': `Fullim develops AI and software solutions for enterprise digital transformation.\n\n[Responsibilities]\n- Lead technical architecture and system design\n- Develop complex backend systems\n- Mentor team and establish engineering standards\n\n[Requirements]\n- 7+ years software engineering\n- System architecture expertise\n- Backend development proficiency\n- Technical leadership experience`,

  // Hippocrat Labs
  '889c6504-8b0d-44d5-a228-38bd885e24ef': `Hippocrat Labs builds blockchain-based healthcare data infrastructure enabling patients to own and control their medical data.\n\n[Responsibilities]\n- Develop software for healthcare blockchain platform\n- Build secure data sharing systems\n- Implement cryptographic protocols\n- Full-stack development\n\n[Requirements]\n- Software engineering experience\n- Blockchain or distributed systems knowledge\n- Security and cryptography understanding\n- Backend development skills`,

  // CJ Olive Young
  '29b83ccc-b1ef-42e2-9e3c-08373326ce76': `CJ Olive Young is Koreas largest health and beauty retail chain, operating 1,300+ stores nationwide and a leading e-commerce platform.\n\n[Responsibilities]\n- Analyze business and customer data for insights\n- Build dashboards and reports for decision-making\n- Develop data models and metrics frameworks\n- Collaborate with business teams on data-driven strategies\n\n[Requirements]\n- Data analysis experience\n- SQL and Python proficiency\n- BI tools experience (Tableau, Looker)\n- Statistical analysis skills`,

  // Buzzni
  '186fbf39-42b8-4619-9e66-bf362d0f4a31': `Buzzni operates APLUS AI, building AI-powered mobile and web products for content and commerce.\n\n[Responsibilities]\n- Develop mobile and web applications using React Native and Expo\n- Build cross-platform product features\n- Implement responsive web interfaces\n- Optimize app performance\n\n[Requirements]\n- React Native / Expo development experience\n- Web development (React) skills\n- TypeScript proficiency\n- Mobile app architecture understanding\n- Published apps preferred`,

  // Perigee Aerospace
  '8f211622-f2c9-4d39-a6f7-756cd7e0a8fe': `Perigee Aerospace is a Korean space startup developing small satellite launch vehicles.\n\n[Responsibilities]\n- Design firmware for launch vehicle subsystems\n- Develop embedded control systems\n- Test and validate flight hardware\n\n[Requirements]\n- Firmware/embedded development experience\n- C/C++ proficiency\n- Real-time systems knowledge\n- Aerospace or defense experience preferred`,

  // Bitsensing
  '72272a37-e026-4414-9945-247fb3fb52db': `Bitsensing develops 4D imaging radar solutions using advanced signal processing and AI for autonomous driving and smart infrastructure.\n\n[Responsibilities]\n- Develop signal processing algorithms for radar systems\n- Design and optimize radar waveform processing\n- Implement detection and tracking algorithms\n\n[Requirements]\n- Signal processing or radar engineering background\n- MATLAB, Python, or C++ proficiency\n- DSP algorithm development experience\n- Knowledge of FMCW radar preferred`,

  // Hecto Innovation x2
  'c8382fdb-41d5-43a5-b6c6-50f21b173d8d': `${CO.hecto}\n\n[Responsibilities]\n- Database administration and performance optimization\n- Design and maintain database architecture\n- Implement backup, recovery, and high availability\n- Monitor and troubleshoot database issues\n\n[Requirements]\n- DBA experience\n- MySQL, PostgreSQL, or Oracle expertise\n- Query optimization and performance tuning\n- Database replication and clustering`,
  '75838907-9818-4974-a938-9f8f4880cfca': `${CO.hecto}\n\n[Responsibilities]\n- Lead development of WeatherDol weather service platform\n- Architect backend systems and data pipelines\n- Manage engineering team and project delivery\n\n[Requirements]\n- Technical leadership experience\n- Backend development proficiency\n- Data pipeline design\n- Team management skills`,

  // Socra AI
  '8e9940f4-29a8-42c0-9c4f-b10c3b1460c8': `Socra AI develops Santa, an AI-powered personalized learning platform for education.\n\n[Responsibilities]\n- Develop frontend features for Santa learning platform\n- Build responsive and accessible web interfaces\n- Optimize user experience and performance\n- Implement A/B testing and analytics\n\n[Requirements]\n- 3+ years frontend development\n- React or Next.js proficiency\n- TypeScript experience\n- Performance optimization skills`,

  // FitIn
  '73554c74-eb39-4c9a-bdda-a88458a63701': `FitIn is a fitness platform connecting users with personal trainers and workout facilities.\n\n[Responsibilities]\n- Lead service platform development team\n- Design scalable backend architecture\n- Manage microservice infrastructure\n- Drive technical strategy and roadmap\n\n[Requirements]\n- 5+ years backend development\n- Platform architecture experience\n- Team leadership skills\n- Microservice design expertise`,

  // Owell Health
  'ef5d76b2-8c6f-4fe9-b351-e756ba070ad0': `Owell Health develops AI-native healthcare technology solutions for preventive care and wellness.\n\n[Responsibilities]\n- Build AI-native applications from the ground up\n- Integrate LLM and AI capabilities into products\n- Develop full-stack features with AI at the core\n\n[Requirements]\n- Full-stack development experience\n- AI/ML integration experience\n- LLM and prompt engineering knowledge\n- Healthcare tech interest preferred`,

  // Descente Korea
  '8bcd5992-c05d-4e9a-9927-5f2355de9061': `Descente Korea is the Korean subsidiary of the global sports brand Descente, managing IT infrastructure for retail operations.\n\n[Responsibilities]\n- Manage and maintain IT infrastructure\n- Support retail systems and e-commerce platform\n- Ensure system security and reliability\n\n[Requirements]\n- IT infrastructure experience\n- Network and server administration\n- Cloud platform knowledge\n- Retail IT systems experience preferred`,

  // JJ & Companies
  '5dd19270-c93c-48f4-8be7-98a7e7716d28': `JJ & Companies develops engineering software solutions for maritime and ship automation industries.\n\n[Responsibilities]\n- Develop engineering software for ship automation systems\n- Design and implement control system applications\n- Build simulation and monitoring tools\n\n[Requirements]\n- Software development experience\n- C/C++ or Python proficiency\n- Control systems or automation knowledge\n- Maritime/naval engineering interest preferred`,

  // BOS Semiconductor
  'ee55467c-292a-4f7f-be86-32a417fa7b72': `BOS Semiconductor designs advanced semiconductor solutions for computing and AI applications.\n\n[Responsibilities]\n- Build and maintain CI/CD infrastructure for chip design\n- Manage cloud and on-premise computing resources\n- Automate build, test, and deployment processes\n- Support engineering teams with tooling\n\n[Requirements]\n- DevOps engineering experience\n- Linux system administration\n- CI/CD pipeline design\n- Container and cloud infrastructure\n- Semiconductor industry experience is a plus`,

  // FromLabs x2
  'd1bf1c0e-0fd4-410f-b543-96720db74742': `${CO.fromLabs}\n\n[Responsibilities]\n- Build AI-native applications and developer tools\n- Integrate LLM capabilities into products\n- Develop innovative AI-powered features\n\n[Requirements]\n- Full-stack development experience\n- AI/ML and LLM integration\n- Modern web frameworks\n- Creative problem-solving`,
  '5625e41d-6e45-42d9-a4eb-1bf913e0eef1': `${CO.fromLabs}\n\n[Responsibilities]\n- Lead technical team and architecture decisions\n- Define engineering standards and best practices\n- Mentor developers and drive technical excellence\n\n[Requirements]\n- 5+ years development experience\n- Technical leadership experience\n- System architecture skills\n- Strong communication abilities`,

  // Imweb x13
  'be2b2588-60be-4f7d-a6ab-4c743edd82c2': `${CO.imweb}\n\n[Responsibilities]\n- Build data analytics pipelines and infrastructure\n- Develop dashboards and reporting systems\n- Analyze user behavior and product metrics\n\n[Requirements]\n- Data engineering and analytics experience\n- SQL, Python proficiency\n- BI tools and data visualization\n- Statistical analysis skills`,
  'ce6506ea-749f-4544-abe8-03d94221f6ec': `${CO.imweb}\n\n[Responsibilities]\n- Develop backend services for analytics systems\n- Build data processing pipelines\n- Implement tracking and measurement features\n\n[Requirements]\n- Backend development experience\n- Data pipeline design\n- SQL and Python\n- Analytics system understanding`,
  'bf716ded-b055-499a-acfe-4a8bc61afd56': `${CO.imweb}\n\n[Responsibilities]\n- Develop backend for commerce and e-commerce features\n- Build payment and order processing systems\n- Optimize checkout and transaction flows\n\n[Requirements]\n- Backend development experience\n- E-commerce system knowledge\n- Payment integration experience\n- Java/Kotlin or Node.js`,
  '4e8f8e05-4264-4fa1-b7d2-869414cb51d1': `${CO.imweb}\n\n[Responsibilities]\n- Develop core backend platform services\n- Build shared infrastructure and APIs\n- Optimize system performance and reliability\n\n[Requirements]\n- Backend development experience\n- Platform/infrastructure design\n- API design best practices\n- System optimization skills`,
  '7676c92c-9164-414a-8cf6-dca9cd2fbfc4': `${CO.imweb}\n\n[Responsibilities]\n- Develop backend for creator business features\n- Build content management and monetization systems\n- Design APIs for creator tools\n\n[Requirements]\n- Backend development experience\n- Content platform understanding\n- API design skills\n- Database optimization`,
  'd9ed8075-6ebb-4027-bc98-aa0762682b0e': `${CO.imweb}\n\n[Responsibilities]\n- Develop backend for marketing product features\n- Build campaign management and analytics systems\n- Implement marketing automation APIs\n\n[Requirements]\n- Backend development experience\n- Marketing tech understanding\n- API design and integration\n- Data processing skills`,
  'c8da125a-dee6-4663-95b9-c6fdd5def164': `${CO.imweb}\n\n[Responsibilities]\n- Develop backend platform services and infrastructure\n- Build shared APIs and middleware\n- Ensure platform reliability and scalability\n\n[Requirements]\n- Backend development experience\n- Platform engineering skills\n- Microservice architecture\n- System design expertise`,
  '7e1bfadb-d1c5-49fc-ad83-ec96b927b101': `${CO.imweb}\n\n[Responsibilities]\n- Develop backend for website builder features\n- Build template and component rendering systems\n- Optimize editor performance\n\n[Requirements]\n- Backend development experience\n- Web rendering systems knowledge\n- API design skills\n- Performance optimization`,
  'e0450fe4-c904-4f1d-bf05-6117538309b1': `${CO.imweb}\n\n[Responsibilities]\n- Analyze business and product data\n- Build dashboards and reports\n- Identify growth opportunities through data\n\n[Requirements]\n- Data analysis experience\n- SQL and Python\n- BI tools proficiency\n- Statistical analysis skills`,
  '4c04deaf-2b52-439d-89e9-53ef56cab105': `${CO.imweb}\n\n[Responsibilities]\n- Lead data analysis team and strategy\n- Design metrics frameworks and KPIs\n- Drive data-informed product decisions\n- Mentor data analysts\n\n[Requirements]\n- 5+ years data analysis experience\n- Team leadership skills\n- Advanced SQL and Python\n- Statistical modeling expertise`,
  '8664fb2f-847e-408d-9a34-a8e648d148db': `${CO.imweb}\n\n[Responsibilities]\n- Build and maintain CI/CD pipelines\n- Manage cloud infrastructure (AWS)\n- Monitor system reliability\n- Automate operations\n\n[Requirements]\n- DevOps experience\n- AWS cloud platform\n- Docker, Kubernetes\n- Infrastructure as Code`,
  'd0f2625f-6463-40ec-bc33-ab1d12ca94ca': `${CO.imweb}\n\n[Responsibilities]\n- Develop frontend for website builder platform\n- Build interactive editor components\n- Optimize rendering performance\n- Implement responsive design system\n\n[Requirements]\n- Frontend development experience\n- React or Vue.js proficiency\n- TypeScript experience\n- Performance optimization skills`,
  'a124e38a-98b1-498f-9bb8-bb78e2032a5b': `${CO.imweb}\n\n[Responsibilities]\n- Lead QA strategy and quality engineering\n- Design test automation frameworks\n- Establish quality processes and standards\n- Manage QA team\n\n[Requirements]\n- 5+ years QA experience\n- Test automation expertise\n- Quality process design\n- Team leadership skills`,

  // XYZ
  'f5fea079-909d-474d-a7cf-5a6a50e57d84': `XYZ develops physical AI and robotics solutions, building intelligent systems that interact with the real world.\n\n[Responsibilities]\n- Develop AI algorithms for physical robot systems\n- Build perception, planning, and control pipelines\n- Integrate sensors and actuators with AI models\n- Test and validate robot behaviors\n\n[Requirements]\n- Robotics or AI engineering experience\n- ROS/ROS2 proficiency\n- Python and C++ skills\n- Computer vision or reinforcement learning\n- Hardware-software integration experience`,

  // Toss QA
  'd526785a-f57d-4479-9747-3552b85ad816': `Toss (Viva Republica) is Koreas leading fintech super app with 23M+ users.\n\n[Responsibilities]\n- Lead product quality management strategy\n- Design QA processes for financial products\n- Coordinate cross-team quality initiatives\n- Drive quality culture across organization\n\n[Requirements]\n- QA management experience in fintech\n- Quality strategy and process design\n- Financial product testing expertise\n- Leadership and stakeholder management`,

  // ALux
  '327f594d-082c-4ca1-bc3c-855fc3de683f': `ALux develops AI-powered luxury and fashion technology solutions.\n\n[Responsibilities]\n- Define product strategy and roadmap\n- Gather and prioritize requirements\n- Collaborate with engineering and design teams\n- Analyze market trends and user feedback\n\n[Requirements]\n- Product management experience\n- Technical product understanding\n- Data-driven decision making\n- Stakeholder communication skills`,

  // RX
  '22c4c2aa-1394-4815-9130-f586e49df6d6': `RX develops AR visualization solutions for industrial and enterprise applications.\n\n[Responsibilities]\n- Develop real-time AR data visualization systems\n- Build 3D rendering and spatial computing features\n- Optimize performance for AR devices\n\n[Requirements]\n- AR/VR or 3D development experience\n- Unity or Unreal Engine\n- C# or C++ proficiency\n- Real-time graphics knowledge`,

  // Growing Sales
  'b2d72e43-9823-46f7-b02e-be9728d28095': `Growing Sales builds AI-powered sales enablement and CRM solutions for businesses.\n\n[Responsibilities]\n- Develop backend services for sales platform\n- Build CRM and analytics features\n- Design APIs and data integrations\n\n[Requirements]\n- Backend development experience\n- API design skills\n- Database optimization\n- SaaS product development experience`,

  // STCLab
  'cf843979-2105-4463-8854-1efd45175002': `STCLab provides AI-powered performance optimization and load testing solutions for web services.\n\n[Responsibilities]\n- Build and maintain infrastructure for performance testing platform\n- Design CI/CD pipelines and automation\n- Manage cloud resources and container orchestration\n- Monitor system reliability\n\n[Requirements]\n- DevOps engineering experience\n- Cloud platform expertise (AWS/GCP)\n- Docker, Kubernetes\n- Performance monitoring tools\n- Infrastructure as Code`,

  // BaBa Ground x2
  'b67c37a6-b848-4f00-9d86-6724894d2127': `BaBa Ground develops interactive children's education and entertainment platforms.\n\n[Responsibilities]\n- Design and develop backend services\n- Build APIs for content delivery and user management\n- Optimize system performance\n\n[Requirements]\n- Backend development experience\n- API design and microservices\n- Database design skills\n- Cloud platform experience`,
  '00e8faf8-d3dc-456b-b598-3e880d49ba7f': `BaBa Ground builds interactive childrens education and entertainment products.\n\n[Responsibilities]\n- Full-stack development of education platform\n- Build frontend and backend features\n- Implement interactive content delivery\n\n[Requirements]\n- Full-stack development experience\n- React and Node.js/Java\n- Database design\n- API development skills`,

  // Sionic AI
  '3c280dbd-f941-4cc8-8a12-34b0d1f94488': `Sionic AI is a leading Korean AI company focused on large language model research and enterprise AI solutions.\n\n[Responsibilities]\n- Research and develop large multimodal models (LMM)\n- Train and fine-tune foundation models\n- Design model architecture and training strategies\n- Publish research and advance state-of-the-art\n\n[Requirements]\n- PhD or equivalent research experience in AI/ML\n- Deep learning and NLP research background\n- Large-scale model training experience\n- PyTorch proficiency\n- Publications in top venues preferred`,

  // AM Square
  '3dfc58cd-5586-480c-96b6-60420806b63f': `AM Square develops digital solutions for business operations.\n\n[Responsibilities]\n- Develop backend services and APIs\n- Build business logic and data processing\n- Maintain and improve existing systems\n\n[Requirements]\n- Backend development experience\n- Java or Node.js proficiency\n- Database skills\n- API design knowledge`,

  // Supercent
  '0dabf813-f41f-403d-abfb-a241d9aa9edf': `Supercent is a mobile gaming company known for hyper-casual games with global reach.\n\n[Responsibilities]\n- Define game product strategy and roadmap\n- Analyze market trends and player behavior\n- Coordinate with development and marketing teams\n- Drive product metrics and growth\n\n[Requirements]\n- Product management experience in gaming or mobile\n- Data analysis and metrics-driven approach\n- Understanding of mobile game monetization\n- Cross-functional team collaboration`,

  // Gravity Labs
  '28cbc50c-6349-4b65-9e99-8bbd79e90df7': `Gravity Labs develops AI and data analytics solutions for enterprise clients.\n\n[Responsibilities]\n- Design and build data pipelines and infrastructure\n- Develop ETL processes for large-scale data\n- Optimize data warehouse performance\n\n[Requirements]\n- Data engineering experience\n- SQL, Python, Spark\n- Data warehousing solutions\n- Apache Airflow or similar tools`,

  // Nine Dots Consulting
  'd958d213-7c7f-4fc2-8f9d-2eaee78708ad': `Nine Dots Consulting provides IT consulting and digital transformation services for enterprise clients.\n\n[Responsibilities]\n- Build AI agent solutions for Microsoft 365 ecosystem\n- Develop automation workflows using Power Platform\n- Integrate AI capabilities with enterprise tools\n\n[Requirements]\n- M365 and Power Platform experience\n- AI/ML or automation development\n- Enterprise IT consulting background\n- Microsoft technology stack knowledge`,

  // ARVision
  'ea0fbc37-a51c-49f0-88fb-a0196ae17efa': `ARVision develops AR/VR hardware and software solutions for enterprise applications.\n\n[Responsibilities]\n- Develop embedded software for AR/VR devices\n- Implement firmware for sensors and displays\n- Optimize real-time system performance\n\n[Requirements]\n- Embedded software development\n- C/C++ proficiency\n- Real-time systems knowledge\n- Hardware-software integration`,

  // Upstage
  '84b7e451-525c-4bb5-a410-16ff4056d164': `Upstage is a leading AI company specializing in document AI and large language models, founded by former Kakao Brain researchers.\n\n[Responsibilities]\n- Design and implement security architecture\n- Manage vulnerability assessments and penetration testing\n- Build security monitoring and incident response systems\n- Ensure compliance with security standards\n\n[Requirements]\n- Security engineering experience\n- Cloud security (AWS/GCP)\n- Penetration testing and vulnerability assessment\n- Security monitoring tools\n- Compliance frameworks knowledge`,

  // Quantum Aero
  '53e049e5-d52f-42c8-a9d4-5ec1f65a7b07': `Quantum Aero develops advanced AI systems for autonomous aerial vehicles and robotics.\n\n[Responsibilities]\n- Research and develop VLA (Vision-Language-Action) models\n- Build multimodal AI systems for robotic control\n- Integrate vision, language, and action capabilities\n\n[Requirements]\n- AI/ML research experience\n- Multimodal learning or robotics background\n- PyTorch proficiency\n- Computer vision and NLP experience`,

  // Orchestro x5
  'b40c3c3f-adc4-4e30-8100-cde41d8fbdef': `${CO.orchestro}\n\n[Responsibilities]\n- Develop AI-powered IT operations solutions\n- Build cloud management automation features\n- Customize solutions for enterprise clients\n\n[Requirements]\n- Backend development experience\n- Cloud platform knowledge (AWS/GCP/Azure)\n- AI/ML integration skills\n- Enterprise solution experience`,
  '3dae362f-2439-4aa7-b9b9-45175fbd369d': `${CO.orchestro}\n\n[Responsibilities]\n- Develop and train AI models for IT operations\n- Build anomaly detection and prediction systems\n- Optimize model performance for production\n\n[Requirements]\n- ML engineering experience\n- Time-series analysis and anomaly detection\n- Python and ML frameworks\n- Production model deployment`,
  'e639c715-7047-4c73-bf3e-d9d7fbb2a3ac': `${CO.orchestro}\n\n[Responsibilities]\n- Develop AI-powered product features\n- Build user-facing AI applications\n- Integrate AI models into product workflows\n\n[Requirements]\n- Full-stack development experience\n- AI/ML product development\n- Frontend and backend skills\n- Product-oriented mindset`,
  'ef03a1c8-3b92-46d9-8ed2-a4c0b818f9b2': `${CO.orchestro}\n\n[Responsibilities]\n- Design QA processes for AI operations platform\n- Build automated testing frameworks\n- Ensure product quality and reliability\n\n[Requirements]\n- QA engineering experience\n- Test automation skills\n- Understanding of AI/ML products\n- Quality process design`,
  'b37237ab-8e29-410b-b41a-a95f8603ddff': `${CO.orchestro}\n\n[Responsibilities]\n- Manage data center command systems\n- Monitor and operate IT infrastructure\n- Implement automation for system operations\n\n[Requirements]\n- System engineering experience\n- Data center operations knowledge\n- Monitoring and alerting tools\n- Linux system administration`,

  // Kitworks x3
  'c2b8f04a-84d4-4f34-9078-5ea5d23332c5': `Kitworks develops AI-powered content creation and management solutions.\n\n[Responsibilities]\n- Develop backend services for content platform\n- Build APIs and data processing systems\n- Optimize system performance\n\n[Requirements]\n- Backend development experience\n- Java or Python proficiency\n- Database design\n- API development skills`,
  'b902b6bc-7e6b-46a8-b30f-e41757aaac1b': `Kitworks builds AI-powered content creation tools.\n\n[Responsibilities]\n- Develop backend APIs and services\n- Build content processing pipelines\n- Database design and optimization\n\n[Requirements]\n- Backend development experience\n- Modern framework proficiency\n- Database skills\n- RESTful API design`,
  'ffb4ae49-747a-4a36-a038-7dcf4192fd84': `Kitworks creates AI-driven content management solutions.\n\n[Responsibilities]\n- Backend service development\n- API design and implementation\n- System optimization\n\n[Requirements]\n- Backend development skills\n- API design experience\n- Database management\n- Cloud platform knowledge`,

  // EverOn (2nd)
  '55979fa5-eb04-435b-a143-b44800b39c60': `EverOn operates 50,000 EV chargers nationwide as a leading CPO in Korea.\n\n[Responsibilities]\n- Develop backend services for EV charging platform\n- Build APIs for charger management systems\n- Implement real-time monitoring features\n\n[Requirements]\n- Backend development experience\n- Java/Kotlin, Spring Boot\n- Database design (PostgreSQL)\n- Real-time system experience`,

  // My Franchise
  'dd5c556b-40c8-45b7-84c6-160cec452ca0': `My Franchise is a franchise management and consulting platform helping entrepreneurs start and manage franchise businesses.\n\n[Responsibilities]\n- Develop frontend for franchise management platform\n- Build responsive web applications\n- Implement interactive dashboards and data visualization\n- Optimize user experience\n\n[Requirements]\n- Frontend development experience\n- React or Vue.js proficiency\n- TypeScript experience\n- UI/UX implementation skills`,

  // Rebodis
  '49a49b79-359d-4d1f-a8a0-45d14ad5b17a': `Rebodis develops wearable robotics and exoskeleton technology for industrial and medical applications.\n\n[Responsibilities]\n- Design hardware and electronics for wearable robots\n- Develop power systems and motor controllers\n- Build sensor integration circuits\n- Prototype and test robotic components\n\n[Requirements]\n- Hardware/electronics engineering experience\n- Circuit design (PCB, power electronics)\n- Motor control systems knowledge\n- Firmware development is a plus`,

  // Tomorrow Robotics
  'aeb47f9e-bd1a-4b77-b50e-77bcdb6a9113': `Tomorrow Robotics develops autonomous robot systems for industrial applications.\n\n[Responsibilities]\n- Develop web platform for robot fleet management\n- Build monitoring and control interfaces\n- Implement real-time data visualization\n\n[Requirements]\n- Web platform development experience\n- Frontend and backend skills\n- Real-time systems understanding\n- API design and integration`,

  // Enhans
  'b3eb3195-e989-4018-ad83-de736c85094b': `Enhans develops AI-powered visual enhancement and image processing solutions.\n\n[Responsibilities]\n- Develop frontend applications for image processing platform\n- Build responsive and performant web interfaces\n- Implement real-time preview features\n\n[Requirements]\n- Frontend development experience\n- React or Vue.js proficiency\n- TypeScript experience\n- Image/video processing interest`,

  // FinderGap
  '70861901-34ee-4863-8de6-1962c197a835': `FinderGap is a career tech platform helping job seekers find opportunities that match their skills and interests.\n\n[Responsibilities]\n- Develop frontend for career matching platform\n- Build interactive job search and filtering features\n- Implement responsive design and accessibility\n- Optimize page performance\n\n[Requirements]\n- 4+ years frontend development\n- React or Next.js proficiency\n- TypeScript experience\n- Performance optimization\n- UI/UX design sensibility`,

  // BCUAI x5
  'c1d83d39-0e50-4cbc-961f-a53c1fa80ed8': `${CO.bcuai}\n\n[Responsibilities]\n- Lead AI R&D team and strategy\n- Direct research initiatives and product development\n- Manage team of AI researchers and engineers\n\n[Requirements]\n- 7+ years AI/ML experience\n- Research leadership experience\n- Deep learning expertise\n- Team management skills`,
  'ae140520-3166-4df1-badd-df9e150fe8ad': `${CO.bcuai}\n\n[Responsibilities]\n- Lead AI development projects\n- Architect large-scale AI systems\n- Drive innovation in AI applications\n\n[Requirements]\n- 10+ years AI development\n- System architecture expertise\n- Production AI systems experience\n- Technical leadership`,
  'b9b53024-3d2e-40d9-8334-3e8d69647376': `${CO.bcuai}\n\n[Responsibilities]\n- Develop backend services for AI platform\n- Build APIs and data pipelines\n- System integration and optimization\n\n[Requirements]\n- Backend development experience\n- Python or Java proficiency\n- Database design\n- AI system integration`,
  'c369191b-2e08-47f5-887f-6921e87fae5a': `${CO.bcuai}\n\n[Responsibilities]\n- Backend service development\n- API design and implementation\n- Database management\n\n[Requirements]\n- Backend development skills\n- Modern framework experience\n- SQL proficiency\n- Cloud platform knowledge`,
  '96bfd534-6278-4c3f-9684-6776ff8b4689': `${CO.bcuai}\n\n[Responsibilities]\n- Develop backend APIs and services\n- Build data processing systems\n- System performance optimization\n\n[Requirements]\n- Backend development experience\n- API design skills\n- Database optimization\n- Cloud infrastructure`,

  // NXN Labs x2
  'ab8d1223-3413-493e-976b-094bd217f8f5': `NXN Labs builds next-generation AI-powered enterprise solutions.\n\n[Responsibilities]\n- Architect and develop complex software systems\n- Lead technical design and code reviews\n- Optimize system performance and reliability\n\n[Requirements]\n- 7+ years software engineering\n- System architecture skills\n- Multiple programming languages\n- Technical leadership`,
  'b71000a6-ef60-4c9f-81f0-ff21d5082a2f': `NXN Labs develops AI-powered enterprise solutions.\n\n[Responsibilities]\n- Define product vision and strategy as founding PM\n- Build product from 0 to 1\n- Coordinate engineering, design, and business\n- Drive product-market fit\n\n[Requirements]\n- Product management experience\n- Startup or early-stage experience\n- Technical product understanding\n- Strong execution and communication`,

  // ETA Electronics x2
  '2dd394b2-c9ae-40f0-89b5-2d2f360ec191': `${CO.eta}\n\n[Responsibilities]\n- Develop frontend applications\n- Build responsive web interfaces\n- Implement UI components\n\n[Requirements]\n- Frontend development experience\n- React or Vue.js\n- HTML, CSS, TypeScript\n- Responsive design`,
  '7e823ab9-ad36-4818-befa-2bfab7b9fdbc': `${CO.eta}\n\n[Responsibilities]\n- Develop backend services\n- Build APIs and data systems\n- Database design\n\n[Requirements]\n- Backend development experience\n- Java or Node.js\n- Database skills\n- API design`,

  // Block S
  '0946e6f6-3a8a-47b1-b620-2c1257118a39': `Block S is building AI-native applications and tools, reimagining software development with AI at the core.\n\n[Responsibilities]\n- Build AI-native software products\n- Integrate LLM and AI capabilities into applications\n- Develop full-stack features with AI-first approach\n\n[Requirements]\n- Software engineering experience\n- AI/ML integration experience\n- Full-stack development skills\n- LLM and prompt engineering knowledge`,

  // Krafton
  '271feefb-91db-42a1-87d9-46fc2b2d8633': `Krafton is a global gaming company known for PUBG, developing next-generation gaming and entertainment experiences.\n\n[Responsibilities]\n- Develop web backend services for gaming platform\n- Build scalable APIs and microservices\n- Implement high-performance data systems\n\n[Requirements]\n- 7+ years backend development\n- Java, Kotlin, or Go proficiency\n- Large-scale system experience\n- Gaming industry experience preferred`,

  // FiveSpace
  '846eb161-b861-4ced-a7c1-8ebb1a4d6ae0': `FiveSpace develops digital workspace solutions for modern teams.\n\n[Responsibilities]\n- Develop frontend for workspace platform\n- Build responsive web applications\n- Implement collaborative features\n\n[Requirements]\n- Frontend development experience\n- React proficiency\n- TypeScript experience\n- UI/UX implementation`,

  // PPSol
  '1677b2ac-bce7-464a-a358-9efd8d043c1c': `PPSol develops high-precision GPS/GNSS positioning solutions for autonomous systems and geospatial applications.\n\n[Responsibilities]\n- Develop GPS/GNSS satellite navigation algorithms\n- Build positioning and navigation solutions\n- Implement signal processing for GNSS receivers\n- Optimize positioning accuracy and reliability\n\n[Requirements]\n- GNSS/GPS engineering experience\n- Signal processing knowledge\n- C/C++ or Python proficiency\n- Understanding of satellite navigation systems\n- Geospatial or navigation domain experience`,

  // SOOP x2
  '3666b16b-7fc7-4d0b-b6f3-e69f37540782': `${CO.soop}\n\n[Responsibilities]\n- Develop AI personalization and recommendation systems\n- Build content recommendation algorithms\n- Optimize user engagement through AI\n\n[Requirements]\n- ML engineering experience\n- Recommendation systems knowledge\n- Python and ML frameworks\n- Large-scale data processing`,
  'b25cb289-875a-44e0-8132-e6dcfaf03eb7': `${CO.soop}\n\n[Responsibilities]\n- Deploy and optimize AI model serving infrastructure\n- Build real-time inference pipelines\n- Manage model lifecycle and deployment\n\n[Requirements]\n- ML engineering or MLOps experience\n- Model serving frameworks (TensorRT, TFServing)\n- Cloud infrastructure\n- Performance optimization`,

  // Naver Pay x4
  '8718cd35-09f5-41ec-9a64-2a845b6aa61a': `${CO.naver}\n\n[Responsibilities]\n- Develop backend services for payment platform\n- Build transaction processing systems\n- Implement financial APIs\n\n[Requirements]\n- Backend development experience\n- Java/Kotlin, Spring\n- Financial systems knowledge\n- High-traffic system experience`,
  '7444dc9a-038b-4cf8-87ae-adbd2ca404fb': `${CO.naver}\n\n[Responsibilities]\n- Develop iOS applications for Naver Pay\n- Build payment and financial features\n- Optimize app performance\n\n[Requirements]\n- iOS development experience\n- Swift proficiency\n- Payment integration experience\n- UIKit/SwiftUI knowledge`,
  'b53e3c53-e6ef-42c0-9f1e-adb74b938a68': `${CO.naver}\n\n[Responsibilities]\n- Develop Android applications for Naver Pay\n- Build payment and financial features\n- Optimize app performance\n\n[Requirements]\n- Android development experience\n- Kotlin proficiency\n- Payment integration experience\n- Android architecture components`,
  '282bc036-6746-46c7-a754-0f6c82ba0e30': `${CO.naver}\n\n[Responsibilities]\n- Develop frontend for Naver Pay web platform\n- Build responsive payment interfaces\n- Implement interactive financial features\n\n[Requirements]\n- Frontend development experience\n- React or Next.js\n- TypeScript\n- Payment UI/UX experience`,

  // Coinone x3
  '73270977-2250-48e3-a5c2-5d48a34c0507': `${CO.coinone}\n\n[Responsibilities]\n- Develop backend services for crypto exchange\n- Build trading and order matching systems\n- Implement financial APIs\n\n[Requirements]\n- Backend development experience\n- Java/Kotlin, Spring\n- Financial systems experience\n- High-performance system design`,
  '350307c1-802f-4b48-ab67-9fcb1ace222d': `${CO.coinone}\n\n[Responsibilities]\n- Develop backend with Kotlin and Spring\n- Build crypto trading features\n- Implement secure financial APIs\n\n[Requirements]\n- Kotlin and Spring Boot experience\n- Backend architecture skills\n- Financial system knowledge\n- Database optimization`,
  '87193984-f4b1-4ad2-ae6e-cb602ef0af41': `${CO.coinone}\n\n[Responsibilities]\n- Develop features for AX (asset exchange) team\n- Build trading and market data systems\n- Implement real-time processing\n\n[Requirements]\n- Backend development experience\n- Real-time systems knowledge\n- Financial technology understanding\n- Java or Kotlin proficiency`,

  // Astona Partners
  '42aef497-d6ca-47ca-b274-50fb339edab8': `Astona Partners provides IT consulting and development services.\n\n[Responsibilities]\n- Develop backend services for client projects\n- Build APIs and integrations\n- Database design and optimization\n\n[Requirements]\n- Backend development experience\n- Java or Node.js\n- Database skills\n- Client project experience`,

  // eLancer
  'ec44b947-32a2-4ee9-ad94-891dbcf14252': `eLancer is a freelance IT talent platform connecting developers with project opportunities.\n\n[Responsibilities]\n- Develop backend for freelancer matching platform\n- Build project management features\n- Implement search and matching algorithms\n\n[Requirements]\n- Backend development experience\n- Java or Python proficiency\n- Database design\n- Search/matching system experience`,

  // 0xFlow
  'e1b054cc-741e-457f-b52d-75420dd0e8be': `0xFlow is a blockchain infrastructure company building Web3 development tools and protocols.\n\n[Responsibilities]\n- Design QA processes for blockchain products\n- Build automated testing for smart contracts and dApps\n- Perform security and functional testing\n- Ensure protocol reliability\n\n[Requirements]\n- QA experience in blockchain/Web3\n- Smart contract testing knowledge\n- Test automation skills\n- Security testing experience`,

  // Kleon
  '6e17791a-613b-4c0a-a7ca-66b8ffffc0aa': `Kleon is an AI startup building intelligent solutions for enterprise automation.\n\n[Responsibilities]\n- Integrate AI systems with enterprise client environments\n- Build deployment and integration pipelines\n- Customize AI solutions for business needs\n\n[Requirements]\n- Software engineering experience\n- AI/ML system integration\n- Client-facing technical skills\n- Python or Java proficiency`,

  // Coxwave
  '852d078e-2bf0-4bc8-8f86-b9b58196e079': `Coxwave is an AI company developing next-generation recommendation and personalization systems.\n\n[Responsibilities]\n- Research and develop AI models for recommendations\n- Publish and advance state-of-the-art in AI\n- Design experiments and evaluate model performance\n- Collaborate with engineering on production deployment\n\n[Requirements]\n- AI/ML research experience\n- Deep learning and NLP background\n- Publication track record\n- PyTorch proficiency\n- Recommendation systems knowledge`,

  // Fines
  '99804d64-c6cf-4017-a2f4-b99e78e30489': `Fines develops fintech solutions for financial services.\n\n[Responsibilities]\n- Develop backend for fintech platform\n- Build financial APIs and processing systems\n- Database design and optimization\n\n[Requirements]\n- Backend development experience\n- Financial systems knowledge\n- Java or Kotlin\n- Database optimization`,

  // Higher Diversity x2
  '26503fa5-edf9-4c51-b0f8-907c43b7284b': `${CO.higher}\n\n[Responsibilities]\n- Develop backend services\n- Build APIs and data systems\n- System optimization\n\n[Requirements]\n- Backend development experience\n- Modern framework proficiency\n- Database skills\n- API design`,
  'f024089f-27cd-448f-be76-798d31986991': `${CO.higher}\n\n[Responsibilities]\n- Build CI/CD pipelines\n- Manage cloud infrastructure\n- System monitoring and reliability\n\n[Requirements]\n- DevOps experience\n- Cloud platforms (AWS/GCP)\n- Docker, Kubernetes\n- Infrastructure automation`,

  // Spade Company
  '07a82739-3ce9-4f88-92a6-8b7e48f73fd5': `Spade Company develops web solutions for enterprise clients.\n\n[Responsibilities]\n- Build and maintain web pages and templates\n- Implement responsive designs from mockups\n- Ensure cross-browser compatibility\n- Optimize web performance\n\n[Requirements]\n- 8+ years web publishing experience\n- HTML, CSS, JavaScript expertise\n- Responsive design skills\n- Cross-browser compatibility knowledge`,

  // Diotis
  '8ccb1ea3-3be4-44b7-9951-bb180606dbf3': `Diotis develops IoT and connected device solutions for smart environments.\n\n[Responsibilities]\n- Develop backend for IoT platform\n- Build device management APIs\n- Implement data processing pipelines\n\n[Requirements]\n- Backend development experience\n- IoT systems understanding\n- API design skills\n- Real-time data processing`,

  // Coupang x3
  '3d7c3a7a-c751-433d-b3b6-79207c77faa0': `${CO.coupang}\n\n[Responsibilities]\n- Design QA strategies for e-commerce platform\n- Build test automation frameworks\n- Ensure product quality at scale\n\n[Requirements]\n- QA engineering experience\n- Test automation expertise\n- E-commerce platform testing\n- Large-scale system QA`,
  '480b3e86-a320-49a0-a8b8-4f2a9e87b087': `${CO.coupang}\n\n[Responsibilities]\n- Develop backend services for e-commerce platform\n- Build scalable microservices\n- Optimize high-traffic systems\n\n[Requirements]\n- Backend development experience\n- Java or Kotlin proficiency\n- Distributed systems\n- High-scale system design`,
  '73f484c8-a366-4232-86d2-c5854ee0a95a': `${CO.coupang}\n\n[Responsibilities]\n- Backend service development for e-commerce\n- API design and implementation\n- System performance optimization\n\n[Requirements]\n- Backend development skills\n- Java/Kotlin, Spring\n- Microservice architecture\n- Database optimization`,

  // 42dot
  'cd4a9ea0-541c-4068-a066-5de126650e6d': `42dot is Hyundai Motor Groups autonomous driving and mobility software company.\n\n[Responsibilities]\n- Develop IVI (In-Vehicle Infotainment) OS system frameworks\n- Build embedded system software for automotive platforms\n- Implement system-level services and drivers\n\n[Requirements]\n- Embedded systems or OS development experience\n- C/C++ proficiency\n- Linux kernel or system programming\n- Automotive software experience preferred`,

  // Concentrix Korea x2
  'd0d9a2f0-fb0d-4d08-b495-08652ba931d0': `${CO.concentrix}\n\n[Responsibilities]\n- Develop RAG (Retrieval-Augmented Generation) systems\n- Build knowledge graph search solutions\n- Implement enterprise search with AI\n\n[Requirements]\n- NLP/LLM engineering experience\n- RAG architecture knowledge\n- Graph database experience\n- Python and ML frameworks`,
  'cb7e816b-6a71-4ea4-855e-ca25bbd3506c': `${CO.concentrix}\n\n[Responsibilities]\n- Develop LLM and AI agent solutions\n- Build conversational AI systems\n- Deploy enterprise AI applications\n\n[Requirements]\n- LLM engineering experience\n- AI agent architecture knowledge\n- Python proficiency\n- Production AI deployment`,

  // TeamSPARTA x2
  'c4aa039c-ad24-494a-a441-c569f4e64789': `${CO.team}\n\n[Responsibilities]\n- Design and manage corporate education programs\n- Coordinate with clients on training requirements\n- Develop learning content and curricula\n- Manage project timelines and delivery\n\n[Requirements]\n- Project management experience\n- Education or training industry background\n- Client communication skills\n- Content development experience`,
  '8f7f3999-868b-48ee-ba16-99e6b41918a8': `${CO.team}\n\n[Responsibilities]\n- Support corporate education project delivery as intern\n- Assist in training program coordination\n- Help develop learning materials\n\n[Requirements]\n- Currently enrolled in university\n- Interest in education technology\n- Communication and organizational skills\n- Basic project management understanding`,

  // Tabling
  '593eab80-e54f-4fa2-9ab9-170c03a772b9': `Tabling is a restaurant technology platform providing waitlist management, reservations, and POS solutions for restaurants across Korea.\n\n[Responsibilities]\n- Develop backend services for restaurant tech platform\n- Build APIs for reservation and POS systems\n- Design real-time notification and queue management\n- Optimize system reliability for peak dining hours\n\n[Requirements]\n- Backend development experience\n- Java/Kotlin, Spring Boot\n- Database design (MySQL, PostgreSQL)\n- Real-time system experience\n- High-traffic system optimization`,

  // Genoray x6
  'bc856a09-367f-4b97-84df-3f33763e2698': `${CO.genoray}\n\n[Responsibilities]\n- Develop FLEXLAB blockchain integration\n- Build distributed ledger features for medical data\n\n[Requirements]\n- Blockchain development experience\n- Distributed systems knowledge\n- Medical device industry understanding`,
  '98ae8de7-ef5c-4295-bd2c-e56fdd529a00': `${CO.genoray}\n\n[Responsibilities]\n- Develop FLEXLAB image processing systems\n- Build medical image analysis pipelines\n- Optimize processing performance\n\n[Requirements]\n- Image processing experience\n- C++ or Python proficiency\n- Medical imaging knowledge preferred`,
  '50180b98-eeaf-40b2-8449-32e62a6501c1': `${CO.genoray}\n\n[Responsibilities]\n- Define product roadmap for medical devices\n- Coordinate R&D and business teams\n- Manage product lifecycle\n\n[Requirements]\n- Product management experience\n- Medical device industry knowledge\n- Technical product understanding`,
  '8fc4c7b1-abe9-4437-b892-7f88fc01a418': `${CO.genoray}\n\n[Responsibilities]\n- Develop FLEXLAB medical software applications\n- Build clinical workflow features\n- Integrate with medical imaging systems\n\n[Requirements]\n- Software development experience\n- Medical device software knowledge\n- C++ or Java proficiency`,
  '7886623a-65c6-40cf-a5bd-29ba597ec030': `${CO.genoray}\n\n[Responsibilities]\n- Define product strategy for imaging solutions\n- Manage product development lifecycle\n- Analyze market and customer needs\n\n[Requirements]\n- Product management experience\n- Medical technology understanding\n- Cross-functional coordination`,
  '090bdd43-dbf2-496c-8578-e5ab7964f3fd': `${CO.genoray}\n\n[Responsibilities]\n- Design and develop hardware for medical imaging\n- Build electronic circuits and PCB layouts\n- Prototype and test hardware components\n\n[Requirements]\n- Hardware engineering experience\n- Circuit design skills\n- PCB layout experience\n- Medical device knowledge preferred`,

  // MUSMA
  '471dee09-2830-4012-97d8-8c1ece02fad9': `MUSMA develops AI-powered industrial safety and monitoring solutions.\n\n[Responsibilities]\n- Design and develop hardware circuits for IoT devices\n- Build PCB layouts and power management systems\n- Test and validate electronic components\n\n[Requirements]\n- Hardware circuit design experience\n- PCB design tools proficiency\n- Electronics testing and debugging\n- Located in or willing to relocate to Busan`,

  // TokTok
  '61a3d772-8272-43c0-af9c-1c73b833f117': `TokTok is a communication platform providing messaging and collaboration tools.\n\n[Responsibilities]\n- Build and maintain infrastructure and CI/CD\n- Manage cloud resources and deployments\n- Monitor system reliability and performance\n- Automate operations\n\n[Requirements]\n- DevOps engineering experience\n- Cloud platform experience\n- Docker, Kubernetes\n- CI/CD pipeline management`,

  // Kakao Healthcare
  'a8592663-0e46-428d-ab0c-132b6eae3673': `Kakao Healthcare is Kakao's healthcare subsidiary, developing digital health solutions and medical data platforms.\n\n[Responsibilities]\n- Build and manage data operations pipelines\n- Design data quality monitoring systems\n- Implement data governance processes\n- Automate data workflows\n\n[Requirements]\n- Data engineering or DataOps experience\n- SQL and Python proficiency\n- Data pipeline tools (Airflow, etc.)\n- Healthcare data experience preferred`,

  // B By Innovation
  '44508fab-6271-42f7-8a3e-74630d760075': `B By Innovation is a data-driven business consulting company helping enterprises leverage analytics for growth.\n\n[Responsibilities]\n- Analyze business data for insights and strategy\n- Build dashboards and reports\n- Develop data models and metrics\n- Support data-driven decision making\n\n[Requirements]\n- Data analysis experience\n- SQL and Python proficiency\n- BI tools (Tableau, Power BI)\n- Statistical analysis and visualization`,

  // Pebble Square
  '48efd727-ed19-4cd8-b554-84dc5c1cc518': `Pebble Square develops on-device AI solutions for edge computing applications.\n\n[Responsibilities]\n- Develop AI models optimized for edge devices\n- Build on-device inference pipelines\n- Optimize model size and performance for embedded systems\n- Integrate AI with edge hardware\n\n[Requirements]\n- Edge AI or embedded ML experience\n- Model optimization (quantization, pruning)\n- C/C++ and Python proficiency\n- Understanding of embedded systems\n- Experience with ONNX, TFLite, or similar`,

  // Zigbang x2
  'a6d80245-9dfd-41d9-ac61-97cdcea718c9': `${CO.zigbang}\n\n[Responsibilities]\n- Develop AI agent systems for smart home automation\n- Build conversational AI for IoT control\n- Integrate LLM capabilities with smart devices\n\n[Requirements]\n- AI/ML engineering experience\n- IoT systems understanding\n- LLM and agent architecture\n- Python proficiency`,
  '1796e990-d3c4-440d-a8ea-6f2605359a72': `${CO.zigbang}\n\n[Responsibilities]\n- Develop smart home solutions and IoT integrations\n- Build device management platforms\n- Implement home automation features\n\n[Requirements]\n- Software engineering experience\n- IoT or smart home technology\n- Backend development skills\n- Hardware integration knowledge`,

  // BHSN x2
  '46e34f1b-31d3-4bdb-b295-39d610ca186d': `${CO.bhsn}\n\n[Responsibilities]\n- Develop backend services for communication platform\n- Build scalable APIs and microservices\n- Optimize system performance\n\n[Requirements]\n- 5-10 years backend experience\n- Java/Kotlin, Spring\n- Microservice architecture\n- High-availability systems`,
  '10b0441a-de0a-48d8-b411-3969b314deeb': `${CO.bhsn}\n\n[Responsibilities]\n- Develop frontend for communication platform\n- Build responsive web applications\n- Implement real-time features\n\n[Requirements]\n- 5+ years frontend experience\n- React or Next.js\n- TypeScript\n- Real-time web technologies`,

  // Allganize Korea
  '13a7c76b-0a74-4c02-8d84-bb588f19a4fa': `Allganize Korea develops enterprise AI solutions including NLU and document understanding products.\n\n[Responsibilities]\n- Deploy and manage AI solutions at enterprise client sites\n- Provide technical support and troubleshooting\n- Manage Kubernetes-based infrastructure\n- Client-facing technical consulting\n\n[Requirements]\n- 3-15 years field engineering experience\n- Kubernetes required\n- Enterprise IT infrastructure knowledge\n- Client communication skills\n- Contract position`,

  // InnoGrid x6
  'efaf482f-0cea-4333-9c68-2b59c3f3a992': `${CO.innogrid}\n\n[Responsibilities]\n- Design and manage cloud infrastructure\n- Build cloud migration solutions\n- Implement hybrid cloud architectures\n\n[Requirements]\n- Cloud engineering experience\n- AWS, GCP, or Azure\n- Infrastructure as Code\n- Container orchestration`,
  '65921dc4-80ce-4cba-93d0-777e65b046ae': `${CO.innogrid}\n\n[Responsibilities]\n- Develop cloud platform solutions\n- Build infrastructure automation\n- Support cloud operations\n\n[Requirements]\n- Cloud engineering experience\n- Linux system administration\n- Automation scripting\n- Cloud platform knowledge`,
  'caacfb37-d3d3-41e3-9fb3-c90e0bc94d6f': `${CO.innogrid}\n\n[Responsibilities]\n- Provide senior-level technical support for cloud solutions\n- Lead customer escalation resolution\n- Design solution architectures for clients\n\n[Requirements]\n- 7+ years technical support experience\n- Cloud platform expertise\n- Solution architecture skills\n- Client relationship management`,
  '963f8104-e81f-490b-9eef-961bf66f110b': `${CO.innogrid}\n\n[Responsibilities]\n- Provide technical support for cloud solutions\n- Troubleshoot customer issues\n- Document solutions and best practices\n\n[Requirements]\n- Technical support experience\n- Cloud platform knowledge\n- Problem-solving skills\n- Customer communication`,
  'ec9edc93-aa28-4c16-af0b-4f5bc07376b9': `${CO.innogrid}\n\n[Responsibilities]\n- Develop blockchain platform solutions\n- Build distributed ledger applications\n- Design consensus and smart contract systems\n\n[Requirements]\n- 5+ years blockchain development\n- Distributed systems expertise\n- Smart contract development\n- Go or Rust proficiency`,
  '4641a8bf-1afe-4dd1-aff3-e5b3d8e85a4e': `${CO.innogrid}\n\n[Responsibilities]\n- Build and manage cloud infrastructure\n- Implement cloud-native solutions\n- Optimize cloud resource usage\n\n[Requirements]\n- Cloud engineering experience\n- Infrastructure automation\n- Container technologies\n- Cloud cost optimization`,

  // PT Greater China
  '428d0555-d609-4263-bab7-d456ae4b8a9b': `PT Greater China (PTKOREA) is an entertainment and marketing company operating across Greater China and Korea.\n\n[Responsibilities]\n- Develop SEO strategies for content marketing\n- Create and optimize content for search engines\n- Analyze search performance and keywords\n- Drive organic traffic growth\n\n[Requirements]\n- Content SEO experience\n- Keyword research and analysis skills\n- Content strategy and writing\n- Analytics tools (Google Analytics, Search Console)`,
}

let updated = 0
let errors = 0
for (const [id, desc] of Object.entries(t)) {
  const { error } = await supabase.from('jobs').update({ description: desc }).eq('id', id)
  if (!error) updated++
  else { errors++; console.log('ERR:', id, error.message) }
}
console.log('Done:', updated, 'updated,', errors, 'errors')

// Check remaining
const { data: check } = await supabase.from('jobs').select('id, description').eq('source', 'wanted')
const remaining = check.filter(j => /[가-힣]/.test(j.description || ''))
console.log('Remaining Korean descriptions:', remaining.length)
