# Aman Surgical Sales Workspace

Open the private site and sign in using the account with access.

- **Sales sheet** opens first. **New sale** and the pencil on a saved sale open the editor above the register. Use Tab or Enter to accept a customer or instrument suggestion. The **Invoice details** panel holds optional customer city, surgeon, patient, room and IP information.
- **Invoices** lists saved invoices. Open one and use **Print / Save PDF**. Saved invoice numbers are assigned by the database.
- **Reports** charts monthly sales, cost and profit, payment collection, top instruments and outstanding balances by customer. Set the chart period, toggle individual series or expand the monthly figures. Select an instrument or customer in a ranking to filter the report. Instrument filters restrict sales figures to matching lines. Payment figures apply to the matching invoices as a whole.
- **Trash** allows a sale to be restored for 14 days. The workspace purges expired records on its next load.

## Source and runtime

The app uses React and Vinext with Cloudflare D1. The hosted instance uses ChatGPT sign-in and a private access policy. The existing project manifest identifies the live deployment. Use a fresh project identity and a separate database when setting up a separate instance.

The source package includes the transparent invoice logo, application source, lockfile, and database migrations. The hosted database and credentials are separate. Use Node 22.13 or later and run `npm ci`, `npx tsc --noEmit`, and `npm run build` from the project root. See the starter README for local D1 migration commands.
