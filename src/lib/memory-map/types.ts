export type NodeKind = 'topic' | 'atom' | 'source' | 'entity' | 'contributor';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  size: number;
  meta: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: 'backed_by' | 'about' | 'authored_by' | 'contains' | 'supersedes';
  weight: number;
}

export interface ContributorWeight {
  userId: string;
  name: string;
  score: number;
  weekDelta: number;
}

export interface TopicCluster {
  id: string;
  label: string;
  chunkIds: string[];
}

export interface Snapshot {
  orgId: string;
  computedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  contributorWeights: ContributorWeight[];
  topicClusters: TopicCluster[];
}
