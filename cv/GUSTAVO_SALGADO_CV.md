# Gustavo Salgado

**Full Stack Engineer & AI Product Manager**

Medellin, Colombia | Remote-first | English C2 / Spanish Native

gsalgadotoledo@gmail.com | [LinkedIn](https://www.linkedin.com/in/gustavo-salgado-javascript-developer/) | [GitHub](https://github.com/gsalgadotoledo)

---

## Summary

Full Stack Engineer turned AI Product Manager with 10+ years shipping production web applications. Currently building agentic AI systems at Revelar Technologies (Tricura Insurance Group) — designing LLM-driven pipelines that autonomously read emails, extract data from PDFs, and automate processing workflows. I sit at the intersection of product strategy and hands-on technical execution: I can spec a feature, architect the system, and ship the code.

---

## Experience

### Full Stack Engineer & Product Manager — AI & Automation
**Revelar Technologies (Tricura Insurance Group)** | Dec 2025 – Present | Remote

- Owned the product vision and full-stack implementation of Agents Extractor, an AI-powered submission processing platform that replaced manual data entry with autonomous LLM agents, cutting processing time from hours to seconds.
- Architected a LangGraph ReAct agent with a multi-pass tool-use loop (read → extract → validate → self-correct) achieving 85–95% extraction accuracy across 30+ structured fields from insurance PDF applications.
- Delivered end-to-end: FastAPI backend with a 12-state deterministic workflow engine, React 19 admin dashboard and client portal, Gmail API integration via Pub/Sub for real-time email ingestion.
- Implemented LLM-based email deduplication using Claude to distinguish follow-up emails from new submissions, reducing duplicate processing by ~40%.
- Built a persona system for AI-generated broker email responses and integrated Slack SDK for real-time team notifications on submission status changes.
- Designed infrastructure as code with Terraform (ECS Fargate, ALB, ECR, VPC, IAM) for one-command production deployment on AWS.
- Created 12 realistic test scenarios covering edge cases: multi-language, contradictory data, multi-entity, and bare-minimum submissions.

### Senior Full Stack Developer
**Freelance / Contract (Multiple Clients)** | 2015 – 2025 | Remote

- Delivered 20+ production web applications for clients across LATAM and the US spanning fintech, e-commerce, education, and SaaS verticals.
- Frontend architecture: React, TypeScript, Next.js, Vue.js — built responsive SPAs, reusable component libraries, and design systems with Core Web Vitals optimization.
- Backend development: Python/FastAPI, Node.js/Express, REST APIs, GraphQL — designed scalable architectures with PostgreSQL, Redis, and message queues.
- DevOps and cloud: AWS (EC2, S3, Lambda, CloudFront), Docker, CI/CD pipelines with GitHub Actions, automated testing suites (Jest, Pytest, Cypress).
- Led development teams of 3–5 engineers, managing sprint planning, code reviews, architectural decisions, and technical mentorship for junior developers.
- Established testing culture across projects: unit tests, integration tests, and E2E coverage resulting in zero critical production incidents over multiple engagements.

### Technical Instructor
**Corp. Educativa Alexander von Humboldt** | Teaching Experience | Colombia

- Taught web development and programming fundamentals to 100+ students, covering JavaScript, React, and modern software engineering practices.
- Created hands-on curriculum with real-world projects, enabling students to build and deploy production-quality web applications by course completion.

---

## Featured Project

### [Agents Extractor](https://github.com/gsalgadotoledo/agents-extractor)

AI-powered insurance submission platform with agentic extraction.

**Stack:** Python 3.13 · FastAPI · LangGraph · Claude Sonnet 4 · React 19 · TypeScript · Gmail API · Slack SDK

- ReAct agent with tool-use loop: reads email + PDFs, fetches schema, extracts 30+ fields, self-corrects on validation errors
- Multi-entry ingestion: Gmail Pub/Sub for production, SMTP for local dev, REST API for testing
- 12-state deterministic workflow engine — business rules are code, not LLM prompts
- Terraform IaC: ECS Fargate, ALB, ECR, CloudWatch, IAM with least-privilege

---

## Skills

**Product:** Product strategy · Roadmapping · User research · Agile/Scrum · Technical specs · Stakeholder management

**AI/ML:** LangGraph · LangChain · Prompt engineering · ReAct agents · Tool-use patterns · Claude API · OpenAI API

**Backend:** Python · FastAPI · Node.js · TypeScript · Express · REST APIs · GraphQL

**Frontend:** React 19 · TypeScript · Next.js · Vite · Tailwind CSS

**Infrastructure:** AWS (ECS, EC2, S3, Lambda) · Terraform · Docker · Git · CI/CD · Gmail API · Slack SDK

---

## Education

**Corp. Educativa Alexander von Humboldt** — Colombia | Software Development

## Languages

- **English** — C2 (Full Professional Proficiency)
- **Spanish** — Native
