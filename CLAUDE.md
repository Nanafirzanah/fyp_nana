# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A fork of **DocuVault AI** (department-scoped document manager) that is being turned into **SafeFile**, the owner's final-year project (UTM, PSM 2): per-file password locks with browser-side encryption plus ClamAV scanning. The original proposal described Laravel/MySQL; that was dropped on purpose. We keep the FastAPI + React + Cognito + S3 + DynamoDB stack and add the SafeFile features on top. The report must say clearly which code is forked and which is original.

The owner writes in a Malay/English mix; answer in the language they use. `SAFEFILE_FYP2_CONTEXT.md` is an earlier hand-off note; its "open decisions" are superseded by the **SafeFile design decisions** section below.

## Commands

Backend (`backend/`, Python 3.12):
```bash
python -m venv venv && venv\Scripts\activate   # Windows (source venv/bin/activate elsewhere)
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000   # docs at http://localhost:8000/docs
```
Frontend (`frontend/`, Node 20+):
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build (this is the type check)
npm run lint
```
There is **no test suite and no backend linter yet**. Config is read from `backend/.env` and `frontend/.env` (copy the `.env.example` files). `backend/config.py` raises `RuntimeError` at import time if required variables are missing, so the app will not start without them. Real AWS access (Cognito, DynamoDB, S3) is needed even for local runs; credentials come from the standard AWS credential chain.

## Deployment (be careful)

- A push to `main` that touches `backend/**` **auto-deploys to production** on Elastic Beanstalk (`.github/workflows/deploy-backend.yml`). Work on a feature branch and merge deliberately.
- nginx (`backend/.platform/nginx/conf.d/https.conf`) terminates TLS with a Cloudflare origin cert and sets `client_max_body_size 55M`; the app itself caps uploads at `MAX_UPLOAD_SIZE_BYTES` (50 MB, `config.py`).
- The frontend is built for Cloudflare Pages (`frontend/wrangler.toml`).

## Architecture (existing code)

- **Auth:** the frontend logs in directly against Cognito (`amazon-cognito-identity-js`, `frontend/src/auth/`) and sends the **ID token** as `Authorization: Bearer`. `backend/auth.py` verifies the JWT locally against cached JWKS; `backend/dependencies.py` then loads the employee from DynamoDB and returns `{email, name, department, role}`. Roles are `employee` and `system_admin`; admin routes use `require_admin` in `admin.py`. There is no self-registration: admins create Cognito users and Employees rows.
- **Department scoping is the access-control model.** `department` is the DynamoDB partition key of Folders, Documents and AuditLog, and the prefix of every S3 key (`{department}/{file_uuid}`). Route handlers take the department from the token's employee profile, never from the request. Anything new must keep this.
- **File bytes live only in S3; DynamoDB holds metadata** (`s3_key`, `display_name`, `content_type`, `file_size`, `uploaded_by`, ...). The `s3_key` is a UUID and never changes; renames only touch `display_name`.
- **Upload today** (`documents.py`): browser posts multipart to `/documents/upload`, the server streams it into memory, writes to S3, then DynamoDB (rolls the S3 object back if the DB write fails), then an audit entry. Download returns a 5-minute presigned S3 URL.
- **Error style:** boto3 `ClientError` is logged and turned into HTTP 503; audit-log failures are logged but never fail the request.
- **Layout:** one FastAPI router module per feature (`documents.py`, `folders.py`, `admin.py`, ...), all DynamoDB access in `dynamodb_client.py`, all S3 access in `s3_client.py`. The frontend has typed fetch wrappers in `frontend/src/api/` (shared helpers in `utils.ts`), page components in `pages/`, and shared shapes in `types/index.ts`.
- Audit log actions are free-form strings written via `create_audit_log_entry`; the admin UI filters by them.

## SafeFile design decisions (settled, do not re-open)

- **Sharing:** department-level. A locked file is visible in the list to everyone in the department, but nobody (colleagues included) can view/download it without the file password. **Rename and delete of locked files: owner (`uploaded_by`) and `system_admin` only.** Moving locked files is not decided yet: ask.
- **No password recovery.** A forgotten file password means the file is gone. The lock dialog must warn about this.
- **Encryption:** browser-side **Web Crypto API** (not CryptoJS): PBKDF2-SHA256 (>= 600k iterations, random salt) to a master secret, then HKDF into two independent values: an **AES-256-GCM key** (never sent) and a **verifier** (sent). Random 12-byte IV. Only the file *content* is encrypted; name/size/type stay plaintext in DynamoDB. Locked-file limit: **25 MB** (whole file in memory, no chunking). Ciphertext size = plaintext size + 16 bytes.
- **Lock gate:** the server stores `bcrypt(verifier)` (base64 verifier, under bcrypt's 72-byte limit) in a separate `FilePasswords` table, never on the Documents item, so it cannot leak through the list endpoint. It releases the ciphertext (presigned URL plus salt/iv/kdf params) only if the verifier matches. The password and the AES key never reach the server. **Rate limit** wrong attempts (proposed default: 5 failures then a temporary lockout, stored on the same item) and write failed unlocks to the audit log.
- **Locked objects** are stored in S3 as `application/octet-stream`; the real name and `content_type` stay in DynamoDB and are restored on download.
- **ClamAV, server-side only, via `clamd`** (never `shell_exec` per file; needs roughly 1 GB+ RAM, so deployment is the main risk):
  - *Unlocked files:* scanned at upload (infected = reject) and again at download (infected = warning with Continue/Cancel).
  - *Locked files:* scanned **at upload only**. The browser first posts the plaintext to `POST /documents/scan`; the server scans it, discards it, and returns a **single-use, short-lived `scan_id`** bound to user + file name + size. The browser then encrypts and uploads the ciphertext with that `scan_id`; the server checks the id and that ciphertext size = scanned size + 16. Locked files cannot be scanned at download (the server never decrypts).
  - Files that carry their own password (encrypted ZIP/RAR/7z, protected PDF/Office) cannot be inspected by ClamAV: allow them but flag "could not be fully scanned". Verify the exact clamd option names (`AlertEncrypted*`) in the ClamAV docs before relying on them.
  - Every scan writes a `ScanLogs` record (file, user, result, timestamp, `scan_type` = upload/download); admins get a scan-log view next to the existing audit log.
- **Accepted limitation** (write it in the report): scan and upload are separate requests, so a deliberate insider could scan a clean file and upload a different encrypted one. Also: no rescan of locked files, server briefly holds locked-file plaintext in memory during the upload scan, browser JS must be trusted (CSP, bundle all dependencies, no third-party CDN scripts).
- **Future work only:** server-side decrypt-and-scan at download, cross-department sharing, password recovery.
- **Remove RAG/AI completely** (the owner does not need it).

## Implementation backlog (do in this order, one branch each)

0. **Fix an existing bug:** `documents.py` `rename_document` calls `dynamodb_client.rename_document(department, file_id, name)` but the function requires a 4th argument `modified_by`, so renaming a file raises `TypeError` (500). Pass `modified_by=employee["email"]`.
1. **Remove RAG/AI.** Delete `rag.py`, `chat.py`, `bedrock_client.py`, the `/documents/{file_id}/summarize` route, `index_document` / `delete_document_vectors` calls in `documents.py` (note delete currently fails if Pinecone fails), the `chat_router` in `main.py`, and the Pinecone/Bedrock settings in `config.py` including `PINECONE_API_KEY` in the required-variables check. On the frontend remove the AI assistant page, `chatApi.ts`, the summarize action and its types, and the sidebar/dashboard entries. Then `grep` for what is now unused (`pinecone`, `pdfplumber`, `python-docx`, `openpyxl`, `python-pptx`, `fpdf2`, `react-markdown`, `remark-gfm`) and drop it from `requirements.txt` / `package.json`. Update README and `.env.example`.
2. **ClamAV spike:** prove `clamd` runs on the Elastic Beanstalk target (memory, signature updates). Do this before building scanning features; if it does not fit, tell the owner.
3. **Data model:** add DynamoDB tables `FilePasswords` and `ScanLogs` (config names such as `DYNAMODB_FILE_PASSWORDS_TABLE`, `DYNAMODB_SCAN_LOGS_TABLE`, plus clamd host/port settings) with accessors in `dynamodb_client.py`; add `is_locked`, `original_content_type` and the KDF/IV/salt parameters to Documents; extend `types/index.ts`.
4. **Frontend crypto module** (e.g. `frontend/src/crypto/`): derive key + verifier, encrypt, decrypt, with a clear error on a wrong password (GCM auth failure).
5. **Backend scanning:** `POST /documents/scan`, scan-on-upload for unlocked files, scan-on-download for unlocked files (warning flow), `ScanLogs` writes.
6. **Upload flow:** lock dialog in the upload UI (password, forgot-password warning, hint that a file may have its own password); scan, then encrypt, then upload for locked files; keep S3 first, DynamoDB second, with rollback.
7. **Unlock/download flow:** `POST /documents/{file_id}/unlock` with the verifier, rate limiting, audit entries; browser decrypts and saves under the original name.
8. **Access rules:** owner/admin-only rename and delete for locked files; lock icon in the file list; locked files hide any preview/open actions.
9. **Admin:** scan-log tab in `AdminDashboard.tsx`.
10. **Tests:** none exist. Cover the verifier gate, rate limit, scan_id checks and the crypto round trip (ask the owner before choosing pytest/vitest).

## Report workflow

The PSM1 report is a Word file outside this repo. Never edit the original; write changes into a **new copy** and highlight every changed section/line. Diagrams are made with Mermaid and draw.io.
