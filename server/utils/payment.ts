import crypto from 'crypto';

/**
 * 生成唯一的订单号
 * 格式: 年月日时分秒 + 6位随机数
 */
export function generateOrderNo(): string {
  const now = new Date();
  const date = now.getFullYear().toString().substring(2) + 
               String(now.getMonth() + 1).padStart(2, '0') + 
               String(now.getDate()).padStart(2, '0');
  const time = String(now.getHours()).padStart(2, '0') + 
               String(now.getMinutes()).padStart(2, '0') + 
               String(now.getSeconds()).padStart(2, '0');
  
  // 生成6位随机数
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  
  return `${date}${time}${random}`;
}

/**
 * 生成支付签名
 * @param params 参数对象
 * @param merchantKey 商户密钥
 * @returns 生成的MD5签名
 */
export function generatePaymentSign(params: Record<string, any>, merchantKey: string): string {
  // 1. 过滤空值和sign、sign_type参数
  const filteredParams = Object.entries(params)
    .filter(([key, value]) => {
      return value !== undefined && value !== '' && key !== 'sign' && key !== 'sign_type';
    })
    .sort(([a], [b]) => a.localeCompare(b)) // 按参数名ASCII码从小到大排序
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, any>);
    
  // 2. 将参数拼接成URL键值对的格式
  const queryString = Object.entries(filteredParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
    
  // 3. 拼接商户密钥
  const signString = queryString + merchantKey;
  
  // 4. 计算MD5并转为小写
  return crypto.createHash('md5').update(signString).digest('hex').toLowerCase();
}

/**
 * 验证支付回调签名
 * @param callbackParams 回调参数
 * @param merchantKey 商户密钥
 * @returns 签名是否有效
 */
export function verifyPaymentCallback(callbackParams: Record<string, any>, merchantKey: string): boolean {
  const receivedSign = callbackParams.sign;
  const calculatedSign = generatePaymentSign(callbackParams, merchantKey);
  return receivedSign === calculatedSign;
}