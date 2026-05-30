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

function sortVaultData(rawNotes: VaultNote[], images: VaultImage[]): VaultData {
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

/** Read a vault from the File System Access API (Chrome/Edge). */
export async function readVault(handle: FileSystemDirectoryHandle): Promise<VaultData> {
  const rawNotes: VaultNote[] = []
  const images: VaultImage[] = []
  const seenFolders = new Set<string>()

  await walkDir(handle, '', seenFolders, rawNotes, images)
  return sortVaultData(rawNotes, images)
}

/**
 * Read a vault from a <input type="file" webkitdirectory> FileList (Firefox/Safari fallback).
 * Each File has a webkitRelativePath like "VaultName/subfolder/note.md"; the first
 * path segment (vault root name) is stripped so paths match the readVault format.
 */
export async function readVaultFromFileList(files: FileList): Promise<VaultData> {
  const rawNotes: VaultNote[] = []
  const images: VaultImage[] = []
  const seenFolders = new Set<string>()

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const rel = file.webkitRelativePath
    // Strip vault root prefix (first segment)
    const slashIdx = rel.indexOf('/')
    const pathFromRoot = slashIdx >= 0 ? rel.slice(slashIdx + 1) : rel
    if (!pathFromRoot) continue

    const parts = pathFromRoot.split('/')
    const name = parts[parts.length - 1]
    const lower = name.toLowerCase()

    // Skip hidden dirs and node_modules anywhere in the path
    if (parts.some(p => p.startsWith('.') || p === 'node_modules')) continue

    const dotIdx = lower.lastIndexOf('.')
    const ext = dotIdx >= 0 ? lower.slice(dotIdx) : ''
    const prefix = parts.slice(0, -1).join('/')

    if (lower.endsWith('.md')) {
      const content = await file.text()
      const title = name.slice(0, -3)
      const notePath = prefix ? `${prefix}/${title}` : title

      // Ensure ancestor folder entries exist
      if (prefix) {
        const prefixParts = prefix.split('/')
        for (let j = 0; j < prefixParts.length; j++) {
          const folderPath = prefixParts.slice(0, j + 1).join('/')
          if (!seenFolders.has(folderPath)) {
            seenFolders.add(folderPath)
            rawNotes.push({
              path: folderPath,
              title: prefixParts[j],
              isFolder: true,
              parentPath: j > 0 ? prefixParts.slice(0, j).join('/') : null,
              content: '',
            })
          }
        }
      }

      rawNotes.push({
        path: notePath,
        title,
        isFolder: false,
        parentPath: prefix || null,
        content: processNoteContent(content),
      })
    } else if (IMAGE_EXTS.has(ext)) {
      images.push({ file, relativePath: pathFromRoot })
    }
  }

  return sortVaultData(rawNotes, images)
}
