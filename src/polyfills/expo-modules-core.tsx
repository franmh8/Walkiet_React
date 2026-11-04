export class EventEmitter {
  addListener() { return { remove: () => {} }; }
  removeListener() {}
  emit() {}
}
export class NativeModule {}
export class SharedObject {}
export class SharedRef {}
export const requireNativeModule = () => ({});
export const requireOptionalNativeModule = () => null;

export default {
  EventEmitter,
  NativeModule,
  SharedObject,
  SharedRef,
  requireNativeModule,
  requireOptionalNativeModule,
};
