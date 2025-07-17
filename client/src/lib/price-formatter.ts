/**
 * 格式化价格显示
 * @param price 价格值（可能是字符串或数字）
 * @returns 格式化后的价格字符串
 */
export function formatPrice(price: string | number | undefined | null): string {
  let priceValue = 0;
  
  if (price) {
    // 转换为数字
    const numericPrice = Number(price);
    if (!isNaN(numericPrice)) {
      priceValue = numericPrice;
    }
  }
  
  // 如果是整数，显示整数；如果是小数，保留小数部分
  if (priceValue % 1 === 0) {
    // 整数，直接显示不带小数点
    return priceValue.toString();
  } else {
    // 小数，保留有效小数位（去除尾部的0）
    return parseFloat(priceValue.toFixed(2)).toString();
  }
}