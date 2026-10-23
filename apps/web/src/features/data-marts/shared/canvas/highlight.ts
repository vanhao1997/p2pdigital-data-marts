import { normalizeSearchText } from '../../../../shared/utils/field-humanizer';

export interface CanvasHighlightState {
  highlighted: boolean;
  dimmed: boolean;
}

export const NO_HIGHLIGHT: CanvasHighlightState = { highlighted: false, dimmed: false };

export function computeCanvasHighlight<T>(
  items: T[],
  query: string,
  getId: (item: T) => string,
  getLabel: (item: T) => string
): Map<string, CanvasHighlightState> {
  const q = normalizeSearchText(query);
  const state = new Map<string, CanvasHighlightState>();
  for (const item of items) {
    const highlighted = q !== '' && normalizeSearchText(getLabel(item)).includes(q);
    state.set(getId(item), { highlighted, dimmed: q !== '' && !highlighted });
  }
  return state;
}
