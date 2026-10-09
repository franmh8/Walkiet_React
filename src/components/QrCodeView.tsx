import React, { useMemo } from 'react';
import { generateQrMatrix } from '../utils/qrGenerator';

interface QrCodeViewProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
}

export const QrCodeView: React.FC<QrCodeViewProps> = ({
  value,
  size = 200,
  fgColor = '#0f172a',
  bgColor = '#ffffff',
}) => {
  const matrix = useMemo(() => {
    try {
      return generateQrMatrix(value || 'C5I-TACTICAL');
    } catch {
      return generateQrMatrix('C5I');
    }
  }, [value]);

  const moduleCount = matrix.length;
  const cellSize = size / moduleCount;

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        padding: 8,
        borderRadius: 12,
        display: 'inline-block',
      }}
      className="shadow-sm border border-slate-200 dark:border-slate-700"
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${moduleCount} ${moduleCount}`}
        shapeRendering="crispEdges"
      >
        <rect width={moduleCount} height={moduleCount} fill={bgColor} />
        {matrix.map((row, r) =>
          row.map((cell, c) =>
            cell ? (
              <rect
                key={`${r}-${c}`}
                x={c}
                y={r}
                width={1}
                height={1}
                fill={fgColor}
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};

export default QrCodeView;
