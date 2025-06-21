import { toRefs } from "vue";

// storeToRefs 和 toRefs 的不同在于前者不会考虑非响应式的属性 以及 值为函数的属性
// 这里偷懒先用 toRefs 代替
export const storeToRefs = toRefs;
