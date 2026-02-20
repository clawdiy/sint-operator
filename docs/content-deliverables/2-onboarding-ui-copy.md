# Deliverable 2: Onboarding UI Copy

## Flow: 4 Steps → First Content Generated

---

### Step 1: Welcome Screen

**Headline:** `Upload one asset. Get a week of content.`

**Subhead:** `SINT Marketing Operator turns your blog posts, videos, and ideas into platform-ready social content. Set up in 2 minutes.`

**CTA Button:** `Get Started →`

**Footer:** `Already have an account? Log in`

---

### Step 2: API Key Setup

**Headline:** `Connect your AI engine`

**Subhead:** `We use your API key so you control costs and data. Keys are encrypted and never leave your server.`

**Input Label:** `OpenAI API Key`
**Input Placeholder:** `sk-...`
**Helper Text:** `Get one at platform.openai.com/api-keys → Create new secret key`

**Input Label:** `Anthropic API Key (optional)`
**Input Placeholder:** `sk-ant-...`
**Helper Text:** `For higher-quality long-form content. Get one at console.anthropic.com`

**Info Box:**
```
💡 Why bring your own key?
- You pay only for what you use (no markup)
- Your content never trains third-party models
- Switch providers anytime
```

**CTA:** `Save & Continue →`
**Skip:** `Skip for now — I'll add later`

---

### Step 3: Create Your First Brand

**Headline:** `Tell us about your brand`

**Subhead:** `This guides every piece of content we generate. The more specific you are, the better the output.`

**Fields:**

| Field | Label | Placeholder | Helper |
|-------|-------|-------------|--------|
| name | Brand Name | `Acme Corp` | — |
| tone | Voice Tone | `bold, technical, confident` | `Comma-separated. How should your brand sound?` |
| style | Writing Style | `Direct and data-driven. Short sentences. Active voice.` | `Describe how your brand writes, like you'd brief a copywriter` |
| doNot | Never Say | `synergy, leverage, game-changer` | `Words and phrases to avoid. Press Enter after each.` |
| vocabulary | Preferred Terms | `operators, execute, deploy` | `Your brand's specific language. Press Enter after each.` |
| keywords | Target Keywords | `AI automation, business operators` | `What you want to rank for and be known for` |
| competitors | Competitors | `Zapier, CrewAI, AutoGPT` | `We'll differentiate your voice from theirs` |

**CTA:** `Create Brand →`
**Skip:** `Use demo brand (SINT) — I'll customize later`

---

### Step 4: Run Your First Pipeline

**Headline:** `Generate your first content`

**Subhead:** `Pick a pipeline and see the operator work.`

**Pipeline Cards:**

**Card 1: Content Repurpose**
```
📝 Repurpose Content
Paste a blog post, article, or transcript → get posts for Twitter, LinkedIn, Instagram, and more.
[Paste content here...]
[🚀 Repurpose → Twitter, LinkedIn, Instagram]
```

**Card 2: SEO Blog**
```
📊 SEO Blog Generator
Enter a topic → get a full SEO-optimized article with meta tags and keyword targeting.
Topic: [How AI transforms content marketing]
Keywords: [AI marketing, content automation, ROI]
[🚀 Generate Blog]
```

**Card 3: Content Calendar**
```
📅 Content Calendar
Set a timeframe → get a complete posting schedule with ready-to-use content.
Days: [7] Themes: [product launch, thought leadership]
[🚀 Generate Calendar]
```

**After first run completes:**

**Success Screen:**
```
✅ Your first content is ready

[Preview of generated content — first 200 chars of each platform]

→ View Full Results
→ Run Another Pipeline
→ Explore All 7 Pipelines
```

---

### Empty States (for returning users)

**Dashboard — No Runs:**
```
🚀 No runs yet
Try generating your first content using the quick actions above.
```

**Results — Empty:**
```
📭 No results yet
Run a pipeline to see your generated content here.
Your results are saved and searchable.
```

**Brands — Only Default:**
```
Create a brand profile to get content that sounds like you, not like a robot.
[+ New Brand]
```

**Usage — No Activity:**
```
📊 No usage yet
Your token usage and costs will appear here after your first pipeline run.
```

---

### Tooltip Copy (for info icons throughout UI)

| Element | Tooltip |
|---------|---------|
| Cost Units | `Estimated cost for this pipeline. 1 unit ≈ $0.01. Actual cost depends on your API provider pricing.` |
| Tokens | `Tokens are how AI models measure text. ~750 words ≈ 1,000 tokens. Each pipeline uses tokens for both reading your input and writing output.` |
| Model Tier | `Routine = fast & cheap (formatting, short posts). Complex = slower & higher quality (long articles, strategy).` |
| Brand Voice | `Your brand profile shapes every piece of generated content — tone, vocabulary, topics to avoid. Think of it as a permanent brief for your AI copywriter.` |
| Pipeline | `A pipeline is a sequence of AI skills that work together. Content Repurpose: analyze → repurpose → format. SEO Blog: research → outline → write → optimize.` |
