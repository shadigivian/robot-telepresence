/* Connection feedback also works on the hosted pages while the laptop is off. */
(() => {
  'use strict';
  const panel = document.createElement('aside');
  panel.className = 'connection-notice';
  panel.setAttribute('aria-label', 'وضعیت اتصال سامانه');
  const message = document.createElement('span');
  message.setAttribute('role', 'status');
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn';
  retry.textContent = 'تلاش دوباره';
  panel.append(message, retry);
  const join = document.querySelector('#join');
  function place() {
    const parent = join
      ? (join.hidden ? document.querySelector('#call .topbar') : join.querySelector('.card'))
      : document.querySelector('.wrap') || (document.body.dataset.app === 'portal' && document.querySelector('main')) || document.body;
    if (panel.parentElement !== parent) parent.prepend(panel);
  }
  place();
  if (join) new MutationObserver(place).observe(join, { attributes: true, attributeFilter: ['hidden'] });
  function render() {
    place();
    const status = Platform.connection;
    panel.hidden = status.state === 'ready';
    panel.dataset.state = status.state;
    retry.disabled = status.state === 'checking';
    message.textContent = status.state === 'checking'
      ? 'در حال اتصال به سامانه…'
      : 'ارتباط با سامانه برقرار نیست. لپ‌تاپ ربات باید روشن و برنامه start-robot.bat در حال اجرا باشد؛ سپس دوباره تلاش کنید.';
  }
  retry.addEventListener('click', () => Platform.refreshBackend().catch(() => {}));
  Platform.on('backend:status', render);
  render();
})();
