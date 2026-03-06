export interface PanelScript {
  panel: number;
  character: string;
  description: string;
  dialogue: string;
}

export interface Character {
  name: string;
  description: string;
  sheetImage?: string | null;
}

export interface FullScript {
  characters: Character[];
  panels: PanelScript[];
}
