# EMPUtils

**EMPUtils** is a free, open-source Chrome extension for privacy protection and tracker intelligence. It detects, analyzes, and blocks ads, trackers, and data-collection scripts embedded on the websites you visit, giving you visibility and control over who is watching you browse.

> Free and open source under the [MIT License](#license).

---

## Features

### Ad Blocker
Blocks ads at multiple levels simultaneously:
- **Network-level blocking** via Chrome's Declarative Net Request API, targeting 17+ major ad networks out of the box (DoubleClick, Google Ads, Taboola, Outbrain, AppNexus, and more)
- **Dynamic blocklist** — automatically fetches and applies EasyList (up to 30,000 rules), refreshed every 24 hours ensuring up-to-date info while maintaining functionality if unable to reach EasyList.
- **Element hiding** — injects CSS to hide ad containers, banners, sponsored content, and promotional elements, including YouTube ad overlays, without breaking the video player
- **JavaScript-level interception** — blocks `fetch()`, `XMLHttpRequest`, and `Image` requests matching ad URL patterns before they are sent

### Tracker & Analytics Blocker
Neutralizes tracking scripts before they can run:
- Intercepts and nullifies tracking globals
- Blocks EasyPrivacy-listed tracker requests dynamically
- Uses JavaScript `Proxy` objects to silently swallow tracker calls

### Tracker Intelligence Database
Comes with a built-in database of 228+ known trackers with detailed profiles:
- Tracker name, owner, category, and purpose
- Data collected (e.g., browsing history, device fingerprints, purchase behavior)
- Risk level classification: **High**, **Medium**, or **Low**
- Coverage includes advertising networks, analytics services, social media trackers, data brokers, CDNs, and more

### Domain Verification & Intelligence
Dig deeper into any domain found on a page:
- **WHOIS / RDAP lookup** — registrar, organization, and registration date
- **DNS infrastructure detection** — identifies hosting on AWS, Google Cloud, Azure, Akamai, or Cloudflare
- **Ownership record detection** — finds Google, Meta, Adobe, and Atlassian verification DNS records

### Privacy Score & Reporting
Get a clear picture of how much a site is tracking you:
- 0–100 privacy score calculated from the trackers detected on the current page
- Letter-grade rating: Excellent / Good / Fair / Poor / Critical
- Penalty breakdown by tracker category

### Page Tracker Analysis
Analyze any page on demand:
- Extracts all external domains loaded via scripts
- Sorts domains by request count
- Filter results by category, risk level, or search term
- Cumulative analysis history across page visits to see total trackers.
- Export results to CSV

### Real-Time Alerts
Stay informed without disrupting your browsing:
- Dismissible in-page banner appears when high-risk trackers are detected
- Shows how many trackers were found with quick-action buttons: **Whitelist Site** or **Block All Trackers**
- Fully configurable — adjust auto-close duration or disable alerts entirely

### Whitelist & Custom Block Controls
You stay in control:
- Whitelist any domain to suppress all blocking (Ghost Mode — extension becomes invisible to the site)
- Manually block specific domains from the Trackers tab or Settings
- All preferences persist across sessions via Chrome storage

### Customizable Appearance
- Custom theme color picker — change the primary UI color to match your taste
- Clean dark-themed popup with sidebar navigation

---

**Manual install (Developer Mode):**

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right).
4. Click **Load unpacked** and select the `EMPUtils` folder.
5. The extension icon will appear in your toolbar.

---

## Permissions

EMPUtils requests only what it needs:

| Permission | Why |
|---|---|
| `declarativeNetRequest` | Block ad and tracker network requests |
| `scripting` | Inject content scripts for element hiding and tracker interception |
| `storage` | Save your settings and whitelist locally |
| `tabs` | Read the current tab URL to apply rules |
| `alarms` | Schedule the 24-hour blocklist refresh |
| `notifications` | Show browser-level alerts |
| `activeTab` | Analyze the page you are currently viewing |

No data is ever sent to any server controlled by EMPUtils. All processing happens locally in your browser. I am commited to maintaining transparency with my OPEN-SOURCE free-to-use extension.

---

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
