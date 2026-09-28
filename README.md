# Hope 4 Mohawk support site

Static public support and privacy pages for the Hope 4 Mohawk app, plus a PIN-gated admin-code page. GitHub Pages publishes the `main` branch root. The support/privacy pages have no JavaScript or tracking. The admin page has small first-party JavaScript and connects only to this club's Supabase project.

- Support: `https://callan-watkins.github.io/hope4mohawk-support/`
- Privacy: `https://callan-watkins.github.io/hope4mohawk-support/privacy.html`
- Organizer issuer: `https://callan-watkins.github.io/hope4mohawk-support/admin/`

## Admin-code issuer

`admin/` is a public static shell, **not** a secret. It sends the entered PIN over HTTPS to the `issue-admin-code-pin` Edge Function. The PIN is checked against a salted hash in a private database table, with per-source and global attempt limits. The function then inserts a hashed, single-use, ten-minute code into the existing `admin_codes` table. Service-role and code-pepper secrets stay in Supabase; they are never in this repository or the browser. The website does not contain the PIN. The existing GPT issuer, email-protected issuer, and mobile code-redemption function are unchanged.

The owner explicitly chose PIN-only access. A four-digit PIN is weak even with rate limits; anyone who learns it can issue admin codes. Do not treat the unlisted URL as an additional security control. If the PIN may have been exposed, rotate its salted hash through a trusted Supabase management connection. Never commit the PIN or its seed statement to this public repository.

Deploy `supabase/issue-admin-code-pin.ts` as `issue-admin-code-pin` with gateway JWT verification **off** because the function performs server-side PIN authentication and rate limiting itself. Apply `supabase/admin-pin-schema.sql`, then seed `private.web_admin_pin` with a bcrypt hash through a trusted connection. The function uses the project's existing `ADMIN_CODE_PEPPER` and service-role environment variables. Never put the PIN, `ADMIN_CODE_PEPPER`, `ADMIN_ISSUER_SECRET`, or the service-role key into GitHub or an Android/iOS build.

Before changing the privacy page, verify the statements against the shipped app and Supabase configuration, then update its effective date. Do not publish private admin credentials or student details in this repository.
