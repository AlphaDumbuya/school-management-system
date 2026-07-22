# Twilio SMS and WhatsApp Setup Guide

Use this guide before sending SMS, WhatsApp messages, or phone-verification codes from the School Management System.

## What You Need

Before configuring the system, the school must have:

1. A Twilio account with an active billing method or sufficient account balance.
2. A Twilio phone number that is enabled for SMS in the countries to which the school will send.
3. The Twilio **Account SID**.
4. The Twilio **Auth Token**.
5. A principal or super-admin account in the School Management System.
6. A strong, persistent backend `ENCRYPTION_KEY` configured before storing provider credentials.

The Account SID and Auth Token are the only Twilio API credentials required by the current SMS integration. The sender number is also required, but it is a Twilio number, not a secret.

## Credential Reference

| System field | Obtain it from Twilio | Required | Example format |
| --- | --- | --- | --- |
| Account SID | Twilio Console, Account Dashboard | Yes | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| Auth Token | Twilio Console, Account Dashboard | Yes | Secret value; do not share it |
| Sender Number | Twilio Console, Phone Numbers | Yes | `+232760000000` |
| Messaging Service SID | Twilio Console, Messaging, Services | No | Not used by the current integration |
| API Key / API Secret | Twilio Console, Account, API keys | No | Not used by the current integration |

## 1. Create and Secure the Twilio Account

1. Create or sign in to the school-owned account at [Twilio Console](https://console.twilio.com/).
2. Enable two-factor authentication for the account owners.
3. Add a payment method and confirm that the account can send messages to the intended countries.
4. In the Twilio Console Account Dashboard, copy the **Account SID** and reveal/copy the **Auth Token**.

Treat the Auth Token like a password. Do not place it in source code, screenshots, chat messages, `.env.example`, or version control.

### Trial Accounts

Twilio trial accounts generally have destination and feature restrictions. For realistic school testing, upgrade the account before sending to parents, students, or staff who are not explicitly verified test recipients in Twilio.

## 2. Buy and Configure a Sender Number

1. In Twilio Console, open **Phone Numbers** and buy or select a number.
2. Confirm that the number has the **SMS** capability.
3. Use a number in a format Twilio accepts internationally: `+` followed by country code and number, for example `+232760000000`.
4. Review the destination country’s sender-ID, registration, and messaging rules in Twilio before production use. Some countries require pre-registration, templates, local sender IDs, or special approval.

Use the exact Twilio number as the **Sender Number** in the School Management System. The current implementation sends with Twilio's `From` field and does not use a Twilio Messaging Service SID.

## 3. Configure the Backend Encryption Key

The system encrypts stored API secrets, including the Twilio Auth Token, using AES-256-CBC. Set a stable secret in the backend environment before creating the provider:

```env
ENCRYPTION_KEY=replace-with-a-random-secret-of-at-least-32-characters
```

Generate a random value with a password manager or a trusted secret-management tool. Keep the same value across backend restarts and deployments. Changing it after credentials have been saved prevents the application from decrypting the existing Auth Token.

Do not rely on the development fallback encryption key in production.

## 4. Add Twilio in the SMS Dashboard

1. Sign in as a **Principal** or **Super Admin**.
2. Open **Communication > SMS / WhatsApp**.
3. Open the **Providers** tab and select **Add Provider**.
4. Enter these values:

| Dashboard field | Value |
| --- | --- |
| Provider | `Twilio` |
| Channels | `SMS only` for SMS, `WhatsApp only` for WhatsApp, or `SMS & WhatsApp` when the Twilio sender is approved for both |
| Sender Number | The Twilio phone number in E.164 format, for example `+232760000000` |
| Account SID | The Twilio Account SID beginning with `AC` |
| Auth Token | The Twilio Auth Token |

5. Click **Add Provider**.
6. Click **Test** on the new provider. A successful test confirms that the Account SID and Auth Token can authenticate with Twilio.
7. Click **Set Primary** if this is the default provider for this tenant, and ensure it is **Enabled**.

The selected provider is tenant-specific. Each school tenant must configure its own provider or otherwise have an enabled provider assigned to its tenant.

## 5. Verify the First End-to-End SMS

1. In **My Numbers**, add a phone number belonging to a test user and request verification.
2. The system sends the verification code through the enabled primary SMS provider.
3. Enter the received code to mark the recipient phone number as verified.
4. In **Send Message**, choose that verified recipient, enter a short message, and send it.
5. Confirm the outcome in **Message History** and, if necessary, inspect the Twilio Message Logs in Twilio Console.

The system blocks normal messages when the recipient has no verified primary number, has disabled SMS, or has opted out. This is expected behavior.

## WhatsApp With Twilio

Selecting WhatsApp or both channels is not enough by itself. Before using Twilio WhatsApp:

1. Enable and approve the Twilio WhatsApp sender in Twilio.
2. Use the approved WhatsApp sender number in the provider configuration.
3. Ensure recipients have WhatsApp enabled in their phone settings.
4. Create and obtain approval for any WhatsApp templates required by Twilio/Meta policy, especially for business-initiated messages outside the allowed customer-service window.

The current integration sends a direct Twilio Messages API request using `whatsapp:+<number>` values. It does not currently submit a Twilio Content SID, Messaging Service SID, or template variables to Twilio. For approved template-based WhatsApp campaigns, add that capability before production use.

## Delivery Status and Webhooks

The system records the immediate result of sending a message, but this is not a final carrier delivery receipt. Configure a publicly reachable HTTPS webhook in Twilio for delivery status if delivery callbacks are required operationally. The current provider form does not expose a Twilio status-callback setting, so webhook processing must be implemented and deployed before relying on delivered/undelivered callback status.

## Compliance Checklist

Before production messaging, confirm all of the following:

- Consent has been collected for each communication channel.
- Messages include any legally required sender identity and opt-out wording for the destination jurisdiction.
- The school honors opt-outs immediately. The system has an Opt-Outs area and blocks opted-out recipients.
- Twilio geographic permissions are enabled only for required countries.
- Access to Twilio Console and the school SMS dashboard is limited to authorized administrators.
- A rate, cost, and message-content review process exists for bulk sends.
- The school has reviewed local regulations for student and parent communications, including data protection rules.

## Troubleshooting

| Symptom | Likely cause | What to check |
| --- | --- | --- |
| `No SMS provider configured` | No enabled SMS provider exists for the tenant | Add Twilio, enable it, and set it as primary. |
| `Twilio provider is missing account SID or auth token` | A required credential was omitted or cannot be decrypted | Re-enter both credentials and confirm the backend uses the original `ENCRYPTION_KEY`. |
| `'From' ... is not a Twilio phone number` (code `21659`) | The configured sender is not owned by the account or subaccount represented by the saved Account SID/Auth Token | Confirm the provider credentials belong to the same Twilio account that lists the number under Active numbers. For a subaccount number, use that subaccount's SID and Auth Token. |
| Connection test fails | Invalid credentials or Twilio account issue | Confirm SID/token pair in Twilio Console, account status, and outbound network access to `api.twilio.com`. |
| Message fails after connection test succeeds | Sender, recipient, trial, geographic, or compliance restriction | Check Twilio Message Logs for the provider error and verify E.164 number format. |
| Verification code is not received | No provider, unverified/invalid destination, or Twilio delivery restriction | Confirm a primary enabled SMS provider and inspect Message History and Twilio logs. |
| WhatsApp message fails | Sender not approved, recipient not opted in, or template/policy requirement | Complete Twilio WhatsApp onboarding and use a compliant message flow. |

## Ongoing Credential Management

When rotating the Twilio Auth Token, update the provider in **Providers** immediately after the token is changed in Twilio. In the edit form, leave credential fields blank only when retaining existing values. Restrict this task to principals and super admins, and record the rotation according to the school's security policy.