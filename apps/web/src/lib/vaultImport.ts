export interface VaultNote {
  path: string           // relative to vault root, no extension, e.g. "Programming/React/hooks"
  title: string          // last path segment, e.g. "hooks"
  isFolder: boolean
  parentPath: string | null  // e.g. "Programming/React", or null for root items
  content: string        // markdown text; empty string for folders
}

export interface VaultImage {
  file: File
  relativePath: string   // e.g. "attachments/cat.png"
}

export interface VaultData {
  notes: VaultNote[]     // topologically sorted: folders by depth first, then notes
  images: VaultImage[]
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'])
const SKIP_DIRS = new Set(['.obsidian', 'node_modules'])

// Strip folder path from wikilink image refs so they resolve by filename after upload.
// ![[attachments/cat.png]] → ![[cat.png]]
// ![[images/photo.jpg]]    → ![[photo.jpg]]
// [[regular wikilink]]     → unchanged
const IMAGE_PATH_RE = /!\[\[([^\]\n]*\/)?([^\]\n]+\.(png|jpe?g|gif|webp|svg|avif))\]\]/gi

export function processNoteContent(content: string): string {
  return content.replace(IMAGE_PATH_RE, (_match, _dir, filename) => `![[${filename}]]`)
}

async function walkDir(
  handle: FileSystemDirectoryHandle,
  prefix: string,
  seenFolders: Set<string>,
  notes: VaultNote[],
  images: VaultImage[],
): Promise<void> {
  for await (const [name, entry] of (handle as any).entries()) {
    if (name.startsWith('.') || SKIP_DIRS.has(name)) continue

    if (entry.kind === 'directory') {
      await walkDir(
        entry as FileSystemDirectoryHandle,
        prefix ? `${prefix}/${name}` : name,
        seenFolders,
        notes,
        images,
      )
    } else {
      const lower = name.toLowerCase()
      const dotIdx = lower.lastIndexOf('.')
      const ext = dotIdx >= 0 ? lower.slice(dotIdx) : ''

      if (lower.endsWith('.md')) {
        const file = await (entry as FileSystemFileHandle).getFile()
        const raw = await file.text()
        const titleFromFile = name.slice(0, -3)
        const notePath = prefix ? `${prefix}/${titleFromFile}` : titleFromFile

        // Ensure ancestor folder entries exist (folders before children)
        if (prefix) {
          const parts = prefix.split('/')
          for (let i = 0; i < parts.length; i++) {
            const folderPath = parts.slice(0, i + 1).join('/')
            if (!seenFolders.has(folderPath)) {
              seenFolders.add(folderPath)
              notes.push({
                path: folderPath,
                title: parts[i],
                isFolder: true,
                parentPath: i > 0 ? parts.slice(0, i).join('/') : null,
                content: '',
              })
            }
          }
        }

        notes.push({
          path: notePath,
          title: titleFromFile,
          isFolder: false,
          parentPath: prefix || null,
          content: processNoteContent(raw),
        })
      } else if (IMAGE_EXTS.has(ext)) {
        const file = await (entry as FileSystemFileHandle).getFile()
        images.push({
          file,
          relativePath: prefix ? `${prefix}/${name}` : name,
        })
      }
    }
  }
}

export async function readVault(handle: FileSystemDirectoryHandle): Promise<VaultData> {
  const rawNotes: VaultNote[] = []
  const images: VaultImage[] = []
  const seenFolders = new Set<string>()

  await walkDir(handle, '', seenFolders, rawNotes, images)

  // Sort topologically: shallower folders first, then deeper folders, then notes
  const folders = rawNotes
    .filter(n => n.isFolder)
    .sort((a, b) => {
      const da = a.path.split('/').length
      const db = b.path.split('/').length
      return da !== db ? da - db : a.path.localeCompare(b.path)
    })
  const notes = rawNotes
    .filter(n => !n.isFolder)
    .sort((a, b) => a.path.localeCompare(b.path))

  return { notes: [...folders, ...notes], images }
}
