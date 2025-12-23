# WhatsApp Webhook Setup Guide

## Problem
When you send a message from WhatsApp, it shows as "sent" in your chat but isn't received by your code.

## Solution
You need to configure the webhook in your WhatsApp Business Account to point to your server.

---

## Step 1: Expose Your Local Server

Since your server runs on `localhost:3000`, you need to make it accessible from the internet.

### Option A: Using ngrok (Recommended)

1. Install ngrok: https://ngrok.com/download
2. Run:
   ```bash
   ngrok http 3000
   ```
3. You'll get a URL like: `https://abc123.ngrok.io`
4. **Keep this terminal running!**

### Option B: Using Cloudflare Tunnel

1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. Run:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

---

## Step 2: Test Your Webhook Endpoint

Before configuring in Meta, test that your endpoint is reachable:

```bash
# Replace with your ngrok URL
curl https://your-ngrok-url.ngrok.io/webhook/test
```

You should see:
```json
{
  "status": "ok",
  "message": "Webhook endpoint is reachable",
  "timestamp": "2025-12-23T..."
}
```

---

## Step 3: Configure Webhook in Meta for Developers

1. **Go to Meta for Developers**
   - Visit: https://developers.facebook.com/
   - Log in with your Facebook account

2. **Select Your App**
   - Click on your WhatsApp Business app
   - Go to: **WhatsApp** → **Configuration** (in left sidebar)

3. **Configure Webhook**
   - Find the "Webhook" section
   - Click **Edit** button
   - Enter the following:

   **Callback URL:**
   ```
   https://your-ngrok-url.ngrok.io/webhook/whatsapp
   ```

   **Verify Token:**
   ```
   your-secure-verify-token-here
   ```
   (This must match the `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your `.env` file)

4. **Click "Verify and Save"**
   - Meta will send a GET request to verify your webhook
   - You should see a success message
   - Check your server logs - you should see: `Webhook verified successfully`

---

## Step 4: Subscribe to Webhook Fields

After verification, you need to subscribe to receive messages:

1. In the same **Webhook** section, find **Webhook fields**
2. Click **Manage** or **Subscribe**
3. Enable these fields:
   - ✅ **messages** (REQUIRED - to receive messages)
   - ✅ **message_status** (optional - for delivery/read status)

4. Click **Save**

---

## Step 5: Test Sending a Message

1. **Make sure your server is running:**
   ```bash
   bun run dev
   ```

2. **Send a test message from WhatsApp**
   - Send a message to your WhatsApp Business number
   - This should be a user's FIRST message

3. **Check your server logs**
   - You should see:
     ```
     {"level":"INFO","message":"Received WhatsApp webhook",...}
     {"level":"INFO","message":"Processing incoming message",...}
     {"level":"INFO","message":"First message from user, creating user record",...}
     {"level":"INFO","message":"Sending template message",...}
     {"level":"SUCCESS","message":"Template message sent successfully",...}
     ```

4. **Check WhatsApp**
   - You should receive the template `eska_job_title_prompt` in French

---

## Troubleshooting

### Webhook verification fails
- ✅ Make sure `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `.env` matches what you entered in Meta
- ✅ Make sure ngrok/cloudflared is still running
- ✅ Test your endpoint: `curl https://your-url.ngrok.io/webhook/test`
- ✅ Check server logs for errors

### Messages not received
- ✅ Verify webhook fields are subscribed (especially "messages")
- ✅ Check if ngrok URL has changed (it changes every time you restart ngrok free version)
- ✅ Update webhook URL in Meta if ngrok URL changed
- ✅ Check server logs for incoming requests
- ✅ Test with: `curl -X POST https://your-url.ngrok.io/webhook/whatsapp -H "Content-Type: application/json" -d '{"test": true}'`

### Template message fails
- ✅ Make sure template `eska_job_title_prompt` exists in your WhatsApp Business Account
- ✅ Make sure template is approved by Meta
- ✅ Make sure template language is set to French (`fr`)
- ✅ Check that template has NO parameters (or update the code to pass parameters)

### ngrok URL keeps changing
- Free ngrok URLs change on restart
- Consider using ngrok paid plan for static URLs
- Or use cloudflared (free static URLs)
- Or deploy to a real server (Railway, Render, etc.)

---

## Production Deployment

For production, deploy your server to a hosting provider with a static URL:

- **Railway**: https://railway.app
- **Render**: https://render.com
- **Fly.io**: https://fly.io
- **DigitalOcean**: https://digitalocean.com

Then configure the webhook URL to: `https://your-domain.com/webhook/whatsapp`

---

## Current Configuration

Your current setup:
- **Webhook URL**: `https://your-ngrok-url/webhook/whatsapp`
- **Verify Token**: `your-secure-verify-token-here`
- **Template Name**: `eska_job_title_prompt`
- **Template Language**: `fr` (French)
- **Template Parameters**: None (empty array)

---

## Quick Checklist

- [ ] Server is running (`bun run dev`)
- [ ] ngrok/cloudflared is running and exposing port 3000
- [ ] Webhook is configured in Meta for Developers
- [ ] Webhook fields are subscribed (messages)
- [ ] Template `eska_job_title_prompt` exists and is approved
- [ ] Sent a test message from WhatsApp
- [ ] Checked server logs for incoming webhook
- [ ] Received template response in WhatsApp
