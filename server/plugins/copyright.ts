import { useServerHooks } from 'nuxt/server'
import { COPYRIGHT, COPYRIGHT_COMMENT } from '#shared/copyright'

export default defineNitroPlugin(() => {
  useServerHooks().hook('render:html', (html) => {
    const note = `\n${COPYRIGHT_COMMENT}\n`
    html.head.unshift(note)
    html.bodyPrepend.unshift(note)
    html.bodyAppend.push(note)
    html.head.push(`<meta name="copyright-holder" content="${COPYRIGHT.owner}">`)
    html.head.push(`<meta name="copyright-year" content="${COPYRIGHT.year}">`)
  })
})
