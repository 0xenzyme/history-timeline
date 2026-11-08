import './styles.css';

const deepLink = new URLSearchParams(location.search).get('path');
if (deepLink?.startsWith('/') && !deepLink.startsWith('//') && !deepLink.includes('\\')) {
  const query = new URLSearchParams(location.search);
  query.delete('path');
  const suffix = query.toString();
  history.replaceState(history.state, '', `${deepLink}${suffix ? `?${suffix}` : ''}${location.hash}`);
}

const timelinePage =
  (location.pathname === '/' && Boolean(location.hash)) ||
  location.pathname.endsWith('/index.html') ||
  location.pathname === '/timeline' ||
  location.pathname === '/timeline.html' ||
  location.pathname === '/legacy.html';

if (timelinePage) {
  void Promise.all([
    import('./app/app'),
    import('./site/router'),
    import('./site/navigation'),
    import('./site/header-tools'),
  ]).then(([{ boot }, { startSiteRouter }, { renderSiteHeader, wireSiteMenu }, { wireHeaderTools }]) => {
    document.body.classList.toggle('timeline-legacy', location.pathname !== '/timeline' || Boolean(location.hash));
    // 年表与内容页共用同一套顶栏：品牌、六项导航、全站搜索、帮助与设置。
    const mount = document.getElementById('site-header-mount');
    if (mount) {
      mount.innerHTML = renderSiteHeader({ section: 'timeline' });
      wireSiteMenu(mount);
      wireHeaderTools(mount);
    }
    void boot();
    startSiteRouter(false);
  });
} else {
  void import('./site/router').then(({ startSiteRouter }) => startSiteRouter());
}
