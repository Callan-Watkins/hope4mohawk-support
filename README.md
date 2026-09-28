# Hope 4 Mohawk support site

Static public support and privacy pages for the Hope 4 Mohawk app, plus an owner-only admin-code page. GitHub Pages publishes the `main` branch root. The support/privacy pages have no JavaScript or tracking. The admin page has small first-party JavaScript and connects only to this club's Supabase project.

- Support: `https://callan-watkins.github.io/hope4mohawk-support/`
- Privacy: `https://callan-watkins.github.io/hope4mohawk-support/privacy.html`
- Organizer issuer: `https://callan-watkins.github.io/hope4mohawk-support/admin/`

## Admin-code issuer

`admin/` is a public static shell, **not** a secret. It sends an email sign-in request to Supabase Auth, holds the resulting access token only in memory, then calls the separately deployed `issue-admin-code-web` Edge Function. The function rechecks the authenticated user's verified email against the sole approved owner address before inserting a hashed, single-use, ten-minute code into the existing `admin_codes` table. Service-role and code-pepper secrets stay in Supabase; they are never in this repository or the browser. The function limits recent/active codes and rejects unapproved browser origins. The existing GPT issuer and mobile code-redemption function are unchanged.

The Auth email delivery and redirect must be configured in Supabase for the owner email. Add the exact `/admin/` URL above to Auth's redirect allow list. Use an email template with the default `{{ .ConfirmationURL }}` link, or include `{{ .Token }}` if you want the page's numeric-code form. Supabase's default email sender may only deliver to team addresses and has a very low rate limit; use a configured SMTP sender for reliable delivery. Test the full sign-in and code-redemption flow before depending on the portal.

Deploy `supabase/issue-admin-code-web.ts` as the `issue-admin-code-web` Edge Function with JWT verification on. It uses the project's existing `ADMIN_CODE_PEPPER` and service-role environment variables. Never put `ADMIN_CODE_PEPPER`, `ADMIN_ISSUER_SECRET`, or the service-role key into GitHub or an Android/iOS build.

Before changing the privacy page, verify the statements against the shipped app and Supabase configuration, then update its effective date. Do not publish private admin credentials or student details in this repository.
