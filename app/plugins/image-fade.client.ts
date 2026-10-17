export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const seen = new WeakSet<HTMLImageElement>()

  function watchImage(img: HTMLImageElement) {
    if (seen.has(img)) return
    seen.add(img)

    if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy')
    if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async')
    if (img.dataset.noFade !== undefined) return

    img.classList.add('img-fade')
    if (img.complete) {
      img.classList.add('img-ready')
      return
    }

    img.classList.add('img-loading')
    img.addEventListener('load', () => {
      img.classList.remove('img-loading')
      img.classList.add('img-ready')
    }, { once: true })
    img.addEventListener('error', () => {
      img.classList.remove('img-loading')
      img.classList.add('img-error')
    }, { once: true })
  }

  function scan(root: ParentNode) {
    if (root instanceof HTMLImageElement) watchImage(root)
    root.querySelectorAll?.('img').forEach(el => watchImage(el as HTMLImageElement))
  }

  scan(document)

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node as Element)
      })
    }
  }).observe(document.documentElement, { childList: true, subtree: true })
})
