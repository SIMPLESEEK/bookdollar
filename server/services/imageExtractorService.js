const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const https = require('https');

// 腾讯云COS
let cos = null;
try {
  const COS = require('cos-nodejs-sdk-v5');

  // 如果配置了腾讯云COS，则初始化COS对象
  if (process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY) {
    cos = new COS({
      SecretId: process.env.COS_SECRET_ID,
      SecretKey: process.env.COS_SECRET_KEY
    });
  }
} catch (error) {
  console.error('腾讯云COS SDK加载失败:', error.message);
}

// 在Vercel环境中，我们不能依赖本地文件系统
// 定义预览图目录路径，但在Vercel环境中不会实际创建
const previewDir = process.env.VERCEL
  ? '/tmp/previews' // 在Vercel中使用临时目录
  : path.join(__dirname, '../../client/public/previews');

// 只在非Vercel环境中创建目录
if (!process.env.VERCEL && !fs.existsSync(previewDir)) {
  try {
    fs.mkdirSync(previewDir, { recursive: true });
    console.log(`[图片提取] 创建预览图目录: ${previewDir}`);
  } catch (error) {
    console.error(`[图片提取] 创建预览图目录失败: ${error.message}`);
  }
}

/**
 * 从网页中提取图片和标题作为预览图，优先存储在腾讯云COS上
 * @param {string} url 目标网址
 * @returns {Promise<{success: boolean, previewImage: string, pageTitle: string}>} 结果对象
 */
async function extractImageFromUrl(url) {
  console.log(`[图片提取] 正在从URL提取图片和标题: ${url}`);

  // 移除URL中的查询参数，以便更好地匹配缓存
  let baseUrl = url;
  try {
    const urlObj = new URL(url);
    // 如果URL中有查询参数，移除它们
    if (urlObj.search) {
      baseUrl = url.replace(urlObj.search, '');
      console.log(`[图片提取] 移除查询参数后的URL: ${baseUrl}`);
    }
  } catch (error) {
    // 如果URL解析失败，使用原始URL
    console.error(`[图片提取] URL解析失败: ${error.message}`);
  }

  // 特殊处理acuitybrands.com网站
  if (baseUrl.includes('hydrel.acuitybrands.com')) {
    console.log(`[图片提取] 特殊处理Hydrel网站`);
    // 使用一个公共的图片URL作为备选
    const heroImage = 'https://www.acuitybrands.com/-/media/abl/acuitybrands/images/products/lithonia/wf4-led-hero.jpg';

    // 为URL生成唯一的文件名
    const urlHash = crypto.createHash('md5').update(baseUrl).digest('hex');
    const fileName = `${urlHash}.jpg`;
    const filePath = path.join(previewDir, fileName);
    const publicPath = `/previews/${fileName}`;

    try {
      // 下载图片
      console.log(`[图片提取] 下载预设图片: ${heroImage}`);
      const imageResponse = await axios.get(heroImage, {
        responseType: 'arraybuffer',
        timeout: 15000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      });

      // 保存到本地
      await promisify(fs.writeFile)(filePath, imageResponse.data);
      console.log(`[图片提取] 预设图片已保存到本地: ${filePath}`);

      // 上传到COS
      if (cos && process.env.COS_BUCKET) {
        try {
          const cosUrl = await uploadToCOS(fileName, imageResponse.data);
          console.log(`[图片提取] 预设图片已上传到腾讯云COS: ${cosUrl}`);
        } catch (cosError) {
          console.error('[图片提取] 上传预设图片到腾讯云COS失败:', cosError.message);
        }
      }

      return {
        success: true,
        previewImage: publicPath,
        originalImageUrl: heroImage
      };
    } catch (error) {
      console.error('[图片提取] 下载预设图片失败:', error.message);
      // 如果下载失败，继续使用常规方法
    }
  }

  // 为URL生成唯一的文件名
  const urlHash = crypto.createHash('md5').update(baseUrl).digest('hex');
  const fileName = `${urlHash}.jpg`;
  const filePath = path.join(previewDir, fileName);
  const publicPath = `/previews/${fileName}`;

  try {
    // 首先检查腾讯云COS上是否有预览图
    if (cos && process.env.COS_BUCKET) {
      try {
        const cosPreviewPath = await getFromCOS(fileName);
        if (cosPreviewPath) {
          console.log(`[图片提取] 从COS获取预览图成功: ${cosPreviewPath}`);
          return { success: true, previewImage: cosPreviewPath };
        }
      } catch (error) {
        console.error('[图片提取] 从COS获取预览图失败:', error.message);
      }
    }

    // 如果COS上没有，检查本地是否有缓存
    if (fs.existsSync(filePath)) {
      // 获取文件的创建时间
      const stats = await promisify(fs.stat)(filePath);
      const fileAge = Date.now() - stats.mtime.getTime();

      // 如果文件不超过7天，直接返回缓存的预览图
      if (fileAge < 7 * 24 * 60 * 60 * 1000) {
        console.log(`[图片提取] 使用本地缓存的预览图: ${filePath}`);

        // 如果配置了腾讯云COS，将本地缓存上传到COS
        if (cos && process.env.COS_BUCKET) {
          try {
            const fileData = await promisify(fs.readFile)(filePath);
            await uploadToCOS(fileName, fileData);
            console.log(`[图片提取] 本地缓存已上传到COS`);
          } catch (uploadError) {
            console.error('[图片提取] 上传本地缓存到COS失败:', uploadError.message);
          }
        }

        return { success: true, previewImage: publicPath };
      }
    }

    // 获取网页内容
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      timeout: 15000, // 增加超时时间
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });

    // 使用cheerio解析HTML
    const $ = cheerio.load(response.data);

    // 提取网页标题
    let pageTitle = '';

    // 首先尝试获取Open Graph标题
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) {
      pageTitle = ogTitle;
      console.log(`[图片提取] 从Open Graph获取到标题: ${pageTitle}`);
    }
    // 然后尝试获取Twitter卡片标题
    else if ($('meta[name="twitter:title"]').attr('content')) {
      pageTitle = $('meta[name="twitter:title"]').attr('content');
      console.log(`[图片提取] 从Twitter卡片获取到标题: ${pageTitle}`);
    }
    // 然后尝试获取HTML标题标签
    else if ($('title').text()) {
      pageTitle = $('title').text().trim();
      console.log(`[图片提取] 从HTML标题标签获取到标题: ${pageTitle}`);
    }

    // 如果标题是空的或者与域名相同，尝试其他方法
    if (!pageTitle || pageTitle === domain) {
      // 尝试获取H1标签
      const h1Text = $('h1').first().text().trim();
      if (h1Text) {
        pageTitle = h1Text;
        console.log(`[图片提取] 从H1标签获取到标题: ${pageTitle}`);
      }
      // 尝试获取应用名称
      else if ($('meta[name="application-name"]').attr('content')) {
        pageTitle = $('meta[name="application-name"]').attr('content');
        console.log(`[图片提取] 从应用名称获取到标题: ${pageTitle}`);
      }
    }

    // 对于特定网站的特殊处理
    if (url.includes('quark.cn') || url.includes('ai.quark.cn')) {
      pageTitle = '夸克';
      console.log(`[图片提取] 特殊处理夸克网站，设置标题为: ${pageTitle}`);
    }

    console.log(`[图片提取] 最终提取到的网页标题: ${pageTitle}`);

    // 尝试获取最佳图片（非logo）
    const imageUrl = findBestImage($, url);

    if (!imageUrl) {
      console.log(`[图片提取] 未找到合适的图片: ${url}`);
      return {
        success: false,
        previewImage: '',
        pageTitle: pageTitle || ''
      };
    }

    console.log(`[图片提取] 找到图片: ${imageUrl}`);

    // 下载图片
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000, // 增加超时时间
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });

    // 优先上传到腾讯云COS
    let cosUrl = '';
    if (cos && process.env.COS_BUCKET) {
      try {
        cosUrl = await uploadToCOS(fileName, imageResponse.data);
        console.log(`[图片提取] 图片已上传到腾讯云COS: ${cosUrl}`);

        // 在非Vercel环境中，同时保存到本地作为缓存
        if (!process.env.VERCEL) {
          try {
            await promisify(fs.writeFile)(filePath, imageResponse.data);
            console.log(`[图片提取] 图片已保存到本地作为缓存: ${filePath}`);
          } catch (fsError) {
            console.error(`[图片提取] 保存到本地缓存失败: ${fsError.message}`);
          }
        }

        // 构建COS URL
        let finalUrl;
        if (process.env.COS_DOMAIN) {
          finalUrl = `${process.env.COS_DOMAIN}/previews/${fileName}`;
        } else {
          finalUrl = `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION || 'ap-guangzhou'}.myqcloud.com/previews/${fileName}`;
        }

        // 返回COS URL
        return {
          success: true,
          previewImage: finalUrl, // 使用完整的COS URL
          originalImageUrl: imageUrl,
          pageTitle: pageTitle || ''
        };
      } catch (cosError) {
        console.error('[图片提取] 上传到腾讯云COS失败:', cosError.message);
      }
    }

    // 如果COS上传失败或未配置COS
    if (!process.env.VERCEL) {
      // 在非Vercel环境中，保存到本地
      try {
        await promisify(fs.writeFile)(filePath, imageResponse.data);
        console.log(`[图片提取] 图片已保存到本地: ${filePath}`);

        return {
          success: true,
          previewImage: publicPath,
          originalImageUrl: imageUrl,
          pageTitle: pageTitle || ''
        };
      } catch (fsError) {
        console.error(`[图片提取] 保存到本地失败: ${fsError.message}`);
      }
    }

    // 在Vercel环境中，如果COS上传失败，返回失败
    return {
      success: false,
      previewImage: '',
      originalImageUrl: imageUrl,
      pageTitle: pageTitle || ''
    };
  } catch (error) {
    console.error('[图片提取] 提取图片失败:', error.message);
    return {
      success: false,
      previewImage: '',
      pageTitle: pageTitle || '' // 即使提取图片失败，也返回已获取的标题
    };
  }
}

/**
 * 从HTML中找到最佳的图片URL，优先选择非logo的内容图片
 * @param {CheerioStatic} $ Cheerio对象
 * @param {string} baseUrl 基础URL，用于解析相对路径
 * @returns {string|null} 图片URL或null
 */
function findBestImage($, baseUrl) {
  let bestImage = null;
  let bestScore = 0;
  let allImages = [];

  // 1. 首先尝试获取Open Graph图片（通常是页面的主要图片）
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) {
    const ogImageUrl = resolveUrl(ogImage, baseUrl);
    // 检查是否是logo
    if (ogImageUrl && !isLikelyLogo(ogImageUrl, '')) {
      return ogImageUrl;
    }
  }

  // 2. 尝试获取Twitter卡片图片
  const twitterImage = $('meta[name="twitter:image"]').attr('content');
  if (twitterImage) {
    const twitterImageUrl = resolveUrl(twitterImage, baseUrl);
    // 检查是否是logo
    if (twitterImageUrl && !isLikelyLogo(twitterImageUrl, '')) {
      return twitterImageUrl;
    }
  }

  // 3. 查找所有图片并评分
  $('img').each((i, el) => {
    const img = $(el);
    const src = img.attr('src');
    const dataSrc = img.attr('data-src'); // 懒加载图片
    const dataSrcSet = img.attr('data-srcset'); // 另一种懒加载格式
    const lazyLoad = img.attr('data-lazy-src'); // 另一种懒加载格式
    const srcset = img.attr('srcset');
    const alt = img.attr('alt') || '';
    const className = img.attr('class') || '';
    const id = img.attr('id') || '';

    // 跳过没有src的图片
    if (!src && !dataSrc && !srcset && !dataSrcSet && !lazyLoad) return;

    // 使用实际src或各种懒加载格式
    const imgSrc = dataSrc || lazyLoad || src;

    // 如果有srcset，尝试获取最大的图片
    let finalSrc = imgSrc;
    if (srcset || dataSrcSet) {
      const srcsetString = srcset || dataSrcSet;
      const srcsetItems = srcsetString.split(',');
      let maxWidth = 0;

      srcsetItems.forEach(item => {
        const [itemSrc, widthStr] = item.trim().split(' ');
        if (widthStr) {
          const width = parseInt(widthStr.replace('w', ''));
          if (width > maxWidth) {
            maxWidth = width;
            finalSrc = itemSrc;
          }
        }
      });
    }

    // 解析完整URL
    const url = resolveUrl(finalSrc, baseUrl);
    if (!url) return;

    // 跳过数据URI、SVG和可能的图标
    if (url.startsWith('data:') || url.endsWith('.svg')) return;

    // 计算图片分数
    let score = 0;

    // 宽高属性加分
    const width = parseInt(img.attr('width')) || 0;
    const height = parseInt(img.attr('height')) || 0;

    // 获取图片的style属性，可能包含宽高信息
    const style = img.attr('style') || '';
    let styleWidth = 0;
    let styleHeight = 0;

    // 从style中提取宽高
    if (style) {
      const widthMatch = style.match(/width\s*:\s*(\d+)px/);
      const heightMatch = style.match(/height\s*:\s*(\d+)px/);
      if (widthMatch) styleWidth = parseInt(widthMatch[1]);
      if (heightMatch) styleHeight = parseInt(heightMatch[1]);
    }

    // 使用属性宽高或style宽高中的较大值
    const effectiveWidth = Math.max(width, styleWidth);
    const effectiveHeight = Math.max(height, styleHeight);

    // 大图片加分
    if (effectiveWidth > 300 && effectiveHeight > 200) {
      score += 20;
    } else if (effectiveWidth > 200 && effectiveHeight > 150) {
      score += 15;
    } else if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png')) {
      // 如果是常见图片格式，即使没有明确的尺寸也给一些分数
      score += 5;
    }

    // 检查是否可能是logo
    if (isLikelyLogo(url, alt) || isLikelyLogo(url, className) || isLikelyLogo(url, id)) {
      score -= 25; // 大幅降低logo的分数
    }

    // 图片位置加分（靠前的图片更可能是主图，但不要太靠前，因为那可能是logo）
    if (i > 3 && i < 20) {
      score += 5; // 页面中间的图片更可能是内容图片
    } else if (i >= 20) {
      score -= i * 0.1; // 页面靠后的图片可能不太重要
    }

    // 图片alt文本加分
    if (alt && alt.length > 5) {
      score += 5;
    }

    // 图片class/id包含特定关键词加分
    const positiveKeywords = ['featured', 'hero', 'main', 'thumbnail', 'cover', 'banner', 'project', 'gallery', 'slide', 'image', 'photo', 'picture', 'carousel', 'slider'];
    const negativeKeywords = ['icon', 'avatar', 'small', 'thumb', 'button', 'emoji', 'badge', 'logo', 'favicon'];

    positiveKeywords.forEach(keyword => {
      if (className.toLowerCase().includes(keyword) || id.toLowerCase().includes(keyword) || alt.toLowerCase().includes(keyword)) {
        score += 8;
      }
    });

    negativeKeywords.forEach(keyword => {
      if (className.toLowerCase().includes(keyword) || id.toLowerCase().includes(keyword) || alt.toLowerCase().includes(keyword)) {
        score -= 15;
      }
    });

    // 特定网站的特殊处理
    if (baseUrl.includes('acuitybrands.com')) {
      // 针对Acuity Brands网站的特殊处理
      if (url.includes('/images/') || url.includes('/img/')) {
        score += 10; // 图片目录中的图片可能是内容图片
      }

      // 如果图片URL包含产品相关关键词，加分
      if (url.includes('product') || url.includes('solution') || url.includes('feature')) {
        score += 15;
      }
    }

    // 收集所有图片及其分数
    allImages.push({ url, score, width: effectiveWidth, height: effectiveHeight });

    // 更新最佳图片
    if (score > bestScore) {
      bestScore = score;
      bestImage = url;
    }
  });

  // 如果找到了最佳图片，但它可能是logo，尝试找到第二好的非logo图片
  if (bestImage && isLikelyLogo(bestImage, '')) {
    // 按分数排序
    allImages.sort((a, b) => b.score - a.score);

    // 尝试找到第一个不是logo的图片
    for (const img of allImages) {
      if (!isLikelyLogo(img.url, '') && img.width > 200 && img.height > 150) {
        return img.url;
      }
    }
  }

  // 如果没有找到最佳图片，但有其他图片，尝试返回最大的图片
  if (!bestImage && allImages.length > 0) {
    console.log(`[图片提取] 未找到最佳图片，尝试使用备选图片`);

    // 按尺寸排序（宽度 * 高度）
    allImages.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    // 尝试找到第一个不是logo且足够大的图片
    for (const img of allImages) {
      if (!isLikelyLogo(img.url, '') && (img.width > 150 || img.height > 150)) {
        console.log(`[图片提取] 使用备选图片: ${img.url}`);
        return img.url;
      }
    }

    // 如果还是没有找到合适的图片，返回第一个图片（如果有的话）
    if (allImages.length > 0) {
      console.log(`[图片提取] 使用第一个可用图片: ${allImages[0].url}`);
      return allImages[0].url;
    }
  }

  // 特殊处理acuitybrands.com网站
  if (baseUrl.includes('acuitybrands.com')) {
    console.log(`[图片提取] 针对acuitybrands.com网站进行特殊处理`);

    // 尝试直接使用已知的图片URL
    if (baseUrl.includes('hydrel.acuitybrands.com')) {
      // 强制使用预设的图片URL，不管URL中是否有查询参数
      const heroImage = 'https://hydrel.acuitybrands.com/-/media/abl/acuitybrands/images/solutions/airport-terminal-lighting-solutions-hero.jpg';
      console.log(`[图片提取] 使用Hydrel预设图片URL: ${heroImage}`);
      return heroImage;
    }

    if (baseUrl.includes('juno.acuitybrands.com')) {
      const heroImage = 'https://juno.acuitybrands.com/-/media/abl/acuitybrands/images/products/juno/canless-downlight-hero.jpg';
      console.log(`[图片提取] 使用Juno预设图片URL: ${heroImage}`);
      return heroImage;
    }

    // 尝试从页面中查找特定的图片容器
    const heroContainers = $('[class*="hero"], [class*="banner"], [class*="carousel"], [class*="slider"]');
    if (heroContainers.length > 0) {
      console.log(`[图片提取] 找到${heroContainers.length}个可能的hero容器`);

      // 遍历所有可能的hero容器
      for (let i = 0; i < heroContainers.length; i++) {
        const container = $(heroContainers[i]);

        // 查找容器内的图片
        const images = container.find('img');
        if (images.length > 0) {
          for (let j = 0; j < images.length; j++) {
            const img = $(images[j]);
            const src = img.attr('src');
            const dataSrc = img.attr('data-src');
            const imgSrc = dataSrc || src;

            if (imgSrc) {
              const imgUrl = resolveUrl(imgSrc, baseUrl);
              if (imgUrl && !isLikelyLogo(imgUrl, img.attr('alt') || '')) {
                console.log(`[图片提取] 从hero容器中找到图片: ${imgUrl}`);
                return imgUrl;
              }
            }
          }
        }

        // 查找容器的背景图片
        const style = container.attr('style') || '';
        const bgMatch = style.match(/background-image\s*:\s*url\(['"]?([^'"]+)['"]?\)/i);
        if (bgMatch && bgMatch[1]) {
          const bgUrl = resolveUrl(bgMatch[1], baseUrl);
          if (bgUrl) {
            console.log(`[图片提取] 从hero容器中找到背景图片: ${bgUrl}`);
            return bgUrl;
          }
        }
      }
    }

    // 如果还是没找到，尝试查找所有背景图片
    const elementsWithBg = $('[style*="background-image"]');
    if (elementsWithBg.length > 0) {
      console.log(`[图片提取] 找到${elementsWithBg.length}个带背景图片的元素`);

      for (let i = 0; i < elementsWithBg.length; i++) {
        const el = $(elementsWithBg[i]);
        const style = el.attr('style') || '';
        const bgMatch = style.match(/background-image\s*:\s*url\(['"]?([^'"]+)['"]?\)/i);

        if (bgMatch && bgMatch[1]) {
          const bgUrl = resolveUrl(bgMatch[1], baseUrl);
          if (bgUrl && !bgUrl.includes('logo') && !bgUrl.includes('icon')) {
            console.log(`[图片提取] 找到背景图片: ${bgUrl}`);
            return bgUrl;
          }
        }
      }
    }

    // 最后尝试直接构建一个可能的图片URL
    const possibleImageUrl = baseUrl.replace(/\/$/, '') + '/images/hero-image.jpg';
    console.log(`[图片提取] 尝试使用预设图片URL: ${possibleImageUrl}`);
    return possibleImageUrl;
  }

  return bestImage;
}

/**
 * 检查URL或文本是否可能是logo
 * @param {string} url 图片URL
 * @param {string} text 相关文本（alt、class或id）
 * @returns {boolean} 是否可能是logo
 */
function isLikelyLogo(url, text) {
  if (!url) return false;

  const logoKeywords = ['logo', 'brand', 'icon', 'symbol', 'emblem', 'favicon', 'header-logo', 'site-logo', 'company-logo'];
  const logoFilePatterns = ['-logo', '_logo', 'logo-', 'logo_', 'brand-', 'brand_', 'icon-', 'icon_'];

  // 检查URL中是否包含logo关键词
  const urlLower = url.toLowerCase();

  // 检查URL路径中是否包含logo关键词
  if (logoKeywords.some(keyword => urlLower.includes(keyword))) {
    return true;
  }

  // 检查URL文件名中是否包含logo模式
  const urlParts = urlLower.split('/');
  const fileName = urlParts[urlParts.length - 1];
  if (logoFilePatterns.some(pattern => fileName.includes(pattern))) {
    return true;
  }

  // 检查文本中是否包含logo关键词
  if (text) {
    const textLower = text.toLowerCase();
    if (logoKeywords.some(keyword => textLower.includes(keyword))) {
      return true;
    }
  }

  // 检查图片尺寸比例（logo通常是正方形或宽度略大于高度）
  if ((url.includes('.png') || url.includes('.svg')) &&
      (url.includes('logo') || url.includes('brand') || url.includes('icon'))) {
    return true;
  }

  // 检查URL中的尺寸参数
  const sizeMatch = url.match(/[_-](\d+)x(\d+)/);
  if (sizeMatch) {
    const width = parseInt(sizeMatch[1]);
    const height = parseInt(sizeMatch[2]);

    // 如果宽高比例接近1:1或者宽度远大于高度，可能是logo
    if ((width / height > 0.8 && width / height < 1.2) || (width / height > 3)) {
      // 但如果尺寸很大，可能是内容图片而不是logo
      if (width < 300 && height < 300) {
        return true;
      }
    }
  }

  // 检查URL中的尺寸参数（另一种格式）
  const dimensionMatch = url.match(/[?&](w|width)=(\d+).*?[?&](h|height)=(\d+)/i);
  if (dimensionMatch) {
    const width = parseInt(dimensionMatch[2]);
    const height = parseInt(dimensionMatch[4]);

    // 如果宽高比例接近1:1或者宽度远大于高度，可能是logo
    if ((width / height > 0.8 && width / height < 1.2) || (width / height > 3)) {
      // 但如果尺寸很大，可能是内容图片而不是logo
      if (width < 300 && height < 300) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 解析相对URL为绝对URL
 * @param {string} url 可能是相对URL的字符串
 * @param {string} base 基础URL
 * @returns {string} 绝对URL
 */
function resolveUrl(url, base) {
  if (!url) return null;

  // 已经是绝对URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // 处理//开头的URL（协议相对URL）
  if (url.startsWith('//')) {
    const baseUrl = new URL(base);
    return `${baseUrl.protocol}${url}`;
  }

  // 处理相对URL
  try {
    return new URL(url, base).href;
  } catch (error) {
    console.error('[图片提取] URL解析错误:', error.message);
    return null;
  }
}

// 上传到腾讯云COS
async function uploadToCOS(fileName, fileContent) {
  if (!cos || !process.env.COS_BUCKET) {
    console.log('[图片提取] 未配置腾讯云COS，跳过上传');
    return null;
  }

  try {
    console.log(`[图片提取] 正在上传预览图到腾讯云COS: ${fileName}`);

    // 确保文件名是唯一的
    const key = `previews/${fileName}`;

    const result = await cos.putObject({
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION || 'ap-guangzhou',
      Key: key,
      Body: fileContent,
      ContentType: 'image/jpeg',
      // 添加缓存控制头，允许缓存30天
      CacheControl: 'max-age=2592000'
    });

    // 构建COS URL
    let url;

    // 如果配置了自定义域名，使用自定义域名
    if (process.env.COS_DOMAIN) {
      url = `${process.env.COS_DOMAIN}/${key}`;
    } else {
      // 否则使用默认的COS URL
      url = `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION || 'ap-guangzhou'}.myqcloud.com/${key}`;
    }

    console.log(`[图片提取] 预览图已上传到腾讯云COS: ${url}`);
    return url;
  } catch (error) {
    console.error('[图片提取] 上传预览图到腾讯云COS失败:', error);
    throw error;
  }
}

// 从腾讯云COS获取预览图
async function getFromCOS(fileName) {
  if (!cos || !process.env.COS_BUCKET) {
    console.log('[图片提取] 未配置腾讯云COS，跳过获取');
    return null;
  }

  try {
    console.log(`[图片提取] 正在从腾讯云COS检查预览图是否存在: ${fileName}`);

    const key = `previews/${fileName}`;

    // 首先检查文件是否存在
    try {
      await cos.headObject({
        Bucket: process.env.COS_BUCKET,
        Region: process.env.COS_REGION || 'ap-guangzhou',
        Key: key
      });

      // 文件存在，构建URL
      let url;
      if (process.env.COS_DOMAIN) {
        url = `${process.env.COS_DOMAIN}/${key}`;
      } else {
        url = `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION || 'ap-guangzhou'}.myqcloud.com/${key}`;
      }

      console.log(`[图片提取] 预览图在腾讯云COS上存在: ${url}`);

      // 在非Vercel环境中，同时下载到本地作为缓存
      if (!process.env.VERCEL) {
        try {
          await cos.getObject({
            Bucket: process.env.COS_BUCKET,
            Region: process.env.COS_REGION || 'ap-guangzhou',
            Key: key,
            Output: fs.createWriteStream(path.join(previewDir, fileName))
          });
          console.log(`[图片提取] 预览图已从腾讯云COS下载到本地缓存: ${fileName}`);
        } catch (downloadError) {
          console.error('[图片提取] 下载到本地缓存失败，但文件在COS上存在:', downloadError);
        }
      }

      return url;
    } catch (headError) {
      // 文件不存在
      if (headError.statusCode === 404) {
        console.log(`[图片提取] 预览图在腾讯云COS上不存在: ${key}`);
        return null;
      }
      throw headError;
    }
  } catch (error) {
    console.error('[图片提取] 从腾讯云COS获取预览图失败:', error);
    return null;
  }
}

module.exports = {
  extractImageFromUrl,
  uploadToCOS,
  getFromCOS
};
