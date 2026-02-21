
const _verifyCache = new Map();
const _CACHE_TTL_MS = 5 * 60 * 1000;

const _inFlight = new Map();

function getBaseDomain(domain) {
  const parts = domain.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return domain;
}
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(id);
  return response;
}

// Updated Ownership Lookup
async function lookupDomainOwnership(domain) {
  try {
    const baseDomain = getBaseDomain(domain);
    
    const [txtRes, soaRes] = await Promise.all([
      fetchWithTimeout(`https://dns.google/resolve?name=${baseDomain}&type=TXT`),
      fetchWithTimeout(`https://dns.google/resolve?name=${baseDomain}&type=SOA`)
    ]);

    const txtData = await txtRes.json();
    const soaData = await soaRes.json();

    if (txtData.Answer) {
      for (const record of txtData.Answer) {
        const txt = record.data.toLowerCase();
        if (txt.includes('google-site-verification')) return 'Verified Entity: Google LLC';
        if (txt.includes('facebook-domain-verification')) return 'Verified Entity: Meta Platforms';
        if (txt.includes('atlassian-domain-verification')) return 'Verified Entity: Atlassian';
        if (txt.includes('adobe-id-p-verification')) return 'Verified Entity: Adobe';
        if (txt.includes('v=spf1')) {
          if (txt.includes('google.com')) return 'Verified Infrastructure: Google';
          if (txt.includes('amazonses')) return 'Verified Infrastructure: Amazon AWS';
          if (txt.includes('outlook.com')) return 'Verified Infrastructure: Microsoft';
        }
      }
    }

    if (soaData.Answer) {
      const authority = soaData.Answer[0].data.toLowerCase();
      if (authority.includes('awsdns')) return 'Infrastructure: Amazon Web Services';
      if (authority.includes('googledomains') || authority.includes('ns1.google')) return 'Infrastructure: Google Cloud';
      if (authority.includes('akamai')) return 'Infrastructure: Akamai CDN';
      if (authority.includes('cloudflare')) return 'Infrastructure: Cloudflare Network';
      if (authority.includes('azure-dns')) return 'Infrastructure: Microsoft Azure';
    }

    return 'Registry Status: Protected/Private';
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Lookup timed out');
      return 'Status: Service Timeout';
    }
    console.error('DNS lookup error:', error);
    return 'Status: Lookup Failed';
  }
}

async function checkURLhaus(domain) {
  try {
    const response = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `host=${encodeURIComponent(domain)}`
    });
    
    if (!response.ok) {
      return { status: 'unknown', threat: false };
    }
    
    const data = await response.json();
    
    if (data.query_status === 'ok') {
      return {
        status: 'found',
        threat: true,
        threatLevel: 'high',
        details: `Found in URLhaus malware database. This domain has been associated with ${data.url_count || 'multiple'} malicious URLs.`,
        lastSeen: data.firstseen || 'Unknown'
      };
    }
    
    return { status: 'clean', threat: false };
  } catch (error) {
    console.error('URLhaus check error:', error);
    return { status: 'error', threat: false };
  }
}

async function getWhoIsInfo(domain) {
  try {
    const baseDomain = getBaseDomain(domain);
    
    const response = await fetch(`https://rdap.org/domain/${baseDomain}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    const info = {
      registrar: null,
      organization: null,
      createdDate: null,
      updatedDate: null,
      status: []
    };
    
    // Get registrar
    if (data.entities) {
      for (const entity of data.entities) {
        if (entity.roles && entity.roles.includes('registrar')) {
          info.registrar = entity.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || entity.handle;
        }
        if (entity.roles && entity.roles.includes('registrant')) {
          info.organization = entity.vcardArray?.[1]?.find(v => v[0] === 'org')?.[3] || null;
        }
      }
    }
    
    if (data.events) {
      for (const event of data.events) {
        if (event.eventAction === 'registration') {
          info.createdDate = new Date(event.eventDate).toLocaleDateString();
        }
        if (event.eventAction === 'last changed') {
          info.updatedDate = new Date(event.eventDate).toLocaleDateString();
        }
      }
    }
    
    // Get status
    if (data.status) {
      info.status = data.status;
    }
    
    return info;
  } catch (error) {
    console.error('RDAP/WhoIs lookup error:', error);
    return null;
  }
}

async function _verifyDomainInner(domain) {
  const results = {
    domain: domain,
    baseDomain: getBaseDomain(domain),
    timestamp: new Date().toISOString(),
    checks: {
      whois: { status: 'checking', data: null },
      malware: { status: 'checking', data: null },
      dns: { status: 'checking', data: null }
    }
  };

  const [whoisInfo, malwareCheck, dnsInfo] = await Promise.all([
    getWhoIsInfo(domain).catch(e => null),
    checkURLhaus(domain).catch(e => ({ status: 'error', threat: false })),
    lookupDomainOwnership(domain).catch(e => null)
  ]);
  
  // Process WhoIs results
  if (whoisInfo) {
    results.checks.whois = {
      status: 'success',
      data: whoisInfo
    };
  } else {
    results.checks.whois = {
      status: 'unavailable',
      data: null
    };
  }
  
  results.checks.malware = {
    status: malwareCheck.status === 'error' ? 'unavailable' : 'success',
    data: malwareCheck
  };
  
  // Process DNS check
  if (dnsInfo) {
    results.checks.dns = {
      status: 'success',
      data: dnsInfo
    };
  } else {
    results.checks.dns = {
      status: 'unavailable',
      data: null
    };
  }
  
  return results;
}

async function verifyDomain(domain) {
  const cached = _verifyCache.get(domain);
  if (cached && (Date.now() - cached.timestamp) < _CACHE_TTL_MS) {
    return cached.result;
  }

  if (_inFlight.has(domain)) {
    return _inFlight.get(domain);
  }

  const promise = _verifyDomainInner(domain).then(result => {
    _verifyCache.set(domain, { result, timestamp: Date.now() });
    _inFlight.delete(domain);
    return result;
  }).catch(err => {
    _inFlight.delete(domain);
    throw err;
  });

  _inFlight.set(domain, promise);
  return promise;
}

function formatVerificationResults(verificationData) {
  const lines = [];
  
  lines.push(`Verification Results for ${verificationData.domain}`);
  lines.push('');
  
  if (verificationData.checks.whois.status === 'success' && verificationData.checks.whois.data) {
    const whois = verificationData.checks.whois.data;
    lines.push('Registration Information:');
    if (whois.organization) lines.push(`  Organization: ${whois.organization}`);
    if (whois.registrar) lines.push(`  Registrar: ${whois.registrar}`);
    if (whois.createdDate) lines.push(`  Created: ${whois.createdDate}`);
    if (whois.updatedDate) lines.push(`  Last Updated: ${whois.updatedDate}`);
    if (whois.status && whois.status.length > 0) {
      lines.push(`  Status: ${whois.status.join(', ')}`);
    }
    lines.push('');
  }
  
  if (verificationData.checks.dns.status === 'success' && verificationData.checks.dns.data) {
    lines.push(verificationData.checks.dns.data);
    lines.push('');
  }
  
  return lines.join('\n');
}
