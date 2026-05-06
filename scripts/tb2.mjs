import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const t = {}

// Miso
t['72d26fe2-9536-40c4-b134-15f540378c3a'] = 'Miso is a home services platform connecting users with professional cleaners and service providers across Korea.\n\n[Responsibilities]\n- Design and develop backend services for home services platform\n- Build scalable APIs for booking and matching systems\n- Optimize database performance and system architecture\n\n[Requirements]\n- 5+ years backend development\n- Java/Kotlin or Node.js proficiency\n- Database design and optimization\n- RESTful API and microservice architecture'

// Seedronics
t['98a452d1-f1a6-49c1-864c-cedaa58d6d77'] = 'Seedronics develops autonomous drone and sensor systems for industrial applications.\n\n[Responsibilities]\n- Manage and curate camera sensor AI training datasets\n- Design data labeling and annotation workflows\n- Ensure data quality for computer vision models\n\n[Requirements]\n- Experience with AI/ML data management\n- Understanding of computer vision data pipelines\n- Data quality assurance experience\n- Familiarity with labeling tools'
t['f0e6e874-6b40-470b-9fbe-708d504bdfbe'] = 'Seedronics builds autonomous drone and sensor systems for industrial use.\n\n[Responsibilities]\n- Manage and curate radar sensor AI training datasets\n- Design data collection and annotation processes\n- Ensure data quality for radar-based ML models\n\n[Requirements]\n- AI/ML data management experience\n- Understanding of radar or signal data\n- Data quality assurance skills\n- Familiarity with annotation tools'

// DoomDoom
t['df051468-4afe-49a5-bf93-daef3b65820c'] = 'DoomDoom develops unmanned aerial vehicle (UAV) systems for industrial and commercial applications.\n\n[Responsibilities]\n- Design and develop embedded systems for UAV platforms\n- Implement firmware for flight controllers and sensors\n- Optimize real-time systems performance\n\n[Requirements]\n- Embedded systems development experience\n- C/C++ proficiency\n- RTOS experience\n- Understanding of communication protocols (SPI, I2C, UART)'

// Wanted Gigs
t['26f318b3-9f4f-4b3a-9953-ca4e90a2aae7'] = 'Wanted Gigs connects freelance IT professionals with enterprise project opportunities.\n\n[Responsibilities]\n- Develop and maintain IVR (Interactive Voice Response) systems\n- Build voice automation solutions for call centers\n- Integrate telephony systems with enterprise platforms\n\n[Requirements]\n- IVR/CTI system development experience\n- Voice system architecture knowledge\n- Telephony protocol understanding\n- Java or C# development skills'
t['7fa4789b-0355-4c35-906a-cb925cb162fb'] = 'Wanted Gigs matches freelance IT professionals with enterprise projects.\n\n[Responsibilities]\n- Develop and maintain RPA solutions\n- Build automated workflows for business processes\n- Manage RPA bot deployment and operations\n\n[Requirements]\n- RPA development experience (UiPath, Automation Anywhere, etc.)\n- Process analysis and automation design\n- Programming skills (Python, C#, etc.)\n- Understanding of enterprise workflows'

// Korea Deep Learning
t['413dbe53-d3e7-4ba4-b7d5-8e6660bafa7e'] = 'Korea Deep Learning is an AI company specializing in deep learning solutions for enterprise applications.\n\n[Responsibilities]\n- Design and develop backend services for AI platform\n- Build scalable APIs and data processing pipelines\n- Implement ML model serving infrastructure\n\n[Requirements]\n- Backend development experience\n- Python or Java proficiency\n- Database design and optimization\n- Understanding of ML/AI systems'
t['7232e267-115d-4e47-b993-ab514154643b'] = 'Korea Deep Learning develops enterprise AI solutions powered by deep learning technology.\n\n[Responsibilities]\n- Deploy and integrate AI solutions at client sites\n- Customize ML models for specific business requirements\n- Provide technical consulting and support\n- Bridge gap between research and production\n\n[Requirements]\n- Software engineering experience with AI/ML focus\n- Client-facing technical skills\n- Python and ML frameworks proficiency\n- Problem-solving and communication abilities'

// OMTI Korea
t['b52c59a5-41ef-45ff-991b-1746ac32a5b7'] = 'OMTI Korea provides IT solutions and development services for enterprise clients.\n\n[Responsibilities]\n- Develop web applications using ASP.NET framework\n- Build and maintain database-driven systems\n- Participate in full software development lifecycle\n\n[Requirements]\n- Entry-level / recent graduate\n- Basic understanding of C# and ASP.NET\n- SQL and database fundamentals\n- Willingness to learn and grow'
t['989a5a47-4c6c-4bfc-b501-470b16eca849'] = 'OMTI Korea delivers IT solutions and development services for enterprises.\n\n[Responsibilities]\n- Develop and maintain ASP.NET web applications\n- Design database schemas and optimize queries\n- Implement business logic and API integrations\n\n[Requirements]\n- 3+ years ASP.NET development experience\n- C# and .NET framework proficiency\n- SQL Server database experience\n- Web development best practices'
t['843d5dfc-9b04-4c5c-9521-4b1c61fa48c3'] = 'OMTI Korea provides enterprise IT solutions and services.\n\n[Responsibilities]\n- Manage and maintain server infrastructure\n- Monitor system performance and troubleshoot issues\n- Implement security measures and backup procedures\n\n[Requirements]\n- 2-7 years system engineering experience\n- Windows/Linux server administration\n- Network infrastructure knowledge\n- Monitoring tools experience'

// Rentree
t['8d294736-a8c7-4abb-919f-0f1dad13cf64'] = 'Rentree operates a subscription-based product rental platform, enabling consumers to access items through monthly subscriptions.\n\n[Responsibilities]\n- Design and operate platform infrastructure\n- Build deployment pipelines and automation\n- Monitor system reliability and performance\n- Manage cloud resources and cost optimization\n\n[Requirements]\n- Platform operations or DevOps experience\n- Cloud platform experience (AWS/GCP)\n- Container orchestration (Kubernetes)\n- CI/CD pipeline management'

// Wise Romantic
t['851db030-3353-4c9b-b4f7-78e9390cf110'] = 'Wise Romantic builds hotel technology solutions including CMS automation and AI-powered guest service platforms.\n\n[Responsibilities]\n- Lead engineering for hotel CMS and AI agent platform\n- Architect scalable backend systems\n- Design AI-powered automation workflows\n- Manage technical team and project delivery\n\n[Requirements]\n- 5+ years backend engineering experience\n- System architecture and leadership skills\n- AI/ML integration experience\n- Hotel/hospitality tech experience is a plus'

// The Fair Global
t['235b1c08-bfe0-4d95-9f7e-7e251b4a9af7'] = 'The Fair Global is a cross-border e-commerce company connecting Korean brands with global consumers.\n\n[Responsibilities]\n- Design and develop backend services for e-commerce platform\n- Build APIs for order processing and inventory management\n- Implement payment and logistics integrations\n- Optimize system performance for global scale\n\n[Requirements]\n- Backend development experience\n- E-commerce or marketplace platform experience\n- RESTful API design\n- Database optimization skills\n- Understanding of payment/logistics systems'

// Neuro Entertainment
t['d058de04-6ff4-4833-af14-54549a61f0b3'] = 'Neuro Entertainment creates interactive content and entertainment platforms.\n\n[Responsibilities]\n- Develop cross-platform mobile applications using React Native\n- Build creator-focused platform features\n- Implement real-time communication and media features\n- Optimize app performance across iOS and Android\n\n[Requirements]\n- React Native development experience\n- JavaScript/TypeScript proficiency\n- iOS and Android platform understanding\n- REST API integration experience'

// Jikim Company
t['2dddd4c7-aad2-4aa2-902b-68f8ef5d339b'] = 'Jikim Company develops security and safety technology solutions.\n\n[Responsibilities]\n- Develop frontend applications and user interfaces\n- Build responsive web applications\n- Implement UI/UX designs with modern frameworks\n\n[Requirements]\n- Frontend development experience\n- React or Vue.js proficiency\n- HTML, CSS, JavaScript/TypeScript\n- Responsive design skills'

// Archisketch
t['540cda1a-ecbd-47ac-8126-8f9fdfd45df6'] = 'Archisketch is an AI-powered interior design platform enabling users to visualize and design spaces.\n\n[Responsibilities]\n- Develop AI agent systems for banking applications (Woori Bank project)\n- Build conversational AI and automation workflows\n- Integrate with enterprise banking systems\n\n[Requirements]\n- AI/ML development experience\n- LLM and conversational AI understanding\n- Backend development skills\n- Enterprise system integration experience'

// Linkovation
t['a5eb2be4-61d0-44df-ae42-9db368b1458d'] = 'Linkovation provides innovative technology solutions connecting businesses through digital platforms.\n\n[Responsibilities]\n- Full-stack development of web applications\n- Build both frontend and backend features\n- Database design and API development\n- Collaborate on product development\n\n[Requirements]\n- Full-stack development experience\n- Frontend (React/Vue) and backend (Node.js/Java) skills\n- Database design\n- Git and agile development practices'

let updated = 0
for (const [id, desc] of Object.entries(t)) {
  const { error } = await supabase.from('jobs').update({ description: desc }).eq('id', id)
  if (!error) updated++
  else console.log('ERR:', id, error.message)
}
console.log('Batch 4 done:', updated)
