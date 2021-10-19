import Vue from 'vue'
import { Button, Message, Tabs, TabPane, Container, Header, Main, Footer, Loading, Table, TableColumn } from 'element-ui';

import 'normalize.css';

import App from './App.vue'
// import router from './router'
// import store from './store'

Vue.use(Button);
Vue.use(Tabs);
Vue.use(TabPane);
Vue.use(Container);
Vue.use(Header);
Vue.use(Main);
Vue.use(Footer);
Vue.use(Loading.directive);
Vue.use(Table);
Vue.use(TableColumn);

Vue.prototype.$message = Message;
Vue.prototype.$loading = Loading.service;

Vue.config.productionTip = false

new Vue({
  // router,
  // store,
  render: h => h(App)
}).$mount('#app')
