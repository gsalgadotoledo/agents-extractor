# scripts/

Utility scripts for generating test data.

## Files

| Script | Purpose |
|--------|---------|
| `generate_test_pdfs.py` | Generates basic insurance application PDFs for the 12 test scenarios |
| `generate_advanced_test_pdfs.py` | Generates more complex PDFs with multi-page layouts, tables, and edge cases |

## Usage

```bash
# Generate basic test PDFs
uv run python scripts/generate_test_pdfs.py

# Generate advanced test PDFs
uv run python scripts/generate_advanced_test_pdfs.py
```

Output goes to `test-files/` and `tests/fixtures/attachments/`.
