import COS from 'cos-nodejs-sdk-v5';

// COS配置
const cos = new COS({
    SecretId: process.env.COS_SECRET_ID || '',
    SecretKey: process.env.COS_SECRET_KEY || '',
});

// COS配置参数
const COS_CONFIG = {
    Bucket: process.env.COS_BUCKET || '',
    Region: process.env.COS_REGION || 'ap-beijing',
    Domain: process.env.COS_DOMAIN || '', // 可选：自定义域名
};

/**
 * 上传文件到腾讯云COS
 * @param file 文件buffer
 * @param key 文件在COS中的路径/名称
 * @param contentType 文件类型
 * @returns Promise<string> 返回文件的访问URL
 */
export async function uploadToCOS(
    file: Buffer, 
    key: string, 
    contentType?: string
): Promise<string> {
    try {
        const result = await cos.putObject({
            Bucket: COS_CONFIG.Bucket,
            Region: COS_CONFIG.Region,
            Key: key,
            Body: file,
            ContentType: contentType,
            ACL: 'public-read', // 设置为公共读取权限
        });

        // 生成预签名访问URL (长期有效)
        const signedUrl = cos.getObjectUrl({
            Bucket: COS_CONFIG.Bucket,
            Region: COS_CONFIG.Region,
            Key: key,
            Sign: true,
            Expires: 31536000, // 1年有效期，对于图片资源来说足够长
        });

        console.log('文件上传到COS成功，使用预签名URL:', signedUrl);
        return signedUrl;
    } catch (error) {
        console.error('上传到COS失败:', error);
        throw new Error(`COS上传失败: ${error}`);
    }
}

/**
 * 从腾讯云COS删除文件
 * @param key 文件在COS中的路径/名称
 * @returns Promise<void>
 */
export async function deleteFromCOS(key: string): Promise<void> {
    try {
        await cos.deleteObject({
            Bucket: COS_CONFIG.Bucket,
            Region: COS_CONFIG.Region,
            Key: key,
        });
        console.log('从COS删除文件成功:', key);
    } catch (error) {
        console.error('从COS删除文件失败:', error);
        throw new Error(`COS删除失败: ${error}`);
    }
}

/**
 * 生成文件key（路径）
 * @param originalName 原始文件名
 * @param prefix 路径前缀，默认为'images'
 * @returns string
 */
export function generateFileKey(originalName: string, prefix: string = 'images'): string {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = originalName.substring(originalName.lastIndexOf('.'));
    const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
    const filename = `${baseName}-${uniqueSuffix}${ext}`;
    return `${prefix}/${filename}`;
}

/**
 * 从URL中提取COS文件key
 * @param url 完整的COS文件URL
 * @returns string 文件key
 */
export function extractKeyFromUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        // 移除开头的斜杠
        return urlObj.pathname.substring(1);
    } catch (error) {
        console.error('解析URL失败:', error);
        throw new Error('无效的URL格式');
    }
}

/**
 * 检查COS配置是否完整
 * @returns boolean
 */
export function isCOSConfigured(): boolean {
    return !!(
        process.env.COS_SECRET_ID && 
        process.env.COS_SECRET_KEY && 
        process.env.COS_BUCKET
    );
}