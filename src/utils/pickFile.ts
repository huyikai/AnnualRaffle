/**
 * 网页版的「选文件」实现（隐藏 file input）
 *
 * 桌面端走 Tauri 的原生对话框（@tauri-apps/plugin-dialog），只有网页版需要这一套。
 *
 * 这里解决一个容易漏掉的问题：浏览器的文件选择框没有可靠的「取消」事件。
 * 用户点取消时既不触发 change 也不触发 error，如果只在 change 里清理 input，
 * 就会同时出两个问题：
 *   1. 每取消一次就在 document.body 上永久残留一个隐藏 input
 *   2. 等待它的 Promise 永远不 resolve，调用方的 await 一直挂着
 *
 * 取消信号有三路，任一路命中都当作取消处理：
 *   - cancel 事件：Chromium 113+ 原生支持
 *   - window 重新获得焦点：选择框关闭后浏览器会把焦点还回来，
 *     change 一定先于 focus 派发，所以 focus 到达时还没 change 即为取消
 *   - 都没有时退化为「不清理」，与本工具引入前的行为一致，不会更差
 */

export interface PickFileOptions {
  /** accept 属性，如 '.csv,.txt' 或 'image/*' */
  accept?: string;
  multiple?: boolean;
  /** 按文件夹选择（依赖非标准的 webkitdirectory） */
  directory?: boolean;
}

/** 焦点回来后再等这么久才判定为取消，留出 change 派发的余量 */
const CANCEL_GRACE_MS = 300;

/**
 * 弹出文件选择框。
 * @returns 选中的文件列表；用户取消或未选择时返回空数组
 */
export function pickFiles(options: PickFileOptions = {}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options.accept) input.accept = options.accept;
    if (options.multiple) input.multiple = true;
    if (options.directory) input.setAttribute('webkitdirectory', '');
    input.style.display = 'none';

    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    const onWindowFocus = () => {
      clearTimeout(graceTimer);
      graceTimer = setTimeout(() => {
        if (!settled) finish([]);
      }, CANCEL_GRACE_MS);
    };

    function finish(files: File[]) {
      if (settled) return;
      settled = true;
      clearTimeout(graceTimer);
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
      resolve(files);
    }

    input.addEventListener('change', () => {
      finish(Array.from(input.files ?? []));
    });
    input.addEventListener('cancel', () => finish([]));

    document.body.appendChild(input);
    window.addEventListener('focus', onWindowFocus);

    // 先 focus 再 click：部分浏览器要求元素已获得焦点才会真正弹出选择框
    input.focus();
    input.click();
  });
}
