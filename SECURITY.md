# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Vortex, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainers or use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) feature on this repository.

Include the following in your report:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix or mitigation**: Depends on severity, but we aim for critical fixes within 2 weeks

## Security Measures in Vortex

- **API key encryption**: User API keys are encrypted at rest using AES-256-GCM
- **Authentication**: Server-side session validation on all protected routes via Supabase Auth
- **Row Level Security**: All database tables enforce per-user data isolation at the PostgreSQL level
- **Input validation**: File type/size checks, URL validation with SSRF protection, input length limits
- **Error sanitization**: API error responses never expose internal error details to clients
- **Rate limiting**: All API endpoints are rate-limited to prevent abuse

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |
