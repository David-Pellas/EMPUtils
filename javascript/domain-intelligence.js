

const TRACKER_DB = {
  tracker: new Set([
    'doubleclick.net','scorecardresearch.com','quantserve.com','krxd.net',
    'adsafeprotected.com','2mdn.net','demdex.net','everesttech.net',
    'bluekai.com','atdmt.com','serving-sys.com','adnxs.com',
    'rlcdn.com','sitescout.com','crwdcntrl.net','exelator.com',
    'adform.net','w55c.net','turn.com','mathtag.com',
    'rubiconproject.com','rfihub.com','casalemedia.com','contextweb.com',
    'agkn.com','bidswitch.net','smartadserver.com','advertising.com',
    'nexac.com','revsci.net','adtech.de','criteo.com',
    'media.net','tapad.com','openx.net','pubmatic.com',
    'adsrvr.org','lijit.com','company-target.com','vertamedia.com',
    'ml314.com','exoclick.com','getblueshift.com','mediamath.com',
    'adroll.com','bizographics.com','eyeota.net','adsymptotic.com',
    '33across.com','zeotap.com',
    // additional from content-alerts.js
    'liadm.com','moatads.com','ads-twitter.com','connect.facebook.net',
    'snapads.com','ad-delivery.net',
  ]),
  analytics: new Set([
    'google-analytics.com','googletagmanager.com','hotjar.com','segment.com',
    'mixpanel.com','amplitude.com','newrelic.com','sentry.io',
    'segment.io','mxpnl.com','nr-data.net','fullstory.com',
    'loggly.com','bugsnag.com','rollbar.com','trackjs.com',
    'heap.io','heapanalytics.com','pendo.io','appcues.com',
    'intercom.io','intercom.com','drift.com','olark.com',
    'zopim.com','livechatinc.com','tawk.to','crisp.chat',
    'mouseflow.com','luckyorange.com','inspectlet.com','sessioncam.com',
    'quantummetric.com','contentsquare.net','dynatrace.com','datadoghq.com',
    'splunk.com','appdynamics.com','elastic.co','logz.io',
    'sumologic.com','raygun.com','airbrake.io','honeybadger.io',
    'optimizely.com','vwo.com','crazyegg.com','clicktale.net',
    'smartlook.com','logrocket.com',
    // additional from content-alerts.js
    'clicky.com','statcounter.com','chartbeat.com','clarity.ms',
    'matomo.cloud','contentsquare.com','qualtrics.com',
  ]),
  ads: new Set([
    'googlesyndication.com','adnxs.com','advertising.com','pubmatic.com',
    'contextweb.com','openx.net','rubiconproject.com','criteo.com',
    'outbrain.com','taboola.com','revcontent.com','mgid.com',
    'gravity.com','sharethrough.com','yieldmo.com','nativo.com',
    'triplelift.com','sovrn.com','aol.com','yahoo.com',
    'bing.com','baidu.com','yandex.ru','amazon-adsystem.com',
    'a9.com','aps.amazon.com','casalemedia.com','indexexchange.com',
    'improvedigital.com','smaato.com','xandr.com','adform.com',
    'spotxchange.com','springserve.com','telaria.com','rhythmone.com',
    'undertone.com','conversantmedia.com','mediavine.com','adthrive.com',
    'monumetric.com','ezoic.com','sonobi.com','kargo.com',
    'adskeeper.com','propellerads.com','popcash.net','popads.net',
    'adsterra.com','hilltopads.com',
    // additional from content-alerts.js
    'magnite.com','indexww.com','teads.tv',
  ]),
  social: new Set([
    'facebook.com','facebook.net','fbcdn.net','instagram.com',
    'twitter.com','t.co','twimg.com','linkedin.com','licdn.com',
    'pinterest.com','pinimg.com','tiktok.com','ttwstatic.com',
    'youtube.com','ytimg.com','snapchat.com','sc-cdn.net',
    'reddit.com','redd.it','redditmedia.com','redditstatic.com',
    'tumblr.com','tumblr.co','t.umblr.com','whatsapp.com',
    'telegram.org','t.me','discord.com','discordapp.com',
    'vk.com','vkontakte.ru','weibo.com','weibocdn.com',
    'line.me','line.naver.jp','medium.com','twitch.tv',
    'ttvnw.net','vimeo.com','vimeocdn.com','dailymotion.com',
    'flickr.com','staticflickr.com','meetup.com','xing.com',
    'slideshare.net','behance.net','dribbble.com','producthunt.com',
    'substack.com','patreon.com',
  ]),
};

const _TRACKER_MAP = new Map();
for (const [cat, domains] of Object.entries(TRACKER_DB)) {
  for (const d of domains) _TRACKER_MAP.set(d, cat);
}

const _AD_KW    = ['ads','adsystem','yield','bidder','popunder','click','affiliate'];
const _TRACK_KW = ['pixel','track','analyze','metrics','telemetry','beacon','collect','stats','log'];
const _CDN_KW   = ['cdn','static','assets','pkg','cloud','aws','edge'];

function categorizeDomain(domain) {
  const lower = domain.toLowerCase();
  const parts = lower.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const cat = _TRACKER_MAP.get(parts.slice(i).join('.'));
    if (cat) return cat;
  }
  if (_AD_KW.some(w => lower.includes(w)))    return 'ads';
  if (_TRACK_KW.some(w => lower.includes(w))) return 'analytics';
  if (_CDN_KW.some(w => lower.includes(w)))   return 'other';
  return 'other';
}


const DOMAIN_INTELLIGENCE = {
  'doubleclick.net': {
    name: 'Google DoubleClick',
    category: 'Ad Network & Tracking',
    purpose: 'Ad serving and cross-site user tracking',
    owner: 'Google',
    risk: 'high',
    description: 'Tracks your browsing across websites to build advertising profiles. Collects data about what sites you visit, what you click on, and builds a profile to serve targeted ads.',
    dataCollected: ['Browsing history', 'Click behavior', 'Device info', 'Location data']
  },
  'google-analytics.com': {
    name: 'Google Analytics',
    category: 'Analytics',
    purpose: 'Website traffic analysis',
    owner: 'Google',
    risk: 'medium',
    description: 'Tracks website visitors to help site owners understand traffic patterns. Collects information about how you use websites, including pages visited, time spent, and your general location.',
    dataCollected: ['Page views', 'Session duration', 'Geographic location', 'Browser type']
  },
  'googletagmanager.com': {
    name: 'Google Tag Manager',
    category: 'Tag Management',
    purpose: 'Manages marketing and analytics tags',
    owner: 'Google',
    risk: 'medium',
    description: 'A container that loads other tracking scripts. Often used to dynamically load analytics, ads, and tracking pixels without changing website code.',
    dataCollected: ['Varies based on tags loaded']
  },
  'facebook.com': {
    name: 'Facebook',
    category: 'Social & Tracking',
    purpose: 'Social widgets and cross-site tracking',
    owner: 'Meta',
    risk: 'high',
    description: 'Tracks you across websites even if you don\'t have a Facebook account. Used for Like buttons, social widgets, and building advertising profiles.',
    dataCollected: ['Browsing history', 'Social interactions', 'Device fingerprint', 'Shopping behavior']
  },
  'facebook.net': {
    name: 'Facebook CDN',
    category: 'Social & Tracking',
    purpose: 'Facebook content delivery and tracking',
    owner: 'Meta',
    risk: 'high',
    description: 'Alternative domain for Facebook tracking and content. Same tracking capabilities as facebook.com.',
    dataCollected: ['Browsing history', 'Social interactions', 'Device fingerprint']
  },
  'scorecardresearch.com': {
    name: 'ScoredCard Research',
    category: 'Market Research',
    purpose: 'Internet audience measurement',
    owner: 'Comscore',
    risk: 'high',
    description: 'Tracks browsing behavior across millions of websites to measure internet usage and advertising effectiveness. Builds detailed profiles of users.',
    dataCollected: ['Browsing patterns', 'Content consumption', 'Demographics', 'Purchase intent']
  },
  'quantserve.com': {
    name: 'Quantcast',
    category: 'Analytics & Advertising',
    purpose: 'Audience measurement and ad targeting',
    owner: 'Quantcast',
    risk: 'high',
    description: 'Tracks users across websites to provide audience analytics and ad targeting. Builds detailed behavioral profiles.',
    dataCollected: ['Browsing behavior', 'Interests', 'Demographics', 'Purchase behavior']
  },
  'googlesyndication.com': {
    name: 'Google AdSense',
    category: 'Advertising',
    purpose: 'Ad serving',
    owner: 'Google',
    risk: 'medium',
    description: 'Serves advertisements on websites and tracks ad performance. Collects data to personalize ads shown to you.',
    dataCollected: ['Ad interactions', 'Page content', 'User interests']
  },
  'twitter.com': {
    name: 'Twitter',
    category: 'Social',
    purpose: 'Social widgets and analytics',
    owner: 'X Corp',
    risk: 'medium',
    description: 'Powers Twitter widgets like tweet buttons and embedded tweets. Can track which websites you visit that have Twitter integration.',
    dataCollected: ['Tweet interactions', 'Pages visited', 'Social graph']
  },
  'linkedin.com': {
    name: 'LinkedIn',
    category: 'Social & Marketing',
    purpose: 'Professional network widgets and tracking',
    owner: 'Microsoft',
    risk: 'medium',
    description: 'Tracks professional interests and behavior across business websites. Used for B2B advertising and professional networking features.',
    dataCollected: ['Professional interests', 'Company visits', 'Career information']
  },
  'hotjar.com': {
    name: 'Hotjar',
    category: 'User Behavior Analytics',
    purpose: 'Heatmaps and session recording',
    owner: 'Hotjar',
    risk: 'medium',
    description: 'Records how you interact with websites including mouse movements, clicks, and scrolling. Can record entire browsing sessions.',
    dataCollected: ['Mouse movements', 'Clicks', 'Form inputs', 'Session recordings']
  },
  'mixpanel.com': {
    name: 'Mixpanel',
    category: 'Product Analytics',
    purpose: 'User behavior tracking',
    owner: 'Mixpanel',
    risk: 'medium',
    description: 'Tracks detailed user interactions with web applications. Records every button click, page view, and user action.',
    dataCollected: ['Feature usage', 'User flows', 'Event tracking', 'User properties']
  },
  'segment.com': {
    name: 'Segment',
    category: 'Data Pipeline',
    purpose: 'Collects data and sends to other services',
    owner: 'Twilio',
    risk: 'medium',
    description: 'Acts as a middleman that collects your data and distributes it to dozens of other analytics and marketing tools.',
    dataCollected: ['All website interactions', 'Sent to multiple third parties']
  },
  'cloudflare.com': {
    name: 'Cloudflare',
    category: 'CDN & Security',
    purpose: 'Content delivery and DDoS protection',
    owner: 'Cloudflare',
    risk: 'low',
    description: 'Provides website security, performance, and reliability. Sees all traffic to protected websites but primarily used for infrastructure.',
    dataCollected: ['IP address', 'Request patterns', 'Security threats']
  },
  'youtube.com': {
    name: 'YouTube',
    category: 'Video & Tracking',
    purpose: 'Video embedding and tracking',
    owner: 'Google',
    risk: 'medium',
    description: 'Embeds videos and tracks viewing behavior. Can track you across websites that embed YouTube videos.',
    dataCollected: ['Video watch history', 'Engagement', 'Related interests']
  },
  'gstatic.com': {
    name: 'Google Static Content',
    category: 'Content Delivery',
    purpose: 'Serves static Google resources',
    owner: 'Google',
    risk: 'low',
    description: 'Delivers static content like fonts, images, and scripts for Google services. Generally benign but can reveal which Google services you use.',
    dataCollected: ['Minimal - mostly infrastructure']
  },
  'cdn.jsdelivr.net': {
    name: 'jsDelivr CDN',
    category: 'Content Delivery',
    purpose: 'Open source CDN for web libraries',
    owner: 'jsDelivr',
    risk: 'low',
    description: 'Free CDN that hosts JavaScript libraries, fonts, and other web resources. Generally privacy-friendly.',
    dataCollected: ['Minimal - CDN logs only']
  },
  'adnxs.com': {
    name: 'AppNexus',
    category: 'Ad Exchange',
    purpose: 'Real-time ad bidding',
    owner: 'Xandr (AT&T)',
    risk: 'high',
    description: 'Major ad exchange that auctions your attention to advertisers in real-time. Builds detailed user profiles for ad targeting.',
    dataCollected: ['Browsing history', 'Purchase behavior', 'Demographics', 'Interests']
  },
  'krxd.net': {
    name: 'Krux',
    category: 'Data Management Platform',
    purpose: 'User data collection and profiling',
    owner: 'Salesforce',
    risk: 'high',
    description: 'Collects and organizes user data from multiple sources to create detailed consumer profiles for marketing.',
    dataCollected: ['Cross-site behavior', 'Purchase history', 'Demographic data', 'Device IDs']
  },
  'newrelic.com': {
    name: 'New Relic',
    category: 'Performance Monitoring',
    purpose: 'Application performance tracking',
    owner: 'New Relic',
    risk: 'low',
    description: 'Monitors website performance and errors. Primarily used for technical purposes rather than marketing.',
    dataCollected: ['Page load times', 'Errors', 'Technical metrics']
  },
  'sentry.io': {
    name: 'Sentry',
    category: 'Error Tracking',
    purpose: 'Bug and error reporting',
    owner: 'Sentry',
    risk: 'low',
    description: 'Tracks application errors and crashes to help developers fix bugs. May capture some user data in error reports.',
    dataCollected: ['Error details', 'Stack traces', 'User actions leading to errors']
  },
  'amplitude.com': {
    name: 'Amplitude',
    category: 'Product Analytics',
    purpose: 'User behavior analysis',
    owner: 'Amplitude',
    risk: 'medium',
    description: 'Tracks how users interact with products to help companies optimize their apps and websites.',
    dataCollected: ['Feature usage', 'User flows', 'Conversion events', 'User properties']
  },
  'pinterest.com': {
    name: 'Pinterest',
    category: 'Social & Advertising',
    purpose: 'Pin buttons and ad tracking',
    owner: 'Pinterest',
    risk: 'medium',
    description: 'Tracks shopping and interest behavior across websites. Used for Pinterest ads and content recommendations.',
    dataCollected: ['Shopping interests', 'Pins', 'Product views', 'Purchase intent']
  },
  'tiktok.com': {
    name: 'TikTok',
    category: 'Social & Advertising',
    purpose: 'Social widgets and ad tracking',
    owner: 'ByteDance',
    risk: 'high',
    description: 'Tracks user behavior for advertising and content recommendations. Known for aggressive data collection.',
    dataCollected: ['Browsing behavior', 'Interests', 'Device info', 'Location']
  },
  'instagram.com': {
    name: 'Instagram',
    category: 'Social',
    purpose: 'Social widgets and tracking',
    owner: 'Meta',
    risk: 'high',
    description: 'Tracks users across websites for advertising purposes. Part of Meta\'s tracking network.',
    dataCollected: ['Browsing history', 'Social interactions', 'Shopping behavior']
  }
};

function getDomainInfo(domain, category) {
  const parts = domain.toLowerCase().split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const suffix = parts.slice(i).join('.');
    if (DOMAIN_INTELLIGENCE[suffix]) return DOMAIN_INTELLIGENCE[suffix];
  }

  const profiles = {
    ads: {
      owner: "External Ad Network",
      purpose: "Advertisement Injection / Monetization",
      risk: "high",
      description: "This domain appears to be an ad-serving endpoint. It likely injects promotional content or tracks ad-clicks.",
      dataCollected: ["Unique User ID", "IP Address", "Click History"]
    },
    analytics: {
      owner: "Metrics Service",
      purpose: "User Behavior Telemetry",
      risk: "medium",
      description: "This domain is identified as a telemetry endpoint. It monitors how you move your mouse, what you click, and how long you stay on pages.",
      dataCollected: ["Session ID", "Browser Metadata", "Interaction Events"]
    },
    social: {
      owner: "Social Media Provider",
      purpose: "Social Integration & Tracking",
      risk: "medium",
      description: "Likely a social sharing button or login widget that tracks your cross-site activity.",
      dataCollected: ["Social Profile ID", "Referrer URL"]
    }
  };

  const generic = profiles[category] || {
    owner: "Independent Entity",
    purpose: "Third-party Service/Content",
    risk: "low",
    description: "This is an external resource used by the page (likely a font, script, or image).",
    dataCollected: ["Standard HTTP Headers"]
  };

  return {
    name: domain,
    category: category.charAt(0).toUpperCase() + category.slice(1),
    ...generic
  };
}
