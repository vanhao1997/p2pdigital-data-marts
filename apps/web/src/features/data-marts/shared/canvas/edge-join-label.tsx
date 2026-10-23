import { DIMMED_OPACITY } from './constants';
import {
  humanizeFieldName,
  isVietnameseLocale,
} from '../../../../shared/utils/field-humanizer';

interface EdgeJoinLabelProps {
  x: number;
  y: number;
  /** One "source = target" line per join condition. */
  lines: string[];
  selected: boolean;
  dimmed: boolean;
}

function humanizeJoinLine(line: string): string | null {
  const parts = line.split(/\s*=\s*/);
  if (parts.length !== 2) return null;
  const [left, right] = parts;
  const humanizedLeft = humanizeFieldName(left, { locale: 'vi' });
  const humanizedRight = humanizeFieldName(right, { locale: 'vi' });
  if (humanizedLeft === left && humanizedRight === right) return null;
  return `${humanizedLeft} = ${humanizedRight}`;
}

/**
 * The join-fields label pinned to an edge midpoint, shared by the Models
 * canvas and the Joinable Data Marts diagram so the two cannot drift apart.
 * Rendered inside the edge's SVG via a zero-size foreignObject.
 */
export function EdgeJoinLabel({ x, y, lines, selected, dimmed }: EdgeJoinLabelProps) {
  if (lines.length === 0) return null;
  const isVi = isVietnameseLocale();
  return (
    <foreignObject x={x} y={y} width={1} height={1} style={{ overflow: 'visible' }}>
      <div
        style={{
          transform: 'translate(-50%, -50%)',
          width: 'max-content',
          background: 'var(--background)',
          border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 8,
          padding: '3px 8px',
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.5,
          color: 'var(--foreground)',
          pointerEvents: 'none',
          opacity: dimmed ? DIMMED_OPACITY : 1,
          transition: 'opacity 0.2s',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08)',
        }}
      >
        {/* Index keys: duplicate join conditions are representable, and the
            line list fully re-renders on any change anyway. */}
        {lines.map((line, index) => {
          const humanized = isVi ? humanizeJoinLine(line) : null;
          return (
            <div key={`${String(index)}-${line}`}>
              {humanized ? (
                <>
                  <div>{humanized}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>{line}</div>
                </>
              ) : (
                line
              )}
            </div>
          );
        })}
      </div>
    </foreignObject>
  );
}
