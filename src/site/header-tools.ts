import { icon } from './icons';

const SKIN_STORAGE_KEY = 'ht-skin';

/** 顶栏帮助与设置：两个入口都有真实功能，不放无行为装饰按钮。 */
export function renderHeaderTools(): string {
  return `
    <div class="lt-header-tools">
      <button class="lt-icon-button" type="button" data-help-open aria-haspopup="dialog" aria-label="操作说明">${icon('help')}</button>
      <button class="lt-icon-button" type="button" data-settings-open aria-haspopup="dialog" aria-label="设置">${icon('settings')}</button>
    </div>
    <dialog class="lt-header-dialog" data-help-dialog aria-labelledby="lt-help-title">
      <div class="lt-header-dialog-head"><h2 id="lt-help-title">操作说明</h2><button class="lt-icon-button" type="button" data-dialog-close aria-label="关闭操作说明">×</button></div>
      <h3>年表</h3>
      <ul>
        <li>滚轮缩放时间窗，拖动平移；点击人物或事件查看预览。</li>
        <li>底部朝代带可按年代跳转；专题下拉切换朝代与主题。</li>
        <li>键盘：画布聚焦后，左右方向键平移，加号减号缩放。</li>
        <li>「分类」选择显示的泳道与事件类型；「导出」保存 PNG 或 SVG。</li>
      </ul>
      <h3>全站</h3>
      <ul>
        <li>顶栏搜索覆盖人物、事件、群像和朝代，回车或点击放大镜提交。</li>
        <li>人物与事件详情页的「在年表中查看」回到对应时间窗。</li>
        <li>目录页筛选与排序写入地址栏，可直接分享链接。</li>
      </ul>
    </dialog>
    <dialog class="lt-header-dialog" data-settings-dialog aria-labelledby="lt-settings-title">
      <div class="lt-header-dialog-head"><h2 id="lt-settings-title">设置</h2><button class="lt-icon-button" type="button" data-dialog-close aria-label="关闭设置">×</button></div>
      <fieldset class="lt-skin-options"><legend>年表主题</legend>
        <label><input type="radio" name="lt-skin" value="voyage" /> 巡航（纸本）</label>
        <label><input type="radio" name="lt-skin" value="deepspace" /> 深空（星空）</label>
      </fieldset>
      <p class="lt-section-note">主题作用于年表画布，进入年表时生效；内容页始终使用编年档案馆配色。</p>
    </dialog>
  `;
}

export function wireHeaderTools(root: ParentNode): void {
  const dialogs = root.querySelectorAll<HTMLDialogElement>('.lt-header-dialog');
  if (dialogs.length === 0) return;
  let trigger: HTMLElement | null = null;

  root.querySelectorAll<HTMLButtonElement>('[data-help-open], [data-settings-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const selector = button.hasAttribute('data-help-open') ? '[data-help-dialog]' : '[data-settings-dialog]';
      const dialog = root.querySelector<HTMLDialogElement>(selector);
      if (!dialog) return;
      trigger = button;
      if (dialog.matches('[data-settings-dialog]')) {
        const current = localStorage.getItem(SKIN_STORAGE_KEY) ?? 'voyage';
        dialog.querySelectorAll<HTMLInputElement>('input[name="lt-skin"]').forEach((input) => {
          input.checked = input.value === current;
        });
      }
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-dialog-close]')?.focus();
    });
  });

  dialogs.forEach((dialog) => {
    dialog.querySelectorAll<HTMLButtonElement>('[data-dialog-close]').forEach((button) => {
      button.addEventListener('click', () => dialog.close());
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => trigger?.focus());
    dialog.querySelectorAll<HTMLInputElement>('input[name="lt-skin"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        localStorage.setItem(SKIN_STORAGE_KEY, input.value);
        // 年表页内立即换肤；其他页面写入存储，下次进入年表生效。
        document.getElementById(input.value === 'deepspace' ? 'skin-deepspace' : 'skin-voyage')?.click();
      });
    });
  });
}
