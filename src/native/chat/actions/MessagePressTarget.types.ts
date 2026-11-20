import type {ReactNode} from 'react';
import type {StyleProp,ViewStyle} from 'react-native';
export interface MenuPoint {x:number;y:number;}
export interface MessagePressTargetProps {children:ReactNode;style:StyleProp<ViewStyle>;disabled?:boolean;onOpen:(point:MenuPoint)=>void;}
