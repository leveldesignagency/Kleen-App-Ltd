# Marketplace contract & e-sign flow (Kleen as intermediary)

Kleen positions as a **marketplace/intermediary**, not the contractor. The flow is:

**Customer → Kleen → Contractor → Kleen → Customer**

This document defines: (1) contractor service contracts attached to profiles, (2) contracts delivered with quotes, and (3) customer acceptance requiring e-sign + Kleen T&Cs before payment.

---

## 1. Triangle flow (who does what)

| Step | Who | Action |
|------|-----|--------|
| 1 | Customer | Submits job (service, address, date). |
| 2 | Kleen (admin) | Sends job to one or more contractors for quotes. |
| 3 | Contractor | Submits quote (price, hours, notes) — quote is tied to their **service contract** for that service. |
| 4 | Kleen (admin) | Sets customer price (markup), sends quotes to customer. |
| 5 | Customer | Views quotes + contractor’s service contract. Chooses a quote. |
| 6 | Customer | **E-signs** the chosen contractor’s service contract. |
| 7 | Customer | **Accepts** Kleen’s terms & conditions (disclaiming Kleen’s liability). |
| 8 | Customer | **Pays** (Stripe). |
| 9 | System | Job → `customer_accepted`, assignment created, contract copies stored. |
| 10 | Contractor / Kleen | Job is completed; funds flow Kleen → contractor per existing escrow. |

Kleen is never the service provider; the contract is between **customer and contractor**. Kleen’s T&Cs only govern use of the platform and disclaim liability (illegal activity, civil disputes, etc.).

---

## 2. Contractor: services + contracts on profile

- A contractor (operative) can offer **multiple services** (from the global `services` catalogue).
- For **each service** they offer, they must have **one contract** (document describing the work they provide for that service).
- Contracts are **per operative, per service**: e.g. “Driveway Cleaning” contract for Operative A, “Patio Cleaning” contract for Operative A.
- Stored as:
  - **`operative_services`**: `operative_id`, `service_id`, `contract_document_url` (or `contract_content`), optional `contract_name`, `is_active`, timestamps.
  - Contract can be PDF URL (Supabase Storage) or rich text; we store URL or content and optionally a version.

When admin adds/edits a contractor:
- Admin can **add a service** the contractor offers (from `services`).
- For that service, admin (or later contractor portal) **uploads or pastes the contract** for that service. That contract is attached to the contractor’s profile for that service.

---

## 3. Quote ↔ contract

- When a **quote** is created (admin adds a quote, or contractor submits one), the quote is for a **job** (which has a `service_id`).
- The contractor (operative) must have an **operative_service** row for that `service_id` with a contract.
- **Sending quotes to customer**: each quote is shown with the **contractor’s service contract** for that job’s service. Customer can view/download the contract before accepting.
- We store a **snapshot** or **link** so we know exactly which contract version the customer was shown:
  - Option A: `quote_responses.operative_service_id` (FK to operative_services) — “this quote uses this contract.”
  - Option B: `contract_snapshots` table: at “send to customer” we copy contract URL/content and attach to `quote_request_id` so we have an immutable snapshot for the acceptance flow.

Recommendation: **operative_service_id** on quote_responses (or quote_requests) + optional **contract_snapshot** table if we need a frozen copy (e.g. for legal/audit). For MVP we can link quote_response → operative_service and use that contract URL/content for display and e-sign.

---

## 4. Customer acceptance flow (order of steps)

Customer must complete in order:

1. **Choose quote** (already in place).
2. **E-sign contractor’s service contract**
   - Show contract (from operative_service linked to the quote).
   - Customer signs (name + date; optionally tick “I have read and agree”).
   - Store: `job_contract_signatures` or `customer_contract_signatures`: `job_id`, `quote_request_id`, `operative_service_id`, `signed_at`, `signer_name`, `ip_address` (and optionally a signed PDF or signature image).
3. **Accept Kleen terms & conditions**
   - Show Kleen T&Cs (platform use, no liability for illegal/civil issues, etc.).
   - Customer must tick “I accept” and optionally e-sign.
   - Store: `job_id`, `kleen_terms_accepted_at`, `user_id`, `ip_address` (and optionally version of T&Cs).
4. **Pay**
   - Only after both 2 and 3 are done, the “Pay” button is enabled (or the pay step is shown).
   - On successful payment, job moves to `customer_accepted` as today.

So: **Accept quote → E-sign contractor contract → Accept Kleen T&Cs → Pay.**

---

## 5. Database (summary)

- **operative_services**  
  `operative_id`, `service_id`, `contract_title`, `contract_content` (text) or `contract_file_url` (storage), `contract_version`, `is_active`, `created_at`, `updated_at`.  
  Unique on `(operative_id, service_id)`.

- **quote_responses** (existing)  
  Add `operative_service_id` (nullable FK to operative_services). When admin creates a quote for operative O and job service S, set operative_service_id to O’s operative_services row for S.

- **customer_contract_signatures** (e-sign contractor contract)  
  `id`, `job_id`, `quote_request_id`, `operative_service_id`, `user_id` (customer), `signed_at`, `signer_name`, `signer_email`, `ip_address`, optional `signature_data` (e.g. base64 image or “typed name + date”).

- **kleen_terms_acceptances** (Kleen T&Cs)  
  `id`, `job_id`, `user_id`, `accepted_at`, `terms_version`, `ip_address`.

- **jobs**  
  Optional: `customer_contract_signed_at`, `kleen_terms_accepted_at` for quick checks; or derive from the two tables above.

---

## 6. Admin: contractor page

- **Contractor list** (existing).
- **Add/Edit contractor** (existing) plus:
  - Section **“Services & contracts”**:
    - List of services this contractor offers (from `operative_services`).
    - For each: service name, “Contract” (upload PDF or paste text), “Remove service”.
    - “Add service”: dropdown of `services` (exclude already added). On add, require contract (upload or paste). Save as `operative_services` row.
  - When **creating a quote** for a job (from job detail): when selecting contractor, ensure they have an operative_service for the job’s service_id; if not, warn and require adding contract for that service first. Set `quote_response.operative_service_id` when saving the quote.

---

## 7. Customer app: accept flow

- **Quotes page** (existing): show “Accept” on a quote.
- **Accept flow** (replace or extend “Pay” modal):
  1. **Step 1 – Contract**: Show contractor’s service contract (from operative_service linked to quote). “I have read and agree” + e-sign (name + date). Submit → store in `customer_contract_signatures`.
  2. **Step 2 – Kleen T&Cs**: Show Kleen terms. “I accept the platform terms.” Submit → store in `kleen_terms_acceptances`.
  3. **Step 3 – Pay**: Existing Stripe payment. On success → job `customer_accepted`, etc.

If the user closes the flow before paying, we keep the signatures (they’re tied to job + quote); when they return, we can skip to Pay if both signatures exist.

---

## 8. Implementation order

1. **Migration**: operative_services, customer_contract_signatures, kleen_terms_acceptances; add operative_service_id to quote_responses; optional job columns.
2. **Admin contractors**: UI to add/edit services and contracts per contractor; validate when adding quote.
3. **Admin quote creation**: Set operative_service_id when creating/editing a quote (ensure contractor has contract for job’s service).
4. **Customer**: Accept flow — contract step, T&Cs step, then pay (with checks so Pay is only enabled after both).
5. **Kleen T&Cs content**: Stored in app_settings or a static page; version tracked in kleen_terms_acceptances.

This gives a clear marketplace flow: Customer ↔ Kleen ↔ Contractor, with contractor contracts and Kleen T&Cs captured before payment.
