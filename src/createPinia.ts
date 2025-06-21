import {
  App,
  effectScope,
  EffectScope,
  markRaw,
  ObjectPlugin,
  provide,
  Ref,
} from "vue";
import { StateTree } from "./types";
import { Store } from "./store";

export const piniaSymbol = Symbol();

/**
 * pinia 实例
 */
export interface Pinia extends ObjectPlugin {
  /** vue 应用实例 */
  app: App;
  /** 存储所有的 store */
  stores: Record<string, Store>;
  /** 存储所有 store 的状态数据，键为 store 的名字，值为 store 的 state 数据*/
  states: Record<string, StateTree>;
  /** effectScope，方便清理副作用 */
  scope: EffectScope;
}

/**
 * 创建 pinia 实例，它是一个 vue 插件
 */
export function createPinia(): Pinia {
  // pinia 会被绑定在 store 上，而 store 会使用 reactive 包装
  // 使用 markRaw 避免 reactive 对 pinia 实例进行代理
  const pinia: Pinia = markRaw({
    install(app) {
      pinia.app = app;
      provide(piniaSymbol, pinia);
    },
    // @ts-ignore
    app,
    stores: {},
    states: {},
    scope: effectScope(true),
  });

  return pinia;
}

/**
 * 销毁 pinia
 */
export function disposePinia(pinia: Pinia) {
  pinia.scope.stop();
  pinia.stores = {};
  pinia.states = {};
}
