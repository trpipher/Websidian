export interface NoteMeta {
  id: string;
  path: string;
  title: string;
  updatedAt: string; // ISO 8601
  createdAt: string;
  projectId: string;
  parentId: string | null;
  sortOrder: number;
  isFolder: boolean;
}

export interface Note extends NoteMeta {
  content: string; // markdown projection (may be slightly stale vs live Yjs doc)
}

export interface TokenClaims {
  sub: string;   // user id
  name: string;
  role: 'user' | 'ai-bot';
}

export interface LinkEdge {
  sourceId: string;
  targetId: string;
}

export type ProjectRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface Project {
  id: string
  name: string
  slug: string
  description: string
  isPublic: boolean
  ownerId: string
  createdAt: string
  updatedAt: string
  role?: ProjectRole  // the requesting user's role (undefined if not a member)
}

export interface ProjectMember {
  projectId: string
  userId: string
  userName: string
  role: ProjectRole
  joinedAt: string
}

export interface InviteInfo {
  id: string
  projectId: string
  projectName: string
  role: ProjectRole
  token: string
  createdAt: string
  expiresAt?: string
  maxUses?: number
  useCount: number
}
