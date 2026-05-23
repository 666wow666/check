import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App } from '@capacitor/app';

// ⚠️ 重要：在这里填入你的 GitHub 仓库信息！
// 例如：'zhangsan/attendance-app'
const GITHUB_REPO = '你的用户名/仓库名'; // 保持占位符，等用户配置后再改
const CURRENT_VERSION = '1.0.0';
const IS_CAPACITOR = typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable('CapacitorUpdater');

export interface UpdateInfo {
  version: string;
  url: string;
  changelog?: string;
}

/**
 * 检查更新
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    // 如果不是在 Capacitor 环境中，或者 GitHub Repo 还是占位符，直接跳过
    if (!IS_CAPACITOR || GITHUB_REPO === '你的用户名/仓库名') {
      return null;
    }

    // 从 GitHub Releases 获取最新版本
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
    );

    if (!response.ok) {
      return null;
    }

    const release = await response.json();
    const latestVersion = release.tag_name.replace('v', '');

    // 比较版本
    if (isNewerVersion(latestVersion, CURRENT_VERSION)) {
      // 找到 dist.zip 的下载链接
      const distAsset = release.assets.find((asset: any) => 
        asset.name === 'dist.zip'
      );

      if (distAsset) {
        return {
          version: latestVersion,
          url: distAsset.browser_download_url,
          changelog: release.body || ''
        };
      }
    }

    return null;
  } catch (error) {
    // 静默处理更新检查错误，不影响主应用
    return null;
  }
}

/**
 * 下载并应用更新
 */
export async function downloadAndApplyUpdate(update: UpdateInfo): Promise<void> {
  try {
    if (!IS_CAPACITOR) {
      throw new Error('只能在 Capacitor 应用环境中使用更新功能');
    }

    console.log('开始下载更新:', update.version);

    // 下载更新
    const version = await CapacitorUpdater.download({
      version: update.version,
      url: update.url
    });

    console.log('下载完成，应用更新...');

    // 应用更新
    await CapacitorUpdater.set(version);

    console.log('更新应用成功！');
  } catch (error) {
    console.error('更新失败:', error);
    throw error;
  }
}

/**
 * 比较版本号
 */
function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = latest.split('.').map(Number);
  const currentParts = current.split('.').map(Number);

  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const latestNum = latestParts[i] || 0;
    const currentNum = currentParts[i] || 0;

    if (latestNum > currentNum) {
      return true;
    } else if (latestNum < currentNum) {
      return false;
    }
  }

  return false;
}

/**
 * 初始化更新监听
 */
export function initUpdateListener() {
  try {
    // 只在 Capacitor 环境中启用更新功能
    if (!IS_CAPACITOR) {
      return;
    }

    // 应用启动时通知 Capgo
    CapacitorUpdater.notifyAppReady();

    // 监听应用状态变化
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        // 应用进入前台时检查更新
        const update = await checkForUpdates();
        if (update) {
          // 这里可以显示更新提示给用户
          console.log('发现新版本:', update.version);
          // 可以添加 UI 让用户选择是否更新
        }
      }
    });
  } catch (error) {
    // 静默处理初始化错误
  }
}
