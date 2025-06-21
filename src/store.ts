import {
  effectScope,
  EffectScope,
  inject,
  isReactive,
  isRef,
  reactive,
  toRaw,
  watch,
  WatchOptions,
} from "vue";
import { Pinia, piniaSymbol } from "./createPinia";
import {
  ActionTree,
  DeepPartial,
  GetterTree,
  isComputed,
  isObject,
  Method,
  MutationType,
  StateTree,
  StoreOnActionListener,
  SubscriptionCallback,
} from "./types";
import { addSubscription, noop, triggerSubsciption } from "./subscriptions";

/**
 * Store 的结构，包含 state，getters，actions和一些方法
 */
export type Store<
  S extends StateTree = StateTree,
  G extends GetterTree<S> = GetterTree<S>,
  A extends ActionTree = ActionTree
> = S &
  G &
  A & {
    /** store 的 id，所有 store 的 id 必须各不相同 */
    $id: string;
    /** 方便找到 pinia，因为最新的数据在 pinia 上 */
    $pinia: Pinia;
    /** 响应式数据 */
    $state: S;
    /** 通过 patch 可以修改 state */
    $patch(partialState: DeepPartial<S>): void;
    $patch<Fn extends (state: S) => unknown>(fn: Fn): void;
    /** 重置状态 */
    $reset(): void;
    /** 订阅状态变化，返回取消订阅函数 */
    $subscribe(
      callback: any,
      options: { detached?: boolean } & WatchOptions
    ): () => void;
    /** 监听 action 的调用，返回取消监听的函数 */
    $onAction(callback: any, detached?: boolean): () => void;
    /** 清除 store */
    $dispose(): void;
  };

/**
 * 后续我们会通过 store.$state = partialStore 深度赋值，所以需要一个方法处理深度赋值
 */
function mergeReactiveObjects<
  T extends Record<any, unknown> | Map<unknown, unknown> | Set<unknown>
>(target: T, partialState: DeepPartial<T>) {
  // map 和 set
  if (target instanceof Map && partialState instanceof Map) {
    partialState.forEach((val, key) => target.set(key, val));
    return;
  } else if (target instanceof Set && partialState instanceof Set) {
    partialState.forEach((val) => target.add(val));
    return;
  }

  // 剩下的就是普通对象
  Object.keys(partialState).forEach((key) => {
    const oldVal = target[key];
    const newVal = partialState[key];
    if (Object.is(oldVal, newVal)) return;

    // 如果值都是对象考虑是否需要深度赋值
    // 新值上 ref 或者 reactive 说明已经是响应式对象，不需要再深度复制，否则会丢失响应式
    if (
      isObject(newVal) &&
      isObject(oldVal) &&
      !isRef(newVal) &&
      !isReactive(newVal)
    ) {
      target[key] = mergeReactiveObjects(target[key], newVal);
    } else {
      target[key] = newVal;
    }
  });
}

/**
 * 暂时只考虑 setup 风格创建 store，options 就是 setup 函数，返回的数据作为 state
 */
export function defineStore<
  S extends StateTree,
  G extends GetterTree<S>,
  A extends ActionTree
>(id: string, setup: () => S & G & A) {
  // 先从 pinia 上找一下对应 id 的 store 是否存在
  // 还记得 pinia 在哪里吗？我们会在 vue 的入口文件中通过 createPinia 创建 pinia 插件
  // 然后 pinia 会通过 provide 提供到全局所有组件中，现在通过 inject 来获取
  const pinia = inject<Pinia>(piniaSymbol);

  function useStore() {
    if (!pinia) {
      throw "pinia 未定义";
    }

    if (!pinia.stores[id]) {
      // pinia 上不存在该 id 的 store，开始创建 store
      const store = createSetupStore(id, setup, pinia);
      // 放在 pinia 上
      // @ts-ignore
      pinia.stores[id] = store;
    }

    return pinia.stores[id];
  }
  useStore.$id = id;
  return useStore;
}

function createSetupStore<
  S extends StateTree,
  G extends GetterTree<S>,
  A extends ActionTree
>(id: string, setup: () => S & G & A, pinia: Pinia): Store<S, G, A> {
  let subscriptions: SubscriptionCallback<S>[] = [];
  let actionSubscriptions: StoreOnActionListener[] = [];
  const scope = effectScope();
  const initialState = pinia.states[id];
  if (!initialState) {
    pinia.states[id] = {};
  }

  const $patch: Store["$patch"] = (partialStateOrMutator) => {
    let subscriptionMutation: any;

    if (typeof partialStateOrMutator === "function") {
      partialStateOrMutator(pinia.states[id]);
      subscriptionMutation = {
        type: MutationType.patchFunction,
        storeId: id,
      };
    } else {
      mergeReactiveObjects(pinia.states[id], partialStateOrMutator);
      subscriptionMutation = {
        type: MutationType.patchObject,
        storeId: id,
        payload: partialStateOrMutator,
      };
    }

    triggerSubsciption(
      subscriptions,
      subscriptionMutation,
      pinia.states[id] as S
    );
  };

  // 选项式 api 有 $reset 方法，因为可以通过重新执行生成 state 的函数来覆盖现在的 state
  // 而组合式 api 没有 $reset 方法，需要自己实现
  const $reset: Store["$reset"] = noop;

  const $dispose: Store["$dispose"] = () => {
    scope.stop();
    subscriptions = [];
    actionSubscriptions = [];
    delete pinia.states[id];
  };

  // 包装用户的 action，这里可以做一些处理，比如执行真正的 action 之间触发 onActionSubscritions 订阅
  const action = <Fn extends Method>(fn: Fn): Fn => {
    const wrappedAction = function (this: any, ...args: any[]) {
      const afterCallbacks: Method[] = [];
      const onErrorCallbacks: Method[] = [];

      const after = (callback: Method) => afterCallbacks.push(callback);
      const onError = (callback: Method) => onErrorCallbacks.push(callback);
      const store = pinia.stores[id];

      triggerSubsciption(actionSubscriptions, {
        args,
        store,
        after,
        onError,
      });

      let ret: unknown;
      try {
        ret = fn.apply(store, args);
      } catch (error) {
        triggerSubsciption(onErrorCallbacks, error);
        throw error;
      }

      if (ret instanceof Promise) {
        return ret
          .then((value) => {
            triggerSubsciption(afterCallbacks, value);
            return value;
          })
          .catch((error) => {
            triggerSubsciption(onErrorCallbacks, error);
            throw error;
          });
      }

      triggerSubsciption(afterCallbacks, ret);
      return ret;
    };

    return wrappedAction as Fn;
  };

  const $onAction: Store["$onAction"] = (callback, detached) => {
    return addSubscription(actionSubscriptions, callback, detached);
  };

  const $subscribe: Store["$subscribe"] = (callback, options) => {
    const removeSubscription = addSubscription(
      subscriptions,
      callback,
      options.detached,
      () => {
        stopWatcher();
      }
    );

    const stopWatcher = scope.run(() => {
      return watch(
        () => pinia.states[id],
        (state) => {
          callback(
            {
              storeId: id,
              type: MutationType.direct,
            },
            state
          );
        },
        options
      );
    })!;

    return removeSubscription;
  };

  const store = reactive({
    $id: id,
    $pinia: pinia,
    $onAction,
    $dispose,
    $patch,
    $reset,
    $subscribe,
  }) as Store<S, G, A>;
  pinia.stores[id] = store;

  const setupStore = pinia.scope.run(() => scope.run(() => setup()))!;
  for (const key in setupStore) {
    const prop = setupStore[key];

    if ((isRef(prop) && !isComputed(prop)) || isReactive(prop)) {
      pinia.states[id][key] = prop;
    } else if (typeof prop === "function") {
      // @ts-ignore
      setupStore[key] = action(prop);
    }
  }

  Object.assign(store, setupStore);
  Object.assign(toRaw(store), setupStore);

  Object.defineProperty(store, "$state", {
    get: () => pinia.states[id],
    set: (state) => {
      $patch(($state) => {
        Object.assign($state, state);
      });
    },
  });

  return store;
}
