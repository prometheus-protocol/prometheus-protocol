# 🚀 Verifier Bot - Quick Deployment Guide

This guide will get you from zero to a running automated verifier in **under 30 minutes**.

## ✅ Pre-Flight Checklist

Before starting, make sure you have:

- [ ] Docker installed and running
- [ ] `dfx` CLI installed
- [ ] Access to the `audit_hub` canister owner identity
- [ ] A Render.com account (free tier works for testing)

---

## 📋 Step-by-Step Deployment

### 1️⃣ Create the Verifier Identity (5 minutes)

```bash
# Navigate to your dfx config
cd ~/.config/dfx/identity

# Create a new identity for the verifier
dfx identity new verifier

# Switch to it
dfx identity use verifier

# Export the private key
dfx identity export verifier > verifier.pem

# Get the principal (save this!)
dfx identity get-principal
```

**Save the output** - this is your verifier's principal. Example:

```
xyz12-abc34-def56-ghi78-jkl90-mno12-pqr34-stu56-vwx78-yza90-bcd
```

### 2️⃣ Mint Reputation Tokens (2 minutes)

Switch back to the owner identity and mint tokens:

```bash
# Switch to owner identity
dfx identity use default

# Mint 10 million reputation tokens to the verifier
dfx canister call audit_hub mint_tokens \
  '(principal "xyz12-abc34-...", "build_reproducibility_v1", 10_000_000)' \
  --network ic
```

**Verify it worked**:

```bash
dfx canister call audit_hub get_auditor_profile \
  '(principal "xyz12-abc34-...")' \
  --network ic
```

You should see:

```
record {
  available_balances = vec { record { "build_reproducibility_v1"; 10_000_000 } };
  staked_balances = vec {};
  reputation = vec { record { "build_reproducibility_v1"; 10_000_000 } };
}
```

### 3️⃣ Test Locally (10 minutes)

```bash
# Navigate to the verifier-bot directory
cd packages/apps/verifier-bot

# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Set environment variables
export VERIFIER_PEM="$(cat ~/.config/dfx/identity/verifier/identity.pem)"
export IC_NETWORK="ic"
export POLL_INTERVAL_MS="60000"

# Run the bot (press Ctrl+C to stop)
pnpm start
```

**Expected output**:

```
🤖 Prometheus Protocol Verifier Bot
====================================
🆔 Verifier Principal: xyz12-abc34-...
🌐 Network: ic
⏱️  Poll Interval: 60000ms
====================================

🚀 Verifier Bot is starting...
✅ Verifier Bot is now running
   Polling every 60 seconds

🔍 [2025-11-02T12:00:00.000Z] Polling for pending verifications...
   Found 0 pending verification(s)
```

If you see this, the bot is working! Now deploy it to production.

### 4️⃣ Deploy to Render.com (10 minutes)

#### A. Prepare the Repository

Make sure your changes are committed and pushed:

```bash
git add packages/apps/verifier-bot
git commit -m "Add automated verifier bot"
git push origin main
```

#### B. Create the Service

1. Go to https://render.com/dashboard
2. Click **New +** → **Background Worker**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `prometheus-verifier-bot`
   - **Region**: Oregon (or closest to your users)
   - **Branch**: `main`
   - **Root Directory**: `packages/apps/verifier-bot`
   - **Docker Command**: (leave blank - uses Dockerfile)
   - **Instance Type**: Starter ($7/mo) is fine for testing

#### C. Add Environment Variables

Click **Advanced** → **Add Environment Variable** and add:

```
VERIFIER_PEM
```

Paste the **entire contents** of `~/.config/dfx/identity/verifier/identity.pem`, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines.

```
IC_NETWORK = ic
POLL_INTERVAL_MS = 60000
```

#### D. Deploy

Click **Create Background Worker**. Render will:

1. Clone your repo
2. Build the Docker image
3. Start the bot

This takes ~5 minutes. Monitor the **Logs** tab.

### 5️⃣ Verify It's Working (3 minutes)

#### Check Render Logs

You should see:

```
🤖 Prometheus Protocol Verifier Bot
====================================
🆔 Verifier Principal: xyz12-abc34-...
🌐 Network: ic
⏱️  Poll Interval: 60000ms
====================================

🚀 Verifier Bot is starting...
✅ Verifier Bot is now running
   Polling every 60 seconds
```

#### Test with a Real Verification

1. Go to the App Store UI
2. Find a pending verification with a bounty
3. Wait 1-2 minutes
4. Check Render logs - you should see:
   ```
   🎯 Processing verification job
      WASM Hash: abc123...
      Repo: https://github.com/...
      Commit: def456...
   ```

---

## 🎉 Success!

Your verifier bot is now:

- ✅ Polling every 60 seconds
- ✅ Automatically building WASMs
- ✅ Submitting attestations
- ✅ Earning bounty rewards

## 📊 Monitoring

### Daily Checks

- **Render Dashboard**: Check logs for errors
- **Reputation Balance**: Should stay stable (earned bounties ≈ staked amounts)
- **Successful Verifications**: Should see `✅ WASM ... is now VERIFIED`

### Weekly Checks

- **Reputation Balance**: Top up if below 1 million
- **Build Times**: Should be 2-10 minutes per build
- **Error Rate**: Should be <5% (mostly hash mismatches from developers)

---

## 🐛 Troubleshooting

### "No pending verification(s)" forever

**Cause**: No one has sponsored bounties yet.

**Solution**:

1. Go to App Store UI → Audit Hub → Pending Verifications
2. Click "Sponsor" on a pending request
3. Wait 1 minute, check logs

### "Insufficient available balance to stake"

**Cause**: Bot ran out of reputation tokens.

**Solution**:

```bash
dfx canister call audit_hub mint_tokens \
  '(principal "xyz12-abc34-...", "build_reproducibility_v1", 10_000_000)' \
  --network ic
```

### "Cannot connect to Docker daemon"

**Cause**: Render doesn't support Docker-in-Docker by default.

**Solution**:

- Use Render's "Native Environment" plan (requires upgrade)
- Or deploy to AWS ECS / Google Cloud Run instead

---

## 🔒 Security Reminders

- ⚠️ **Never commit `verifier.pem` to git**
- ⚠️ Store `VERIFIER_PEM` only in Render's secret manager
- ⚠️ Rotate the identity every 3-6 months
- ⚠️ Monitor for unexpected stake slashing (sign of compromise)

---

## 📚 Next Steps

Now that Phase 1 is running, consider:

1. **Monitor for a week** - Make sure it's stable
2. **Adjust reputation mint rate** - Based on bounty frequency
3. **Add PicJS tests** - Verify behavior, not just builds
4. **Plan Phase 2** - Decentralized verifier network

---

## 🆘 Need Help?

- **Render logs show errors**: Check SPEC.md "Troubleshooting" section
- **Bot is slashed**: Identity may be compromised, rotate immediately
- **Hash mismatches**: Educate developers on reproducible builds (libs/icrc118/README.md)

---

**Congratulations!** You've just automated the most critical bottleneck in your app store. The system is now trustless, scalable, and always online. 🚀
