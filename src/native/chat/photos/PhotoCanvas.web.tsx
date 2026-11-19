import React, {useEffect, useRef, useState} from 'react';
import {boundPhoto, fitPhoto, type PhotoTransform} from './photoZoom';
import type {PhotoCanvasProps} from './PhotoCanvas.types';
export function PhotoCanvas(p: PhotoCanvasProps) {
  const root = useRef<HTMLDivElement>(null), points = useRef(new Map<number, {x: number; y: number}>());
  const [size, setSize] = useState({width: p.width, height: p.height}), [transform, setTransform] = useState<PhotoTransform>({scale: 1, x: 0, y: 0});
  const live = useRef({p, size, transform}); live.current = {p, size, transform};
  const origin = useRef({scale: 1, x: 0, y: 0, distance: 0, cx: 0, cy: 0});
  const apply = (value: PhotoTransform) => {const {p, size} = live.current; const next = boundPhoto(value, fitPhoto(size.width, size.height, p.width, p.height), p); setTransform(next); p.onZoom(next.scale);};
  useEffect(() => {apply({...live.current.transform, scale: p.zoom});}, [p.zoom, p.width, p.height, size]);
  useEffect(() => {const el = root.current; const wheel = (event: WheelEvent) => {event.preventDefault(); apply({...live.current.transform, scale: live.current.transform.scale * (event.deltaY > 0 ? 0.9 : 1.1)});}; el?.addEventListener('wheel', wheel, {passive: false}); return () => el?.removeEventListener('wheel', wheel);}, []);
  const baseline = () => {const [a, b] = [...points.current.values()]; if (a) origin.current = {...live.current.transform, distance: b ? Math.hypot(b.x - a.x, b.y - a.y) : 0, cx: b ? (a.x + b.x) / 2 : a.x, cy: b ? (a.y + b.y) / 2 : a.y};};
  const fitted = fitPhoto(size.width, size.height, p.width, p.height);
  return <div ref={root} data-testid="photo-canvas" style={{width: p.width, height: p.height, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', userSelect: 'none', cursor: transform.scale > 1 ? 'grab' : 'zoom-in'}}
    onDoubleClick={() => apply({scale: live.current.transform.scale > 1 ? 1 : 2, x: 0, y: 0})}
    onPointerDown={event => {if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); points.current.set(event.pointerId, {x: event.clientX, y: event.clientY}); baseline();}}
    onPointerMove={event => {if (!points.current.has(event.pointerId)) return; points.current.set(event.pointerId, {x: event.clientX, y: event.clientY}); const [a, b] = [...points.current.values()], start = origin.current; if (!a) return; apply({scale: b && start.distance ? start.scale * Math.hypot(b.x - a.x, b.y - a.y) / start.distance : start.scale, x: start.x + (b ? (a.x + b.x) / 2 : a.x) - start.cx, y: start.y + (b ? (a.y + b.y) / 2 : a.y) - start.cy});}}
    onPointerUp={event => {points.current.delete(event.pointerId); baseline();}} onLostPointerCapture={event => {points.current.delete(event.pointerId); baseline();}} onPointerCancel={() => points.current.clear()}>
    <img src={p.uri} alt="Imagen ampliada del chat" draggable={false} onLoad={event => setSize({width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight})}
      style={{width: fitted.width, height: fitted.height, objectFit: 'contain', pointerEvents: 'none', transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`}}/>
  </div>;
}
