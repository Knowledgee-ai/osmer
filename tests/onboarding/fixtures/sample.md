# Acme Corp Q1 Plan

Acme Corp closed Q1 2026 with $2.4M in net new revenue across the SaaS line. The renewal pipeline for the next two quarters looks healthy: 18 of 22 enterprise accounts have already opened renewal conversations, and the team expects to close 14 of those before April 30.

## Customer success notes

Globex Industries has been the standout account this quarter. They expanded from 50 seats to 240 seats in March after the marketing automation module shipped. Their primary contact, Sarah Lee, has agreed to provide a public case study in May.

TechCorp signed an NDA in February but the deal has stalled in legal review. The hold-up is the data residency clause — they need data stored in EU regions, and our infrastructure is currently single-region in us-east-1. The platform team is scoping a multi-region rollout for late Q2.

## Product priorities

The leadership team agreed on three priorities for Q2:

1. Ship the analytics module by April 30. Engineering lead is Mike, with help from the data team.
2. Reduce churn from the SMB segment. Current annualized churn is 14%; target is 9% by end of Q2. The customer success team is leading.
3. Validate the enterprise tier pricing. We doubled the seat price from $30 to $50 last month and want to know if it stuck. Marketing is running a customer survey.

## Team and process

The engineering team will rotate on-call starting in Q2 — currently Mike covers everything, which is unsustainable. The new schedule is one week per engineer, with handoffs in the #oncall-eng Slack channel.

We deploy on Vercel. The decision was made in Q4 last year after evaluating AWS, GCP, and Vercel. The choice was driven by velocity: less yak-shaving with raw cloud infrastructure means more time on the actual product.

## Outstanding decisions

We have not yet decided on a CRM. Salesforce is overkill for our size; HubSpot is the most likely choice. The sales team uses Notion for now, which is increasingly painful. A decision is expected by end of April.

We are also evaluating moving from Stripe to Adyen for international payments. Stripe's coverage in LATAM is weak, and three of our largest prospects are based there. Finance is doing the cost modeling.
