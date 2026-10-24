import { COPYRIGHT } from '#shared/copyright'

export default defineEventHandler((event) => {
  setHeader(event, 'X-Copyright', COPYRIGHT.enAscii)
  setHeader(event, 'X-License', COPYRIGHT.spdx)
  setHeader(event, 'Link', `<${COPYRIGHT.licenseUrl}>; rel="license"`)
})
