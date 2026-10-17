import { getSetting, setSetting } from './settings'

export interface FriendLink { name: string; url: string; desc?: string; icon?: string }

const KEY = 'friend_links'

export async function getFriendLinks(): Promise<FriendLink[]> {
  const list = await getSetting<FriendLink[]>(KEY, [])
  return Array.isArray(list) ? list.filter((l) => l && l.name && /^https?:\/\//.test(l.url)) : []
}

export async function setFriendLinks(list: any[]): Promise<FriendLink[]> {
  const clean: FriendLink[] = (Array.isArray(list) ? list : [])
    .map((l: any) => ({
      name: String(l?.name || '').trim().slice(0, 60),
      url: String(l?.url || '').trim().slice(0, 500),
      desc: String(l?.desc || '').trim().slice(0, 200),
      icon: String(l?.icon || '').trim().slice(0, 500)
    }))
    .filter((l: FriendLink) => l.name && /^https?:\/\//.test(l.url))
  await setSetting(KEY, clean)
  return clean
}
