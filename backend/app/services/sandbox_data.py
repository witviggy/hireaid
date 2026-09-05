"""Custom sandbox dataset and search engine for zero-cost testing.

Contains realistic candidate profiles across 5 domains:
- Software Engineering
- Hardware & Embedded Systems
- IT & Cloud Infrastructure
- AI & Machine Learning
- Blockchain & Web3

All profiles include valid E.164 phone numbers so calling workflows
can be tested end-to-end without purchasing data credits.
"""
from typing import Any, Optional
import re

SANDBOX_CANDIDATES: list[dict[str, Any]] = [
    # -------------------------------------------------------------
    # 1. SOFTWARE ENGINEERING
    # -------------------------------------------------------------
    {
        "id": "sbx-swe-01",
        "full_name": "Aarav Sharma",
        "job_title": "Senior Backend Engineer",
        "company": "Swiggy",
        "location": "Bangalore, India",
        "domain": "software",
        "experience_years": 6,
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS", "Redis", "Kafka", "Microservices"],
        "email": "aarav.sharma@example.com",
        "phone_number": "+919811100001",
        "linkedin_url": "https://linkedin.com/in/aarav-sharma-swe",
    },
    {
        "id": "sbx-swe-02",
        "full_name": "Priya Nair",
        "job_title": "Lead Full Stack Developer",
        "company": "Razorpay",
        "location": "Bangalore, India",
        "domain": "software",
        "experience_years": 8,
        "skills": ["React", "TypeScript", "Node.js", "Next.js", "PostgreSQL", "GraphQL", "Tailwind CSS"],
        "email": "priya.nair@example.com",
        "phone_number": "+919811100002",
        "linkedin_url": "https://linkedin.com/in/priya-nair-fullstack",
    },
    {
        "id": "sbx-swe-03",
        "full_name": "Rohan Deshmukh",
        "job_title": "Backend Go Engineer",
        "company": "CRED",
        "location": "Bangalore, India",
        "domain": "software",
        "experience_years": 5,
        "skills": ["Go", "Golang", "gRPC", "Kubernetes", "Redis", "PostgreSQL", "Distributed Systems"],
        "email": "rohan.deshmukh@example.com",
        "phone_number": "+919811100003",
        "linkedin_url": "https://linkedin.com/in/rohan-deshmukh-go",
    },
    {
        "id": "sbx-swe-04",
        "full_name": "Neha Kulkarni",
        "job_title": "Frontend Engineer (React / Next.js)",
        "company": "Postman",
        "location": "Pune, India",
        "domain": "software",
        "experience_years": 4,
        "skills": ["React", "JavaScript", "TypeScript", "Redux", "Tailwind CSS", "HTML5", "CSS3", "Vite"],
        "email": "neha.kulkarni@example.com",
        "phone_number": "+919811100004",
        "linkedin_url": "https://linkedin.com/in/neha-kulkarni-fe",
    },
    {
        "id": "sbx-swe-05",
        "full_name": "Karthik Venkatesh",
        "job_title": "DevOps & SRE Specialist",
        "company": "Freshworks",
        "location": "Chennai, India",
        "domain": "software",
        "experience_years": 7,
        "skills": ["Kubernetes", "Terraform", "AWS", "CI/CD", "Docker", "Prometheus", "Grafana", "Ansible", "Linux"],
        "email": "karthik.v@example.com",
        "phone_number": "+919811100005",
        "linkedin_url": "https://linkedin.com/in/karthik-venkatesh-sre",
    },
    {
        "id": "sbx-swe-06",
        "full_name": "Aditi Roy",
        "job_title": "Junior Python Developer",
        "company": "InMobi",
        "location": "Hyderabad, India",
        "domain": "software",
        "experience_years": 2,
        "skills": ["Python", "Django", "REST APIs", "Git", "SQL", "Unit Testing"],
        "email": "aditi.roy@example.com",
        "phone_number": "+919811100006",
        "linkedin_url": "https://linkedin.com/in/aditi-roy-py",
    },

    # -------------------------------------------------------------
    # 2. HARDWARE & EMBEDDED SYSTEMS
    # -------------------------------------------------------------
    {
        "id": "sbx-hdw-01",
        "full_name": "Vikram Sethi",
        "job_title": "Principal Embedded Firmware Engineer",
        "company": "Texas Instruments",
        "location": "Bangalore, India",
        "domain": "hardware",
        "experience_years": 10,
        "skills": ["Embedded C", "C++", "RTOS", "FreeRTOS", "ARM Cortex", "SPI", "I2C", "UART", "BLE", "Device Drivers"],
        "email": "vikram.sethi@example.com",
        "phone_number": "+919811100007",
        "linkedin_url": "https://linkedin.com/in/vikram-sethi-embedded",
    },
    {
        "id": "sbx-hdw-02",
        "full_name": "Ananya Joshi",
        "job_title": "VLSI Design & Verification Engineer",
        "company": "Qualcomm",
        "location": "Hyderabad, India",
        "domain": "hardware",
        "experience_years": 6,
        "skills": ["Verilog", "SystemVerilog", "UVM", "ASIC", "FPGA", "Synopsys", "Static Timing Analysis"],
        "email": "ananya.joshi@example.com",
        "phone_number": "+919811100008",
        "linkedin_url": "https://linkedin.com/in/ananya-joshi-vlsi",
    },
    {
        "id": "sbx-hdw-03",
        "full_name": "Manish Verma",
        "job_title": "IoT Hardware Systems Architect",
        "company": "Ather Energy",
        "location": "Bangalore, India",
        "domain": "hardware",
        "experience_years": 8,
        "skills": ["PCB Design", "Altium", "Microcontrollers", "ESP32", "CAN Bus", "Firmware", "Hardware Debugging"],
        "email": "manish.verma@example.com",
        "phone_number": "+919811100009",
        "linkedin_url": "https://linkedin.com/in/manish-verma-iot",
    },
    {
        "id": "sbx-hdw-04",
        "full_name": "Siddharth Rao",
        "job_title": "FPGA & DSP Engineer",
        "company": "Intel Corporation",
        "location": "Bangalore, India",
        "domain": "hardware",
        "experience_years": 5,
        "skills": ["VHDL", "Verilog", "Xilinx Vivado", "DSP", "Signal Processing", "High Speed Interface", "PCIe"],
        "email": "siddharth.rao@example.com",
        "phone_number": "+919811100010",
        "linkedin_url": "https://linkedin.com/in/siddharth-rao-fpga",
    },
    {
        "id": "sbx-hdw-05",
        "full_name": "Pooja Hegde",
        "job_title": "Embedded Systems Engineer",
        "company": "Bosch India",
        "location": "Pune, India",
        "domain": "hardware",
        "experience_years": 3,
        "skills": ["C", "C++", "Automotive", "AUTOSAR", "CANalyzer", "Microchip", "Embedded Linux"],
        "email": "pooja.hegde@example.com",
        "phone_number": "+919811100011",
        "linkedin_url": "https://linkedin.com/in/pooja-hegde-embedded",
    },

    # -------------------------------------------------------------
    # 3. IT & CLOUD INFRASTRUCTURE
    # -------------------------------------------------------------
    {
        "id": "sbx-it-01",
        "full_name": "Rajesh Gupta",
        "job_title": "Lead Cloud Solutions Architect",
        "company": "Wipro Technologies",
        "location": "Bangalore, India",
        "domain": "it",
        "experience_years": 11,
        "skills": ["AWS", "Azure", "Cloud Architecture", "Migration", "Terraform", "IAM", "Enterprise IT", "Cost Optimization"],
        "email": "rajesh.gupta@example.com",
        "phone_number": "+919811100012",
        "linkedin_url": "https://linkedin.com/in/rajesh-gupta-cloud",
    },
    {
        "id": "sbx-it-02",
        "full_name": "Sneha Sen",
        "job_title": "Cybersecurity & SOC Lead",
        "company": "Infosys",
        "location": "Pune, India",
        "domain": "it",
        "experience_years": 7,
        "skills": ["SIEM", "Incident Response", "Penetration Testing", "Splunk", "CISSP", "Network Security", "Vulnerability Management"],
        "email": "sneha.sen@example.com",
        "phone_number": "+919811100013",
        "linkedin_url": "https://linkedin.com/in/sneha-sen-sec",
    },
    {
        "id": "sbx-it-03",
        "full_name": "Deepak Choudhury",
        "job_title": "Senior Systems & Network Engineer",
        "company": "Tata Consultancy Services",
        "location": "Kolkata, India",
        "domain": "it",
        "experience_years": 8,
        "skills": ["Cisco", "BGP", "OSPF", "Linux Administration", "VMware", "Firewall", "Active Directory", "DNS"],
        "email": "deepak.c@example.com",
        "phone_number": "+919811100014",
        "linkedin_url": "https://linkedin.com/in/deepak-choudhury-net",
    },
    {
        "id": "sbx-it-04",
        "full_name": "Kavita Pillai",
        "job_title": "IT Operations & Database Administrator",
        "company": "Cognizant",
        "location": "Kochi, India",
        "domain": "it",
        "experience_years": 5,
        "skills": ["Oracle DB", "PostgreSQL", "Disaster Recovery", "Backup Strategy", "Shell Scripting", "ITIL"],
        "email": "kavita.pillai@example.com",
        "phone_number": "+919811100015",
        "linkedin_url": "https://linkedin.com/in/kavita-pillai-dba",
    },
    {
        "id": "sbx-it-05",
        "full_name": "Arjun Singhal",
        "job_title": "DevSecOps Engineer",
        "company": "HCLTech",
        "location": "Noida, India",
        "domain": "it",
        "experience_years": 4,
        "skills": ["SonarQube", "Snyk", "Docker", "Kubernetes", "AWS Security", "Jenkins", "Zero Trust"],
        "email": "arjun.singhal@example.com",
        "phone_number": "+919811100016",
        "linkedin_url": "https://linkedin.com/in/arjun-singhal-devsecops",
    },

    # -------------------------------------------------------------
    # 4. AI & MACHINE LEARNING
    # -------------------------------------------------------------
    {
        "id": "sbx-ai-01",
        "full_name": "Dr. Ishaan Bhattacharya",
        "job_title": "Senior Machine Learning & LLM Engineer",
        "company": "Google Research",
        "location": "Bangalore, India",
        "domain": "ai",
        "experience_years": 7,
        "skills": ["PyTorch", "LLMs", "Transformers", "LangChain", "LoRA", "Fine-Tuning", "Python", "vLLM", "RAG"],
        "email": "ishaan.bhatt@example.com",
        "phone_number": "+919811100017",
        "linkedin_url": "https://linkedin.com/in/ishaan-bhattacharya-ai",
    },
    {
        "id": "sbx-ai-02",
        "full_name": "Tanvi Kapoor",
        "job_title": "Computer Vision Researcher",
        "company": "Ola Electric",
        "location": "Bangalore, India",
        "domain": "ai",
        "experience_years": 5,
        "skills": ["OpenCV", "TensorFlow", "PyTorch", "YOLO", "Object Detection", "CUDA", "Autonomous Vehicles"],
        "email": "tanvi.kapoor@example.com",
        "phone_number": "+919811100018",
        "linkedin_url": "https://linkedin.com/in/tanvi-kapoor-cv",
    },
    {
        "id": "sbx-ai-03",
        "full_name": "Varun Menon",
        "job_title": "MLOps & Data Platform Engineer",
        "company": "Flipkart",
        "location": "Bangalore, India",
        "domain": "ai",
        "experience_years": 6,
        "skills": ["MLflow", "Kubeflow", "Feature Store", "Apache Spark", "Airflow", "Kafka", "Python", "GCP"],
        "email": "varun.menon@example.com",
        "phone_number": "+919811100019",
        "linkedin_url": "https://linkedin.com/in/varun-menon-mlops",
    },
    {
        "id": "sbx-ai-04",
        "full_name": "Meera Swaminathan",
        "job_title": "Staff Data Scientist",
        "company": "Amazon India",
        "location": "Hyderabad, India",
        "domain": "ai",
        "experience_years": 9,
        "skills": ["Statistical Modeling", "A/B Testing", "Scikit-Learn", "Python", "SQL", "Forecasting", "Deep Learning"],
        "email": "meera.swami@example.com",
        "phone_number": "+919811100020",
        "linkedin_url": "https://linkedin.com/in/meera-swaminathan-ds",
    },
    {
        "id": "sbx-ai-05",
        "full_name": "Sanjay Radhakrishnan",
        "job_title": "NLP Engineer & Voice AI Specialist",
        "company": "Sarvam AI",
        "location": "Bangalore, India",
        "domain": "ai",
        "experience_years": 4,
        "skills": ["Speech-to-Text", "TTS", "Whisper", "HuggingFace", "Python", "ASR", "Multilingual NLP"],
        "email": "sanjay.r@example.com",
        "phone_number": "+919811100021",
        "linkedin_url": "https://linkedin.com/in/sanjay-radhakrishnan-nlp",
    },
    {
        "id": "sbx-ai-06",
        "full_name": "Ananya Roy Chowdhury",
        "job_title": "Generative AI Application Developer",
        "company": "Microsoft India",
        "location": "Hyderabad, India",
        "domain": "ai",
        "experience_years": 3,
        "skills": ["OpenAI API", "Vector Databases", "Pinecone", "ChromaDB", "LlamaIndex", "FastAPI", "React"],
        "email": "ananya.rc@example.com",
        "phone_number": "+919811100022",
        "linkedin_url": "https://linkedin.com/in/ananya-rc-genai",
    },

    # -------------------------------------------------------------
    # 5. BLOCKCHAIN & WEB3
    # -------------------------------------------------------------
    {
        "id": "sbx-blk-01",
        "full_name": "Aditya Oberoi",
        "job_title": "Senior Smart Contract Engineer",
        "company": "Polygon Technology",
        "location": "Bangalore, India",
        "domain": "blockchain",
        "experience_years": 6,
        "skills": ["Solidity", "EVM", "Hardhat", "Foundry", "DeFi", "ERC20", "ERC721", "Web3.js", "Ethers.js"],
        "email": "aditya.oberoi@example.com",
        "phone_number": "+919811100023",
        "linkedin_url": "https://linkedin.com/in/aditya-oberoi-solidity",
    },
    {
        "id": "sbx-blk-02",
        "full_name": "Ritu Bharadwaj",
        "job_title": "Web3 Protocol & Security Auditor",
        "company": "CertiK",
        "location": "Remote, India",
        "domain": "blockchain",
        "experience_years": 7,
        "skills": ["Smart Contract Auditing", "Slither", "Echidna", "Fuzzing", "Solidity", "Reentrancy Protection", "DeFi Security"],
        "email": "ritu.b@example.com",
        "phone_number": "+919811100024",
        "linkedin_url": "https://linkedin.com/in/ritu-bharadwaj-security",
    },
    {
        "id": "sbx-blk-03",
        "full_name": "Nikhil Agarwal",
        "job_title": "Full Stack Web3 Developer",
        "company": "CoinDCX",
        "location": "Mumbai, India",
        "domain": "blockchain",
        "experience_years": 4,
        "skills": ["React", "Next.js", "Wagmi", "Viem", "Solidity", "GraphQL", "The Graph", "Node.js"],
        "email": "nikhil.agarwal@example.com",
        "phone_number": "+919811100025",
        "linkedin_url": "https://linkedin.com/in/nikhil-agarwal-web3",
    },
    {
        "id": "sbx-blk-04",
        "full_name": "Shreya Mukherjee",
        "job_title": "Rust / Solana Core Developer",
        "company": "Anza (Solana Labs)",
        "location": "Remote, Bangalore",
        "domain": "blockchain",
        "experience_years": 5,
        "skills": ["Rust", "Solana", "Anchor Framework", "WebAssembly", "Cryptography", "Distributed Ledger", "P2P"],
        "email": "shreya.m@example.com",
        "phone_number": "+919811100026",
        "linkedin_url": "https://linkedin.com/in/shreya-mukherjee-rust",
    },
    {
        "id": "sbx-blk-05",
        "full_name": "Harshvardhan Jain",
        "job_title": "DeFi Quantitative Strategist",
        "company": "Biconomy",
        "location": "Bangalore, India",
        "domain": "blockchain",
        "experience_years": 5,
        "skills": ["Solidity", "Python", "AMM", "Liquidity Pools", "MEV", "Arbitrage", "Smart Contracts", "On-Chain Analytics"],
        "email": "harsh.jain@example.com",
        "phone_number": "+919811100027",
        "linkedin_url": "https://linkedin.com/in/harsh-jain-defi",
    },

    # -------------------------------------------------------------
    # 6. GLOBAL / US CANDIDATES (Diverse Geo)
    # -------------------------------------------------------------
    {
        "id": "sbx-glo-01",
        "full_name": "David Chen",
        "job_title": "Staff Infrastructure Engineer",
        "company": "Datadog",
        "location": "San Francisco, CA, USA",
        "domain": "software",
        "experience_years": 9,
        "skills": ["Go", "Kubernetes", "Distributed Tracing", "PostgreSQL", "Terraform", "AWS", "Kafka"],
        "email": "david.chen@example.com",
        "phone_number": "+14155552671",
        "linkedin_url": "https://linkedin.com/in/david-chen-staff",
    },
    {
        "id": "sbx-glo-02",
        "full_name": "Elena Rostova",
        "job_title": "Lead AI Research Engineer",
        "company": "Anthropic",
        "location": "San Francisco, CA, USA",
        "domain": "ai",
        "experience_years": 8,
        "skills": ["Python", "PyTorch", "Transformer Architectures", "RLHF", "Interpretability", "Deep Learning"],
        "email": "elena.rostova@example.com",
        "phone_number": "+14155553892",
        "linkedin_url": "https://linkedin.com/in/elena-rostova-ai",
    },
    {
        "id": "sbx-glo-03",
        "full_name": "Marcus Vance",
        "job_title": "Embedded Robotics Engineer",
        "company": "Boston Dynamics",
        "location": "Boston, MA, USA",
        "domain": "hardware",
        "experience_years": 7,
        "skills": ["C++", "ROS2", "Robotics", "Embedded Linux", "Motor Control", "CAN Bus", "RTOS"],
        "email": "marcus.vance@example.com",
        "phone_number": "+16175558102",
        "linkedin_url": "https://linkedin.com/in/marcus-vance-robotics",
    },

    # -------------------------------------------------------------
    # 7. MARKETING & GROWTH
    # -------------------------------------------------------------
    {
        "id": "sbx-mkt-01",
        "full_name": "Sneka Ravi",
        "job_title": "Junior Marketing Associate",
        "company": "Sarvam AI",
        "location": "Bangalore, India",
        "domain": "marketing",
        "experience_years": 2,
        "skills": ["Digital Marketing", "Social Media", "SEO", "MailChimp", "Apollo", "Semrush", "Content Creation", "Lead Generation"],
        "email": "sneka.ravi@example.com",
        "phone_number": "+919811100028",
        "linkedin_url": "https://linkedin.com/in/sneka-ravi-mkt",
    },
    {
        "id": "sbx-mkt-02",
        "full_name": "Divya Krishnan",
        "job_title": "Performance Marketing Specialist",
        "company": "Cult.fit",
        "location": "Bangalore, India",
        "domain": "marketing",
        "experience_years": 4,
        "skills": ["Google Ads", "Meta Ads", "PPC", "ROAS Optimization", "Google Analytics 4", "Campaign Management", "A/B Testing"],
        "email": "divya.k@example.com",
        "phone_number": "+919811100029",
        "linkedin_url": "https://linkedin.com/in/divya-krishnan-growth",
    },
    {
        "id": "sbx-mkt-03",
        "full_name": "Rahul Kapoor",
        "job_title": "Senior SEO & Content Strategist",
        "company": "Zomato",
        "location": "Gurgaon, India",
        "domain": "marketing",
        "experience_years": 5,
        "skills": ["Technical SEO", "Ahrefs", "Semrush", "Keyword Research", "Content Strategy", "Link Building", "Organic Growth"],
        "email": "rahul.kapoor@example.com",
        "phone_number": "+919811100030",
        "linkedin_url": "https://linkedin.com/in/rahul-kapoor-seo",
    },
    {
        "id": "sbx-mkt-04",
        "full_name": "Pooja Chawla",
        "job_title": "Growth Marketing & CRM Lead",
        "company": "CleverTap",
        "location": "Mumbai, India",
        "domain": "marketing",
        "experience_years": 6,
        "skills": ["HubSpot", "Zoho CRM", "MoEngage", "Email Marketing", "User Retention", "Funnel Optimization", "SQL"],
        "email": "pooja.chawla@example.com",
        "phone_number": "+919811100031",
        "linkedin_url": "https://linkedin.com/in/pooja-chawla-crm",
    },
    {
        "id": "sbx-mkt-05",
        "full_name": "Amitava Roy",
        "job_title": "Brand & Social Media Manager",
        "company": "Swiggy",
        "location": "Bangalore, India",
        "domain": "marketing",
        "experience_years": 3,
        "skills": ["Social Media Strategy", "LinkedIn Marketing", "Video Marketing", "Copywriting", "Influencer Outreach", "Canva"],
        "email": "amitava.roy@example.com",
        "phone_number": "+919811100032",
        "linkedin_url": "https://linkedin.com/in/amitava-roy-social",
    },
]

GENERIC_STOPWORDS = {
    "engineer", "developer", "specialist", "lead", "senior", "junior", "associate",
    "intern", "manager", "staff", "principal", "head", "director", "vp", "role",
    "position", "opportunity", "the", "and", "for", "in", "at", "to", "a", "an",
    "of", "with", "experienced", "proficient", "level", "mid", "entry", "practitioner"
}

DOMAIN_KEYWORDS: dict[str, set[str]] = {
    "ai": {"ai", "ml", "machine", "learning", "data", "scientist", "nlp", "vision", "deep", "llm", "rag", "pytorch", "tensorflow", "transformer", "genai", "prompt", "langchain", "langgraph", "agents", "vllm", "huggingface"},
    "software": {"software", "backend", "frontend", "fullstack", "devops", "sre", "web", "api", "react", "golang", "go", "node", "python", "java", "microservices", "kubernetes", "docker", "postgres"},
    "hardware": {"hardware", "embedded", "firmware", "vlsi", "asic", "fpga", "iot", "robotics", "rtos", "verilog", "vhdl", "pcb", "c++", "c", "microcontrollers", "arm"},
    "it": {"cloud", "security", "network", "system", "infrastructure", "devsecops", "soc", "admin", "aws", "azure", "cisco", "cybersecurity", "siem", "splunk"},
    "blockchain": {"blockchain", "web3", "solidity", "smart", "contract", "crypto", "defi", "rust", "solana", "ethereum", "hardhat"},
    "marketing": {"marketing", "seo", "sem", "social", "media", "content", "growth", "campaign", "copywriter", "ppc", "brand", "email", "mailchimp", "semrush", "hubspot", "crm", "retention"},
}


def _tokenize(text: str) -> set[str]:
    """Extract lowercase alphanumeric tokens."""
    return set(re.findall(r"\b[a-zA-Z0-9\+\#\.]+\b", text.lower()))


async def search_sandbox_candidates(
    job_title: str,
    required_skills: Optional[str] = None,
    location: Optional[str] = None,
    target_company: Optional[str] = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Search the sandbox dataset matching role parameters with strict relevance filtering.

    Guarantees:
    - NO random fetches: candidates must match the role title keywords or required skills.
    - Domain alignment: detects role domain (AI, Marketing, Software, etc.) and prioritizes matching candidates.
    - Discards irrelevant candidates rather than padding the result set.
    """
    raw_title_tokens = _tokenize(job_title or "")
    core_title_tokens = raw_title_tokens - GENERIC_STOPWORDS
    skills_tokens = _tokenize(required_skills or "")
    loc_tokens = _tokenize(location or "")
    comp_tokens = _tokenize(target_company or "")

    # Detect target role domain(s)
    role_domains: set[str] = set()
    all_query_tokens = core_title_tokens.union(skills_tokens)
    for domain, kws in DOMAIN_KEYWORDS.items():
        if all_query_tokens.intersection(kws):
            role_domains.add(domain)

    scored: list[tuple[float, dict[str, Any]]] = []

    for c in SANDBOX_CANDIDATES:
        c_raw_title = _tokenize(c["job_title"])
        c_core_title = c_raw_title - GENERIC_STOPWORDS
        c_skills = _tokenize(" ".join(c["skills"]))
        c_loc = _tokenize(c["location"])
        c_comp = _tokenize(c["company"])
        c_domain = c.get("domain", "")

        title_matches = core_title_tokens.intersection(c_core_title)
        skill_matches = skills_tokens.intersection(c_skills)

        # STRICT GATE: Must have either a non-generic title match or a direct skill match
        if not title_matches and not skill_matches:
            # If candidate domain strongly matches detected domain, check if raw title matches
            domain_match = c_domain in role_domains
            raw_title_matches = raw_title_tokens.intersection(c_raw_title) - {"the", "and", "for", "in", "at", "to", "a", "an"}
            if not (domain_match and raw_title_matches):
                continue

        score = 0.0

        # Core title keyword matches (heavily weighted)
        score += len(title_matches) * 10.0

        # Required / preferred skill matches (heavily weighted)
        score += len(skill_matches) * 6.0

        # Domain alignment
        if role_domains:
            if c_domain in role_domains:
                score += 8.0
            elif not skill_matches and len(title_matches) < 2:
                # Disqualify cross-domain candidates with no direct skill overlap
                continue

        # Location affinity
        if loc_tokens:
            loc_matches = loc_tokens.intersection(c_loc)
            score += len(loc_matches) * 2.0

        # Company affinity
        if comp_tokens:
            comp_matches = comp_tokens.intersection(c_comp)
            score += len(comp_matches) * 4.0

        # Require a minimum score threshold of 6.0 to prevent loose/random matches
        if score >= 6.0:
            scored.append((score, c))

    # Sort descending by match score
    scored.sort(key=lambda item: item[0], reverse=True)

    results = []
    for _, c in scored[:limit]:
        results.append({
            "full_name": c["full_name"],
            "job_title": c["job_title"],
            "company": c["company"],
            "location": c["location"],
            "email": c["email"],
            "phone_number": c["phone_number"],
            "linkedin_url": c["linkedin_url"],
            "source_provider": "sandbox",
            "raw_data": c,
        })

    return results

