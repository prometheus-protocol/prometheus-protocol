## Fixing the Biggest Trust Problem in Crypto AI

Let's talk about trust. When you download an app, you're trusting it not to be a piece of malware. But what if that app could control your money? Your crypto? Your AI agents that are supposed to be making you money?

The stakes get a lot higher.

In the world of AI agents, especially on the Internet Computer, these apps (we call them MCP servers) can manage thousands, even millions of dollars. They can move tokens, trade on exchanges, and manage entire treasuries.

This brings us to a huge problem.

### The Problem: Is the Software You're Running What You _Think_ You're Running?

Most of this cool new software is open source. That means you can go to a site like GitHub and read the code yourself. It's all out in the open.

But here's the catch: how do you know the app you downloaded and installed is an exact match for the public code on GitHub?

Think of it like a factory seal on a bottle of medicine. The label lists the ingredients (the source code), but the seal is what guarantees that what's _inside_ the bottle is what's on the label.

Without that seal, a malicious developer could:

1.  Show you clean, safe code on GitHub.
2.  Secretly add one tiny, malicious line to the version they give you to download.
3.  That one line could be `send_all_of_users_money_to_hacker.wallet`.

And just like that, your funds are gone. The "trust me, bro" model doesn't work when real money is on the line.

### The Old Solution (That Nobody Uses)

The tech world solved this with something called "reproducible builds." It's a fancy way of saying that if you and I take the exact same source code and build it with the exact same tools, we should get a byte-for-byte identical app. A perfect match.

So, in theory, you could just rebuild the app yourself and compare it to the official download.

**In practice, almost no one does this.** It's slow, complicated, and you need to be a serious techie to pull it off. There's no incentive. It's a security feature that gives a false sense of security because it's too hard for regular people to use.

We need a better way. We need to automate it.

## Our Solution: A Network of Robot Inspectors

We built a system at Prometheus Protocol that fully automates this process. Think of it as a global team of independent, robot inspectors who work 24/7.

Here’s how it works, in simple steps:

1.  **A developer submits their app.** They provide the app and a link to the source code on GitHub.
2.  **We put up a cash prize (a "bounty").** This prize money attracts our robot inspectors.
3.  **Robot inspectors get to work.** Bots from all over the world automatically download the source code and build the app in a secure, clean environment.
4.  **They compare the results.** Each bot compares its result to the developer's official version.
5.  **The verdict.** If enough independent bots (say, 5 out of 9) all produce the exact same result, the app gets a "Verified" stamp. The bots that did the work get paid automatically.

The entire process is handled by code and smart contracts. No humans in the middle. No one to bribe or persuade. Just pure, cryptographic proof.

### The Tech Behind the Magic

For those who want to know _how_, we use a set of new standards on the Internet Computer:

- **ICRC-118 (Wasm Registry):** A version-control system for apps.
- **ICRC-120 (Canister Orchestration):** A safe way to install and upgrade apps.
- **ICRC-126 (Wasm Verification):** The system for recording the "Verified" stamps.
- **ICRC-127 (Generic Bounty System):** The system for offering cash prizes to the robot inspectors.

These are the building blocks for a trustless, automated world.

---

### A Look Under the Hood: The 6 Steps

#### Step 1: Developer Submits Their App

A developer registers their new app version in our system. They provide the code's location and what the final "hash" (a unique digital fingerprint) should be. Initially, it's marked as `validated = false`.

```motoko
// A developer calls this function to register their new software version.
// It's like filing paperwork, but with code.
public shared(msg) func icrc118_update_wasm(req: UpdateWasmRequest) {
  // ... code that stores the app's info ...
  // ... and sets its status to "pending verification" ...
}
```

Then, they create the cash prize to get it verified. We require 9 independent verifications for maximum security, but it's super cheap—about $2.25 total.

```typescript
// We create 9 separate bounties. First come, first served for the bots.
const TOTAL_VERIFIERS = 9;
const COST_PER_VERIFICATION = 250_000n; // $0.25 in USDC

for (let i = 0; i < TOTAL_VERIFIERS; i++) {
  await createBounty(/* ... details ... */);
}
```

#### Step 2: Robot Inspectors Spot the Job

Our network of verifier bots is always watching. They see the new app and the bounties.

```typescript
// The bot's main loop: look for work, do the work, get paid.
async function pollAndVerify() {
  const pending = await listPendingVerifications(); // Find new jobs
  for (const job of pending) {
    // ... check for a bounty ...
    await reserveBounty(job); // Claim one of the 9 spots
    const result = await verifyBuild(job); // Do the actual work
    // ... file the result and claim the cash ...
  }
}
```

#### Step 3: The Automated Build

This is the core of the system. The bot uses Docker (a tool for creating clean, identical environments) to build the software from scratch. No human hands touch it.

```typescript
// A simplified look at the build script.
export async function verifyBuild(repo, commitHash, expectedWasmHash) {
  // 1. Clone the code from GitHub
  execSync(`git clone ${repo}`);
  execSync(`git checkout ${commitHash}`);

  // 2. Build it inside a locked-down Docker container
  execSync(`docker-compose build --no-cache`);
  execSync(`docker-compose run wasm`);

  // 3. Calculate the hash (digital fingerprint) of the result
  const actualHash = crypto
    .createHash('sha256')
    .update(wasmBytes)
    .digest('hex');

  // 4. Compare it to the developer's expected hash
  return { success: actualHash === expectedWasmHash };
}
```

#### Step 4: Filing the Proof

If the hash matches, the bot files a success report (an "attestation") on the blockchain. This is a permanent, public record.

```motoko
// The function that records the bot's successful verification.
public shared (msg) func icrc126_file_attestation(req: AttestationRequest) {
  // ... verify the bot was authorized to do this job ...
  // ... store the attestation record forever ...
  // ... check if we have enough verifications to finalize ...
}
```

#### Step 5: Majority Rules

We don't just trust one bot. We wait for a majority (e.g., 5 out of 9) to report the exact same successful result. Once that threshold is hit, the app's status officially flips to "Verified." This protects against a few bots being broken or malicious.

#### Step 6: Automatic Payout

The moment a bot files its successful report, the smart contract automatically pays out the bounty reward (e.g., $0.25 USDC) to the bot's owner. The process is instant.

---

### Why This Is a Game-Changer

| The Old Way (Manual)                                  | The Prometheus Way (Automated)                           |
| :---------------------------------------------------- | :------------------------------------------------------- |
| **Slow & Manual:** Takes hours or days.               | **Fast & Automated:** Takes 1-5 minutes.                 |
| **Relies on Trust:** You trust a person's screenshot. | **Relies on Proof:** You trust math and code.            |
| **No Incentive:** Why would anyone do this for free?  | **Economic Incentive:** Bots get paid for their work.    |
| **Centralized:** A few key people are the authority.  | **Decentralized:** Anyone can run a bot and participate. |

We even reward bots for finding problems! If a build _fails_ to match, the bot can file a "divergence report" and still get paid for finding the issue. This encourages honesty.

### The Money: How Everyone Wins

- **For App Makers:** For a tiny fee (~$2.25), they get a powerful "Verified" badge that gives users the confidence to use their app.
- **For Verifiers (You!):** You can run a bot and earn passive income. It's a volume game—each verification pays a little, but a bot can run hundreds per day.
- **For Users:** You get to use powerful financial AI tools with peace of mind, knowing the code has been independently checked. For free.

### Real-World Impact: Before vs. After

**Before:**

- **User:** "This AI app wants to manage my $100k portfolio. Is it safe?"
- **Developer:** "Trust me, bro. The code is on GitHub."
- **Result:** The user gets scared and doesn't use the app. The ecosystem stagnates.

**After:**

- **User:** Sees a badge: "✅ Verified by 9 independent bots."
- **User:** Clicks to see the on-chain proof—a list of the bots that verified it.
- **Result:** The user confidently grants permissions. The ecosystem of AI agents managing real value can finally grow.

---

## Want to Become a Robot Inspector?

Ready to earn some crypto by helping secure the network? It's easier than you think.

1.  **Set Up Your Account:** Go to our **Verifier Dashboard**, connect your wallet, and deposit a small amount of USDC to act as your "stake" (a security deposit that proves you're serious).
2.  **Get Your API Key:** The dashboard will give you a secure key for your bot to use.
3.  **Run the Bot:** We provide an open-source bot. You just need a simple server (a $5/month VPS is fine) and Docker.

```bash
# Clone the bot's code
git clone https://github.com/prometheus-protocol/prometheus-protocol
cd packages/apps/verifier-bot

# Add your API key to the config file
cp .env.example .env

# Start the bot!
pnpm start
```

Your bot will start looking for jobs, doing the work, and depositing earnings directly into your dashboard account. You can monitor everything and withdraw your profits anytime.

### What This System _Doesn't_ Do

One crucial point: **We verify that the deployed app matches the source code. We do NOT audit the source code for bugs or security holes.**

Think of it this way: We put the factory seal on the bottle. A separate process, a security audit, is needed to check if the ingredients themselves are safe. The best apps will have both: a "Verified Build" stamp from us, and a "Security Audit" badge from a firm like [Areta](https://areta.fi).

## The Future is Verifiable

The days of "trust me, bro" are over. We're building a future where you don't have to trust developers with your money—you can trust the math. By automating verification, we're creating the trust layer for an open economy of AI agents.

This is how we unlock the next wave of decentralized applications.

---

### Join Us

- **Developers**: Get your app verified at [prometheusprotocol.org](https://prometheusprotocol.org/)
- **Verifiers**: [Run a bot and start earning](https://github.com/prometheus-protocol/prometheus-protocol/tree/main/packages/apps/verifier-bot)
- **Community**: [Join our Discord](https://discord.gg/TbqgYERjYw)
