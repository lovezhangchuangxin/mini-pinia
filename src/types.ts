import { ComputedRef, isRef } from "vue";

export type StateTree = Record<string, any>;

export type GetterTree<S extends StateTree> = Record<string, (state: S) => any>;

export type Method = (...args: any[]) => any;
export type ActionTree = Record<string, Method>;

export type DeepPartial<T> = {
  [K in keyof T]?: DeepPartial<T[K]>;
};

export function isObject(target: any): target is object {
  return typeof target === "object" && target !== null;
}

/**
 * 判断是否是计算属性
 */
export function isComputed(target: any): target is ComputedRef {
  return !!(isRef(target) && (target as ComputedRef).effect);
}

/**
 * state 订阅回调函数，当 state 变化时执行
 */
export type SubscriptionCallback<S> = (mutation: any, state: S) => void;

/**
 * action 监听函数
 */
export type StoreOnActionListener = (context: any) => void;

/**
 * mutation 类型
 */
export enum MutationType {
  // 直接通过赋值改变 state
  direct = "direct",
  // patch 一个 state
  patchObject = "patchObject",
  // patch 传函数
  patchFunction = "pactchFunction",
}
