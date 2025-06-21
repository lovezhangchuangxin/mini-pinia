# mini-pinia

本项目旨在学习 pinia 的核心逻辑，不考虑插件、SSR、开发环境的差异等，也不考虑多个 pinia 实例的情况。

## pinia 实例

createPinia 创建了一个 pinia 实例，它同时也是一个 vue 插件。当 app.use(pinia) 时会调用 pinia 对象的 install 方法安装插件，在其中 pinia 可以获取到 app 实例放在自己身上，同时通过 provide 为所有组件提供 pinia。

pinia 存放了 store，不同 store 的 $id 不同。对于同一个 $id，只有第一次才会真正创建 store，然后放在 pinia 上，后续对该 $id 的 store 直接从 pinia 上读取。

pinia 上还存放了所有 store 的 state，当某个 store 被销毁时，对应的在 pinia 上的 state 并不会被自动删除。这样当后续重新创建该 store 可以复用上一次的数据。
