import { escapeHtml } from './escape';

/** 装饰横幅素材 id，对应 public/media/banners/ 与 public/media/manifest.json。 */
export type BannerImage = 'timeline' | 'home' | 'people' | 'events' | 'collections' | 'eras' | 'event-anshi';

/**
 * 装饰带图片：纯装饰（alt 为空），标题与年份始终以 DOM 文字存在。
 * srcset 对应素材清单的 768/1440/2000 三档宽度。
 */
export function bannerPicture(image: BannerImage, eager = true): string {
  return `<img class="lt-page-banner-art" src="/media/banners/banner-${image}-1440.webp" srcset="/media/banners/banner-${image}-768.webp 768w, /media/banners/banner-${image}-1440.webp 1440w, /media/banners/banner-${image}-2000.webp 2000w" sizes="100vw" width="2400" height="800" alt="" aria-hidden="true" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`;
}

export interface PageBannerOptions {
  image: BannerImage;
  /** 纯文本页标题，内部转义。 */
  title: string;
  /** 纯文本导语，内部转义。 */
  subtitle?: string;
  /** 面包屑 HTML，调用方负责转义。 */
  breadcrumb?: string;
  /** 标题区下方的附加内容（例如目录搜索表单），调用方负责转义。 */
  body?: string;
  /** 右侧操作区 HTML。 */
  actions?: string;
  /** paper = 淡墨图 + 深墨标题（目录页）；wood = 深色图 + 米白标题（年表、详情）。 */
  tone?: 'paper' | 'wood';
}

export function pageBanner({
  image,
  title,
  subtitle,
  breadcrumb,
  body,
  actions,
  tone = 'paper',
}: PageBannerOptions): string {
  return `<header class="lt-page-banner lt-page-banner-${tone}">${bannerPicture(image)}<div class="lt-page-banner-inner"><div class="lt-page-banner-text">${breadcrumb ?? ''}<h1 tabindex="-1">${escapeHtml(title)}</h1>${subtitle ? `<p class="lt-page-banner-subtitle">${escapeHtml(subtitle)}</p>` : ''}</div>${actions ? `<div class="lt-page-banner-actions">${actions}</div>` : ''}</div>${body ? `<div class="lt-page-banner-body">${body}</div>` : ''}</header>`;
}
