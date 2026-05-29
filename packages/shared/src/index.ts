export interface NoteMeta {
  id: string;
  path: string;
  title: string;
  updatedAt: string; // ISO 8601
  createdAt: string;
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
