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
- **File bytes live only in S3; DynamoDB holds metadata** (`s3_key`, `display_name`, `content_type`, `file_size`, `uploaded_by`, ...). The `s3_key` is a UUID and does not change on rename (renames only touch `display_name`); the one deliberate exception is locking an existing file (see design decisions).
- **Upload today** (`documents.py`): browser posts multipart to `/documents/upload`, the server streams it into memory, writes to S3, then DynamoDB (rolls the S3 object back if the DB write fails), then an audit entry. Download returns a 5-minute presigned S3 URL.
- **Error style:** boto3 `ClientError` is logged and turned into HTTP 503; audit-log failures are logged but never fail the request.
- **Layout:** one FastAPI router module per feature (`documents.py`, `folders.py`, `admin.py`, ...), all DynamoDB access in `dynamodb_client.py`, all S3 access in `s3_client.py`. The frontend has typed fetch wrappers in `frontend/src/api/` (shared helpers in `utils.ts`), page components in `pages/`, and shared shapes in `types/index.ts`.
- Audit log actions are free-form strings written via `create_audit_log_entry`; the admin UI filters by them.

## SafeFile design decisions (settled, do not re-open)

- **Sharing:** department-level. A locked file is visible in the list to everyone in the department, but nobody (colleagues included) can view/download it without the file password. **Rename, delete and move of locked files: owner (`uploaded_by`) and `system_admin` only.**
- **No password recovery.** A forgotten file password means the file is gone. The lock dialog must warn about this.
- **Encryption:** browser-side **Web Crypto API** (not CryptoJS): PBKDF2-SHA256 (>= 600k iterations, random salt) to a master secret, then HKDF into two independent values: an **AES-256-GCM key** (never sent) and a **verifier** (sent). Random 12-byte IV. Only the file *content* is encrypted; name/size/type stay plaintext in DynamoDB. Locked-file limit: **25 MB** (whole file in memory, no chunking; keep it as one named constant so it can be raised after measuring on the demo hardware, and note clamd's own default `StreamMaxLength`/`MaxFileSize` is also 25 MB). Ciphertext size = plaintext size + 16 bytes.
- **Lock gate:** the server stores `bcrypt(verifier)` (base64 verifier, under bcrypt's 72-byte limit) in a separate `FilePasswords` table, never on the Documents item, so it cannot leak through the list endpoint. The KDF salt and iteration count are **public** (served with the document metadata): the browser needs them to compute the verifier before it can prove it knows the password. The server releases the ciphertext (presigned URL plus the IV) only if the verifier matches. The crypto module is `frontend/src/crypto/lockCrypto.ts` (`encryptBytes`, `decryptBytes`, `computeVerifier`, `InvalidPasswordError`). The password and the AES key never reach the server. **Rate limit** wrong attempts (proposed default: 5 failures then a temporary lockout, stored on the same item) and write failed unlocks to the audit log.
- **Locked objects** are stored in S3 as `application/octet-stream`; the real name and `content_type` stay in DynamoDB and are restored on download.
- **ClamAV, server-side only, via `clamd`** (never `shell_exec` per file; needs roughly 1 GB+ RAM, so deployment is the main risk):
  - *Unlocked files:* scanned at upload (infected = reject) and again at download (infected = warning with Continue/Cancel).
  - *Locked files:* scanned **at upload only**. The browser first posts the plaintext to `POST /documents/scan`; the server scans it, discards it, and returns a **single-use, short-lived `scan_id`** bound to user + file name + size. The browser then encrypts and uploads the ciphertext with that `scan_id`; the server checks the id and that ciphertext size = scanned size + 16. Locked files cannot be scanned at download (the server never decrypts).
  - Files that carry their own password (encrypted ZIP/RAR/7z, protected PDF/Office) cannot be inspected by ClamAV: allow them but flag "could not be fully scanned". Verify the exact clamd option names (`AlertEncrypted*`) in the ClamAV docs before relying on them.
  - Every scan writes a `ScanLogs` record (file, user, result, timestamp, `scan_type` = upload/download); admins get a scan-log view next to the existing audit log.
- **Locking an existing unlocked file** (the owner may lock it later; **owner only**, `uploaded_by`, not admin or colleagues, so nobody can lock a file out from under its owner). Flow: browser downloads the plaintext via the existing presigned URL, encrypts it with the same crypto module, and sends the ciphertext + verifier + KDF params to the server, which writes a **new** S3 object, then updates DynamoDB (conditional on `is_locked` being false; sets `is_locked`, the new `s3_key`, KDF/IV/salt) and `FilePasswords`, writes an audit entry, and only then deletes the old plaintext object. Order is always new S3 object, then DynamoDB, then delete the old one; never overwrite the same key. The server scans the plaintext S3 object itself before accepting the ciphertext (`ScanLogs.scan_type` = `lock`), and checks ciphertext size = stored `file_size` + 16. The Lock action is disabled with a clear message for files over the locked-file limit. **S3 bucket versioning must stay off**, otherwise old plaintext versions survive the delete (state this in the report). Presigned URLs issued before locking stop working once the old object is deleted; that is expected.
- **Accepted limitation** (write it in the report): scan and upload are separate requests, so a deliberate insider could scan a clean file and upload a different encrypted one. Also: no rescan of locked files, server briefly holds locked-file plaintext in memory during the upload scan, browser JS must be trusted (CSP, bundle all dependencies, no third-party CDN scripts).
- **Future work only (not in the PSM1 proposal, mention in the report's limitations):** server-side decrypt-and-scan at download, cross-department sharing, password recovery, **removing a lock and changing a file password** (workaround: download, delete, re-upload).
- **Remove RAG/AI completely** (the owner does not need it).

## Implementation backlog (do in this order, one branch each)

Status: steps 0 and 1 are done (branches `fix/rename-modified-by` and `remove-rag`); the owner has not merged them into `main` yet.

0. **(Done) Fix an existing bug:** `documents.py` `rename_document` calls `dynamodb_client.rename_document(department, file_id, name)` but the function requires a 4th argument `modified_by`, so renaming a file raises `TypeError` (500). Pass `modified_by=employee["email"]`.
1. **(Done) Remove RAG/AI.** Delete `rag.py`, `chat.py`, `bedrock_client.py`, the `/documents/{file_id}/summarize` route, `index_document` / `delete_document_vectors` calls in `documents.py` (note delete currently fails if Pinecone fails), the `chat_router` in `main.py`, and the Pinecone/Bedrock settings in `config.py` including `PINECONE_API_KEY` in the required-variables check. On the frontend remove the AI assistant page, `chatApi.ts`, the summarize action and its types, and the sidebar/dashboard entries. Then `grep` for what is now unused (`pinecone`, `pdfplumber`, `python-docx`, `openpyxl`, `python-pptx`, `fpdf2`, `react-markdown`, `remark-gfm`) and drop it from `requirements.txt` / `package.json`. Update README and `.env.example`.
2. **ClamAV spike:** prove `clamd` runs on the Elastic Beanstalk target (memory, signature updates). Do this before building scanning features; if it does not fit, tell the owner.
3. **(Done in code; the two tables must also be created in each AWS environment) Data model:** DynamoDB tables `FilePasswords` (PK `department`, SK `file_id`; holds `verifier_hash`, `iv`, `failed_attempts`, `locked_until`) and `ScanLogs` (PK `department`, SK `scan_id`), config names `DYNAMODB_FILE_PASSWORDS_TABLE` / `DYNAMODB_SCAN_LOGS_TABLE`, accessors in `dynamodb_client.py`. Documents gain `is_locked` (missing = false) and `lock_kdf` ({version, kdf, iterations, salt}, public). `content_type` always stays the real type, so no separate `original_content_type` is needed. Deleting a locked document (or a folder containing one) also deletes its `FilePasswords` item. Rate-limit and locked-file size constants live in `config.py` (`UNLOCK_MAX_FAILED_ATTEMPTS`, `UNLOCK_LOCKOUT_SECONDS`, `MAX_LOCKED_FILE_BYTES`). Still to add with the ClamAV work: clamd host/port settings.
4. **(Done) Frontend crypto module** (e.g. `frontend/src/crypto/`): derive key + verifier, encrypt, decrypt, with a clear error on a wrong password (GCM auth failure).
5. **Backend scanning:** `POST /documents/scan`, scan-on-upload for unlocked files, scan-on-download for unlocked files (warning flow), `ScanLogs` writes.
6. **Upload flow:** lock dialog in the upload UI (password, forgot-password warning, hint that a file may have its own password); scan, then encrypt, then upload for locked files; keep S3 first, DynamoDB second, with rollback.
7. **Unlock/download flow:** `POST /documents/{file_id}/unlock` with the verifier, rate limiting, audit entries; browser decrypts and saves under the original name.
8. **Access rules:** owner/admin-only rename, delete and move for locked files; lock icon in the file list; locked files hide any preview/open actions.
8b. **Lock an existing file** (owner only, see design decisions): `POST /documents/{file_id}/lock`, "Lock file" item in the file context menu reusing the lock dialog and crypto module. Stretch goal for Demo 1 (decide at the end of week 4 whether the core upload + unlock slice is stable enough), otherwise do it before Demo 2.
9. **Admin:** scan-log tab in `AdminDashboard.tsx`.
10. **Tests:** none exist. Use **vitest** (frontend) and **pytest** (backend). Cover the verifier gate, rate limit, scan_id checks, lock-existing-file ordering and the crypto round trip.
11. **Examiner evidence kit** (after Demo 1, owner agreed): a one-page demo script plus viva Q&A with live proof steps: run `npm test` (12+ green tests), DevTools Network tab showing only ciphertext + verifier is sent (never the password), raw S3 object opened in an editor/hex viewer is gibberish, DynamoDB `Documents`/`FilePasswords` items hold only salt, IV and bcrypt(verifier), wrong password rejected, tampered file rejected. Also explain PBKDF2 / HKDF / verifier / IV in plain language, why Web Crypto over CryptoJS, why AES-GCM, and the limitations. Keep it in sync with the real UI once lock works end to end.

## Report workflow

The PSM1 report is a Word file outside this repo. Never edit the original; write changes into a **new copy** and highlight every changed section/line. Diagrams are made with Mermaid and draw.io.
