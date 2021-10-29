import Vue from 'vue'
import {
  Button,
  ButtonGroup,
  Message,
  Tabs,
  TabPane,
  Loading,
  Table,
  TableColumn,
  Slider,
  Notification,
  Select,
  Option,
  Pagination,
  Cascader,
  Input,
  Upload,
  Alert,
  Dialog,
  Form,
  FormItem,
  Popover,
  Popconfirm,
  MessageBox
} from 'element-ui';

import 'normalize.css';

import App from './App.vue'
// import router from './router'
// import store from './store'

Vue.use(Button);
Vue.use(ButtonGroup);
Vue.use(Tabs);
Vue.use(TabPane);
Vue.use(Loading.directive);
Vue.use(Table);
Vue.use(TableColumn);
Vue.use(Slider);
Vue.use(Select);
Vue.use(Option);
Vue.use(Pagination);
Vue.use(Cascader);
Vue.use(Input);
Vue.use(Upload);
Vue.use(Alert);
Vue.use(Dialog);
Vue.use(Form);
Vue.use(FormItem);
Vue.use(Popover);
Vue.use(Popconfirm);

Vue.prototype.$message = Message;
Vue.prototype.$loading = Loading.service;
Vue.prototype.$notify = Notification;
Vue.prototype.$msgbox = MessageBox;
Vue.prototype.$alert = MessageBox.alert;
Vue.prototype.$confirm = MessageBox.confirm;
Vue.prototype.$prompt = MessageBox.prompt;

Vue.config.productionTip = false

new Vue({
  // router,
  // store,
  render: h => h(App)
}).$mount('#app')
