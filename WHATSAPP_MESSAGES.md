# WhatsApp Message Types - "See More" Issue

## The Problem

When you send a **template message**, WhatsApp shows "See more" for long text because:
- Templates have strict formatting rules
- Templates are designed for standardized business messages
- Templates have character limits per section (header, body, footer)
- Templates must be pre-approved by Meta

Other bots don't show "See more" because they send **regular text messages**, not templates.

---

## Solution Options

### Option 1: Template + Follow-up Text (Current Implementation)

Send the template (required for first contact), then immediately send a text message:

```typescript
// 1. Send template (required for 24-hour window)
await this.whatsapp.sendTemplateMessage(
  from,
  'eska_job_title_prompt',
  'fr',
  [],
  { recipientType: 'individual' }
)

// 2. Send long text message (no limits, no "See more")
await this.whatsapp.sendTextMessage(
  from,
  'Your very long message here...',
  {
    recipientType: 'individual',
    previewUrl: false
  }
)
```

**Pros:**
- Complies with WhatsApp policies (template for first message)
- No "See more" on the detailed text message
- Can send unlimited text

**Cons:**
- Sends two separate messages
- Template must still be approved

---

### Option 2: Text Message Only (If User Initiated)

If the user messages you first, you DON'T need a template. You can reply with a regular text message:

```typescript
// For first message (user-initiated conversation)
if (!existingUser) {
  await this.botUserRepo.create({
    phoneNumber: from,
    preferences: {},
  })

  // Send typing indicator
  await this.whatsapp.sendTypingIndicator({
    messageId: messageId,
    type: 'text',
  })

  // Send text message directly (no template needed!)
  const welcomeMessage = `
Bonjour! 👋

Bienvenue sur notre service de recherche d'emploi.

Pour commencer, veuillez me dire quel type de poste vous recherchez.

Vous pouvez être aussi précis que vous le souhaitez - par exemple:
• Développeur web junior
• Responsable marketing digital
• Comptable avec 5 ans d'expérience
• etc.

Je suis là pour vous aider à trouver les meilleures opportunités! 🚀
  `.trim()

  await this.whatsapp.sendTextMessage(
    from,
    welcomeMessage,
    {
      recipientType: 'individual',
      previewUrl: false
    }
  )

  await this.whatsapp.markMessageAsRead(messageId)
}
```

**Pros:**
- No "See more" - unlimited text length
- No template approval needed
- Simpler implementation
- Better user experience

**Cons:**
- Only works if user messages first (not for proactive outreach)

---

### Option 3: Fix Your Template

Make your template shorter and more concise. Templates should be brief prompts, not long explanations.

**Template guidelines:**
- **Header**: Max 60 characters
- **Body**: Max 1024 characters (but keep it under 500 for best display)
- **Footer**: Max 60 characters

**Example of a good template:**

```
[HEADER] Bienvenue! 👋

[BODY]
Quel type de poste recherchez-vous?

Exemple: "Développeur web" ou "Marketing digital"

[FOOTER] Répondez pour commencer
```

---

## Recommendation

**For user-initiated conversations (your use case):**

Use **Option 2** - Send a text message directly. Since the user is messaging you first, you don't need a template at all!

**Implementation:**

Replace the template code in `whatsapp-message.service.ts` with:

```typescript
if (!existingUser) {
  await this.botUserRepo.create({
    phoneNumber: from,
    preferences: {},
  })

  await this.whatsapp.sendTypingIndicator({
    messageId: messageId,
    type: 'text',
  })

  const welcomeMessage = `
Votre message de bienvenue ici...
Aussi long que vous voulez!
Pas de limite de caractères.
Pas de "Voir plus".
  `.trim()

  await this.whatsapp.sendTextMessage(
    from,
    welcomeMessage,
    {
      recipientType: 'individual',
      previewUrl: false
    }
  )

  await this.whatsapp.markMessageAsRead(messageId)
  Logger.success('Welcome message sent', { to: from })
}
```

---

## When Do You NEED Templates?

You only need templates in these cases:

1. **Proactive messaging** - When YOU message the user first (not in response)
2. **After 24-hour window** - If conversation is inactive for 24+ hours
3. **Notifications** - Order confirmations, shipping updates, etc.

If the user messages you first, you're in the **24-hour window** and can send regular text messages freely!

---

## Current Code

The code currently has both options commented. To use text-only:

1. Remove the template code
2. Uncomment and customize the text message section
3. Replace the template content with your long message

See `src/services/whatsapp-message.service.ts` lines 56-99.
