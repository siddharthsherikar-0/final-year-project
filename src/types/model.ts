export type ModelFormat = 'glb' | 'gltf';

export type ModelCategory =
  | 'architecture'
  | 'characters'
  | 'vehicles'
  | 'nature'
  | 'furniture'
  | 'sci-fi'
  | 'other';

export interface ModelMetadata {
  id: string;
  name: string;
  description: string;
  category: ModelCategory;
  format: ModelFormat;
  fileUrl: string;
  thumbnailUrl: string;
  fileSize: number;
  vertexCount?: number;
  triangleCount?: number;
  hasTextures: boolean;
  hasAnimations: boolean;
  tags: string[];
  author?: string;
  license?: string;
  createdAt: string;
  updatedAt: string;
  favoriteCount?: number;
}

export interface ModelFilter {
  searchQuery?: string;
  categories?: ModelCategory[];
  formats?: ModelFormat[];
  tags?: string[];
  sortBy?: 'name' | 'date' | 'size';
  sortOrder?: 'asc' | 'desc';
}
