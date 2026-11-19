import type {ReactNode} from 'react';
import type {StyleProp,ViewStyle} from 'react-native';
export interface VoiceRecordButtonProps {style:StyleProp<ViewStyle>;disabled:boolean;recording:boolean;start:()=>void;finish:()=>void;cancel:()=>void;children:ReactNode;}
