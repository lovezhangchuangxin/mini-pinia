import { getCurrentScope, onScopeDispose } from "vue";
import { Method } from "./types";

export const noop = () => {};

export function addSubscription<T extends Method>(
  subscriptions: T[],
  callback: T,
  detached?: boolean,
  onCleanup: () => void = noop
) {
  subscriptions.push(callback);

  const removeSubscription = () => {
    const index = subscriptions.indexOf(callback);
    if (index >= 0) {
      subscriptions.splice(index, 1);
      onCleanup();
    }
  };

  if (!detached && getCurrentScope()) {
    // 组件被销毁时自动取消订阅
    onScopeDispose(removeSubscription);
  }

  return removeSubscription;
}

export function triggerSubsciption<T extends Method>(
  subscriptions: T[],
  ...args: Parameters<T>
) {
  subscriptions.forEach((callback) => callback(...args));
}
