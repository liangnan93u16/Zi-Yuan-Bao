# ZPAY支付 接口说明

知识摘取: No
大纲摘取: No

如果您的网站已经集成了**易支付接口**，那么您可以直接使用该API信息，无需另外开发。

**API信息（兼容 易支付 接口）**

接口地址：https://zpayz.cn/

商户ID（PID）：

商户密钥（PKEY）：

**页面跳转支付**

### **请求URL**

https://zpayz.cn/submit.php

---

### **请求方法**

POST 或 GET（推荐POST，不容易被劫持或屏蔽）

此接口可用于用户前台直接发起支付，使用form表单跳转或拼接成url跳转。

---

### **请求参数**

| 参数 | 名称 | 类型 | 是否必填 | 描述 | 范例 |
| --- | --- | --- | --- | --- | --- |
| name | 商品名称 | String | **是** | 商品名称不超过100字 | iphonexs max |
| money | 订单金额 | String | **是** | 最多保留两位小数 | 5.67 |
| type | 支付方式 | String | **是** | 支付宝：alipay 微信支付：wxpay | alipay |
| out_trade_no | 订单编号 | Num | **是** | 每个商品不可重复 | 201911914837526544601 |
| notify_url | 异步通知页面 | String | **是** | 交易信息回调页面，不支持带参数 | http://www.aaa.com/bbb.php |
| pid | 商户唯一标识 | String | **是** | 一串字母数字组合 | 201901151314084206659771 |
| cid | 支付渠道ID | String | **否** | 如果不填则随机使用某一支付渠道 | 1234 |
| param | 附加内容 | String | **否** | 会通过notify_url原样返回 | 金色 256G |
| return_url | 跳转页面 | String | **是** | 交易完成后浏览器跳转，不支持带参数 | http://www.aaa.com/ccc.php |
| sign | 签名（参考本页签名算法） | String | **是** | 用于验证信息正确性，采用md5加密 | 28f9583617d9caf66834292b6ab1cc89 |
| sign_type | 签名方法 | String | **是** | 默认为MD5 | MD5 |

---

### **用法举例**

https://zpayz.cn/submit.php?name=iphone xs Max 一台&money=0.03&out_trade_no=201911914837526544601&notify_url=http://www.aaa.com/notify_url.php&pid=201901151314084206659771&param=金色 256G&return_url=http://www.baidu.com&sign=28f9583617d9caf66834292b6ab1cc89&sign_type=MD5&type=alipay

---

### **成功返回**

直接跳转到付款页面

说明：该页面为收银台，直接访问这个url即可进行付款

---

### **失败返回**

{"code":"error","msg":"具体的错误信息"}

**API接口支付**

### **请求URL**

https://zpayz.cn/mapi.php

---

### **请求方法**

POST（方式为form-data）

---

### **请求参数**

| 字段名 | 变量名 | 必填 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- | --- | --- |
| 商户ID | pid | 是 | String | 1001 |  |
| 支付渠道ID | cid | 否 | String | 1234 | 如果不填则随机使用某一支付渠道 |
| 支付方式 | type | 是 | String | alipay | 支付宝：alipay 微信支付：wxpay |
| 商户订单号 | out_trade_no | 是 | String | 20160806151343349 |  |
| 异步通知地址 | notify_url | 是 | String | http://www.pay.com/notify_url.php | 服务器异步通知地址 |
| 商品名称 | name | 是 | String | VIP会员 | 如超过127个字节会自动截取 |
| 商品金额 | money | 是 | String | 1.00 | 单位：元，最大2位小数 |
| 用户IP地址 | clientip | 是 | String | 192.168.1.100 | 用户发起支付的IP地址 |
| 设备类型 | device | 否 | String | pc | 根据当前用户浏览器的UA判断，传入用户所使用的浏览器或设备类型，默认为pc |
| 业务扩展参数 | param | 否 | String | 没有请留空 | 支付后原样返回 |
| 签名字符串 | sign | 是 | String | 202cb962ac59075b964b07152d234b70 | 签名算法参考本页底部 |
| 签名类型 | sign_type | 是 | String | MD5 | 默认为MD5 |

---

### **成功返回**

| 字段名 | 变量名 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| 返回状态码 | code | Int | 1 | 1为成功，其它值为失败 |
| 返回信息 | msg | String |  | 失败时返回原因 |
| 订单号 | trade_no | String | 20160806151343349 | 支付订单号 |
| ZPAY内部订单号 | O_id | String | 123456 | ZPAY内部订单号 |
| 支付跳转url | payurl | String | https://xxx.cn/pay/wxpay/202010903/ | 如果返回该字段，则直接跳转到该url支付 |
| 二维码链接 | qrcode | String | https://xxx.cn/pay/wxpay/202010903/ | 如果返回该字段，则根据该url生成二维码 |
| 二维码图片 | img | String | https://z-pay.cn/qrcode/123.jpg | 该字段为付款二维码的图片地址 |

---

### **失败返回**

{"code":"error","msg":"具体的错误信息"}

**微信小程序支付**

第一步：使用"API接口支付"获取到O_id参数

第二步：跳转 ZPAY 收银台小程序 appid 为: wxa9882fcbc23a0181

```
小程序具体跳转代码：
    wx.navigateToMiniProgram({
        appId: 'wxa9882fcbc23a0181',
        path: 'pages/pay/pay?type=wxapp&O_id=123456', //请将123456替换为第一步获取到的O_id
        fail(res) {
            wx.showToast({
                title: res.errMsg,
                icon: 'none',
            });
        },
        success(res) {
            wx.showToast({
                title: 'ok',
                icon: 'none',
            });
        },
    });

```

支付成功或者取消，会跳回你的小程序，并携带参数:

```
支付成功：
    extraData: {
        status: 'success'
    }

```

```
支付取消：
    extraData: {
        status: 'cancel'
    }

```

**查询单个订单**

### **请求URL**

https://zpayz.cn/api.php?act=order&pid={商户ID}&key={商户密钥}&out_trade_no={商户订单号}

---

### **请求方法**

GET

---

### **请求参数**

| 参数 | 名称 | 类型 | 必填 | 描述 | 范例 |
| --- | --- | --- | --- | --- | --- |
| act | 操作类型 | String | 是 | 此API固定值 | order |
| pid | 商户ID | String | 是 |  | 20220715225121 |
| key | 商户密钥 | String | 是 |  | 89unJUB8HZ54Hj7x4nUj56HN4nUzUJ8i |
| trade_no | 系统订单号 | String | 选择 |  | 20160806151343312 |
| out_trade_no | 商户订单号 | String | 选择 |  | 20160806151343349 |

---

### **返回结果**

| 字段名 | 变量名 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| 返回状态码 | code | Int | 1 | 1为成功，其它值为失败 |
| 返回信息 | msg | String | 查询订单号成功！ |  |
| 易支付订单号 | trade_no | String | 2016080622555342651 | 易支付订单号 |
| 商户订单号 | out_trade_no | String | 20160806151343349 | 商户系统内部的订单号 |
| 支付方式 | type | String | alipay | 支付宝：alipay 微信支付：wxpay |
| 商户ID | pid | String | 20220715225121 | 发起支付的商户ID |
| 创建订单时间 | addtime | String | 2016-08-06 22:55:52 |  |
| 完成交易时间 | endtime | String | 2016-08-06 22:55:52 |  |
| 商品名称 | name | String | VIP会员 |  |
| 商品金额 | money | String | 1.00 |  |
| 支付状态 | status | Int | 0 | 1为支付成功，0为未支付 |
| 业务扩展参数 | param | String |  | 默认留空 |
| 支付者账号 | buyer | String |  | 默认留空 |

**提交订单退款**

### **请求URL**

https://zpayz.cn/api.php?act=refund

---

### **请求方法**

POST（方式为form-data）

---

### **请求参数**

| 字段名 | 变量名 | 必填 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- | --- | --- |
| 商户ID | pid | 是 | String | 1001 |  |
| 支付方式 | type | 是 | String | alipay | 支付宝：alipay 微信支付：wxpay |
| 商户订单号 | out_trade_no | 是 | String | 20160806151343349 |  |
| 退款金额 | money | 是 | String | 1.00 | 单位：元，最大2位小数 |
| 签名字符串 | sign | 是 | String | 202cb962ac59075b964b07152d234b70 | 签名算法参考本页底部 |
| 签名类型 | sign_type | 是 | String | MD5 | 默认为MD5 |

---

### **成功返回**

| 字段名 | 变量名 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| 返回状态码 | code | Int | 1 | 1为成功，其它值为失败 |
| 返回信息 | msg | String | 提交退款订单成功！ |  |

---

### **失败返回**

{"code":"error","msg":"具体的错误信息"}

**签名算法**

### **签名生成的通用步骤如下：**

第一步：设所有发送或者接收到的数据为集合M，将集合M内非空参数值的参数按照参数名ASCII码从小到大排序（字典序），使用URL键值对的格式（即key1=value1&key2=value2…）拼接成字符串stringA。

特别注意以下重要规则：

◆ 参数名ASCII码从小到大排序（字典序）；
◆ 如果参数的值为空不参与签名；
◆ 参数名区分大小写；
◆ 验证调用返回或主动通知签名时，传送的sign参数不参与签名，将生成的签名与该sign值作校验。
◆ 接口可能增加字段，验证签名时必须支持增加的扩展字段

第二步：在stringA最后拼接上key得到stringSignTemp字符串，并对stringSignTemp进行MD5运算，再将得到的字符串所有字符转换为小写，得到sign值signValue。

举例：

假设传送的参数如下：

pid：1001
type：alipay
out_trade_no：20160806151343349
notify_url：http://www.pay.com/notify_url.php
name：VIP会员
money：1.00
clientip：192.168.1.100
device：pc
param：
sign_type：MD5

第一步：对参数按照key=value的格式，并按照参数名ASCII字典序排序如下：

stringA="clientip=192.168.1.100&device=pc&money=1.00&name=VIP会员&notify_url=http://www.pay.com/notify_url.php&out_trade_no=20160806151343349&pid=1001&sign_type=MD5&type=alipay";

第二步：拼接API密钥：

stringSignTemp=stringA+"89unJUB8HZ54Hj7x4nUj56HN4nUzUJ8i" //注意：key为商户平台设置的密钥key
sign=MD5(stringSignTemp).toLowerCase()="202cb962ac59075b964b07152d234b70" //注意：MD5签名方式，将32位签名转换为小写

最终得到签名结果：202cb962ac59075b964b07152d234b70

### **异步通知参数说明**

支付完成后，易支付会把相关支付结果和用户信息发送给商户，商户需要接收处理，并返回应答。

对后台通知交互时，如果易支付收到商户的应答不是成功或超时，易支付认为通知失败，易支付会通过一定的策略定期重新发起通知，尽可能提高通知的成功率，但易支付不保证通知最终能成功。 （通知频率为15s/15s/30s/180s/1800s/1800s/1800s/1800s/3600s/3600s，通知机制保障商户能够收到异步通知，但不保证异步通知一定成功。）

由于存在重新发送异步通知的情况，因此同样的通知可能会多次发送给商户系统。商户系统必须能够正确处理重复的通知。

推荐的做法是，当收到通知进行处理时，首先检查对应业务数据的状态，判断该通知是否已经处理过，如果没有处理过再进行处理，如果处理过直接返回结果成功。在对业务数据进行状态检查和处理之前，要采用数据锁进行并发控制，以避免函数重入造成的数据混乱。

特别提醒：商户系统对于支付结果通知的内容一定要做签名验证,并校验返回的订单金额是否与商户侧的订单金额一致，防止数据泄漏导致出现"假通知"，造成资金损失。

技术人员可登进商户平台下载日志，也可通过验签工具来验证签名正确性。

**程序执行完后必须打印输出"success"（不包含引号）。如果商户反馈给易支付的字符不是success这7个字符，易支付服务器会不断重发通知，直到超过24小时22分钟。一般情况下，25小时以内完成8次通知（通知的间隔频率一般是：4m,10m,10m,1h,2h,6h,15h）；**

### **异步通知参数**

| 参数名 | 参数 | 类型 | 描述 |
| --- | --- | --- | --- |
| 商户订单号 | out_trade_no | String | 商户系统内部的订单号 |
| 易支付订单号 | trade_no | String | 易支付订单号 |
| 易支付交易号 | trade_status | String | 交易状态 TRADE_SUCCESS |
| 商户ID | pid | String | 发起支付的商户ID |
| 商品名称 | name | String | 商品名称 |
| 商品金额 | money | String | 商品金额 |
| 支付方式 | type | String | 支付宝：alipay 微信支付：wxpay |
| 支付状态 | status | String | 支付状态 |
| 业务扩展参数 | param | String | 业务扩展参数 |
| 签名 | sign | String | 签名 |
| 签名类型 | sign_type | String | 签名类型，目前仅支持MD5 |

### **同步跳转参数说明**

同步跳转参数同异步通知参数完全一致，同步跳转的作用主要是支付完成后，让用户浏览器返回到商户指定页面。该页面可以展示给用户支付成功等相关信息。

**如果商户希望获得极为可靠的到账通知，建议同时开启同步通知和异步通知，以异步通知为准，同步通知为辅。**

同步跳转是在用户支付完成之后，易支付将用户浏览器跳转回商户网站的一种方式。跳转回商户网站的时候，易支付会带上一些参数，商户可以根据这些参数来判断交易的状态等。

需要注意，因为同步跳转的不可靠性（用户浏览器可能不跳转，或者跳转的时候已经不在商户的网站上了等等），商户一般都不能单独依赖同步跳转来获得交易成功的信息，而需要依赖服务端异步通知。