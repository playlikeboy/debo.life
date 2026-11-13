# Debo Office Workbench: Future Product and Integration Roadmap

> **Status:** Future plan / architecture proposal  
> **Scope:** Office workspace, document intelligence, spreadsheets, presentations, data analysis, background office execution, connected cloud office, review and delivery  
> **Product:** Debo — the personal AI operating system  
> **Repository:** [playlikeboy/debo.life](https://github.com/playlikeboy/debo.life)  
> **Last reviewed:** 14 November 2026

---

## 1. Executive summary

Debo should grow beyond a conversational assistant into a personal AI workspace that can create, inspect, edit, analyze, organize and deliver professional office work in the background.

The central idea is to give Debo an actual office environment, rather than making it generate files in an isolated chat response. A user should be able to ask Debo to prepare a research report, spreadsheet, presentation, PDF packet, project tracker or business dashboard; Debo should carry out the work in a durable background task, preserve the source files, validate the result, and present a reviewable artifact.

The strongest starting point is the **Univer ecosystem**, especially:

- [Univer](https://github.com/dream-num/univer): embeddable Office SDK and document editing foundation.
- [Univer Workspace](https://github.com/dream-num/univer-workspace): a deployable Office workspace for people and agents.
- [Univer CLI](https://github.com/dream-num/univer-cli): agent-oriented creation, editing, inspection, rendering and review of office files.

These projects should be evaluated as a connected product ecosystem, not as three unrelated dependencies.

Debo should remain the primary assistant, identity provider, memory system, task orchestrator and permission authority. Univer should provide the office workspace and artifact capabilities that Debo operates.

The desired user experience is:

1. Ask Debo for an outcome through chat or voice.
2. Debo creates a plan and identifies the required files, tools and permissions.
3. A durable background job performs the work.
4. The user can inspect progress and open the actual working artifacts.
5. Debo validates the output and reports problems or uncertainty.
6. The user reviews a diff or preview and approves delivery.
7. Final files are saved in the user's Debo workspace and can be exported or shared.

**This document describes future work. It does not claim that these integrations are already implemented, configured, licensed for every feature, or deployed in Debo.**

---

## 2. Product vision

### 2.1 Debo as an AI-operated office

Build a unified office workbench with:

- Documents and rich-text reports.
- Spreadsheets and financial models.
- Presentations and slide decks.
- Relational tables and lightweight databases.
- Whiteboards, diagrams and project boards.
- PDF viewing and processing.
- CSV and large-data analysis.
- Connected Google and Microsoft office files.
- AI-assisted editing and document conversations.
- Background agent workspaces.
- Review, versioning and delivery.

The office should feel like a natural part of Debo, not an externally embedded tool with a separate identity.

### 2.2 Product roles

Keep clear boundaries between three layers:

| Layer | Responsibility |
|---|---|
| **Debo Agent** | Understands the request, uses personal context, plans tasks, chooses tools, manages permissions and communicates with the user. |
| **Office Workspace** | Owns office documents, files, versions, collaboration, editing, rendering and review. |
| **Processing Workers** | Parse files, run conversions, analyze data, generate artifacts and execute bounded background operations. |

Debo is the agent that operates the office. The Office Workspace is the place where people and agents work on the same artifacts.

### 2.3 Product principles

1. Artifacts must be real, editable and exportable.
2. Background work must survive page refreshes and worker restarts.
3. Users must be able to inspect what the agent changed.
4. Existing files must never be silently overwritten.
5. The original source and generated result must remain distinguishable.
6. Important external actions require explicit approval.
7. Office tools must use the same user identity and permissions as Debo.
8. Every integration must have an owner, a clear purpose and a documented failure mode.
9. Accessibility and mobile usability are product requirements.
10. Do not add frameworks merely to increase the dependency count.

---

## 3. Primary foundation: the Univer ecosystem

### 3.1 Univer Office SDK

Repository: [dream-num/univer](https://github.com/dream-num/univer)  
Documentation: [docs.univer.ai](https://docs.univer.ai/)  
Website: [univer.ai](https://univer.ai/)

Univer is an Office SDK for building office applications inside an existing product. Its open-source web foundation includes content models, editing and rendering, formula calculation, plugins, commands and Facade APIs. It supports Sheets and Docs capabilities and is designed to be composed into an application.

The wider product family covers spreadsheets, documents, presentations, relational tables, canvases and PDFs, but **not every capability shown in demos is necessarily included in the open-source package set**.

Potential Debo uses:

- Embed spreadsheet editing inside Debo.
- Embed rich document editing.
- Provide an extensible office plugin system.
- Read and update workbook/document models programmatically.
- Reuse content models and rendering for headless processing where supported.
- Preserve native office structure rather than reducing everything to plain text.
- Create consistent editing and preview experiences.

Important: the upstream README describes the open-source core and separately licensed commercial extensions. Verify the exact packages, plugins, Server SDK and AI SDK capabilities before implementation. Do not assume a demo feature is available under Apache-2.0 merely because the repository contains an Apache-2.0 LICENSE.

### 3.2 Univer Workspace

Repository: [dream-num/univer-workspace](https://github.com/dream-num/univer-workspace)  
Workspace documentation: [Univer documentation](https://docs.univer.ai/)  
Workspace MCP guide: [apps/mcp/README.md](https://github.com/dream-num/univer-workspace/blob/main/apps/mcp/README.md)  
Workspace Agent guide: [apps/agent/README.md](https://github.com/dream-num/univer-workspace/blob/main/apps/agent/README.md)

This is the highest-priority project to evaluate after the base SDK.

Univer Workspace describes itself as an Office workspace where people and AI agents create, collaborate and review together. It provides a deployable workspace around Univer capabilities.

Its documented concepts include:

- Personal and team Spaces.
- Files and folders.
- Sheets, Docs, Slides, Bases and Boards.
- Collaboration and access controls.
- Recent items and Trash.
- Import and export.
- Agent conversations around documents.
- Agent-created changes in isolated Worktrees.
- Review and comparison before merging changes.
- Browser, CLI and MCP entry points.
- A Workspace Server that owns documents and permissions.

Why it matters to Debo:

- It provides an office environment instead of isolated document-generation scripts.
- It has an agent-oriented review model.
- It separates the human editing surface from agent execution.
- Its Worktree approach can prevent an agent from silently changing the main document.
- Its CLI and MCP interfaces make integration with Debo more practical.

**Preferred integration direction:** use the Workspace Server and office capabilities as a service or deeply adapt the workspace into Debo. Keep Debo's own agent, authentication, memory, conversations and permission authority. Do not make two independent assistants compete for the user's attention.

### 3.3 Univer CLI

Repository: [dream-num/univer-cli](https://github.com/dream-num/univer-cli)

Univer CLI is particularly valuable for background office operations.

The documented capabilities include:

| Content type | Agent operations |
|---|---|
| Sheet | Create and edit workbooks, formulas, styles, tables, charts, pivots, filters, validation, images and ranges. |
| Doc | Create and edit rich text, paragraphs, lists, tables, images, charts, headers, footers and page layouts. |
| Slide | Create and edit pages, text, shapes, images, tables, charts and transitions. |
| Base | Create tables, fields, records, views, formulas, filters, sorting and grouping. |
| Board | Create shapes, text, connectors, images, native charts and diagrams. |
| Cross-content | Compose multiple content types in one Univer file and connect content across Units. |

The documented workflow is valuable:

1. Discover the required capability and skill.
2. Create or import a Univer file.
3. Open an isolated draft Worktree.
4. Inspect the existing Unit.
5. Perform edits through the supported Univer Facade.
6. Read the stored model back.
7. Capture screenshots, render PDFs or run layout lint where appropriate.
8. Mark the Worktree ready.
9. Return a Viewer URL for human review.
10. Merge, reopen or discard after the user reviews it.

Potential Debo uses:

- Generate a complete report in the background.
- Edit a selected part of an existing spreadsheet.
- Convert research into a slide deck.
- Create a Base for CRM or project tracking.
- Build a multi-unit office deliverable.
- Verify formulas and structure.
- Detect slide overflow and visual layout problems.
- Return a reviewable draft instead of overwriting the original.

**Runtime and safety note:** the CLI README documents Node.js 24 or later and describes its execute capability as trusted JavaScript, not a sandbox for untrusted code. Do not run arbitrary user-provided or model-generated code on the main Debo server. Run the CLI in a dedicated, isolated worker with bounded permissions.

### 3.4 Workspace integration decision

Evaluate three realistic paths:

**Option A — Deploy Univer Workspace as a separate internal service**

- Debo stays the main application.
- The Workspace service owns office documents and its native editing experience.
- Debo authenticates users and obtains appropriately scoped Workspace access.
- Debo launches office tasks through its backend or MCP interface.
- Users open Workspace artifacts from Debo.

Advantages: strong separation and less invasive changes to the main app.

Risks: multiple services, cross-service identity, authorization synchronization and UI integration.

**Option B — Integrate Workspace UI into Debo**

- Reuse or adapt the workspace browser/editor experience.
- Preserve Debo's navigation and global design system.
- Share Debo identity and permissions.
- Keep the workspace's document model and review logic.

Advantages: more coherent user experience.

Risks: deeper maintenance burden, upstream changes and package/license compatibility.

**Option C — Use Univer SDK directly**

- Build Debo's own office workspace using SDK components.
- Implement Debo-native file management, sharing, collaboration and review.

Advantages: maximum product control.

Risks: much more engineering work and possible dependence on commercial capabilities for full parity.

**Recommendation:** begin with a technical spike comparing Options A and B, while validating the open-source capability boundary. Prefer Workspace as the initial functional foundation. Do not recreate the entire office backend until the spike demonstrates a compelling reason.

---

## 4. Office processing and document intelligence

The interactive office suite is only one part of the experience. Debo also needs robust processing workers that can understand incoming files and produce new artifacts.

### 4.1 Docling — document understanding

Repository: [docling-project/docling](https://github.com/docling-project/docling)  
Documentation: [Docling documentation](https://docling-project.github.io/docling/)

Docling is a high-priority candidate for document ingestion and extraction.

Its documented support includes:

- PDF.
- DOCX and PPTX.
- XLSX.
- HTML and EPUB.
- Images.
- WAV and MP3.
- WebVTT.
- EML and MSG.
- iCalendar files.
- Plain text and Markdown.
- Additional structured formats.

Document understanding capabilities include:

- Page layout.
- Reading order.
- Table structure.
- OCR.
- Formulas and code.
- Structured document representation.
- Markdown, HTML and JSON exports.
- Local processing options.
- MCP and API-server integration paths.

Potential Debo workflows:

- Ingest a folder of documents.
- Extract structured information from scanned PDFs.
- Convert a report into evidence-backed Markdown.
- Extract financial tables and export them to a spreadsheet.
- Index documents while preserving page references.
- Process emails or calendar export files.
- Produce transcripts or structured summaries from audio.

Integration notes:

- Run Docling as a dedicated Python service or worker.
- Avoid putting Python document processing inside the edge/web request runtime.
- Preserve the original file and parser metadata.
- Keep page-level and table-level provenance.
- Treat parser output as untrusted content.
- Evaluate CPU, RAM, model downloads and latency before choosing hosted deployment.

The repository is MIT-licensed, but individual model licenses and downloaded model terms must still be checked.

### 4.2 Stirling-PDF — PDF operations

Repository: [Stirling-Tools/Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF)

Evaluate as a self-hosted PDF processing service.

Potential operations:

- Merge and split.
- Compress.
- Convert.
- Extract or rearrange pages.
- OCR.
- Add or remove PDF metadata.
- Redact.
- Rotate.
- Repair.
- Compare.
- Apply supported signing and security operations.

Debo should expose common PDF actions in the Office Workbench and route them to the service.

Safety requirements:

- Keep source documents unchanged by default.
- Generate a new output artifact.
- Use explicit destructive-action confirmation.
- Do not treat a visual signature image as a legally valid digital signature.
- Verify the exact license and feature availability for the selected deployment.

### 4.3 LibreOffice — headless Office conversion

Website: [libreoffice.org](https://www.libreoffice.org/)  
Source: [LibreOffice core](https://github.com/LibreOffice/core)

Evaluate LibreOffice as a worker utility rather than the primary embedded editor.

Potential uses:

- Headless DOCX to PDF conversion.
- XLSX to PDF conversion.
- PPTX to PDF conversion.
- Compatibility checks.
- Preview generation.
- Batch format conversion.

Run it in a constrained worker/container. It must not be exposed as an unrestricted network service.

### 4.4 Other document libraries

Evaluate as narrowly scoped utilities:

- [PptxGenJS](https://github.com/gitbrent/PptxGenJS): programmatic PowerPoint generation in JavaScript/TypeScript.
- [ExcelJS](https://github.com/exceljs/exceljs): XLSX workbook creation and manipulation.
- [docx](https://github.com/dolanmiu/docx): programmatic DOCX generation.
- [pdf-lib](https://github.com/Hopding/pdf-lib): PDF creation and manipulation in JavaScript.

These can fill gaps where Univer import/export or a particular office workflow does not provide the required behavior.

Do not create multiple competing generators for the same file type without a measured requirement.

---

## 5. Data analysis and business intelligence

Debo should be able to turn raw data into useful analysis, not merely summarize CSV text.

### 5.1 DuckDB

Repository: [duckdb/duckdb](https://github.com/duckdb/duckdb)  
Documentation: [duckdb.org/docs](https://duckdb.org/docs/)

Candidate for analytical queries over CSV, Parquet and other supported data sources.

Potential uses:

- Analyze large CSV datasets.
- Join multiple data files.
- Aggregate and group data.
- Generate report tables.
- Validate imported records.
- Create data summaries for Sheets and dashboards.

Run queries in a bounded environment. Never expose unrestricted filesystem or network access to model-generated SQL.

### 5.2 Polars

Repository: [pola-rs/polars](https://github.com/pola-rs/polars)  
Documentation: [docs.pola.rs](https://docs.pola.rs/)

High-performance DataFrame library for data cleaning and transformation.

Potential uses:

- Clean inconsistent columns.
- Normalize values.
- Process large tabular datasets.
- Run data quality checks.
- Build reproducible transformation pipelines.
- Export clean XLSX, CSV or Parquet data.

Choose DuckDB, Polars or both based on actual workload. Avoid adding both to every worker by default.

### 5.3 Jupyter

Repository: [jupyter/notebook](https://github.com/jupyter/notebook)  
Website: [jupyter.org](https://jupyter.org/)

Evaluate a restricted notebook environment for advanced analytical work.

Potential uses:

- Statistical analysis.
- Research notebooks.
- Reproducible Python workflows.
- Visualizations.
- Data exploration.
- Educational analysis.

Notebooks must run in isolated environments with quotas and limited secrets. A saved notebook is an executable artifact, not automatically trusted code.

---

## 6. Visual office alternatives and compatibility

Univer should be the first candidate, but Debo should compare alternatives when a required capability is unavailable.

### 6.1 ONLYOFFICE DocumentServer

Repository: [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer)  
Website: [onlyoffice.com](https://www.onlyoffice.com/)

Evaluate for embedded document, spreadsheet and presentation editing with strong Microsoft Office compatibility expectations.

Questions to investigate:

- Embedding/API integration.
- Supported formats and fidelity.
- Collaboration.
- File storage model.
- Licensing for the intended hosted/SaaS deployment.
- Branding and customization rights.
- Deployment and scaling requirements.
- Mobile behavior.

Do not assume the open-source server license automatically covers every commercial use case or additional edition.

### 6.2 Collabora Online

Repository: [CollaboraOnline/online](https://github.com/CollaboraOnline/online)  
Website: [collaboraonline.com](https://www.collaboraonline.com/)

Evaluate as another online Office editing option.

Compare:

- Supported formats.
- Integration protocol.
- Collaboration.
- Self-hosting.
- Resource needs.
- SaaS redistribution and licensing.
- User experience.
- Maintenance burden.

Do not integrate both ONLYOFFICE and Collabora unless a real compatibility or customer requirement justifies maintaining two office engines.

---

## 7. Cloud office integrations

Debo should support both native Debo artifacts and authorized files that already exist in cloud office accounts.

### 7.1 Google Workspace APIs

Developer documentation: [Google Workspace APIs](https://developers.google.com/workspace)

Relevant APIs:

- [Google Drive API](https://developers.google.com/drive/api/guides/about-sdk)
- [Google Docs API](https://developers.google.com/docs/api)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Google Slides API](https://developers.google.com/slides/api)

Potential capabilities:

**Drive**
- List authorized files.
- Search within the granted scope.
- Read metadata.
- Download supported content.
- Create folders and files.
- Upload generated deliverables.
- Manage supported permissions with explicit approval.

**Docs**
- Create documents.
- Insert and update content.
- Apply formatting.
- Manage supported document elements.
- Read back changes.

**Sheets**
- Read and write ranges.
- Create sheets.
- Update formatting.
- Add formulas and charts where supported.
- Analyze structured workbook data.

**Slides**
- Create presentations.
- Add and modify slides.
- Insert text, shapes, images and supported charts.
- Export or share the result through authorized Drive operations.

Use Composio where its connector coverage and scopes are sufficient. Use custom API adapters only when necessary.

### 7.2 Microsoft Graph

Documentation: [Microsoft Graph](https://learn.microsoft.com/graph/)  
JavaScript SDK: [microsoftgraph/msgraph-sdk-javascript](https://github.com/microsoftgraph/msgraph-sdk-javascript)

Evaluate integration with:

- OneDrive.
- SharePoint.
- Excel workbooks.
- Word documents.
- PowerPoint files.
- Outlook.
- Teams.

The Excel API can work with supported workbook ranges, tables and charts stored in OneDrive or SharePoint.

Use delegated, least-privilege scopes. Keep file access and write access separate.

### 7.3 Connector strategy

A connected service does not grant every agent unrestricted access.

Each connector must expose:

- Connected account.
- Granted scopes.
- Read capabilities.
- Write capabilities.
- Last successful sync.
- Sync status.
- Pause and disconnect controls.
- Imported source records.
- Data deletion behavior.

Start read-only where possible. Add write capabilities with specific, action-level approvals.

---

## 8. Background automation and durable work

The office experience should be backed by a task engine that can run for longer than a single chat response.

### 8.1 Existing Debo/OpenMuse task foundation

Use the primary Debo agent and task architecture being developed around OpenMuse as the central orchestration layer.

Do not embed another independent assistant runtime inside the office workspace.

The office service should expose capabilities and durable artifacts to Debo. Debo should own:

- User identity.
- Agent conversations.
- Personal memory.
- Task ownership.
- Autonomy settings.
- Permission decisions.
- Approval records.
- User-visible progress.
- Usage and cost accounting.

### 8.2 Inngest

Repository: [inngest/inngest](https://github.com/inngest/inngest)  
Documentation: [inngest.com/docs](https://www.inngest.com/docs)

Debo previously included Inngest dependencies. Check the current implementation before adding anything.

Potential uses:

- Document ingestion.
- OCR and transcription.
- Office conversion.
- Large-data processing.
- Cloud connector synchronization.
- Scheduled reports.
- Reprocessing.
- Notifications.
- Recurring tasks.

Use idempotency keys, bounded retries and persistent job status.

### 8.3 Temporal

Repository: [temporalio/temporal](https://github.com/temporalio/temporal)  
Documentation: [docs.temporal.io](https://docs.temporal.io/)

Evaluate when tasks require durable execution across very long periods, extensive retries, compensation and workflow recovery.

Do not add Temporal automatically. Compare it with the current Debo/OpenMuse task architecture and Inngest. There must be one clearly defined source of truth for each kind of task state.

### 8.4 Activepieces

Repository: [activepieces/activepieces](https://github.com/activepieces/activepieces)  
Website: [activepieces.com](https://www.activepieces.com/)

Evaluate as an optional visual automation builder for user-defined workflows.

Potential uses:

- When a new file arrives, process it and notify the user.
- Every Monday, create a weekly report.
- When a task completes, upload the result to an authorized folder.
- Synchronize selected records between services.
- Generate reports from scheduled data sources.

Do not allow visual automations to bypass Debo's permissions, task ledger or audit events.

Review open-source and commercial feature boundaries before embedding or redistributing its builder.

---

## 9. Browser and computer work

### 9.1 Playwright

Repository: [microsoft/playwright](https://github.com/microsoft/playwright)  
Documentation: [playwright.dev](https://playwright.dev/)

Use for a self-hosted browser worker that can:

- Open authorized websites.
- Read and navigate pages.
- Fill forms.
- Download files.
- Capture screenshots.
- Inspect output.
- Automate browser-only office tasks.

Keep the browser worker separate from the main web/edge runtime.

### 9.2 Stagehand

Repository: [browserbase/stagehand](https://github.com/browserbase/stagehand)

Evaluate as a higher-level browser interaction and extraction layer where it improves reliability.

It should complement the existing OpenMuse/Playwright architecture, not create a second unrelated browser service.

### 9.3 Computer sandbox

For any office task requiring shell or scripts:

- Use isolated containers or VMs.
- Use non-root execution.
- Limit filesystem mounts.
- Avoid inherited cloud credentials.
- Limit network destinations.
- Set CPU, memory and time quotas.
- Record command, output and exit code.
- Keep generated artifacts in an explicit output directory.
- Provide cancellation and cleanup.
- Expose a reviewable execution receipt.

Do not treat a browser profile or a process boundary as a sufficient sandbox by itself.

---

## 10. MCP and agent-tool architecture

### 10.1 Official MCP TypeScript SDK

Repository: [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)  
Documentation: [modelcontextprotocol.io](https://modelcontextprotocol.io/)

Use MCP to expose selected office operations to Debo and compatible external AI clients.

Potential office tool groups:

**Workspace tools**
- list spaces and folders.
- search documents.
- get file metadata.
- create a document.
- open a document.
- import and export content.

**Sheet tools**
- inspect workbook and range.
- update selected cells.
- add formulas.
- create chart.
- validate values.
- export workbook.

**Document tools**
- inspect document structure.
- insert or replace selected blocks.
- apply formatting.
- export DOCX or PDF.

**Slide tools**
- inspect slides.
- create and edit slides.
- render preview.
- lint overflow.
- export PPTX.

**Processing tools**
- parse a file.
- extract a table.
- convert formats.
- run bounded analysis.
- create a deliverable.

**Review tools**
- create a draft Worktree.
- inspect changes.
- generate a comparison.
- mark ready for review.
- merge or discard after approval.

Tools must be scoped by user, artifact and action type. Read-only tools, reversible writes and destructive writes must have separate policies.

### 10.2 Composio

Website: [composio.dev](https://composio.dev/)  
Documentation: [Composio docs](https://docs.composio.dev/)

Use Composio as a major connector and external-tool layer where it provides reliable authentication and API coverage.

Do not duplicate provider integrations without need.

The office service should not call arbitrary tools directly. Tool execution must pass through Debo's centralized authorization layer.

---

## 11. Proposed Debo Office Workbench experience

Make Office Workbench a first-class section in Debo's application.

Suggested navigation:

- **My Space** — personal files, folders, projects and recent work.
- **Documents** — rich-text documents, reports, notes and PDFs.
- **Sheets** — workbooks, formulas, charts, financial models and data.
- **Slides** — presentations and templates.
- **Bases** — structured tables, trackers, records and lightweight CRM.
- **Boards** — whiteboards, diagrams, mind maps and project canvases.
- **AI Workroom** — Debo's conversation and activity alongside an open artifact.
- **Review Center** — drafts, diffs, approvals, version history and delivery.
- **Automations** — scheduled work and workflows.
- **Connectors** — Google, Microsoft and other authorized services.

### 11.1 My Space

Provide:

- Folder hierarchy.
- Search.
- Recent items.
- Favorites.
- Trash.
- Upload.
- Import.
- Export.
- File metadata.
- Version history.
- Per-item access controls.

### 11.2 AI Workroom

The user should be able to open an artifact and ask Debo to work on it without losing the document context.

Display:

- Current artifact.
- Agent plan.
- Step-by-step progress.
- Tool calls.
- Validation results.
- Source references.
- Questions for the user.
- Pending approvals.
- Generated outputs.

### 11.3 Review Center

Every agent-generated edit should have a review path.

Display:

- Original artifact.
- Draft artifact.
- Changed sections, cells or slides.
- Structural and visual validation.
- Warnings.
- Version metadata.
- Merge/accept.
- Reopen for revision.
- Discard.

Do not silently merge destructive or material changes.

---

## 12. Example workflows

These illustrate desired future capabilities. They are acceptance scenarios, not claims of current implementation.

### 12.1 Research report

User: "Research this topic and prepare a professional report."

Debo should:

1. Understand the requested scope and audience.
2. Research and collect sources.
3. Preserve source URLs and publication metadata.
4. Extract relevant material.
5. Draft a structured document.
6. Add citations and references.
7. Render a PDF preview.
8. Inspect layout and pagination.
9. Save DOCX and PDF outputs.
10. Present both files for review.

### 12.2 Financial spreadsheet analysis

User: "Analyze these files and prepare a financial dashboard."

Debo should:

1. Inspect source files.
2. Validate schemas and data types.
3. Identify duplicates and missing data.
4. Clean data in a separate working copy.
5. Use DuckDB or Polars where appropriate.
6. Generate formulas and charts.
7. Create an editable spreadsheet.
8. Validate calculations against source data.
9. Produce a dashboard and executive summary.
10. Present discrepancies and assumptions.

### 12.3 Presentation generation

User: "Turn this research into a presentation."

Debo should:

1. Extract the narrative and key findings.
2. Create a slide outline.
3. Generate an editable slide deck.
4. Apply a consistent visual system.
5. Check text overflow and overlap.
6. Render every slide.
7. Correct visible layout issues.
8. Export PPTX and PDF.
9. Present a preview for review.

### 12.4 Batch PDF processing

User: "Process these 100 PDFs and extract the information into a spreadsheet."

Debo should:

1. Validate all files.
2. Keep originals unchanged.
3. Parse with Docling and OCR where required.
4. Extract data into a normalized schema.
5. Preserve document and page references.
6. Flag uncertain fields.
7. Produce an XLSX file.
8. Generate an exception report.
9. Allow the user to inspect representative records.
10. Save the final results and processing receipt.

### 12.5 Project operations

User: "Prepare meeting notes and update the project tracker."

Debo should:

1. Read authorized meeting materials.
2. Generate minutes.
3. Extract decisions and action items.
4. Create or update a Base/Sheet draft.
5. Associate items with owners and dates where evidence exists.
6. Show all proposed changes.
7. Request approval for external updates.
8. Save the minutes and updated tracker.

### 12.6 Business dashboard

User: "Create a dashboard from this data."

Debo should:

1. Inspect input data.
2. Identify useful metrics.
3. Build a spreadsheet-backed dataset.
4. Create tables and charts.
5. Build an interactive dashboard where supported.
6. Verify that charts match the underlying data.
7. Provide a source file and presentation-ready export.
8. Explain assumptions and data freshness.

---

## 13. Proposed architecture

The following is a target architecture. Adapt it to the final OpenMuse/Debo architecture and actual deployment capabilities.

~~~mermaid
flowchart TD
    User[User: Web / Mobile / Voice] --> Debo[Debo Agent]
    Debo --> Brain[Personal Brain and Memory]
    Debo --> Planner[Task Planner and Durable Task Engine]
    Planner --> Policy[Permission and Approval Engine]
    Policy --> Tools[Office Tool Registry / MCP]

    Tools --> Workspace[Univer Workspace]
    Tools --> CLI[Univer CLI Worker]
    Tools --> Cloud[Google Workspace / Microsoft Graph]
    Tools --> Browser[Isolated Browser Worker]

    CLI --> Office[Office SDK and Artifact Models]
    Workspace --> Office
    Office --> Docs[Docs / Sheets / Slides / Bases / Boards]

    Tools --> Process[Document Processing Workers]
    Process --> Docling[Docling]
    Process --> PDF[PDF Processing]
    Process --> Convert[LibreOffice Conversion]
    Process --> Analyze[DuckDB / Polars]

    Planner --> Jobs[Durable Background Jobs]
    Jobs --> Process
    Jobs --> CLI
    Jobs --> Sync[Connector Sync]

    Workspace --> Storage[Durable Storage and Versioning]
    Docs --> Storage
    Process --> Storage

    Storage --> Review[Review Center]
    Review --> User
    Policy --> Audit[Approval and Execution Audit]
    Planner --> Audit
~~~

### 13.1 Ownership boundaries

| Domain | Authoritative owner |
|---|---|
| User identity | Debo authentication |
| Personal memory | Debo brain/memory |
| User-visible conversations | Debo |
| Task ownership and status | Debo task system |
| Office artifact model | Univer Workspace or selected office foundation |
| Office editing and rendering | Univer or selected office engine |
| Original file storage | Debo-controlled storage or explicitly configured Workspace storage |
| External cloud files | Provider remains authoritative |
| Tool permissions | Debo policy engine |
| Approval records | Debo |
| Background processing | Dedicated workers and selected durable job system |
| Final deliverable and receipt | Debo artifact registry |

Do not create two competing sources of truth for the same entity.

### 13.2 Artifact registry

Every generated or imported artifact should have:

- Artifact ID.
- User ID.
- Project/workspace ID.
- Source artifact IDs.
- File type.
- Storage location.
- Provider reference if external.
- Created/updated timestamps.
- Version.
- Processing state.
- Agent task ID.
- Validation results.
- Review state.
- Sharing/permission state.
- Retention and deletion state.

### 13.3 Background job state

Track:

- Queued.
- Running.
- Waiting for input.
- Waiting for approval.
- Validating.
- Ready for review.
- Completed.
- Failed.
- Cancelled.

Jobs should be resumable where the underlying operation supports safe checkpointing.

Writes must be idempotent or require a provider-state check before retrying an uncertain result.

---

## 14. Security, data and privacy requirements

Office work may include financial records, personal files, employment materials and private correspondence. Treat the entire workbench as a high-trust system.

Requirements:

- Authenticate every user and every worker request.
- Enforce per-user and per-artifact authorization on the server.
- Use least-privilege connector scopes.
- Keep external write permissions separate from read permissions.
- Treat imported files, email text, web pages and MCP output as untrusted data.
- Prevent prompt injection from causing tool authorization.
- Run CLI and processing workers in isolated environments.
- Do not expose host filesystem or production credentials to document scripts.
- Apply CPU, memory, file-size and execution-time limits.
- Scan and validate uploads.
- Use private object storage.
- Avoid public file URLs by default.
- Keep audit logs for external actions.
- Make approval specific to the exact action and target.
- Revalidate authorization immediately before external writes.
- Preserve originals and version generated outputs.
- Provide source-level deletion and account-level export.
- Reconcile deletion of derived text, chunks, embeddings and cached previews.
- Avoid retaining raw voice/audio unless explicitly enabled.
- Never store connector tokens in generated documents or agent-visible logs.

### 14.1 Important upstream safety limitations

- Univer CLI documentation says its trusted JavaScript execution is not a sandbox for untrusted code.
- Univer Workspace MCP documentation describes deployment-specific executor allowlists and isolation limitations. Its process separation and session grants should not be mistaken for a complete multi-tenant sandbox.
- A browser profile is not a security boundary.
- Office file parsers and converters should run in constrained workers.
- Do not mount production secrets into general-purpose document-processing containers.

Read the upstream security documents before deploying any of these components.

---

## 15. Licensing and dependency policy

Licensing must be checked at implementation time for the exact repository revision, package, edition and deployment mode.

| Project | Repository license / known boundary | Decision |
|---|---|---|
| [Univer](https://github.com/dream-num/univer) | Open-source core is Apache-2.0; some SDK/plugins/extensions are separately licensed | Primary candidate; verify exact feature packages |
| [Univer Workspace](https://github.com/dream-num/univer-workspace) | Repository declares Apache-2.0; verify packaged/runtime components and third-party notices | Primary workspace candidate |
| [Univer CLI](https://github.com/dream-num/univer-cli) | Repository declares Apache-2.0; verify runtime and bundled dependency terms | Primary agent-office CLI candidate |
| [Docling](https://github.com/docling-project/docling) | MIT codebase; individual models may have separate terms | High-priority parser candidate |
| [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) | Verify current repository, edition and feature licensing | PDF worker candidate |
| [LibreOffice](https://github.com/LibreOffice/core) | Open-source project with multiple license notices | Conversion worker candidate |
| [PptxGenJS](https://github.com/gitbrent/PptxGenJS) | MIT | Presentation generation utility |
| [ExcelJS](https://github.com/exceljs/exceljs) | Verify current package license and transitive dependencies | Spreadsheet utility |
| [DuckDB](https://github.com/duckdb/duckdb) | MIT | Analytics candidate |
| [Polars](https://github.com/pola-rs/polars) | MIT | Analytics candidate |
| [Jupyter](https://github.com/jupyter/notebook) | Verify project/package and extensions individually | Optional notebook environment |
| [ONLYOFFICE DocumentServer](https://github.com/ONLYOFFICE/DocumentServer) | Verify exact edition and AGPL/commercial obligations | Alternative office engine |
| [Collabora Online](https://github.com/CollaboraOnline/online) | Verify exact component and deployment licensing | Alternative office engine |
| [Activepieces](https://github.com/activepieces/activepieces) | Core and enterprise capabilities may have different terms | Optional workflow builder; review SaaS embedding |
| [Temporal](https://github.com/temporalio/temporal) | Verify server, SDK and Cloud terms | Evaluate only if current durable jobs are insufficient |
| [Playwright](https://github.com/microsoft/playwright) | Apache-2.0 | Browser automation foundation |
| [Stagehand](https://github.com/browserbase/stagehand) | Verify current license and service dependency terms | Optional browser abstraction |

Maintain a generated third-party notices file or equivalent inventory. Do not copy source files without preserving required notices.

---

## 16. Implementation priorities

The following is the recommended future roadmap. It should be reconciled with the main Debo/OpenMuse implementation plan rather than executed as an independent application.

### P0 — Office foundation

1. Inspect the current Debo/OpenMuse architecture and existing storage.
2. Deeply evaluate Univer Workspace.
3. Evaluate Univer CLI and its skills.
4. Build a small technical spike proving:
   - Create a Doc.
   - Create a Sheet.
   - Create a Slide deck.
   - Import an existing Office file.
   - Edit in an isolated draft.
   - Render and inspect the output.
   - Review and merge or discard.
5. Decide between Workspace service integration and UI integration.
6. Define Debo artifact identity, storage and version contracts.
7. Build the Office Workbench navigation and file library.
8. Deploy an isolated Node-based office worker.
9. Add secure task-to-artifact linkage.
10. Implement Review Center.
11. Add a first usable Doc, Sheet and Slide flow.
12. Integrate Docling for supported document ingestion.

**P0 exit criteria:** A user can ask Debo to create or revise a document, spreadsheet or presentation, watch background progress, inspect the result, and approve or discard the draft without overwriting the original.

### P1 — Document intelligence and connected office

1. Add PDF processing and conversion.
2. Add large CSV and spreadsheet analysis.
3. Evaluate DuckDB and Polars.
4. Connect authorized Google Drive, Docs, Sheets and Slides.
5. Connect OneDrive, SharePoint and supported Microsoft 365 APIs.
6. Add recurring office reports.
7. Add batch document extraction.
8. Add spreadsheet-backed dashboards.
9. Add stronger document version comparison.
10. Add team/project spaces if user needs justify the added sharing complexity.

**P1 exit criteria:** Debo can transform authorized personal and cloud documents into reviewed, well-structured deliverables and repeat those workflows reliably.

### P2 — Advanced workbench

1. Evaluate an interactive notebook environment.
2. Evaluate visual automation builder integration.
3. Add richer Base/CRM and project trackers.
4. Add advanced Boards and diagrams.
5. Add optional ONLYOFFICE/Collabora compatibility paths if demand requires them.
6. Add advanced report templates.
7. Add richer multi-user collaboration.
8. Add more complex cross-provider workflows.
9. Add specialized business analytics.
10. Add optional local desktop companion for authorized local files.

**P2 exit criteria:** Debo can serve as a broader personal and small-team office environment while maintaining clear data, permission and operational boundaries.

---

## 17. Concrete acceptance tests

Do not consider any feature complete merely because the package is installed or a route exists.

### 17.1 Document creation and review

- Ask Debo to create a formal report.
- Verify an editable document is created.
- Verify the generated content is saved.
- Verify a PDF preview renders.
- Verify page count and layout.
- Verify the original input was not overwritten.
- Review the diff and discard it.
- Run the workflow again and merge the approved version.

### 17.2 Spreadsheet analysis

- Upload a CSV or XLSX.
- Inspect columns and types.
- Detect missing and duplicate values.
- Generate formulas and charts.
- Validate selected totals against source data.
- Export XLSX.
- Reopen and verify the workbook structure.
- Display assumptions and exceptions.

### 17.3 Presentation generation

- Convert a report into a slide deck.
- Verify slide count and content.
- Render every slide.
- Detect overflow and overlapping text.
- Verify generated charts match source data.
- Export PPTX and PDF.
- Review and approve the result.

### 17.4 Batch PDFs

- Upload a batch of PDFs.
- Preserve originals.
- Parse normal and scanned files.
- Extract structured tables.
- Preserve document and page references.
- Flag ambiguous extraction.
- Export XLSX plus exception report.
- Confirm processing can resume after worker restart.

### 17.5 Cloud document editing

- Connect an authorized cloud account.
- Read a selected document.
- Prepare a proposed edit.
- Show the exact target and diff.
- Require authorization for external write.
- Verify provider state after the action.
- Disconnect and verify future access is denied.

### 17.6 Security and recovery

- Verify cross-user isolation.
- Verify file links are private.
- Verify arbitrary script execution is isolated.
- Verify untrusted document instructions cannot authorize an action.
- Verify an uncertain external write is checked before retry.
- Verify job cancellation.
- Verify worker restart recovery.
- Verify source deletion and derived-data cleanup.

---

## 18. Operational and product metrics

Measure quality rather than just the number of integrated tools.

Useful metrics:

- Document creation success rate.
- XLSX structure and formula validation rate.
- Slide overflow/error rate.
- PDF parser success rate.
- OCR confidence and exception rate.
- Job completion and recovery rate.
- Average time to first useful artifact.
- Cost per completed office task.
- User approval/rejection rate.
- Rework rate after review.
- Connector sync freshness.
- Cross-user authorization test coverage.
- Accessibility conformance.
- Export fidelity.

Do not publish performance claims until they are measured against representative files and environments.

---

## 19. Avoid these architectural mistakes

1. Do not build a separate Univer-branded assistant that competes with Debo.
2. Do not duplicate OpenMuse's agent runtime without a specific capability gap.
3. Do not make Workspace, Debo and cloud-provider storage competing authorities for the same file.
4. Do not assume every commercial Univer demo is part of the free open-source core.
5. Do not run the Univer CLI's trusted code execution on the public web server.
6. Do not expose the Workspace MCP executor to arbitrary users without a proper isolation review.
7. Do not run office conversion or OCR inside a latency-sensitive edge request handler.
8. Do not silently overwrite original files.
9. Do not let office tools bypass Debo's approval and audit system.
10. Do not add multiple office engines unless there is a demonstrated compatibility requirement.
11. Do not add both Temporal and Inngest just because both are capable.
12. Do not add a visual automation system that creates an independent permission model.
13. Do not call generated artifacts verified until they have actually been reopened or rendered and checked.
14. Do not treat a generated XLSX, DOCX or PPTX as correct just because the export operation succeeded.
15. Do not label a feature implemented until an end-to-end acceptance test passes.

---

## 20. Research and implementation references

### Core office workspace

- [Univer GitHub](https://github.com/dream-num/univer)
- [Univer Workspace GitHub](https://github.com/dream-num/univer-workspace)
- [Univer CLI GitHub](https://github.com/dream-num/univer-cli)
- [Univer documentation](https://docs.univer.ai/)
- [Univer feature comparison](https://univer.ai/compare/)
- [Univer Workspace MCP README](https://github.com/dream-num/univer-workspace/blob/main/apps/mcp/README.md)
- [Univer Workspace Agent README](https://github.com/dream-num/univer-workspace/blob/main/apps/agent/README.md)
- [Univer CLI README](https://github.com/dream-num/univer-cli/blob/main/README.md)

### Document and PDF processing

- [Docling](https://github.com/docling-project/docling)
- [Docling documentation](https://docling-project.github.io/docling/)
- [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF)
- [LibreOffice](https://www.libreoffice.org/)
- [LibreOffice source](https://github.com/LibreOffice/core)
- [PptxGenJS](https://github.com/gitbrent/PptxGenJS)
- [ExcelJS](https://github.com/exceljs/exceljs)
- [docx](https://github.com/dolanmiu/docx)
- [pdf-lib](https://github.com/Hopding/pdf-lib)

### Analytics

- [DuckDB](https://github.com/duckdb/duckdb)
- [DuckDB documentation](https://duckdb.org/docs/)
- [Polars](https://github.com/pola-rs/polars)
- [Polars documentation](https://docs.pola.rs/)
- [Jupyter Notebook](https://github.com/jupyter/notebook)
- [Jupyter](https://jupyter.org/)

### Alternative office suites

- [ONLYOFFICE DocumentServer](https://github.com/ONLYOFFICE/DocumentServer)
- [ONLYOFFICE](https://www.onlyoffice.com/)
- [Collabora Online](https://github.com/CollaboraOnline/online)
- [Collabora Online](https://www.collaboraonline.com/)

### Cloud office APIs

- [Google Workspace APIs](https://developers.google.com/workspace)
- [Google Drive API](https://developers.google.com/drive/api/guides/about-sdk)
- [Google Docs API](https://developers.google.com/docs/api)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Google Slides API](https://developers.google.com/slides/api)
- [Microsoft Graph](https://learn.microsoft.com/graph/)
- [Microsoft Graph JavaScript SDK](https://github.com/microsoftgraph/msgraph-sdk-javascript)

### Automation and execution

- [Activepieces](https://github.com/activepieces/activepieces)
- [Activepieces website](https://www.activepieces.com/)
- [Temporal](https://github.com/temporalio/temporal)
- [Temporal documentation](https://docs.temporal.io/)
- [Inngest](https://github.com/inngest/inngest)
- [Inngest documentation](https://www.inngest.com/docs)
- [Playwright](https://github.com/microsoft/playwright)
- [Playwright documentation](https://playwright.dev/)
- [Stagehand](https://github.com/browserbase/stagehand)

### Agent and tool interoperability

- [OpenMuse](https://github.com/CopilotKit/OpenMuse)
- [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP documentation](https://modelcontextprotocol.io/)
- [Composio](https://composio.dev/)
- [Composio documentation](https://docs.composio.dev/)

---

## 21. Recommended next engineering actions

The next implementation sequence should be:

1. Read the current Debo architecture and OpenMuse integration decisions.
2. Inspect the latest Univer Workspace, SDK and CLI repositories and official documentation.
3. Build a short feature/licensing/runtime comparison for Workspace, direct SDK integration and alternatives.
4. Run the Univer CLI in a disposable local sandbox and prove one Doc, Sheet and Slide workflow.
5. Deploy a disposable Univer Workspace instance and verify identity, permissions, storage, MCP and Worktree review.
6. Define the Debo artifact registry and task-to-artifact contract.
7. Integrate one end-to-end office task into Debo.
8. Add document parsing and background processing.
9. Add connected cloud office operations behind Debo's permission engine.
10. Expand the Office Workbench only after the first workflows are stable.

The first milestone should be intentionally small but complete: **ask Debo to create a report, spreadsheet and presentation; inspect the drafts; see validation results; approve or discard them; and find the final artifacts in My Space.**

---

## 22. Definition of success

The Office Workbench is successful when Debo can reliably perform real office work rather than merely describe how to do it.

A user should be able to say:

> "Debo, review these files, analyze the data, prepare a professional report and presentation, put the supporting calculations in a spreadsheet, check the outputs, and show me everything for review."

Debo should execute this as one coherent, durable task, with clear progress, real editable artifacts, source traceability, validation, permissions and human review.

**The long-term goal is a personal AI operating system with a real office built into it: Debo thinks, plans and coordinates; the Office Workbench gives it the tools and workspace to produce useful work.**
