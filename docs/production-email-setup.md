# Production company email setup

The application is complete with email notifications disabled. Forms, database persistence, admin workflows, and newsletter subscriptions do not depend on SMTP.

## Before the company mailbox exists

Set this backend environment variable:

```env
MAIL_ENABLED=false
```

SMTP variables may remain empty. Submissions are stored normally and their email-delivery status is `DISABLED`, not `FAILED`. The admin dashboard remains the authoritative record.

## After purchasing the production domain

1. Create the company mailbox in Zoho Mail.
2. In the domain DNS provider, configure the MX records supplied by Zoho.
3. Configure SPF and DKIM using Zoho's current instructions.
4. Add an appropriate DMARC policy after SPF and DKIM verify successfully.
5. Generate a Zoho app password when the mailbox security settings require one.

DNS and mailbox configuration happen outside this repository.

## Hostinger backend environment variables

Add the following to the backend application's environment settings. Do not add SMTP secrets to frontend or `VITE_` variables.

```env
MAIL_ENABLED=true
SMTP_HOST=<SMTP hostname supplied by the provider>
SMTP_PORT=<SMTP port supplied by the provider>
SMTP_SECURE=<true or false as required by that port>
SMTP_USER=<company mailbox username>
SMTP_PASS=<mailbox app password>

MAIL_FROM_NAME=X Dental Store
MAIL_FROM_EMAIL=<company sender mailbox>
COMPANY_NOTIFICATION_EMAIL=<default company recipient>

CONTACT_NOTIFICATION_EMAIL=
NEWSLETTER_NOTIFICATION_EMAIL=
QUOTE_NOTIFICATION_EMAIL=
PRODUCT_REQUEST_NOTIFICATION_EMAIL=
MACHINE_INQUIRY_NOTIFICATION_EMAIL=
SUPPORT_NOTIFICATION_EMAIL=

APP_BASE_URL=https://<production-site-origin>
```

Each form-specific recipient is optional and falls back to `COMPANY_NOTIFICATION_EMAIL`. `MAIL_ENABLED=true` requires the SMTP host, port, secure flag, username, password, sender email, default company recipient, and application base URL. Startup fails with a safe list of missing variable names when configuration is incomplete; passwords are never printed.

After saving the variables, restart or redeploy the backend. A frontend rebuild is not required when the frontend and backend are deployed separately. No source-code changes are required.

## Production verification

1. Submit the public contact form.
2. Confirm the contact record appears in **Admin → Support**.
3. Confirm the company notification arrives.
4. Confirm its dashboard delivery status is `SENT`.
5. Use the email client's Reply action and verify it targets the submitted customer address.
6. Temporarily provide an invalid SMTP credential in a controlled maintenance window and submit a test record.
7. Confirm the saved form remains successful while delivery becomes `FAILED`.
8. Restore the valid credential, restart the backend, and use **Admin → Settings → Company email notifications → Retry**.
9. Confirm the existing record is reused, its retry count increases, and its status becomes `SENT`.

Never test failures against live customer submissions. Do not commit production credentials.
