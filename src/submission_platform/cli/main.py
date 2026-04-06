from __future__ import annotations

import asyncio

import typer
from rich.console import Console
from rich.table import Table

from submission_platform.config import get_settings
from submission_platform.domain import email_service, extraction, gmail_push, submissions
from submission_platform.domain.models import SubmissionStatus
from submission_platform.infra.json_store import get_default_store

app = typer.Typer(name="submission", help="Insurance submission platform CLI")
console = Console()


@app.command()
def create(
    broker_email: str = typer.Option(..., help="Broker's email address"),
    subject: str = typer.Option(..., help="Email subject"),
    body: str = typer.Option(..., help="Email body text"),
    broker_name: str | None = typer.Option(None, help="Broker's name"),
):
    """Create a new submission."""
    store = get_default_store()
    result = asyncio.run(
        submissions.create_submission(
            broker_email=broker_email,
            subject=subject,
            body_text=body,
            broker_name=broker_name,
            store=store,
        )
    )
    console.print(f"[green]Created submission {result.id}[/green]")
    console.print(f"  Status: {result.status.value}")
    console.print(f"  Broker: {result.broker_email}")


@app.command("list")
def list_cmd(
    status: str | None = typer.Option(None, help="Filter by status"),
):
    """List submissions."""
    store = get_default_store()
    status_enum = SubmissionStatus(status) if status else None
    items = asyncio.run(submissions.list_submissions(store=store, status=status_enum))

    if not items:
        console.print("[yellow]No submissions found.[/yellow]")
        return

    table = Table(title="Submissions")
    table.add_column("ID", style="cyan", max_width=8)
    table.add_column("Status", style="green")
    table.add_column("Broker")
    table.add_column("Subject")
    table.add_column("Created")
    for s in items:
        table.add_row(
            s.id[:8],
            s.status.value,
            s.broker_email,
            s.subject[:40],
            s.created_at.strftime("%Y-%m-%d %H:%M"),
        )
    console.print(table)


@app.command()
def get(
    submission_id: str = typer.Argument(help="Submission ID"),
):
    """Get details of a submission."""
    store = get_default_store()
    sub = asyncio.run(submissions.get_submission(submission_id, store=store))
    if sub is None:
        console.print(f"[red]Submission {submission_id} not found[/red]")
        raise typer.Exit(1)
    console.print(sub.model_dump_json(indent=2))


@app.command()
def transition(
    submission_id: str = typer.Argument(help="Submission ID"),
    new_status: str = typer.Argument(help="New status"),
):
    """Transition a submission to a new status."""
    store = get_default_store()
    try:
        result = asyncio.run(
            submissions.transition_submission(
                submission_id, SubmissionStatus(new_status), store=store
            )
        )
        console.print(f"[green]Transitioned to {result.status.value}[/green]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


@app.command("send-email")
def send_email_cmd(
    to: str = typer.Option(..., help="Recipient email"),
    subject: str = typer.Option(..., help="Email subject"),
    body: str = typer.Option(..., help="Email body"),
):
    """Send an email through the SMTP relay."""
    settings = get_settings()
    ok = asyncio.run(
        email_service.send_email(to=to, subject=subject, body=body, settings=settings)
    )
    if ok:
        console.print("[green]Email sent successfully.[/green]")
    else:
        console.print("[red]Failed to send email.[/red]")
        raise typer.Exit(1)


@app.command()
def extract(
    submission_id: str = typer.Argument(help="Submission ID to extract data from"),
):
    """Run extraction on a submission."""
    store = get_default_store()
    settings = get_settings()
    try:
        result = asyncio.run(
            extraction.extract_submission_data(
                submission_id, store=store, settings=settings
            )
        )
        console.print(result.model_dump_json(indent=2))
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


# --- Gmail commands ---


@app.command("gmail-auth")
def gmail_auth_cmd():
    """Run one-time OAuth2 consent flow for Gmail API.

    Opens a browser to authorize access, then prints the refresh token
    to paste into .env as GOOGLE_REFRESH_TOKEN.
    """
    from submission_platform.domain.gmail_oauth import run_consent

    run_consent()


@app.command("gmail-watch")
def gmail_watch_cmd():
    """Register or renew Gmail push notification watch."""
    store = get_default_store()
    settings = get_settings()
    state = asyncio.run(gmail_push.setup_watch(store=store, settings=settings))
    console.print(f"[green]Watch registered.[/green]")
    console.print(f"  historyId: {state.history_id}")
    console.print(f"  Expiration: {state.watch_expiration}")


@app.command("gmail-sync")
def gmail_sync_cmd():
    """Run incremental Gmail sync (history.list) once."""
    store = get_default_store()
    settings = get_settings()
    ids = asyncio.run(gmail_push.process_history(store=store, settings=settings))
    if ids:
        console.print(f"[green]Processed {len(ids)} email(s):[/green]")
        for sid in ids:
            console.print(f"  - {sid[:8]}")
    else:
        console.print("[yellow]No new emails found.[/yellow]")


@app.command("gmail-reconciler")
def gmail_reconciler_cmd(
    interval: int | None = typer.Option(None, help="Override reconciler interval in seconds"),
):
    """Run the Gmail reconciler loop (safety-net polling via history.list)."""
    store = get_default_store()
    settings = get_settings()

    if interval is not None:
        settings.gmail_reconciler_interval_seconds = interval

    console.print(
        f"[cyan]Reconciler running every {settings.gmail_reconciler_interval_seconds}s "
        f"(Ctrl+C to stop)[/cyan]"
    )

    async def _loop():
        while True:
            ids = await gmail_push.process_history(store=store, settings=settings)
            if ids:
                console.print(f"[green]Reconciler found {len(ids)} new email(s)[/green]")
            await asyncio.sleep(settings.gmail_reconciler_interval_seconds)

    try:
        asyncio.run(_loop())
    except KeyboardInterrupt:
        console.print("\n[yellow]Reconciler stopped.[/yellow]")


# --- Server commands ---


@app.command("api")
def api_cmd():
    """Start the FastAPI server."""
    from submission_platform.api.app import run

    run()


@app.command("smtp")
def smtp_cmd():
    """Start the inbound SMTP server."""
    from submission_platform.email_gateway.smtp_handler import run

    run()


if __name__ == "__main__":
    app()
