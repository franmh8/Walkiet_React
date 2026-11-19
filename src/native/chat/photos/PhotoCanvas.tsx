import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Image, PanResponder, View} from 'react-native';
import {boundPhoto, fitPhoto, type PhotoTransform} from './photoZoom';
import type {PhotoCanvasProps} from './PhotoCanvas.types';
export function PhotoCanvas(p: PhotoCanvasProps) {
  const [size, setSize] = useState({width: p.width, height: p.height}), [transform, setTransform] = useState<PhotoTransform>({scale: 1, x: 0, y: 0});
  const current = useRef({p, size, transform}); current.current = {p, size, transform};
  const start = useRef({scale: 1, x: 0, y: 0, distance: 0, cx: 0, cy: 0}), lastTap = useRef(0);
  const moved = useRef(false);
  useEffect(() => {let alive = true; Image.getSize(p.uri, (width, height) => {if (alive) setSize({width, height});}, () => {}); return () => {alive = false;};}, [p.uri]);
  const apply = (next: PhotoTransform) => {const {p, size} = current.current; const bounded = boundPhoto(next, fitPhoto(size.width, size.height, p.width, p.height), p); setTransform(bounded); p.onZoom(bounded.scale);};
  useEffect(() => {apply({...current.current.transform, scale: p.zoom});}, [p.zoom, p.width, p.height, size]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      const points = event.nativeEvent.touches; const a = points[0], b = points[1];
      if (!a) return;
      moved.current = !!b;
      start.current = {...current.current.transform, distance: b ? Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY) : 0, cx: b ? (a.pageX + b.pageX) / 2 : a.pageX, cy: b ? (a.pageY + b.pageY) / 2 : a.pageY};
    },
    onPanResponderMove: event => {
      const points = event.nativeEvent.touches; const a = points[0], b = points[1]; if (!a) return;
      if (b || Math.abs(a.pageX - start.current.cx) + Math.abs(a.pageY - start.current.cy) > 5) moved.current = true;
      if (b && start.current.distance === 0) {start.current = {...current.current.transform, distance: Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY), cx: (a.pageX + b.pageX) / 2, cy: (a.pageY + b.pageY) / 2}; return;}
      if (!b && start.current.distance > 0) {start.current = {...current.current.transform, distance: 0, cx: a.pageX, cy: a.pageY}; return;}
      const scale = b ? start.current.scale * Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY) / start.current.distance : start.current.scale;
      apply({scale, x: start.current.x + (b ? (a.pageX + b.pageX) / 2 : a.pageX) - start.current.cx, y: start.current.y + (b ? (a.pageY + b.pageY) / 2 : a.pageY) - start.current.cy});
    },
    onPanResponderRelease: () => {if (!moved.current) {const now = Date.now(); if (now - lastTap.current < 300) apply({scale: current.current.transform.scale > 1 ? 1 : 2, x: 0, y: 0}); lastTap.current = now;}},
  }), []);
  const fitted = fitPhoto(size.width, size.height, p.width, p.height);
  return <View testID="photo-canvas" {...responder.panHandlers} style={{width: p.width, height: p.height, overflow: 'hidden', alignItems: 'center', justifyContent: 'center'}}>
    <Image accessibilityLabel="Imagen ampliada del chat" source={{uri: p.uri}} resizeMode="contain" style={{width: fitted.width, height: fitted.height, transform: [{translateX: transform.x}, {translateY: transform.y}, {scale: transform.scale}]}}/>
  </View>;
}
