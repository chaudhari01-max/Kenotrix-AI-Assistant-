export interface Source {
  title: string;
  uri: string;
  favicon?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  sources?: Source[];
  timestamp: number;
}

export interface Thread {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export interface DiscoveryItem {
  id: string;
  title: string;
  snippet: string;
  author: string;
  likes: number;
  tags: string[];
}

export enum AppView {
  HOME = 'HOME',
  DISCOVER = 'DISCOVER',
  LIBRARY = 'LIBRARY'
}