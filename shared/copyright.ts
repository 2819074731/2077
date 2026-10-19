const u = (parts: string[]): string => {
  const binary = atob(parts.join(''))
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export const COPYRIGHT = Object.freeze({
  owner: u(['MjA3NyDlr7zoiKo=']),
  site: u(['bXkyMDc3LmNvbQ==']),
  zh: u(['54mI5p2D5omA5pyJ', 'IMKpIDIwMjYgMjA3', 'NyDlr7zoiKogwrcg', 'bXkyMDc3LmNvbQ==']),
  short: u(['wqkgMjAyNiAyMDc3', 'IOWvvOiIqg==']),
  en: u(['Q29weXJpZ2h0IMKp', 'IDIwMjYgMjA3NyBO', 'YXZpZ2F0aW9uICht', 'eTIwNzcuY29tKS4g', 'QWxsIHJpZ2h0cyBy', 'ZXNlcnZlZC4=']),
  enAscii: u(['Q29weXJpZ2h0IChj', 'KSAyMDI2IDIwNzcg', 'TmF2aWdhdGlvbiAo', 'bXkyMDc3LmNvbSku', 'IEFsbCByaWdodHMg', 'cmVzZXJ2ZWQu']),
  license: u(['UG9seUZvcm0gTm9u', 'Y29tbWVyY2lhbCBM', 'aWNlbnNlIDEuMC4w']),
  licenseUrl: u(['aHR0cHM6Ly9teTIw', 'NzcuY29tL2xpY2Vu', 'c2U=']),
  official: u(['aHR0cHM6Ly9wb2x5', 'Zm9ybXByb2plY3Qu', 'b3JnL2xpY2Vuc2Vz', 'L25vbmNvbW1lcmNp', 'YWwvMS4wLjA=']),
  notice: u(['5pys6aG555uu6YeH', '55SoIFBvbHlGb3Jt', 'IE5vbmNvbW1lcmNp', 'YWwgMS4wLjAg6K64', '5Y+v77ya5YWB6K64', '5Liq5Lq65LiO6Z2e', '5ZWG5Lia57uE57uH', '5L2/55So44CB5L+u', '5pS55ZKM5YiG5Y+R', '77yM56aB5q2i5Lu7', '5L2V5ZWG5Lia55So', '6YCU44CC5ZWG5Lia', '5o6I5p2D6K+36IGU', '57O7IG15MjA3Ny5j', 'b23jgII=']),
  footer: u(['5rqQ56CB5Z+65LqO', 'IFBvbHlGb3JtIE5v', 'bmNvbW1lcmNpYWwg', 'MS4wLjAg6K645Y+v', '5Y+R5biD77yM56aB', '5q2i5ZWG5Lia5L2/', '55So44CC']),
  required: u(['UmVxdWlyZWQgTm90', 'aWNlOiBDb3B5cmln', 'aHQgKGMpIDIwMjYg', 'MjA3NyBOYXZpZ2F0', 'aW9uIChteTIwNzcu', 'Y29tKQ==']),
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
  license: COPYRIGHT.licenseUrl,
  creditText: COPYRIGHT.en
})
