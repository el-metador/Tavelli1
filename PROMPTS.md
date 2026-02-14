# Tavelli Development Prompts

Here is the breakdown of the project plan into specific prompts for different stages of development.

## 1. Frontend Generation Prompt
"Act as a Senior React Engineer. Create a modern, responsive email client interface named 'Tavelli' using React, TypeScript, and Tailwind CSS. The design language should be Material Design 3 (Material You) with 'AI-minimalism' aesthetics—plenty of whitespace, rounded corners (2xl), and soft pastel colors.
Key Features to implement:
- A Sidebar navigation.
- An Inbox list that supports a 'Strict Mode' toggle to hide non-essential emails.
- An Email Detail view that features a prominent 'AI Insight' card at the top.
- The AI card should dynamically show 'Hot Actions' buttons like 'Copy Code' or 'Verify Link' based on email content.
- Use mock data to demonstrate an email from 'Airbnb Security' (verification code) and 'Booking.com' (ban appeal).
- Ensure the layout is responsive (mobile-first)."

## 2. Backend Generation Prompt
"Act as a Backend Engineer. Design a Node.js/Express API structure for the 'Tavelli' mail app. 
Requirements:
- Create an endpoint `/api/analyze-email` that accepts email content.
- Integrate with the Gemini API to process the text.
- The AI prompt should instruct Gemini to:
  1. Summarize the email.
  2. Detect sentiment.
  3. Extract specific entities: Verification Codes (6 digits), Verification Links, or Appeal Contexts.
  4. Return JSON format: `{ summary: string, actions: [{ label: string, type: 'copy'|'link'|'reply', value: string }] }`.
- Implement a caching layer (Redis) so the same email isn't re-analyzed unnecessarily.
- Create a subscription middleware to check if the user is Free, Pro, or Enterprise."

## 3. LLM System Prompt (for the AI Agent)
"You are Tavelli AI, an intelligent email assistant. Your goal is to save the user time and reduce anxiety.
Input: An email body.
Task:
1.  **Categorize**: Is this Urgent (Security/Waitlist/Money), Important (Work/Personal), or Noise (Ads)?
2.  **Extract**: If there is a 4-8 digit numeric code, extract it. If there is a 'Verify Email' link, extract the URL.
3.  **Action**:
    - If it's a verification email, your output must highlight the code.
    - If it's a ban/suspension email, draft two reply options: one 'Polite/Apologetic' and one 'Firm/Clarification'.
    - If it's a long thread, provide a 2-sentence summary.
Output Format: JSON."

## 4. Integration Prompt (Gmail/Notion Mail)
"Write a TypeScript service that acts as an adapter for the Gmail API. 
Functions needed:
- `fetchRecentEmails(limit: 10)`: Get full details of the last 10 messages.
- `watchInbox()`: Set up a Pub/Sub listener for new incoming emails to trigger immediate AI analysis.
- `sendDraft(draftId)`: Finalize and send.
- Handle OAuth2 authentication flows securely. Ensure the scopes requested are minimal but sufficient for reading and sending mail."

## 5. Feature Addition Prompt (SaaS & Enterprise)
"Extend the existing React application to support multi-tenancy for Enterprise users.
1. Update the `User` type to support multiple linked email accounts (up to 10 for Enterprise).
2. Create a 'Signature Generator' component that uses the user's uploaded logo and company details to create an HTML signature.
3. Add a 'Smart Auto-Reply' setting in the dashboard where the user can set AI personas (e.g., 'Professional', 'Casual') that automatically draft replies for specific incoming email tags."
