const u = (parts: string[]): string => {
  const binary = atob(parts.join(''))
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export const COPYRIGHT = Object.freeze({
  owner: u(['MjA3NyDlr7zoiKo=']),
  site: u(['bXkyMDc3LmNvbQ==']),
  zh: u(['54mI5p2D5omA5pyJIM', 'KpIDIwMjYgMjA3NyDl', 'r7zoiKogwrcgbXkyMD', 'c3LmNvbQ==']),
  short: u(['wqkgMjAyNiAyMDc3IO', 'WvvOiIqg==']),
  en: u(['Q29weXJpZ2h0IMKpID', 'IwMjYgMjA3NyBOYXZp', 'Z2F0aW9uIChteTIwNz', 'cuY29tKS4gQWxsIHJp', 'Z2h0cyByZXNlcnZlZC', '4=']),
  enAscii: u(['Q29weXJpZ2h0IChjKS', 'AyMDI2IDIwNzcgTmF2', 'aWdhdGlvbiAobXkyMD', 'c3LmNvbSkuIEFsbCBy', 'aWdodHMgcmVzZXJ2ZW', 'Qu']),
  license: u(['R05VIEFmZmVybyBHZW', '5lcmFsIFB1YmxpYyBM', 'aWNlbnNlIHYzLjAgb2', '5seSAoQUdQTC0zLjAt', 'b25seSk=']),
  licenseShort: u(['QUdQTC0zLjAtb25seQ==']),
  spdx: u(['QUdQTC0zLjAtb25seQ==']),
  licenseUrl: u(['aHR0cHM6Ly9teTIwNz', 'cuY29tL2xpY2Vuc2U=']),
  official: u(['aHR0cHM6Ly93d3cuZ2', '51Lm9yZy9saWNlbnNl', 'cy9hZ3BsLTMuMC5odG', '1s']),
  notice: u(['5pys6aG555uu6YeH55', 'SoIEdOVSBBZmZlcm8g', 'R2VuZXJhbCBQdWJsaW', 'MgTGljZW5zZSB2My4w', 'IG9ubHnvvIhBR1BMLT', 'MuMC1vbmx577yJ5Y+R', '5biD77ya5YWB6K645Z', 'WG5Lia5L2/55So44CB', '5L+u5pS55LiO5YiG5Y', '+R77yb5a+55aSW5o+Q', '5L6b572R57uc5pyN5Y', 'qh5pe25b+F6aG75YWs', '5byA5a+55bqU5rqQ56', 'CB77yM5bm25L+d55WZ', '54mI5p2D44CB6K645Y', '+v5Y+K4oCc5Z+65LqO', 'IDIwNzcg5a+86Iiq5L', 'qM5qyh5byA5Y+R4oCd', '55qE5p2l5rqQ5qCH5r', 'Oo44CC']),
  required: u(['UmVxdWlyZWQgTm90aW', 'NlOiBDb3B5cmlnaHQg', 'KGMpIDIwMjYgMjA3Ny', 'BOYXZpZ2F0aW9uICht', 'eTIwNzcuY29tKS4gTW', '9kaWZpZWQgdmVyc2lv', 'bnMgbXVzdCBzdGF0ZS', 'AiQmFzZWQgb24gMjA3', 'NyBOYXZpZ2F0aW9uIC', 'hodHRwczovL215MjA3', 'Ny5jb20pIiBhbmQgcH', 'Jlc2VydmUgdGhpcyBu', 'b3RpY2Uu']),
  source: u(['aHR0cHM6Ly9naXRlYS', '5jb20vcWlxaXVzLzIw', 'Nzc=']),
  termsUrl: u(['aHR0cHM6Ly9naXRlYS', '5jb20vcWlxaXVzLzIw', 'NzcvYmxvYi9tYWluL0', 'FERElUSU9OQUwtVEVS', 'TVMubWQ=']),
  trademarkUrl: u(['aHR0cHM6Ly9naXRlYS', '5jb20vcWlxaXVzLzIw', 'NzcvYmxvYi9tYWluL1', 'RSQURFTUFSSy5tZA==']),
  year: '2026'
})

export const COPYRIGHT_COMMENT = `<!-- ${COPYRIGHT.en} | ${COPYRIGHT.zh} | License: ${COPYRIGHT.license} ${COPYRIGHT.licenseUrl} -->`

export const COPYRIGHT_JSON_LD = Object.freeze({
  '@context': 'https://schema.org',
  '@type': 'CreativeWork',
  name: COPYRIGHT.owner,
  url: `https://${COPYRIGHT.site}/`,
  copyrightHolder: {
    '@type': 'Organization',
    name: COPYRIGHT.owner,
    url: `https://${COPYRIGHT.site}/`
  },
  copyrightYear: COPYRIGHT.year,
  license: COPYRIGHT.official,
  creditText: COPYRIGHT.en
})
