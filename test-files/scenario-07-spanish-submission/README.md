# Scenario 7: Spanish Language Submission

**Expected route: AUTO POLICY** (no loss runs, new business)

## Email

**Subject:**
```
Solicitud de Seguro: Clinica Dental Sonrisa Brillante - Responsabilidad General
```

**Body:**
```
Buenos dias,

Adjunto la solicitud de seguro de responsabilidad general para
Clinica Dental Sonrisa Brillante.

Es un negocio nuevo, sin historial de reclamaciones.
Necesitamos cobertura de $1M/$2M con fecha efectiva 05/15/2026.

Gracias,
Ana Lucia Fernandez
Seguros del Valle Insurance Agency
afernandez@segurodelvalle.com
(956) 555-0187
```

## Attachments

1. `09_spanish_submission.pdf` -- GL application entirely in Spanish

## Expected extracted data

| Field | Value |
|-------|-------|
| Insured Name | Clinica Dental Sonrisa Brillante LLC |
| Address | 1420 Calle del Rio, Suite 4, Laredo, TX 78040 |
| Contact | Dr. Carlos Mendoza |
| Broker | Ana Lucia Fernandez, Seguros del Valle Insurance Agency |
| Broker Email | afernandez@segurodelvalle.com |
| Coverage Type | Commercial General Liability (Responsabilidad General) |
| Effective Date | 05/15/2026 |
| Each Occurrence Limit | $1,000,000 |
| General Aggregate | $2,000,000 |
| Employees | 8 |
| Annual Revenue | $650,000 |
| Loss Runs Present | No (new business) |
| Prior Insurance | None |
| Language | Spanish |

## Edge cases to test

- Entire PDF application is in Spanish -- extraction agent must handle non-English content
- Email body is also in Spanish
- Medical/dental operations have specific risk considerations
- Dual-language terms (e.g., "Responsabilidad General" = "General Liability")
- Street address uses Spanish naming convention ("Calle del Rio")
- System should still extract all standard fields regardless of language
- Coverage types and limits should be normalized to English equivalents in output
- Dental clinic may trigger professional liability considerations even if not explicitly requested
