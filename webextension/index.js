// URL polyfill
const URL = typeof window === 'object' ? window.URL : require('url').URL;

const matchPatternToRegex = mp => `^${mp.replace(/\./, '\\.').replace(/\*/, '.*')}`;

const extract = (url, value) => {
  const re = new RegExp(matchPatternToRegex(url));
  return url => re.test(url.pathname) && value(url);
};

const searchParam = key => ({ searchParams }) => searchParams.get(key);
const decode = (s = '') => decodeURIComponent(s);
const stripFromColon = (s = '') => s.substring(0, s.lastIndexOf(':'));
const pickFromLastSlash = (s = '') => s.substring(s.lastIndexOf('/') + 1, s.length);

const googlePathnames = {
  '/imgres': ({ searchParams }) => find(['imgurl','imgrefurl'], searchParams.get.bind(searchParams)),
  '/url': ({ searchParams }) => find(['q','url'], searchParams.get.bind(searchParams))
};

const sites = {
  // 2018-08-19 -- https://wow.curseforge.com/linkout?remoteUrl=http%253a%252f%252fi.imgur.com%252f1AjSgEH.png
  '*.curseforge.com': {
    '/linkout': url => decode(searchParam('remoteUrl')(url))
  },
  '*.digidip.net': {
    '/visit': searchParam('url')
  },
  'disq.us': {
    '/url': url => stripFromColon(searchParam('url')(url))
  },
  // 2019-09-17 -- https://console.ebsta.com/linktracking/track.aspx?trackid=3a096df7-b279-43a5-b42c-cbda7b72759c-1568686588593&linktrackingid=2&linkuri=https%3A%2F%2Fen-jp.wantedly.com%2Fprojects%2F328561
  'console.ebsta.com': {
    '/linktracking/track.aspx': searchParam('linkuri')
  },
  'exit.sc': {
    '/': searchParam('url')
  },
  'l.facebook.com': {
    '/l.php': searchParam('u')
  },
  // 2019-08-06 - https://gate.sc/?url=http%3A%2F%2Ffanlink.to%2FPartial7&token=10fd54-1-1565068249069
  'gate.sc': {
    '/': searchParam('url')
  },
  'www.google.co.jp': googlePathnames,
  'news.url.google.com': {
    '/url': searchParam('url')
  },
  'plus.url.google.com': {
    '/url': searchParam('url')
  },
  'www.google.com': googlePathnames,
  'l.instagram.com': {
    '/': searchParam('u')
  },
  'www.javlibrary.com': {
    '/en/redirect.php': searchParam('url')
  },
  'l.messenger.com': {
    '/l.php': searchParam('u')
  },
  // 2020-04-21 - https://outgoing.prod.mozaws.net/v1/08aa3089688d4b6ec460e6c402e78eba305c36fb81287197e4ae3f5a5c60f22d/https%3A//developer.mozilla.org/en-US/Add-ons/WebExtensions/Match_patterns
  'outgoing.prod.mozaws.net': {
    '/v1/': ({ pathname }) => decode(pickFromLastSlash(pathname))
  },
  // 2020-04-13 - https://gcc01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.metro.tokyo.lg.jp%2Fenglish%2Findex.html
  'gcc01.safelinks.protection.outlook.com': {
    '/': searchParam('url')
  },
  'slack-redir.net': {
    '/link': searchParam('url')
  },
  'steamcommunity.com': {
    '/linkfilter/': searchParam('url')
  },
  'twitter.com': {
    '/i/redirect': searchParam('url')
  },
  't.umblr.com': {
    '/redirect': searchParam('z')
  },
  'vk.com': {
    '/away.php': searchParam('to')
  },
  'workable.com': {
    '/nr': searchParam('l')
  },
  'www.youtube.com': {
    '/redirect': searchParam('q')
  }
};

const domains = [
  'curseforge.com',
  'digidip.net'
];

function subdomain(host) {
  const hostLength = host.length;

  for (let i = 0; i < domains.length; i += 1) {
    const domain = domains[i];
    const expectedIndex = hostLength - domain.length;

    if (expectedIndex > 0 && host.lastIndexOf(domain) === expectedIndex) {
      return `*.${domain}`;
    }
  }
  return host;
}

function reduceSites(urls, host) {
  return urls.concat(Object.keys(sites[host]).map(pathname => {
    return `*://${host}${pathname}*`;
  }));
}

const urls = Object.keys(sites).reduce(reduceSites, []);

const redirectExtractors = Object.keys(sites).reduce((siteExtractors, site) => {
  siteExtractors[site] = Object.keys(sites[site]).reduce((pathExtractors, path) => {
    const value = sites[site][path];
    return pathExtractors.concat(extract(path, value));
  }, []);

  return siteExtractors;
}, {});

function find(a, b) {
  const isArray = Array.isArray(a);
  const isFunction = typeof b === 'function';
  const iterable = isArray ? a : b;

  for (let i = 0; i < iterable.length; i += 1) {
    let result = isFunction ? b(iterable[i]) : iterable[i](b);
    if (result) return result;
  }
}

function analyzeURL(request) {
  const url = new URL(request.url);
  const host = subdomain(url.host);

  const site = sites[host];

  if (!site) {
    return;
  }

  const redirectUrl = find(redirectExtractors[host], url);

  return redirectUrl && { redirectUrl };
}

// Only runs in the browser
typeof chrome === 'object' && chrome.webRequest.onBeforeRequest.addListener(analyzeURL, { urls }, ['blocking']);

typeof exports === 'object' && Object.assign(exports, {
  analyzeURL,
  sites,
  subdomain
});
