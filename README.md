# mini-pinia

本项目旨在学习 pinia 的核心逻辑，不考虑插件、SSR、开发环境的差异等，也不考虑多个 pinia 实例的情况。

## pinia 实例

createPinia 创建了一个 pinia 实例，它同时也是一个 vue 插件。当 app.use(pinia) 时会调用 pinia 对象的 install 方法安装插件，在其中 pinia 可以获取到 app 实例放在自己身上，同时通过 provide 为所有组件提供 pinia。

pinia 存放了 store，不同 store 的 $id 不同。对于同一个 $id，只有第一次才会真正创建 store，然后放在 pinia 上，后续对该 $id 的 store 直接从 pinia 上读取。

pinia 上还存放了所有 store 的 state，当某个 store 被销毁时，对应的在 pinia 上的 state 并不会被自动删除。这样当后续重新创建该 store 可以复用上一次的数据。

## store

store 到底是什么？可以把它看做存放 state、getters、actions 的对象。state 是状态数据，getters 是计算属性，而 actions 就是普通的方法。

除此之外，store 还包含一些内置的属性和方法，比如：

- $id，store 的唯一标识符
- $patch，可以通过 patch 一个对象或者函数从而对 state 进行修改
- $subscribe，订阅对 state 的修改，返回取消订阅函数
- $reset，对于 option store，$reset 的作用是生成一个新的 state 对象合并到现有的 state 对象（浅层合并），从而实现重置 state 的作用。setup store 则需要自己实现该方法。
- $onAction，当我们自己定义的 action 执行之前会先执行传入 $onAction 的回调，返回取消函数
- $dispose，销毁 store，但是 store 在 pinia 上的数据不会自动删除，这样下次创建 store 时可以复用
