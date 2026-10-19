import { COPYRIGHT } from '#shared/copyright'

export default defineNuxtPlugin(() => {
  const root = document.documentElement
  root.setAttribute('data-copyright', COPYRIGHT.owner)
  root.setAttribute('data-license', COPYRIGHT.license)
  root.setAttribute('data-license-url', COPYRIGHT.licenseUrl)

  Object.defineProperty(window, '__COPYRIGHT__', {
    value: Object.freeze({ ...COPYRIGHT }),
    writable: false,
    configurable: false
  })

  const tags: Array<[string, string]> = [
    ['copyright', COPYRIGHT.zh],
    ['rights', COPYRIGHT.en],
    ['license', COPYRIGHT.license],
    ['author', COPYRIGHT.owner]
  ]
  for (const [name, content] of tags) {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('name', name)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }

  let link = document.head.querySelector<HTMLLinkElement>('link[rel="license"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'license'
    document.head.appendChild(link)
  }
  link.href = COPYRIGHT.licenseUrl
  link.title = COPYRIGHT.license

  try {
    console.info(`%c${COPYRIGHT.short} · ${COPYRIGHT.license}`, 'color:#8a8a8a;font-size:11px')
  } catch {}
})
