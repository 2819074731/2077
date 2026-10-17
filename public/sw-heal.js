self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window' })
    await Promise.all(
      windows
        .filter((client) => {
          try {
            return new URL(client.url).pathname === '/offline'
          } catch {
            return false
          }
        })
        .map((client) => client.navigate(new URL('/', client.url).href).catch(() => {}))
    )
  })())
})
